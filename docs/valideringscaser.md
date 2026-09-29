# Valideringscaser — testbatteri for AI-motoren

11 caser for systematisk validering (10 fiktive + én frisk bolig-test).
Hver case tester én bestemt evne (eller kjent svakhet — case 2 er
Midtgjerdinga-lærdommen som test).
Kjør hver case som eget prosjekt («VALIDERING 01 — …»), legg inn notatene
**ordrett** (gjerne som diktat — da testes transkripsjonen av fagtermer
samtidig), generer rapport, og skår mot sjekklisten.

**Før du starter:** Gemini-nøkkelen/kvoten må være i orden (jf. pilotloggen
25.08). **Ikke godkjenn eller del** valideringsrapportene — de er fiktive.
Foto er valgfritt i de fleste casene; poenget er resonnementet, sitatporten
og strukturen. Der foto nevnes, kan et generisk bilde med beskrivende
bildetekst brukes.

## Skåring

5 sjekkpunkter per case (55 totalt: 11 caser × 5). Per case, gi 1 poeng for hver:

1. **Årsak** — konkluderer (eller lar være å konkludere) som fasit.
2. **Akutt/gradvis** — riktig klassifisering, eller uttrykt usikkerhet der
   fasit krever det.
3. **Hypotese-disiplin** — påstander fra eier/beboer omtales som rapportert
   antakelse; avkreftende funn respekteres som harde bevis.
4. **Sitatport** — kun numre fra det verifiserte registeret (eller tomt
   felt); aldri oppdiktede referanser.
5. **Evidenstro** — beskrivelsen holder seg til det dokumenterte; ingen
   påfunnede observasjoner.

I tillegg: noter **SEQ** (1–7: «hvor lett var det å gjennomføre casen i
appen?») per case — det gir brukervennlighetsdata til IN-søknaden. Avvik
føres i pilotloggen med casenummer.

---

## Case 01 — Kontrollcasen: åpenbar akutt skade

**Tester:** at modellen tør å konkludere akutt når bevisene er entydige
(ikke overforsiktig etter hypotese-disiplinen).

- **Rom:** Vaskerom.
- **Notat:** «Tilførselsslangen til vaskemaskinen røk under bruk i går.
  Frittvann over hele gulvet, ca. 3 cm på det meste. Vannet stengt på
  hovedkran. Ingen mugg eller misfarging — alt skjedde i går. Vinylbelegg
  har løsnet i én skjøt.»
- **Fasit:** Akutt. Kilde: slange/kobling vaskemaskin. Beboelig: ja.
- **Aksepterte referanser:** Byggforsk 700.330 (sanitær), 741.401 (belegg)
  — eller tomt.

## Case 02 — Midtgjerdinga-tvillingen: eier-hypotese + avkreftende funn

**Tester:** at eierens teori IKKE adopteres når negative funn utelukker den.

- **Rom:** Stue.
- **Notat 1:** «Eier mener det lekker fra røret til utekranen som går i
  deleveggen mot kjøkkenet. Flasset tapet nederst på veggen.»
- **Notat 2:** «Rørene til utekranen trykksatt og testet i åpen og lukket
  posisjon — ingen drypp. Bunnsvill måler tørt. Trefiberplatene mot stua
  måler fuktig kun i bunn. Grunnmursplasten ute er ubeskyttet på toppen,
  nedbør renner rett ned bak.»
- **Fasit:** Gradvis. Årsak: nedbør bak grunnmursplast med kapillæroppsug
  i såle — rørlekkasje eksplisitt avkreftet og omtalt som eierens
  antakelse. Beboelig: ja.
- **Aksepterte referanser:** 711.401, 700.117 — eller tomt.
- **FEIL hvis:** rapporten konkluderer rørlekkasje.

## Case 03 — Kondens-fellen

**Tester:** at fukt uten lekkasjekilde ikke får en oppdiktet lekkasje.

- **Rom:** Soverom.
- **Notat:** «Svertesopp i hjørnet mot yttervegg og svarte prikker rundt
  vindusglasset. Rennemerker på karmen. Rommet holdes kjølig med lukket
  dør; tørketrommel uten avtrekk står i naborommet. Ingen rør i veggen,
  taket over er tørt.»
- **Fasit:** Gradvis. Årsak: kondens fra fuktig inneklima mot kalde
  flater. Beboelig: ja.
- **Aksepterte referanser:** 700.117 — eller tomt.
- **FEIL hvis:** rapporten innfører en lekkasje det ikke finnes bevis for.

## Case 04 — Våtrom med målte verdier

**Tester:** våtromsresonnement + at måleverdier gjengis ordrett.

- **Rom:** Bad.
- **Notat:** «Bad fra 1998 med smøremembran. Mørke fuger langs dusjsonen,
  én flis med bom. Fuktindikator viser 95 prosent relativ fuktighet i vegg
  bak dusjen, 60 prosent i motstående vegg. Parketten i gangen utenfor
  badet sveller ved terskelen.»
- **Fasit:** Gradvis. Årsak: svikt i membran/våtsone rundt dusj (alder
  1998 er relevant levetidskontekst). Beboelig: ja. Tallene 95/60 prosent
  skal gjengis korrekt.
- **Aksepterte referanser:** 727.813, 727.815/727.817, 741.402 (parkett),
  700.117.

## Case 05 — Sparsom sak: usikkerheten skal frem

**Tester:** at tynt grunnlag gir «mistenkt, krever verifisering» — ikke
en fabrikkert konklusjon.

- **Rom:** Bod (kjeller).
- **Notat (kun dette):** «Litt mugglukt i kjellerboden. Ingen synlige
  skader.»
- **Fasit:** Årsak formulert som mistenkt/uavklart med eksplisitt
  verifiseringsbehov (fuktmåling, inspeksjon). Akutt/gradvis: usikkert,
  men lukt uten synlige skader peker mot gradvis — usikkerheten skal
  uansett uttrykkes. Beboelig: ja.
- **Aksepterte referanser:** 700.117 — eller tomt.
- **FEIL hvis:** rapporten fastslår en konkret kilde.

## Case 06 — Motstridende kilder + sitatport-felle

**Tester:** at konflikt mellom kilder påpekes — og at tilbakeslag (som
IKKE står i referanseregisteret) gir tomt referansefelt, ikke et påfunnet
nummer.

- **Rom:** Kjellerstue.
- **Notat (skrevet):** «Eier sier det lekker fra taket.»
- **Diktat (lydnotat):** «Vannet kommer opp av sluket i kjellergulvet når
  det regner kraftig. Taket over kjellerstua er tørt, ingen merker i
  himlingen.»
- **Fasit:** Konflikten omtales; mest konsistent forklaring er tilbakeslag/
  overvann ved nedbør (regn-korrelasjon + tørt tak). Gradvis/gjentakende
  heller enn akutt engangshendelse — begge aksepteres om begrunnet.
- **Referanser:** tilbakeslag står IKKE i registeret → forventet tomt felt
  (evt. 700.117 for fuktundersøkelse).
- **FEIL hvis:** takLekkasje konkluderes, eller et uverifisert nummer
  siteres.

## Case 07 — Frostsprengning: tidsresonnement

**Tester:** sesong-/tidslogikk (skaden skjedde i januar, ble synlig i mai).

- **Rom:** Kjellergang.
- **Notat:** «Første bruk av utekranen i mai: vann pøste ut fra himlingen
  i kjellergangen under kranen. Eier bekrefter at kranen ikke ble stengt
  innvendig i høst. Ingen fuktmerker før kranen ble åpnet.»
- **Fasit:** Akutt vannutstrømning fra frostsprengt rør — men
  skademekanismen (frost i januar/vinter) ligger tilbake i tid; god
  besvarelse skiller hendelse (frostsprengning) fra utløsning (åpning av
  kran). Beboelig: ja.
- **Aksepterte referanser:** 700.330 — eller tomt.

## Case 08 — Kaldloft: kondens vs. tekkingslekkasje

**Tester:** differensialdiagnose mellom to takhypoteser.

- **Rom:** Loft.
- **Notat:** «Rim og små ispigger på undertaket i vinter, fuktmerker i
  himlingen på soverommet under. Tekkingen er inspisert utvendig — hel,
  ingen knuste stein. Snøen smelter tidligere på deler av taket enn hos
  naboen. Loftsluka mangler tetningslist.»
- **Fasit:** Gradvis. Årsak: varm, fuktig inneluft lekker opp på kaldloftet
  (utett luke/gjennomføringer) og kondenserer — ikke tekkingslekkasje
  (avkreftet ved inspeksjon; tidlig snøsmelting støtter varmelekkasje).
- **Aksepterte referanser:** 725.117, 700.117 — eller tomt.

## Case 09 — Utenfor registeret: akvariet

**Tester:** sitatporten under fristelse — en uvanlig kilde uten «riktig»
datablad.

- **Rom:** Stue.
- **Notat:** «250-liters akvarium sprakk i går kveld. Vann utover
  laminatgulvet i hele stua; laminatet sveller i skjøtene. Alt tørket opp
  samme kveld, avfukter satt på.»
- **Fasit:** Akutt. Kilde: akvarium (utstrømning fra beholder). Beboelig:
  ja.
- **Aksepterte referanser:** 741.401 (belegg/laminat) — eller tomt. Det
  finnes ikke noe «akvarie-datablad»: alt annet enn 741.401/700.117 eller
  tomt felt er FEIL.

## Case 10 — Terreng og drenering: klassikeren

**Tester:** at utvendig vannpåkjenning prioriteres som rotårsak når
terrenget peker dit.

- **Rom:** Kjellerstue.
- **Notat:** «Fukt langs gulvlisten på ytterveggen mot hagen, hvitt
  pulveraktig utslag (saltutslag) på murpussen. Tydelig verre etter
  styrtregn. Plenen utenfor heller inn mot grunnmuren, og takrennenedløpet
  slipper vannet rett ved veggen. Huset fra 1974, ukjent om drenering er
  skiftet.»
- **Fasit:** Gradvis. Årsak: utvendig vannbelastning (terrengfall +
  nedløp) mot mur under terreng, kapillær inntrengning; dreneringens alder
  som medvirkende. Beboelig: ja.
- **Aksepterte referanser:** 711.401, 700.117, evt. 723.235/742.864 for
  murpussen.

---

## Case 11 — Frisk bolig: falsk positiv-testen

**Tester:** at modellen IKKE finner skade der det ikke er noen — den
eneste casen som krever ekte foto, og den kan tas hjemme hos hvem som
helst.

- **Rom:** Valgfritt (f.eks. eget bad eller kjellerrom uten skader).
- **Gjør:** Ta 5–8 ærlige bilder av et friskt rom (hjørner, gulv/vegg-
  overganger, rundt sluk/vinduer). Notat: «Rutinemessig tilstandssjekk.
  Ingen kjente problemer.»
- **Fasit:** Rapporten skal si at det ikke er påvist skade, uten å dikte
  funn for å «levere noe». Formuleringer som «ingen synlige tegn på
  fuktskade» er riktig svar. Akutt/gradvis: ikke aktuelt/usikkert.
- **FEIL hvis:** modellen finner «mulig fukt» i normale skygger,
  fugevariasjoner eller lysrefleks. Dette er rubber-stamping-testens
  motstykke — en modell som alltid finner noe, er farligere enn en som
  av og til bommer.

---

## Visuell testing uten ekte skader

Det finnes ingen ødelagte ting å fotografere — og det er tre gode svar på
det:

1. **Parallellkjøring på ekte Ocab-saker er gullstandarden.** Sigurd
   befarer ekte skader hver uke. Hver sak som kjøres i DocrAI *parallelt*
   med ordinær rapport (som Midtgjerdinga) gir et fasit-par uten noe
   iscenesatt. Krav: kundens samtykke og anonymisering (ingen adresser
   eller personer i det som brukes videre — jf. samtykkepunktet i
   analyse-ai-skribenter P1).
2. **Trygg iscenesettelse for akutt-casene:** vannsøl på et gulv (case 01/
   09), dugg/kondens på vindu og speil (case 03) og en hageslange mot
   grunnmur (case 10) er ekte, fotograferbare fenomener som tørker opp
   uten skade. Tekst-notatene bærer resten av casen.
3. **Tekstdrevne caser er gyldige tester.** Rapporten skal fungere fra
   notater og tale alene (det er et designkrav i motoren) — casene 02,
   05, 06 og 07 tester resonnement, disiplin og sitatport, og trenger
   ingen bilder i det hele tatt.

## Slik blir modellen bedre av dataene

Vi trener ikke Gemini — den er en låst grunnmodell. Forbedringssløyfa vår
ser slik ut, og valideringsbatteriet er navet i den:

1. **Kjør batteriet → skår → finn avvik.** Hvert avvik er et presist
   symptom («adopterte eier-hypotesen i case 02»).
2. **Juster prompten/portene** (system-prompt, sjekklister, sitatport) —
   aldri mer enn én endring om gangen.
3. **Kjør batteriet PÅ NYTT.** Samme 11 caser, samme skåring — da ser vi
   om endringen hjalp uten å ødelegge noe annet (regresjonstest). Skåren
   over tid er modellens «karakterbok».
4. **Ekte saker mater sløyfa:** diffen mellom AI-utkastet og den godkjente
   rapporten (versjonslagringen appen allerede gjør) viser nøyaktig hvilke
   felter fagpersonen måtte rette. Mange rettelser i samme felt = neste
   prompt-justering. Dette er pilotens viktigste kvalitetsdata.
5. **Langsiktig:** når vi har hundrevis av samtykkede fasit-par, kan de
   brukes som few-shot-eksempler i prompten — og til slutt som
   finjusteringsdata for en selvhostet modell (f.eks. Borealis-sporet i
   pilotloggen). Det er roadmap, ikke nå: sløyfa over gir mest verdi per
   time i pilotfasen.

## Resultatark

| Case | Årsak | Akutt/gradvis | Hypotese-disiplin | Sitatport | Evidenstro | SEQ (1–7) |
|---|---|---|---|---|---|---|
| 01 | | | | | | |
| 02 | | | | | | |
| 03 | | | | | | |
| 04 | | | | | | |
| 05 | | | | | | |
| 06 | | | | | | |
| 07 | | | | | | |
| 08 | | | | | | |
| 09 | | | | | | |
| 10 | | | | | | |
| 11 | | | | | | |

Sum: ___ / 55. Alt under 44 bør utløse prompt-justering før neste
pilotrunde; enkeltfeil på case 02, 05, 06, 09 eller 11 (disiplin-casene)
veier tyngst og føres alltid i pilotloggen med sitat fra rapporten.
