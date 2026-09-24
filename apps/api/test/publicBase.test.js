// Enhetstester for publicBase.js og loggmaskeringen — ren node, uten rammeverk:
//   node test/publicBase.test.js
// Avslutter med feilkode ved første brudd. Dekker det e2e-testen strukturelt
// ikke kan se: escaping ved sink og BASE_RE-avvisning (etter S20 gir
// publicBase() aldri farlige tegn, så e2e blir grønn selv uten escaping).

const assert = require("assert");
const path = require("path");
const { execFileSync } = require("child_process");

delete process.env.PUBLIC_BASE_URL;
delete process.env.API_BASE_URL;
process.env.NODE_ENV = "test";
process.env.PORT = "3000";

const {
  publicBase, apiBase, escapeHtml, stripCrlf, normalizeBase, FALLBACK,
  absolutizeSeo, sitemapXml, SITEMAP_PATHS,
} = require("../src/publicBase");
const { redactQuery } = require("../src/middleware/requestLogger");
const { robotsBody } = require("../src/routes/publikum");

const req = (host) => ({ get: (h) => (String(h).toLowerCase() === "host" ? host : undefined) });

// ── escaping ved sink ────────────────────────────────────────────────────────
assert.strictEqual(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
assert.strictEqual(escapeHtml("https://docrai.io"), "https://docrai.io", "en gyldig base er identitet");
assert.strictEqual(stripCrlf("Sitemap: a\r\nDisallow: /\nb"), "Sitemap: aDisallow: /b");

// ── sinkene selv: absolutizeSeo, sitemap, robots ─────────────────────────────
// publicBase() gir aldri farlige tegn etter S20, så e2e kan ikke se om sink-
// escapingen fjernes. Her mates sinkene med en base som ALDRI kan oppstå, for å
// bevise at forsvar-i-dybden-laget faktisk står.
const EVIL_BASE = 'https://evil"><script>alert(1)</script><x y="';
const HTML =
  '<link rel="canonical" href="/om" />\n<meta property="og:image" content="/og-bilde.png" />\n' +
  '<script type="application/ld+json">{"url":"/om","logo":"/favicon.png"}</script>';
const out = absolutizeSeo(HTML, EVIL_BASE, "/om");
assert.strictEqual(out.includes("<script>alert"), false, "absolutizeSeo: ingen rå script fra basen");
assert.ok(out.includes('href="https://evil&quot;&gt;&lt;script&gt;'), "canonical escapet");
assert.ok(out.includes('<meta property="og:url" content="https://evil&quot;&gt;&lt;script&gt;'), "og:url injisert og escapet");
assert.ok(out.includes('"url":"https://evil&quot;&gt;'), "JSON-LD-sink escapet");
assert.strictEqual(
  absolutizeSeo('<link rel="canonical" href="/om" />', "https://docrai.io", "/om"),
  '<link rel="canonical" href="https://docrai.io/om" />',
  "gyldig base uendret; og:url injiseres bare når og:image finnes"
);
const sm = sitemapXml('https://x<y&z"');
assert.strictEqual((sm.match(/<loc>/g) || []).length, SITEMAP_PATHS.length);
assert.strictEqual(sm.includes("<y"), false, "sitemap: < escapet");
assert.ok(sm.includes("<loc>https://x&lt;y&amp;z&quot;/om</loc>"), "sitemap: base escapet i loc");
const rb = robotsBody("https://a.test\r\nDisallow: /\n");
assert.strictEqual((rb.match(/^Sitemap:/gm) || []).length, 1, "robots: én Sitemap-linje");
assert.ok(rb.includes("Sitemap: https://a.testDisallow: //sitemap.xml"), "robots: CR/LF strippet, ingen ny direktivlinje");
assert.strictEqual((rb.match(/^Disallow: \/$/gm) || []).length, 0, "robots: ingen injisert Disallow: /");

// ── normalizeBase / BASE_RE ──────────────────────────────────────────────────
assert.strictEqual(normalizeBase(" HTTPS://Example.Test/// "), "https://example.test");
assert.strictEqual(normalizeBase("https://example.test:8443"), "https://example.test:8443");
assert.strictEqual(normalizeBase("http://127.0.0.1:3000"), "http://127.0.0.1:3000", "http tillatt utenfor produksjon");
for (const bad of [
  "ftp://x",
  "https://x/path",
  'https://evil.test/x"><script>',
  "https://x?y=1",
  "https://user@x",
  "https://",
  "https://x y",
  "docrai.io",
  "",
  "   ",
  null,
  undefined,
]) {
  assert.strictEqual(normalizeBase(bad), null, `skal avvises: ${JSON.stringify(bad)}`);
}

// ── resolve: allowliste eller fallback, aldri echo ───────────────────────────
assert.strictEqual(publicBase(req("docrai.io")), "https://docrai.io");
assert.strictEqual(publicBase(req("DOCRAI.IO")), "https://docrai.io", "case-ufølsom nøkkel, fast streng ut");
assert.strictEqual(publicBase(req("www.docrai.io")), "https://www.docrai.io");
assert.strictEqual(publicBase(req("127.0.0.1:3000")), "http://127.0.0.1:3000", "loopback allowlistet utenfor produksjon");
assert.strictEqual(publicBase(req("127.0.0.1:9999")), FALLBACK, "annen port enn PORT er ukjent vert");
assert.strictEqual(publicBase(req('evil"><script>alert(1)</script>')), FALLBACK);
assert.strictEqual(publicBase(req("docrai.io:443")), FALLBACK, "eksplisitt port matcher ikke allowlista");
assert.strictEqual(publicBase(req(undefined)), FALLBACK);
assert.strictEqual(apiBase(req("janitorai-backend.onrender.com")), "https://janitorai-backend.onrender.com");
assert.strictEqual(apiBase(req("evil.test")), FALLBACK);

// ── produksjon: https påkrevd, loopback ute ──────────────────────────────────
const prodOut = execFileSync(
  process.execPath,
  [
    "-e",
    "const p=require('./src/publicBase');" +
      "const r=(h)=>({get:()=>h});" +
      "console.log([p.normalizeBase('http://example.test'), p.normalizeBase('https://example.test'), p.publicBase(r('127.0.0.1:3000'))].map(String).join(' '))",
  ],
  {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "production", PORT: "3000" },
    stdio: ["ignore", "pipe", "ignore"],
  }
)
  .toString()
  .trim()
  .split("\n")
  .pop();
assert.strictEqual(prodOut, `null https://example.test ${FALLBACK}`);

// ── loggmaskering: dekodet nøkkel, format bevart ─────────────────────────────
assert.strictEqual(redactQuery("/api/media/x?token=S&a=1"), "/api/media/x?token=[redacted]&a=[redacted]");
assert.strictEqual(redactQuery("/api/media/x?%74oken=S"), "/api/media/x?%74oken=[redacted]", "prosent-kodet nøkkel");
assert.strictEqual(redactQuery("/x?tok%65n=S"), "/x?tok%65n=[redacted]");
assert.strictEqual(redactQuery("/x?TOKEN=S"), "/x?TOKEN=[redacted]");
assert.strictEqual(
  redactQuery("/api/share/a/report?vt=S&sig=S&token=S"),
  "/api/share/a/report?vt=[redacted]&sig=[redacted]&token=[redacted]"
);
assert.strictEqual(redactQuery("/api/demo/underlag?adresse=Storgata%201&exp=17"), "/api/demo/underlag?adresse=[redacted]&exp=17");
assert.strictEqual(redactQuery("/api/underlag/adresse?sok=Storgata%2012"), "/api/underlag/adresse?sok=[redacted]", "befaringsadresse");
assert.strictEqual(redactQuery("/api/underlag/vaer?lat=59.9&lon=10.7&date=2026-09-23"), "/api/underlag/vaer?lat=[redacted]&lon=[redacted]&date=2026-09-23", "posisjon maskeres, dato ikke");
assert.strictEqual(redactQuery("/api/media/x?exp=1&sig=S"), "/api/media/x?exp=1&sig=[redacted]");
assert.strictEqual(redactQuery("/api/report/status/p?days=7"), "/api/report/status/p?days=7");
assert.strictEqual(redactQuery("/om"), "/om");
assert.strictEqual(redactQuery("/x?nyparam=1"), "/x?nyparam=[redacted]", "allowliste: ukjent parameter maskeres");
assert.strictEqual(redactQuery("/x?%E0%A4%A=1"), "/x?%E0%A4%A=[redacted]", "ugyldig koding krasjer ikke og maskeres");

console.log("publicBase: all tests passed");
