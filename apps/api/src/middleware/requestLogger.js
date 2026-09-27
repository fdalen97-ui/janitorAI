// Minimal request logger middleware
// Logs only: request id, method, path, status code, latency (ms).
// Does NOT log request/response bodies, headers, or env vars.
//
// Request-id-en gjør en hendelse korrelérbar på tvers av app → API → AI-motor:
// den logges her, og /report/google-doc sender den videre som X-Request-Id så
// motorens logglinjer kan matches mot API-loggen uten tidsstempel-gjetting.

const crypto = require("crypto");

// Query-verdier maskeres med ALLOWLISTE: bare nøkler som beviselig er ufarlige
// (utløpstid på signert URL, dager, dato) logges i klartekst. Alt annet — token=
// (media i <Image>/audio), vt= (delingens visningstoken), sig= (signerte
// medie-URL-er), adresse=/sok= (befaringsadresse), lat=/lon= (posisjon) og
// enhver fremtidig parameter — blir [redacted]. En denyliste ville måtte
// oppdateres hver gang en rute får en ny sensitiv parameter; det glemmes.
// Nøkkelen dekodes før match: Express' qs dekoder «%74oken» til «token» og
// autentiserer på den, så maskeringen må se det samme som autentiseringen.
const SAFE_QUERY = /^(exp|days|date)$/i;

function redactQuery(rawPath) {
  return String(rawPath).replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, sep, key) => {
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch (_) {
      /* ugyldig koding: behold rå nøkkel for matching */
    }
    return SAFE_QUERY.test(decoded) ? match : `${sep}${key}=[redacted]`;
  });
}

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.requestId = crypto.randomUUID().slice(0, 8);

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;
    const method = req.method;
    const path = redactQuery(req.originalUrl || req.url);
    const status = res.statusCode;

    console.log(`[${req.requestId}] ${method} ${path} ${status} ${latencyMs.toFixed(2)}ms`);
  });

  next();
};
module.exports.redactQuery = redactQuery;
