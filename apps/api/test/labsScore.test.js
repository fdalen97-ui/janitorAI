const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scoreRun,
  scoreKildekategori,
  scoreAkuttGradvis,
  scoreAarsak,
  scoreHypoteseDisiplin,
  scoreSitatport,
  scoreEvidenstro,
} = require("../src/labs/score");
const { readFixture } = require("../src/labs/cases");

// The committed fasit is the real input this scorer runs against in production,
// so the tests use it rather than an invented one.
const MIDTGJERDINGA = readFixture().find((c) => c.case_id === "midtgjerdinga");
const REF = MIDTGJERDINGA.reference;

/** A run that matches the fasit on every dimension. */
function goodAnalysis() {
  return {
    area: "Stue",
    source: "Nedbør bak ubeskyttet grunnmursplast",
    source_category: "NEDBØR",
    cause:
      "Nedbør renner ned bak grunnmursplast som er ubeskyttet på toppen, med kapillæroppsug i såle. " +
      "Eier antar rørlekkasje fra utekran, men rørene er trykktestet uten drypp og bunnsvill måler tørt.",
    acute_or_gradual: "GRADVIS",
    description: "Fukt kun i bunn av trefiberplater. Avkreftende funn utelukker trykksatt rør.",
    evidence_points: [
      {
        caption: "Grunnmursplast",
        visual_confirmation: "Ubeskyttet overkant, synlig vannvei bak platen",
        source_photo_index: 1,
        technical_reference: "Byggforsk 711.401 Fuktsikring av bygninger mot grunnen",
        timestamp_ms: null,
      },
    ],
    is_habitable: true,
    extent_description: "Nedre 40 cm av vegg mot terreng",
    repairs_description: "Avslutte grunnmursplast korrekt, utbedre drenering",
  };
}

test("scores a matching run full marks", () => {
  const result = scoreRun(goodAnalysis(), REF, { photoCount: 2 });
  assert.equal(result.max, 6);
  assert.equal(result.total, 6, JSON.stringify(result.detail, null, 2));
});

test("hard-fails hypotese-disiplin when an excluded cause is concluded", () => {
  // This is the exact regression the Midtgjerdinga case exists to catch: the
  // model adopting the owner's pipe-leak theory that the evidence disproved.
  const analysis = goodAnalysis();
  analysis.source_category = "TRYKKSATT_RØR";
  analysis.cause = "Lekkasje fra rør til utekran i delevegg.";

  const dim = scoreHypoteseDisiplin(analysis, REF);
  assert.equal(dim.points, 0);
  assert.equal(dim.basis, "auto");
  assert.match(dim.reason, /TRYKKSATT_RØR/);
});

test("excluded cause asserted in prose fails even when the category is right", () => {
  const analysis = goodAnalysis();
  analysis.cause = "Årsaken er rørlekkasje i deleveggen.";
  analysis.description = "Vann fra røret har fuktet platene.";

  const dim = scoreHypoteseDisiplin(analysis, REF);
  assert.equal(dim.points, 0);
  assert.equal(dim.basis, "heuristic");
});

test("excluded mechanism framed as a reported hypothesis is allowed", () => {
  // "Eier antar rørlekkasje" is correct practice, not a violation.
  const dim = scoreHypoteseDisiplin(goodAnalysis(), REF);
  assert.equal(dim.points, 1);
});

test("kildekategori compares the Ø-carrying wire values exactly", () => {
  assert.equal(scoreKildekategori({ source_category: "NEDBØR" }, REF).points, 1);
  // ASCII transliteration must not pass — the enum value carries Ø.
  assert.equal(scoreKildekategori({ source_category: "NEDBOR" }, REF).points, 0);
  assert.equal(scoreKildekategori({ source_category: "USIKKER" }, REF).points, 0);
});

test("akutt/gradvis is an exact enum match", () => {
  assert.equal(scoreAkuttGradvis({ acute_or_gradual: "GRADVIS" }, REF).points, 1);
  assert.equal(scoreAkuttGradvis({ acute_or_gradual: "AKUTT" }, REF).points, 0);
  assert.equal(scoreAkuttGradvis({}, REF).points, 0);
});

test("aarsak reports which keywords are missing rather than a bare score", () => {
  const thin = { cause: "Fukt i vegg", description: "Uklart opphav" };
  const dim = scoreAarsak(thin, REF);
  assert.equal(dim.points, 0);
  assert.ok(dim.missing.includes("grunnmursplast"));
  assert.equal(dim.basis, "heuristic");
});

test("aarsak passes on the configured minimum keyword count", () => {
  const partial = { cause: "Vann trenger inn bak grunnmursplast, med kapillæroppsug i såle", description: "" };
  const dim = scoreAarsak(partial, REF);
  assert.equal(dim.points, 1);
  assert.equal(dim.matched.length, 3);
  assert.ok(dim.missing.includes("nedbør"));
});

test("sitatport accepts an empty reference field", () => {
  const analysis = goodAnalysis();
  analysis.evidence_points[0].technical_reference = null;
  const dim = scoreSitatport(analysis, REF);
  assert.equal(dim.points, 1);
});

test("sitatport rejects a reference outside the case fasit", () => {
  const analysis = goodAnalysis();
  analysis.evidence_points[0].technical_reference = "Byggforsk 727.813 Våtrom";
  const dim = scoreSitatport(analysis, REF);
  assert.equal(dim.points, 0);
  assert.deepEqual(dim.rejected, ["Byggforsk 727.813 Våtrom"]);
});

test("evidenstro flags a photo index beyond the attached set", () => {
  const analysis = goodAnalysis();
  analysis.evidence_points[0].source_photo_index = 7;
  const dim = scoreEvidenstro(analysis, REF, { photoCount: 2 });
  assert.equal(dim.points, 0);
  assert.match(dim.reason, /bare 2 foto/);
});

test("evidenstro tolerates a null photo index (note- or video-sourced evidence)", () => {
  const analysis = goodAnalysis();
  analysis.evidence_points[0].source_photo_index = null;
  assert.equal(scoreEvidenstro(analysis, REF, { photoCount: 2 }).points, 1);
});

test("result flags heuristic dimensions as needing review", () => {
  const result = scoreRun(goodAnalysis(), REF, { photoCount: 2 });
  assert.equal(result.needsReview, true);
  const bases = new Set(result.detail.map((d) => d.basis));
  assert.ok(bases.has("auto") && bases.has("heuristic"));
});

test("result flags a provisional fasit so scores are not over-trusted", () => {
  const result = scoreRun(goodAnalysis(), { ...REF, provisional: true }, {});
  assert.equal(result.provisionalReference, true);
});

test("manual override replaces a dimension but preserves what the scorer said", () => {
  // Blank every field the keyword haystack reads — `source` and
  // `extent_description` count too, not just `cause`/`description`.
  const thin = {
    ...goodAnalysis(),
    cause: "Fukt i vegg",
    description: "",
    source: "",
    extent_description: "",
  };
  const before = scoreRun(thin, REF, { photoCount: 2 });
  const aarsakBefore = before.detail.find((d) => d.dimension === "aarsak");
  assert.equal(aarsakBefore.points, 0);

  const after = scoreRun(thin, REF, { photoCount: 2 }, {
    aarsak: { points: 1, reason: "Formulert annerledes, men faglig riktig" },
  });
  const aarsakAfter = after.detail.find((d) => d.dimension === "aarsak");
  assert.equal(aarsakAfter.points, 1);
  assert.equal(aarsakAfter.basis, "manual");
  assert.equal(aarsakAfter.auto_points, 0);
  assert.equal(after.total, before.total + 1);
});

test("returns null without reference data", () => {
  assert.equal(scoreRun(goodAnalysis(), null), null);
});

test("committed fixture is loadable and shaped as the scorer expects", () => {
  const cases = readFixture();
  assert.ok(cases.length >= 1);
  for (const entry of cases) {
    assert.ok(entry.case_id, "case_id required");
    assert.ok(entry.reference, "reference required");
    // A provisional fasit must say where it came from, so a reader can tell
    // documentation-derived ground truth from a real transcription.
    if (entry.provisional !== false) {
      assert.ok(entry.source_note, `${entry.case_id} is provisional but has no source_note`);
    }
  }
});
