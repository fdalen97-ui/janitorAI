# Fagkart for lansering — DocrAI-status per fagområde

Basert på et bransjefagkart (15 fagområder for å publisere en AI-bygget app,
2026). Dette dokumentet oversetter kartet til **DocrAIs faktiske status**: hva
som er bygget, hva som er et rent kodegap, og hva som er gruppens/juristens bord.

**BLUF:** Koden er i god forfatning etter sikkerhetsrevisjonen. Den farligste
blindsonen er **compliance** — personvern, cookie-samtykke, vilkår, tredjelands-
overføring og EU AI Act — der sanksjonene rammer selv en «ferdig» app. Ingenting
av dette blokkerer *utvikling*, men flere punkter blokkerer **pilot med ekte
skadesaker** (persondata). Se launch-gaten nederst.

Merking: **[✓ bygget]** · **[◐ kodegap]** (kan bygges nå) · **[⚖ gruppen]**
(beslutning/avtale/jus) · **[○ senere]**.

## 1 — Sikkerhet (OWASP + LLM Top 10)
Dekket av sikkerhetsrevisjonen (se `sikkerhetsrevisjon-aug-2026.md`).
- [✓] Tilgangskontroll server-side, tenant-skoping, parametrisert SQL, scrypt-PIN,
  signerte medie-URL-er, global feilhåndterer, sikkerhets-headere (nosniff,
  X-Frame-Options, Referrer-Policy), 0 sårbarheter i api-treet.
- [✓] LLM: menneskelig godkjenning ved høyrisiko (godkjenningsport), output
  behandlet som utrygt (share-siden bruker `textContent`), rate limiting + timeouts.
- [◐] Prompt injection: transkripsjon/rapport tar fritekst fra felt inn i
  prompten — lav risiko (egen bruker, ikke fiendtlig input), men verdt et blikk
  når RAG mot Byggforsk kobles på.
- [⚖] Secrets-vault (ikke `.env`) og nøkkelrotasjon i drift; SBOM/Dependabot i CI.

## 2 — Personvern / GDPR
- [✓] Personvernerklæring (`/personvern`), cookiefri drift, aldri IP lagret,
  samtykkebasert pilotskjema, sletting styrt av bruker.
- [⚖] **Databehandleravtaler** med alle underleverandører (Google/Gemini, hosting,
  DB) — *kritisk før ekte persondata*.
- [⚖] Behandlingsgrunnlag (art. 6/9), protokoll (art. 30), bruddrutine (72t),
  DPIA ved høy risiko (skadesaker = sannsynlig høy risiko).
- [◐/⚖] Rutine for innsyn/retting/sletting/portabilitet — appen sletter data;
  en formell rutine + kontaktpunkt mangler skriftlig.

## 3 — Cookies (ekomloven § 3-15)
- [✓] **Ingen cookies, ingen tredjepartssporing** — bevisst valgt (cookiefri
  førstepartstelling). Dermed **ikke samtyktebanner-plikt**. Dette er en styrke.

## 4 — Juss / forbrukerrett
- [✓] Vilkår (`/vilkar`) og personvern, separate sider, lenket fra footere.
- [✓] Ingen falske metrikker/anmeldelser; priser merket «veiledende».
- [⚖] Angrerett/opplysningsplikt + MVA gjelder **når betaling slås på** (ikke i
  gratis pilot). Ansvarsfraskrivelse ved AI-output bør kvalitetssikres av jurist.

## 4b — Tredjelandsoverføring (Schrems II)
- [⚖] **Den viktigste compliance-saken.** Gemini/Google i dag = overføring til
  USA. Krever: kartlegging (art. 30), transfergrunnlag (DPF-sertifisering eller
  SCC), TIA, tekniske tiltak. **Løsning er allerede i planen:** flytt AI-
  prosessering til EU/EØS-region før pilot (dokumentert i personvernerklæringen).

## 5 — Lisenser / opphavsrett
- [○] Repoet er eget; avhengigheter er MIT/Apache/BSD. Lag SBOM + lisenspolicy
  når CI settes opp. AI-generert kode bør spotsjekkes mot copyleft ved distribusjon.

## 6 — Universell utforming (WCAG 2.1 AA / EAA)
- [✓] Semantisk HTML (`<main>` på alle salgssider), brødsmulesti, alt-tekst på
  demokartet, skjemaer med `<label>` (adressefeltet på /demo fikk det 29.09.2026),
  `lang="nb"`, `role="alert"`/`"status"` på feil- og statusmeldinger. Grep-sjekkes i
  `apps/api/test/e2e-headere.sh`.
- [◐] Fargekontrast: knapper i mørk modus hadde hvit tekst på `#8FC2CB` (1,95:1, under
  AA) på /demo og i appens `PrimaryButton` — rettet til mørk tekst (9,2:1) 29.09.2026.
  Ingen fullstendig kontrastmåling av alle flater er gjort; tidligere tall
  («>14:1 hero, >7:1 knapper») gjaldt lys modus.
- [◐] Synlig fokusmarkering (`:focus-visible`) på alle offentlige sider;
  full tastatur- og skjermlesertest med hjelpemiddel gjenstår.
- [⚖] Mikrobedrift-unntaket i EAA (<10 ansatte / <2 mill. €) kan gjelde — avklar.
  Retter dere dere mot EU-marked, følg EAA uansett.

## 7 — App Store / Google Play
- [○] **Ikke relevant ennå** — DocrAI leveres som web/Expo, ingen butikk-
  innsending i pilot. Når app publiseres: privacy labels/Data safety, DSA
  trader-status, kontosletting-i-app, testkonto, UGC-moderering (lav — ingen UGC).

## 8 — EU AI Act
- [✓] **Transparens (art. 50) er bygget inn:** delingssiden opplyser eksplisitt
  «Faglig vurdert og godkjent av [takstperson]» og «N felter faglig korrigert fra
  AI-utkastet». Salgssiden sier «AI foreslår. Du avgjør.» Mottakeren vet at
  innholdet er AI-utkast kontrollert av menneske.
- [⚖] Klassifisering: forsikringsdokumentasjon er neppe «forbudt» eller Annex III
  høyrisiko, men **må avklares formelt**. Ingen forbudte praksiser brukes.
- [○] Maskinlesbar merking av AI-innhold — vurder før art. 50-håndheving (2.8.2026).

## 9 — Kvalitet / QA
- [✓] 31 e2e-sjekker, tsc rent, tomtilstander/lastetilstander i appen,
  feilhåndtering uten stacktrace, offline-først i felt.
- [◐] Automatisert test i CI (per commit) mangler; «reviewer-run» av full flyt
  bør formaliseres før pilot.

## 10 — Ytelse / Denial of Wallet
- [✓] **Nettopp bygget:** timeouts på alle utgående Gemini-/AI-motor-kall,
  `heavyLimiter` på dyre endepunkter, filstørrelsestak, budsjettvern mot
  hengende fakturerbare kall.
- [◐] Core Web Vitals-måling (CrUX/RUM) og bildekomprimering på salgssidene;
  DB-indekser er på plass på de hyppige spørringene.
- [⚖] Budsjettalarm hos Google/hosting — sett i skyleverandørens konsoll.

## 11 — Drift / observabilitet
- [✓] Sentralisert feillogging (admin-dashboard), helse-endepunkt,
  medieopprydding, diskvakt.
- [⚖] Sentry m/varsling, oppetidsmonitor, statusside, **testet restore** av
  backup, incident-/rollback-plan — driftsoppsett før pilot.

## 12 — Betaling / økonomi
- [○] **Ikke relevant i gratis pilot.** Ved betaling: Stripe/Vipps (PCI via
  leverandør, aldri kortdata selv), MVA-registrering >50k, bokføring.

## 13 — Design / UX
- [✓] Egen troverdig identitet (papir/stålblå, ingen KI-slop), «D»-merke +
  favicon + OG-bilde, konsistente komponenter, responsivt, mørk modus.

## 14 — SEO
- [✓] **Nettopp bygget:** `sitemap.xml`, `robots.txt` m/Sitemap-peker, unike
  titler + metabeskrivelser, Open Graph, schema.org (SoftwareApplication, FAQPage),
  semantisk overskriftshierarki.

## 15 — Innholdsmoderering
- [○] **Ingen UGC** i DocrAI (takstpersonen er eneste innholdsprodusent), så
  moderering/rapportering/EULA-mot-krenkelser er ikke relevant nå.

---

## Launch-gate

**Blokkerer IKKE videre utvikling/testing** (syntetiske data):
alt over med [✓] og [◐].

**Blokkerer PILOT med ekte skadesaker** (persondata) — må signeres av gruppen:
1. **Databehandleravtaler** med Google og hosting/DB (fagområde 2).
2. **AI-prosessering flyttet til EU/EØS** + TIA (fagområde 4b) — allerede planlagt.
3. **Behandlingsgrunnlag, art. 30-protokoll, bruddrutine, DPIA** (fagområde 2).
4. **Drift:** Sentry m/varsling + testet backup-restore + rollback-plan (11).
5. **Sett i miljøet:** `NODE_ENV=production`, `MEDIA_URL_SECRET`, `CORS_ORIGINS`,
   budsjettalarm (10/11).
6. **Jurist-gjennomgang** av vilkår/ansvarsfraskrivelse + EU AI Act-klassifisering.

**Blokkerer først ved BETALING:** MVA, angrerett/opplysningsplikt, PCI (12).
**Blokkerer først ved APP-BUTIKK:** privacy labels, DSA, kontosletting (7).

## Kodegap jeg kan ta nå (uten eksterne avtaler)
- `:focus-visible`-markering på de offentlige sidene (6).
- Automatisert test i CI + SBOM/Dependabot-oppsett (1, 9).
- Bildekomprimering + Core Web Vitals-måling på salgssidene (10).

Alt annet på [⚖]-lista er beslutninger, avtaler eller driftsoppsett — ikke kode.
