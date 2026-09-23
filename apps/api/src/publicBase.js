// publicBase.js – én kilde til absolutte base-URL-er (S20).
//
// Bakgrunn: rå `Host` ble reflektert rett inn i canonical/og:url/JSON-LD,
// sitemap, robots.txt OG i de signerte medie-URL-ene som sendes til
// AI-motoren. Med PUBLIC_BASE_URL usatt ga
//   curl -H 'Host: evil"><script>alert(1)</script><x y="' /om
// et skript i svaret, og en innlogget tester kunne få motoren til å hente
// «video» fra vilkårlig vert med gyldig signatur.
//
// Regel: validert env vinner; ellers KUN en allowlistet vert (fast, kjent
// streng); ellers fast fallback. Rå Host brukes aldri i output — bare som
// oppslagsnøkkel i allowlista. Sinkene escaper i tillegg (forsvar i dybden).
//
// Fallback er onrender-verten, ikke docrai.io: docrai.io 404-er til DNS er
// lagt om (docs/agent-readiness, R4). Bytt PUBLIC_BASE_URL når DNS peker hit.

const FALLBACK = "https://janitorai-backend.onrender.com";

// Kun skjema + vert (+ valgfri port). Ingen sti, ingen query, ingen tegn som
// kan bryte ut av et attributt eller en JSON-streng. absolutizeSeo stoler på
// dette når basen settes inn i JSON-LD via HTML-escaping. I produksjon kreves
// https: en http-base ville gitt signerte medie-URL-er i klartekst til motoren.
const IS_PROD = process.env.NODE_ENV === "production";
const BASE_RE = IS_PROD
  ? /^https:\/\/[a-z0-9.-]+(:\d+)?$/
  : /^https?:\/\/[a-z0-9.-]+(:\d+)?$/;

// Normaliser en konfigurert base: trim, små bokstaver, uten avsluttende «/».
// Returnerer null når verdien ikke består BASE_RE. Eksportert for enhetstest.
function normalizeBase(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const candidate = String(raw).trim().toLowerCase().replace(/\/+$/, "");
  return BASE_RE.test(candidate) ? candidate : null;
}

function parseConfigured(name) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return null;
  const candidate = normalizeBase(raw);
  if (!candidate) {
    console.error(
      `${name} er ugyldig (${JSON.stringify(raw)}) — forventer ${IS_PROD ? "https" : "http(s)"}://vert[:port]; faller tilbake til ${FALLBACK}`
    );
    return null;
  }
  return candidate;
}

const CONFIGURED_PUBLIC = parseConfigured("PUBLIC_BASE_URL");
// Delt med admin-dashbordet (index.js) og AI-motorens SSRF-vakt (server.py).
const CONFIGURED_API = parseConfigured("API_BASE_URL");

// Verter vi vet vi serverer. Loopback er med utenfor produksjon så e2e-
// testene (127.0.0.1:809x) får sin egen vert i canonical — aldri på Render.
const PORT = String(process.env.PORT || 3000);
const HOSTS = new Map([
  ["docrai.io", "https"],
  ["www.docrai.io", "https"],
  ["janitorai-backend.onrender.com", "https"],
]);
if (!IS_PROD) {
  HOSTS.set(`localhost:${PORT}`, "http");
  HOSTS.set(`127.0.0.1:${PORT}`, "http");
}

// Rå `Host` (ikke req.hostname): hostname leser X-Forwarded-Host først bak
// `trust proxy` og stripper porten, så loopback-nøklene ville aldri truffet.
// Ukjent vert → fallback. Verdien fra Host havner aldri i svaret.
function resolve(req, configured) {
  if (configured) return configured;
  const host = String(req.get("host") || "").toLowerCase();
  const scheme = HOSTS.get(host);
  return scheme ? `${scheme}://${host}` : FALLBACK;
}

// canonical / og:url / sitemap / robots / security.txt
const publicBase = (req) => resolve(req, CONFIGURED_PUBLIC);
// signerte medie-URL-er til AI-motoren
const apiBase = (req) => resolve(req, CONFIGURED_API);

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// robots.txt er linjebasert: en CR/LF i basen ville gitt en ekstra direktiv-linje.
const stripCrlf = (s) => String(s).replace(/[\r\n]/g, "");

// ── Sinkene (testbare uten å starte serveren) ───────────────────────────────

// Absolutiser SEO-URL-er kirurgisk (OG-protokollen og Googles rich-results krever
// absolutte URL-er): kun og:image, canonical og JSON-LD item/url/logo — aldri
// body-lenker. Injiser og:url. Mønstrene forekommer bare i <head>/ld+json.
// S20: basen HTML-escapes ved sinken. Det dekker også JSON-LD-strengen bare
// fordi BASE_RE garanterer tegnsettet [a-z0-9.:/-] (ingen \ eller ") — løsnes
// BASE_RE, må JSON-LD-sinken bytte til JSON.stringify.
function absolutizeSeo(html, base, routePath) {
  const safeBase = escapeHtml(base);
  html = html
    .replace(/(<meta property="og:image" content=")(\/[^"]*)(")/g, `$1${safeBase}$2$3`)
    .replace(/(<link rel="canonical" href=")(\/[^"]*)(")/g, `$1${safeBase}$2$3`)
    .replace(/("(?:item|url|logo)":")(\/[^"]*)(")/g, `$1${safeBase}$2$3`);
  if (routePath && !/property="og:url"/.test(html) && /<meta property="og:image"/.test(html)) {
    html = html.replace(
      /(<meta property="og:image"[^>]*>\n?)/,
      `$1<meta property="og:url" content="${safeBase}${routePath}" />\n`
    );
  }
  return html;
}

// Sitemap (SEO): kun de offentlige, indekserbare salgssidene. XML-escape ved sinken.
const SITEMAP_PATHS = ["/om", "/demo", "/faq", "/personvern", "/vilkar", "/kontakt", "/kundereisen"];
function sitemapXml(base) {
  const safeBase = escapeHtml(base);
  const urls = SITEMAP_PATHS.map((p) => `  <url><loc>${safeBase}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

console.log(
  `base-URL: public=${CONFIGURED_PUBLIC || FALLBACK + " (fallback)"} ` +
    `api=${CONFIGURED_API || FALLBACK + " (fallback)"} | allowlist: ${[...HOSTS.keys()].join(", ")}`
);

module.exports = {
  publicBase, apiBase, escapeHtml, stripCrlf, normalizeBase, FALLBACK,
  absolutizeSeo, sitemapXml, SITEMAP_PATHS,
};
