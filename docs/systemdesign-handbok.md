# Systemdesign-håndbok for DocrAI

28. august 2026. Et selvstendig oppslagsverk over systemdesign-konseptene
teamet trenger — skrevet med egne ord, ordnet etter *våre* problemområder,
og med DocrAI som gjennomgående eksempel. Fagstoffet her er allmenn
ingeniørkunnskap (akademiske papers, åpen kildekode-dokumentasjon,
offentliggjorte arkitekturer); dokumentet er ikke en gjengivelse av noen
enkelt bok. Vil du ha en leseguide til Alex Xus bok spesielt, se
`docs/system-design-konseptkart.md`; anvendelsen på kodebasen vår ligger i
`docs/system-design-laerdommer.md` og `docs/ddia-laerdommer.md`.

---

## 1. Estimering og kapasitet

### 1.1 Overslagsregning som disiplin

Poenget med et kapasitetsoverslag er ikke tallet, men at antakelsene står
skrevet ned ved siden av det. Metoden:

1. Skriv ned antakelsene (antall brukere, handlinger per bruker, størrelse
   per objekt) — avrundet til tall du kan regne med i hodet.
2. Regn med toerpotenser: 1 KB ≈ 10³ B, 1 MB ≈ 10⁶, 1 GB ≈ 10⁹,
   1 TB ≈ 10¹². Presisjon utover én gjeldende siffer er falsk trygghet.
3. Døgn ≈ 86 400 s ≈ 10⁵ s. Forespørsler/dag ÷ 10⁵ ≈ snitt-QPS;
   topp ≈ 2–3× snitt.
4. Sammenlign resultatet med noe kjent («én Postgres klarer dette med god
   margin» / «dette sprenger disken på tre måneder»).

**DocrAI-regnestykke (gjør dette med ekte tall fra `cost_events`):**
5 aktive takstpersoner × 2 befaringer/dag × (10 notater + 15 foto + 1
video à 200 MB) gir ~2 GB media/dag og under 0,01 QPS mot API-et. Det er
derfor kapasitetsproblemet vårt heter *disk og AI-kostnad*, ikke trafikk —
og hvorfor sharding-diskusjoner er støy for oss (se §3.4).

### 1.2 Latenstall å kunne utenat

Størrelsesordener (fra Jeff Deans klassiske «numbers every programmer
should know», justert for moderne maskinvare):

| Operasjon | Størrelsesorden |
|---|---|
| L1-cache / minnereferanse | ns–100 ns |
| Komprimere 1 KB | ~µs |
| SSD-lesing (tilfeldig) | ~100 µs |
| Lese 1 MB sekvensielt fra minne | ~10 µs |
| Lese 1 MB sekvensielt fra SSD | ~1 ms |
| Rundtur i samme datasenter | ~0,5 ms |
| Rundtur Europa–USA | ~100–150 ms |

Konsekvensene som betyr noe: minne slår disk, sekvensielt slår tilfeldig,
komprimér før du sender over nett, og *antall rundturer* dominerer opplevd
latens for en klient (derfor batcher synkingen vår per prosjekt, ikke per
felt).

### 1.3 Tilgjengelighets-niere

Tilgjengelighet på 99 % høres bra ut og betyr 3,65 døgn nede per år.
Hver ekstra nier deler nedetiden på ti: 99,9 % ≈ 8,8 timer/år, 99,99 % ≈
53 min/år. To ting følger: (a) en kjede er aldri bedre enn sitt svakeste
ledd — API-et vårt kan ikke love mer enn Render + Postgres + Gemini
sammen leverer; (b) hver nier tidobler driftskostnaden (redundans, vakt,
failover-øvelser). For en pilot er ærlig 99 % med god feilhåndtering
riktigere enn dyr jakt på niere ingen har bedt om.

---

## 2. Trafikk inn: kanten av systemet

### 2.1 Lastbalansering og tilstandsløshet

En lastbalanserer fordeler forespørsler over flere servere og gir
failover ved frafall — men den forutsetter at serverne er **utbyttbare**,
og det er de bare hvis web-laget er *tilstandsløst*: ingen sesjonsdata i
serverminnet, all tilstand i delt lager. Tilstandsløshet er derfor
forutsetningen for både horisontal skalering og enkel failover, og den
billigste arkitekturegenskapen å sikre *tidlig* (å ettermontere den er
en omskriving). **DocrAI:** API-et er allerede tilstandsløst
(`tester_token` per forespørsel, alt i Postgres) — vi kan gå fra én til
to instanser den dagen det trengs uten kodeendring. Det er grunnen til
at vi ikke trenger lastbalansereren *nå*, men aldri må bygge oss bort
fra muligheten.

### 2.2 Cache

Cache er riktig for data som leses ofte og endres sjelden. Beslutningene
som må tas *før* cachen innføres, ikke etter:

- **Invalidering:** TTL (enkelt, men serverer foreldet data inntil
  utløp) eller eksplisitt invalidering ved skriving (presist, men nå har
  du to skrivesteder — og dermed et konsistensproblem).
- **Feilmodus:** hva skjer når cachen er kald eller død? Hvis alle
  forespørsler da treffer databasen samtidig («thundering herd»), har
  cachen gjort systemet *skjørere*. Mottiltak: forespørselskollaps
  (én henter, resten venter) eller spredte TTL-er.
- **Aldri eneste sannhetskilde.** En cache skal kunne slettes uten datatap.

**DocrAI:** vi har bevisst ingen cache-tjeneste. Lesemønsteret vårt (én
takstperson leser sine egne prosjekter) har ingen delt hot-set, og
Postgres-spørringer på `tester_token`-indeks er milliskundearbeid.
Cache-kandidaten som *finnes* er ferdigrendrede delingssider — men først
når visningstallene sier at det monner.

### 2.3 CDN

Et CDN cacher statisk innhold geografisk nær brukeren og tar
volumtrafikken vekk fra origin. Nøkkelvalg: TTL per innholdstype,
versjonerte filnavn så deploy = invalidering (hash i filnavnet, slik
Expo-eksporten vår allerede gjør), og en definert fallback når CDN-et
feiler. Kostnadsprofil: du betaler per GB utlevert — for skjevfordelt
innhold (noen få filer står for nesten alt volum) er CDN billig; for
langhalen kan origin-serving være billigere. **DocrAI:** docrai.io ligger
på Renders statiske hosting med CDN innebygd; punktet er dekket av
plattformvalget.

### 2.4 Rate limiting

Formålet er å beskytte dyre ressurser og holde én bruker fra å fortrenge
de andre. Algoritmene, med egenskapene som faktisk skiller dem:

- **Token bucket:** bøtta fylles med jevn rate opp til et tak; hvert kall
  koster et token. Tillater korte støt (bøtta kan tømmes), håndhever
  snittrate. To parametre (rate, bøttestørrelse), O(1) minne. Standardvalget.
- **Leaky bucket:** kø med fast uttaksrate. Glatter trafikken helt, men
  straffer støtvis bruk med kø-latens.
- **Fast vindu:** teller per tidsvindu. Trivielt, men tillater dobbel
  rate over vindusgrensen (slutten av ett vindu + starten av neste).
- **Glidende vindu-logg:** tidsstempel per kall, presist, men minne per
  kall — dyrt ved høy rate.
- **Glidende vindu-teller:** vekter forrige vindus telling inn i
  inneværende; godt kompromiss mellom presisjon og minne.

Kontrakten mot klienten er like viktig som algoritmen: svar **429** med
`Retry-After`/`RateLimit-*`-headere, og la klienten vise «vent til
kl. HH:MM» i stedet for en generisk feil. Og *nøkkelvalget er et
produktvalg*: per IP beskytter mot fremmede, per bruker/token fordeler
rettferdig mellom egne brukere. I distribuert drift (flere API-instanser)
må telleren bo i delt lager med atomiske operasjoner — og du må velge om
limiteren feiler åpent (slipp gjennom) eller lukket (avvis) når det
delte lageret er nede.

**DocrAI (rettet 29.09.2026):** `heavyLimiter` er 30 kall/15 min *per tester*
(`apps/api/src/middleware/rateLimiters.js:39-56`; IP bare for offentlige flater uten
token), svarer 429 med `retryAfterSeconds`, og appen viser ventetiden
(`apps/mobile/app/projects/[id].tsx:825-833`). Bakgrunn i
`docs/system-design-laerdommer.md` del 2.1.

---

## 3. Data: lagring, replikering, fordeling

### 3.1 Replikering (kortversjonen — dybden i `ddia-laerdommer.md`)

Én leder (alle skrivinger ett sted; enkel å resonnere om; failover er
smertepunktet), flere ledere (skriv nær brukeren; konflikter må flettes),
lederløs (quorum: N replikaer, W skrive- og R lese-bekreftelser, W+R>N
gir overlapp). Asynkron replikering kan miste bekreftede skrivinger ved
failover; replikeringsforsinkelse krever lesegarantier som
read-your-writes hvis brukeren skal se sin egen skriving.

**DocrAI:** klient↔server-synkingen vår *er* en fler-leder-topologi
(hver enhet skriver lokalt, flettes per notat med tombstones) — det er
derfor flettereglene og `updatedAt`-vaktene i `projectSync.ts` er
sikkerhetskritisk kode og ikke «bare synk».

### 3.2 Konsistent hashing

Problemet: `hash(nøkkel) mod N` flytter nesten alle nøkler når N endres
med én. Løsningen: hash både servere og nøkler til samme sirkulære
tallrom; en nøkkel eies av første server medurs. Da flytter bare naboens
nøkler ved til-/frafall — O(K/N) i stedet for O(K). Jevn fordeling krever
**virtuelle noder**: hver fysisk server får mange punkter på ringen
(flere punkter = jevnere fordeling = mer rutingmetadata). Brukes overalt
der nøkler må fordeles over en dynamisk servermengde: distribuerte
cacher, Dynamo-ætlingene, Kafka-partisjonering på konsumentsiden.

**DocrAI:** ingen anvendelse i dag — vi har én database. Står her fordi
det er den vanligste «hvorfor ikke bare mod N»-samtalen i faget.

### 3.3 Unike ID-er i distribuerte systemer

Alternativene og prisen for hvert:

- **Auto-increment i databasen:** enkelt, sortert — men krever rundtur
  til databasen og sentraliserer skriving.
- **UUID (tilfeldig):** genereres hvor som helst uten koordinering;
  128 bit; usortert (indeks-lokalitet lider ved enorme volum). CSPRNG-
  varianten er også ugjettbar — det er et *sikkerhetsegenskap*.
- **Billettserver:** én tjeneste deler ut id-blokker; enkel, men et
  sentralt avhengighetspunkt.
- **Snowflake-mønsteret** (fra Twitters åpne kildekode): 64 bit =
  tidsstempel (41) + node-id (10) + sekvensnummer (12). Tidsordnede
  id-er uten koordinering per id — men avhengig av klokkene: en klokke
  som stilles bakover kan gi duplikater, så noden må nekte å generere
  til klokka har tatt igjen seg selv.

**DocrAI:** CSPRNG-UUID-er er riktig for oss — vi trenger ugjettbarhet
(media-id-er inngår i signerte URL-er), ikke tidssortering.

### 3.4 Partisjonering/sharding — og hvorfor vi ikke gjør det

Sharding deler data over flere maskiner etter en nøkkel. Prisen:
resharding når fordelingen endrer seg, hot keys (én stor kunde på én
shard), tap av joins og transaksjoner på tvers. Rekkefølgen i praksis er
alltid: større maskin → leseréplika → cache → *og først så* sharding.
**DocrAI:** JSONB per `tester_token` i én Postgres er riktig til langt
forbi pilotskala; vår neste skaleringsknapp er instansstørrelse, ikke
arkitektur.

---

## 4. Sanntid, køer og varsling

### 4.1 Klient-oppdateringsmønstrene

Fire mønstre, i stigende kompleksitet:

- **Polling:** klienten spør med intervall. Enkelt, robust, latens =
  intervallet, bortkastede kall når ingenting skjer.
- **Long polling:** serveren holder forespørselen åpen til noe skjer
  eller timeout. Nær-sanntid uten varige tilkoblinger; god der
  hendelser er sjeldne (filsynk-varsling er klassikeren).
- **Server-Sent Events:** énveis strøm server→klient over vanlig HTTP.
- **WebSocket:** varig toveiskanal. Riktig for chat og samskriving —
  men gjør serveren *tilstandsfull*: nå må noe vite hvilken server som
  holder hvilken bruker (service discovery), og failover må flytte
  tilkoblinger.

Presence («er hun pålogget?») bygges med heartbeat + terskel: kort
frafall skal ikke blinke offline, og statusendringer skal bare ut til dem
det angår. **DocrAI:** synkingen vår er polling/push-ved-endring, og det
er riktig — vi har ingen toveis sanntidsflate. WebSocket står på
nei-lista til en ekte bruker ber om samtidig samskriving.

### 4.2 Meldingskøer

En kø kobler produsent fra konsument: produsenten svarer raskt, arbeidet
skjer asynkront, og trafikktoppene jevnes ut. Prisen er et nytt system å
drifte og et nytt konsistensspørsmål (hva hvis meldingen behandles to
ganger — eller aldri?). Minimumsdisiplinen for *enhver* asynkron jobb,
kø eller ei:

1. **Idempotens:** samme jobb kjørt to ganger skal gi samme resultat
   (dedup-nøkkel per jobb).
2. **Retry med backoff** — og et tak, med en synlig hovedbok over det
   som ga opp.
3. **Hovedbok over utfall** («hva skjedde med jobb X») som kan leses
   uavhengig av køen.

**DocrAI:** rapportgenereringen har allerede 1–3 uten kø
(`report_generations`-hovedboka, in-flight-vakt, ledger-rad ved feil).
En kø legges først til når det finnes flere konsumenter eller
jobbtyper — ikke før.

### 4.3 Varsling til brukere (push/SMS/e-post)

Hver kanal har en tredjepart (APNs/FCM, SMS-leverandør, e-post) med egne
feilmoduser — koble dem løst så én treg kanal ikke stopper de andre.
Kravene som gjør et varslingssystem voksent: samtykke/opt-in som
førsteklasses data, deduplisering (samme hendelse varsler én gang),
retry ved leverandørfeil, per-bruker-tak (varsling må ikke bli plaging)
og leveringssporing. **DocrAI:** ingen push-kanal i dag; når «rapporten
er klar»-varsling en dag bygges, er sjekklista over kravlista.

---

## 5. Medier og filer

### 5.1 Opplasting av store filer

Én stor fil i ett HTTP-kall er enklest og riktig opp til et punkt; forbi
det trengs **chunket, gjenopptakbar opplasting**: klienten deler fila i
biter, laster dem opp (gjerne parallelt), og kan fortsette fra siste
bekreftede bit etter brudd. Standardprotokollen er tus — ikke bygg din
egen. **Pre-signerte URL-er** lar klienten laste rett til objektlager
uten å gå via API-serveren; det sparer båndbredde på API-et, men flytter
validering (størrelse, type, eierskap) ut av serveren din — en reell
sikkerhetskostnad. **DocrAI:** 500 MB single-shot i dag; beslutningen om
gjenopptakbarhet er bevisst utsatt til felttallene foreligger
(`system-design-laerdommer.md` del 2.3), og pre-signert opplasting står
på nei-lista fordi server-mediering er der tenant-isolasjonen håndheves.

### 5.2 Delta-synk og deduplisering

For filer som *redigeres* er blokknivå-synk riktig: del fila i blokker,
hash hver blokk, overfør bare endrede blokker (rsync-familien). For
filer som er *uforanderlige bevis* — våre foto/video — er filnivå-hash
riktig granularitet: sha256 ved opplasting gjenkjenner duplikater og
gjør re-forsøk billige. Lagringsøkonomien forøvrig: tak på antall
versjoner, kalde data til billigere lager, dedup før begge.

### 5.3 Prosessering som pipeline (DAG)

Tung medieprosessering (transkodering er skoleeksempelet) modelleres som
en rettet asyklisk graf av steg med egne køer og workere: feil ett sted
rerunner bare den grenen, og stegene skalerer uavhengig. Overførbart
prinsipp selv uten video-plattform: **del pipelinen der feil skal kunne
isoleres.** DocrAI-rapporten har allerede naturlige ledd (transkribering
→ analyse → dokumentbygging → eksport) — hvis motoren en dag skal
rekjøre *ett* ledd i stedet for hele kjeden, er det denne modellen.

### 5.4 Sterk konsistens der det kreves

Filsynk og dokumentdeling tåler ikke at to enheter ser ulike «siste
versjon» — metadata må da bo i et transaksjonelt lager, og cacher må
holdes konsistente med det (invalider ved skriving, ikke TTL-gjett).
**DocrAI:** dette er begrunnelsen bak godkjenningsporten vår:
godkjenningsstatus leses alltid fra Postgres i forespørselsøyeblikket
(410-porten fra PR #15), aldri fra en kopi.

---

## 6. Lesetunge mønstre (referanse — ingen DocrAI-anvendelse i dag)

- **Fanout on write vs. on read:** forhåndsbygg leserens strøm ved
  publisering (rask lesing, dyr skriving, kjendisproblemet) eller bygg
  ved henting (billig skriving, treg lesing); hybrid i praksis — push
  for de fleste, pull for kontoer med enorme følgerskarer.
- **Autocomplete:** trie med cached topp-k per node gjør forslag til
  O(prefikslengde); tria er en avledet struktur som gjenbygges fra
  logger i batch, aldri sannhetskilden.
- **Korte URL-er:** base62 av unik id (kort, forutsigbar) vs. hash med
  kollisjonshåndtering; 301 (permanent, nettleseren cacher — mister
  telemetri) vs. 302 (hvert klikk treffer tjenesten). Vår delingsflate
  har sterkere krav (PIN, utløp, revokering) og er allerede løst.

---

## 7. Metode: slik angripes et designproblem

1. **Avgrens før du foreslår.** Hvilket problem, for hvem, hvilket
   volum, hva er eksplisitt utenfor? Å designe for krav ingen har stilt
   er samme feil som å overse stilte krav.
2. **Skisser helheten og få enighet** før dypdykk — en boks-og-pil-
   skisse alle nikker til er verdt mer enn et perfekt delsystem ingen
   har bedt om.
3. **Dypdykk der det gjør vondt** — flaskehalsen, feilmodusen,
   konsistenskravet. Resten er lister.
4. **Navngi svakhetene selv:** hva knirker først når lasten tidobles,
   hva er single point of failure, hva er ikke løst. Den som peker på
   egne hull først, eier samtalen om dem.

Dette er samme form som playbookens «valider før du bygger» og
`/steelman`-/`/gaps`-kommandoene — og malen for hvordan vi svarer Ocab
når de ber om en ny funksjon.

---

## Vedlikehold

Dokumentet oppdateres når vi *tar i bruk* et mønster herfra (flytt da
avsnittet nærmere koden: fil:linje i laerdommer-dokumentene) eller når
et nytt problemområde blir reelt for produktet. Det skal forbli et
oppslagsverk i egne ord — kildehenvisninger til åpne primærkilder er
velkomne; gjengivelse av opphavsrettsbeskyttet materiale er ikke.
