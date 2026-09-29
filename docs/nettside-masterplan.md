# Nettside-masterplan: hva de eksterne analysene får rett, hva som er feil, og hva vi gjør

*28. september 2026. Beslutningsunderlag, ikke vedtak. Stier er relative til
repo-roten. Hver faktapåstand er merket **verifisert (fil:linje)**
når fila er åpnet i denne økten, **verifisert (live-måling 28.09.2026)** når den
er målt med `curl` mot produksjon, eller **uverifisert**. Ingen tall, bladnummer
eller kilder er diktet; der repoet tier, står det.*

**Grunnlag:** de tre eksterne analysene (`docs/nettside-eksterne-analyser-2026-09.md`),
elleve temavurderinger med kontrollerte korreksjoner, og kartene over salgssider,
evidens, app og infrastruktur. Der en korreksjon strider mot vurderingen, er
korreksjonen lagt til grunn og kontrollert på nytt mot fila.

---

## 0. Konklusjonen på én side

**Det viktigste funnet handler ikke om innhold, men om hvilken side som er live.**
De eksterne analysene vurderte `docrai.io`. Det som serveres der i dag er
`explainer/index.html` — byte-identisk kropp, verifisert (live-måling 28.09.2026:
`diff -q` mot `explainer/index.html` gir ingen avvik; tittel «DocrAI — Fra befaring
til skaderapport», `explainer/index.html:6`). `docrai.io/om`, `/faq` og
`/sitemap.xml` svarer 404 (live-måling). Hele salgsflaten repoet har bygget —
`/om`, `/demo`, `/faq`, `/kontakt`, `/personvern`, `/vilkar`, `/kundereisen` —
finnes bare på `janitorai-backend.onrender.com` (verifisert:
`apps/api/src/publicBase.js:14-17` sier fallback er onrender-verten «til DNS er
lagt om»; `explainer/README.md:12-14` sier explainer er «meant for docrai.io»).
Produktet ligger på `app.docrai.io` (200, Expo-bundle, live-måling), men deklarerer
`<html lang="en">` (live-måling) tross norsk målgruppe.

Konsekvensen er at analyse B har rett i det meste den sier om docrai.io — «Dokumenter
skaden der og da» som hero (`explainer/index.html:218`), én og samme CTA tre ganger
(`:208`, `:220`, `:301`), ingen risikoreversering, ingen felt-narrativ — og at nesten
alt den etterlyser allerede finnes på `/om`, bare på feil vert. Det billigste og
mest verdifulle tiltaket i hele planen er derfor ikke å skrive ny tekst, men å
**avgjøre at Express-sidene skal være docrai.io** (eller synkronisere explainer med
dem) og fjerne Google Fonts-lenken som i dag gjør personvernløftet «ingen tredjeparts
sporing» usant for forsiden (`explainer/index.html:33-34` mot
`apps/api/src/personvern-page.html:54`).

**Det nest viktigste funnet:** de eksterne analysene foreslår en rekke tall og
merkelapper som ikke kan belegges — «2–4 timer per befaringsdag», «75 %
tidsbesparelse», «under 10 minutter», «Ocab-kompatibel», partnerlogoer, bladnummer
528.220. Ingen av dem finnes i repoet (grep, se §1), og regel 6 i `CLAUDE.md:66-68`
stopper dem. Men repoets egen salgsside har allerede samme problem i mindre skala:
«2–3 timer», «2 400–4 500 kr» og «990 kr/mnd … ubegrensede saker»
(`apps/api/src/om-page.html:204-206`) er klassifisert som «Påstått» og «Hypotese» i
repoets egen evidenstrapp (`docs/verdens-beste-losning.md:84-86`), og prisnotatet sier
990 kr = 10 rapporter, ikke ubegrenset (`docs/beslutningsnotat-prising.md:27`).
Ryddingen S21 gjorde for personvernteksten (`docs/sikkerhetsrevisjon-aug-2026.md:34`)
må gjøres for salgstallene.

**Det som er belagt og kan sies i dag** (alt verifisert i kode): godkjenningsport
håndhevet i server med 409 (`apps/api/src/routes/share.js:172-180`), siste AI-utkast
lagret uendret med felt-diff til mottaker (`share.js:110-137`;
`apps/api/src/share-page.html:269-278` — tellingen vises bare når minst ett felt er
endret; ny generering erstatter utkastet, `apps/api/src/reportService.js:334-338`),
sitatport mot 33 verifiserte bladnummer
(`ai-engine/byggforsk_index.py:19-95`; `ai-engine/main.py:318-348`), USIKKER som
fullverdig svar i motoren (`ai-engine/models.py:6-25`), lokal-først-lagring
(`apps/mobile/app/projects/[id].tsx:466-475`), 56 px fangstknapper
(`[id].tsx:3105-3129`), cookiefri drift (`apps/api/src/routes/publikum.js:110-125`).

**Hva vi gjør, i rekkefølge:** (1) avklar hvilken forside som er docrai.io og fjern
Google Fonts; (2) rett regel 6-bruddene i tallene på `/om` og `/faq`; (3) fem små
UU-/kontrastfikser som er rene HTML/CSS-endringer; (4) én statisk eksempelrapport
bygget av det ovingssak-datasettet som allerede er merket «EKSEMPEL»
(`presentation/ovingssak.html:563`); (5) admin-utlesing av besøks- og
pilotinteressetallene som samles men aldri leses (aggregering av handlingsloggen
per tester hører derimot til «etter tekstendring», se §6). Alt annet — tall i hero,
kundesitat, logoer, ROI-kalkulator, «For forsikringsselskap», usikkerhetsflagg i
app — venter på bevisportene som allerede er definert
(`docs/verdens-beste-losning.md:434-452`).

**Forbehold som gjelder hele dokumentet:** repoet inneholder ingen brukerutsagn om
nettsiden. Pilotloggen handler om årsaksriktighet, feltfriksjon, fuktmålerbilder og
LiDAR (verifisert: `docs/pilotlogg-ocab.md:33-46, 92-99, 101-104, 119-128`), ikke
om CTA-er, logoer eller landingsside. Alle vurderinger av «verdi for takstpersonen»
under er derfor hypoteser, ikke målinger — jf. `docs/verdens-beste-losning.md:91-93`
(«nesten all brukerinnsikt kommer fra én person (Sigurd) og én skarp sak»).

---

## 1. Faktasjekk av de eksterne analysene

Analyse C er skrevet for et annet domene: den omtaler «helsepersonell»,
«pasientsikkerhet» og «Registrere ny pasient» (verifisert:
`docs/nettside-eksterne-analyser-2026-09.md`, seksjon «Analyse C», MERK-avsnittet).
Ordene finnes ikke i repoet utenom to litteraturreferanser (uverifisert her; oppgitt i
temavurderingen «Faktasjekk», ikke grep-et på nytt). C brukes derfor ikke som
beslutningsgrunnlag; de generiske rådene den deler med A og B (CWV, schema, alt-tekst)
er dekket i §3, og de fire UX-punktene den er alene om — «stryk sjargong», «veiledning
underveis, FAQ som siste utvei», «fremhevede menyvalg», «klare feilmeldinger»
(`docs/nettside-eksterne-analyser-2026-09.md:185-187`, verifisert) — er tatt stilling til i §3.7, sammen
med B Phase 2 «plain Norwegian» (`:149`, verifisert).

| Påstand (analyse) | Status | Kilde |
|---|---|---|
| «2–4 timer manuelt kontorarbeid per befaringsdag» (A) | **Usann/oppdiktet** — finnes ingen steder i repoet | Temavurdering ROI: grep i docs/ og apps/api/src gir 0 treff (uverifisert grep her). Nærmeste er «2–3 timer» per rapport, `apps/api/src/om-page.html:204` (verifisert), selv klassifisert «Påstått» i `docs/verdens-beste-losning.md:84` (verifisert) |
| «75 % tidsbesparelse» (A) | **Usann/oppdiktet** | Ingen målt tidsbesparelse finnes; «2 t → 15 min» er merket «målet per rapport» på `om-page.html:163` (verifisert) og «Hypotese» i `verdens-beste-losning.md:85` (verifisert). Repoet siterer en RCT med 9,5 % spart tid, `verdens-beste-losning.md:35-40` (verifisert) |
| «Under 10 minutter» fra befaring til godkjent (A, B) | **Usann** — strider mot eget mål og benchmark | Repoets mål er 15 min (`om-page.html:163`) og PMF-benchmark median < 30 min (`verdens-beste-losning.md:99-108`, verifisert). Ingen målt verdi fra ekte sak i repoet; «1 t 19 m» er dokumentert som «målt fra sak én» i `docs/statusrapport-aug-2026.md:33-34` og `docs/inkorporering.md:39-41` (verifisert), men samme streng er formateksempel i `apps/mobile/src/features/projects/metrics.ts:46` (verifisert) — motstridende, uverifisert som måling |
| «Ocab-kompatibel» (A) | **Meningsløs/ubelagt** | Ingen integrasjon mot Ocab finnes; Ocab nevnes ikke i `apps/api/src/*.html` eller `apps/mobile` (verifisert: grep 0 treff). Ocab AS navngis i `explainer/index.html:285-286` (verifisert) uten dokumentert samtykke i repoet (uverifisert om samtykke finnes utenfor repoet) |
| Partnerlogoer Ocab + forsikringsselskap (A, B) | **Ubelagt** | Ingen signert pilotavtale, ingen org.nr. (`docs/avklaringer-og-roller.md:11-14`, verifisert); forsikringsaksept «Ikke målt — krever Ocab» (`verdens-beste-losning.md:111-112`, verifisert); risiko nr. 1 og Port 2 (`:419`, `:450-452`, verifisert). Revisjonen: casestudier «kan ikke fabrikkeres» (`docs/sikkerhetsrevisjon-aug-2026.md:101-102`, verifisert) |
| Byggforsk «528.220» (A) | **Usann** — finnes ikke, ville blitt forkastet | grep i hele repoet utenom node_modules: 0 treff (verifisert). Indeksen har 33 nummer (`ai-engine/byggforsk_index.py:19-95`, telt: 33); `valider_referanse` returnerer None for ukjente (`:119-136`, verifisert). Om 528.220 er et reelt SINTEF-blad: uverifisert |
| «Kapillært oppsug» som eksempelårsak (A) | **Delvis sann** — reell kategori i motor og fasit i pilotsak, men aldri dokumentert som produsert utkast | `ai-engine/prompt.py:63-68` (uverifisert her, oppgitt i temavurdering); fasit «kapillæroppsug i betongsåla» `docs/pilotlogg-ocab.md:43` (verifisert). DocrAI konkluderte feil («rør i vegg») i samme sak, `:40-46` (verifisert) |
| «Integrert Byggforsk» / «direkte siteringer» (A) | **Usann** slik formulert | Kun metadata-indeks, ingen SINTEF-tekst, fulltekst bevisst utsatt (`byggforsk_index.py:1-14`; `docs/byggforsk-integrasjon.md:7-20`, verifisert). Referansen når verken app (`apps/mobile/src/features/projects/reportVersions.ts:18-28` mapper ikke `technical_reference`, verifisert), Google-dokument (`ai-engine/main.py:571-587` har ingen plassholder for den, verifisert) eller delingsside (`share.js:110-113` CONTENT_FIELDS uten feltet, verifisert) |
| «Smarttakst» som konkurrent å følge (B) | **Sann, allerede gjort** | `docs/konkurrent-selskapsanalyse.md:18` (org.nr. 925 856 169, regnskapstall) og `:56-58` («reell, men liten operativ konkurrent»), verifisert |
| Forsiden sier «Dokumenter skaden der og da» og er «single-CTA» (B) | **Sann for docrai.io** | `explainer/index.html:218` (h1), `:208, :220, :301` (tre like «Åpne DocrAI →»), verifisert; docrai.io serverer denne fila (live-måling) |
| «No social proof, no risk reversal» (B) | **Sann for docrai.io; usann for /om** | Risikoreversering finnes på `om-page.html:238, 253-257, 272` (verifisert); explainer har ingen (grep pilot/gratis/binding: kun Ocab-avsnittet, uverifisert grep her). Social proof finnes ingen steder — bevisst (`sikkerhetsrevisjon-aug-2026.md:101-102`) |
| «Ingen mobile-first field-use narrative» (B) | **Sann for docrai.io; usann for /om** | `om-page.html:149, 172, 183` (våte hansker, store knapper, lokal lagring i kjelleren), verifisert; explainer: 0 treff på hansk/kjeller/dekning (uverifisert grep her, oppgitt i to temavurderinger) |
| «Teksttung» (A, B) | **Uverifiserbar** for docrai.io (vurderingssak); usann for /om | `/om` har ingen avsnitt over 54 ord (temavurdering SEO, ordtelling — uverifisert her). explainer har ett avsnitt på 52 ord (samme kilde) |
| «app.docrai.io» som produktadresse (A, B) | **Sann** | 200 med Expo-bundle (live-måling). Ingen kodelinje i `apps/` refererer app.docrai.io (uverifisert grep her); `publicBase.js:57-60` allowlister bare docrai.io, www.docrai.io, onrender (verifisert) |
| Signup-trakt «CTA → signup → first capture» (B) | **Usann** — ingen selvbetjent registrering | Tilgang via tilgangskode (`apps/mobile/src/i18n/nb.ts:290-292`, verifisert) |
| «Moderne React/TypeScript-stakk» for nettsiden (A) | **Feil lag** | Salgssidene er ren HTML med inline CSS (`om-page.html:17-139`, verifisert); explainer er «Plain HTML/CSS, no build step» (`explainer/README.md:3-5`, verifisert). Appen er React/RN (temavurdering Ytelse: `apps/mobile/package.json:44,46,59`, uverifisert her) |
| «Web Workers for tunge AI-oppgaver» (A) | **Feil lag** | AI kjører i ai-engine server-side (`ai-engine/main.py:302-306` kaller `generate_content` med JSON-schema, verifisert); klienten venter på én POST (`[id].tsx:1534`, verifisert). Ingen `new Worker` i apps/mobile (verifisert: grep 0) |
| GA4/Hotjar/Clarity som Fase 0 (A, B) | **Umulig uten å bryte publiserte løfter** | `personvern-page.html:54` («ingen cookies … ingen tredjeparts sporing … ikke noe samtykkebanner»), `:62-65` («bevisst valg i stedet for Google Analytics»), `faq-page.html:100`, `kontakt-page.html:9, 90`, `apps/api/src/db.js:129-131` — alle verifisert |
| «WCAG 2.2 AA» som suksesskriterium (A, B) | **Ikke oppnådd, ikke målt** | Ingen axe/pa11y/Lighthouse i CI (`.github/workflows/ci.yml:13-77`, verifisert). To AA-brudd verifisert i §7/§3 (demo-knapp i mørk modus, umerket adressefelt) |
| Tastatursnarveier Tab/Cmd+Enter/Alt+B i app (A) | **Finnes ikke; forutsetter funksjoner som ikke finnes** | Ingen onKeyDown/metaKey/ctrlKey i apps/mobile (verifisert: grep 0). Per-felt-godkjenning finnes ikke — ett stempel (`[id].tsx:1927-1943`, verifisert). Byggforsk-panel forutsetter visning som ikke finnes (rad over) |
| «Norsk takststandard» for terminologien Befaring → Utkast → Kontroll → Godkjent (A) | **Ubelagt** | Ingen standard sitert i repoet (temavurdering AI-UX: grep «takststandard» 0 treff, uverifisert her) |
| Bounce < 35 %, CTA→pilot > 25 %, «løft innen 60 dager» (A, B) | **Uverifiserbare** uten baseline; bounce umulig cookiefritt | Beacon lagrer kun sti + kilde, ingen sesjon (`publikum.js:110-125`, verifisert). Repoets egen trakt er «antatt, kalibreres ukentlig» (`docs/kampanje-takstpersoner.md:30-44`, verifisert) |

---

## 2. Det nettsiden allerede gjør (mot anbefalingene)

Poenget med lista: ingen bygger noe som finnes. Alt under er verifisert ved åpning.

**Verdiløfte og CTA (på /om):**
- Kontroll-løftet analysene vil ha («du beholder kontrollen»): `om-page.html:152-153`
  («Du kontrollerer, korrigerer og godkjenner. Ingenting deles uten stempelet ditt»),
  `:191` («AI foreslår. Du avgjør.»). Belagt av server-409 i `share.js:172-180`.
- Flere CTA-stier: `/demo` (`:144`, `:156`, `:245`), `#pilot` (`:157`), `/kontakt`
  (`:158`), pilotskjema (`:258-273`), sticky mobil-CTA (`:284-287`, CSS `:118-129`).
- Risikoreversering: «Ingen bindingstid» (`:238`), tidslinje med «Ingenting starter å
  løpe automatisk» (`:253-257`), «Uforpliktende – du takker ja eller nei etter
  oppstartsmøtet» (`:272`).
- Felt-narrativ: «våte hansker» (`:149`, `:172`), «virker uten dekning i kjelleren»
  (`:183`); FAQ om offline (`faq-page.html:72-75`).
- «3-stegs arbeidsflyt» (A §3) / «how it works — 3 steps only» (B Phase 1) finnes
  allerede: «Slik virker det» med tre steg Før / I felt / Etter (`om-page.html:180-184`)
  og 01/02/03 på explainer (`explainer/index.html:248-262`). Ingenting å bygge.
- Tillitstekst med DPA/EU-forbehold: `om-page.html:192-195`, `faq-page.html:59-61`,
  `kontakt-page.html:90-91`, `personvern-page.html:57, 90-91`.
- «Usikker»-prinsippet står offentlig — men bare på explainer:
  `explainer/index.html:261` («‹usikker› er et fullverdig svar»), `:266-267`.
  Belagt i `ai-engine/models.py:6-25`.

**Pilotskjema:** `om-page.html:258-273` → `POST /api/pilot-interesse`
(`publikum.js:79-105`), honeypot `firmafelt` (`om-page.html:268-270`;
`publikum.js:87-89`), tabell `pilot_interesse` (`db.js:121-127`). Analyse C sitt
«korte skjemaer» er oppfylt: tre felt (navn, e-post, valgfri melding, `:259-267`) +
honeypot. C sitt «brødsmulesti» finnes som `<nav class="crumb" aria-label="Brødsmulesti">`
på /faq, /personvern og /vilkar (`faq-page.html:42`, `personvern-page.html:45`,
`vilkar-page.html:45`, verifisert; `docs/fagkart-lansering.md:59` fører den som ✓) —
i tillegg til BreadcrumbList-JSON-LD under. C sitt «Mobile-Friendly Test» dekkes av
Lighthouse-kjøringen i §3.6.

**SEO-grunnmur (på onrender-verten):** unike titler/beskrivelser på alle sider
(`om-page.html:8-9`, `demo-page.html:10-11`, `faq-page.html:8-9`,
`kontakt-page.html:8-9`, `personvern-page.html:8-9`, `vilkar-page.html:6-7`);
JSON-LD SoftwareApplication + Organization (`om-page.html:289-306`), FAQPage
(`faq-page.html:92-115`), ContactPage (`kontakt-page.html:105-109`), BreadcrumbList
(`personvern-page.html:132-134`, `vilkar-page.html:101-103`); sitemap med sju stier
(`publicBase.js:116-121`); robots.txt (`publikum.js:49-74`); canonical/og:url
absolutisert (`publicBase.js:100-113`); alt-tekst på eneste bilde
(`demo-page.html:104`). `docs/fagkart-lansering.md:108-111` fører dette som [✓]
(«Nettopp bygget: sitemap.xml, robots.txt m/Sitemap-peker, unike titler +
metabeskrivelser, Open Graph, schema.org», verifisert).

**Sikkerhetshoder:** nosniff, X-Frame-Options, Referrer-Policy, X-Robots-Tag på
noindex-prefikser, HSTS-mekanisme (headerne settes i `apps/api/src/index.js:66-74`;
noindex-prefikslista de bygger på er `:41-45`, HSTS-parsingen `:47-64`). Testet i
`apps/api/test/e2e-headere.sh` (kjører i CI, `ci.yml:43-45`).

**Ytelse — det som «bare er slik»:** inline CSS på alle sider (`om-page.html:17-139`),
ingen eksterne fonter/skript på Express-sidene (grep `fonts.googleapis|<script src`:
0 treff i `apps/api/src/*.html`, verifisert), skript nederst (`om-page.html:289-306`),
ingen `<img>` på /om (verifisert). Brotli-komprimering og Cloudflare-edge ligger
allerede foran Express (live-måling: `content-encoding: br`, `server: cloudflare`).
Kartflisen på /demo har reservert høyde (`demo-page.html:64`); kundereisens bilde
også (`presentation/kundereisen.html:126`).

**Tilgjengelighet — det som finnes:** `:focus-visible` på 9 av 10 sider
(`om-page.html:134-138` m.fl.; mangler i kundereisen — grep 0 treff, verifisert);
`<label>` rundt pilotskjemaets felt (`om-page.html:259-267`); `aria-label` på PIN-felt
(`share-page.html:97`); honeypot skjult med `aria-hidden`/`tabindex=-1`
(`om-page.html:268-269`); sticky CTA som `<nav aria-label>` (`om-page.html:284`);
mørk modus på alle sider med knappetekst-override på /om, /kontakt, /takk, 404
(`om-page.html:131`, `kontakt-page.html:54`, `takk-page.html:29`, `404-page.html:27`).
Lys-modus-kontrast består AA på alle utregnede par (temavurdering UU; tallene er
regnet på nytt i korreksjonen, uverifisert av meg).

**Måling som finnes:** cookiefri beacon `POST /api/besok` på sju sider
(`om-page.html:302`, `demo-page.html:205`, m.fl.), lagrer kun sti + kilde
(`publikum.js:110-125`; `db.js:132-138`); pilotinteresse; handlingslogg
`user_actions` (`db.js:94-103`) med `approve-report` (`[id].tsx:1941`);
`report_generations` med `prompt_version` og sitattelling (`db.js:158-178`);
tid-til-godkjent per sak (`metrics.ts:34-45`).

**Revisjonsspor (mottaker):** AI-utkast uforanderlig for redigering
(`reportVersions.ts:1-4`) — men bare siste generering bevares: ny generering
overskriver `reportDraft` både i app (`[id].tsx:1630-1638`, kommentaren om at
«FORRIGE genererings utkast» ellers ville gjenoppstå) og server
(`reportService.js:334-338`, `update.reportDraft = {…}`); felt-diff (`:33-41`),
stempel navn+tid (`types.ts:104-113`), redigering nullstiller stempel
(`[id].tsx:1905-1922`), mottaker ser antall korrigerte felt **når minst ett felt er
endret** (`share-page.html:269-278`: `if (r.draftChangedFields && r.draftChangedFields.length > 0)`;
ved null korrigeringer rendres ingenting), stempel og SHA-256-tekst
(`share-page.html:124-128`).

**Eksempelrapport-materiale:** oppdiktet sak «Øvingsveien 12, Hamar» (definert som
`var ADDRESS` på `presentation/ovingssak.html:270`, brukt i rapporten `:565`),
«Kari Eksempel» (`:557`), «ØV-2026-0012» (`:566`), stempel «EKSEMPEL · slik blir
rapporten din» (`:563`; rapportfunksjonen `:555-584`), ærlig Byggforsk-linje
(`:580`). Ikke rutet (grep `ovingssak` i `index.js`: 0 treff, verifisert), og laster
Google Fonts (`ovingssak.html:4-5`).

---

## 3. Gap-analyse per tema

Kolonner: anbefaling | status i repo | belegg | verdi for takstperson (hypotese, jf. §0) | innsats | tiltak.

### 3.1 Verdiløfte, hero og CTA-arkitektur

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Hero med «under 10 minutter» | mangler | ubelagt (§1) | uverifisert | liten | **Ikke.** Behold kontroll-halvdelen; tallfest først når median `minutesToApproved` over ≥10 godkjente pilotsaker foreligger (`metrics.ts:34-45`) |
| «Rapporten er klar for forsikringsselskapet» | delvis («forsikringsklar» i title/h1, `om-page.html:8, 147`) | ubelagt — ingen oppdragsgiver har sett en rapport (`verdens-beste-losning.md:111-112, 450-452`) | uverifisert | liten | **Etter evidens (Port 2).** Vurder å myke «forsikringsklar» til «bygget for forsikringens saksflyt» nå |
| Én primær + én sekundær CTA over folden | delvis — /om har brand-lenke + tre knapper + to sticky = seks veier på mobil (`om-page.html:144, 156-158, 284-287`) | ikke påstand | uverifisert | liten | **Nå:** gjør pilot til eneste primær, demo sekundær; endre også `.sticky-cta` (`:284-287`), ellers står to CTA-er fast i bunn uansett |
| «Åpne DocrAI» som primær mot kald trafikk | finnes på explainer (`:208, :220, :301`) → tilgangskode-vegg (`nb.ts:290-292`) | ikke påstand | lav | liten | **Ikke** før selvbetjent onboarding finnes |
| «Se eksempelrapport» som sekundær | mangler (grep `eksempelrapport` i apps/api/src: 0, uverifisert her) | ikke påstand | uverifisert; rimelig slutning fra `pilotlogg-ocab.md:35-36` (rapporten er det som sammenlignes) | middels | **Nå/middels:** se 3.2 |
| Proof-strip «75 %», «Integrert Byggforsk», «Ocab-kompatibel», logoer | mangler | feil/ubelagt (§1) | uverifisert | liten | **Ikke.** Avklar skriftlig om Ocab-navnet i `explainer/index.html:286` er godkjent; fjern hvis ikke |
| Risikoreversering løftet opp under hero | finnes langt ned (`om-page.html:238, 253-272`) | delvis belagt: ingen fakturering finnes (`db.js:142` «ikke fakturagrunnlag ennå»), men «3 måneder gratis» og «50 % rabatt» er prisløfter uten avtale (`docs/beslutningsnotat-prising.md:52-55, 64-65`) | uverifisert | liten | **Nå:** løft «Ingen bindingstid – ingenting faktureres i pilotfasen» (belagt ved fravær av fakturering, `db.js:142`). «Uforpliktende oppstartsmøte» er et **prosessløfte** uten kodelinje eller avtale (eneste kilde er dagens salgstekst, `om-page.html:272` — sirkulært, jf. §5.1); det kan bare følge med under prosessløfte-unntaket i §5 (merket, ikke «belagt»). **Ikke** gjenta «50 % rabatt» mer offensivt før prisvedtak |
| «Usikker»-prinsippet som tillitssignal på /om | finnes kun på explainer (`:261, :266-267`); 0 treff «usikker» i `om-page.html` (uverifisert grep her) | belagt (`models.py:6-25`) som produktprinsipp — ikke som kundesitat | uverifisert | liten | **Nå:** ta setningen inn på /om med egen avsender (DocrAI, ikke kunde) |
| Toppmeny med maks tre valg: Funksjoner · Eksempelrapport · Pris/Pilot (A §3/§4A; B «max 3–4 nav items») | delvis: /om har ingen toppmeny — kun brand + «Prøv demoen →» (`om-page.html:144`); footer har seks lenker (`:278`); explainer har kun app-lenken (`explainer/index.html:207-208`) | ikke påstand | lav | liten | **Nå, ufarlig:** én ankerrad under brand (Slik virker det · Pris/Pilot · Demo) — tre valg, ingen nye påstander. **Ikke** «Eksempelrapport» i menyen før siden finnes (§4 «Nå» pkt. 8) |
| Typografi 18 px, hover-skalering, checkmark | delvis (h1 clamp 28–40, body 16, hero p 17 — temavurdering, uverifisert her) | ikke påstand | lav | liten | **Nå, 10 min, lavest prioritet:** hero p 18 px; ingen skalering |

### 3.2 Interaktiv rapport-viewer og eksempelrapport

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Live AI-demo på forsiden | mangler | ville bryte DPA-forbeholdet (`om-page.html:194-195`) og eierskapsmodellen for media (`CLAUDE.md:32-33`) | middels | stor | **Ikke** |
| Statisk to-kolonne-mock felt → utkast | delvis (kundereisen scene 6/8, `kundereisen.html:391-424, 468-493`, uverifisert linjer for scene 6) | feil hvis 528.220 eller feltnavn utenfor `models.py:42-60` brukes | uverifisert | liten | **Nå, med ekte struktur:** bruk motorens felt og et nummer fra indeksen (727.813 `byggforsk_index.py:42`, 700.117 `:23`); merk «eksempeldata»; ingen fargekoding som antyder konfidens |
| Åpen eksempelrapport uten PIN | delvis: visning finnes bak PIN (`share-page.html:109-136, 254-280`), datasett i `ovingssak.html:555-584` | belagt for struktur; **må ikke** vise «Forløp/Klassifisering» (share-page rendrer ikke `acuteOrGradual`/`sourceCategory` — kun Skadested/Kilde/Årsak/Faglig beskrivelse/Omfang/Tiltak/Beboelig, `share-page.html:254-262`, verifisert) eller kildemerker (ny idé, `docs/ovingssak-og-prototyping.md:107, 112-114`) | uverifisert | liten–middels | **Nå:** statisk `/eksempelrapport` via `sendPublicPage`, share-page-markup, ovingssak-data uten kildemerker/forløp-rad; legg i `SITEMAP_PATHS` (`publicBase.js:116`) og `TELLBARE_STIER` (`publikum.js:110`). Bevis-ingressen «Hvert bevis bærer opplastingstidspunkt og en SHA-256-sjekksum satt av serveren ved mottak» (`share-page.html:124-128`) er sann på /share og usann for oppdiktede bevis — omskrives («I ekte rapporter bærer hvert bevis …») og ingen hash vises (§4 «Nå» pkt 8). **Aldri** som rad i `shares` (ville omgå `share.js:172-180`) |
| Kildemarkering per utsagn + Byggforsk-sitat | mangler for mottaker (`evidence_points` ikke i payload, `share.js:110-138`; ikke i app, `reportVersions.ts:14-31`) | ubelagt; sitattekst bryter lisensgrensen (`docs/byggforsk-integrasjon.md:12-20`) | uverifisert | middels | **Etter evidens (Port 1, feilanalyse):** `verdens-beste-losning.md:441-447` lister «kildeetikett og støttegrad per utsagn» som kandidat etter feilanalyse. **Nå:** fjern sitatteksten i `kundereisen.html:477` (og tilsvarende i `presentation/ui-total.html`, uverifisert her) |
| Annoterte skjermbilder av ekte utkast | mangler (0 `<img>` på /om) | belagt hvis fra øvingsprosjekt; ekte sak krever samtykke (ikke dokumentert) | uverifisert | liten | **Nå:** 2–3 skjermbilder fra kjørende bygg med oppdiktede data, etter at kontrastfeilen i §7 er rettet |
| «For forsikringsselskap»-seksjon | delvis (`om-page.html:175`, `faq-page.html:79-83`, `vilkar-page.html:58-63`) | ansvarsplassering belagt; «eksportformater» = kun PDF/DOCX (`index.js:743-775`), In4mo ikke bygget (`om-page.html:234`); aksept ubelagt | lav | liten–stor | **Ikke** som seksjon (nei-lista: egen skinne). **Nå:** utvid FAQ-svaret om mottak med belagte setninger: «AI-utkastet fra siste generering lagres uendret; korrigerer takstpersonen utkastet, ser mottakeren hvor mange felt som ble endret» (`share-page.html:269-278` rendrer tellingen bare ved ≥1 endret felt; `reportService.js:334-338` erstatter utkastet ved ny generering) — **ikke** «hvilke felt», **ikke** «arkiveres» uten «siste» (§5.6) |
| Gjenbruk av /kundereisen | finnes (`index.js:213-229`) | ubelagt som «eksempelrapport»: fiktiv URL «docrai.no/r/…» (`kundereisen.html:470`), sitattekst (`:477`), telleren «1/7» er kun startmarkup — JS setter riktig (`:498`, `:549`, verifisert) | middels | liten | **Nå:** rett URL-form, sitattekst, adresse; legg CTA-rad nederst; beacon + `TELLBARE_STIER`. Bruk som «Se kundereisen (2 min)», ikke som eksempelrapport |

### 3.3 ROI-kalkulator og pris/pilot-klarhet

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| ROI-kalkulator | mangler | ubelagt — ingen målt spart tid; baseline ikke målt (`verdens-beste-losning.md:434-438`); break-even «5–10 min» viser til et eier-deck som ikke er i repoet (`:398-401`, verifisert at det henviser videre) | uverifisert | liten | **Etter evidens.** Om noe bygges: brukeren fyller inn alle tall selv, ingen forhåndsverdi, ingen publisert break-even før utregningen ligger i repoet |
| Kreditt- eller setebasert prising | delvis: kredittmodell er repoets anbefaling (`beslutningsnotat-prising.md:8-12, 25-30`) men ikke vedtatt/bygget (`:64-65`); **setebasert er dagens publiserte modell** («per takstperson», `faq-page.html:67, 102`; `om-page.html:298`) — frarådet i `verdens-beste-losning.md:396-397` | feil: `/om` sier «ubegrensede saker» (`om-page.html:206, 223`), notatet sier 10 rapporter (`:27`) | uverifisert | middels | **Nå (tekst):** fjern «ubegrensede saker», «per takstperson» og 990-tallet til modellen er vedtatt — eller vedta modellen først. Prisnotatet sier priser ikke skal publiseres før COGS-gulvet er målt (`:52-55`). **Ikke** setebasert. **Etter evidens (kode):** saldo først ved vedtak + 10–20 rapporter + skriftlig betalingsforpliktelse |
| Risikofri pilot med suksesskriterier | delvis: pilot finnes (`om-page.html:209-217, 253-257, 272`; `vilkar-page.html:73-76`); kriterier kun internt (`avklaringer-og-roller.md:16-21` — merket «f.eks.», ikke vedtatt) | «50 % rabatt» og «maks 8 foretak» er ubelagte løfter; ingen selskap kan signere (`avklaringer-og-roller.md:11-14`) | uverifisert | liten | **Nå:** «tid fra første bevis til godkjent vises per sak» (`metrics.ts:34-45`, belagt) + «etter 5 godkjente rapporter avgjør du selv» — **prosessløfte** uten kodelinje eller avtale; tillatt bare under unntaket i §5 (merket som prosessløfte, med navngitt avsender, aldri som «belagt»). **Ikke** «antall endrede felt vises per rapport» — appen viser bare en advarsel, ikke tall (`[id].tsx:2439-2447`); tallet vises kun for mottaker (`share-page.html:269-278`) |
| «2–3 timer», «2 400–4 500 kr», timepris 1 200–1 500 | finnes (`om-page.html:204-205`) | ubelagt («Påstått», `verdens-beste-losning.md:84`); timepris inkonsistent med «~800–1 500 kr» i `docs/prising-bruksbasert.md:57` (verifisert); `docs/beslutningsnotat-prising.md:43` oppgir bare den avledede verdien «~2 t (1 600–3 000 kr verdi)», ikke timeprisen (verifisert) | uverifisert | liten | **Nå:** merk raden «anslag – vi måler dette i piloten» eller erstatt med det belagte («appen måler tiden på hver sak»). **Ikke** bytt til andre ubelagte tall |
| Case-studier / forsikringsaksept-uttalelser | mangler | ubelagt på alle inngangsverdier (tid, volum, samtykke, aksept) | uverifisert | middels–stor | **Etter evidens:** Port 2-test (`verdens-beste-losning.md:419, 450-452`) og skriftlig Ocab-samtykke; **ingen kilde finnes** i repoet for samtykke til navn/sitat |

### 3.4 Felt-ergonomi i appen

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Berøringsflater ≥ 48 px | delvis: fangst/kritiske knapper 56 (`[id].tsx:3105, 3121, 3129, 3146, 2382, 2551, 3375`); `PrimaryButton`/`SecondaryButton` uten minHeight (`Buttons.tsx:58-66, 102-108`), `IconButton` 42×42 (`:138-143`), romchips 36 (`[id].tsx:3164`) | belagt (kode) for «store knapper»; «med våte hansker» er ikke felt-testet (pilotlogg: 0 treff «hansk», uverifisert grep her) | uverifisert | liten | **Nå:** minHeight 48 som standard i Primary/Secondary, IconButton 48×48. Kjør `npx tsc --noEmit` |
| Kognitiv avlastning / få valg per skjerm (A «kritiske brukerbehov i felt», Hicks lov på app-nivå) | delvis: notat-fanen er stram — romstripe + tre fangstknapper fast øverst (`[id].tsx:3283-3287`), notatliste, «Se rapport» fast i bunn (`:3369-3380`); rapport-fanen har mange kort og knapper (generer/nullstill `:2362-2384`, status/nedlasting `:2401-2447`, godkjenning/deling `:2540-2611`) | pilotloggens eneste kognitive funn er «Lagre-knapp for rapportfelter ‹glemmes 10/10 ganger›» (`docs/pilotlogg-ocab.md:127-128`), løst med autolagring (samme linjer) | uverifisert | middels | **Etter evidens (ride-along):** ikke omstrukturer rapport-fanen nå; notat-fanen er allerede kognitivt lett |
| Avstand ≥ 8 px mellom berøringsflater (A §4B, B «spaced ≥ 8 px») | finnes: `gap: theme.spacing.sm` mellom fangstknappene (`[id].tsx:3101`) og mellom romstripe og knapper (`:3286`); `spacing.sm = 10` (`apps/mobile/src/ui/theme.tsx:61`, verifisert) | belagt (kode) | lav | — | **Ingen tiltak** — oppfylt, ikke bygg «avstand» som ny oppgave |
| Primær i tommelsonen | delvis: fangstknapper fast øverst (`[id].tsx:3283-3287`, B13-kommentar `:3099`), «Se rapport» fast i bunn (`:3369-3380`) | ikke påstand | uverifisert | middels | **Etter evidens (ride-along)** |
| Mørk modus / kjellermodus | finnes automatisk (`theme.tsx:71-82, 97-100`) | ikke påstand | uverifisert | liten | **Ikke** ny modus. **Nå:** kontrastfeil — se §7 |
| Bekreftelse «lagret lokalt» ved nettbrudd | delvis: synk-pille «Venter på nett — lagret lokalt» (`nb.ts:44`), toaster nettnøytrale (`nb.ts:126-129`) | belagt (kode) for lagring; FAQ-utfallet «Du mister ikke en befaring» (`faq-page.html:74-75`) er hypotese — pilotloggen dokumenterer en synk-nekt (`pilotlogg-ocab.md:124-125`) | uverifisert | liten | **Nå:** toast sier «Lagret på enheten – lastes opp når nettet er tilbake» ved offline; vis `MediaUploadErrorBanner` i prosjektskjermen |
| Progressiv avdekking: eksport skjult til godkjent | delvis: deling disabled uten stempel (`[id].tsx:1979-1996`); PDF/Word vises så snart `displayUrl` finnes (`[id].tsx:2401-2434`), advarsel kun etter redigering (`:2439-2447`); serverruten sjekker ikke godkjenning (`index.js:743-775`) | belagt at porten gjelder deling, ikke nedlasting | uverifisert | liten | **Nå:** deaktiver PDF/Word til `reportApproval` er satt, samme mønster som deling. Rører ikke invarianten (som gjelder /share) |

### 3.5 AI-grensesnitt og gjennomgang

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Skeleton / «voksende» rapport | delvis: overlay med fire tidsstyrte steg (`ReportGeneratingOverlay.tsx:25-30, 213-220`, uverifisert her; `nb.ts:148-153` verifisert) | ikke påstand; motoren returnerer ett JSON-objekt (`main.py:302-306`), ingen strømming; `reportStatus` settes av klienten, ikke server (temavurdering AI-UX, uverifisert her) | lav | stor | **Ikke.** Merk at `docs/byggepraksis-2026.md:47` («✓ ekte prosess-status») og `:106` («erstatt tidssimuleringen») motsier hverandre — koden støtter :106 |
| USIKKER-flagg per felt | mangler: verdien vises som ren tekst i redigerbart felt (`[id].tsx:2469, 2471`; `reportVersions.ts:21, 23`); delingssiden viser verken kildekategori eller tidsforløp (`share-page.html:254-262`) | belagt (kode) at motoren leverer USIKKER (`models.py:6-25`); om den faktisk gjør det er umålt (resultatark tomt, `docs/valideringscaser.md:254-272`) | uverifisert | liten–middels (ingen valgkomponent i `apps/mobile/src/ui`, temavurdering) | **Etter evidens (Port 1):** `verdens-beste-losning.md:441-447` — «bygg bare det feilanalysen peker på». Den ene skarpe saken var falsk sikkerhet, ikke USIKKER (`pilotlogg-ocab.md:40-46`) |
| Konsistent terminologi | delvis: «KI-en» (`apps/mobile/src/features/projects/ReportGeneratingOverlay.tsx:263`; `apps/mobile/app/(tabs)/explore.tsx:167, 186`, verifisert) og «KI-forespørsler» (`nb.ts:23`) vs «AI-utkast» (`nb.ts:179`); hardkodede etiketter (`[id].tsx:2469, 2471`) | ubelagt at det er «norsk takststandard» | uverifisert | liten | **Nå:** ett ordforråd i `nb.ts`, speil på /om; **ikke** skriv «i tråd med norsk takststandard» |
| Tastatursnarveier web | mangler (grep 0) | ikke påstand; om gjennomgang skjer på PC er uverifisert | lav | middels | **Etter evidens.** Å logge `Platform.OS` krever oppdatert `/personvern` først (`personvern-page.html:84-85` lister uttømmende hva handlingsloggen inneholder) |
| Alt+B Byggforsk-panel | mangler; referansen når ikke appen (`reportVersions.ts:18-28`) | ubelagt; fulltekst krever SINTEF-avtale | middels | stor | **Ikke.** Rekkefølge: mapp `technical_reference` inn i appen → vis nummer+tittel → fulltekst kun etter avtale |
| Per-avsnitt-godkjenning | delvis: ett stempel + per-felt-diff (`[id].tsx:1927-1943, 2466-2506`) | belagt for ett stempel; per-avsnitt kan øke falsk positiv «godkjenning uten lesing» (`verdens-beste-losning.md:116-118`) | lav | middels | **Ikke.** Serverporten skal fortsatt kreve ett samlet stempel |
| Suksess-checkmark, angre | finnes (`[id].tsx:1942`; `nb.ts:186-188`; trekk tilbake `[id].tsx:1959-1976` uverifisert linje; redigering nullstiller `:1905-1922`) | belagt | middels | — | **Ingen tiltak.** Merk: utkastteksten vises aldri i appen — bare «endret»-merket (temavurdering, korreksjon) |

### 3.6 Ytelse og teknisk plattform

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| CWV-mål og måling | mangler (`ci.yml:13-77`; `docs/fagkart-lansering.md:90, 139`) | ikke påstand | lav | liten | **Nå (én time):** Lighthouse mobil mot `https://docrai.io/`, `https://app.docrai.io/` OG onrender-/om, /demo; skriv tallene i fagkartet. Ingen CI-gate før noe faktisk bryter |
| Ytelsesbudsjett / ingen render-blokkerende ressurser | delvis: oppfylt på /om; **ikke** på docrai.io — `explainer/index.html:33-34` laster Google Fonts render-blokkerende | ikke påstand | lav | liten | **Nå:** fjern `:33-34`, bruk systemfont-stack som /om (`om-page.html:37`, uverifisert linje) |
| CDN/edge, komprimering | finnes på plattformlaget (Cloudflare + brotli, live-måling); **ikke** i kode (`apps/api/package.json:17-24` uten `compression`) | ikke påstand | lav | — | **Ikke** legg `compression` i Express — overflødig. BREACH-premisset i temavurderingen faller: kanten komprimerer alt uansett |
| Cache-Control | mangler på Express-HTML og ikoner (ingen `Cache-Control` i `index.js`, verifisert grep; `cf-cache-status: DYNAMIC` på /om, live-måling); riktig på sensitive ruter (`share.js:44` no-store, `:362` private) | ikke påstand | lav | liten | **Nå:** `public, max-age=300` i `sendPublicPage`/`sendPresentationPage` (`index.js:202-208, 216-225`) **og** i de to handlerne som ikke går via dem: `/kontakt` leser `kontakt-page.html` selv og fletter inn `BOOKING_URL` (`index.js:258-277`, verifisert — varierer med miljøvariabel, ufarlig ved 300 s), `/takk` bruker `res.sendFile` (`:282-284`, verifisert); `maxAge` på ikoner (`:291-304`), `app.disable('x-powered-by')` (`x-powered-by: Express` sendes, live-måling). **Stryk** tiltak på `express.static(STATIC_DIR)` (`:339-340`) — kodestien kjører ikke i produksjon (dist bygges ikke på Render, `docs/DEPLOYMENT.md:14-16`, uverifisert her; webappen serveres fra Renders static site, live-måling) |
| HTTPS/HSTS | TLS ja (live); HSTS-mekanisme i kode (`index.js:66-75`) men **ingen** `strict-transport-security` sendes fra noen vert (live-måling) | «går over HTTPS» (`faq-page.html:58`) belagt | middels | liten (drift) | **Nå:** start HSTS-trappa per `docs/RENDER_SETUP.md:50` (uverifisert linje) — det er en env-variabel, ikke kode |
| AVIF/srcset, font-preload, minifisering, React-port, Web Workers | ikke relevant / feil lag (§1) | — | lav | — | **Ikke.** Eneste bildejobb: kundereisens base64-PNG (`kundereisen.html:316`, ≈115 KB tekst, temavurdering) — lav prioritet |
| app.docrai.io / signup | app live (200); signup finnes ikke | belagt (drift) / ubelagt | uverifisert | — | **Nå:** skriv domenene inn i `docs/DEPLOYMENT.md` (nevner dem ikke, uverifisert grep her). **Ikke** «Åpne appen»-CTA mot kald trafikk |

### 3.7 SEO og innhold

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Titler, schema, sitemap, robots, alt, hierarki | finnes i repo — **ikke publisert på docrai.io** (404 på /sitemap.xml, /robots.txt, /om; live-måling). docrai.io har kun Organization-JSON-LD (`explainer/index.html:23-31`) | ikke påstand; Offer 990 NOK (`om-page.html:298`) sprer prisavviket | lav | liten | **Nå:** avgjør forside (§4). Hvis Express blir docrai.io følger alt med; hvis explainer beholdes trenger den sitemap/robots/lenker |
| Intern lenkestruktur | delvis: /demo-footer mangler /faq og /kundereisen (`demo-page.html:120-123`); kundereisen har én lenke (`kundereisen.html:233`); explainer lenker kun til app.docrai.io — ingen vei til FAQ/personvern/vilkår (`:207-208, 220, 301`) | ikke påstand | uverifisert | liten | **Nå:** footer-lenker på /demo; CTA-rad i kundereisen; lenker fra forsiden til personvern/vilkår/faq |
| Engelsk versjon | mangler (bevisst, `CLAUDE.md:11`) — men app.docrai.io deklarerer `lang="en"` (live-måling) | ikke påstand | lav | middels | **Ikke** engelsk salgsside. **Nå:** rett `lang` på webappen (kilde til «en» uverifisert; `apps/mobile/app.json:36` skal si «nb» iflg. temavurdering) |
| Kundenes egne begreper fra intervjuer | delvis: fagord på `om-page.html:172` er belagt av transkripsjonsprompten (`index.js:422-433`, uverifisert her) | ingen intervjuer dokumentert; pilotloggens «bunnsvill/kapillæroppsug» (`:40-46, 60-62`) er loggforfatterens fasit/instruks, ikke sitat fra Sigurd | uverifisert | liten | **Etter evidens (Port 0-samtaler).** Ikke omskriv på personas fra to informanter |
| Ingen pop-ups/støy | finnes på Express-sidene; docrai.io har Google Fonts (ekstern forespørsel) og ingen måling overhodet (ingen sendBeacon i explainer, temavurdering) | belagt for Express-sidene (`personvern-page.html:54, 62-65`) | middels | — | **Hold det slik.** Avvis GA4/Hotjar |
| «Teksttung» → korte avsnitt | finnes på /om (ingen avsnitt > 54 ord, temavurdering) | analysens sitat gjelder explainer | lav | liten | **Ikke** omskriv. Del ev. hero-p (`om-page.html:148-154`) og tillitsavsnitt (`:192-195`) i to |
| «Stryk sjargong» (C, `docs/nettside-eksterne-analyser-2026-09.md:186`) / «plain Norwegian» (B Phase 2, `:149`) | ikke relevant slik ment: fagordene på /om («klemring, svill, diffusjonssperre», `om-page.html:172`) er målgruppens språk og belagt av transkripsjonsprompten (`index.js:422-433`, verifisert: samme ord i fagordlista) | belagt | lav | — | **Ikke tiltak.** Sjargong er det takstpersonen snakker; det som skal strykes er intern «KI-en»/«AI-utkast»-inkonsistens (§3.5), ikke fagord |
| «Veiledning underveis, FAQ som siste utvei» (C, `:187`) | delvis: FAQ finnes (`faq-page.html`); veiledning i app kun som huskeliste-hint (`nb.ts:262-263`); øvingssak-prototype ikke rutet (§2) | ikke påstand | uverifisert | liten–middels | **Etter evidens:** følg beslutningsregelen i øvingssak-testplanen (`docs/ovingssak-og-prototyping.md:222-229`, verifisert: «Bygg bare kontekstuelle hint» hvis testpersonene fullfører lett; «Rett grensesnittet først» hvis de står fast) — ikke bygg veiledning før tre personer har prøvd |
| «Fremhevede menyvalg» (C, `:186`) | mangler: /om har ingen toppmeny (`om-page.html:144`) | ikke påstand | lav | liten | **Nå:** dekkes av ankerraden med tre valg i §3.1 — ingen egen oppgave |
| «Klare feilmeldinger» (C, `:187`) | delvis: /demo viser serverens feiltekst eller «Noe gikk galt – prøv igjen.» (`demo-page.html:189`, verifisert) i en `#error`-div uten `role` (`:100`) | belagt (kode) | lav | liten | **Nå:** dekkes av ARIA-tiltaket i §3.8 (`role="alert"`); vurder «Fant ikke adressen – sjekk stavemåten» som fallback-tekst i stedet for «Noe gikk galt» |

### 3.8 Tilgjengelighet (WCAG 2.2 AA)

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| Kontrast ≥ 4,5:1 lys modus | finnes (alle utregnede par består, temavurdering — uverifisert av meg) | belagt (målbart) | lav | — | Ingen |
| Kontrast mørk modus | delvis: **/demo «Hent»-knapp** hvit på `--accent #8FC2CB` (`demo-page.html:55` uten override; eneste dark-blokk `:26-34` endrer bare variabler) = 1,95:1 (WCAG-formel, temavurdering + korreksjon); /om, /kontakt, /takk, 404 har override (`om-page.html:131`, `kontakt-page.html:54`, `takk-page.html:29`, `404-page.html:27`). Samme feil i appens `PrimaryButton` (`Buttons.tsx:89, 93` hardkodet `#fff` på `theme.tsx:80` accent `#8FC2CB`) | belagt (målbart) | uverifisert (pilotlogg nevner ikke mørk modus) | liten | **Nå:** én dark-mode-linje i demo-page (mønster `kontakt-page.html:54`), + `.spin` (`demo-page.html:74`); mørk tekst på accent i `PrimaryButton` i dark mode |
| Fokus/tastatur | delvis: 9 av 10 sider; kundereisen mangler `focus-visible`, segmenter har `role=button` uten `tabindex` (`kundereisen.html:529-531`, uverifisert linje), klikkbar `stage`-div (`:584`) avbøtt av mellomrom (`:585-589`) | belagt | lav | liten | **Nå:** kopier fokusblokken fra `om-page.html:134-138`; `tabindex=0` på `.seg`; rett `docs/byggepraksis-2026.md:49` («alle offentlige sider» er usant) |
| `<main>`, skip-link | mangler (grep `<main|skip` 0, temavurdering) | ikke påstand | lav | liten | **Nå:** `<main class="page">`; **ikke** skip-link (1–2 fokusstopp før h1) |
| Label på alle felt | delvis: **/demo adressefelt har kun placeholder** (`demo-page.html:97`) | belagt (axe «label» kritisk) | uverifisert | liten | **Nå:** `<label for="adr" class="sr-only">Adresse</label>` |
| ARIA live-regioner | mangler: `#error` (`demo-page.html:100`), `#gateError` (`share-page.html:98`), `#statusPill` (`:91`) uten role | belagt | lav | liten | **Nå:** `role="alert"` / `role="status"` |
| Teksting av video | ikke relevant: ingen publisert video; lydnotat-transkript leveres allerede til mottaker (`share.js:87-89` → `share-page.html:294-309`) | belagt for lyd; kun video mangler tekst | lav | middels | **Ikke** nå |
| Automatisk a11y-test i CI | mangler (`ci.yml`) | ubelagt: «WCAG 2.2 AA» kan ikke publiseres (regel 6). Én manuell måling nevnes (`fagkart-lansering.md:58-63`) uten metode | lav | liten–middels | **Nå:** fem grep-sjekker i `e2e-headere.sh` (lang, label, alt, `<main>`, **minst** én h1 — /share har tre h1 i `share-page.html:95, 104, 111`, så «nøyaktig én» ville stryke). **Etter:** axe som ikke-blokkerende steg (mønster SBOM `ci.yml:49-51`). Rett `fagkart-lansering.md:59-62` |

### 3.9 Måling, CRO og eksperimenter

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| GA4 / Hotjar / Clarity | mangler | feil: bryter `personvern-page.html:54, 55, 62-65`, `faq-page.html:100`, `kontakt-page.html:9, 90` (alle verifisert) | lav | stor (tekst + samtykke + DPA) | **Ikke** (§6) |
| A/B-test hero | mangler; `sendPublicPage` er statisk (`index.js:202-208`) | variant-lagring bryter «ingen cookies» | lav | middels | **Ikke.** Bruk `?k=`-kampanjekoden sekvensielt som `docs/kampanje-takstpersoner.md:104-107` foreskriver |
| Feature flags | mangler | ikke påstand; én tester | lav | middels | **Ikke** |
| Trakt besøk → interesse → godkjent | delvis: rådata finnes (sidevisninger, pilot_interesse, `user_actions` approve-report) men **ingen utlesing** (`admin.js`: 0 treff på sidevisninger/pilot_interesse, verifisert) | ikke påstand | lav (intern) | liten | **Nå:** `GET /api/admin/trakt` for sidevisninger per sti/uke og pilot_interesse per uke — begge dekket av `personvern-page.html:54-55, 62-65, 70-73` (verifisert). **Ikke nå:** «distinkte tester_token med approve-report per uke» — handlingsloggens formål er uttømmende avgrenset til «feilretting og til å se hva som er tregt» (`personvern-page.html:85-86`, verifisert); aktiveringsmåling per tester er et nytt formål og krever tekstendring først (§6), på linje med klikk-beacon og `Platform.OS`. **Klikk-beacon på CTA-er krever tekstendring først** — `personvern-page.html:54, 62-64` lover «kun hvilken side … og kampanjekode i lenken»; en klikkhendelse er ny datakategori (regel 6) |
| Kohort tid til første godkjente | delvis: `tester_tokens.created_at` (`db.js:49-55`) + `user_actions` (`:94-103`); **ikke** i `report_generations` (ingen godkjenningskolonne, `db.js:158-178`) | formålsbegrenset: `user_actions` er lovet brukt «bare til feilretting» (`personvern-page.html:85-86`) | lav | liten | **Etter tekstendring** (§6): én SQL når `personvern-page.html:85-86` også nevner aggregert bruksstatistikk. Ikke UI før >5 tokens |
| Fangst → utkast («% completing first capture → draft», B Phase 0; Nielsen «visible system status» som måling, B Phase 1) | delvis: rådata finnes — `upload-<kind>` (`apps/mobile/src/sync/projectSync.ts:389`, verifisert) og `generate-google-doc` (`[id].tsx:1611`, verifisert) i `user_actions`; ingen utlesing | samme formålsbegrensning som raden over (`personvern-page.html:85-86`) | lav (intern) | liten | **Etter tekstendring** (§6): andel tester_token med minst én `upload-*` som også har `generate-google-doc` samme uke. Ikke droppet — utsatt til personvernteksten dekker det |
| Nordstjerne «weekly active report creators» | delvis | repoets nordstjerne er en annen (`verdens-beste-losning.md:99-100`); aktivitet ≠ utfall (falsk positiv `:116-118`) | lav | — | **Ikke bytt.** Rapporter aktivitet ved siden av feltendringer (`share.js:132-137`) |
| Bounce < 35 %, CTA→pilot > 25 %, LCP < 2,0 s, løft 60 dager | ikke relevant / mangler | ubelagt uten baseline; bounce umulig cookiefritt | lav | — | Sett terskler etter 4 ukers baseline. Repoets go/no-go er «f.eks.», ikke vedtatt (`avklaringer-og-roller.md:16-19`) |
| /kundereisen telles ikke | mangler (`publikum.js:110`; ingen beacon i fila, grep 0) | ikke påstand | lav | liten | **Nå:** legg til |
| Slettejobb for sidevisninger | ikke nødvendig: teksten sier «Ryddes ikke automatisk i pilotfasen» (`personvern-page.html:120`); `agent-readiness.html:591-592` siterer utdatert tekst | belagt | — | — | Ingen |

### 3.10 Prosess, research og konkurrenter

| Anbefaling | Status | Belegg | Verdi | Innsats | Tiltak |
|---|---|---|---|---|---|
| 5–8 dybdeintervjuer | mangler (ingen intervjuguide; innsikt fra én tester) | ikke påstand; eneste vei til å belegge tallene på /om | høy for DocrAIs evidens, uverifisert for takstpersonen | middels | **Nå, som Port 0-baseline** (`verdens-beste-losning.md:434-438`): rapporttid i dag + tilbakesending fra forsikring; start med testplanens tre (`docs/ovingssak-og-prototyping.md:213-215`). Samtykke til intervjuopptak må avklares separat — `taleteknologi-laerdommer.md:156` gjelder WER-feltopptak |
| Månedlig advisory | delvis: «ukentlig tilbakemelding» lovet på fire flater (`om-page.html:214`, `faq-page.html:66`, `vilkar-page.html:74`); pilotlogg stille siden 26.08 (git, verifisert); `docs/beslutninger.md` finnes ikke (verifisert) | ikke påstand | middels | liten | **Nå:** gjenoppta pilotloggen med de tre KPI-ene (`avklaringer-og-roller.md:80-83`); opprett `docs/beslutninger.md`; månedlig blind stikkprøve (`verdens-beste-losning.md:307-308`) |
| Workshop 3–4 t (C) | delvis (proto-personas, canvas) | helsedomene-mal; dot-voting med to informanter = gjetting, risiko mot nei-lista | lav | liten | **Ikke.** Gjør co-design-økt med rød penn (`ovingssak-og-prototyping.md:151`) + én ride-along med firelinse (`:149`) |
| Kvartalsvis konkurrent-teardown | finnes (`docs/konkurrentanalyse.md:156-163`, verifisert: «kvartalsvis sjekk med definerte triggere», fem triggere Wenn/iVerdi/Solera/Pretakst/Bdeo) | delvis belagt: CliVa-feilen står i tre filer — `konkurrentanalyse.md:48-49`, `erfaringer-konkurrenter.md:189`, `konkurrent-selskapsanalyse.md:32` (alle åpnet; oppgitt i `verdens-beste-losning.md:508-510`, verifisert) | lav | liten | **Nå:** rett CliVa på de tre linjene; neste sjekk november |
| Kvartalsvis heuristisk re-audit | delvis (`byggepraksis-2026.md:37-49`) | «WCAG AA-kontrast for hvit tekst» påstås i `presentation/fargealternativer.html:96` (uverifisert her) og er usann i mørk modus | middels | liten | **Etter evidens:** audit før Port 1. **Nå:** kontrastfiks (§7) |
| 7-ukersplanen (A) | — | bryter personvernløftet (Fase 0), regel 6 (prooflinje), 50/50-regelen (`avklaringer-og-roller.md:46-49`) | — | stor | **Ikke.** Bevisportene dekker det samme i riktig rekkefølge |
| Valideringsbatteriet | delvis: designet, resultatark tomt (`valideringscaser.md:254-272`); «50 totalt» vs «/ 55» (`:18`, `:270`) | ikke påstand; Port 1-krav | høy | middels | **Nå:** rett 50/55; kjør 11 caser; billigste evidens i repoet |

### 3.11 Faktasjekk (samlet)

Se §1. Tillegg fra korreksjonene: Ocab navngis også på de ugatede, noindex-merkede
Express-sidene `/losningsskisse` og `/agent-readiness` (`index.js:230, 236`; treff i
`presentation/losningsskisse.html:549, 613` og `agent-readiness.html:791, 845, 1112` —
uverifisert linjer her). Regel 6-eksponeringen for Ocab-navnet er dermed større enn
explainer alene.

---

## 4. Prioritert backlog i tre spor

### «Nå» — ingen nye påstander, liten innsats, verifiserbart i test

1. **Avgjør forsiden.** Enten peker docrai.io på Express-tjenesten (da følger /om,
   sitemap, robots, personvern med), eller explainer beholdes og synkroniseres med
   /om (hero, CTA-er, risikoreversering, felt-narrativ, lenker til
   personvern/vilkår/faq, beacon). Uansett: fjern Google Fonts fra
   `explainer/index.html:33-34` (og `presentation/ovingssak.html:4-5`) — ellers er
   `personvern-page.html:54` usann for forsiden. Verifiser: `curl -s https://docrai.io/ | grep -c fonts.googleapis` = 0.
2. **Regel 6-rydding av tall og pris:** `om-page.html:204-206, 223, 298` og
   `faq-page.html:67, 102` — fjern «ubegrensede saker», «per takstperson» **og
   990-tallet** til prisvedtak (`beslutningsnotat-prising.md:52-55`: «bekreft gulvet før
   prisene publiseres på /om og /vilkar»); merk «2–3 timer / 2 400–4 500 kr» som anslag
   eller erstatt med «appen måler tiden på hver sak». Verifiser: grep i begge filer
   (`990`, `ubegrens`, `per takstperson` = 0 treff).
3. **Fem UU-fikser i HTML/CSS:** dark-mode-override for `button`/`.spin` i
   `demo-page.html:55, 74`; `<label>` for `#adr` (`demo-page.html:97`);
   `focus-visible` + `tabindex` i `kundereisen.html`; `<main>` på salgssidene;
   `role="alert"/"status"` (`demo-page.html:100`, `share-page.html:91, 98`).
   Verifiser: nye grep-sjekker i `apps/api/test/e2e-headere.sh` (lang, label, alt,
   main, minst én h1).
4. **Kontrastfiks i appen:** mørk tekst/spinner på accent i `PrimaryButton` når
   `theme.mode === 'dark'` (`Buttons.tsx:89, 93`; `theme.tsx:80`); minHeight 48 som
   standard i Primary/Secondary/IconButton. Verifiser: `npx tsc --noEmit` + skjermdump.
5. **Deaktiver PDF/Word før godkjenning** (`[id].tsx:2401-2434`), samme mønster som
   `Lag delingslenke`. Verifiser: tsc + manuell test. (Vurder også server-sjekk i
   `index.js:743-775` — rører ikke tenant-isolasjon; kjør `e2e-tenant-isolation.sh`
   uansett siden `index.js` røres.)
6. **Cache-Control + x-powered-by:** `public, max-age=300` i `sendPublicPage`,
   `sendPresentationPage` **og** `/kontakt`-handleren (`index.js:258-277` — leser
   fila selv og fletter inn `BOOKING_URL`; varierer med miljøvariabel, ufarlig ved
   300 s) og `/takk` (`:282-284`, `res.sendFile`); `maxAge` på ikoner,
   `app.disable('x-powered-by')`. Verifiser: ny sjekk i `e2e-headere.sh` som krever
   `cache-control` på **alle** sju: /om, /demo, /faq, /kontakt, /personvern, /vilkar,
   /takk (i dag sjekkes bare no-store på `/api/share/*/meta`, `e2e-headere.sh:169`)
   + live `curl -I`. Start HSTS-trappa i Render-env.
7. **Måling som allerede er lov:** `/kundereisen` i `TELLBARE_STIER` + beacon;
   `GET /api/admin/trakt` med **kun** sidevisninger per sti/uke og pilot_interesse
   per uke — dekket av `personvern-page.html:54-55, 62-65, 70-73`. **Ikke**
   approve-report/`upload-*`/`generate-google-doc` per tester i samme rute:
   handlingsloggen er lovet brukt «bare til feilretting og til å se hva som er
   tregt» (`personvern-page.html:85-86`); den delen flyttes til «Etter evidens»
   (krever tekstendring først, §6). Verifiser: `e2e-share.sh`
   (dekker `/api/besok`, `:232-236` iflg. infra-kart, uverifisert linje).
8. **Statisk `/eksempelrapport`** av ovingssak-datasettet i share-page-stil, uten
   kildemerker og uten Forløp-rad, merket «eksempeldata»; legg i sitemap og
   TELLBARE_STIER; sekundær CTA fra hero og fra /demo-CTA-kortet
   (`demo-page.html:109-116`). Gjenbruk av share-page-markup **må ikke** arve
   `<meta name="robots" content="noindex, nofollow">` (`share-page.html:6`) — ellers
   legges en noindex-side i sitemap. Sett egen `<link rel="canonical" href="/eksempelrapport">`
   og `og:image`, så `sendPublicPage` → `absolutizeSeo` (`index.js:202-208`;
   `publicBase.js:100-113`) absolutiserer canonical og legger på `og:url` (og:url
   injiseres bare når og:image finnes, `:107-112`). Samme arv-problem for
   bevis-ingressen: share-page sier «Hvert bevis bærer opplastingstidspunkt og en
   SHA-256-sjekksum satt av serveren ved mottak — innholdet kan verifiseres uendret»
   (`share-page.html:124-128`, verifisert). På en statisk side med oppdiktede bevis
   finnes ingen serversatt sjekksum — setningen ville stå uten kode bak seg akkurat
   der. Stryk ingressen (enklest — da holder grep-sjekken under) eller omskriv uten
   sjekksum-ordet («I ekte rapporter bærer hvert bevis opplastingstidspunkt og en
   serversatt sjekksum»), og vis ingen hash på fiktive bevis. Verifiser:
   `e2e-headere.sh` sitemap-telling (i dag 7,
   `:140-141`) må oppdateres til 8, ny sjekk `grep -c 'name="robots"'` = 0 og
   `grep -c 'SHA-256'` = 0 på `/eksempelrapport`.
9. **Kundereisen-rettelser:** sitattekst (`:477`) → «Byggforsk 727.813 · Feil og
   skader i baderom · verifisert mot liste»; URL-form (`:470`); konsistent adresse;
   CTA-rad nederst; `<h1>` visuelt skjult.
10. **Dokumentgjeld:** CliVa på `konkurrentanalyse.md:48-49`,
    `erfaringer-konkurrenter.md:189`, `konkurrent-selskapsanalyse.md:32` (alle
    åpnet; listen står i `verdens-beste-losning.md:508-510`); `byggepraksis-2026.md:47/49/106`;
    `fagkart-lansering.md:59-62`; `valideringscaser.md:18` (50→55); opprett
    `docs/beslutninger.md`; skriv domenene inn i `docs/DEPLOYMENT.md`.
11. **CTA-arkitektur på /om:** pilot primær, demo sekundær, «Book møte» ned; endre
    `.sticky-cta` tilsvarende. Løft «Ingen bindingstid – ingenting faktureres i
    pilotfasen» (belagt, `db.js:142`) og «‹usikker› er et fullverdig svar fra AI-en»
    (belagt, `models.py:18, 25`) opp under hero. «Uforpliktende oppstartsmøte» er et
    prosessløfte (§5, unntaket): det blir stående der det står i dag
    (`om-page.html:272`, ved skjemaet, med «Vi svarer innen én virkedag» som avsender),
    ikke løftet opp som belagt.

### «Etter evidens» — med bevisport

| Tiltak | Bevisport (må måles/signeres først) |
|---|---|
| Tall i hero («X min median») | Port 0 baseline hos Ocab + median `minutesToApproved` over ≥10 godkjente saker, med Ocab-samtykke til publisering (`verdens-beste-losning.md:434-438`) |
| «Klar for forsikringsselskapet», «For forsikringsselskap»-seksjon | Port 2: minst én oppdragsgiver har sett en AI-assistert rapport uten å avvise den (`:450-452`); skriftlig tilbakemelding som kan siteres |
| Ocab-navn/logo/sitat, kundesitat om «usikker», før/etter-tider, video av takstperson | Signert pilotavtale med logo-/sitatklausul (krever org.nr., `avklaringer-og-roller.md:11-14`); **ingen kilde i repoet** dokumenterer slikt samtykke i dag |
| Antall «rapporter i pilot» | SQL-uttrekk av godkjente rapporter per tester; publiser først ved tosifret n |
| Kredittmodell i produkt, ROI-kalkulator med forhåndsverdi, break-even-tall | Prisvedtak + COGS-gulv fra 10–20 ekte rapporter (`beslutningsnotat-prising.md:52-55`) + skriftlig betalingsforpliktelse (`founders-playbook-docrai.md:54-58`) + utregningen lagt i repoet |
| USIKKER-flagg og faste valg i appen; kildemerker per utsagn; Byggforsk-visning i app/deling | Port 1 feilanalyse på 20–50 ekte feil (`verdens-beste-losning.md:441-447`); valideringsbatteri ≥ 44/55; utlest forkastningsrate fra `report_generations` (`db.js:175-178`; `taleteknologi-laerdommer.md:159`) |
| Klikk-beacon på CTA-er, `Platform.OS` i handlingslogg | Oppdatert `personvern-page.html:54, 62-64, 84-85` **før** koden (regel 6) |
| Aggregering av `user_actions` per tester: distinkte tokens med `approve-report` per uke, tid fra `tester_tokens.created_at` til første `approve-report`, andel med `upload-*` som også har `generate-google-doc` (fangst → utkast) | Oppdatert `personvern-page.html:85-86` **før** SQL/rute: i dag er formålet uttømmende «feilretting og … hva som er tregt» (verifisert); aktiverings-/traktmåling er nytt formål (regel 6). Samme endring som Platform.OS-raden |
| Tommelsone-flytting, kjellermodus, tastatursnarveier, kohort-UI | Ride-alongs (`avklaringer-og-roller.md:68`, verifisert — uten antall; tallet 3–5 står på `:27` og gjelder navnevalg, ikke ergonomi) og >5 tokens med godkjenning |
| Full axe/WCAG-audit publisert som «AA» | Reproduserbar audit uten kritiske funn; til da ingen AA-påstand |
| Innhold på docrai.io med «7 datalag»/«fem åpne kilder» | Liste de fem/sju kildene navngitt (i dag navngis tre: `om-page.html:279`; `demo-page.html:118-119, 183`) |

### «Ikke» — nei-lista, feil, eller lav verdi

- GA4/Hotjar/Clarity/session replay (bryter publiserte løfter; §6).
- «Under 10 minutter», «75 %», «2–4 timer», «Ocab-kompatibel», «Integrert Byggforsk»,
  bladnummer 528.220, partner-/forsikringslogoer, fabrikkerte sitater.
- Live AI-demo på forsiden (DPA-forbehold, media-eierskap).
- Eksportformat for forsikring / «For forsikringsselskap»-seksjon bygget for å ha noe
  å skrive (nei-lista: egen skinne, `CLAUDE.md:37-41`).
- Setebasert prising (`verdens-beste-losning.md:396-397`); ROI-kalkulator med
  forhåndsutfylt spart tid.
- Engelsk salgsside (`CLAUDE.md:11`; dobler regel 6-vedlikeholdet).
- Skeleton/strømmende rapport (krever strømming gjennom api + motor for en ventetid
  ingen har klaget på); Web Workers; React-port av salgssidene; CDN/AVIF/font-preload
  på sider uten bilder og fonter; `compression` i Express (kanten gjør det).
- Per-avsnitt-godkjenning; Alt+B-panel før Byggforsk-visning og SINTEF-avtale.
- Workshop med empatikart/dot-voting; 7-ukersplanen som helhet; månedlig advisory som
  erstatning for ukentlig kadens; feature flags; A/B med cookies.
- Slettejobb for `sidevisninger` som regel 6-krav (teksten sier «ryddes ikke
  automatisk», `personvern-page.html:120`).
- Å bruke /kundereisen som «eksempelrapport» (pitch, ikke rapportvisning).

---

## 5. Tekstforslag for /om der endringen kan belegges i dag

Alle forslag gjelder `apps/api/src/om-page.html` (og speiles i explainer hvis den
beholdes). «Kan belegges» = kodelinje eller fravær av kode som gjør setningen sann.

**Unntak for prosessløfter (gjelder hele §5, §3.1, §3.3 og §4 pkt 11):** setninger om
hvordan DocrAI selv vil opptre — «uforpliktende oppstartsmøte», «du takker ja eller nei
etter møtet», «etter 5 godkjente rapporter avgjør du selv», «endelig prising settes
sammen med pilotdeltakerne» — har verken kodelinje eller signert avtale bak seg
(ingen selskap kan signere, `avklaringer-og-roller.md:11-14`, verifisert). De merkes
**prosessløfte**, aldri «belagt». De kan stå der de står i dag: i finprint
(`om-page.html:238`) og ved pilotskjemaet (`:272`), der avsenderen er den som
svarer på skjemaet (`:272` «Vi svarer innen én virkedag»; kontaktknappen går til
samme person, `index.js:263-264`). De løftes **ikke** under hero, og de gjentas ikke
på flere flater før en pilotavtale eller et vedtak i `docs/beslutninger.md`
(finnes ikke, §8 pkt 2) gjør dem til noe mer enn intensjon.

**5.1 Stat-raden (`:203-207`) — erstatt de tre ubelagte tallene**

Nåværende: «2–3 timer …», «2 400–4 500 kr …», «990 kr/mnd — … ubegrensede saker».

Forslag:
> **Tid per sak** — appen måler tiden fra første bevis til godkjent rapport, sak for sak.
> **Utkast → godkjent** — korrigerer du AI-utkastet, ser mottakeren hvor mange felt som ble endret.
> **Ingen bindingstid** — ingenting faktureres i pilotfasen.

Begrunnelse/kilde: `metrics.ts:34-45` (tid beregnes per sak); `share-page.html:269-278`
(tellingen rendres bare når `r.draftChangedFields.length > 0`, og bare over de åtte
CONTENT_FIELDS i `share.js:111-114` — ved null korrigeringer ser mottaker ingenting,
derfor «korrigerer du …», ikke «mottakeren ser hvor mange felt du korrigerte»);
«ingen bindingstid / ingenting faktureres»
er belagt ved fravær av kode: det finnes ikke noe fakturagrunnlag (`db.js:142` «ikke
fakturagrunnlag ennå»). Fjernet: **«990 kr/mnd»** — prisnotatet sier eksplisitt
«bekreft gulvet før prisene publiseres på `/om` og `/vilkar`»
(`beslutningsnotat-prising.md:52-55`) og at ingenting er priset i produktet (`:64-65`);
tallet er klassifisert «Hypotese» (`verdens-beste-losning.md:86`). Forbeholdet
«veiledende» redder det ikke: et publisert tall er et publisert tall, og regel 6 krever
kodelinje eller vedtak, ikke forbehold. Tallet kommer tilbake ved prisvedtak (§4
«Etter evidens»). Fjernet også «endelig modell settes med pilotdeltakerne» som stat:
det er en **intensjon**, og eneste kilde var dagens salgssetning (`om-page.html:238`)
— sirkulært belegg. Den kan stå i finprint som prosessløfte, ikke som prisløfte.
Fjernet «ubegrensede saker» (kolliderer med `beslutningsnotat-prising.md:27`), timepris
og kronebeløp (ingen kilde; det eksplisitte spennet ~800–1 500 kr står i
`docs/prising-bruksbasert.md:57`, ikke i beslutningsnotatet).

**5.2 Takstperson-tier (`:221-225`)**

Nåværende «Ubegrensede saker og rapporter» → «Saksunderlag, AI-utkast, godkjenning og
PIN-deling inkludert». Fjern «Én rapport sparer inn måneden» (avledet av ubelagt tid).
Kilde: `beslutningsnotat-prising.md:27, 64-65`; `verdens-beste-losning.md:410-411`.

**5.3 JSON-LD Offer (`:298`)**

`"description": "Pris settes i pilotfasen, uten bindingstid."` — stryk «per takstperson»
(`verdens-beste-losning.md:396-397`) **og** `price`-verdien 990 til prisvedtak
(`beslutningsnotat-prising.md:52-55`); om et Offer uten `price` er gyldig schema.org er
uverifisert — alternativet er å fjerne Offer-blokken. Samme i `faq-page.html:67, 102`.

**5.4 Under hero — én ny linje med det som er belagt og ikke står der i dag**

> «Usikker» er et gyldig svar fra AI-en: den er instruert til å bruke det når
> bevisene ikke bærer en årsak eller en akutt/gradvis-klassifisering.
> Ingen bindingstid – ingenting faktureres i pilotfasen.

Kilde: `ai-engine/models.py:6-11, 22` (enum-dokstrenger: «ALDRI tvinges inn»,
«USIKKER er et fullverdig svar»), `:18, 25` (USIKKER som enum-verdi i begge), `:46-54`
(feltbeskrivelsene: «tving ALDRI frem en kategori», «Bruk USIKKER når de visuelle
tegnene ikke er entydige» står på `:53-54`); `ai-engine/prompt.py:418` (steg 5 i
prompten: «bruk USIKKER når tegnene ikke er entydige»); `db.js:142` (ingen
fakturering). **Ikke** «i DocrAI-skjemaet»: for takstpersonen leses «skjemaet» som
gjennomgangsskjemaet i appen, der Kildekategori og Tidsforløp er fritekst-`TextField`
uten USIKKER-valg (`apps/mobile/app/projects/[id].tsx:2469, 2471, 2494-2503`,
verifisert) — nettopp det §3.5 fører som «mangler / etter evidens». Belegget gjelder
motorens JSON-skjema, så setningen må peke på AI-en, ikke på et skjema. **Ikke**
«uforpliktende oppstartsmøte» her: det er et prosessløfte (unntaket over) og blir
stående ved skjemaet (`om-page.html:272`), ikke under hero. Avsender er DocrAI — ikke
kunde. **Ikke** «AI-en
tvinger aldri frem …»: det er en påstand om modellens atferd, og den er umålt
(resultatark tomt, `docs/valideringscaser.md:254-272`; den ene skarpe pilotsaken var
falsk sikkerhet, ikke USIKKER, `docs/pilotlogg-ocab.md:40-46`). Skjema og instruks kan
belegges med kodelinje; atferd kan bare belegges med måling.

**5.5 Tillitsavsnittet (`:192-195`) — Byggforsk-setningen**

Nåværende «Byggforsk-henvisninger vises kun med verifisert bladnummer» er sann bare
fordi ingenting vises (referansen når verken app, dokument eller delingsside — §1).
Forslag: «Byggforsk-henvisninger AI-en foreslår, kontrolleres mot en liste over
verifiserte bladnummer før de tas med i analysen — uverifiserte forkastes.» Kilde:
`main.py:318-348`; `byggforsk_index.py:119-136`. **Ikke** «før de får stå»: det leses
som «står i rapporten», og referansen når i dag verken app (`reportVersions.ts:18-28`),
Google-dokument (`main.py:571-587`) eller delingsside (`share.js:110-113`) — §1.
Tryggest er å vente med hele setningen til `technical_reference` vises i app/dokument
(§4 «Etter evidens»); tas den inn nå, må hero-setningen nedtones i samme endring. Hero-setningen «… og
Byggforsk-henvisninger» (`:150-151`) bør nedtones til «kontrollerte
Byggforsk-referanser» eller vente på visning i produktet (etter evidens).

**5.6 FAQ «Hvordan mottar forsikringsselskapet rapporten?» (`faq-page.html:79-83`)**

Legg til: «AI-utkastet fra siste generering lagres uendret ved siden av den godkjente
versjonen; genereres rapporten på nytt, erstattes utkastet og stempelet faller.
Korrigerer takstpersonen utkastet, ser mottakeren hvor mange felt som ble endret
før godkjenning. Promptversjonen bokføres per rapportgenerering.» Kilde:
`reportVersions.ts:1-4`; `types.ts:104-108` («Ny generering nullstiller stempelet»);
`[id].tsx:1630-1638` og `reportService.js:334-338` (`reportDraft` overskrives ved ny
generering — utkastet er uforanderlig for redigering, ikke bevart på tvers av
genereringer); `share.js:132-137`; `share-page.html:269-278` (telling bare ved ≥1
endret felt); `db.js:175-178`. **Ikke** «arkiveres uendret» uten «siste generering»:
det leses som permanent revisjonsspor mot forsikring, mens koden bare bevarer siste
utkast — appens egen tekst «AI-utkast · … — arkiveres uendret» (`nb.ts:197`,
verifisert) har samme uklarhet og bør rettes i samme endring. **Ikke** «per rapport»: `report_generations`
har én rad per genereringsforsøk (`attempt_id`, `status` processing/success/error,
`db.js:160-171`) — en rapport som genereres på nytt får ny rad. **Ikke** «hvilke felt» (rendres ikke). Merk at `:80-81` sier
mottaker ser «klassifisering» — uverifisert mot rendringen (`share-page.html:254-262`
viser ikke `acuteOrGradual`); vurder å stryke ordet.

**5.7 Formuleringer fra analysene som IKKE kan brukes ennå, og hva som må til**

| Formulering | Hva som må til |
|---|---|
| «på under 10 minutter», «75 % tidsbesparelse», «2–4 timer» | Port 0-baseline + målt median over ≥10 saker + Ocab-samtykke |
| «Rapporten er klar for forsikringsselskapet», «forsikringsklar» | Port 2 (én oppdragsgiver har behandlet en rapport uten avvisning) |
| «Ocab-kompatibel», Ocab-logo, «utvikles sammen med Ocab AS» | Signert avtale med navne-/logoklausul; til da: fjern/avklar `explainer/index.html:286` |
| «Integrert Byggforsk», «direkte siteringer fra Byggforsk» | SINTEF-avtale + visning i produkt; aldri sitattekst uten lisens |
| «Byggforsk: 528.220» | Bruk aldri; nummeret finnes ikke i indeksen |
| «Du beholder 100 % kontroll» | Tom presisjon — «Ingenting deles uten stempelet ditt» er mer presis og allerede belagt |
| «WCAG 2.2 AA» | Reproduserbar audit uten kritiske funn |
| «Testet med hansker i felt», kundesitat om «usikker» | Dokumentert feltobservasjon / sitat med samtykke |
| «Bygget for hvordan vi faktisk jobber ute på skadesteder» (A §7) | Ordrett utsagn fra øvingssak-test (`ovingssak-og-prototyping.md:213-229`) eller ride-along (`:149`) med samtykke; ingen kilde i repoet i dag |
| «Rapporter generert i pilot: N» | SQL-uttrekk, tosifret n, Ocab-samtykke |
| «Kapillært oppsug» som AI-utkast-eksempel | Én dokumentert kjøring (valideringscase 61 eller ekte sak) som faktisk produserte det |

---

## 6. Måleplan som respekterer personvernsiden og CSP

**Rammen:** Det finnes ingen CSP (`index.js:30-33`: «CSP holdes utenfor her fordi de
statiske HTML-sidene bruker inline-script»). Det som stopper tredjeparter er teksten:
`personvern-page.html:54` (ingen cookies, ingen tredjeparts sporing, ikke noe
samtykkebanner), `:55` (IP aldri til database; besøkstelling = side, tidspunkt,
kampanjekode), `:62-65` (ingen enhetsidentifikator, ingen fingeravtrykk, «bevisst valg
i stedet for Google Analytics»), `:84-85` (handlingsloggen: handling, varighet,
enhets-ID, tilgangskode), `:120` (besøksstatistikk ryddes ikke automatisk),
`faq-page.html:100`, `kontakt-page.html:9, 90`, `db.js:129-131`.

**Hva vi måler i dag (alt verifisert):**
- Sidevisninger: `POST /api/besok` med `sti` (allowlist på sju stier) + `kilde` fra
  `?k=` (`publikum.js:110-125`), tabell uten IP (`db.js:132-138`), 120/15 min per IP i
  minne. Sendes fra `/om`, `/demo`, `/faq`, `/kontakt`, `/personvern`, `/vilkar`,
  `/takk`. Ikke fra `/kundereisen`, 404, `/share`, og ikke fra explainer/docrai.io.
- Pilotinteresse: navn, e-post, melding (`db.js:121-127`).
- Handlingslogg: `user_actions` (`db.js:94-103`) med bl.a. `approve-report`
  (`[id].tsx:1941`), `generate-google-doc` (`[id].tsx:1611`, verifisert),
  `upload-<kind>` per medieopplasting (`apps/mobile/src/sync/projectSync.ts:389`,
  verifisert), `create-share` (linje uverifisert her). **Formålet er publisert
  uttømmende:** «Begge brukes bare til feilretting og til å se hva som er tregt»
  (`personvern-page.html:85-86`, verifisert) — all aggregering per tester utover
  det er nytt formål.
- Rapportgenereringer med `prompt_version` og sitattelling (`db.js:158-178`).
- Tid-til-godkjent per sak, kun klientside (`metrics.ts:34-45`).
- Serverlogg uten UA/IP/referer (`apps/api/src/middleware/requestLogger.js:19-48`,
  uverifisert her).
- **Utlesing: ingen** for sidevisninger/pilot_interesse (`admin.js`: 0 treff).

**Målinger fra analyse B Phase 0 som bevisst ikke er med:** scroll depth, demo-/
video-completion, form abandonment og session depth krever klienthendelser og en
sesjonsidentitet som `personvern-page.html:54` («ingen cookies … ingen tredjeparts
sporing») og `:62-65` («ingen enhetsidentifikator, ingen fingeravtrykk») utelukker.
Eneste cookiefrie proxy for skjemafullføring er `pilot_interesse`-rader mot
`/om`-visninger (`db.js:121-127` mot `:132-138`). Organic/paid CTR forutsetter
annonsekontoer eller Search Console, som ikke finnes i repoet (uverifisert utenfor
repoet). Disse er droppet, ikke oversett.

**Hva som kan legges til uten samtykkebanner og uten tekstendring:**
- `/kundereisen` og `/eksempelrapport` i `TELLBARE_STIER` + beacon (samme datakategori).
- Admin-rute som aggregerer det som allerede samles **og** er formålsdekket:
  sidevisninger per sti/kilde/uke (`personvern-page.html:54-55, 62-65`) og
  pilot_interesse per uke (`:70-73`). Ikke handlingsloggen — se under.
- Sekvensiell budskapstest via ulike `?k=`-koder uke for uke
  (`kampanje-takstpersoner.md:104-107`) — ingen cookie, ingen variant-lagring.
- Lighthouse/WebPageTest kjørt utenfra (ingen script på siden); CrUX-oppslag (krever
  trafikk; uverifisert om domenet har nok).
- Stat i `report_generations`: forkastningsrate for Byggforsk-referanser (én SQL,
  `taleteknologi-laerdommer.md:126-136`).

**Hva som krever tekstendring først (regel 6), men ikke samtykke:**
- Klikk-beacon på CTA-er: ny datakategori («interaksjon på siden»); oppdater
  `personvern-page.html:54-55, 62-64` i samme endring.
- `Platform.OS` i handlingsloggen: oppdater `:84-85`.
- Aggregering av `user_actions` per tester (trakt/aktivering): distinkte
  tester_token med `approve-report` per uke; tid fra `tester_tokens.created_at`
  (`db.js:54`) til første `approve-report`; **fangst → utkast** (B Phase 0
  «% completing first capture → draft», B Phase 1 «visible system status» som
  måling): andel tester_token med minst én `upload-*` (`projectSync.ts:389`) som
  også har `generate-google-doc` (`[id].tsx:1611`) samme uke. Dataene finnes og er
  cookiefrie, men `:85-86` avgrenser formålet til «feilretting og … hva som er
  tregt»; oppdater setningen til også å nevne aggregert bruksstatistikk uten
  personidentifisering **i samme endring** som SQL-en/ruta. Verdi: intern, ikke UI
  før >5 tokens.
- Selvhostet, cookiefritt analyseverktøy (f.eks. med hashet IP): bryter «ingen
  fingeravtrykk … ingen IP i statistikken» (`:62-65`) — krever både tekst og
  vurdering; ikke aktuelt før trafikken overstiger det sidevisninger-tabellen svarer på.

**Hva GA4/Hotjar/Clarity ville kreve:**
1. Omskriving av minst sju publiserte setninger (`personvern-page.html:9, 12, 54, 55,
   62-65`; `faq-page.html:100`; `kontakt-page.html:9, 90`) og `db.js:129-131`.
2. Samtykkebanner med reell avvisning og ingen lasting før samtykke — siden lover i dag
   eksplisitt at det ikke finnes (`:54`).
3. Databehandleravtale/standardkontrakter med leverandøren; for GA4 en ny
   Google-behandling oppå en uavklart (`personvern-page.html:57`; Schrems II-punktet i
   `fagkart-lansering.md:48-52`).
4. Ved fremtidig CSP: allowlisting av tredjepartsdomener; dagens inline-skript
   (`om-page.html:289-306`) trenger uansett nonce/hash.
5. Verdi: med en trakt planlagt til ~120 kontakter over 8–10 uker
   (`kampanje-takstpersoner.md:37-44`) gir heatmaps og session replay støy, og
   «cookiefri» er et tillitssignal mot en målgruppe som skal legge skadedata i tjenesten.

---

## 7. Felt-ergonomi og AI-gjennomgang i appen

Nettsiden kan bare love det appen gjør. Her er hva analysene sier om app.docrai.io,
mot det som finnes (alle linjer verifisert der ikke annet er sagt).

| Analysene sier | Finnes | Hva nettsiden kan love |
|---|---|---|
| Berøringsflater ≥ 48 px | Fangst (Lydnotat/Bilde/Video) 56 px (`[id].tsx:3105, 3121, 3129`), «Lagre notat» (`:3146`), «Lag rapport» (`:2382`), «Godkjenn» (`:2551`), «Se rapport» (`:3375`); standardknapper uten minHeight (`Buttons.tsx:58-66, 102-108`), IconButton 42 (`:138-143`), romchips 36 (`[id].tsx:3164`) | «Store knapper laget for våte hansker» (`om-page.html:172`) — belagt for fangstknappene. **Ikke** «testet med hansker» |
| Sticky primær i tommelsonen | «Se rapport» fast i bunn (`:3369-3380`); fangstknappene fast øverst (`:3283-3287`, B13 `:3099`) | Ingenting om tommelsone |
| Avstand ≥ 8 px mellom flater | `gap: theme.spacing.sm` = 10 mellom fangstknappene (`[id].tsx:3101`; `theme.tsx:61`) | Ingen påstand nødvendig — oppfylt |
| Få valg per skjerm / kognitiv avlastning | Notat-fanen: romstripe + tre fangstknapper + notater + «Se rapport» (`[id].tsx:3283-3287, 3369-3380`); rapport-fanen: mange kort (`:2362-2384, 2401-2447, 2540-2611`). Eneste feltfunn: «Lagre-knapp … glemmes 10/10» → autolagring (`pilotlogg-ocab.md:127-128`) | Ingenting om «enkelt grensesnitt» før ride-along; «store knapper» (`om-page.html:172`) er nok |
| Lokal lagring + bekreftelse ved nettbrudd | Lokal-først (`[id].tsx:466-475`); synk-pille «Venter på nett — lagret lokalt» (`nb.ts:44`); toaster nettnøytrale (`nb.ts:126-129`); rapportgenerering krever nett (`[id].tsx:1534`) | «Alt lagres lokalt først – appen virker uten dekning i kjelleren» (`om-page.html:183`) — belagt for lagring. FAQ-utfallet «Du mister ikke en befaring» (`faq-page.html:74-75`) er hypotese: null datatap er et mål, ikke oppnådd (`avklaringer-og-roller.md:16-21`), og pilotloggen har én synk-nekt (`pilotlogg-ocab.md:124-125`). Vurder å avgrense |
| Mørk modus / kontrast | Automatisk etter OS (`theme.tsx:97-100`); **PrimaryButton hvit på `#8FC2CB` = 1,95:1** (`Buttons.tsx:89, 93`; `theme.tsx:80`) — under AA | Ingenting om mørk modus før fiks |
| Synlig systemstatus under generering | Overlay med fire tidsstyrte steg (`nb.ts:148-153`; timere i `ReportGeneratingOverlay.tsx:25-30, 213-220`, uverifisert her) — ikke serverprogresjon; ingen avbryt | «Ett trykk, så skrives AI-utkastet mens du kjører» (`om-page.html:184`, steg 3; `:183` er steg 2 om lokal lagring) — sirkulært belagt; klienten holder én forespørsel (`[id].tsx:1534`). Tryggere: «AI-utkastet skrives på serveren; du kontrollerer og stempler» |
| Usikkerhetsflagg «Krever bekreftelse» | Mangler: USIKKER vises som ren tekst (`[id].tsx:2469, 2471`; `reportVersions.ts:21, 23`); ingen konfidenspoeng (`types.ts:58-76`); delingssiden viser ikke feltene (`share-page.html:254-262`) | «‹Usikker› er et fullverdig svar» — belagt i motor (`models.py:6-25`) som prinsipp; **ikke** «lav konfidens flagges» |
| Konsistent terminologi | Nesten: «AI-utkast — ikke godkjent» (`nb.ts:179`), «Godkjenn rapport» (`:182`); «KI-en» i `ReportGeneratingOverlay.tsx:263` og `app/(tabs)/explore.tsx:167, 186`, «KI-forespørsler» i `nb.ts:23`; hardkodede «Kildekategori»/«Tidsforløp» (`[id].tsx:2469, 2471`) | Ingen påstand nødvendig; rydd internt |
| Tastatursnarveier, per-felt-godkjenning, Alt+B | Finnes ikke (grep 0; ett stempel `[id].tsx:1927-1943`; Byggforsk ikke mappet `reportVersions.ts:18-28`) | Ingenting |
| Godkjenning, angre, checkmark | Ett stempel med navn+tid (`types.ts:104-113`); success-toast (`[id].tsx:1942`, `nb.ts:186`); redigering nullstiller stempel (`[id].tsx:1905-1922`, `nb.ts:205`); deling nektes klient + server 409 (`[id].tsx:1979-1996`; `share.js:172-180`) | Alt dette er belagt og står allerede (`om-page.html:189-195`; `faq-page.html:47-53`) |
| Progressiv avdekking av eksport | PDF/Word tilgjengelig før godkjenning (`[id].tsx:2401-2434`), advarsel kun etter redigering (`:2439-2447`), serverrute uten godkjenningssjekk (`index.js:743-775`) | Ikke lov «ingenting forlater appen før stempel» før dette er rettet — dagens løfte gjelder *deling* (`om-page.html:192-193`) og er presist |
| Byggforsk i app | Kun huskeliste-hint (`nb.ts:262-263`); referanse fra motor (`models.py:39`) mappes ikke inn; ikke i Google-dokumentet (`main.py:571-587`); ikke i deling (`share.js:110-113`) | Se §5.5 |

**Nå-tiltak i appen som ikke krever nye påstander:** minHeight 48 standard;
kontrastfiks dark mode; toast «Lagret på enheten» ved offline + `MediaUploadErrorBanner`
i prosjektskjermen; PDF/Word deaktivert før stempel; ett ordforråd i `nb.ts`; rett
`lang` på webeksporten (app.docrai.io sender `lang="en"`, live-måling).

**Etter evidens:** USIKKER-flagg/faste valg (Port 1 feilanalyse), Byggforsk-visning
(mapp `technical_reference` → vis nummer + tittel), tommelsone (ride-along),
tastatursnarveier (andel gjennomganger på web, som først krever personverntekst for
plattformlogging).

---

## 8. Prosess: hva gir mest per time for én gründer i pilot

Rangert etter evidens per time, koblet til bevisportene i
`docs/verdens-beste-losning.md:434-452`:

1. **Kjør valideringsbatteriet (Port 1-krav).** 11 caser, 5 sjekkpunkter, terskel 44
   (`valideringscaser.md:16-19, 254-272`). Kan gjøres alene på dagens prompt; krever bare
   Gemini-kvote (`:10-11`). Rett «50 totalt» → 55 først (`:18`). Dette avgjør hva som
   i det hele tatt skal bygges i gjennomgangen — og gir forkastningsraten for
   Byggforsk-referanser (`taleteknologi-laerdommer.md:126-136`).
2. **Gjenoppta pilotloggen med tall, ukentlig.** Siste innførsel 25.08 (fil), siste
   commit 26.08 (git). De tre KPI-ene fra `avklaringer-og-roller.md:80-83`: saker
   gjennom flyten / median tid-til-godkjent / feltendringer per rapport. Opprett
   `docs/beslutninger.md` (`:84-85`, finnes ikke). Kostnad: 30 min/uke.
3. **Port 0-baseline i stedet for generiske intervjuer.** Slå sammen
   øvingssak-testplanen (`ovingssak-og-prototyping.md:213-229`: Sigurd, Lars Erik, én
   ukjent ingeniør; tenk høyt; SEQ) med baseline-spørsmålene (rapporttid i dag,
   tilbakesending fra forsikring, `verdens-beste-losning.md:437-438`). Én time per
   person, tre personer, gir både usability-data og de første baselinetallene.
   Analyse A §7 sitt kvalitative kriterium — at takstpersoner sier grensesnittet er
   «bygget for hvordan vi faktisk jobber ute på skadesteder» — er det eneste
   målekriteriet i A som kan belegges med brukerutsagn, og SEQ-spørsmålet + «hva var
   uklart?» i testplanen (`ovingssak-og-prototyping.md:217-219`) er stedet å samle
   det, med eksplisitt samtykke til sitat. Til da: ingen kilde finnes.
   Utvid til 5–8 når A-lista (`kampanje-takstpersoner.md:176-184`) gir svar. Samtykke
   til opptak avklares eksplisitt (WER-samtykket i `taleteknologi-laerdommer.md:156`
   dekker ikke intervjuer).
4. **Én ride-along med firelinse-matrisen** (`ovingssak-og-prototyping.md:149`) og én
   co-design-økt med rød penn på utskrevet rapportutkast (`:151`). Erstatter
   workshopen i analyse C. Gir brukerreisekart fra felt og svarer på tommelsone,
   hansker og mørke — det pilotloggen i dag tier om. Ride-along-arket (`:149`, ett ark
   per rom) er også stedet et «bygget for hvordan vi jobber»-utsagn (A §7) kan
   noteres ordrett, med samtykke.
5. **Port 2-test i oktober** (`verdens-beste-losning.md:419`): én oppdragsgiver via
   Ocab ser en godkjent rapport; be om kort skriftlig tilbakemelding. Det er den
   eneste veien til «klar for forsikringsselskapet».
6. **Re-audit knyttet til portene, ikke kalenderen:** UU/heuristikk før Port 1
   (gjennomgangen er «der vi vinner eller taper», `:283`); konkurrentsjekk november med
   CliVa-rettelsen først. Kvartalsvis kalender for én person er overhead uten
   mottaker.
7. **Ikke:** 7-ukersplanen, månedlig advisory board, workshop med dot-voting,
   heatmaps. De bryter enten publiserte løfter, regel 6 eller 50/50-regelen
   (`avklaringer-og-roller.md:46-49`), og genererer funksjonsidéer nei-lista er laget
   mot (`CLAUDE.md:37-41`).

Én gründer i pilot bør bruke maks halvparten av tiden på bygging (50/50-regelen).
«Nå»-lista i §4 er dimensjonert som 2–3 dagers kodearbeid totalt; resten av innsatsen
hører til punkt 1–5 over.

---

## 9. Kilder

**Repo (alle åpnet i denne økten der linje er oppgitt):**
- `CLAUDE.md:9-11, 26-33, 37-41, 58-68`
- `apps/api/src/om-page.html:8-9, 131, 134-138, 144-166, 169-175, 180-186, 189-197, 200-207, 209-238, 242-257, 258-273, 276-279, 284-287, 289-306`
- `apps/api/src/demo-page.html:26-34, 52-56, 64, 74, 92-100, 104, 109-120, 183-185, 205`
- `apps/api/src/faq-page.html:47-53, 57-61, 65-68, 72-75, 79-83, 100-104`
- `apps/api/src/kontakt-page.html:9, 52-54, 83-84, 90-91`
- `apps/api/src/personvern-page.html:9, 47-49, 52-59, 61-65, 70-73, 84-91, 93-95, 102-109, 117-121`
- `apps/api/src/vilkar-page.html:54-62, 73-76`
- `apps/api/src/takk-page.html:29`; `apps/api/src/404-page.html:27`
- `apps/api/src/share-page.html:6-7, 80, 91-100, 103-136, 254-280, 294-309`
- `apps/api/src/index.js:25, 30-33, 41-45, 47-64, 66-74, 201-208, 213-236, 241-243, 248-252, 258-277 (/kontakt-handler), 263-264, 280-290 (282-284 /takk via sendFile), 339-353, 420-434, 732-775`
- `apps/api/src/reportService.js:330-340`; `apps/mobile/src/sync/projectSync.ts:385-392`
- `apps/api/src/publicBase.js:14-17, 56-60, 100-121`
- `apps/api/src/routes/publikum.js:49-56, 79-105, 107-125`
- `apps/api/src/routes/share.js:44, 87-95, 100-138, 172-180, 186-190, 303-307, 336-339, 362`
- `apps/api/src/routes/admin.js` (590 linjer; grep sidevisninger/pilot_interesse: 0)
- `apps/api/src/db.js:49-55, 94-103, 107-127, 129-138, 142, 158-178`
- `apps/api/package.json:17-24`; `.github/workflows/ci.yml:13-77`; `apps/api/test/e2e-headere.sh:1-3, 36-44, 133-165`
- `ai-engine/byggforsk_index.py:1-14, 19-23, 42, 95-109, 119-136` (33 oppføringer telt)
- `ai-engine/main.py:302-306, 318-348, 571-587`; `ai-engine/models.py:6-25, 28-60`
- `apps/mobile/src/ui/Buttons.tsx:58-66, 85-95, 102-108, 138-143`; `apps/mobile/src/ui/theme.tsx:51, 54-56, 61, 71-82, 97-100`
- `apps/mobile/src/features/projects/reportVersions.ts:1-4, 14-42`; `metrics.ts:31-47`; `types.ts:58-90, 104-113`
- `apps/mobile/src/features/projects/ReportGeneratingOverlay.tsx:263`; `apps/mobile/app/(tabs)/explore.tsx:167, 186`
- `apps/mobile/src/i18n/nb.ts:23, 44, 126-129, 145, 148-153, 167-174, 179-182, 186-188, 197, 205, 262-263, 290-292`
- `apps/mobile/app/projects/[id].tsx:466-475, 1534, 1608-1614, 1628-1640, 1905-1922, 1927-1943, 1979-1996, 2311, 2382, 2401-2447, 2466-2505, 2551, 3099-3101, 3105, 3121, 3129, 3146, 3164, 3283-3287, 3369-3380, 3398`
- `explainer/index.html:2, 6-8, 23-31, 33-34, 206-222, 250-268, 284-292, 299-302`; `explainer/README.md:1-30`; commit `3449189`
- `presentation/kundereisen.html:125-127, 185, 233-237, 241-269, 246, 256, 316, 321-338, 374-380, 402, 417-418, 456-457, 470-483, 498, 513-522, 549, 584-589`
- `presentation/ovingssak.html:4-5, 230-231, 270, 555-584, 729-737`
- `docs/konkurrentanalyse.md:48-49, 156-163`; `docs/konkurrent-selskapsanalyse.md:18, 32, 56-58`; `docs/erfaringer-konkurrenter.md:189` (alle åpnet i denne revisjonen)
- `presentation/agent-readiness.html:591-592`
- `docs/verdens-beste-losning.md:1-120, 281-285, 305-309, 380, 392-401, 408-412, 417-421, 424-427, 430-464, 508-512`
- `docs/avklaringer-og-roller.md:11-21, 27-31, 46-49, 64-71, 80-86`
- `docs/beslutningsnotat-prising.md:8-12, 25-30, 43, 52-55, 62-65`; `docs/prising-bruksbasert.md:55-58, 190` (timepris ~800–1 500 kr på `:57`)
- `ai-engine/prompt.py:418`; `apps/api/src/faq-page.html:42`, `personvern-page.html:45`, `vilkar-page.html:45` (brødsmulesti); `docs/fagkart-lansering.md:59`
- `docs/valideringscaser.md:10-11, 16-19, 254-272`
- `docs/pilotlogg-ocab.md:1-6, 33-46, 60-62, 79-86, 92-99, 101-104, 119-128` (git: siste commit 2026-08-26)
- `docs/sikkerhetsrevisjon-aug-2026.md:34, 78-86, 97-102` (108 linjer)
- `docs/statusrapport-aug-2026.md:33-34, 45, 56-58, 112, 129-132`; `docs/inkorporering.md:39-41, 57-60, 76, 160-169`
- `docs/fagkart-lansering.md:48-52, 58-63, 90, 108-111, 124-131, 139`; `docs/taleteknologi-laerdommer.md:65, 126-136, 154-161`
- `docs/byggforsk-integrasjon.md:7-20, 23-31`; `docs/byggepraksis-2026.md:37-49, 105-107`
- `docs/ovingssak-og-prototyping.md:97-114, 133, 149-151, 172-179, 203-231`
- `docs/kampanje-takstpersoner.md:30-44, 87-88, 104-107, 176-191`; `docs/founders-playbook-docrai.md:17-27, 47-58, 67-73`
- `docs/beslutninger.md` — finnes ikke (ls)
- `docs/nettside-eksterne-analyser-2026-09.md` (analyse A, B, C)

**Live-målinger 28.09.2026 (`curl` via proxy):** `https://docrai.io/` 200,
`content-encoding: br`, `server: cloudflare`, kropp byte-identisk med
`explainer/index.html`, 2 treff på `fonts.googleapis`; `https://docrai.io/om` og
`/sitemap.xml` 404; `https://app.docrai.io/` 200, `<html lang="en">`;
`https://janitorai-backend.onrender.com/om` 200, `x-powered-by: Express`, ingen
`cache-control`, `cf-cache-status: DYNAMIC`; ingen `strict-transport-security` fra
noen av vertene.

**Oppgitt av temavurderinger/korreksjoner, ikke åpnet av meg (merket uverifisert i
teksten):** `ai-engine/prompt.py:63-68`, `apps/mobile/src/features/projects/ReportGeneratingOverlay.tsx`,
`apps/api/src/middleware/requestLogger.js`, `presentation/fargealternativer.html:96`,
`presentation/ui-total.html`, `presentation/losningsskisse.html`, `docs/DEPLOYMENT.md`,
`docs/RENDER_SETUP.md`, ordtellinger.

**Revisjonsnotat (28.09.2026):** kritikkens punkt om `om-page.html:183` for «mens du
kjører» gjaldt bare §7 — §1-raden «Ingen mobile-first field-use narrative» siterer
`:183` for lokal lagring, som er riktig (steg 2), og er ikke endret.

**Revisjonsnotat 2 (28.09.2026):** seks feil rettet etter ny kritikk, alle
kontrollert mot fila før retting: (1) handlingslogg-aggregering flyttet fra «Nå» til
«etter tekstendring» (`personvern-page.html:85-86` avgrenser formålet); (2)
prosessløfte-unntak dokumentert i §5, «uforpliktende oppstartsmøte» ikke lenger
«belagt»; (3) §5.4 «i DocrAI-skjemaet» → «fra AI-en» (`[id].tsx:2469-2503` har
fritekst uten USIKKER-valg); (4) mottaker-tellingen forbeholdt ≥1 endret felt
(`share-page.html:269-278`); (5) «3–5 ride-alongs» rettet — `avklaringer-og-roller.md:68`
har ikke tallet; (6) «Øvingsveien 12» plassert på `ovingssak.html:270`. Kritikkens
bemerkning om `share.js:110-113` for CONTENT_FIELDS: arrayen står på `:111-114`
(`:110` er kommentarlinje) — ubetydelig, rettet i §5.1.

**Eksterne standarder (kun der jeg er sikker):**
- WCAG 2.2 AA: kontrast ≥ 4,5:1 for normal tekst (1.4.3), ≥ 3:1 for stor tekst og
  UI-komponenter (1.4.11); synlig fokus (2.4.7); tilgjengelig navn på skjemafelt
  (1.3.1/4.1.2); statusmeldinger (4.1.3).
- Core Web Vitals «good»-terskler: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
  Analyse A's LCP < 2,0 s og INP < 150 ms er strengere enn Googles terskler.
- Kontrastformel: WCAG relativ luminans (sRGB), regnet ut på nytt ved sammenstilling
  28.09.2026: hvit på `#8FC2CB` = **1,95:1** (under AA); `#11181B` på `#8FC2CB` =
  9,18:1 (foreslått fiks); lys modus `--muted #566670` på `--paper #FFFFFF` = 5,95:1
  og mørk modus `--muted #9AA8AE` på `--paper #1A2327` = 6,54:1 (begge over AA).
