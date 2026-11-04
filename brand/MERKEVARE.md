# DocrAI-merket: «Stemmen i søkeren»

Valgt av gruppa 04.11.2026 etter fem runder med forslag (55 + 10 + 5 utkast).
Merket er en kamerasøker (fire hjørner) rundt en D formet av lydstolper, med én
gul opptaksprikk. Det sier det eneste DocrAI gjør som ingen konkurrent viser:
befaringen filmes og fortelles inn, og rapporten kommer ut.

## Filer

| Fil | Bruk |
|---|---|
| `docrai-logo.svg` | Hovedlogo, liggende, lys bakgrunn. Topptekst, e-post, pitch. |
| `docrai-logo-mork.svg` | Samme på mørk bakgrunn (#091517 / #1D374B). |
| `docrai-merke.svg` | Merket alene, stålblått. Fra 24 px og opp. |
| `docrai-merke-mork.svg` | Merket alene i papirhvitt, til mørk bakgrunn. |
| `docrai-app-ikon.svg` | App-ikon, full stålblå flate (iOS/Android runder selv). |
| `docrai-favicon.svg` | Brikke med avrundede hjørner, til favicon og nettleserfane. |

Ordmerket «DocrAI» er Manrope 700 omgjort til kurver, så filene trenger ingen font.

## Farger (profilen «Glass og stål», valgt 05.10.2026)

| Rolle | Lys | Mørk |
|---|---|---|
| Merke og hjørner | stålblå `#2F4A5E` | papir `#FBFEFF` |
| Ordmerke | blekk `#072227` | `#E6ECEE` |
| Opptaksprikk | signalgul `#FFD84D` | `#ECC745` |
| Bakgrunn | glass `#E8F5F8` eller papir `#FBFEFF` | `#091517` |

Gult brukes bare på prikken. Aldri som flate bak tekst, aldri på ordmerket.

## Regler

- **Luft:** minst høyden på én søkerhjørne (1/4 av merkets høyde) rundt hele logoen.
- **Minste størrelse:** merket alene 16 px (favicon), logo med ordmerke 96 px bred.
- **Ikke** strekk, roter, legg skygge eller gradient, bytt font i ordmerket,
  eller sett ordmerket inne i søkeren.
- På foto eller urolig bakgrunn: bruk brikken (`docrai-favicon.svg`), ikke merket alene.

## Hvor merket ligger i løsningen

- Salgssider og delingsside: inline SVG i `.brand` i `apps/api/src/*-page.html`
  (farge via `currentColor`, så den følger temaet).
- Favicon, Apple-touch og OG-bilde: `apps/api/src/assets/` (servert fra `index.js`)
  og `explainer/` (docrai.io i dag).
- Appen: `apps/mobile/assets/images/` (icon, adaptive-ikon, splash, favicon),
  koblet i `apps/mobile/app.json`.

## Bygge på nytt

```bash
pip install fonttools
python3 brand/verktoy/bygg-svg.py            # SVG-mesterfilene (fonten ligger i verktoy/)
node brand/verktoy/bygg-png.mjs              # alle PNG-er til app, favicon og OG-bilde
```
`bygg-png.mjs` krever Playwright med Chromium. OG-bildets tekst er salgssidens
tittel, uten tall eller lovnader (regel 6 i `CLAUDE.md`).
