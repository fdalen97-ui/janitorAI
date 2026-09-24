# Arkitekturvurdering: Vannskadetreet i AI-rørledningen

28. august 2026. Skrevet som Principal Architect-vurdering av Geminis
strategiske forslag («Strategic Architecture Proposal: Water Damage Decision
Tree for DocrAI»), holdt opp mot faktisk repo-tilstand. Kildegrunnlaget er
`docs/fagkunnskap-vannskadeaarsaker.md` (de fem kildene) og
`docs/produktdesign-aarsaksbildet.md` (produktflatene bygget på dem) — les
begge før du leser videre, denne filen dupliserer dem ikke.

**Konklusjon i én setning:** bygg en utvidet **Plan A** (styrt
enkeltkall-resonnering + deterministisk signalinjeksjon), ikke Geminis
Plan B (to-stegs kode-motor) — og merk at denne beslutningen i praksis
allerede er tatt i `docs/produktdesign-aarsaksbildet.md`s byggerekkefølge.

## 1. Hva Gemini foreslo

- **Plan A — Single-Pass Guided Reasoning:** fold kunnskapstreet inn i
  system-prompten, utvid Pydantic-skjemaet med et `reasoning_path`-felt og en
  kilde-enum. Ett Gemini-kall, som i dag.
- **Plan B — Two-Step Pipeline:** Steg 1 (LLM) trekker ut kun objektive
  fakta (`highest_visible_damage`, `room_type`, `building_year`,
  `damage_pattern`). Steg 2 er en ren `executeWaterDamageTree()`-funksjon i
  kode som deterministisk traverserer spørretreet og produserer diagnosen.
  Steg 3 sender kode-diagnosen inn i rapporten som «ubestridelig fakta».

## 2. Hva som faktisk finnes i repoet i dag

**AI-rørledningen (`ai-engine/`)** kjører **ett** Gemini-kall per rapport
(`ai-engine/main.py:224-237`, modell `gemini-2.5-flash`,
`response_schema=DamageAnalysis`, `temperature=0`/`top_p=0.1`/`top_k=1`/
`seed=42` — bevisst deterministisk dekoding for å kunne måles reproduserbart
mot valideringsbatteriet). `DamageAnalysis` (`ai-engine/models.py:17-29`) er
flat og generisk: `area`, `source: str`, `cause: str`, `description`,
`evidence_points: List[Evidence]`, `is_habitable: bool`,
`extent_description`, `repairs_description`. Ingen enum, ingen strukturert
akutt/gradvis-felt, ingen hypoteseliste — til tross for at CLAUDE.md/
`fagkunnskap-vannskadeaarsaker.md:41-42` antar akutt/gradvis «finnes allerede
i DamageAnalysis» (det gjør det ikke som eget felt — kun som fritekst,
styrt av prompten).

`ai-engine/prompt.py` er allerede vannskade-orientert i tekst (`system_prompt()`
har en 5-stegs kjede-av-tanke-metodikk og eksplisitte akutt/gradvis-kriterier;
`main_prompt()` har en 4-punkts teknisk sjekkliste som dekker noe av
barriere-svikt/terreng/kondens), men **kjenner ikke de fem kildene** fra
kunnskapsdokumentet, og har **ingen kode-drevet beslutningslogikk** — alt er
promptinstruksjon som modellen selv følger i ett kall.

**Konkret, reelt hull:** `buildingYear` finnes i `report_meta` og settes inn
i selve Google Doc-malen (`ai-engine/template_replacement.py:73`), men
**sendes aldri inn i Gemini-kallets `contents`** (`ai-engine/main.py:215-221`).
Modellen har med andre ord ingen tilgang til byggeår-heuristikkene
(støpejern før 1970, manglende dampsperre før 1979/1983) som kunnskaps-
dokumentet spesifikt ber om — dette er et hull som må tettes uansett hvilken
plan som velges.

**Test-/valideringsdisiplin:** det finnes ingen automatiserte tester for
`ai-engine/` (kun `python3 -m py_compile` som syntakssjekk, jf. CLAUDE.md).
`docs/valideringscaser.md` sitt 11-case manuelle batteri + `PROMPT_VERSION`-
bumping er den reelle regresjonsmekanismen: endre én ting, kjør batteriet på
nytt, sammenlign score.

**Kost/latens:** rapport-kallet dominerer allerede kost (~55–62k input-
tokens, ~2k output, ~0,20–0,24 kr/rapport, jf. `docs/prising-bruksbasert.md`)
fordi video/foto/kunnskapsbase sendes med som input. Et andre fullstendig
LLM-kall (Plan B steg 1) ville i praksis **doble** den dyreste linjen i
kostbildet — det er ikke et billig sidekall, siden det samme materialet må
sendes på nytt (eller tilstand må bæres mellom kallene).

**Ingen delt skjema-infrastruktur:** `packages/shared/src/index.js` er tom
(kun en kommentar om fremtidig bruk) og brukes ingen steder. `DamageAnalysis`-
formen dupliseres i dag manuelt tre steder — `ai-engine/models.py` (kilden),
`apps/mobile/src/features/projects/types.ts` (`ReportContent`), og
`apps/api/src/routes/share.js:101-103` (`CONTENT_FIELDS`-whitelisten som
avgjør hva mottakeren faktisk ser). En Plan B-kodemotor ville måtte leve
alene i Python i `ai-engine/`, uten testdekning, uten forbrukerkontrakt.

**Lagring:** Postgres (`apps/api/src/db.js:57-62`) lagrer hele prosjektet som
ett JSONB-blob (`projects.data`) — ingen relasjonell plass for strukturerte
hypoteser/kilder i dag. `source`/`cause` flyter i dag som fritekst hele veien:
`ai-engine` → `apps/api` (ren gjennomstrømming, ingen validering) →
`apps/mobile` (fritekstfelt, ingen nedtrekksmeny).

**Godkjenningsgate** (`apps/api/src/routes/share.js:161-169, 287-297`) er
uavhengig av denne beslutningen — den låser hele rapportinnholdet
(inkl. skadeårsak) ved godkjenningsstempelet, uansett hvilken plan som
produserer innholdet.

## 3. Hvorfor Plan A — og hvorfor ikke Plan B nå

### 3.1 Denne beslutningen er i praksis allerede tatt

`docs/produktdesign-aarsaksbildet.md` (skrevet samme dag som Geminis
forslag) legger en byggerekkefølge som strukturelt **er** Plan A:

| Steg | Hva | Forutsetning |
|---|---|---|
| a | Kunnskapsgrunnlag v1 inn som versjonert prompt-kunnskap (PROMPT_VERSION-bump) + måling mot valideringscasene | Ingen — kan starte nå |
| b | Hypoteser med evidens i `DamageAnalysis` (kontrollflaten) | a validert |
| c | «Før du drar»-sjekk | b i bruk hos pilot |
| d | Årsaksveiviseren (spørretre) i appen | Spørretre v2 levert |

Ingen av disse fire trinnene er en separat, deterministisk kode-diagnose-
motor à la Plan B. Trinn (d) — det nærmeste treet kommer en «beslutnings-
tre»-implementasjon — er en **veiledende spørsmålswizard i appen som mater
observasjoner inn i årsaksbildet**, ikke noe som overstyrer eller erstatter
LLM-ens differensialdiagnose.

### 3.2 Plan B kolliderer med et eksplisitt produktprinsipp

`docs/produktdesign-aarsaksbildet.md` slår fast: **«AI velger aldri årsak»**
og **«Evidens foran fasit»** — takstpersonen avgjør, AI foreslår rangerte
hypoteser med evidens; «usikker» er et fullverdig utfall fordi «falsk
sikkerhet er farligere enn usikkerhet». Plan Bs kjernepitch — at kode-
motorens diagnose sendes inn i rapporten som **«ubestridelig fakta»** — er
det direkte motsatte av dette prinsippet. Å bygge Plan B nå betyr å bygge en
arkitektur som må rives eller omtolkes før den kan brukes i UI-et som
allerede er designet.

### 3.3 Spørretreet Plan B skulle traversere er ikke ferdig

Den opplastede spørretre-teksten er et **utkast** — fageksperten skriver selv,
ordrett, i dokumentet: *«(Dette kan unnlates inntil videre), Det kommer til
å ta meg litt tid å utvikle denne ferdig.»* `docs/fagkunnskap-vannskadeaarsaker.md`
linje 5-6 bekrefter: spørretreet er «v2» og «under arbeid». Å kode en hard,
deterministisk `executeWaterDamageTree()`-funksjon på et første utkast er å
bygge produksjonsautoritet på grunnlag som eksperten selv sier ikke er
ferdig — direkte i strid med Arbeidsdisiplin-punkt 1 i CLAUDE.md («valider
før du bygger») og Nei-lista-disiplinen (bygg ikke før pilotbrukere har
bekreftet behovet).

### 3.4 Plan Bs determinisme er delvis illusorisk

Plan Bs styrke skal være at steg 2 (kode) er 100 % deterministisk og lett å
enhetsteste. Det er sant — men steg 1 (LLM-basert faktautrekk) er fortsatt
en språkmodell som kan hallusinere `room_type`/`damage_pattern`. Determinismen
flyttes nedstrøms i pipelinen, den fjernes ikke; resultatet er en falsk
trygghetsfølelse («koden sier X, altså er X sant») rundt en fortsatt
usikker inngang. Dette er presis den typen falske sikkerhet kunnskaps-
dokumentet advarer mot.

### 3.5 Kost, kompleksitet, vedlikehold

- **Kost/latens:** se §2 — Plan B dobler i praksis den dyreste kost-linjen
  i pipelinen for et andre kall som uansett må resonnere over samme
  video/foto/kunnskapsbase-materiale (eller kreve at tilstand bæres mellom
  kallene, som legger til enda mer kompleksitet).
- **Vedlikehold:** Plan A rører kun `ai-engine/prompt.py` og
  `ai-engine/models.py` — samme filer, samme `PROMPT_VERSION`-mønster,
  samme valideringsbatteri som allerede finnes og brukes. Plan B legger til
  en helt ny kodemotor uten testinfrastruktur i et repo som i dag har null
  automatiserte tester for `ai-engine/`, og uten en delt skjema-mekanisme
  hvis logikken noen gang skal gjenbrukes i appens spørsmålswizard (TS).

### 3.6 Hvor ekte determinisme faktisk hører hjemme

Det er én del av Plan B som er riktig og bør bygges **nå**, uavhengig av
hvilken plan som velges for selve diagnosen: **objektive fakta appen
allerede kjenner sikkert** — byggeår, befaringsdato/sesong, romnavn — bør
beregnes deterministisk i kode og **injiseres** som kontekst i prompten, i
stedet for å la LLM-en gjette dem eller la dem forbli ubrukt (se §2s hull
med `buildingYear`). Dette er trygg, liten, verifiserbar kode — men det er
signalberikelse, ikke en diagnose-motor, og det overstyrer aldri LLM-ens
resonnering.

## 3.7 Vurderingsmatrise: Plan A (utvidet) vs. Plan B

| Dimensjon | Plan A — utvidet enkeltkall | Plan B — to-stegs kodemotor |
|---|---|---|
| **Pålitelighet** | Ett kall, samme temp=0/seed=42-oppsett som allerede måles mot 11-case-batteriet. Fritekstbegrunnelse (`cause`/`description`) gjør usikkerhet synlig fremfor skjult. | Steg 2 er 100 % deterministisk, MEN steg 1 (LLM-faktautrekk) kan fortsatt hallusinere — determinismen er kun nedstrøms. Risiko for falsk trygghet («koden sier X») rundt en usikker inngang. |
| **Kost/latens** | Ingen endring i antall LLM-kall (fortsatt ett). Signalinjeksjon er kode, ikke tokens av betydning. | Et andre fullstendig LLM-kall dobler i praksis den dyreste kostlinjen (~55-62k input-tokens/rapport), siden video/foto/kunnskapsbase må gjenbrukes eller tilstand bæres mellom kallene. |
| **Vedlikehold** | Rører kun `ai-engine/prompt.py` og `ai-engine/models.py` — samme filer, samme `PROMPT_VERSION`- og valideringsbatteri-mønster som i dag. | Ny kodemotor (`executeWaterDamageTree()`) uten testinfrastruktur i et repo med null automatiserte tester for `ai-engine/`; ingen delt skjema-mekanisme mot en fremtidig TS-basert appwizard (`packages/shared` er tomt). |
| **Produktjustering** | Er strukturelt identisk med trinn (a) i `docs/produktdesign-aarsaksbildet.md`s allerede vedtatte byggerekkefølge. | Kolliderer med prinsippet «AI velger aldri årsak» / «Evidens foran fasit» — koden ville produsere «ubestridelig fakta» der produktdesignet krever en rangert hypotese takstpersonen avgjør. |

## 4. Anbefaling

**Bygg en utvidet Plan A: «Guided Single-Pass + Deterministic Signal
Injection».** Ingen ny tjeneste, intet nytt kall, ingen kode-motor som
produserer «fasit». Utvid det eksisterende ett-kalls-pipelinet med (a)
deterministisk signalinjeksjon og (b) et rikere, men fortsatt LLM-styrt,
skjema — nøyaktig trinn (a) i `docs/produktdesign-aarsaksbildet.md`s
byggerekkefølge, pluss å tette `buildingYear`-hullet som allerede finnes.

Behold Plan Bs idé om en ren, testbar kode-motor for **fremtiden** — men gi
den korrekt rolle: som `docs/produktdesign-aarsaksbildet.md` trinn (d),
en spørsmålswizard i appen som **mater** årsaksbildet med observasjoner,
aldri en motor som overstyrer AI-ens differensialdiagnose. Den bør ikke
bygges før spørretre v2 er levert og validert av eksperten, og trinn
(b)/(c) er i bruk hos piloten.

## 5. Handlingsplan

### Steg 0 — Deterministisk signalinjeksjon (lite, tetter et reelt hull)

- `ai-engine/main.py`: tre `report_meta`s byggeår og befaringsdato inn i
  kontekst-oppbyggingen som sendes til Gemini (i dag brukes kun `project`,
  ikke `report_meta`, i `contents`-oppbyggingen rundt linje 215-221).
- `ai-engine/prompt.py`: legg til en liten hjelpefunksjon som formaterer
  disse signalene som eksplisitt tekst i `build_inspector_context()` —
  f.eks. «Bygningen er oppført i 1965 (før 1970 → avløpsrør i støpejern bør
  vurderes for korrosjon; før 1979 → sjekk om dampsperre mangler under
  betongplate)» og sesong («Befaring i januar → kondens er sesongmessig
  sannsynlig»).

### Steg 1 — Skjemautvidelse (`ai-engine/models.py`)

- Legg til en `source_category`-enum: `NEDBOR`, `TRYKKSATTE_ROR`,
  `AVLOPSROR`, `KONDENS`, `UTETT_BAD`, `USIKKER` — der `USIKKER` er et
  fullverdig, forventet utfall for de ~2 % som faller utenfor modellen
  (aldri tving en kategori, jf. «ærlig fallback» i kunnskapsdokumentet).
  Behold `source: str` for fritekstbeskrivelsen ved siden av kategorien.
- Legg til et strukturert `acute_or_gradual`-felt (i dag kun fritekst i
  `cause`/`description`, til tross for at det er en sentral
  forsikringsgrense).
- **Utsett** den fulle `hypotheses: List[...]`-listen (trinn b i
  produktdesignet) til en egen, separat validert endring — hold én
  variabel av gangen mot valideringsbatteriet, i tråd med den etablerte
  arbeidsmetoden i `docs/valideringscaser.md`.
- **Ikke** legg til et rått `reasoning_path`-felt (Geminis Plan A-forslag)
  — femstegs kjede-av-tanke-metodikken finnes allerede som prompt-
  instruksjon; å tvinge den inn som strukturert output øker tokenkost uten
  at noen UI i dag konsumerer et resonneringsspor. Vurder dette når
  kontrollflaten («Årsaksbildet», trinn b) faktisk trenger å vise det.

### Steg 2 — Promptoppdatering (`ai-engine/prompt.py`)

- Fold de fem kildene og tre skillesignalene fra
  `docs/fagkunnskap-vannskadeaarsaker.md` inn i `main_prompt()`s tekniske
  sjekkliste, som en utvidelse av — ikke erstatning for — dagens
  barriere-svikt/akutt-gradvis/terreng/kondens-punkter.
- Instruer eksplisitt: velg `source_category` kun ved utvetydig evidens,
  ellers `USIKKER` med fritekst i `source` — speilet mot kunnskaps-
  dokumentets «modellen dekker ~98 %, resten skal falle ut som usikker».
- Bump `PROMPT_VERSION` (samme mønster som i dag).

### Steg 3 — Validering (obligatorisk før pilottrafikk)

- Kjør alle 11 casene i `docs/valideringscaser.md` mot ny prompt/skjema.
- Utvid scoringsrubrikken med en kilde-kategori-korrekthet-dimensjon ved
  siden av de fem eksisterende (Årsak, Akutt/gradvis, Hypotese-disiplin,
  Sitatport, Evidenstro).
- `python3 -m py_compile ai-engine/main.py ai-engine/server.py` som
  eksisterende sanity-sjekk (CLAUDE.md).

### Steg 4 — Nedstrøms kobling

Koblingen er nå implementert og har focused regression coverage:

- `apps/api/src/routes/share.js` — `sourceCategory` og `acuteOrGradual` er
  med i mottakerens whitelist og felt-diff.
- `apps/mobile/src/features/projects/reportVersions.ts` — de nye
  snake_case-feltene mappes til camelCase og følger draft/final-versjonen.
- `apps/mobile/src/features/projects/types.ts` — `ReportContent` og
  `REPORT_CONTENT_FIELDS` inneholder begge feltene.
- `ai-engine/main.py` — Google Doc-malen kan bruke
  `{{damage.cause.source_category}}` og
  `{{damage.cause.acute_or_gradual}}` (samt korte alias uten `.cause`).

Dette er trinn (b) i `docs/produktdesign-aarsaksbildet.md`. Det gjør feltene
tilgjengelige for videre produktflater uten å innføre en deterministisk
diagnosemotor eller omgå takstpersonens godkjenning.

### Steg 5 — Eksplisitt utsatt

- `executeWaterDamageTree()`-kodemotoren og Årsaksveiviseren (spørretre-UI
  i appen) — blokkert på at eksperten leverer et ferdig spørretre v2, og på
  at trinn (b)/(c) er validert hos piloten. Se §3.6 for hvordan denne
  komponenten bør rolleplasseres når den til slutt bygges: som
  evidensinnsamling, aldri som diagnoseoverstyring.

## 6. Verifisering av denne endringen

Følgende sjekker gjelder for den implementerte koblingen:

- `python3 -m py_compile ai-engine/main.py ai-engine/server.py`
- Full kjøring av `docs/valideringscaser.md`s 11 case, sammenlignet mot
  eksisterende score før endringen (terskel: ikke under 44/55 totalt, jf.
  dokumentets egen regel).
- Ved endring i nedstrøms felt: `cd apps/mobile && npx tsc --noEmit`, samt
  `apps/api/test/e2e-share.sh` og `apps/api/test/e2e-tenant-isolation.sh` hvis
  delingsveien berøres.
