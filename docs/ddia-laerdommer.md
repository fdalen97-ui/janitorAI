# DDIA-gjennomgang: hva «Designing Data-Intensive Applications» lærer oss om DocrAI

27. august 2026. Hele Martin Kleppmanns bok (kap. 1–11) er lest opp mot den
faktiske kodebasen. Metode: seks uavhengige analysepass (synk/replikering,
datamodell/skjemaevolusjon, media-pipeline, avledede data, transaksjoner,
pålitelighet/drift), hver med krav om fil:linje-belegg for enhver påstand om
nå-tilstand, etterfulgt av en adversariell kritiker som stikkprøvet de mest
bærende påstandene mot koden. Alle stikkprøver holdt. De viktigste funnene er
i tillegg verifisert manuelt en gang til før dette dokumentet ble skrevet.

**Skaladisiplin først:** DDIA handler mye om systemer med millioner av
brukere. DocrAI er en pilot med en håndfull. Bokas verdi her er *begrepene* —
idempotens, system of record vs avledede data, skjemaevolusjon,
read-your-writes, partiell svikt — ikke maskineriet (Kafka, partisjonering,
konsensus). Hvert tiltak under er vurdert mot spørsmålet «betyr dette noe for
5–50 pilotbrukere, og kan et 2–3-personers team gjøre det på timer/dager?»
Det som ikke består den testen, står eksplisitt i «ikke bygg»-lista til slutt.

## Hovedbildet

Arkitekturen er, målt mot boka, **grunnleggende sunn**: riktig skille mellom
system of record (prosjekt-JSONB i Postgres) og avledede data (Google-dokumentet),
en atomisk betinget upsert som konfliktvakt, per-notat-fletting med tombstones
på klienten, og en to-fase søppelrydding for media. Mye av det boka bruker
kapitler på å motivere er allerede implementert i miniatyr.

Gapene er tilsvarende konkrete og små — men to av dem treffer selve
kjerneløftet:

1. **Transkribering fra appen har aldri virket** (kontraktsbrudd app↔server —
   alltid HTTP 400 før Gemini).
2. **Den godkjente rapporten er ikke et uforanderlig artefakt** — en aktiv
   delingslenke serverer alltid prosjektets *nåværende* innhold, uten ny
   godkjenningssjekk.

Begge er timers arbeid å fikse.

## Del 1 — Det som allerede er DDIA-riktig (bevar dette)

Boka er like nyttig til å *bekrefte* design som til å kritisere. Disse
mønstrene i koden er riktige og bør bevares bevisst ved fremtidige endringer:

- **Per-notat-fletting med tombstones** (`projectSync.ts:947-1028`): union av
  notater fra begge sider, nyeste vinner per notat, deterministisk tie-break
  på logisk innhold ved eksakt tidslikhet, og slettinger som tombstones med
  siste-sletting-vinner. Prosjektslettinger skrives til en lokal
  `pendingDeletes`-kø *før* nettverkskallet og replayes før hver pull, så en
  pull aldri gjenoppliver et slettet prosjekt. Dette er kap. 5s
  «behold begge sider og flett» implementert der det faktisk gjør vondt —
  uten CRDT-maskineri.
- **Atomisk betinget upsert på serveren** (`projects.js:107-116`): én setning
  med `WHERE projects.updated_at <= EXCLUDED.updated_at AND tester_token = …`
  lar databasen håndheve både LWW-regelen og tenant-isolasjonen atomisk.
  Nøyaktig det kap. 7 anbefaler i stedet for les-endre-skriv i applikasjonen.
- **JSONB-dokumentmodellen passer arbeidsmengden** (kap. 2): befaringen er et
  tre med sterk lese-/skrivelokalitet, ingen mange-til-mange-relasjoner i
  dokumentet, og relasjonelle behov (shares, media, logger) er skilt ut i
  egne tabeller. Ikke normaliser prosjektet til rader — det gir joins uten
  gevinst på denne skalaen.
- **To-fase orphan-sweep for media** (`mediaCleanup.js:78-120`): merk først
  (`unreferenced_at`), slett etter 72 timers frist, med defensiv re-sjekk ved
  sletting. Trygg GC av avledet tilstand etter kap. 11-mønsteret.
- **Share-id/PIN-generering**: CSPRNG med databasens primærnøkkel som siste
  skanse for unikhet — ingen check-then-act-løkker. Riktig.
- **Timeout-disiplin på Node-siden**: `fetchWithTimeout` med AbortController
  brukes gjennomgående på utgående kall. Restgapet er Google-API-kallene i
  AI-motoren (se del 3).
- **Idempotent boot-migrering** (`db.js` — `CREATE TABLE IF NOT EXISTS` /
  `ADD COLUMN IF NOT EXISTS`): null migrasjonsverktøy er riktig valg for én
  database og 2–3 personer. Grensene (nye kolonner må også inn i
  ALTER-lista; bare additive endringer) bør stå som kommentar over
  `SCHEMA_SQL`.

## Del 2 — Topp 5 tiltak, i prioritert rekkefølge

Rangert etter konsekvens × sannsynlighet ÷ kostnad, med pilotens tillit som
øverste hensyn. Alle er små-til-middels, lokale endringer.

### 1. Transkriberingskontrakten app↔server er brutt — alltid 400

**Funn (kap. 4 — kontraktskompatibilitet):** Appens to transkriberingskall
sender JSON `{audioUri}` med `Content-Type: application/json`
(`app/projects/[id].tsx:826-834` og `:890-898`). Serveren krever multipart
(`upload.single("file")`, `index.js:365`) og svarer 400 «No file uploaded»
når `req.file` mangler. Git-historikken viser at kontrakten **aldri** har
vært samstemt — begge sider kom inn i samme commit med hver sin forståelse.
Requesten når aldri Gemini. Dette omskriver også pilotfunnet fra Sigurds
kveldstest: Gemini-kvoteproblemet var reelt (curl-testen med multipart nådde
Gemini), men appens eget kall dør før det — to uavhengige feil med samme
symptom.

**Tiltak:** Send lydbytene som `FormData` slik `autoDescribePhoto` allerede
gjør — eller bedre: send `audioRemoteId` og la serveren lese fila fra sitt
eget medielager. Nøkles transkriptet på medie-id får vi samtidig naturlig
idempotens og caching mot dobbel Gemini-fakturering ved retry (kap. 11).
*Innsats: liten. Verdi: et dødt kjerneverdiløfte gjenopplives.*

### 2. Den godkjente rapporten er ikke uforanderlig — delingslenken serverer live-innhold

**Funn (kap. 7 invariantbevaring + kap. 11 avledede visninger):**
Godkjenningsporten sjekkes kun når delingslenken *opprettes*
(`share.js:139-…`). `GET /api/share/:id/report` (`share.js:276-297`)
re-sjekker aldri godkjenning og leser prosjektets *nåværende* innhold, med
`reportFinal`-fallback til `reportDraft`. Klienten nullstiller
`reportApproval` ved redigering og overskriver `reportFinal` ved
regenerering — så en mottaker med aktiv lenke kan se innhold takstpersonen
aldri har godkjent, inkludert et ferskt, ukontrollert AI-utkast. Invarianten
«AI-utkast når aldri en mottaker» holdes i ett øyeblikk, ikke over lenkens
levetid. (Funnet uavhengig av to analysepass.)

**Tiltak i to trinn:** (a) Nå: hent `data->'reportApproval'->>'approvedAt'`
i samme spørring som allerede leser prosjektet, og returner 410 («Rapporten
er ikke lenger godkjent») når den mangler — tre linjer. (b) Oppfølging:
frys rapporten som snapshot i en JSONB-kolonne på `shares`-raden ved
opprettelse, så mottakeren alltid ser nøyaktig teksten stempelet gjaldt.
Dette er kap. 11s poeng om at en publisert visning skal være et snapshot
eller re-valideres ved lesing. *Innsats: liten. Verdi: kjerneinvarianten mot
Ocab/forsikringsselskap håndheves reelt — dette er også en
CLAUDE.md-invariant («godkjenningsport») som i dag bare delvis holdes.*

### 3. Timeout-mismatch på rapportgenerering: 2 min proxy mot 10+ min motor

**Funn (kap. 8 «timeout betyr ikke feilet» + kap. 11 retry av
ikke-idempotent operasjon):** Backend-proxyen mot AI-motoren har 120 s
timeout (`index.js:626`), mens motoren realistisk bruker flere minutter på
lange befaringsvideoer. Når proxyen gir opp, fortsetter motoren å jobbe:
Gemini faktureres, et Google-dokument opprettes — men svaret kastes.
Brukerens naturlige retry starter en ny full kjøring: dobbel fakturering og
foreldreløse dokumenter. I tillegg registreres COGS kun fra
suksess-payloaden (`index.js:637-650`), så feilede-men-fakturerte kjøringer
er usynlige i kostnadsmålingen som `docs/prising-bruksbasert.md` bygger på.

**Tiltak (ett arbeid, delt rotårsak):** Hev proxy-timeouten til motorens
verstefall (~10 min); gjør kjøringen idempotent per prosjekt (en enkel
in-flight-map i API-et som avviser/venter når en generering for samme
prosjekt pågår); og skriv en server-side hovedbok — en liten
`report_generations`-tabell (tester_token, project_id, doc_id, created_at)
som fylles før `res.json`, så foreldreløse dokumenter er oppdagbare uten å
avhenge av at klienten overlever og synker (`reportUrl` når i dag Postgres
kun via klientens synk — et klassisk dual-write-hull, kap. 11). La også
motoren returnere `token_usage` i error-payloaden, så feilede kjøringer
telles i COGS. *Innsats: middels. Verdi: den dyreste operasjonen slutter å
feile på nettopp de store, viktige befaringene.*

### 4. PDF/DOCX-eksporten viser AI-utkastet, delingssiden viser det korrigerte

**Funn (kap. 11 — to avledede representasjoner av samme record må holdes
konsistente):** Nedlasting (`/api/projects/:id/download/:format`,
`index.js:671`) eksporterer Google-dokumentet — som inneholder det *rå*
AI-utkastet. Delingssiden viser `reportFinal` — takstpersonens korrigerte
versjon. En korrigert akutt/gradvis-konklusjon (selve dekningsspørsmålet!)
når altså ikke PDF-en, som er formatet som mest sannsynlig videresendes.

**Tiltak:** Velg ÉN autoritativ rendering. Minimal pilot-variant: patch
dokumentet med `reportFinal`-feltene via ett `replaceAllText`-batchUpdate
før eksport (gjenbruk `replace_text_in_doc`-mønsteret i motoren). Inntil
det finnes: tydelig merking i appen om at PDF-en er det uredigerte
utkastet. Ikke bygg toveis synk mot Google-dokumentet. *Innsats: middels.*

### 5. Klienten ignorerer serverens `stale`/`deleted`-svar — falsk «synket»-status

**Funn (kap. 5 — en avvist skriving må ikke rapporteres som vellykket):**
Serverens upsert svarer 200 med `{stale: true, project: <nyere serverkopi>}`
når PUT-en taper LWW-kampen (`projects.js:118-128`) — *nettopp* så klienten
kan flette. Men `pushProject` leser aldri responskroppen; den sjekker bare
statuskoder og setter grønn «synket» (`projectSync.ts:686-719`). Serveren
rekker flettegrunnlaget tilbake i hånden, og klienten kaster det. En enhet
med for sen klokke kan dermed vise «synket» mens endringene aldri blir
varige på serveren før neste pull tilfeldigvis kjører.

**Tiltak:** Parse JSON-svaret ved 200. Ved `stale`: kjør
`mergeProjects(latestForPut, body.project)`, lagre og `schedulePush` på nytt
(mutexen finnes allerede). Ved `deleted`: fjern prosjektet lokalt. *Innsats:
liten. Verdi: lukker konvergensgapet mobil↔web — forutsetningen for
salgsargumentet om sømløs enhetsbytte.*

**Samme uke, mens man først er i filene:**

- **`async def` → `def`** på begge endepunktene i `ai-engine/server.py`
  (linje 118 og 162). I dag blokkerer én rapportgenerering hele
  event-loopen: tester nr. 2 sin rapport, PDF-nedlastinger — alt køes bak
  den, og Node-timeouten gjør at bruker 2 får feil selv om motoren er frisk
  (kap. 1: head-of-line blocking). To ords endring gjør motoren reelt
  flerbruker.
- **`note.videoRemoteId` inn i `extractMediaIds`**
  (`mediaCleanup.js:43-61`): sweepen kjenner audio- og foto-referanser, men
  ikke video. Hver synkede befaringsvideo merkes derfor permanent
  `unreferenced_at` og overlever i dag *kun* den defensive LIKE-resjekken —
  500 MB-kjernebevis står én refaktorering fra å bli slettet etter 72 timer.

## Del 3 — Øvrige verifiserte funn

Gruppert tematisk. Alle er «liten» innsats med mindre annet er nevnt.

**Synk og lagring (kap. 5, 7, 8):**

- *Tapt oppdatering ved pull:* `pullAndMerge` fletter mot prosjektlisten
  slik den så ut **før** nettverkskallet, og kallerne overskriver hele
  lagringen med resultatet (`(tabs)/index.tsx:233-236`,
  `projects/[id].tsx:326-328`). Redigerer brukeren mens en treg synk pågår
  (Render-kaldstart gjør vinduet titalls sekunder langt), overskrives
  redigeringen. Fiks: re-les `loadProjects()` etter serverresponsen og
  flett mot den ferske listen.
- *Enhetsklokker som ordningskilde:* all LWW-ordning bygger på klientens
  `new Date()` (`projectSync.ts:85-87`). Ved pilotskala (NTP-synkede
  telefoner, én inspektør per token) er dette akseptabelt — men antakelsen
  bør stå dokumentert, og hvis mobil+web-parallellbruk blir vanlig, bør de
  få toppfeltene brukere faktisk redigerer flettes per felt med egne
  stempler (mønsteret finnes alt i `projectDescriptionUpdatedAt`).
- *Hel-dokument-LWW kan slette prosjektnivå-felt:* utvid
  presence-fallbacken i `mergeProjects` til de monotone feltene
  `reportDraft`, `reportUrl` og `caseFile` (samme `||`-mønster som
  `projectDescriptionAudioUri`). IKKE for `reportApproval`/`reportFinal` —
  ny generering skal bevisst nullstille stempelet.
- *`DELETE /api/projects/:id` kjører fire setninger uten transaksjon*
  (`projects.js:146-169`): krasj midt i gir sletting uten tombstone →
  prosjektet gjenoppstår fra en annen enhet. Dette er den ene ruten der en
  transaksjon faktisk kjøper noe: `BEGIN` → tre skrivinger → `COMMIT`,
  `fs.unlink` etter commit (kap. 7: atomisitet handler om
  krasjgjenoppretting, ikke bare samtidighet).

**Skjemaevolusjon (kap. 4):**

- *Ingen versjonsmarkør i prosjektdokumentet:* legg `schemaVersion` i
  `Project` med regelen «mangler = 1». Ingen migreringsmaskineri nå —
  poenget er at fremtidige formendringer kan gjøres som
  migrering-ved-lesing i stedet for at hver leser gjetter på dokumentets
  generasjon.
- *Ukjente felt overlever rundtur — men bare fordi all kode bruker spread:*
  egenskapen er implisitt og skjør. Én e2e-sjekk (PUT med fiktivt ukjent
  felt → GET → klient-merge → feltet finnes fortsatt) fredet den for godt.

**Media-pipeline (kap. 8, 11):**

- *Opplasting er at-least-once uten dedup:* sha256 beregnes allerede ved
  opplasting (`media.js:213`) men brukes aldri. Slå opp
  `(tester_token, sha256, size_bytes)` før INSERT og returner eksisterende
  id — ~10 linjer, og POST /api/media blir idempotent.
- *Krasj mellom filskriving og DB-INSERT etterlater filer uten rad:* utvid
  sweepen med en katalogskann (filer i `MEDIA_DIR` eldre enn 24 t uten
  media-rad → slett).
- *Signerte foto-URL-er (15 min TTL) kan utløpe midt i en lang
  rapportkjøring* — fotoene droppes da stille fra rapporten (kap. 8:
  partiell svikt som stille degradering). Send eksplisitt `ttlMs` (~60 min)
  for rapportkjøringer — parameteren finnes allerede (`mediaSign.js:40`).

**Avledede data og proveniens (kap. 10, 11):**

- *Rapporten er re-deriverbar, men uten proveniens:* verken promptversjon,
  modell eller kunnskapsbase-versjon lagres med utkastet. Legg en
  `PROMPT_VERSION`-konstant i `prompt.py`, returner `{model,
  prompt_version}` fra `/api/report` og lagre i `reportDraft`. Dette er
  også en forutsetning for valideringsbatteriet i
  `docs/valideringscaser.md`: «kjør batteriet → én promptjustering →
  re-kjør» krever å vite hvilken promptversjon som ga hvilken skår.
- *Delvis feil i pipelinen etterlater halvferdige Google-dokumenter:* pakk
  trinnene etter Gemini-analysen i try/except som logger `doc_id`, sletter
  kopien og returnerer `token_usage` også ved feil.

**Drift og observerbarhet (kap. 1, 8):**

- *Backup/restore finnes ikke som runbook* — og sannheten bor **to**
  steder: Postgres *og* mediefilene på disk under `MEDIA_DIR`. En
  DB-backup alene gjenoppretter metadata som peker på filer som ikke
  finnes. Før første ekte pilotsak: pg_dump + tar av `MEDIA_DIR` tatt som
  par, og én faktisk gjennomført test-restore. «Null datatap» er allerede
  definert som suksesskriterium i `docs/avklaringer-og-roller.md` — en
  utestet backup er ingen backup.
- *Ingen request-id på tvers av app → API → AI-motor:* en pilothendelse
  rekonstrueres i dag ved manuell tidsstempel-matching av tre logger.
  Kort id i `requestLogger`, send som `X-Request-Id` til motoren. Logg
  også motorens `{status:'error'}`-payload i proxyen (i dag passerer den
  API-et uten loggspor fordi HTTP-statusen er 200) og `err.stack` (ikke
  bare message) serverside.
- */health lyver:* den svarer «ok» betingelsesløst (`index.js:81-83`) selv
  når Postgres er nede, og AI-motoren har ingen helse-rute — dens
  skjøreste avhengighet (Google OAuth-tokenet) oppdages først når en
  tester rammes. `SELECT 1` i /health + en enkel `GET /health` i motoren
  gir den planlagte oppetidsmonitoren noe ærlig å polle.
- *Google-API-kall i motoren mangler timeout:* `socket.setdefaulttimeout(120)`
  ved oppstart av `server.py` tetter det siste timeout-gapet.

## Del 4 — Gap kritikeren fant (som ingen av de seks passene så)

- **Web-klienten er en uerkjent replika.** Hele prosjektlisten bor under én
  localStorage-nøkkel, og hver lagring skriver hele arrayen
  (`projectsStorage.ts:8-34`). To åpne faner (realistisk på desktop) vet
  aldri om hverandre: fane B sin hel-array-skriving etter pull kan
  overskrive fane A sine ferske redigeringer — *lokalt*, før noe
  synk-maskineri i det hele tatt involveres. Og uten
  `navigator.storage.persist()` er lagringen «best effort»: nettleseren kan
  kaste både prosjektlisten og IndexedDB-videoblobene, som eksplisitt er
  eneste kopi før opplasting. Tiltak: kall `navigator.storage.persist()`
  ved web-oppstart (én linje); lytt på `storage`-eventet og re-les+flett
  ved skriving fra annen fane (`mergeProjects` finnes og gjør det trygt);
  dokumentér at web-PWA-en ikke er kanalen for offline feltarbeid.
- **Restore kan utløse aktiv sletting av media i bruk.** Sweepens
  `unreferenced_at`-merker ligger i selve databasen. En gjenopprettet,
  eldre DB kan bære et foreldet merke på en fil som ble re-referert *etter*
  backup-tidspunktet — første boot-sweep sletter da rad og fil, potensielt
  før klientene rekker å re-pushe. Tiltak: en `MEDIA_SWEEP_DISABLED`-env
  som kill-switch, og i restore-runbooken: ta DB og `MEDIA_DIR` fra samme
  tidspunkt, start med sweepen av, slå på etter 24–48 t. Positiv motsats
  verdt å skrive i runbooken: klientenes lokale lagring re-seeder
  prosjekter serveren mangler helt automatisk via `pullAndMerge` — en reell
  gjenopprettingskilde for prosjekt-JSON (men ikke for media).
- **300 kB-taket på prosjekt-PUT er en stum, permanent synkfeil.** Vokser
  et prosjekt forbi taket svarer express 413, som faller i klientens
  generiske feilgren — visuelt identisk med en forbigående serverfeil, men
  permanent: hver fremtidige push feiler likt, uten forklaring. Det er
  nettopp pilotens *største* befaring som ligger nærmest taket. Tiltak:
  egen 413-bane i `pushProject` med tydelig melding, evt. klientside-vakt
  ved ~250 kB. Ikke hev taket — det er en bevisst sikkerhetsgrense.

## Del 5 — Det boka fraråder oss å bygge nå

Like viktig som funnene. DDIA selv (kap. 1 og 12-ånden) er tydelig på at
kompleksitet skal kjøpes når skalaen krever det, ikke før. For DocrAI betyr
det, med kapittelbelegg:

- **Ingen meldingskø/Kafka/stream processing** (kap. 11): det finnes ingen
  konsumenter. Den ene «hendelsesloggen» som gir mening er
  `report_generations`-hovedboka — en tabell, ikke en plattform.
- **Ingen CRDT-er eller operational transform** (kap. 5): per-notat-fletting
  med tombstones dekker de reelle konfliktene. CRDT kjøper konvergens vi
  allerede har, mot kompleksitet vi ikke har råd til.
- **Ingen event sourcing av prosjektet nå** (kap. 11): dagens
  tilstandsbaserte dokument + `reportDraft` som uforanderlig arkiv er nok.
  Men se del 6 — mønsteret er relevant for den *fremtidige* Funn-modellen.
- **Ingen mikroservice-oppsplitting**: tre tjenester (app, API, AI-motor)
  er allerede maksimum for teamets driftskapasitet — dagens
  Render-deploy-friksjon beviser det.
- **Ingen distribuert transaksjonskoordinering/2PC** (kap. 9): dual-write-
  hullene mot Google Drive løses med hovedbok + opprydding, ikke med
  atomisk commit på tvers av systemer.
- **Ingen partisjonering, sharding eller lese-replikaer** (kap. 6): én
  Postgres med `max: 5`-pool dekker pilotskala med enorm margin.

## Del 6 — Konsepter å ta med inn i veikartet

Ingen bygging nå (nei-lista gjelder), men to DDIA-idéer bør ligge klare som
*designføringer* når evidensen en dag utløser bygging:

- **Funn-modellen i `docs/kartlegging-overlevering-ks-hms.md` er naturlig
  hendelsesorientert.** Lukkingssløyfen (meldt → tiltak → verifisert lukket,
  med annen-person-lukking og fler-parts signering) er i kap. 11-termer en
  append-only logg av tilstandsoverganger der «hvem gjorde hva når» *er*
  produktet — revisjonssporet faller ut gratis, og «gjeldende status» er en
  avledet visning. Skulle overtakelse/KS/HMS-vertikalen bygges, bør
  overgangene lagres som uforanderlige hendelser fra dag én — det er
  billigst da, og umulig å ettermontere.
- **Proveniens er broen mellom DDIA og valideringsbatteriet.** Kap. 10s
  krav om reproduserbar derivering (hvilken kode produserte dette?) er
  nøyaktig det forbedringssløyfen i `docs/valideringscaser.md` trenger:
  promptversjon + modell lagret per utkast gjør «draft-vs-godkjent-diff»
  og batteri-re-kjøringer målbare per promptgenerasjon.

## Status per 29.09.2026 (kontrollert mot koden)

| Tiltak | Status | Belegg |
|---|---|---|
| 1. Transkriberingskontrakten | **Løst** — appen sender lydbytene som `FormData` når fil-URL ikke kan brukes | `apps/mobile/app/projects/[id].tsx:842-874` |
| 2. Godkjent rapport vs. live-innhold | **Delvis** — deling krever stempel (409), og redigering nullstiller stempelet; uforanderlig snapshot er ikke bygget | `apps/api/src/routes/share.js:175-180`; `[id].tsx:1905-1922` |
| 3. Timeout-mismatch | **Løst** — proxy-timeout 10 min, lik motorens | `apps/api/src/reportService.js:10` |
| 4. PDF/DOCX viser AI-utkastet | **Delvis** — advarsel i appen etter redigering; eksporten er fortsatt Google-dokumentet med utkastet, og kan lastes ned før godkjenning | `[id].tsx:2401-2447`; `docs/nettside-masterplan.md` §7 |
| 5. `stale`/`deleted`-svaret | **Uavklart** — verken server (`routes/projects.js`) eller klient (`src/sync/projectSync.ts`) bruker strengene lenger; kontrakten må leses på nytt før punktet lukkes | grep 29.09.2026 |
| Del 4: `MEDIA_SWEEP_DISABLED` | **Løst** | `apps/api/src/mediaCleanup.js:90-91` |
| Del 4: `navigator.storage.persist()` | **Åpent** | ingen treff i `apps/mobile` |

## Status og forbehold

- Ingen kode er endret i denne omgangen — dette er et beslutningsunderlag.
  Topp 5 + de to «samme uke»-punktene er alle avgrensede endringer som kan
  tas enkeltvis.
- Alle fil:linje-referanser gjelder repo-tilstanden 27. august 2026
  (main + PR #15). Linjenumre forskyves ved fremtidige endringer; funnene
  er formulert så de kan gjenfinnes med søk.
- Funn nr. 1 (transkribering) og nr. 5 (stale-svaret), samt serverens
  betingede upsert, er i tillegg til agentenes verifisering kontrollert
  manuelt mot koden og git-historikken før publisering.
