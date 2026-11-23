# Markedsføring og Google Ads – strategi for DocrAI

Skrevet 23.11.2026. Gjelder nettsiden slik den er i [PR #38](https://github.com/fdalen97-ui/janitorAI/pull/38).
Alt som står om produktet her, står allerede på nettsiden eller i koden (CLAUDE.md, arbeidsdisiplin 6).
Søkevolum, klikkpriser og konverteringsrater er **ikke** oppgitt, fordi de ikke kan belegges uten
Google Keyword Planner og egne tall. Der det står et tall, er kilden oppgitt eller det er merket som antakelse.

## 0. Tre ting å vite før pengene brukes

1. **Betalt søk er en test, ikke hovedkanalen.** `docs/kampanje-takstpersoner.md` konkluderer med at
   markedet er 1 500–2 000 personer, og at «betalt annonsering er matematisk feil verktøy for denne
   målgruppen». Den konklusjonen står. Det denne planen legger til, er en liten, avgrenset
   Search-test som fanger de få som aktivt søker etter et verktøy, med stoppregel (del 4).
   Listekampanjen (ABM) og fagmiljøkanalen er fortsatt der pilotavtalene kommer fra.
2. **Nettsiden har ingen cookies og ingen tredjeparts sporing, og det er et salgsargument.**
   Det står i bunnteksten på alle sider, i personvernerklæringen og håndheves av
   `apps/api/test/e2e-headere.sh`. Derfor er det **ikke** lagt inn GTM, GA4 eller Google Ads-tag.
   Sporingen er bygget førsteparts og uten cookies (del 3). Vil dere ha Google-taggen, er det en
   beslutning med en pris: samtykkebanner og ny personverntekst (del 3.4).
3. **docrai.io viser i dag `explainer/`, ikke Express-sidene.** Annonser bør lande på `https://docrai.io/`.
   Den siden bygges fra samme forside og har samme sporing. DNS-byttet i `docs/nettside-masterplan.md` §0
   er fortsatt det største enkelttiltaket for SEO, fordi undersidene i dag ligger på en annen vert.

---

## 1. SEO

### 1.1 Revisjon: hva som ble funnet og hva som er rettet

| Område | Funn | Status |
|---|---|---|
| Ruter | 8 indekserbare sider: `/om`, `/demo`, `/eksempelrapport`, `/faq`, `/personvern`, `/vilkar`, `/kontakt`, `/kundereisen`. Statisk HTML fra Express, ikke Next.js. | Uendret |
| Titler | Merkevaren sto først, søkeordet sist. `/demo` hadde tidspåstanden «på sekunder». | **Rettet** på de seks salgssidene: søkeord først, maks 60 tegn, ingen tidspåstand |
| Beskrivelser | 4 av 8 var over 155 tegn og ble kuttet i søkeresultatet (`/om` 178, `/eksempelrapport` 185, `/demo` 166, `/personvern` 163). | **Rettet**: alle 122–155 tegn |
| OpenGraph | 5 tagger per side. Manglet `og:site_name` og bildets mål og alt-tekst. | **Rettet** på alle 8 sider |
| JSON-LD | `/om` hadde SoftwareApplication uten URL og tilbud. `/demo`, `/eksempelrapport`, `/kundereisen` hadde ingen. `/kontakt` hadde en relativ URL som aldri ble gjort absolutt. | **Rettet**: SoftwareApplication med tilbud (gratis pilot) og målgruppe, WebSite, Organization, BreadcrumbList på alle undersider, ContactPoint på `/kontakt`. FAQPage fantes på `/faq`. |
| Overskrifter | Én h1 per side. `/kundereisen` hoppet fra h2 til h4 (15 steder). | **Rettet**: h3 |
| Bilder | Ingen bilder manglet alt-tekst. Nye portretter har alt, bredde, høyde og lat lasting. | OK |
| robots.txt | Tillater alt offentlig, sperrer `/api/`, `/share/`, admin og interne presentasjoner. Peker til sitemap. | OK |
| Sitemap | 8 adresser, riktig. Ingen `lastmod`. | OK. `lastmod` er ikke lagt til, fordi vi ikke har en pålitelig, automatisk kilde til den. |
| Sidevekt (målt lokalt) | Forsiden: 77 kB før portrettene, 142 kB med dem. 5–7 forespørsler. Layoutforskyvning (CLS) 0,000. Font er selv-hostet og forhåndslastet. | OK. Lastetid (LCP) må måles etter utrulling med PageSpeed Insights. Lokale tall sier ingenting om nettverk. |
| Canonical | Følger `PUBLIC_BASE_URL`. Uten den peker canonical til Render-verten. | **Krever handling av dere**: sett `PUBLIC_BASE_URL=https://docrai.io` ved DNS-byttet |
| Search Console | Ikke satt opp. | **Krever handling av dere**: verifiser domenet med DNS TXT-post (ingen kode, ingen cookie) og send inn `/sitemap.xml` |

Regresjonsvakt: `apps/api/test/seo-sjekk.mjs` kjøres av `e2e-headere.sh` og feiler hvis en side får
for lang tittel eller beskrivelse, flere h1, hopp i overskriftsnivå, relativ canonical, manglende
og:-tagger, ugyldig JSON-LD eller bilde uten alt-tekst.

### 1.2 Søkeord og søkeintensjon

Listene under er **hypoteser**. Før de brukes: legg dem inn i Google Keyword Planner (Norge, norsk)
og stryk dem som ikke har målbart volum. I et marked på 1 500–2 000 personer vil mange ha «–».

**Høy intensjon (leter etter verktøy) → forsiden og `/kontakt`**

| Klynge | Søkeord | Landingsside |
|---|---|---|
| Skaderapport-verktøy | skaderapport app, skaderapport programvare, digital skaderapport, skaderapport verktøy | `/om` |
| Befaringsapp | befaringsapp, app for befaring, befaringsrapport app, digital befaring | `/om` |
| Takstprogramvare | takstprogram, programvare takstmann, takstmann app, skadetakst programvare | `/om` |
| AI og tale | ai skaderapport, ai befaringsrapport, diktere rapport, tale til tekst rapport | `/om` |

**Middels intensjon (vil se hvordan det ser ut) → `/eksempelrapport` og `/kundereisen`**

| Søkeord | Landingsside |
|---|---|
| skaderapport eksempel, eksempel på skaderapport, skaderapport vannskade eksempel | `/eksempelrapport` |
| skaderapport mal, befaringsrapport mal | `/eksempelrapport` (ærlig vinkel: «her er en ferdig rapport, ikke en Word-mal») |

**Informasjonssøk (fagspørsmål) → innhold som ikke finnes ennå**

| Spørsmål takstpersoner og skadeutredere søker på | Foreslått side |
|---|---|
| hva skal en skaderapport inneholde | Fagartikkel med sjekkliste |
| akutt eller gradvis vannskade, plutselig og uforutsett skade | Fagartikkel om skillet og hvordan det dokumenteres |
| årsak vannskade kjeller, fukt i kjellervegg årsak | Fagartikkel bygget på `docs/fagkunnskap-vannskadeaarsaker.md` |
| dokumentasjon vannskade forsikring, bilder til skaderapport | Fagartikkel om bevis: tid, sted, sjekksum |

Disse artiklene er **ikke skrevet**. Fagpåstander på nettsiden må belegges (arbeidsdisiplin 6), så
de bør skrives sammen med en takstperson og signeres med navn. Én god artikkel i måneden er nok.
Hver artikkel bør lenke til `/eksempelrapport` og ha én handlingsknapp til piloten.

### 1.3 Konkurrentgap i det norske markedet

Kilder: `docs/konkurrentanalyse.md`, `docs/konkurrent-selskapsanalyse.md` og to nettsøk 23.11.2026.

| Aktør | Hva de dekker | Hva de ikke omtaler (gapet) |
|---|---|---|
| Befar | NS 3600 tilstandsrapport for bolighandel. 500 kr per rapport + 2 000 kr/år (kilde: `docs/kampanje-takstpersoner.md`). | Skaderapport med årsak for forsikringssak |
| Wenn | Håndverker/tilbud, FoU på klimarisiko | Befaring til godkjent skaderapport |
| Smarttakst, KiTakst | Takstverktøy (funnet i nettsøk, ikke testet) | Skadeårsak og akutt/gradvis |
| WP Befaring | Befaringsapp med tale til tekst (funnet i nettsøk, ikke testet) | Årsaksvurdering og godkjenningsport |
| InspectMind AI, Claimspace | Engelskspråklige AI-inspeksjonsverktøy (funnet i nettsøk, ikke testet) | Norsk fagspråk og norske kilder |
| In4mo, MEPS | Forsikringsselskapenes saksflyt | Selve befaringen. DocrAI skal **ikke** erstatte dem (Nei-lista). |

Gapet DocrAI kan eie i søk: kombinasjonen **skaderapport + tale + takstpersonen godkjenner**, på
norsk. I de to nettsøkene fant jeg ingen norsk aktør som beskriver alle tre. Det er et funn fra
to søk, ikke en rangeringsanalyse. Sjekk det på nytt i Search Console når siden har vært indeksert i fire uker.

Steelman (arbeidsdisiplin 4): Befar og Wenn har flere brukere, mer innhold og eldre domener.
Skriver en av dem én side om «skaderapport med AI», rangerer de sannsynligvis over oss fra dag én.
Svaret er ikke flere sider, men ekte pilotsaker med navn og tall, og det har vi ikke ennå.

---

## 2. Google Ads

### 2.1 Kampanjestruktur

| # | Kampanje | Type | Intensjon | Start? |
|---|---|---|---|---|
| 1 | Merkevare | Search | Søker på «docrai» | Ja, lavt tak |
| 2 | Verktøy, høy intensjon | Search | Leter etter app/programvare | **Ja, dette er testen** |
| 3 | Eksempel og mal | Search | Vil se en rapport | Ja, lavere bud |
| 4 | Performance Max | PMax | Bredt | **Nei, ikke ennå** (se 2.6) |

Innstillinger for 1–3: kun Søkenettverket (slå av Display og søkepartnere), sted Norge med
«tilstedeværelse» (ikke «interesse»), språk norsk. Budstrategi: «Maksimer klikk» med tak på
klikkpris, fordi Google ikke får konverteringsdata fra oss (del 3).

### 2.2 Annonsegrupper og søkeord

`[ord]` er eksakt treff, `"ord"` er frasetreff. Ingen brede treff i et marked så lite.

**Kampanje 1 – Merkevare**
- Annonsegruppe *DocrAI*: `[docrai]`, `[docr ai]`, `"docrai app"`

**Kampanje 2 – Verktøy, høy intensjon**
- *Skaderapport-verktøy*: `[skaderapport app]`, `[skaderapport programvare]`, `"digital skaderapport"`, `"skaderapport verktøy"`
- *Befaringsapp*: `[befaringsapp]`, `[befaringsrapport app]`, `"app for befaring"`, `"digital befaring"`
- *Takstprogramvare*: `[takstprogram]`, `[takstmann app]`, `"programvare takstmann"`, `"skadetakst programvare"`
- *AI og tale*: `"ai skaderapport"`, `"ai befaringsrapport"`, `"diktere rapport"`, `"tale til tekst rapport"`

**Kampanje 3 – Eksempel og mal** (lander på `/eksempelrapport`)
- *Eksempel*: `[skaderapport eksempel]`, `"eksempel på skaderapport"`
- *Mal*: `[skaderapport mal]`, `[befaringsrapport mal]`

Konkurrentnavn (Befar, Wenn) er **ikke** med. De løser en annen jobb, så klikkene blir dyre og feil.

### 2.3 Negative søkeord (delt liste på kontonivå)

| Hvorfor | Negative søkeord (frasetreff) |
|---|---|
| Jobbsøkere og studenter | jobb, stilling, lønn, utdanning, kurs, studie, "bli takstmann", "hva tjener" |
| Boligkjøpere og -selgere | tilstandsrapport, boligsalg, verditakst, boligtakst, "pris takstmann", "hva koster takst", "takstmann pris" |
| Forbrukere med skade | skademelding, "melde skade", egenandel, erstatning, "skade på bolig forsikring" |
| Forsikringsselskap (merkevaresøk) | if, gjensidige, tryg, fremtind, storebrand, frende |
| Bil og annet | bil, bilskade, kollisjon, leiebil, båt, mobil, personskade, yrkesskade, nav |
| Utleie | utleie, husleie, leilighet, depositum, innflytting, utflytting |
| Gratis nedlasting | "gratis mal", word, excel, pdf, "last ned" |

Les søketermrapporten hver uke de første fire ukene og legg til det som dukker opp.

### 2.4 Responsiv søkeannonse (RSA)

Alle tekster under er sjekket maskinelt mot tegngrensene og mot ordlista nettsiden ikke får bruke.
Ingen tidsbesparelse, ingen kundetall, ingen «godkjent av forsikring», for det kan ikke belegges ennå.

**10 overskrifter (maks 30 tegn)**

| # | Overskrift | Tegn |
|---|---|---|
| 1 | Skaderapport fra befaring | 25/30 |
| 2 | Snakk – ikke tast rapporten | 27/30 |
| 3 | AI-en skriver utkastet | 22/30 |
| 4 | Du godkjenner rapporten | 23/30 |
| 5 | Gratis pilot i 3 måneder | 24/30 |
| 6 | For takstpersoner | 17/30 |
| 7 | Tale, video og foto inn | 23/30 |
| 8 | Foreslått årsak i utkastet | 26/30 |
| 9 | Ingen bindingstid | 17/30 |
| 10 | Se en ferdig eksempelrapport | 28/30 |

Fest overskrift 1 i posisjon 1 for annonsegruppen *Skaderapport-verktøy*. I de andre gruppene
byttes overskrift 1 med gruppens søkeord. Reserver: «DocrAI – befaringsapp» (21), «Book 15 min med oss» (19), «Appen virker uten dekning» (25), «PIN-beskyttet deling» (20), «Rapport som PDF eller Word» (26).

**4 beskrivelser (maks 90 tegn)**

| # | Beskrivelse | Tegn |
|---|---|---|
| 1 | Snakk deg gjennom befaringen. AI-en skriver utkastet, du kontrollerer og godkjenner. | 84/90 |
| 2 | Tale, video og foto blir et utkast til skaderapport med foreslått årsak. Gratis pilot. | 86/90 |
| 3 | Gratis pilot i 3 måneder uten bindingstid. Meld interesse, vi svarer innen én virkedag. | 87/90 |
| 4 | Se en ferdig eksempelrapport, eller test saksunderlaget på din egen adresse uten konto. | 87/90 |

Visningsbane: `docrai.io/skaderapport/pilot`. Endelig URL: `https://docrai.io/`.

### 2.5 Annonseutvidelser

**Undersidelenker (tekst maks 25, beskrivelseslinjer maks 35)**

| Lenketekst | Adresse | Linje 1 | Linje 2 |
|---|---|---|---|
| Se eksempelrapport | `/eksempelrapport` | Slik ser mottakeren rapporten | Oppdiktet sak, merket eksempel |
| Prøv på din adresse | `/demo` | Kart, matrikkel, terreng og vær | Fra åpne offentlige kilder |
| Bli pilotdeltaker | `/om#pilot` | Gratis i 3 måneder | Ingen bindingstid |
| Book et møte | `/kontakt` | 15 minutters introduksjon | Snakk med oss som bygger DocrAI |
| Spørsmål og svar | `/faq` | Ansvar, personvern og pris | Hvem eier konklusjonen? |
| Slik virker det | `/kundereisen` | Fra befaring til godkjent rapport | Steg for steg |

**Infotekster (maks 25):** Gratis pilot i 3 måneder · Ingen bindingstid · Du godkjenner rapporten · Virker uten dekning · Nettside uten cookies · PIN-beskyttet deling · PDF og Word · Norsk fagspråk

**Utdrag med struktur**
- *Tjenestekatalog*: Lydnotat til tekst, Utkast til skaderapport, Saksunderlag fra adresse, PIN-beskyttet deling, PDF- og Word-eksport
- *Typer*: Video, Foto, Lydnotat

Ikke bruk anropsutvidelse før dere har et telefonnummer som faktisk besvares.
Ikke bruk skjemautvidelse (lead form) i Google: leadet havner da hos Google først, og
personvernteksten vår sier at vi ikke bruker tredjepart til det.

### 2.6 Performance Max: oppsett, og hvorfor den venter

PMax styrer selv hvor annonsene vises og lærer av konverteringer. Tre grunner til å vente:

1. **Den trenger konverteringsdata fra en Google-tag eller opplasting.** Vi har bevisst ingen tag.
   Uten konverteringer optimaliserer PMax mot klikk, og i et lite B2B-marked betyr det Display og YouTube til feil folk.
2. **Volumet er for lite.** Med et mål på 5–8 pilotavtaler på tre måneder (kilde:
   `docs/kampanje-takstpersoner.md`) får algoritmen for få signaler til å lære noe.
3. **Liten kontroll.** Søketermer og plasseringer vises bare delvis.

Når Search-testen har gitt minst 10 kvalifiserte leads (antakelse), og dere har valgt sporingsløsning i del 3.4, er oppsettet:

| Aktivagruppe | Intensjon | Målgruppesignal | Endelig URL |
|---|---|---|---|
| Takstperson, rapportskriving | Vil skrive rapporten selv med mindre tasting | Egendefinert segment fra søkeordene i 2.2, og folk som besøker nettsteder som norsktakst.no | `https://docrai.io/?k=pmax_takst` |
| Foretak, kapasitet og kvalitet | Leder i takst- eller skadeforetak | Egendefinert segment: «skadetakst», «skadeutredning», «takstforetak» | `https://docrai.io/?k=pmax_foretak` |

Innstillinger: slå **av** utvidelse av endelig URL, ekskluder eget merkenavn, legg inn den delte
negative lista, kun Norge. Aktiva: overskriftene og beskrivelsene i 2.4, lange overskrifter under,
logo fra `brand/`, bildet `og-bilde.png`, og skjermbilder fra appen (må lages, minst 1200×628 og 1200×1200).
Ingen video før dere har en ekte.

Lange overskrifter (maks 90 tegn):
- Fra befaring til skaderapport: AI-en skriver utkastet, og du godkjenner det. (76)
- Snakk deg gjennom befaringen og få et utkast til skaderapport med foreslått årsak. (82)
- Gratis pilot i 3 måneder for takstpersoner og skadeutredere. Ingen bindingstid. (79)

---

## 3. Sporing og konverteringer

### 3.1 Hva som fantes

Ingen GTM, GA4 eller Google Ads-kode noe sted i repoet. Det som fantes: en cookiefri besøksteller
(`POST /api/besok`) som lagrer sti og kampanjekode, og pilotskjemaet (`POST /api/pilot-interesse`).
Kampanjekoden ble **ikke** lagret på leadet, så det var umulig å si hvilken kanal en pilotinteresse kom fra.

### 3.2 Hva som er bygget nå (uten cookies, uten tredjepart)

| Del | Fil | Hva den gjør |
|---|---|---|
| Kampanjekode | `apps/api/src/assets/site.js` | Leser `?k=` fra adressen og legger den på interne lenker og i skjema. Ingen cookie, ingen nettleserlagring. Koden forsvinner når fanen lukkes. |
| Kilde på leadet | `routes/publikum.js`, kolonnen `pilot_interesse.kilde` | Pilotinteressen lagres med kampanjekoden. |
| Klikktelling | `POST /api/hendelse`, tabellen `hendelser` | Teller klikk på knapper merket `data-cta`. Lagrer knappenavn, sti og kode. Aldri IP eller ID. |
| Forsiden på docrai.io | `explainer/site.js` (bygget av `explainer/bygg.mjs`) | Samme skript, sender til API-verten. Teller også sidevisningen. |
| Rapport | `apps/api/scripts/kampanjetrakt.sql` | Besøk, klikk og leads per kode siste 30 dager. |

Knappenavn som telles (`data-cta`):

| Navn | Hvor |
|---|---|
| `cta_pilot` | «Bli pilot» i toppmenyen, hero, «tre måter», prisseksjonen, bunnlinja på mobil, `/demo`, `/eksempelrapport` |
| `cta_mote` | «Book et møte», «Book 15 min» hos Anders og William, bookingknappen på `/kontakt` |
| `cta_epost` | E-postlenkene til Anders, William og fellesinnboksen |
| `cta_rapport` | Lenker til eksempelrapporten |
| `cta_demo` | Lenker til adressedemoen |
| `demo_sok` | Adressefeltet på forsiden sendt inn |
| `pilot_skjema` | Pilotskjemaet sendt inn (selve leadet ligger i `pilot_interesse`) |

Ny knapp: sett `data-cta="navn"` i HTML-en og legg navnet i `HENDELSER` i `routes/publikum.js`.
Ukjente navn forkastes av serveren.

### 3.3 Slik kobles det til Google Ads

Sett dette som **suffiks for endelig nettadresse** på kontonivå i Google Ads:

```
k=gads_{campaignid}_{adgroupid}
```

Google fyller inn tallene. Koden tåler bokstaver, tall, `_ . : -` og maks 80 tegn. `{keyword}` er
bevisst ikke med, fordi søkeord med mellomrom og æøå blir forkastet av valideringen. Søkeordet ser dere
i Google Ads. Andre kanaler bruker samme mønster: `?k=li_host26` (LinkedIn), `?k=epost_abm1` (listekampanjen),
`?k=norsktakst_fagdag`.

Ukentlig: kjør spørringen, og legg tallene ved siden av kostnaden fra Google Ads.

```
psql "$DATABASE_URL" -f apps/api/scripts/kampanjetrakt.sql
```

Personvernerklæringen er oppdatert med klikktellingen og at kampanjekoden lagres på henvendelsen.

### 3.4 Beslutning for dere: skal Google få konverteringene?

| Valg | Hva det gir | Hva det koster |
|---|---|---|
| **A. Bli cookiefri (anbefalt nå)** | Løftet på nettsiden står. Dere ser leads per kampanje og annonsegruppe. | Google kan ikke optimalisere bud automatisk. Dere styrer manuelt med tak på klikkpris. |
| **B. Opplasting av frakoblede konverteringer** | Google får vite hvilke klikk som ble leads, uten tag og uten cookie. | Krever at `gclid` fra annonselenken lagres på leadet. Det er en klikk-ID fra Google og må inn i personvernerklæringen. Opplasting gjøres manuelt eller med et lite skript. Ikke bygget. |
| **C. Google-tag med samtykkebanner** | Full automatikk, PMax fungerer som tenkt. | Bryter «ingen cookies og ingen tredjeparts sporing». Krever samtykkebanner, ny personverntekst, endring av testen som håndhever løftet, og dere mister et salgsargument overfor en personvernbevisst bransje. |

Anbefaling: A under testen. Går testen bra og volumet øker, er B neste steg. C bare hvis betalt søk
blir en hovedkanal, og det sier markedsstørrelsen at det neppe blir.

---

## 4. Mål, falske positiver og stoppregel

Arbeidsdisiplin 3: definer hva som teller, og hva som bare ser ut som det teller, før første krone.

| | Definisjon |
|---|---|
| **Kvalifisert lead** | Takstperson eller skadeutreder i et foretak, som har sendt pilotskjemaet eller booket møte, **og møtt** til 15-minutteren. |
| **Falsk positiv** | Student, jobbsøker, boligkjøper, leverandør som vil selge oss noe, konkurrent, oss selv. Skjema uten oppmøte. Klikk på `cta_pilot` uten innsendt skjema. |
| **Primærtall** | Kvalifiserte leads per kampanjekode, og kostnad per kvalifisert lead. |
| **Sekundærtall** | `cta_mote`, `demo_sok` og `cta_rapport` per kode. De viser interesse, ikke resultat. |

**Stoppregel (antakelse, juster etter Keyword Planner):** testbudsjett 150 kr per dag i fire uker, altså
rundt 4 200 kr. Null kvalifiserte leads etter 200 klikk eller fire uker: pause kampanje 2 og 3, behold
merkevarekampanjen, og bruk pengene på listekampanjen. Én kvalifisert lead eller flere: fortsett fire uker til
og sammenlign kostnaden med hva en signert pilot er verdt for dere.

## 5. Landingssiden (CRO): gjort og gjenstår

Gjort i denne runden:
- «Tre måter å komme i gang på»: prøv selv uten registrering, ta en prat på 15 minutter, eller bli pilot gratis i tre måneder.
- «Ta kontakt med oss» med Anders (salg) og William (teknologi og sikkerhet), på forsiden og på `/kontakt`.
- Hver handlingsknapp er merket, så dere ser hvilken av de tre veiene folk faktisk velger.

Gjenstår, i prioritert rekkefølge:
1. **Sett `BOOKING_URL`** til en ekte bookingkalender. I dag åpner bookingknappen på `/kontakt` en e-post. Det er ærlig merket, men det koster møter.
2. **Direkte adresser til Anders og William.** Felles innboks er `hei@docrai.io` (valgt 23.11.2026). Anders og William har ikke direkte adresser på siden. Legg dem inn i `apps/api/src/partials/team.html` når de finnes.
3. **Ett ekte kundesitat** med navn og foretak når første pilot er i gang. Det er det som mangler mest på siden.
4. **Ikke lag egne landingssider per annonsegruppe ennå.** Vent til kodene viser hvilke grupper som gir leads.
