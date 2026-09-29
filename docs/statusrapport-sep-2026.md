# DocrAI — statusrapport, slutten av september 2026

Oppfølger til `docs/statusrapport-aug-2026.md`. Dekker 24.–29. september: PR #24,
#25 og #26 (merget 27.–29.09) og oppfølgings-PR-en med regel 6-ryddingen og
dokumentgjelden. Alt under står i repoet med
fil- eller testhenvisning; ingenting er målt hos kunde i perioden.

## 1. Retning: hva som skal bygges, og hva som ikke skal

- **`docs/verdens-beste-losning.md`** (PR #24, merget 27.09): syntese av repoets
  egne funn og eksterne kilder. Setter bevisportene Port 0–2 (baseline hos Ocab,
  feilanalyse på ekte feil, én oppdragsgiver som har sett en rapport) som ramme
  for hva som bygges videre.
- **`docs/bim-revit-potensial.md`** (PR #25): lav verdi for eldre boliger, høyere
  for offentlig/næring; openBIM (IFC/BCF) før Revit. Studie, ikke vedtak.
- **`docs/nettside-masterplan.md`** (PR #25): tre eksterne analyser av docrai.io
  faktasjekket mot kode og produksjon. De foreslo tall og merkelapper som ikke kan
  belegges («75 %», «under 10 minutter», «Ocab-kompatibel», bladnummer 528.220);
  ingen av dem er tatt inn.
- **`docs/beslutninger.md`** (ny): beslutningslogg med dato og hvem, slik
  `docs/avklaringer-og-roller.md` ba om.

## 2. Rettet i produktet

- **Rapportgenerering svarte 500 på main** etter merge e2ae957 — ruten brukte
  variabler som var flyttet til `reportService`. Rettet i PR #26, med ny test
  `apps/api/test/e2e-rapport-motor.sh` (11 sjekker mot ekte Postgres). Sitatportens
  telling og `prompt_version` bokføres igjen per kjøring.
- **Kontrast i mørk modus:** hvit tekst på `#8FC2CB` (1,95:1) i appens
  `PrimaryButton` og på /demo-knappen → mørk tekst (9,2:1). Knappene fikk
  `minHeight: 48` (`apps/mobile/src/ui/Buttons.tsx`).
- **/demo viste CTA-kortet før søk** (`.hidden` tapte mot `display:flex`) — rettet.

## 3. Salgsflatene

- **Regel 6-rydding:** pris (990 kr, «ubegrensede saker», «per takstperson»),
  tidstall («2 t → 15 min», «2–3 timer», «På minutter – ikke timer»),
  «forsikringsklar», «7 datalag» og «Byggforsk-henvisninger» som leveranse er
  fjernet fra /om, /faq, /demo og /kundereisen. Byggforsk beskrives nå som det
  koden gjør: forslag kontrolleres mot en liste over verifiserte bladnummer.
  `e2e-headere.sh` feiler hvis ordene kommer tilbake.
- **Ny side `/eksempelrapport`:** mottakerens visning av øvingssakens oppdiktede
  rapport, merket eksempeldata, lenket fra /om og /demo, i sitemap.
- **UU:** `<main>`, label, `role=alert/status`, fokusstil og h1 på alle offentlige
  sider; grep-sjekket i CI.
- **Drift:** `Cache-Control: public, max-age=300` på salgssidene, `X-Powered-By`
  av, `LANDING_ROOT` for å sende roten til /om.
- **Øvingssaken** (`presentation/ovingssak.html`): klikkbar opplæring i sju brett
  med eksempeldata og fuktmålerregistrering. Ikke testet med brukere ennå.

## 4. Åpent — og hvem som må gjøre det

| Hva | Hvem | Hvor |
|---|---|---|
| Peke docrai.io på Express-sidene (i dag serveres `explainer/index.html`, og docrai.io/om gir 404) | Fredrik (Render + Cloudflare) | `docs/DEPLOYMENT.md` → «Domener» |
| Explainer nevner Ocab AS som partner — avklar samtykke eller fjern før/ved byttet | Fredrik | `explainer/index.html:286` |
| Teste øvingssaken med 2–3 takstpersoner | Fredrik | `docs/ovingssak-og-prototyping.md` testplan |
| Port 0: baseline for rapporttid hos Ocab — forutsetning for ethvert tall på salgssidene | Fredrik + Ocab | `docs/verdens-beste-losning.md` §9 |
| PDF/Word kan lastes ned før godkjenning | valgt bort 28.09 | `docs/beslutninger.md` |
| DDIA punkt 5 (`stale`/`deleted`) er uavklart | — | `docs/ddia-laerdommer.md`, statustabellen |

## 5. Tester (grønt lokalt 29.09)

Merget av #26 mistet 30 sjekker i `e2e-headere.sh` i konfliktløsningen. De er
gjenopprettet i oppfølgings-PR-en. `e2e-headere.sh` (94), `e2e-share.sh`, `e2e-tenant-isolation.sh`,
`e2e-rapport-motor.sh` (11), enhetstestene, `npx tsc --noEmit`. Salgssidene er
rendret i Chromium på 390 px i lys og mørk modus uten JS-feil eller horisontal
scroll.
