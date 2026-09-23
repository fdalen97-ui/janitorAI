# Sikkerhets- og troverdighetsrevisjon — august 2026

Revisjon av DocrAI mot to bransjesjekklister: 20 «slik hackes en vibe-kodet app»
og 20 «slik ser en useriøs KI-side ut». Seks parallelle agenter gikk gjennom
kodebasen, og hvert sårbart funn ble adversarielt etterprøvd før fiks. Ingen
funn ble avvist i etterprøvingen. Dette dokumentet er sannhetskilden for hva som
er tettet og hva som bevisst er utsatt.

## Sammendrag

- **Ingen kritiske hull.** Grunnmodellen var solid: all SQL er parametrisert,
  delings-PIN hashes med scrypt+salt, share-IDer/PIN er kryptografisk tilfeldige,
  ingen hemmeligheter i frontend eller git.
- **11 bekreftede funn tettet** (alle middels alvor), pluss 11 herdingspunkter.
  S20–S23 kom til i september 2026 fra gjennomgangen av docrai.io
  (`/agent-readiness`); S23 står åpent.
- **Alt verifisert:** e2e-sjekker (47 deling + 16 tenant + 65 headere/Host +
  rate-limit) og enhetstester, tenant-skoping, MIME-whitelist, signerte
  URL-er, ren TypeScript, web-eksport bygger.

## Tettet — bekreftede funn

| Punkt | Hva | Fiks | Fil |
|---|---|---|---|
| S3 | Media kunne hentes på tvers av testere med kjent UUID | `GET /api/media/:id` skopet på `tester_token`; delingens medieliste + strøm skopet; opplasting avviser planting i annens eksisterende prosjekt | `routes/media.js`, `routes/share.js` |
| S7 | Klientens `Content-Type` lagret rått → lagret XSS ved inline-visning | MIME avledes fra whitelistet filendelse; all servering setter `X-Content-Type-Options: nosniff` | `mediaTypes.js`, `routes/media.js`, `routes/share.js` |
| S4 | Nedlastingsproxy stolte på `?doc_url` fra klient | Dokument-ID hentes fra prosjektets lagrede `reportUrl`, skopet på token; rapportgenerering verifiserer videoeierskap | `index.js` |
| S10 | Tester-token lekket i `?token=` til AI-motoren (motorens/edge-logger) | Kortlevde, signerte medie-URL-er (HMAC, 15 min) — tokenet forlater aldri serveren | `mediaSign.js`, `routes/media.js`, `index.js` |
| S14 | App-IDer var `Date.now()` (forutsigbare mot global primærnøkkel) | UUID-er (`src/lib/ids.ts`); tombstone-upsert kan ikke lenger kapre eierskap | `app/**`, `routes/projects.js` |
| S17 | Stacktrace kunne lekke uten `NODE_ENV=production` | Global feilhåndterer fanger JSON-parse-/multer-feil, generisk svar uansett miljø | `index.js` |
| S18 | 3 høye sårbarheter i api-treet | `multer`→2.2.0, ubrukt `form-data` fjernet → **0 sårbarheter**; ikke-brytende `npm audit fix` i appen | `package.json` |
| S1 | `.env` matchet aldri i `.gitignore` (kommentar på mønsterlinjen); testvideo innsjekket | `.env` matcher nå på alle nivåer; `media-uploads/` ignorert; videoen fjernet | `.gitignore` |
| S20 | Rå `Host` reflektert i canonical/og:url/JSON-LD, sitemap og robots uten escaping (verifisert HTML-injeksjon med `PUBLIC_BASE_URL` usatt) — og i de signerte medie-URL-ene til AI-motoren (SSRF-aktig: motoren henter «video» fra vert angriperen velger, med gyldig signatur) | Én kilde (`publicBase.js`): validert env → allowlistet vert → fast fallback; rå Host aldri i output; HTML/XML-escape ved sink; CR/LF strippet i robots; `apiBase(req)` for medie-URL-er. Dekket av `test/e2e-headere.sh` | `publicBase.js`, `index.js`, `routes/publikum.js` |
| S21 | Personvern/vilkår/salgssider lovet mer enn koden: «sletting i appen sletter også på serveren» (Drive-dokument, `shares`, `report_generations`, feil-/handlingslogg slettes aldri), «aldri IP» (holdes i minne for takst + hos driftsleverandør), «flyttes til EU/EØS før pilot» (ikke gjort, piloten kjører — sto også på `/faq`, `/kontakt`, `/om`), «SHA-256 ved fangst» (settes på serveren ved opplasting), feillogg uten nevnt enhets-ID og handlingslogg, rapportdokumentets innhold (kundenavn, saksnummer, forsikringsdata, stillbilde fra video) | Teksten rettet til faktisk atferd på alle fem sidene, setning for setning belagt mot kode (46 setninger gjennomgått); ny seksjon «Hvor rapporten blir liggende»; regel i CLAUDE.md: ingen setning uten kodelinje bak | `personvern-page.html`, `vilkar-page.html`, `faq-page.html`, `kontakt-page.html`, `om-page.html` |

## Tettet — herding (lav alvor)

- **S22** `X-Robots-Tag: noindex, nofollow` på `/share`, `/api`, `/admin-dashboard`,
  `/presentation` (segmentmatch, case-ufølsom som Express-rutingen; forsvar i
  dybden — robots.txt disallower det samme); headerne settes før CORS og body-
  parser så også preflight/400 bærer dem; `Cache-Control: no-store` på alle
  delings-svar; `/.well-known/*` montert før SPA-fallback og token-vakt (404,
  ikke 401 — og ikke webappen for nettlesere); `security.txt` (RFC 9116) fra
  `SECURITY_CONTACT`, fail-closed; HSTS-trapp via `HSTS_MAX_AGE`, kun `max-age`;
  request-loggen maskerer query-verdier med allowliste (kun `exp`/`days`/`date`
  i klartekst — `token`, `vt`, `sig`, `adresse`, `sok`, `lat`, `lon` og
  alle fremtidige parametre blir `[redacted]`), med dekodet nøkkel (`%74oken`
  maskeres som `token`); `STATIC_DIR/.well-known/` (App Links) serveres foran
  security.txt-routeren; admin-dashbordet får en
  validert og normalisert API-base, ikke rå env. Dekket av `test/e2e-headere.sh`
  (tre servere: fallback, env, ugyldig env i produksjon; SSRF-sjekk mot
  motor-stub) og `test/publicBase.test.js` (escaping og BASE_RE-avvisning, som
  e2e ikke kan se fordi basen etter S20 aldri inneholder farlige tegn).
- **S5** media-opplasting bak `heavyLimiter`; publikum-telleren prunes så den ikke vokser.
- **S8** admin-dashboardets `escHtml` escaper også apostrof (lukker selv-XSS i `onclick`).
- **S11** admin-hemmelighet sammenlignes timing-sikkert (`timingSafeEqual`).
- **S12** CORS kan låses via `CORS_ORIGINS` (åpen som standard — auth er header-token, ikke cookies).
- **S15** eksplisitt body-tak 300 kb på JSON.
- **S2** Gemini-nøkkel sendes nå i header (`x-goog-api-key`), ikke i URL.

## Trygt fra før (ingen endring nødvendig)

S6 (all SQL parametrisert), S9 (scrypt+salt på PIN), S16 (ingen innkommende
webhooks i arkitekturen), S19 (6-sifret server-PIN, 5 forsøk/15 min + utløp).

## Bevisst utsatt — med begrunnelse

- **S10-rest (app-visning):** appens egen `?token=`-visning av eget media er
  same-origin ressurslasting; API-loggene redakterer `?token=`. Lav risiko.
  Kan flyttes til signerte URL-er også på klienten etter pilot.
- **S14 sammensatt primærnøkkel:** `projects`/`deleted_projects` har global PK
  på `id` alene. UUID-ene fjerner kollisjonsrisikoen i praksis; å endre PK til
  `(id, tester_token)` er en skjemamigrasjon som tas når pilotdata finnes.
- **S19 persistert lockout:** PIN-forsøksteller er i minnet (nullstilles ved
  omstart). Akseptabelt nå; persister på `shares`-raden hvis piloten skalerer.
- **S13 e-postverifisering:** tester-e-post (som gir Google-Doc-lesetilgang)
  bør bekreftes før `share_doc_with_email`. Tas med i onboarding-flyten.
- **S21-rest (slettekaskade):** sletting av prosjekt sletter media, men ikke
  `shares`-raden, `report_generations` eller Google-dokumentet i Drive
  (`ai-engine/main.py` sletter kopien bare i feilbanen). Teksten sier det nå
  ærlig; kaskaden bygges som egen endring (P2).
- **S23 (ÅPENT — prioriteres rett etter Dag 0):** `ai-engine/doc_engine.py`
  (`upload_image_to_drive`) gir hvert rapportbilde Drive-tillatelsen
  `anyone`/`reader`: befaringsfoto er tilgjengelige for alle med lenken og
  slettes aldri. Fiks: del per e-post som dokumentet, eller bygg bildene inn
  uten offentlig lenke. Personvernteksten opplyser om svakheten inntil da.

## Troverdighet (W-lista)

Siden var allerede uvanlig ærlig: ingen falske anmeldelser, kundetall, emojis,
lilla gradienter eller «made with»-badge; priser merket «veiledende». Fikset:

- **W9** favicon i tre størrelser koblet på alle sider (+ `/favicon.ico`).
- **W12** vilkårsside (`/vilkar`) lenket fra footere.
- **W20** alle lange tankestreker (—) byttet til korte (–) på salgsflatene.
- **W8** «D»-merke i logoen så den matcher favicon og delingsbilde.
- **W5** retur-lenke i kundereisen (ingen navigasjonsblindvei).
- **W15** udokumenterbar «ingen andre i Norden»-påstand myknet.
- Delingsbildet: en-dash + ærlig stempel «Du godkjenner, ikke AI-en».

Bevisst ikke gjort: ekte anmeldelser, kundetall, teamfoto og casestudier kan
ikke fabrikkeres — de kommer fra piloten.

## Driftsanbefalinger (utenfor kode)

1. Sett `NODE_ENV=production`, `MEDIA_URL_SECRET` og `CORS_ORIGINS` i miljøet.
2. Verifiser at `MEDIA_DIR` peker på persistent disk utenfor repoet i drift.
3. Vurder secret-scanning i CI som ekstra sikring mot lekket `.env`.
