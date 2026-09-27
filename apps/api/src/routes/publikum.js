// routes/publikum.js – offentlige småtjenester for salgsflatene
// (lansieringspunktene fra kampanjen): robots.txt, pilotinteresse-skjema og
// cookiefri besøkstelling. Alt er samtykkevennlig: ingen cookies, ingen IP.

const express = require("express");
const { getPool, requireDb } = require("../db");
const { publicBase, stripCrlf } = require("../publicBase");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// Enkel per-IP-teller i minnet — nok til å stoppe skjema-/beacon-spam uten
// å lagre IP-er varig (nullstilles hvert kvarter og ved omstart).
const bucket = new Map();
let lastPrune = 0;

// Rydd bort utløpte bøtter så kartet ikke vokser ubegrenset over tid (S5).
// Kjøres høyst hvert minutt, og bare når nye forespørsler kommer inn.
function pruneBucket(now) {
  if (now - lastPrune < 60 * 1000) return;
  lastPrune = now;
  for (const [key, entry] of bucket) {
    if (now > entry.reset) bucket.delete(key);
  }
}

function limited(req, max) {
  const key = req.ip || "ukjent";
  const now = Date.now();
  pruneBucket(now);
  const entry = bucket.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 15 * 60 * 1000;
  }
  entry.count += 1;
  bucket.set(key, entry);
  return entry.count > max;
}

// ── robots.txt ───────────────────────────────────────────────────────────────
// Salgsflatene skal indekseres; delte rapporter, API og admin skal ikke.
// Interne presentasjons-/strategisider (roadmap, konkurrentanalyse) skal ikke
// indekseres — bare de kundevendte salgssidene. /kundereisen er bevisst
// offentlig (lenket + i sitemap), så den står ikke her.
const ROBOTS = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /api/",
  "Disallow: /share/",
  "Disallow: /admin-dashboard",
  "Disallow: /presentation",
  "Disallow: /losningsskisse",
  "Disallow: /totalbilde",
  "Disallow: /ui-total",
  "Disallow: /ui-endringer",
  "Disallow: /underlag-demo",
  "Disallow: /fargealternativer",
  "Disallow: /agent-readiness",
  "",
];

// S20: aldri rå Host; CR/LF strippes så basen ikke kan bli en ekstra linje.
// Egen funksjon så enhetstesten kan sjekke sinken uten å starte serveren.
function robotsBody(base) {
  return ROBOTS.concat(`Sitemap: ${stripCrlf(base)}/sitemap.xml`, "").join("\n");
}

function robotsHandler(req, res) {
  res.type("text/plain").send(robotsBody(publicBase(req)));
}

// ── Pilotinteresse (POST /api/pilot-interesse) ───────────────────────────────
// Honeypot-feltet «firmafelt» er usynlig i skjemaet — bots fyller det ut,
// mennesker gjør det ikke.
router.post("/pilot-interesse", requireDb, express.urlencoded({ extended: false }), async (req, res) => {
  if (limited(req, 10)) {
    return res.status(429).json({ error: "For mange forsøk — prøv igjen senere" });
  }

  const navn = String(req.body?.navn || "").trim().slice(0, 200);
  const epost = String(req.body?.epost || "").trim().slice(0, 200);
  const melding = String(req.body?.melding || "").trim().slice(0, 2000);
  const honeypot = String(req.body?.firmafelt || "").trim();

  if (honeypot) return res.redirect(303, "/takk"); // stille avvisning av bots
  if (!navn || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(epost)) {
    return res.status(400).send("Navn og gyldig e-post kreves.");
  }

  try {
    const pool = getPool();
    await pool.query(
      "INSERT INTO pilot_interesse (navn, epost, melding) VALUES ($1, $2, $3)",
      [navn, epost, melding || null]
    );
    res.redirect(303, "/takk");
  } catch (err) {
    console.error("POST /api/pilot-interesse error:", sanitizeError(err));
    res.status(500).send("Noe gikk galt — send oss heller en e-post.");
  }
});

// ── Cookiefri besøkstelling (POST /api/besok) ────────────────────────────────
// Kun forhåndsgodkjente stier telles; ingen IP, ingen bruker-ID.
// /kontakt sender beacon (kontakt-page.html) men manglet her — ble aldri telt.
const TELLBARE_STIER = new Set(["/om", "/demo", "/faq", "/personvern", "/vilkar", "/takk", "/kontakt"]);

router.post("/besok", requireDb, express.json({ limit: "1kb" }), async (req, res) => {
  if (limited(req, 120)) return res.status(204).end();
  const sti = String(req.body?.sti || "");
  if (!TELLBARE_STIER.has(sti)) return res.status(204).end();
  const kilde = String(req.body?.kilde || "").slice(0, 200) || null;

  try {
    const pool = getPool();
    await pool.query("INSERT INTO sidevisninger (sti, kilde) VALUES ($1, $2)", [sti, kilde]);
  } catch (err) {
    console.warn("POST /api/besok error:", sanitizeError(err));
  }
  res.status(204).end();
});

module.exports = router;
module.exports.robotsHandler = robotsHandler;
module.exports.robotsBody = robotsBody;
