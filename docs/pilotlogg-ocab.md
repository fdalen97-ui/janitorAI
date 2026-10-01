# Pilotlogg — Ocab (Sigurd)

Løpende logg over pilotfunn, rotårsaker og hva de førte til. Nyeste øverst.

## 1. oktober 2026 — teammøte med Sigurd (Fredrik, William, Sigurd)

Kilde: automatisk møtereferat (notetaker). Talerne er delvis feilmerket i
referatet, så sitatene under er tilordnet etter innhold, ikke etter
merkelapp. Det som er usikkert, står som usikkert.

### Hva Sigurd fortalte om forsikringssiden

- **Hvem leser rapporten:** forhandleren/saksbehandleren, som beslutter (noen
  er jurister, fagsjefene oftere), og en rådgiver med byggteknisk bakgrunn
  (ofte takstmann) som vurderer om reparasjonsmetoden er hensiktsmessig.
- **Hva de leter etter:** «opplysninger som gjør at de kan avslå skaden».
  Årsak og **alder på konstruksjonen/skadevirksomheten** avgjør dekning:
  «hadde en sak nå, 300 000 i skader, 52 år gammelt, sak ferdig». Byggeår
  per bygningsdel er altså et vurderingsfelt, ikke bare et signal til
  modellen.
- **Dokumentasjonsstandarden:** ingen minstekrav til antall bilder, men
  «akkurat som en kriminalsak»: funnene skal dokumenteres på stedet slik at
  rapporten «holder i retten». Stikk fuktmåleren i treverket, ta bilde;
  bildeteksten («soverom …») skrives manuelt inn i In4mo etterpå.
  Automatisk bildetekst er en kvalitetsgevinst, ikke bare tidsbesparelse.
- **Reparasjonsomfang:** skrives manuelt i dag («riv/ny gulv hele rommet»
  som standardpunkter nederst i rapporten). To måter å få det automatisk:
  si det i rommet («utskifting av gipsvegg, ca. 7 m²») og la transkripsjonen
  legge det under rommet, eller trykke på et areal i skissen etterpå.

### Hva Sigurd fortalte om Wenn og 3D hos Ocab

- Wenns 3D-visning oppleves som den samme UX-en som In4mos. Ocab er «låst
  til In4mo/MEPS» fordi forsikringsselskapene har bestemt det; en realistisk
  løsning må levere inn i de systemene.
- **3D-modellering gir «ikke kjempemye verdi for oss eller
  forsikringsselskapet».** Behovet er en god 2D-plantegning: på et bygg på
  2000 m² skrev han to timer fritekst-tid til forsikringsselskapet for å tegne
  plantegning. In4mos egen skanning gir rom «to millimeter brede og 20 meter
  lange» når hjørnene ikke matcher. Dette bekrefter «logg, ikke bygg» for
  LiDAR og peker på planskisse-import (nivå 1 i `bim-revit-potensial.md`).
- **300 kr per prosjekt** er fortsatt uavklart: Sigurd vil ikke «mase om
  prisingen» i Ocabs Teams-kanal; han tror det er per rapport der 3D brukes.
  Markedsavdelingen hos Ocab eier avtalen. Står som annenhånds.

### Sigurds forslag: In4mo-formatet som utdata

«Du får DocrAI-rapporten, men den har en twist: den kan produsere det rett
inn i In4mo-formatet. Så kan du sitte og copy-paste det inn i systemene, for
det er fortsatt det vi må gjøre. […] Vi kan levere informasjon i samme
formatet, og det er ren og skjær 15 sekunder copy-paste.» Begrunnelsen er
Wenn-erfaringen: enda en runde der gutta må sitte og copy-paste informasjon
som ikke har samme format. Dette er trinn 1 i integrasjonstrappa fra
`analyse-ai-skribenter.md` og krever ingen API. Skisse i
`docs/in4mo-format-utdata.md`.

### Video fra Meta-briller som fangst

Sigurd har fått videoer fra brillene til å synkronisere (1080p/30, «litt
blurry»; lav oppløsning er ønsket, ikke et problem). Argumentet er hendene:
takstpersonen holder fuktmåler i den ene hånden og telefon i den andre, og
får ikke gjort fagarbeidet. Avtalt: Sigurd filmer en reell sak med brillene
denne eller neste uke (i morgen står et laftet tømmerhus med en varmgang i
strømledning til nettverksskap, altså ikke vannskade). Kravet til pipelinen
er tidsstempler i transkripsjonen slik at riktig videoramme kan hentes, og
en strukturert mal å fylle. Første brukersignal på video som primærkilde;
til nå var pilotsakene kun foto.

### Rapportmal

William ba Sigurd lage en ny, generaliserbar vannskademal med eksempeltekster,
bildeplasser og felter for import, med utgangspunkt i «Water Damage Report
Master Template» i Drive (blåkopi av Sigurds egen rapport). Frist søndag
05.10, oppgave i Trello. Williams hypotese: markedet mangler gode maler, og
en god mal er et produkt i seg selv.

### Nettsiden

Fredrik viste utkastet til ny forside (saksunderlag, eksempelrapport,
pilotskjema, booking). Tilbakemeldinger: Sigurd vil bort fra «Word-dokument
i midten» og over til mørk blå med gult som farge for det kritiske («lyser
opp gult i rapporten»); William er enig og ønsker egen fargepalett som
retningslinje; Fredrik vil ha smilende teamfoto og unngå «AI-slop».
Fargevalget er ikke avgjort, se `docs/beslutninger.md`.

### Roller og arbeidsform (foreslått av Fredrik, ingen innvendinger)

Fredrik: produkt (CPO) og støtte til teknisk. William: CEO/CTO. Sigurd:
kunde- og brukerreisen, eier av rapportmalen og testingen. Anders: finans og
salg. Trello som prosjektstyring (William setter opp). Telefon først,
daglige 15-minuttere bare hvis det trengs; alle melder fra når de står fast
eller mangler oppgaver.

### Oppfølging

- In4mo-format som utdata skisseres (`docs/in4mo-format-utdata.md`) og
  krever at Sigurd bekrefter feltnavn og rekkefølge fra en ekte In4mo-sak.
- Byggeår/alder per bygningsdel løftes inn som vurderingsfelt i gjennomgangen
  (produktmanuset, scene 6).
- Første brillevideo kjøres gjennom pipelinen når William har ny
  databehandling på plass; måles på om riktig ramme hentes til bevispunktene.
- Spørsmålene som fortsatt står åpne fra produktmanuset: hvilke telefoner
  takstfolkene har, hva ledelsen trenger for å si ja etter Wenn-testen,
  hvem hos Ocab som eier In4mo-relasjonen.

## 25. august 2026 (kveld) — transkripsjon nede: Gemini-nøkkel/kvote

Skjermbilder fra kveldstest viste «Transkripsjonen feilet», «Medier ikke
synkronisert» og én «Ugyldig tilgangskode». Diagnose mot produksjon:

- **Transkripsjon OG bildebeskrivelse feiler for alle** — begge svarer
  «Gemini error». Medieopplasting og prosjektsynk virker (verifisert
  direkte). Rotårsaken er altså Gemini-API-nøkkelen på serveren: mest
  sannsynlig **brukt opp dagskvote** (fri-nivå; passer med feil på kvelden
  etter en testdag), ellers utløpt/rotert nøkkel eller fakturering.
  Sjekk: Render → janitorai-backend → Logs → «Gemini /transcribe error»
  viser nå status og svarutdrag (429 = kvote, 400/403 = nøkkel). Tiltak:
  sjekk nøkkelen i Google AI Studio; vent på kvotenullstilling, aktiver
  fakturering, eller bytt GEMINI_API_KEY i Render (også ai-engine-tjenesten
  hvis den har egen nøkkel).
- **«Medier ikke synkronisert»** var en rest fra vinduet uten gyldig kode —
  opplasting verifisert OK i produksjon; chippen nullstilles ved neste synk.
- **«Ugyldig tilgangskode» (21:43)**: koden validerer fint i produksjon nå,
  og serveren svarer 503 (ikke 401) ved DB-feil — så dette var etter alt å
  dømme feiltastet/ufullstendig innliming eller en gammel kode på enheten.
  Riktig oppførsel; følg med på gjentakelse.
- Kodeendring: /transcribe og /describe-image logger nå Gemini-status +
  svarutdrag og sender statusen videre (502 med geminiStatus) — neste
  diagnose tar sekunder, ikke en kveldstest.
Disiplin: hvert funn får (1) rotårsak i kode/produkt, (2) fiks eller bevisst
utsettelse, (3) evt. roadmap-signal etter nei-lista-regelen (bygges først når
ekte brukere sier de ikke får verdi uten).

## 25. august 2026 — første skarpe sak (Midtgjerdinga)

Sigurd kjørte samme sak i DocrAI og som ordinær befaring (fysisk oppmøte,
vegg åpnet). Sammenligningen er gull: fasit finnes.

### Funn 1: Modellen adopterte eierens hypotese som årsak

DocrAI konkluderte «lekkasje fra rør i vegg tilknyttet utekran» (akutt).
Fasit fra åpnet vegg: **ingen lekkasje fra rørene** (trykksatt, åpen og
lukket posisjon, null drypp; bunnsvill tørr) — reell årsak var nedbør bak
ubeskyttet grunnmursplast med **kapillæroppsug i betongsåla** (gradvis,
prosjekteringsfeil), pluss kondens mot kalde vinduer for merkene under
vinduene. Modellen fulgte eierens teori («rør til utekran går i veggen»)
i stedet for å teste den.

Tiltak (ai-engine/prompt.py):
- Nytt CoT-steg **differensialdiagnose** — minst to alternative årsaker skal
  testes mot bevisene før konklusjon.
- **Hypotese ≠ konklusjon** — eier-/beboerantakelser omtales som rapportert
  antakelse og krever støttende observasjon.
- **Avkreftende funn er harde bevis** — trykktest uten drypp, tørre målinger
  og åpnet konstruksjon uten funn UTELUKKER årsaken.
- **Uverifisert kilde formuleres som mistenkt** med eksplisitt
  verifiseringsbehov, aldri som fastslått.
- Sjekklisten fikk kapillæroppsug fra såle/grunnmur og kondens som egne
  punkter.

Praksis for testerne: skriv negative funn som notat i saken («rør trykksatt,
ingen drypp», «bunnsvill måler tørt») — det er nøyaktig det modellen trenger
for å forkaste feil spor.

### Funn 2: Rå plassholder `{{damage.cause.picture}}` i ferdig rapport

Bevisbildet hentes kun fra videoframe; i foto-eneste saker sto plassholderen
igjen i dokumentet. Tiltak (ai-engine/main.py): uten video brukes fotoet
modellen selv peker ut som beste bevis (`source_photo_index` — kildekobling,
jf. analyse-ai-skribenter P1), med fallback til første foto og et
sikkerhetsnett som alltid fjerner plassholderen.

### Funn 3: «Bilder av stedet» sto tom / «ikke alle bildene inkludert»

Tiltak: alle inspektørfoto settes nå inn under «Bilder av stedet» i
opptaksrekkefølge med rom/bildetekst — testeren SER hvilke bilder som var
med i grunnlaget. (Bilder som ikke var ferdig synkronisert da rapporten ble
bestilt, kan fortsatt mangle — synkstatusen i appen viser gjenstående.)

### Funn 4: Tom prosjektliste etter ny innlogging («Lagret på enheten»)

Sigurd slettet PWA-en, logget inn med testerkode — lista var tom til han
tilfeldigvis trykket synk-chippen. Tre rotårsaker i appen:
1. Første pull kunne skje før koden var lagret (401 → myk «Lagret på
   enheten» uten retry).
2. 503 fra Render-kaldstart **låste** synken av for hele økten
   (`syncDisabled`-latch) — nå behandles 503 som forbigående.
3. Tokenvalidering tolket kaldstart/nettbrudd som «ugyldig kode» og
   **slettet gyldig kode fra enheten**. Nå skilles 'invalid' (401/403) fra
   'unreachable' — koden beholdes når serveren bare er utilgjengelig.
I tillegg trigges full synk umiddelbart etter vellykket innlogging.

### Spørsmål fra Sigurd: fuktmålerbilder i testene?

Svar: **ja i profesjonell-sporet** — takstpersonen/saneringstekniker ER
brukeren vår (jf. inkorporering.md), og målerverdier er nettopp de
bekreftende/avkreftende funnene modellen skal veie (Midtgjerdinga-fasiten
ble avgjort av fuktmåling). Vil vi også teste et privatperson-scenario, kjør
det som egen sak uten måleutstyr — det tester robusthet uten utstyr, ikke
samme arbeidsflyt.

### Roadmap-signal: planskisse via 3D-skanning (LiDAR)

Sigurd har testet 3D-skanning (telefon-LiDAR) mot lasermåler: avvik ~3 mm på
5 m — «funker veldig bra». Rapportmalen har egen planskisse-seksjon, så
behovet er reelt og brukerbekreftet. MEN: LiDAR/RoomPlan krever **nativ
iOS-app** — PWA-en (dagens distribusjon) har ikke tilgang. Lagt på roadmap
som kandidat for nativ-app-sporet; bygges ikke nå (nei-lista: dette er ett
brukersignal, og distribusjonskanalen mangler). Merk: dette er datafangst
til planskisse, ikke et eget tegneverktøy.

**Oppfølging 26.08:** Sigurd foreslo (i samtale med William Tobias
Grenersen) å utvide dette til å skanne bygget og bekrefte/avkrefte
fremdrift mot en BIM-modell — en betydelig større utvidelse enn
planskisse. Se `docs/signal-kontraktskontroll-offentlig.md` for full
vurdering; kort versjon: samme nativ-app-begrensning som over, pluss
geometrisk registrering mot BIM og en BIM-kilde i utgangspunktet. Ikke
bygget, notert som forlengelse av samme roadmap-post.

## Tidligere funn (14.–24. august, oppsummert)

- Kamera-app-foto avvist (8 MB-grense uten web-komprimering) → 20 MB +
  nedskalering >4 MB.
- Multivalg av bilder (saker har ~30) → expo-image-picker multi-select.
- «Synk nekter» → session-bundne blob:-URI-er → IndexedDB-persistens +
  'lost'-karantene + gjenoppretting.
- Synkstatus uten fremdrift → «Laster opp X av Y»-teller.
- Lagre-knapp for rapportfelter «glemmes 10/10 ganger» → autolagring
  (debounce 800 ms).
