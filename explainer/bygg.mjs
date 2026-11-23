// Bygger explainer/index.html fra forsiden i apps/api/src/om-page.html, slik at
// docrai.io (statisk) og Express-sidene alltid viser samme forside.
//   node explainer/bygg.mjs            (bygg)
//   node explainer/bygg.mjs --sjekk    (feiler hvis index.html er utdatert)
// docrai.io er en statisk vert uten API. Derfor pekes undersider, demo og
// pilotskjema til Express-verten (BASE) til DNS-byttet er gjort
// (docs/DEPLOYMENT.md → «Domener»). Etter byttet kan hele mappa slettes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'apps', 'api', 'src');
const BASE = 'https://janitorai-backend.onrender.com'; // = FALLBACK i apps/api/src/publicBase.js
const SITE = 'https://docrai.io';
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');

let html = read('om-page.html')
  .replace('__SITE_HEADER__', () => read('partials/header.html'))
  .replace('__SITE_FOOTER__', () => read('partials/footer.html'))
  .replace('__SITE_TEAM__', () => read('partials/team.html'));

// Appen bor på app.docrai.io: gi eksisterende brukere en vei inn fra forsiden.
html = html.replace('<a href="/kontakt">Kontakt</a>\n    </nav>', '<a href="/kontakt">Kontakt</a>\n      <a href="https://app.docrai.io">Åpne appen</a>\n    </nav>');

// SEO: denne siden er roten på docrai.io.
html = html
  .replace('<link rel="canonical" href="/om" />', `<link rel="canonical" href="${SITE}/" />`)
  .replace('<meta property="og:image" content="/og-bilde.png" />', `<meta property="og:image" content="${SITE}/og-bilde.png" />\n<meta property="og:url" content="${SITE}/" />`)
  .replace('"url":"/om","logo":"/apple-touch-icon.png"', `"url":"${SITE}/","logo":"${SITE}/apple-touch-icon.png"`)
  .replace(/"url":"\/om"/g, `"url":"${SITE}/"`);

// Ankerlenker til forsiden blir lokale; alt annet internt går til Express-verten.
html = html
  .replace(/href="\/om#([a-z]+)"/g, 'href="#$1"')
  .replace(/href="\/om"/g, 'href="./"')
  .replace(/(href|action)="\/(demo|eksempelrapport|faq|kontakt|personvern|vilkar|kundereisen|api\/pilot-interesse)(#[a-z-]+)?"/g, (m, attr, sti, anker) => `${attr}="${BASE}/${sti}${anker || ''}"`);

// Egne filer i mappa: stilark, font og ikoner (relative stier, virker også lokalt).
html = html
  .replace('href="/site.css"', 'href="site.css"')
  .replace('href="/fonts/manrope-latin.woff2"', 'href="fonts/manrope-latin.woff2"')
  .replace('href="/favicon.png"', 'href="favicon.png"')
  .replace('href="/apple-touch-icon.png"', 'href="apple-touch-icon.png"')
  .replace(/src="\/bilder\/(anders|william)\.jpg"/g, 'src="bilder/$1.jpg"');

// Besøks- og klikktelling: sidens egen beacon peker på «/api» og virker ikke på
// den statiske verten. site.js tar over: data-api sender tellingen til
// Express-verten, data-besok teller sidevisningen, data-sti gjør stien til «/».
html = html.replace(/<script>\s*try \{ navigator\.sendBeacon\([\s\S]*?<\/script>\n/, '');
html = html.replace('<script src="/site.js" defer></script>', `<script src="site.js" defer data-api="${BASE}" data-sti="/" data-besok></script>`);

const left = html.match(/(?:href|action|src|content)="\/(?!\/)[^"]*"/g) || [];
if (left.length) { console.error('Rot-relative lenker står igjen:', left); process.exit(1); }
if (/__SITE_|fonts\.googleapis|sendBeacon/.test(html)) { console.error('Uønsket rest i utdata'); process.exit(1); }

// --sjekk: skriv ingenting, bare meld fra hvis den genererte siden er utdatert.
if (process.argv.includes('--sjekk')) {
  const now = fs.existsSync(path.join(here, 'index.html')) ? fs.readFileSync(path.join(here, 'index.html'), 'utf8') : '';
  if (now !== html) { console.error('explainer/index.html er utdatert – kjør: node explainer/bygg.mjs'); process.exit(1); }
  console.log('explainer er i synk'); process.exit(0);
}
fs.writeFileSync(path.join(here, 'index.html'), html);
fs.writeFileSync(path.join(here, 'site.css'), read('assets/site.css').replace("url('/fonts/manrope-latin.woff2')", "url('fonts/manrope-latin.woff2')"));
fs.mkdirSync(path.join(here, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(src, 'assets/fonts/manrope-latin.woff2'), path.join(here, 'fonts/manrope-latin.woff2'));
fs.copyFileSync(path.join(src, 'assets/site.js'), path.join(here, 'site.js'));
fs.mkdirSync(path.join(here, 'bilder'), { recursive: true });
for (const navn of ['anders', 'william']) fs.copyFileSync(path.join(src, `assets/team/${navn}.jpg`), path.join(here, `bilder/${navn}.jpg`));
console.log('explainer bygget:', html.length, 'tegn');
