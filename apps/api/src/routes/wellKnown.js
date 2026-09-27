// routes/wellKnown.js – /.well-known/* (RFC 8615), montert FØR token-vakten.
//
// Før svarte /.well-known/security.txt 401 fra requireTesterToken — en skanner
// leser det som «låst», ikke «finnes ikke». Nå: security.txt (RFC 9116) når
// SECURITY_CONTACT er satt, ellers 404; alt annet under /.well-known/ er 404.
// Ingen generell «statisk-utseende sti → 404»-regel: den ville skygget
// fremtidige ruter, og nettlesere får allerede 404 via Accept: text/html.

const express = require("express");
const { publicBase } = require("../publicBase");

const router = express.Router();

// Rolleadresse eller skjema-URL — aldri en privat e-post implisitt.
const CONTACT_RE = /^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/i;
// RFC 9116: Expires er påkrevd, RFC 3339, bør være under ett år. Regenereres
// per svar, så fila går aldri ut så lenge tjenesten kjører.
const EXPIRES_DAYS = 180;

function contact() {
  const raw = (process.env.SECURITY_CONTACT || "").trim();
  return raw && CONTACT_RE.test(raw) ? raw : null;
}

if (process.env.SECURITY_CONTACT && !contact()) {
  console.error(
    "SECURITY_CONTACT er ugyldig (forventer mailto:… eller https://…) — security.txt serveres ikke"
  );
}

router.get("/security.txt", (req, res) => {
  const c = contact();
  if (!c) return res.status(404).json({ error: "Not found" }); // fail-closed
  const exp = new Date(Date.now() + EXPIRES_DAYS * 864e5);
  exp.setUTCMilliseconds(0);
  res.set("Cache-Control", "public, max-age=3600");
  res.type("text/plain; charset=utf-8").send(
    [
      `Contact: ${c}`,
      `Expires: ${exp.toISOString().replace(".000Z", "Z")}`,
      `Canonical: ${publicBase(req)}/.well-known/security.txt`,
      "Preferred-Languages: nb, en",
      "",
    ].join("\n")
  );
});

// Resten av /.well-known/: 404, aldri 401.
router.use((req, res) => res.status(404).json({ error: "Not found" }));

module.exports = router;
