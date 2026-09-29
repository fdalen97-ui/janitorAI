// Lager delingsbildet (Open Graph, 1200 × 630) som Messenger, Facebook,
// LinkedIn og Slack viser når en DocrAI-lenke deles.
//
// Kjør:  NODE_PATH=$(npm root -g) node scripts/lag-og-bilde.mjs
//        (krever Playwright med Chromium; i sky-miljøet ligger det globalt)
// Ut:    apps/api/src/assets/og-bilde.png  (salgssidene, /og-bilde.png)
//        explainer/og-bilde.png            (dagens docrai.io)
//
// Teksten følger regel 6 i CLAUDE.md: bare det koden gjør. Ikke tidstall,
// «forsikringsklar» eller «Byggforsk-henvisninger» før det er målt eller
// vises i produktet (docs/beslutninger.md, 29.09.2026). Bildet er ikke
// dekket av regel 6-sjekken i e2e-headere.sh — endrer du teksten her,
// sjekk den mot docs/nettside-masterplan.md §5.7 selv.

import { createRequire } from 'node:module';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/api/src/assets/og-bilde.png');
const COPY = join(ROOT, 'explainer/og-bilde.png');

// Samme palett som salgssidene (Skifer og kobber, lys modus).
const HTML = `<!DOCTYPE html>
<html lang="nb"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: #F1F3F3; color: #1B262B; position: relative; overflow: hidden;
    font-family: 'Inter', 'DejaVu Sans', 'Liberation Sans', sans-serif;
  }
  .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 20px; background: #23545C; }
  .wrap { position: absolute; left: 92px; right: 80px; top: 50px; bottom: 56px;
          display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .sq { width: 47px; height: 47px; background: #23545C; color: #F1F3F3;
               font-weight: 700; font-size: 26px; display: flex; align-items: center;
               justify-content: center; }
  .brand b { font-size: 30px; font-weight: 700; }
  h1 { margin-top: 38px; font-size: 56px; line-height: 1.12; font-weight: 700;
       letter-spacing: -0.01em; }
  h1 .accent { color: #23545C; display: block; margin-top: 6px; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 22px; }
  .stamp { border: 2px solid #C98B5A; background: #F7ECE1; color: #7F4A22;
           font-weight: 700; font-size: 20px; padding: 8px 18px; border-radius: 8px; }
  .facts { font-size: 21px; color: #566670; }
</style></head><body>
  <div class="bar"></div>
  <div class="wrap">
    <div class="brand"><span class="sq">D</span><b>DocrAI</b></div>
    <h1>Fra befaring til skaderapport.
      <span class="accent">AI‑en skriver utkastet –<br>du godkjenner.</span></h1>
    <div class="foot">
      <span class="stamp">Ingenting deles uten stempelet ditt</span>
      <span class="facts">Årsak · akutt/gradvis · bevis med sjekksum</span>
    </div>
  </div>
</body></html>`;

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(HTML, { waitUntil: 'load' });
// Teksten skal aldri gå utenfor lerretet (lange ord brytes ikke av seg selv).
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.wrap *')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.right > 1200 - 40 || r.bottom > 630 - 20;
  }),
);
if (overflow) {
  await browser.close();
  console.error('Tekst går utenfor 1200 × 630 — kort ned teksten.');
  process.exit(1);
}
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
copyFileSync(OUT, COPY);
console.log(`Skrev ${OUT}\nKopierte til ${COPY}`);
