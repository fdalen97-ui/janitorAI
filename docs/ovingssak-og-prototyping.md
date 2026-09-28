# Øvingssaken og prototyping — lær DocrAI på én sak

*28. september 2026. Beslutningsunderlag. Følger opp `docs/verdens-beste-losning.md`.*

**Hva dette er:** (1) en vurdering av om en spillinspirert «øvingssak» er
verdt å bygge, (2) den klikkbare prototypen `presentation/ovingssak.html`,
(3) fire prototypeformer og Value Proposition Canvas forklart og anvendt på
DocrAI, og (4) hvordan konkurrentene lærer opp brukerne sine — og hvordan vi
gjør det.

Eksterne kilder er merket *verifisert* (siden ble åpnet) eller *uverifisert*
(kun søkeutdrag), som i forrige analyse. Leverandørtall er leverandørtall.

---

## 0. Kort svar

- **Ja, en øvingsrunde er verdt å teste — men ikke som lysbildeserie og ikke
  bygget inn i appen ennå.** Nielsen Norman Group fant at klassiske
  «bla-gjennom-kort»-tutorials ikke hjalp (91 % mot 94 % oppgaveløsning, ikke
  signifikant) og fikk oppgavene til å føles *vanskeligere* (verifisert).
  Interaktive gjennomganger der man lærer ved å gjøre i en trygg sandkasse
  anbefales når arbeidsflyten er ukjent — og et AI-utkast som skal
  kontrolleres, er ukjent for en takstingeniør (verifisert).
- **Det viktigste å lære er ikke knappene, men *når man ikke skal stole på
  utkastet*.** Å *oppleve* en automasjonsfeil under opplæring reduserte
  unnlatelsesfeil i et forsøk (Bahner/Manzey 2008, uverifisert), mens ren
  instruksjon ikke beskytter (Parasuraman & Manzey 2010, uverifisert; NEJM AI,
  jf. `docs/verdens-beste-losning.md` §3.7). Derfor har øvingssaken en plantet
  feil — vår egen Midtgjerdinga-feil — som brukeren må finne.
- **Prototypen er laget og publisert** (privat lenke, kan åpnes på mobil).
  Neste steg er å se 2–3 fagfolk bruke den uten hjelp, og bare bygge den inn i
  appen hvis tallene i §6 sier ja.

---

## 1. Er øvingssaken verdifull? Evidens for og mot

**For:**
- **Ukjent arbeidsflyt.** Fra forfatter til redaktør: legene i en JAMIA-studie
  gikk fra å skrive notater til å redigere dem, og det måtte læres
  (verifisert). Det samme skiftet venter takstingeniøren.
- **Redigering er der brukerne faller fra.** Hos Kaiser sto tredjedelen av
  brukerne for 89 % av bruken, og de som sluttet sa at redigering tok lengre
  tid enn å skrive selv (verifisert). Å øve på gjennomgang er å øve på det
  som avgjør om verktøyet blir brukt.
- **Tom start er dårlig start.** Eksempeldata i stedet for tomme skjermer er
  vanlig anbefaling (Appcues, leverandør, verifisert). Appen vår starter i
  dag med en tom liste (`apps/mobile/app/(tabs)/index.tsx`, tom-tilstand), og
  Guide-fanen er statiske steg (`apps/mobile/app/(tabs)/explore.tsx`).
- **Pilotfriksjonen vi har sett, er læringsfriksjon.** «Lagre glemmes 10/10
  ganger» og synkproblemer (`docs/pilotlogg-ocab.md:119-128`) er rettet i koden,
  men viser at første gangs bruk avslører mye.
- **Kort og brukerstartet fungerer.** Produktturer på 3–4 steg ble fullført av
  72–74 %, mot 16 % på 7+ steg; turer brukeren selv starter, 67 % mot 31 %
  (Chameleon, leverandørdata over 550 mill. datapunkter, verifisert). Hvert brett i
  øvingssaken er derfor kort, og brukeren starter selv.

**Mot (tatt på alvor):**
1. **Det kan være feil investering.** NN/g: bruk heller innsatsen på å gjøre
   grensesnittet enkelt. Hvis kjernesløyfen er 3–4 steg, kan kontekstuelle hint
   første gang et grep brukes være nok.
2. **Det er tidlig.** Med én pilotpartner og 3–4 testere er et 30-minutters
   oppstartsmøte billigere og gir mer læring. Kaiser og Cleveland Clinic brukte
   webinar og «superbrukere», ikke spillbrett (Kaiser verifisert via AMA;
   Cleveland uverifisert).
3. **Falsk trygghet og vedlikehold.** Opplæring fjerner ikke automasjonsbias;
   godkjenningsporten på server er fortsatt den ekte kontrollen. En oppdiktet sak
   gjenskaper ikke mørk kjeller og våte hansker. Og en innebygd tutorial må
   endres hver gang appen endres.

**Konklusjon:** svarene over er grunnen til at vi lager en **klikkbar prototype**
i stedet for å bygge i appen — den koster lite, kan kastes, og lar oss måle før
vi bestemmer oss. Den erstatter ikke oppstartsmøtet; den forbereder det.

---

## 2. Spilldesign-prinsippene og hvordan øvingssaken bruker dem

| Prinsipp | Kilde | I øvingssaken |
|---|---|---|
| **Lær ved å gjøre, ikke ved å lese** | Miyamoto om Super Mario Bros 1-1: spilleren skal «gradvis og naturlig forstå» (Game Developer, verifisert) | Ingen introtekst utover én setning; brukeren gjør saken |
| **Første steg kan ikke mislykkes** | 1-1: første fiende koster nesten ingenting å tape mot (verifisert) | Brett 1 er bare å skrive navnet sitt |
| **Ett nytt grep per brett** | Nintendos fire steg: introduser, utvikle, vri, avslutt (GMTK-video, uverifisert) | Sak → fangst → kildemerker → gjennomgang → godkjenning → deling |
| **Umiddelbar, konkret tilbakemelding** | Bycer: det vanskelige er å lære *hvorfor og når*, ikke *hvordan* (Game Developer, verifisert) | Hver handling gir fagspråklig svar på *hvorfor* («Det er dette forsikringen spør om senere») |
| **Stillas som fjernes** | Worked examples og «fading»; ekspertise-reversering (Renkl/Atkinson, Kalyuga, uverifisert) | Hint på forespørsel, koster én stjerne; «Start på nytt» for repetisjon |
| **Treningshjul** | Carroll & Carrithers 1984: sperr typiske feil i starten (uverifisert) | Knapper er låst til riktig rom er valgt; bad er utenfor saken |
| **Boss-brett som tester mestring** | Klassisk spillstruktur; oppleve automasjonsfeil (Bahner/Manzey, uverifisert) | Utkastet gjør eierens teori til årsak; brukeren finner, retter og begrunner |
| **Test i stillhet, ofte** | Valve testet Portal nesten hver uke og så på uten å hjelpe (GMTK, verifisert) | Testplanen i §6 |
| **Ansvar, ikke lek** | Goddard m.fl. 2012: brukere som føler ansvar gjør færre feil (verifisert) | Stempelet med ditt navn og avkrysningen «står faglig inne for» |

Stjernene er med for å gi en følelse av progresjon, ikke som mål i seg selv.
Tonen er faglig. Stjernene måler tre ting per brett: fullført, uten hint, og
brettets egen ferdighet (f.eks. sjekklisten komplett før du går, feilen funnet
på første forsøk).

## 3. Prototypen — `presentation/ovingssak.html`

Selvstendig HTML, ingen appkode endret, ingen AI kalt, ingen data sendt.
Appens farger fra `apps/mobile/src/ui/theme.tsx`, lys og mørk modus, virker på
mobil. Øvingssaken er **oppdiktet** (Øvingsveien 12, Hamar).

| Brett | Grep brukeren lærer | Finnes i appen? |
|---|---|---|
| 1 Hvem er du | Navn trengs for å godkjenne | Ja (Guide-fanen) |
| 2 Opprett saken | Adresse → saksunderlag, byggeår som forhåndssignal | Ja (veiviseren) |
| 3 Fang i rommet | Romstripe, tale med fagord, foto, måling, trykktest, «Før du drar» | Delvis — romstripe, tale, foto finnes; «Før du drar» for alle rom og egne måleknapper er nye |
| 4 Lag utkastet | Lese hvor hvert utsagn kommer fra | Utkast finnes; kildemerker er nye |
| 5 Gjennomgangen (boss) | Egen vurdering først, finn og rett årsaken, knytt bevis | Redigering finnes; egen vurdering og bevistilknytning er nye |
| 6 Godkjenn | Bevisst signatur, utkastet arkiveres uendret | Ja |
| 7 Del | PIN-lenke; trekk godkjenning → lenken låses | Ja (serverport, `apps/api/src/routes/share.js:175-180`) |

Hvert brett viser i et sidepanel både spillgrepet og om funksjonen *finnes i
appen* eller er en *ny idé som testes* — så ingen tror prototypen lover noe
appen ikke har (CLAUDE.md, regel 6).

**Sluttskjermen** viser tid, stjerner og om feilen ble funnet på første forsøk,
og ber om SEQ (1–7, «hvor lett var dette?») og fritekst. Svarene lagres bare på
enheten; knappen «Kopier resultatet» lager én linje testeren sender til oss.

## 4. Fire måter å prototype på — forklart og brukt på DocrAI

| Form | Hva det er | Når det passer for oss | Hva vi gjør |
|---|---|---|---|
| **Spatial prototype** (erfaringsprototype, bodystorming) | Prototypen testes i det virkelige miljøet, med kroppen: «first-hand appreciation … through active engagement» (Buchenau & Fulton Suri, IDEO 2000, uverifisert fulltekst); design «in the wild» (Oulasvirta m.fl. 2003, uverifisert) | Alt som handler om fangst: mørke, kulde, hansker, én ledig hånd, ingen dekning | Ta firelinse-matrisen (menneske, miljø, produkt, samhandling per romtype) med på en ekte befaring med Sigurd eller Lars Erik; ett ark per rom. Øvingssaken tester *ikke* dette |
| **Wizard-of-Oz** (nær slekt) | Brukeren tror systemet er automatisk, men et menneske styrer det (NN/g, verifisert) | Nye rapportfelt før vi ber Gemini lage dem | Et menneske skriver f.eks. en «Før du drar»-liste manuelt under en befaring, før noe bygges |
| **User-driven prototype** (co-design) | Brukeren er deltaker og endrer prototypen selv (Sanders & Stappers 2008, uverifisert fulltekst) | Rapportmal, rekkefølge, fagord | La Ocabs ingeniører flytte og stryke seksjoner i et utskrevet rapportutkast med rød penn, eller i Word. Passer nei-lista: de sier selv hva de trenger |
| **Wireframe** (lo-fi) | Struktur, hierarki og flyt uten visuell design; lav troskap gir raske runder og mindre press på brukeren (NN/g, verifisert) | Rapportskjermen og informasjonshierarkiet | Bryteren «Vis som wireframe» i øvingssaken viser samme flyt i lo-fi. Papirprototyping er «en av de raskeste og billigste teknikkene» (Nielsen, verifisert) |
| **Klikkbar hi-fi** | Ser ut og oppfører seg som produktet | Når strukturen sitter og vi vil måle tid og feil | Øvingssaken |

**Anbefalt rekkefølge for nye funksjoner:** papir/wireframe → Wizard-of-Oz i
felt → klikkbar prototype → bygg. Årsaksbildet (`docs/produktdesign-aarsaksbildet.md`)
hoppet rett til klikkbar prototype; neste gang starter vi lavere.

## 5. Value Proposition Canvas — Grundige Geir (takstingeniøren)

Strategyzer: kundeprofil (jobber, smerter, gevinster) mot verdikart
(produkt, smertelindrere, gevinstskapere); «fit er en påstand til kundene
bekrefter den» (verifisert). Personaen er en proto-persona — alt under er
hypotese til piloten har målt det.

| Kundeprofil | | Verdikart | |
|---|---|---|---|
| **Jobber** | Dokumentere skaden riktig · fastsette årsak og akutt/gradvis · levere en rapport som holder i oppgjøret · rekke nok oppdrag | **Produkt** | Fangst per rom (tale, foto, måling) · AI-utkast i Ocabs mal · godkjenning og PIN-deling |
| **Smerter** | Rapportskriving på kvelden · dobbeltarbeid felt/kontor · spørsmål og tilbakesending fra forsikring · dårlige forhold i felt · frykt for at AI tar beslutninger som er hans | **Smertelindrere** | Utkast fra det han sa på stedet · «Før du drar» fanger hull før han går · kildemerker og egen vurdering først · han godkjenner, AI-en foreslår |
| **Gevinster** | Mindre kveldsarbeid · jevnere kvalitet · rapport han står inne for · raskere oppgjør | **Gevinstskapere** | Arkivert utkast og godkjenningsstempel (sporbarhet) · Byggforsk-sitat kun når det støtter påstanden · målt tid til godkjent |

**Posisjoneringssprik som bør lukkes:** `/om` og kundereisen lover «2 t → 15
min». Forrige analyse anbefalte å love «forsvarbar rapport, raskere oppgjør,
mindre kveldsarbeid» og la tid være noe vi *måler og viser*, ikke lover
(`docs/verdens-beste-losning.md` §0 og §7). Canvaset over bygger på det.

Egne canvas for **Ocab som firma** (jobb: levere flere oppdrag med jevn kvalitet)
og **forsikringsselskapet** (jobb: riktig oppgjør med minst mulig oppfølging)
bør lages før salgsmøter — de har andre smerter enn ingeniøren.

## 6. Konkurrentene — hvordan de lærer opp brukerne, og hvordan vi gjør det

| Aktør | Slik lærer de opp | Kilde |
|---|---|---|
| Encircle | Gratis videobibliotek (5–30 min), quiz, sertifiseringsmerke, IICRC-studiepoeng; brukere sier det er lett å lære opp nye ansatte | getencircle.com/learning, Capterra (verifisert) |
| CompanyCam | Gratis direktekurs, videokurs, rolleguider, 14 dagers prøveperiode, chat | companycam.com/resources/classes (verifisert) |
| magicplan | Akademi med læringsløp, quiz og sertifikat | blog.magicplan.app/academy (uverifisert) |
| DocuSketch | Gratis private opplæringsøkter, telefonstøtte | docusketch.com/onboarding (verifisert) |
| Hover | Lær ved å gjøre: skann et ekte hus med 8 bilder, veiledning i appen | help.hover.to (verifisert) |
| Xactimate | Tre sertifiseringsnivåer (gyldig 2 år); oppleves tungt å lære (3,6/5) | Verisk-PDF, Capterra (verifisert) |
| Befar | Demobruker med en gang, valgfritt digitalt opplæringsmøte | befar.io/faq (verifisert) |
| Wenn Property | 30 dagers prøve, demoprosjekt, kunnskapsbase | wennproperty.no/en/faq (verifisert) |
| in4mo | **Pålagt sertifisering** for alle som jobber for forsikringspartnere; åpne, fjern- og stedlige kurs | in4mo.com/no/kontakt/opplaering (verifisert) |
| Abridge (Geisinger) | Opplæring ikke påkrevd; korte guider og kollegakanal | abridge.com/blog (verifisert, leverandør) |
| Nabla | Lær-opp-lærerne, «kontortid», tilbakemeldingssløyfer | nabla.com/blog (verifisert) |
| Heidi | Tilpasset oppstart pluss kliniske «champions» | heidihealth.com/blog (verifisert) |

**Mønsteret:** verktøy med tungt fagvokabular (Xactimate, in4mo) lærer opp med
sertifisering. Verktøy som starter med fangst, og AI-skribentene, lærer opp med
veiledet første bruk, et demoprosjekt og en intern ildsjel. DocrAI hører til i
den andre gruppen.

**Slik løser vi det:**
1. **Øvingssaken** (demoprosjekt à la Wenn, men med en plantet feil å finne).
2. **Veiledning der du står** — «Før du drar» og romstripen gjør jobben en
   Hover-lignende fangstguide gjør, i stedet for et kurs.
3. **Ett oppstartsmøte på 15 minutter** (allerede lovet på `/om` og `/kontakt`),
   der testeren gjør øvingssaken mens vi ser på uten å hjelpe.
4. **En navngitt ildsjel hos Ocab** som kolleger spør først (Heidi, Nabla, JAMIA).
5. **Ikke et akademi eller sertifisering nå.** Det er riktig for in4mo fordi
   forsikringen krever det; for oss er det overhead før vi har brukere.

## 7. Testplan — skrevet før testen

**Hvem:** Sigurd, Lars Erik og én ingeniør som ikke har sett DocrAI.
**Hvordan:** åpne lenken på egen mobil, gjør øvingssaken uten hjelp, tenk høyt.
Vi ser på, noterer, og hjelper ikke (Valve-metoden).
**Vi måler:** tid til fullført · om feilen ble funnet på første forsøk · hint
brukt · SEQ 1–7 · «hva var uklart?» · hvor de stoppet opp.

**Beslutningsregel:**
- **Bygg øvingssaken inn i appen** hvis minst 2 av 3 fullfører på under 12
  minutter, finner feilen, og gir SEQ ≥ 5 — *og* minst én sier at de ville brukt
  den for å lære opp en kollega.
- **Bygg bare kontekstuelle hint** (første gang et grep brukes) hvis de fullfører
  lett, men sier at de ikke trenger øvingen.
- **Rett grensesnittet først** hvis de står fast på samme sted i prototypen og i
  appen — da er problemet appen, ikke opplæringen.

## 8. Hvis den bygges inn i appen senere (ikke bygget nå)

Fra kartleggingen av appkoden:
- **Eget flagg** `isPracticeProject` — ikke gjenbruk `isTestProject`, som betyr
  replay-kopi (`apps/mobile/src/features/projects/testProject.ts:36-80`).
- **Ferdig utkast uten AI-kall:** skriv en forhåndslaget `reportDraft` gjennom
  samme vei som ekte utkast (`updateProjectLocally` i
  `apps/mobile/app/projects/[id].tsx`), med `promptVersion: "ovingssak"`.
- **Brettlinje finnes nesten:** saksprogresjonen Sak → Befaring → Rapport →
  Godkjent i prosjektskjermen.
- **Hold den utenfor pilottallene:** `minutesToApproved`
  (`apps/mobile/src/features/projects/metrics.ts:34-45`) og kost-/Labs-visninger
  må utelate øvingssaker.
- **Ingen ekte deling:** øvingssaken må aldri passere godkjenningsporten til en
  ekte delingslenke, og må holdes innenfor testerens egen tilgangskode
  (tenant-isolasjon, CLAUDE.md).
- **Måling:** `logAction` (`apps/mobile/src/lib/logger.ts:103-114`) tar i dag
  bare handling og varighet; brett-nummer må legges til for å måle trakten.
- **Førstegangsflagg:** ny nøkkel `@tutorial_state`, samme mønster som
  `@inspector_profile`. En tom prosjektliste kan ikke brukes som
  «første gang», fordi synk fyller den fra serveren.

## Kilder

**Spilldesign og opplæring**
- Miyamoto om World 1-1 — https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1 (verifisert)
- GMTK, «Super Mario 3D World's 4 Step Level Design» — https://www.youtube.com/watch?v=dBmIkEvEBtA (uverifisert)
- GMTK, «Valve's Secret Weapon» — https://gmtk.substack.com/p/valves-secret-weapon (verifisert)
- Bycer, læringshierarki — https://www.gamedeveloper.com/design/teaching-game-mechanics-a-hierarchy-of-learning (verifisert)
- Carroll & Carrithers 1984, treningshjul — https://dl.acm.org/doi/10.1145/358198.358218 (uverifisert)
- NN/g, mobil-tutorials (Kendrick 2020) — https://www.nngroup.com/articles/mobile-tutorials/ (verifisert)
- NN/g, onboarding — https://www.nngroup.com/articles/mobile-app-onboarding/ og https://www.nngroup.com/articles/onboarding-tutorials/ (verifisert)
- Chameleon, produktturer (leverandør) — https://www.chameleon.io/blog/mastering-product-tours (verifisert)
- Appcues, eksempeldata (leverandør) — https://www.appcues.com/blog/crm-software-user-onboarding (verifisert)
- Kaiser/AMA — https://www.ama-assn.org/practice-management/digital-health/ai-scribes-save-15000-hours-and-restore-human-side-medicine (verifisert)
- JAMIA, superbrukere og redaktørskiftet — https://pmc.ncbi.nlm.nih.gov/articles/PMC12844589/ (verifisert)
- Goddard m.fl. 2012, automasjonsbias — https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751/ (verifisert)
- Bahner/Manzey 2008 — https://dl.acm.org/doi/abs/10.1016/j.ijhcs.2008.06.001 (uverifisert)

**Prototyping og verditilbud**
- Buchenau & Fulton Suri 2000 — https://dl.acm.org/doi/10.1145/347642.347802 (uverifisert fulltekst)
- Oulasvirta m.fl. 2003, bodystorming — https://link.springer.com/article/10.1007/s00779-003-0238-7 (uverifisert)
- NN/g, Wizard-of-Oz — https://www.nngroup.com/articles/wizard-of-oz/ (verifisert)
- Sanders & Stappers 2008 — https://www.tandfonline.com/doi/abs/10.1080/15710880701875068 (uverifisert fulltekst)
- NN/g, lo-fi og hi-fi — https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/ (verifisert)
- NN/g, wireframes — https://www.nngroup.com/articles/draw-wireframe-even-if-you-cant-draw/ (verifisert)
- NN/g, papirprototyping — https://www.nngroup.com/articles/paper-prototyping/ (verifisert)
- Strategyzer, Value Proposition Canvas — https://www.strategyzer.com/library/the-value-proposition-canvas (verifisert)

**Konkurrentenes opplæring** — se tabellen i §6; lenker: getencircle.com/learning/home, capterra.com/p/160202/Encircle/reviews, companycam.com/resources/classes, docusketch.com/onboarding, help.hover.to/en/articles/12638517-5-things-to-try-first, verisk.com (Xactimate-sertifisering, PDF), capterra.com/p/214125/Xactimate/reviews, befar.io/faq, wennproperty.no/en/faq, in4mo.com/no/kontakt/opplaering, abridge.com/blog/geisinger-ambient-ai-adoption, nabla.com/blog/successfully-piloting-ambient-ai-for-clinical-documentation, heidihealth.com/en-us/blog/ai-medical-scribe-adoption.
