# Verdens beste løsning — syntese av alle kildene

*27. september 2026. Til eierne (Anders, Fredrik, William). Beslutningsunderlag,
ikke vedtak.*

**Hva dette er:** én samlet analyse av alt vi har lest, lært og målt — 13
lærdomsnotater i `docs/` (DDIA, Alex Xu, systemdesign, TIME100 AI,
taleteknologi-fagdagen, The Founder's Playbook, byggepraksis, årsaksbildet,
fagkunnskap, modellbytte), 19 markeds- og pilotdokumenter, de fem
startup-bøkene (Blank/Dorf, Ries, Maurya, Bland/Osterwalder,
Osterwalder/Pigneur), personas, reisekart og firelinse-matrisen — pluss et
nytt nettsøk i september 2026 på tre felt: AI-skribenter og menneske-i-løkka,
skade-/restaureringsteknologi, og vertikal AI-strategi og regulering.

**Hvordan lese det:** hver påstand er belagt med `fil:linje` i repoet eller en
URL (vedlegg B). Eksterne kilder er merket *verifisert* (siden ble åpnet) eller
*uverifisert* (kun søkeutdrag). Leverandørtall er leverandørtall. Hypoteser
kalles hypoteser (CLAUDE.md, regel 6).

**Et funn om kildene selv:** repoet har **ingen YouTube-kilder** — «YouTube» i
`docs/system-design-konseptkart.md:167` er et bokkapittel. Foredrag og podkaster
er derfor hentet inn nå (vedlegg B3).

---

## 0. Konklusjonen på én side

Verdens beste løsning i denne kategorien er **ikke den raskeste
rapportskriveren**. Den er **den mest forsvarbare årsaksrapporten**: den som
tåler forsikringsselskapets egen AI-kontroll, en tvist og en rettssal — og som
en fagperson kan godkjenne på minutter fordi hvert utsagn peker på beviset sitt.

Tre ting fra kildene bærer den konklusjonen:

- **Tidsbesparelsen er mindre enn alle tror.** Den største randomiserte
  studien av AI-skribenter (UCLA, NEJM AI, 238 leger) fant 9,5 % mindre tid på
  notater for det beste verktøyet og ikke signifikant effekt for det andre; en
  politipilot (Anchorage) droppet AI-rapporter fordi gjennomgangen spiste
  gevinsten. *Verifisert.* Å selge «2 timer blir 15 minutter» er å love noe
  ingen i nabokategoriene har målt.
- **Det bransjen faktisk mangler, er betaling og færre krangler.** 60–90
  dagers betalingstid er «nå standard» i restaurering, og forsikringsselskapene
  bruker allerede AI til å lete etter svakheter i entreprenørens dokumentasjon.
  *Verifisert.* En rapport som er vanskelig å angripe, er verdt mer enn en
  rapport som er rask å skrive.
- **Feilen vi allerede har sett, er kategoriens kjente feil.** I første
  skarpe sak adopterte modellen huseiers teori og bommet
  (`docs/pilotlogg-ocab.md:38-46`). Forskningen kaller det sykofanti og
  automasjonsbias, og den rammer også erfarne fagfolk (RSNA: selv svært erfarne
  radiologer falt til 45,5 % treff med feil AI-forslag). *Verifisert.*

**De fem beslutningene som avgjør om vi blir best:**

1. **Posisjon:** selg «forsvarbar rapport → raskere oppgjør, færre
   tvister, mindre kveldsarbeid» — ikke «raskere skriving».
2. **Produktkjerne = evidensdisiplin:** hvert utsagn lenket til kilde, eierens
   teori merket som hypotese, årsak gradert etter støtte, «usikker» som
   fullverdig svar, Byggforsk-sitat kun når det faktisk støtter påstanden.
3. **Gjennomgangen er produktet:** design mot automasjonsbias der det koster
   mest (årsak og akutt/gradvis), og mål gjennomgangstid inkludert redigering.
4. **Vollgraven er arbeidsflyt + tillit + distribusjon**, ikke «data» alene.
   Spor B (årsaksmodell) krever eget rettsgrunnlag — Ocab kan ikke gi det for
   huseierne.
5. **Mål før vi bygger mer:** et lite, binært eval-sett styrt av Sigurd, og en
   pilot med baseline hos Ocab. Alt annet i denne analysen er underordnet det.

---

## 1. Hva vi faktisk vet — evidenstrappen

Playbooken advarer mot å forveksle bygging med validering
(`docs/founders-playbook-docrai.md:47-52`). Slik står det:

| Nivå | Hva | Kilde |
|---|---|---|
| **Belagt (kode)** | Godkjenningsport på server, tenant-isolasjon, signerte medie-URL-er | `CLAUDE.md` |
| **Belagt (kode)** | AI-utkast arkiveres uendret som `reportDraft`; diffen mot `reportFinal` beregnes | `docs/inkorporering.md:57-60`, `apps/api/src/routes/share.js:115-135` |
| **Belagt (kode)** | «Tid til godkjent» regnes per sak | `apps/mobile/src/features/projects/metrics.ts:31-43` |
| **Belagt (kode)** | Prompten behandler eierens antakelser som hypoteser | `ai-engine/prompt.py:422` |
| **Belagt (kode)** | Sitatport + `prompt_version` bokføres per kjøring | `docs/taleteknologi-laerdommer.md:126-136` |
| **Belagt (pilot)** | Én skarp sak med fasit: modellen fulgte eierens teori og bommet | `docs/pilotlogg-ocab.md:33-46` |
| **Belagt (pilot)** | Feltfriksjon: 8 MB-grense, ~30 bilder per sak, synk, «lagre glemmes 10/10» — alle rettet | `docs/pilotlogg-ocab.md:119-128` |
| **Belagt (pilot)** | LiDAR-test: ~3 mm avvik på 5 m (én bruker) | `docs/pilotlogg-ocab.md:103-104` |
| **Påstått** | «2–3 timer per manuell rapport», timepris 1 200–1 500 kr | `apps/api/src/om-page.html:204-205` |
| **Hypotese** | «2 t → 15 min» per rapport | `docs/statusrapport-aug-2026.md:45` |
| **Hypotese** | Betalingsvilje, priser, trakt-rater | `docs/beslutningsnotat-prising.md:64-65`, `docs/kampanje-takstpersoner.md:35-41` |
| **Hypotese** | Personas Geir/Kristian/Aksel (proto-personas, to informanter) | samtalen 25.–27.09 |
| **Ikke målt** | Valideringscasene: resultatarket er tomt | `docs/valideringscaser.md:266-272` |
| **Ikke målt** | WER på feltlyd: venter på klipp og samtykke | `docs/taleteknologi-laerdommer.md:152-161` |

**Lesning:** koden er langt foran evidensen. Nesten all brukerinnsikt kommer
fra én person (Sigurd) og én skarp sak. Det er ikke en svakhet å skjule — det
er neste arbeidsoppgave.

---

## 2. Nordstjernen og målestokken

**Nordstjerne:** *en årsaksrapport som takstpersonen står inne for, godkjent på
under 30 minutter, som forsikringsselskapet ikke sender tilbake.*

Den er målbar. Eksisterende go/no-go-forslag (`docs/avklaringer-og-roller.md:16-21`)
dekker fart og redigering; kildene sier vi mangler tre mål for *kvalitet og
utfall*:

| Mål | Hvorfor | Status |
|---|---|---|
| Median tid til godkjent < 30 min (uke 8) | Fart | Kan leses ut i dag (`metrics.ts`) |
| ≥ 60 % godkjent med < 3 feltendringer | Utkastets kvalitet | Diffen finnes (`share.js:132-135`) |
| **Gjennomgangstid inkl. redigering** | Anchorage/UCLA: det er her gevinsten forsvinner | Ikke målt |
| **Rapporter endret etter godkjenning** | Suki bruker «amended encounters» som KPI | Ikke målt |
| **Andel saker med spørsmål/avslag fra forsikring** | Det bransjen betaler for | Ikke målt — krever Ocab |
| Valideringscasene ≥ 44/55, null feil på disiplin-casene | Årsaksriktighet | Tomt ark |
| Null datatap | Tillit | Ingen hendelser logget |

**Falsk positiv (definert før piloten, jf. `docs/founders-playbook-docrai.md:67-73`):**
testerne sier «nyttig», men rapporten som går til forsikring skrives fortsatt i
den gamle malen — eller godkjenningen blir et stempel uten lesing (se §3.7).

---

## 3. Tretten prinsipper fra kildene

Hvert prinsipp: kilden → hva det betyr for oss → konkret handling.

### 3.1 Valider før du bygger
*Blank/Dorf (kundeoppdagelse), Ries (bygg-mål-lær, innovasjonsregnskap),
Founder's Playbook.* Vi har bygget 16 skjermer før vi har målt verdi
(`docs/founders-playbook-docrai.md:47-52`).
**Handling:** ingen ny funksjon før piloten har baseline. Innovasjonsregnskapet
er tabellen i §2 — ikke antall commits.

### 3.2 Angrip den farligste antakelsen først
*Maurya (Running Lean), Bland/Osterwalder (testkort).* De fire farligste, i
rekkefølge:
1. **Forsikring aksepterer AI-assisterte rapporter.** Ett dokumentert avvik kan
   gi mottaker-veto (`docs/analyse-ai-skribenter.md:132-135`).
2. **Årsaken blir riktig** — Midtgjerdinga sier «ikke ennå».
3. **Tidsbesparelsen er ekte etter gjennomgang.**
4. **Noen betaler** (`docs/founders-playbook-docrai.md:54-58`).

**Handling:** ett testkort per antakelse før desember (§9). Nr. 1 koster én
samtale via Ocab med én oppdragsgiver.

### 3.3 Kilden er sannheten
*Abridge «Linked Evidence»: marker tekst i notatet → samtalen utheves og lyden
spilles (uverifisert støtteside; Abridge-bloggen om sporbarhet er verifisert).
Politiets beviskjede (`docs/taleteknologi-laerdommer.md:29-35`).*
Vi har bildekobling (`source_photo_index`, `ai-engine/models.py:35`) men ikke
tidsstempler — Gemini gir dem ikke (`docs/taleteknologi-laerdommer.md:34-35`).
**Handling:** hver setning i utkastet skal peke på bilde, videosekund eller
måling. Modellvalget etter WER-benken avgjør om tidsstempler kommer «på kjøpet»
(`docs/taleteknologi-laerdommer.md:115-117`).

### 3.4 Eierens teori er en hypotese — også for modellen
*Midtgjerdinga; sykofanti-studie (ortopedi: treff falt fra 78 % til 48 % med feil
hint, uverifisert); Abridge graderer hvert utsagn i fem nivåer, der «Questionable
Inference» stoppes før legen ser notatet (verifisert, leverandørtall 97 %).*
Prompten har regelen (`ai-engine/prompt.py:422`). Men en regel i prompten er
ikke en kontroll.
**Handling:** (a) kildeetikett per utsagn — *eier sier / takstperson observerte /
måling viser*; (b) et graderingssteg som blokkerer at en ren eier-påstand blir
hovedårsak; (c) måles i valideringscasene (sjekkpunkt 3, `docs/valideringscaser.md:23-24`).

### 3.5 «Usikker» er et fullverdig svar — og språket skal være kalibrert
*Fagkunnskap (`docs/fagkunnskap-vannskadeaarsaker.md:50-53`), årsaksbildet
(`docs/produktdesign-aarsaksbildet.md:59-61`), Microsoft HAX G2 og G10 («scope
services when in doubt»), og en studie av 62 811 notatavsnitt der leger oftere
*la til* forbehold enn fjernet dem (preprint, verifisert).*
**Handling:** når evidensen er svak, vis 2–3 kandidatårsaker med «støtter /
svekker», ikke én. Skriv «sannsynlig», «kan ikke utelukkes» fra start.

### 3.6 Et sitat kan gjøre en feil mer overbevisende
*Preprint (arXiv 2608.00817, verifisert): når feil råd kom med kildehenvisning,
falt legers motstand fra 92 % til 34,8 %.*
Dette er en direkte risiko for vårt salgsargument «Byggforsk-henvisninger».
Sitatporten verifiserer at *nummeret finnes*, ikke at det *støtter påstanden*,
og ser bare på første nummer i feltet (`docs/taleteknologi-laerdommer.md:130-133`).
**Handling:** sitat vises bare når det er koblet til en konkret påstand. Les ut
forkastningsraten per `prompt_version` etter piloten (allerede planlagt,
`docs/taleteknologi-laerdommer.md:159`).

### 3.7 Design mot automasjonsbias — der det koster mest
*RSNA (mammografi): feil AI-forslag senket treffet til under 20 % for uerfarne og
45,5 % for svært erfarne (verifisert). NEJM AI: 20 timers AI-opplæring beskyttet
ikke (uverifisert tall). Buçinca m.fl. (Harvard): «cognitive forcing functions»
reduserer overtillit mest — men brukerne liker dem minst (verifisert).*
**Handling:** for **årsak og akutt/gradvis** — og bare der — registrerer
takstpersonen sin egen hypotese (ett trykk) før AI-ens forslag vises. Resten av
rapporten gjennomgås felt for felt uten friksjon. «Aldri blokker fagfolk»
(`docs/produktdesign-aarsaksbildet.md:57-58`) holder: ett trykk er ikke en port.

### 3.8 Arkiver utkastet — og la ingen slå av sikringene
*Axon Draft One lagrer bevisst ikke originalutkastet (EFF, verifisert);
avdelinger slo av sikringene selv (KJZZ, verifisert); California SB 524 krever
nå at AI-utkastet bevares (EFF, verifisert). TIME100-lærdommen: «aldri slett
draft-arkivet» (`docs/time100-ai-laerdommer.md:13-24`).*
Vi gjør allerede det motsatte av Axon (`reportDraft` er uforanderlig).
**Handling:** gjør det til en uttalt garanti: «AI-utkast, godkjent av X kl. Y,
utkast arkivert». Ingen kundeinnstilling kan slå av godkjenningsporten,
arkivet eller merkingen.

### 3.9 Mål gjennomgangen, ikke genereringen
*UCLA (NEJM AI, verifisert), JAMA fem-senter-studie: ~16 min mindre
dokumentasjon per 8 pasienttimer (verifisert; utvalgsstørrelse oppgis ulikt),
Kaiser: tredjedelen av brukerne sto for 89 % av bruken, og ikke-brukere sa
«redigering tok for lang tid» (verifisert).*
**Handling:** logg tid fra «utkast klart» til «godkjent», og antall felt endret.
Forvent at noen få blir tunge brukere — rekrutter dem som ambassadører.

### 3.10 Evals: små, binære, ekspertstyrt
*Husain & Shankar (feilanalyse først, én faglig «velvillig diktator», pass/fail
fremfor skala), Eugene Yan (én evaluator per dimensjon; mål enighet mellom
mennesker først), Anthropic («20–50 enkle oppgaver fra ekte feil er en god
start»). Alle verifisert.*
Vi har batteriet (11 caser × 5 binære sjekkpunkter, `docs/valideringscaser.md:18-31`)
— det er aldri kjørt.
**Handling:** Sigurd er diktatoren. Kjør batteriet på dagens `prompt_version`,
gjør hver godkjent sak med fasit om til et nytt case, og mål enigheten mellom
Sigurd og én kollega på 10 caser — den setter taket for hva AI-en kan måles mot.

### 3.11 Modellnøytral — uten modellabstraksjon
*Pineau via TIME100, a16z/Sivulka («90 prosent riktig er det samme som 100
prosent feil»), modellbytte-runbooken.*
Kildene er enige om målet og uenige om middelet. Runbooken
(`docs/modellbytte-runbook.md`) er riktig nivå for tre personer: kontrakten
(`DamageAnalysis`) er modellnøytral, byttet er en prosedyre. **Handling:** øv
runbooken én gang ved WER-beslutningen, i stedet for å bygge et lag.

### 3.12 Forankre i norsk standard — NS 3515 ved siden av Byggforsk
*NS 3515:2021 «Vann- og fuktskader i bygninger — Skadebegrensning og sanering»
stiller krav til kartlegging, metodevalg, sluttkontroll og dokumentasjon
(standard.no, verifisert). Encircle forankrer sitt AI-omfang i IICRC S500 på
samme måte (verifisert). Sigurd: «Sjekkliste app er hvertfall salgbar til begge
sider av bordet» (`docs/signal-kontraktskontroll-offentlig.md:33`).*
NS 3515 er ikke nevnt i repoet i dag.
**Handling:** en **komplettshetssjekk** før godkjenning: hvilke bilder,
målinger og tidsstempler en påstand mangler — som «Før du drar»-listen i
årsaksbildet (`docs/produktdesign-aarsaksbildet.md:62-63`). Sjekkliste, ikke
motor. (Standarden er opphavsrettsbeskyttet: kun egne formuleringer, samme regel
som for Byggforsk.)

### 3.13 Sikkerhet og personvern før brukere
*CLAUDE.md, fagkartet (`docs/fagkart-lansering.md:124-131`), og Datatilsynet:
en huseier som tar opp en håndverkers besøk er **ikke** dekket av
husholdningsunntaket (verifisert). Vår slutning (ikke verifisert veiledning):
en takstperson som filmer i et hjem er fullt under GDPR.*
**Handling:** informasjon til beboer i appen i opptaksøyeblikket;
databehandleravtale, EU-region og DPIA før ekte saker — slik fagkartet allerede
sier.

---

## 4. Den beste produktformen, steg for steg

Løkken er **fangst → utkast → gjennomgang → levering → læring**. For hvert
steg: beste praksis i verden, hva vi har, hva som mangler.

### Fangst (Geir på knærne i kjelleren, firelinse-matrisen)
- **Beste praksis:** veiledet fangst slår bedre modell — en restaurerings-podkast
  anslår at firmaer bruker «4,5 apper» per vannskade og at «AI kan ikke fikse
  dårlige data» (uverifisert). Encircle Hydro leser fuktmålerverdier fra bilde
  og virker offline (verifisert).
- **Vi har:** romstripe med taksonomi (`docs/inkorporering.md:19`), lokal lagring
  og synk, «Laster opp X av Y».
- **Mangler:** (1) komplettshetssjekk (§3.12); (2) avlesning av fuktmåler fra
  foto — Sigurd spurte allerede om målerbilder (`docs/pilotlogg-ocab.md:92`);
  (3) automatisk synk når dekningen kommer tilbake (i dag ved neste åpning
  eller manuelt); (4) informasjon til beboer (§3.13).

### Utkast
- **Beste praksis:** Abridge graderer og fjerner ustøttede påstander før
  mennesket ser dem; Axon setter inn «[Sett inn]» der modellen mangler detaljer
  (verifisert). Nabla-sjefen: de første 80 % er lette, de siste 20 % er
  produktet (verifisert).
- **Vi har:** strukturert `DamageAnalysis`, hypoteseregel, sitatport, ett
  bevisbilde (`ai-engine/main.py:492-495`).
- **Mangler:** kildeetikett og støttegrad per utsagn (§3.4); «[MANGLER:
  fuktmåling]» i stedet for gjetning (også P1 i `docs/analyse-ai-skribenter.md`);
  2–3 kandidatårsaker når evidensen er svak (§3.5); 3–5 bildeforslag i stedet
  for ett. **Våre «siste 20 %» er årsak og akutt/gradvis.**

### Gjennomgang (der vi vinner eller taper)
- **Beste praksis:** HAX G9 «støtt effektiv korrigering» og G11 «vis hvorfor»;
  PAIR: kalibrér tillit og test tillitsvisninger før bruk (verifisert). En
  preprint fant +7,6 prosentpoeng treff med trafikklys basert på enighet mellom
  tre modeller (verifisert, ikke fagfellevurdert).
- **Vi har:** godkjenning med navn og tid, felt-diff.
- **Mangler:** egen hypotese først for årsak (§3.7); klikk på setning → hør/se
  kilden (§3.3); et enkelt trafikklys der vi kjører analysen to ganger og viser
  uenighet — det gir «bør kontrolleres» uten at modellen må ha konfidens
  (`docs/taleteknologi-laerdommer.md:36-40`).

### Levering
- **Beste praksis:** alle vinnerne eksporterer rett inn i oppdragsgivers system
  (Xactimate/ESX i USA). I Norge er det In4mo — Fremtind, Gjensidige, Tryg m.fl.
  står på kundelisten (in4mo.com, verifisert).
- **Vi har:** PIN-beskyttet deling, godkjenningsport, PDF.
- **Mangler:** eksport til In4mo (B1, `docs/inkorporering.md:76`); merking «AI-utkast,
  godkjent av …» (§3.8); Ocabs egen mal.

### Læring
- **Beste praksis:** Abridge bruker klinikernes rettelser som datahjul og har
  kliniker-forskere i eval-teamet (Latent Space, verifisert). PAIR: «bakgrunnsfeil»
  som verken bruker eller system ser, krever eget stikkprøveregime (verifisert).
- **Vi har:** utkast/endelig-par, `report_generations`, kostlogg.
- **Mangler:** månedlig stikkprøve der en annen fagperson vurderer godkjente
  rapporter blindt; tilbakemeldingsknapp også på *riktige* utkast.

---

## 5. Vollgraven — og spenningen mellom trening og rettsgrunnlag

**Hva kildene sier om vollgraver.** Menlo skiller *defensive* vollgraver
(sertifisering, påkrevd faglig signatur) fra *generative* (data som vokser med
bruk) og foreslår en «klonetest»: kan en klone bygget på dagens beste modeller
slå deg? a16z (Casado/Lauten) advarer om at de fleste «datavollgraver» bare er
skalaeffekter. Bessemer: start i en tilgrensende arbeidsflyt og «fortjen retten»
til kjernen. *Alle verifisert.*

**Anvendt på oss — hva består klonetesten?**
- Prompten og Gemini-kallet: **nei**, kopieres på en uke.
- Godkjenningsporten, arkivet og ansvarsdokumentasjonen: **delvis** — enkelt å
  bygge, men tillit tar tid, og det er dette forsikring vil spørre etter
  (EIOPA-uttalelsen om AI i forsikring, uverifisert utdrag).
- Norsk forankring (NS 3515, Byggforsk-siterbarhet, fem kilder med byggeår som
  prior, `docs/fagkunnskap-vannskadeaarsaker.md:31-37`): **ja, over tid.**
- Et fagmerket eval-sett med fasit fra åpnede vegger: **ja** — men bare hvis vi
  lovlig har rett til å bruke det.
- Distribusjon via In4mo og saneringsfirmaene: **ja**, og det er det vanskeligste
  å ta igjen.

**Spenningen i våre egne notater.** TIME100-notatet kaller utkast/godkjent-parene
«treningsgrunnlag» (`docs/time100-ai-laerdommer.md:22-24`), mens
taleteknologi-notatet sier vi ikke har rettsgrunnlag for å trene på skadesaker
(`docs/taleteknologi-laerdommer.md:24-28`). Kildene avgjør det:
- Som Ocabs **databehandler** (spor A) kan vi bare behandle etter Ocabs
  instruks. Bruker vi dataene til egne formål — som å trene en årsaksmodell —
  blir vi **behandlingsansvarlig** for det (GDPR art. 28(10), IAPP, uverifisert
  utdrag).
- Datatilsynet krever **både** eget rettsgrunnlag og en forenlighetsvurdering
  for nye formål (NIF-saken, Lovdata, verifisert). «Forenlig formål» alene holder
  ikke i Norge.
- EDPB (uttalelse 28/2024) åpner for berettiget interesse som grunnlag for
  AI-trening, med tretrinnstest, pseudonymisering og reservasjonsrett
  (verifisert). Trening på video fra private hjem havner trolig på Datatilsynets
  liste over behandlinger som krever DPIA (verifisert liste; vår lesning).

**Anbefaling:**
1. **Spor A:** databehandleravtalen med Ocab skal eksplisitt tillate at
   godkjente saker brukes til kvalitetssikring og eval *av tjenesten til Ocab*
   — og forby andre formål.
2. **Spor B:** eget rettsgrunnlag, egen DPIA, reservasjonsrett for huseier,
   fjerning av ansikter og stemmer som ikke trengs. Vurder å søke Datatilsynets
   regulatoriske sandkasse for akkurat dette spørsmålet.
3. **Salg:** pitch *arbeidsflyt, ansvar og distribusjon* — presenter data som
   kvalitet, ikke som mengde.

**EU AI Act:** Annex III punkt 5(c) omfatter bare risikovurdering og prising i
**liv- og helseforsikring** for fysiske personer — skadetakst i
eiendomsforsikring står ikke der (artificialintelligenceact.eu, verifisert).
Spor A er dermed svært sannsynlig ikke høyrisiko. Forbehold: listen kan endres
ved delegert akt, åpenhetspliktene i art. 50 kan slå inn om innhold når
forbrukere, og AI-forordningen er ikke norsk lov ennå (KI-loven var på høring
2025, verifisert). Høyrisikofristene er utsatt til 2. desember 2027 i den
såkalte Digital Omnibus (Gibson Dunn og Usercentrics, verifisert). Formell
klassifisering bør fortsatt gjøres av jurist, slik fagkartet sier
(`docs/fagkart-lansering.md:131`).

---

## 6. Steelman konkurrentene — og svaret vårt

| Aktør | Det sterkeste argumentet for at de vinner | Svaret vårt |
|---|---|---|
| **Encircle Scope** (lansert 2026) | Samme mønster som oss — beskriv, dokumenter, AI-omfang med IICRC-sitater, eksport til Xactimate, fagperson godkjenner. Påstår 2+ timer spart per jobb og 10 % færre tvister (leverandørtall, verifisert). $350–845/mnd | De er i USA, på IICRC og Xactimate. Norge har NS 3515, Byggforsk og In4mo. Vi må være *best på norsk årsak*, ikke bredest |
| **Verisk XactAI** | Plattformeieren legger selv inn tale-til-sammendrag av befaringsopptak, $29 per bruker (verifisert) | Beviser at In4mo/Solera kan gjøre det samme i Norden. Svar: integrer med In4mo før vi bygger mer — bli leverandøren inn i skinnen |
| **DocuSketch 360AI** | Én 360°-fangst gir plantegning, tale-til-omfang og estimat med konfidens (verifisert) | Fangst og måling blir allemannseie. Vår dybde er årsak og akutt/gradvis — det ingen av dem gjør |
| **Cozmo AI** (YC, sept. 2026) | «AI-arbeidsstyrke» fra skademelding til oppgjør (verifisert) | Tidlig og amerikansk; viser at *kostnad per rapport* blir salgsmålet |
| **Wenn Property** | Taleført, LiDAR, >100 betalende firma, ARR >2 MNOK (investorside, verifisert) | **Rettelse til egne notater:** Wenns investorside beskriver CliVa som klimarisikoanalyse på bygningsnivå (2025–2028), ikke AI-skadevurdering, slik `docs/konkurrentanalyse.md:48-49` sier. Trusselen er lavere enn antatt — men Wenn har forskningspartneren Reco (bygg- og skadesanering), så følg med |
| **Befar** | Fagfolk-bygget, regelverk i felt, 500 kr/rapport | Samme UX-ambisjon, annen jobb (NS 3600 bolighandel). Ingenting nytt funnet i september |
| **iVerdi/Spir** | «AI-assistent og AI-rapportkontroll» varslet i IVIT (verifisert) | Tilstandsrapporter, ikke skade. Følg kvartalsvis |
| **In4mo/Solera** | Eier flyten til de store forsikringsselskapene | Ingen AI-funksjoner på forsiden i dag (verifisert). Eksport er distribusjonskanalen, ikke fienden |

**Steelman mot hele ideen:** «Forsikringsselskapene lar huseier fotografere
selv og hopper over takstmannen» (Hosta AI, Hover — uverifisert). Svaret: vi
eier de *komplekse og omstridte* sakene, der en faglig signatur kreves — nøyaktig
Midtgjerdinga-typen.

---

## 7. Forretningsmodell og ROI i lys av evidensen

- **Enheten er riktig.** Beslutningsnotatets «rapporter igjen»
  (`docs/beslutningsnotat-prising.md:10-13`) er i praksis pris per godkjent
  rapport — det a16z kaller utfallsbasert eller hybrid prising (verifisert).
  Unngå per bruker.
- **ROI-regnestykket bør lene seg på break-even, ikke på «2 timer».** Med
  veiledende priser går det i null ved ~5–10 minutter spart per rapport (egen
  utregning i eier-decket). Det er robust selv om vi bare får skribentenes
  beskjedne ~10 %. Et løfte om 2 timer er det ikke.
- **Selg tre gevinster:** mindre kveldsarbeid (legestudiene finner tydeligst
  effekt på belastning), raskere godkjenning hos forsikring, færre tvister.
- **Prisnivået er ikke risikoen.** Encircle tar $270–845/mnd, magicplan har
  gratisnivå og $13–90/mnd (verifisert). Klagene i kategorien handler om
  prisoverraskelser — hold modellen enkel og forutsigbar.
- **Retning over tid:** Sequoia: «En copilot selger verktøyet. En autopilot
  selger arbeidet» (verifisert). Spor A er copilot — riktig inngang. Å selge
  *den ferdige rapporten* er et senere steg, ikke et nå-steg.
- **Åpent før salgsmøter:** `/om` sier «990 kr/mnd, ubegrensede saker», mens
  beslutningsnotatet har 990 kr = 10 rapporter. Samkjøres (se eier-decket, slide 16).

---

## 8. Pre-mortem: åtte måter DocrAI dør på

| # | Dødsårsak | Tidlig varsel | Tiltak nå |
|---|---|---|---|
| 1 | Forsikring avviser AI-rapporter etter én feil | Spørsmål eller tilbakesending fra oppdragsgiver | Test aksept hos én oppdragsgiver via Ocab i oktober; merking «AI-utkast, godkjent av …» |
| 2 | Feil årsak med overbevisende sitat, og takstpersonen står ansvarlig | Disiplin-casene feiler | §3.4–3.7; ingen skalering før batteriet er grønt |
| 3 | Gjennomgangen spiser besparelsen (Anchorage-mønsteret) | Tid til godkjent flater ut, lav bruk | Mål gjennomgangstid; kutt friksjon i review før alt annet |
| 4 | Ingen betaler (falsk PMF) | «Nyttig», men ingen forpliktelse | Skriftlig forhåndsforpliktelse fra Ocab før betalingsmekanikk bygges |
| 5 | Personvern-stopp | Spørsmål fra Datatilsynet eller kunde | DPA, EU-region, informasjon ved opptak før ekte saker |
| 6 | Plattformeier bygger stemme-til-rapport selv | In4mo/Solera annonserer AI | Bli leverandør inn i In4mo; vær best på årsak |
| 7 | Modell eller kvote svikter i felt | «Transkripsjonen feilet» (skjedde 25.08, `docs/pilotlogg-ocab.md:5-24`) | Betalt nivå, budsjettalarm, øv runbooken |
| 8 | Vi bygger videre i stedet for å validere; selskapet kan ikke signere | Ingen org.nr., ingen signert pilotavtale | Avklaring 1 i `docs/avklaringer-og-roller.md:9-14` før alt annet |

---

## 9. Veien: 90 dager og 12 måneder med bevisporter

Ingen port passeres på entusiasme — bare på tallene i §2.

**Port 0 — «lov å ta inn ekte data» (uke 40–42)**
- Selskap og roller avklart skriftlig; databehandleravtale-utkast; beslutning om
  EU-region; informasjon til beboer i appen.
- Baseline hos Ocab: hvor lang tid tar en rapport i dag, og hvor ofte kommer
  den tilbake fra forsikring?
- Samtykke til feltklipp (Anders) og fasit (Sigurd) → WER-benken kan kjøres.

**Port 1 — «utkastet er til å stole på» (uke 43–48)**
- Kjør valideringsbatteriet på dagens prompt; feilanalyse på 20–50 ekte feil med
  Sigurd som diktator; mål enighet mellom to fagfolk.
- Bygg **bare** det feilanalysen peker på. Sannsynlige kandidater: kildeetikett
  og støttegrad per utsagn, «[MANGLER: …]», 2–3 kandidatårsaker, 3–5 bildeforslag,
  egen hypotese først for årsak, komplettshetssjekk v0 (NS 3515).
- **Krav for å passere:** ≥ 44/55 og null feil på disiplin-casene; median tid til
  godkjent < 30 min; ≥ 60 % med < 3 feltendringer; null datatap.

**Port 2 — «noen betaler» (desember)**
- Forhåndsforpliktelse eller signert betalt pilot; minst én oppdragsgiver har
  sett en AI-assistert rapport uten å avvise den.

**Q1 2027:** In4mo-eksport (spike først); modellvalg etter WER med
tidsstempler; skyggemodus for årsak (aldri vist, logget per `prompt_version`);
pilotfirma nr. 2 — ordliste per firma først når det ber om det
(`docs/taleteknologi-laerdommer.md:161`).

**Q2 2027:** prosjektperioden i Innovasjon Norge avsluttes; beslutning om spor B
(rettsgrunnlag, DPIA, ev. sandkassesøknad).

**12 måneder:** tre betalende firma (`docs/kampanje-takstpersoner.md`), en
publisert pilotstudie med ærlig metode — noe ingen i kategorien har (Encircle
publiserer tall uten metode, verifisert). *Det* er vår markedsføring.

---

## 10. Nei-lista revidert — og beslutningene eierne må ta

**Nei-lista står** (`CLAUDE.md`): ikke eget tegneverktøy, ikke egen
forsikringsskinne, ikke estimatmotor. Kildene styrker den — Verisk, DocuSketch og
Hover gjør estimat og måling til allemannseie.

**Foreslåtte tillegg:**
- Ingen **valgfrie** sikringer (Axon-lærdommen).
- Ingen trening på kundedata uten eget rettsgrunnlag og DPIA.
- Ingen maskinvare-leasing (Meta-analysen: ikke fundbart i Oppstartstilskudd 1,
  og publisering er fortsatt kun for partnere).
- Planskisse som **import** er ikke et tegneverktøy og faller utenfor nei-lista.

**Spenninger som må avgjøres av eierne:**
1. **Hvem selger vi til?** TIME100 sier fagpersonen først
   (`docs/time100-ai-laerdommer.md:32-50`); piloten går via arbeidsgiver.
   *Forslag:* firmaet betaler, fagpersonen er ambassadør — begge må vinne.
2. **Tall eller fagfolk?** WER-regelen (`docs/taleteknologi-laerdommer.md:115-117`)
   og «fagfolk, ikke benchmarks» (`docs/modellbytte-runbook.md:72`) er ikke i
   konflikt: tall for transkripsjon, blind fagvurdering for rapportkvalitet.
3. **Konfidensflagg uten modellkonfidens?** Ja — bruk enighet mellom to kjøringer
   (§4 gjennomgang).
4. **Hvor lenge lagrer vi råvideo og lyd?** Heidi sletter lyd etter
   transkripsjon (verifisert); vi trenger kilden for §3.3. Velg en lagringstid
   og skriv den inn i personvernteksten — ikke omvendt.
5. **Hva gjør vi hvis Port 1 ikke nås?** Justere, pivotere eller avslutte —
   bestem det *før* (`docs/avklaringer-og-roller.md:20-21`).

---

## Vedlegg A — Dokumentgjeld funnet under gjennomgangen

**Rettet 29.09.2026** (samme gren som `docs/nettside-masterplan.md`), bortsett fra
DDIA-punktet, som har fått en statustabell i stedet for å markeres ferdig.
- `docs/systemdesign-handbok.md:142-144` og `docs/byggepraksis-2026.md:95` sier at
  rate-limit er per IP uten 429-håndtering — det er per tester og implementert
  (`docs/system-design-laerdommer.md:61`).
- `docs/founders-playbook-docrai.md:60-65` sier at CLAUDE.md mangler — den finnes.
- `docs/ddia-laerdommer.md` er aldri oppdatert med status, selv om flere av
  tiltakene er gjort (410-sjekk ved lesing i `apps/api/src/routes/share.js:304`,
  10-minutters timeout m.m.).
- `docs/konkurrentanalyse.md:48-49` (og tilsvarende i
  `docs/erfaringer-konkurrenter.md:189`, `docs/konkurrent-selskapsanalyse.md:32`)
  beskriver CliVa som AI-skadevurdering; Wenns investorside sier klimarisiko.
- `docs/valideringscaser.md` sier både «50 totalt» og «/ 55» (11 × 5 = 55).
- `docs/time100-ai-laerdommer.md:64` sier at modellkall bare ligger i ai-engine;
  runbooken lister også `apps/api/src/index.js`.

## Vedlegg B — Kilder

### B1. I repoet
Lærdomsnotater: `ddia-laerdommer.md`, `ddia-konseptkart.md`,
`system-design-laerdommer.md`, `system-design-konseptkart.md`,
`systemdesign-handbok.md`, `time100-ai-laerdommer.md`,
`taleteknologi-laerdommer.md`, `founders-playbook-docrai.md`,
`byggepraksis-2026.md`, `produktdesign-aarsaksbildet.md`,
`fagkunnskap-vannskadeaarsaker.md`, `modellbytte-runbook.md`, `CLAUDE.md`.
Marked og pilot: `pilotlogg-ocab.md`, `valideringscaser.md`,
`avklaringer-og-roller.md`, `inkorporering.md`, `konkurrentanalyse.md`,
`konkurrent-selskapsanalyse.md`, `erfaringer-konkurrenter.md`,
`analyse-usa-proptech.md`, `analyse-ai-skribenter.md`,
`beslutningsnotat-prising.md`, `prising-bruksbasert.md`,
`overslag-pilotokonomi.md`, `statusrapport-aug-2026.md`,
`kampanje-takstpersoner.md`, `soknadsplan-offentlig-finansiering.md`,
`signal-kontraktskontroll-offentlig.md`, `ns3600-og-befar-ui.md`,
`kartlegging-overlevering-ks-hms.md`, `fagkart-lansering.md`.
Bøker (oppsummert i samtalen 25.09): Blank/Dorf, *The Startup Owner's Manual*;
Ries, *The Lean Startup*; Maurya, *Running Lean*; Bland/Osterwalder, *Testing
Business Ideas*; Osterwalder/Pigneur, *Business Model Generation*;
Kleppmann, *Designing Data-Intensive Applications*; Xu, *System Design Interview*.

### B2. Eksterne (hentet 27.09.2026)
**AI-skribenter og menneske-i-løkka**
- Abridge, confabulation-deteksjon — https://www.abridge.com/ai/science-confabulation-hallucination-elimination (verifisert)
- Abridge, Linked Evidence — https://support.abridge.com/hc/en-us/articles/30235128433811-Verify-a-Note-With-Linked-Evidence (uverifisert)
- Abridge, sporbarhet — https://www.abridge.com/blog/building-trusted-healthcare-ai (verifisert)
- Axon Draft One — https://www.axon.com/resources/closer-look-draft-one (verifisert)
- KJZZ, sikringer slås av — https://www.kjzz.org/the-show/2025-08-21/axon-made-safeguards-for-its-ai-police-report-tool-departments-are-turning-them-off (verifisert)
- EFF, Axon lagrer ikke utkast — https://www.eff.org/deeplinks/2025/07/axons-draft-one-designed-defy-transparency (verifisert)
- EFF, California SB 524 — https://www.eff.org/deeplinks/2025/10/victory-california-requires-transparency-ai-police-reports (verifisert)
- EFF, Anchorage — https://www.eff.org/deeplinks/2025/03/anchorage-police-department-ai-generated-police-reports-dont-save-time (verifisert)
- UCLA-RCT, NEJM AI — https://pmc.ncbi.nlm.nih.gov/articles/PMC12768499/ (verifisert)
- JAMA fem-senter-studie — https://www.statnews.com/2026/04/01/ai-ambient-scribes-modest-time-savings-clinical-documentation/ og https://www.healthcaredive.com/news/ai-artificial-intelligence-scribes-reductions-ehr-documentation-time-jama/816400/ (verifisert)
- Kaiser Permanente — https://www.ama-assn.org/practice-management/digital-health/ai-scribes-save-15000-hours-and-restore-human-side-medicine og https://permanente.org/quality-assurance-informs-large-scale-use-of-ambient-ai-clinical-documentation/ (verifisert)
- Leger ankres til LLM-utkast — https://pmc.ncbi.nlm.nih.gov/articles/PMC11829255/ (verifisert)
- RSNA, automasjonsbias — https://www.rsna.org/news/2023/may/ai-bias-may-impair-accuracy (verifisert)
- NEJM AI, opplæring beskytter ikke — https://ai.nejm.org/doi/full/10.1056/AIoa2501001 (uverifisert)
- Trafikklys-preprint — https://www.medrxiv.org/content/10.64898/2026.06.01.26354596v1.full (verifisert, preprint)
- Sitater øker overtillit — https://arxiv.org/abs/2608.00817 (verifisert, preprint)
- Forbehold i notater — https://arxiv.org/abs/2606.00018 (verifisert, preprint)
- Sykofanti — https://pubmed.ncbi.nlm.nih.gov/42166556/ (uverifisert)
- Buçinca m.fl., cognitive forcing — https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml (verifisert)
- Microsoft HAX — https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-how-well-the-system-can-do-what-it-can-do/ og https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-correction/ (verifisert)
- Google PAIR — https://pair.withgoogle.com/chapter/explainability-trust/ og https://pair.withgoogle.com/chapter/errors-failing/ (verifisert)
- Suki, 2025 — https://www.suki.ai/blog/2025-in-review-the-year-ambient-clinical-intelligence-became-foundational/ (verifisert)
- Heidi, sikkerhet — https://www.heidihealth.com/en-us/safety (verifisert)
- Nabla, Lebrun — https://pearhealthcareplaybook.substack.com/p/lessons-from-alexandre-lebrun-ceo (verifisert)

**Skade og restaurering**
- Encircle Scope — https://www.getencircle.com/scoping (verifisert)
- Encircle vannskade — https://www.getencircle.com/solutions/water-mitigation/ (verifisert)
- Encircle ROI-påstander — https://www.getencircle.com/blog/encircle-documentation-max-roi-for-restoration (verifisert, uten metode)
- Encircle, Capterra — https://www.capterra.com/p/160202/Encircle/ (verifisert)
- DocuSketch 360AI — https://www.randrmagonline.com/articles/91898-docusketch-launches-360ai-engine-to-accelerate-workflow-automation-with-instant-floor-plans-and-estimates (verifisert)
- magicplan — https://contractortoolstack.com/software/magicplan/ (verifisert)
- CompanyCam — https://siliconprairienews.com/2026/02/first-companycam-built-the-data-infrastructure-then-a-2b-valuation/ (verifisert)
- Verisk XactAI — https://www.xactware.com/home/xactai.html (verifisert)
- Cozmo AI — https://www.randrmagonline.com/articles/92230-cozmo-ai-launches-ai-workforce-for-property-and-casualty-claims (verifisert)
- Cotality, trender 2026 — https://www.cotality.com/resources/top-restoration-industry-trends-defining-2026 (verifisert)
- KnowHow, bransjerapport — https://tryknowhow.com/resources/state-of-the-restoration-industry (verifisert)
- Poster forsikring kutter — https://www.oneclaimsolution.com/line-items-restoration-adjusters-push-back-on-in-2025/ (verifisert)
- Forsikringens AI mot entreprenører — https://www.randrmagonline.com/articles/92142-where-ai-costs-restorers-and-how-you-can-get-paid-more-by-using-it-right (verifisert)
- Wolf, ansvar — https://www.randrmagonline.com/articles/92152-ai-vs-ri-the-real-battle-is-over-liability-and-profitability (verifisert)
- NS 3515 — https://standard.no/fagomrader/fasilitetsstyring/skadebegrensning-og-sanering-av-vann--og-fuktskader/ (verifisert)
- Wenn, investor — https://wennproperty.no/en/investor (verifisert)
- In4mo — https://www.in4mo.com/ (verifisert)
- iVerdi — https://iverdi.no/oppdateringer/ (verifisert)
- Finans Norge, skadestatistikk 2025 — https://www.finansnorge.no/artikler/2026/02/skadestatistikken-2025-farre-skader-men-hoye-kostnader-nar-uhellet-er-ute/ (verifisert)

**Strategi og regulering**
- Sequoia, «Services: The New Software» — https://sequoiacap.com/article/services-the-new-software (verifisert)
- Menlo, vertikal AI — https://menlovc.com/perspective/software-finally-gets-to-work-the-opportunity-in-vertical-ai/ (verifisert)
- a16z/Sivulka — https://www.a16z.news/p/in-defense-of-vertical-software (verifisert)
- a16z, datavollgraver — https://a16z.com/the-empty-promise-of-data-moats/ (verifisert)
- Bessemer, vertikal AI — https://www.bvp.com/atlas/building-vertical-ai-an-early-stage-playbook-for-founders (verifisert)
- a16z, utfallsbasert prising — https://a16z.com/newsletter/december-2024-enterprise-newsletter-ai-is-driving-a-shift-towards-outcome-based-pricing/ (verifisert)
- Husain & Shankar, evals — https://hamel.dev/blog/posts/evals-faq/ (verifisert)
- Eugene Yan, evals — https://eugeneyan.com/writing/product-evals/ (verifisert)
- Anthropic, evals — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents (verifisert)
- Lenny's Newsletter, evals — https://www.lennysnewsletter.com/p/building-eval-systems-that-improve (verifisert, delvis betalingsmur)
- EU AI Act, Annex III — https://artificialintelligenceact.eu/annex/3/ (verifisert)
- Digital Omnibus — https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ og https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/ (verifisert)
- EIOPA om AI — https://www.eiopa.europa.eu/publications/opinion-artificial-intelligence-governance-and-risk-management_en (uverifisert)
- Datatilsynet, KI-lov på høring — https://www.datatilsynet.no/aktuelt/aktuelle-nyheter-2025/ny-lov-om-ki-sendt-pa-horing/ (verifisert)
- Datatilsynet, lydopptak — https://www.datatilsynet.no/personvern-pa-ulike-omrader/overvaking-og-sporing/lydopptak/privatpersoners-lydopptak/ (verifisert)
- Datatilsynet, DPIA-listen — https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/nar-ma-man-gjennomfore-en-vurdering-av-personvernkonsekvenser/ (verifisert)
- Lovdata, NIF-saken — https://lod.lovdata.no/article/2023/12/Datatilsynet%20mener%20det%20kreves%20et%20nytt%20rettslig%20grunnlag%20for%20behandling%20av%20personopplysninger%20for%20nye%20og%20forenelige%20form%C3%A5l%20%E2%80%93%20tar%20tilsynet%20feil (verifisert)
- IAPP, EDPB 28/2024 — https://iapp.org/news/a/edpb-weighs-in-on-key-questions-on-personal-data-in-ai-models (verifisert)
- IAPP, databehandler og trening — https://iapp.org/news/a/can-processors-use-data-to-train-ai-improve-products-while-remaining-a-processor- (uverifisert)

### B3. Foredrag og podkaster (kun de som faktisk ble funnet)
- Lenny's Podcast, «Why AI evals are the hottest new skill for product builders» (Hamel Husain & Shreya Shankar) — https://youtu.be/BsWxPI9UM4c (lenke verifisert via episodesiden)
- Latent Space, Abridge (14.05.2026) — https://www.latent.space/p/abridge (verifisert): klinikere i eval-teamet, rettelser som datahjul, sporbare utdata, gradvis utrulling hos betrodde kunder
- No Priors, «Conversations Are the Source of Truth in Healthcare» med Abridge-sjef Shiv Rao — https://podcasts.apple.com/us/podcast/conversations-are-the-source-of-truth-in/id1668002688?i=1000701043783 (verifisert)
- NEJM AI Grand Rounds, Shiv Rao — https://ai-podcast.nejm.org/e/rewriting-the-clinical-playbook-dr-shiv-rao-on-scaling-empathy-with-ai/ (verifisert)
- YC Lightcone, «Vertical AI Agents Could Be 10X Bigger Than SaaS» — https://www.youtube.com/watch?v=ASABxNenD_U (uverifisert, innholdet lastet ikke)
- Restoration Domination Ep. 022, CompanyCam — https://www.restorationdomination.com/ep-022-companycam (verifisert, uten skriftlige lærdommer)
