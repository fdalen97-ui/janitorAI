# CLAUDE.md — DocrAI

Persistent prosjektkontekst for Claude Code. Les denne før du bygger. Hold den
kort og oppdatert; den er delt hukommelse på tvers av økter (jf. The Founder's
Playbook, `docs/founders-playbook-docrai.md`).

## Hva DocrAI er
Norsk proptech: gjør befaringsvideo/lyd/foto om til en **forsikringsklar
skaderapport** (årsak, akutt/gradvis, Byggforsk-henvisninger). Takstpersonen
kontrollerer og godkjenner — AI-en skriver utkastet. Pilotpartner: Ocab AS.
Språk: produkt/salgsflater på norsk (bokmål); pitch-deck på engelsk.

## Arkitektur
- **apps/mobile** — Expo/React Native (expo-router v6, RN 0.81, SDK 54), web + app.
  Web-eksport: `cd apps/mobile && API_BASE_URL='' npx expo export --platform web`
  (legg til `--clear` kun ved config-endring). Designsystem i `src/ui/theme.tsx`.
- **apps/api** — Express + Postgres (JSONB-prosjekter per `tester_token`). Skjema
  i `src/db.js` (idempotent `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).
  Offentlige salgssider (`/om /demo /faq /personvern /vilkar /kontakt /kundereisen`)
  serveres herfra. `/kontakt`-bookinglenken styres av `BOOKING_URL` (e-post-fallback).
- **ai-engine** — Python/FastAPI; Gemini-analyse → strukturert `DamageAnalysis` +
  Google Doc. Returnerer `(doc_id, analysis, token_usage, citation_stats)`;
  sitatportens telling + `prompt_version` bokføres per kjøring i
  `report_generations`.

## Sikkerhetsinvarianter (ALDRI brytes)
- **Tenant-isolasjon:** hver DB-spørring mot prosjekter/media/deling filtrerer
  `WHERE tester_token = $N` med **serversatt** `req.testerToken` — aldri en
  klient-oppgitt id. (Unntak er bevisste og dokumenterte: signert media-GET.)
- **Godkjenningsport:** en rapport kan ikke deles før takstpersonen har godkjent
  den (server returnerer 409 uten stempel). Håndheves i server, ikke bare app.
- **Signerte medie-URL-er** til AI-motoren (tokenet forlater aldri serveren); bare
  media testeren eier signeres.
- **Ingen hemmeligheter i klient/git.** Gemini-nøkkel kun server-side.
- Kjør `apps/api/test/e2e-tenant-isolation.sh` etter endringer som rører tilgang.

## Nei-lista (bygg IKKE uten evidens fra ekte brukere)
Ikke eget tegneverktøy, ikke egen forsikrings-«skinne»/erstatning for In4mo/MEPS,
ikke estimatmotor. Ny funksjon bygges først når ekte pilotbrukere har sagt de
ikke får verdi uten den — ikke på gründer-entusiasme. (Kilde: `inkorporering.md`,
`avklaringer-og-roller.md`.)

## Test & verifisering
- E2E delingskjede: `cd apps/api && bash test/e2e-share.sh` (~47 sjekker).
- E2E tenant-isolasjon: `cd apps/api && bash test/e2e-tenant-isolation.sh`.
- E2E headere/Host-allowliste/security.txt (uten DB): `cd apps/api && bash test/e2e-headere.sh`.
- Enhetstester (uten DB): `cd apps/api && node test/shareUtils.test.js && node test/publicBase.test.js`.
- Typesjekk app: `cd apps/mobile && npx tsc --noEmit`.
- AI-motor: `python3 -m py_compile ai-engine/main.py ai-engine/server.py`.
- WER på feltlyd: `python3 ai-engine/wer_benchmark.py --selftest`; full kjøring
  krever referansesett (se `docs/taleteknologi-laerdommer.md`).
- Lokal Postgres (dør av og til): restart med pg_ctl på port 55433, base
  `docrai_demo` (se `docs/testing-builds.md`).
- Bakgrunnsprosesser overlever IKKE mellom Bash-kall — kjør server + curl i samme
  kall; drep kun egen `$PID` (aldri `pkill node`).

## Arbeidsdisiplin (fra playbooken)
1. **Valider før du bygger.** Et ferdig produkt er ikke bevis; ekte brukersamtaler
   og målte tall er. Hold sansemaking foran bygging.
2. **Sikkerhet før brukere.** Kjør en adversariell gjennomgang før ekte data.
3. **Mål før lansering.** Definer PMF-benchmarks *og* hva en falsk positiv er,
   før første bruker.
4. **Steelman konkurrentene.** Argumentér for hvorfor Befar/Wenn vinner — så svar.
5. **Oppdater `docs/` og denne fila** når arkitektur/scope endres.
6. **Ingen setning publiseres før den kan belegges** med en kodelinje eller en
   signert avtale. Gjelder personvern, vilkår og salgsflater (S21: teksten lovet
   sletting og EU-region koden ikke hadde).

## Beslutningskommandoer (`.claude/commands/`)
Delte slash-kommandoer for de disiplinene playbooken krever — bruk dem før
pitcher og store valg:
- `/steelman` — sterkeste argument MOT egen idé (overlever den, er den klar).
- `/brutal` — ærlig kritikk uten høflighet; hva er faktisk galt.
- `/gaps` — pre-mortem: finn hullene før de blir dyre.
- `/10xthis` — bygg idéen på nytt med 10x ambisjon.
- `/eli5` — forklar kontrakt/jus/fagterm enkelt (+ flagg risiko).

## Branch & commit
Utvikle på `claude/visualisering-losning-xa7udi`. Commit + push når arbeid er
verifisert. Ikke opprett PR uten at det er bedt om.
