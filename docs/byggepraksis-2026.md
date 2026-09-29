# Byggepraksis 2026 — bransjeråd gjennomgått mot DocrAI

Gjennomgang av et bredt dypdykk i hva ledende skapere innen vibekoding, UX/UI og
indie-appbygging lærer bort i 2026, oversatt til DocrAIs faktiske kodebase. For
hvert punkt: **gjør vi det allerede ✓** eller **bør implementeres ▲**, med
prioritet (**Nå** / **Ved betaling** / **Distribusjon**).

**Kortversjon:** DocrAI ligger allerede godt an på fundamentene dokumentet
forkynner — spec-drevet arbeid, server-håndhevet tenant-isolasjon, modent
designsystem, cookiefri analytics, solid SEO-baseline. De reelle hullene var få;
de trygge er lukket i denne omgangen (se «Implementert nå»). Det store som
gjenstår er ren forretning/beslutning: kreditt-saldo (venter på prisvedtak) og
distribusjon.

## Kategori 1 — Agentic engineering & sikkerhet

Paradigmeskiftet Karpathy beskriver (fra «vibe coding» som hever gulvet til
«agentic engineering» som bevarer taket) er allerede DocrAIs arbeidsmåte: alt
ligger i ett repo med spec-dokumenter, planlegging før bygging, og adversariell
verifisering av endringer.

| Råd fra dokumentet | DocrAI-status |
|---|---|
| Server-side auth/validering, aldri stol på klienten | ✓ `middleware/requireTesterToken.js` — identitet slås opp mot DB; klienten oppgir en hemmelig token, aldri en identitets-påstand |
| «Aldri klient-oppgitt user_id» | ✓ Token *er* legitimasjonen og tenant-nøkkelen; hver spørring filtrerer `WHERE tester_token = $N` med serversatt verdi (`routes/projects.js`, `media.js`, `share.js`) |
| Timing-sikker hemmelighet | ✓ `routes/admin.js` bruker `crypto.timingSafeEqual` |
| Denial-of-Wallet: timeouts + tak | ✓ utgående timeouts (`index.js`), opplastingstak, rate-limiting · ▲ **lukket nå:** den siste ubundne LLM-stien (`ai-engine/main.py`) |
| «Test som en angriper» (konto B når A) | ▲ **lukket nå:** ny `test/e2e-tenant-isolation.sh` i CI |
| Spec-drevet, menneskelig gjennomgang av penge-/auth-/data-kode | ✓ arbeidsmåten; behold ved kreditt-bygging |

**Merk om modellen:** DocrAI bruker egen Express + Postgres, ikke Supabase.
Dokumentets Supabase-spesifikke råd (RLS `USING(true)`, `WITH CHECK`,
`service_role`-lekkasje) har ingen direkte motpart — men **prinsippene** gjelder,
og de er oppfylt: ingen tabell uten tilgangskontroll i applikasjonslaget, ingen
klient-skrivbar rolle/plan, ingen hemmelig nøkkel i klientkode.

## Kategori 2 — UX/UI-design

Dokumentets fundament-fokus (hierarki, systematisk spacing, begrenset typografi,
Nielsens heuristikker) er i stor grad på plass.

| Råd | DocrAI-status |
|---|---|
| Systematisk spacing/grid, ikke magiske tall | ✓ `theme.tsx`: 5-stegs spacing + radii-skala, konsumert av komponenter |
| Begrenset typografi (få størrelser/vekter) | ✓ 3-tier `Title/Body/Caption` · ▲ vurder h1/h2/h3-nyanse på sikt |
| Unngå ren svart/hvit; dempet palett | ✓ varm papir + stålblå (bevisst «lite KI-generert») |
| Nielsen: synlig systemstatus, skeleton, feilhjelp | ◐ tidsstyrt steg-overlay ved rapportgenerering (ikke serverprogresjon, jf. «UX (mindre)» under) + byte-nivå opplastingsprogresjon · ▲ ingen skeleton-loaders (kun spinnere) |
| AI-produkter: vis prosessering **og konfidens** | ◐ Prosessering vises; **konfidenssignaler mangler bevisst** — tillit er forankret i menneskelig godkjenning, ikke modell-selvtillit. Vurder et «bør kontrolleres»-flagg per felt der AI-en er usikker |
| Fokusmarkering (WCAG 2.4.7) | ✓ `:focus-visible` på alle offentlige sider (kundereisen fikk det 29.09.2026; `e2e-headere.sh` sjekker) |

**Én nyanse verdt en beslutning:** rapport-genereringsoverlayet viser en
4-stegs framdrift, men stegene er *tidsstyrte simuleringer*, ikke drevet av ekte
backend-progresjon (`ReportGeneratingOverlay.tsx`). Ærlig nok i dag, men en reell
progresjonskanal fra AI-motoren ville styrke tilliten (NNgroup: vis *faktisk*
systemstatus).

## Kategori 3 — Distribusjon & indie

Dokumentets sterkeste påstand (Isenberg): «kode er en råvare; vollgraven er
distribusjon». Her er DocrAIs største strategiske rom.

| Råd | DocrAI-status |
|---|---|
| Valider betalingsvilje FØR bygging | ◐ pilotskjema + /demo-krok finnes; prisvedtak utestående (`beslutningsnotat-prising.md`) |
| SEO-baseline (sitemap, robots, OG, JSON-LD) | ✓ sterk · ▲ **lukket nå:** /demo gjort indekserbar, OG+canonical på faq/personvern/vilkar/kundereisen, Organization+BreadcrumbList-JSON-LD |
| Gratis verktøy som top-of-funnel | ◐ /demo ér gratis-verktøyet (saksunderlag på 2 sek) — nå indekserbar, men gjør ennå lite SEO-arbeid |
| MCP-server som distribusjonskanal | ▲ finnes ikke — se roadmap under |
| Programmatisk SEO | ▲ ikke bygget — én saksunderlag-side per by/kommune er en åpenbar kandidat |
| Zapier/Make-integrasjoner, directory-distribusjon | ▲ ingen ennå |
| Verdibasert prising (The Futur) | ✓ innarbeidet i `prising-bruksbasert.md` (pris mot spart tid, ikke kostnad) |
| Bygg-i-offentlighet, personlig merkevare | ◐ strategisk valg for teamet |

## Implementert nå (denne PR-en)

1. **Kryss-konto angrepstest** — `apps/api/test/e2e-tenant-isolation.sh` + i CI.
   Tester B forsøker å nå A sitt prosjekt/media/deling/nedlasting med A sine
   ID-er → alt 404/403, og A sine data overlever. Dokumentets «Fase 3».
2. **Bandt den ubundne kostnadsstien** — `ai-engine/main.py`: hard timeout på
   Gemini-analysekallet + maks-grense på videoprosesserings-løkken.
3. **SEO-konsistens** — /demo indekserbar (var `noindex` men lå i sitemap);
   OG-tagger + `canonical` på /faq, /personvern, /vilkar, /kundereisen;
   Organization-JSON-LD på /om; BreadcrumbList der brødsmuler finnes.

## Bør implementeres — prioritert

**Ved betaling (kreditt-saldo — venter på prisvedtak):**
- Gjenbruk `WHERE tester_token = $N`-mønsteret for saldo/ledger-tabeller.
- `credit_balance` (autoritativ saldo) + append-only `credit_ledger`. `cost_events`
  forblir analyse, ikke penger.
- **Atomisk trekk:** `UPDATE credit_balance SET balance = balance - $1 WHERE
  tester_token = $2 AND balance >= $1 RETURNING balance` (rad-lås; avvis ved for
  lav saldo). Dokumentets `WITH CHECK`-ekvivalent: saldo muteres kun server-side.
- **Reserver-så-oppgjør:** kostnad kjennes først etter LLM-svaret → reserver
  maks-estimat ved start, gjør opp faktisk ved fullført rapport.
- **Per-token forbrukstak** (`heavyLimiter` teller allerede per tester, men kall — ikke tokens).
- Utvid angrepstesten til saldo-endepunktene før betaling shippes.

**Distribusjon (roadmap):**
- MCP-server som eksponerer /demo-saksunderlaget som verktøy («AI-en blir
  salgsteamet» — når noen spør Claude/ChatGPT om en adresse, dukker DocrAI opp).
- Programmatisk SEO: mal-genererte saksunderlag-sider per by/kommune.
- Zapier/Make/n8n-kobling så hver plattforms directory blir gratis toppen-av-trakt.

**UX (mindre):**
- Vurder konfidens-/«bør kontrolleres»-signal per rapportfelt.
- Reell backend-progresjon i genereringsoverlayet (erstatt tidssimuleringen).
- Skeleton-loaders der det i dag er spinnere.

## Kildeforbehold (ærlig lesning)
- Inntektstall fra skaperne (Finn $300k/år, Postma $300k/mnd, Dinh $1M+) er
  **selvrapporterte** via X/egne sider; marginer ofte lavere pga. API-kostnad.
- Sikkerhetsstatistikken («~60 % broken RLS», «~15 % lekket service_role») kommer
  fra sikkerhetsleverandører (VibeArmor, Vibe App Scanner) med kommersiell
  interesse. Retningen er godt underbygget; eksakte prosenter bør leses med
  forbehold. CVE-2025-48757 (CVSS 9.3) er derimot en offisielt publisert sårbarhet.
- Ingen av skaperne gir juridisk EU-compliance-veiledning — det dekkes separat i
  `fagkart-lansering.md`.
