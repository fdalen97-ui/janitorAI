/**
 * Benchmark scoring for Labs test runs.
 *
 * Scores a run's DamageAnalysis against structured reference fields, NOT a text
 * diff against a human report — a similarity score over prose would reward
 * matching the report's wording rather than reaching its conclusion.
 *
 * Six dimensions, 1 point each, mirroring the manual rubric in
 * docs/valideringscaser.md (Årsak, Akutt/gradvis, Hypotese-disiplin, Sitatport,
 * Evidenstro) plus the kildekategori dimension that
 * docs/ARCHITECTURE_WATER_DAMAGE_TREE.md steg 3 asks for.
 *
 * Every dimension declares a `basis`:
 *   "auto"      — a deterministic field comparison; trust it.
 *   "heuristic" — keyword/shape matching that approximates a judgement a
 *                 person makes. Surfaced for review, overridable, and never
 *                 presented as definitive. With a single reference case, a
 *                 scorer that implies more precision than it has is worse than
 *                 one that admits the gap.
 *
 * Pure functions only: no DB, no network, no clock.
 */

const DIMENSIONS = [
  "kildekategori",
  "akutt_gradvis",
  "aarsak",
  "hypotese_disiplin",
  "sitatport",
  "evidenstro",
];

function norm(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .trim();
}

/** Free-text haystack the heuristic dimensions read. */
function analysisText(analysis) {
  const a = analysis || {};
  return norm([a.cause, a.description, a.source, a.extent_description].filter(Boolean).join("\n"));
}

function dimension(id, points, basis, reason, extra = {}) {
  return { dimension: id, points, max: 1, basis, reason, ...extra };
}

/**
 * 1. Kildekategori — did the run land on the expected one of the five sources?
 * Enum values carry Ø (NEDBØR, TRYKKSATT_RØR, AVLØPSRØR), so compare the exact
 * wire forms rather than an ASCII transliteration.
 */
function scoreKildekategori(analysis, reference) {
  const expected = reference.expected_source_category;
  const actual = (analysis || {}).source_category;
  if (!expected) {
    return dimension("kildekategori", 0, "auto", "Ingen forventet kildekategori i fasit", { skipped: true });
  }
  const hit = String(actual || "") === String(expected);
  return dimension(
    "kildekategori",
    hit ? 1 : 0,
    "auto",
    hit ? `Traff ${expected}` : `Forventet ${expected}, fikk ${actual || "(tomt)"}`,
    { expected, actual: actual || null }
  );
}

/** 2. Akutt/gradvis — the insurance boundary. */
function scoreAkuttGradvis(analysis, reference) {
  const expected = reference.expected_acute_or_gradual;
  const actual = (analysis || {}).acute_or_gradual;
  if (!expected) {
    return dimension("akutt_gradvis", 0, "auto", "Ingen forventet klassifisering i fasit", { skipped: true });
  }
  const hit = String(actual || "") === String(expected);
  return dimension(
    "akutt_gradvis",
    hit ? 1 : 0,
    "auto",
    hit ? `Traff ${expected}` : `Forventet ${expected}, fikk ${actual || "(tomt)"}`,
    { expected, actual: actual || null }
  );
}

/**
 * 3. Årsak — does the stated cause actually name the mechanism? Keyword
 * coverage, reported as matched/missing rather than a similarity percentage,
 * so a miss says which concept is absent.
 */
function scoreAarsak(analysis, reference) {
  const keywords = reference.root_cause_keywords || [];
  if (!keywords.length) {
    return dimension("aarsak", 0, "heuristic", "Ingen nøkkelord i fasit", { skipped: true });
  }
  const haystack = analysisText(analysis);
  const matched = keywords.filter((kw) => haystack.includes(norm(kw)));
  const missing = keywords.filter((kw) => !haystack.includes(norm(kw)));
  const required = Number.isFinite(reference.root_cause_keywords_min)
    ? reference.root_cause_keywords_min
    : Math.max(1, Math.ceil(keywords.length / 2));
  const hit = matched.length >= required;
  return dimension(
    "aarsak",
    hit ? 1 : 0,
    "heuristic",
    `${matched.length}/${keywords.length} nøkkelord (krever ${required})` +
      (missing.length ? ` — mangler: ${missing.join(", ")}` : ""),
    { matched, missing, required }
  );
}

/**
 * 4. Hypotese-disiplin — the highest-signal check. An excluded cause is one the
 * evidence has disproven (a pressure-tested dry pipe); concluding it anyway is
 * the exact failure the Midtgjerdinga case exists to catch, so it hard-fails
 * regardless of how well the rest reads.
 */
function scoreHypoteseDisiplin(analysis, reference) {
  const excluded = reference.excluded_causes || [];
  const a = analysis || {};
  const haystack = analysisText(a);

  for (const entry of excluded) {
    const category = typeof entry === "string" ? entry : entry.category;
    const terms = (typeof entry === "string" ? [] : entry.assertion_terms) || [];

    if (category && String(a.source_category || "") === String(category)) {
      return dimension(
        "hypotese_disiplin",
        0,
        "auto",
        `Konkluderte med ${category}, som fasit eksplisitt utelukker` +
          (entry.reason ? ` (${entry.reason})` : ""),
        { violated: category }
      );
    }

    // The category field can be right while the prose still asserts the
    // excluded mechanism as the cause — catch that too, but only when it is
    // not framed as someone's reported hypothesis.
    const asserted = terms.filter((term) => haystack.includes(norm(term)));
    if (asserted.length) {
      const framedAsReported = (reference.reported_hypothesis_terms || []).some((t) =>
        haystack.includes(norm(t))
      );
      if (!framedAsReported) {
        return dimension(
          "hypotese_disiplin",
          0,
          "heuristic",
          `Omtaler utelukket årsak (${asserted.join(", ")}) uten å ramme den inn som rapportert antakelse`,
          { violated: category || null, asserted }
        );
      }
    }
  }

  if (!excluded.length) {
    return dimension("hypotese_disiplin", 1, "auto", "Ingen utelukkede årsaker i fasit å bryte");
  }
  return dimension(
    "hypotese_disiplin",
    1,
    "heuristic",
    "Ingen utelukket årsak konkludert; avkreftende funn respektert"
  );
}

/**
 * 5. Sitatport — citation integrity. The engine's Sitatport already nulls
 * anything outside the verified register, so a surviving reference is
 * well-formed; this checks it is also *right for this case*.
 */
function scoreSitatport(analysis, reference) {
  const accepted = (reference.accepted_byggforsk || []).map(String);
  const points = ((analysis || {}).evidence_points || []).filter(Boolean);
  const cited = points
    .map((p) => p.technical_reference)
    .filter((ref) => ref != null && String(ref).trim() !== "");

  if (!cited.length) {
    const ok = reference.empty_reference_acceptable !== false;
    return dimension(
      "sitatport",
      ok ? 1 : 0,
      "auto",
      ok ? "Ingen referanser oppgitt (akseptabelt)" : "Fasit krever en referanse, men ingen ble oppgitt",
      { cited: [] }
    );
  }

  const bad = cited.filter((ref) => !accepted.some((num) => String(ref).includes(num)));
  return dimension(
    "sitatport",
    bad.length ? 0 : 1,
    "auto",
    bad.length
      ? `Siterte referanser utenfor fasit: ${bad.join("; ")}`
      : `Alle ${cited.length} referanser innenfor fasit`,
    { cited, rejected: bad, accepted }
  );
}

/**
 * 6. Evidenstro — do the evidence points point at material that exists? Catches
 * a photo index outside the attached set, which is a fabricated citation of
 * evidence even when the prose is plausible.
 */
function scoreEvidenstro(analysis, reference, context = {}) {
  const points = ((analysis || {}).evidence_points || []).filter(Boolean);
  if (!points.length) {
    return dimension("evidenstro", 0, "heuristic", "Ingen bevispunkter i analysen", { skipped: false });
  }

  const photoCount = Number.isFinite(context.photoCount) ? context.photoCount : null;
  const problems = [];

  for (const [i, point] of points.entries()) {
    const idx = point.source_photo_index;
    if (idx != null) {
      if (!Number.isInteger(idx) || idx < 1) {
        problems.push(`bevispunkt ${i + 1}: ugyldig source_photo_index ${idx}`);
      } else if (photoCount != null && idx > photoCount) {
        problems.push(`bevispunkt ${i + 1}: viser til foto ${idx}, men bare ${photoCount} foto er vedlagt`);
      }
    }
    if (!norm(point.visual_confirmation)) {
      problems.push(`bevispunkt ${i + 1}: mangler visual_confirmation`);
    }
  }

  return dimension(
    "evidenstro",
    problems.length ? 0 : 1,
    "heuristic",
    problems.length ? problems.join("; ") : `${points.length} bevispunkter uten påviste avvik`,
    { problems, photoCount }
  );
}

/**
 * Scores one run. `context.photoCount` lets the evidence check verify photo
 * indices against the material actually sent.
 *
 * `manualOverride` is a map of dimension id -> {points, reason}, applied on top
 * so a human can correct a heuristic call without the stored run losing what
 * the scorer originally said.
 */
function scoreRun(analysis, reference, context = {}, manualOverride = null) {
  if (!reference) return null;

  const detail = [
    scoreKildekategori(analysis, reference),
    scoreAkuttGradvis(analysis, reference),
    scoreAarsak(analysis, reference),
    scoreHypoteseDisiplin(analysis, reference),
    scoreSitatport(analysis, reference),
    scoreEvidenstro(analysis, reference, context),
  ];

  const applied = detail.map((d) => {
    const override = manualOverride && manualOverride[d.dimension];
    if (!override) return d;
    return {
      ...d,
      auto_points: d.points,
      points: override.points === 1 ? 1 : 0,
      basis: "manual",
      reason: override.reason || `Overstyrt manuelt (auto sa ${d.points})`,
    };
  });

  const total = applied.reduce((sum, d) => sum + d.points, 0);
  return {
    total,
    max: applied.length,
    detail: applied,
    needsReview: applied.some((d) => d.basis === "heuristic"),
    provisionalReference: reference.provisional === true,
  };
}

module.exports = {
  DIMENSIONS,
  scoreRun,
  scoreKildekategori,
  scoreAkuttGradvis,
  scoreAarsak,
  scoreHypoteseDisiplin,
  scoreSitatport,
  scoreEvidenstro,
};
