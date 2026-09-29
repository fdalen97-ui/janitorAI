# BIM og Revit — potensialet for DocrAI

*28. september 2026. Beslutningsunderlag, ikke vedtak. Fredrik ba om en studie av
«potensialet med å bygge løsningen opp mot Revit og BIM-modeller».*

Eksterne kilder er merket *verifisert* (siden ble åpnet) eller *uverifisert*
(kun søkeutdrag), som i `docs/verdens-beste-losning.md`.

---

## 0. Kort svar

- **For kjernekunden i dag — sanering av eldre boliger — gir BIM lite.** Boliger
  fra 1960–1990 har ingen BIM-modell. Jeg fant **ingen offentlig kjent case** der
  et forsikringsselskap eller saneringsfirma bruker BIM på vannskader. Det som er
  bevist i bransjen, er noe enklere: **skann rommet → plantegning → rapport og
  estimat** (Encircle, Matterport, DocuSketch).
- **For nybygg, næringsbygg og offentlige byggherrer er BIM normalen.** Statsbygg
  har krevd IFC siden 2011, og DiBKs «BIM i byggesak» rapporterer avvik som BCF.
  Der ligger potensialet — men det er et annet segment enn spor A, og i dag har vi
  bare ett internt signal derfra (Sigurd, via William), ingen kunde.
- **Hvis vi kobler mot BIM, skal det være openBIM (IFC og BCF), ikke Revit
  først.** IFC og BCF er åpne, leverandørnøytrale og allerede språket i norsk
  offentlig sektor. Revit er ett av flere verktøy som eksporterer IFC.
- **Anbefaling:** bygg ikke noe BIM nå (nei-lista). Gjør tre billige ting som holder
  døren åpen: gi rom en fast kategori, legg til etasje, og gjør plass til en
  valgfri lokasjon på funn. Spør deretter de riktige menneskene de riktige
  spørsmålene (§6).

---

## 1. Hva vi har i dag

**Brukersignaler:**
- Sigurd testet LiDAR på telefonen mot lasermåler: ~3 mm avvik på 5 m, «funker veldig
  bra». Rapportmalen har en egen planskisse-del, så behovet er reelt, men det er én
  bruker (`docs/pilotlogg-ocab.md:101-109`).
- Sigurd foreslo å skanne bygget og bekrefte fremdrift mot en BIM-modell
  (`docs/pilotlogg-ocab.md:111-117`, `docs/signal-kontraktskontroll-offentlig.md:64-73`).
- William: «Kan dette brukes ved overlevering/milepæler i bygg og anleggskontrakter»,
  og om BIM: «krever endel testing og prøving før det gir kvalitet»
  (`docs/signal-kontraktskontroll-offentlig.md:27-28`, `:75-78`).
- Bymiljøetaten (via Lisa): kontroll av entreprenørens arbeid mot kontrakt — et
  annenhånds utsagn, ikke en forespørsel (`docs/signal-kontraktskontroll-offentlig.md:6-12`).

**Status i repoet:** LiDAR-planskisse og BIM-kontroll er begge «logg, ikke bygg»
(`docs/pilotlogg-ocab.md:106-117`, `docs/signal-kontraktskontroll-offentlig.md:145-169`).
Plantegning som underlag (B2) er ikke bygget (`docs/inkorporering.md:78-84`), og
3D-tvillinger (Matterport) er bevisst valgt bort (`docs/inkorporering.md:164-167`).

**Datamodellen:** rom er bare `{ id, name, completedAt? }` med fritekstnavn
(`apps/mobile/src/features/projects/types.ts:130-139`), foreslått fra en liste
(`apps/mobile/src/features/projects/rooms.ts:12-26`). Notater peker på rom via
`roomId` (`types.ts:166`), bilder bare via notatet. Saken har kommunenummer,
gnr/bnr og koordinater (`types.ts:116-127`). Det finnes **ingen** etasje, geometri,
tegningsreferanse eller IFC-ID.

**Begrensninger:** nei-lista sier ikke eget tegneverktøy, og ny funksjon først når
ekte pilotbrukere sier de ikke får verdi uten den (`CLAUDE.md`). LiDAR krever nativ
iOS-app, som vi ikke har (`docs/pilotlogg-ocab.md:105-106`).

## 2. Hvor BIM gir verdi — og hvor ikke

| Segment | Finnes det en modell? | Verdi av BIM for DocrAI |
|---|---|---|
| Eldre boliger (spor A i dag) | Nei. Boligmappa er det nærmeste «tvilling» som finnes | Lav. En enkel plantegning eller romskisse fra skanning gir det samme |
| Nye boliger (overtakelse) | Noen ganger, sjelden levert til kjøper | Middels — men dette er overtakelse, et annet produkt (`docs/kartlegging-overlevering-ks-hms.md:44-77`) |
| Næringsbygg og borettslag med FDV | Ofte, varierende kvalitet | Middels. Vannskaden kan knyttes til rom og bygningsdel i modellen |
| Offentlige byggherrer (Statsbygg, kommuner) | Ja, IFC kreves | Høy — hvis funn kan leveres som BCF inn i verktøyene de allerede bruker |
| Store byggeprosjekter (fremdrift mot modell) | Ja | Høy, men markedet er tatt av tungt finansierte aktører (§3.4) |

## 3. Hva kildene sier

### 3.1 Åpne standarder: IFC og BCF
- **BCF 3.0** er buildingSMARTs åpne format for avvik: tema, kommentarer, visningspunkt,
  bilde og komponenter, der elementer refereres med `ifc_guid`. REST-API-et bruker
  OAuth2 (github.com/buildingSMART/BCF-API, verifisert). Dette er det naturlige
  formatet for å eksportere et DocrAI-funn som et avvik.
- **IFC 4.3** er ISO 16739-1:2024, og **IDS 1.0** (maskinlesbare modellkrav) ble
  endelig i juni 2024 (begge uverifisert utdrag).
- **Åpen kildekode:** IfcOpenShell (LGPL-3.0) og web-ifc fra That Open Company
  (MPL-2.0) kan brukes i en lukket SaaS; xeokit er AGPL og krever kommersiell lisens
  (lisenser fra utdrag, uverifisert).

### 3.2 Revit og Autodesk
- **Autodesk Platform Services (APS)** endret prismodellen 8. desember 2025: et gratis
  nivå med månedlige tak, og bare fire API-er måles — blant dem Model Derivative
  (konvertering av Revit/IFC for visning). Resten er uten kostnad
  (aps.autodesk.com/blog/aps-business-model-evolution, verifisert). Billig å
  prototype, men prisen styres av én amerikansk leverandør.
- **ACC Issues API** skal ifølge utdrag bare støtte innlogget bruker og ikke kunne
  opprette avvik plassert i modellen (uverifisert — siden lastet ikke). Sjekkes før
  noe loves.
- **Revit-API-et** er et gratis .NET-API for Windows-tillegg (uverifisert utdrag). Et
  skrivebordstillegg passer dårlig for et felt-først-produkt.

### 3.3 Skanning til modell
- Gratisappen **«IFC Floor Plan»** bruker Apples RoomPlan og eksporterer IFC fra en
  LiDAR-iPhone (App Store, verifisert). RoomPlan eksporterer selv USDZ.
- Nøyaktighet på telefon: leverandørblogger anslår ±5–10 cm over et rom og melder
  om søyler, skråtak og trapper som faller ut (uverifisert). Godt nok til å plassere
  en skade på rom og vegg — ikke til toleransekontroll.
- **Matterport** leverer BIM-filer (Revit/DWG, LOD 200) på forespørsel
  (matterport.com, verifisert) og Xactimate-skisse fra ca. $79 (uverifisert).
- Profesjonelle skannere (NavVis, Leica) ligger på millimeter–centimeter (studier,
  uverifisert). Fremdrift mot modell krever slikt utstyr, ikke telefon.

### 3.4 Fremdrift mot modell — et tatt marked
- OpenSpace kjøpte Disperse i oktober 2025 (openspace.ai, verifisert), og Buildots
  hentet $130 mill. i september 2026 (uverifisert). Sigurds idé er god, men her
  konkurrerer vi med selskaper som har hundrevis av millioner. Partner eller
  henvis — ikke bygg.

### 3.5 Norge
- **Statsbygg** har krevd IFC i alle prosjekter siden 2011; nyere krav sikter på IFC4
  (uverifisert utdrag). **Nye Veier, Statens vegvesen og Bane NOR** krever
  modellbasert leveranse (uverifisert).
- **DiBK «BIM i byggesak»** bruker IFC4 og en validator som eksporterer rapporter som
  **BCF** (dibk.atlassian.net, verifisert). BCF er allerede offentlig sektors språk
  for avvik.
- **Dalux Field** er der norske entreprenører logger avvik på tegninger og BIM, med et
  gratis Basic-nivå (dalux.com, verifisert). API-et krever firmalisens og nøkkel fra
  Dalux (uverifisert). Allerede vurdert som konkurrent for overtakelse
  (`docs/kartlegging-overlevering-ks-hms.md:81-85`).
- **Boligmappa** har REST-API-er for bedrift og boligeier; tilgang krever avtale og
  oppstartsmøter (boligmappa.no/for-bedrifter/for-utviklere, verifisert). For
  eksisterende boliger er dette den «tvillingen» som faktisk finnes.
- **Bymiljøetaten** valgte Tribia/Interaxo som samhandlingsløsning i oktober 2025
  (cw.no, kun overskrift verifisert). Kontraktskontroll i Oslo betyr trolig å levere
  inn i Interaxo.
- Jeg fant ingen statistikk over BIM-bruk i norske boligprosjekter.

### 3.6 Forsikring og skade
- Matterports case med Master Restoration: omkontroller ned fra 12 % til 0 %,
  oppgjørstid ned 37 %, estimater 20 % raskere (matterport.com, verifisert,
  leverandørtall). Ikke spesifikt vannskade — og det er skanning og plantegning,
  ikke BIM.
- Encircle Floor Plan lager plantegning fra vanlig mobilvideo (uten LiDAR) på rundt
  to timer og importerer den rett i Xactimate (getencircle.com, verifisert).
  Nærmeste analog til oss: verdien er **plantegningen koblet til rapporten**.

## 4. Fem integrasjonsnivåer, fra billigst til mest ambisiøst

| # | Nivå | Innsats | Forutsetning | Hvem betaler | Vurdering |
|---|---|---|---|---|---|
| 1 | **Romforankring:** funn knyttes til rom og vegg; plantegning som import (B2) eller fra RoomPlan | 3–6 uker (import først, RoomPlan krever nativ app) | Plantegning eller LiDAR-iPhone | Saneringsfirma, i abonnementet | **Riktig første steg** — samme mønster som Encircle; allerede innenfor nei-lista når det er import |
| 2 | **Boligmappa-eksport** av rapport og funn per eiendom | 2–4 uker + avtale | Partneravtale med Boligmappa | Saneringsfirma; huseier får FDV-historikk | God for eksisterende boliger |
| 3 | **BCF-eksport av funn** (bilde, årsak, `ifc_guid` der modell finnes) | 2–4 uker | Kunden har IFC-modell | Byggherrer, eiendomsforvaltere, offentlige | Beste BIM-inngang; åpen standard |
| 4 | **Dalux-kobling:** DocrAI-funn som avvik på tegning/modell | 1–2 mnd | Kunde med Dalux-lisens og API-nøkkel | Entreprenører, forvaltere | Først når en kunde ber om det |
| 5 | **Kontroll mot modell eller kontrakt** (Sigurds idé) | 6+ mnd | Modell + profesjonell skanner | Store byggherrer og entreprenører | Partner (OpenSpace, Buildots) eller henvis — ikke bygg |

**Revit spesifikt:** Revit gir mening når en konkret kunde lever i Autodesk
Construction Cloud og vil ha funn der. Til da dekker IFC/BCF både Revit-brukere
(som eksporterer IFC) og alle andre.

## 5. Billige grep nå som holder døren åpen (forslag — ikke bygget)

Disse endrer ikke brukerflyten og bryter ikke nei-lista, men gjør nivå 1–3 mye
enklere senere:
1. **Fast romkategori** ved siden av fritekstnavnet (for eksempel bad/våtrom, kjeller,
   loft, utvendig), mappet mot romforslagene i `rooms.ts`. Gir en stabil nøkkel mot
   IFC-romtyper og mot plantegninger.
2. **Etasje** på rom.
3. **Valgfri lokasjon på funn:** rom, vegg og høyde over gulv (høyde brukes allerede i
   fuktmålinger i øvingssaken), og et tomt felt for ekstern referanse (`ifcGuid` eller
   tegningspunkt) som bare fylles når en modell finnes.

Tenant-isolasjonen er uberørt: alt ligger i prosjektets egne data under
`tester_token`.

## 6. Bevisporter — hva vi må høre før noe bygges

Nei-lista gjelder: vi bygger først når en ekte kunde sier at de ikke får verdi uten.

| Spørsmål | Til hvem | Ja betyr |
|---|---|---|
| «Ville en plantegning med skadested i rapporten spart deg tid eller spørsmål fra forsikring?» | Sigurd, Lars Erik | Nivå 1 (import først) |
| «Hvor ofte har du en plantegning eller modell tilgjengelig på en skadesak?» | Ocab-ingeniørene | Avgjør import vs. skanning |
| «Kan Interaxo ta imot avvik som BCF, og ville dere brukt det for kontroll mot kontrakt?» | Bymiljøetaten via Lisa | Nivå 3 for offentlig sektor |
| «Hvilket system logger dere avvik i i dag — Dalux, ACC eller noe annet?» | William og hans nettverk | Nivå 3 eller 4 |
| «Vil dere betale for at skadehistorikk lagres i Boligmappa?» | Ocab, ev. en forsikringskontakt | Nivå 2 |

Før svarene finnes: logg, ikke bygg.

## Kilder

**I repoet:** `docs/pilotlogg-ocab.md`, `docs/signal-kontraktskontroll-offentlig.md`,
`docs/inkorporering.md`, `docs/kartlegging-overlevering-ks-hms.md`,
`docs/ns3600-og-befar-ui.md`, `apps/mobile/src/features/projects/types.ts`,
`apps/mobile/src/features/projects/rooms.ts`, `CLAUDE.md`.

**Eksterne (hentet 28.09.2026):**
- APS prismodell — https://aps.autodesk.com/blog/aps-business-model-evolution (verifisert)
- ACC Issues API — https://aps.autodesk.com/en/docs/acc/v1/overview/field-guide/issues (uverifisert)
- Revit App Store — https://aps.autodesk.com/app-store/publisher-center/revit (uverifisert)
- BCF-API — https://github.com/buildingSMART/BCF-API (verifisert)
- IFC 4.3 (ISO 16739-1:2024) — https://www.iso.org/standard/84123.html (uverifisert)
- IDS — https://technical.buildingsmart.org/projects/information-delivery-specification-ids/ (uverifisert)
- web-ifc — https://github.com/ThatOpen/engine_web-ifc; IfcOpenShell — https://docs.ifcopenshell.org/ifcopenshell.html; xeokit — https://github.com/xeokit/xeokit-bim-viewer (lisenser uverifisert)
- IFC Floor Plan (RoomPlan → IFC) — https://apps.apple.com/us/app/ifc-floor-plan/id6761410722 (verifisert)
- Matterport BIM-filer — https://matterport.com/blog/matterport-bim-files-now-available-upon-request (verifisert)
- Matterport TruePlan — https://support.matterport.com/s/article/Matterport-TruePlan-for-Xactimate (uverifisert)
- OpenSpace kjøper Disperse — https://www.openspace.ai/press-releases/openspace-acquires-disperse/ (verifisert)
- Buildots — https://siliconangle.com/2026/09/14/buildots-raises-130-million-to-expand-ai-powered-construction-platform/ (uverifisert)
- Statsbygg BIM-manual — https://dok.statsbygg.no/wp-content/uploads/2020/06/statsbyggs-bim-manual-1-2-1_en_20131217.pdf (uverifisert)
- DiBK BIM i byggesak — https://dibk.atlassian.net/wiki/spaces/FB/pages/52007820/BIM+i+byggesak (verifisert)
- NS 8360 — https://standard.no/fagomrader/digital-byggeprosess/ns-8360-bim-objekter/ (uverifisert)
- Dalux Field — https://www.dalux.com/products/dalux-field/ (verifisert)
- Boligmappa for utviklere — https://www.boligmappa.no/for-bedrifter/for-utviklere (verifisert)
- Bymiljøetaten/Interaxo — https://www.cw.no/bim-it-bransjen-offentlig-sektor/oslo-kommune-inngar-kontrakt-pa-samhandlingslosning/2415179 (kun overskrift verifisert)
- Matterport Master Restoration — https://matterport.com/industries/case-studies/master-restoration-uses-digital-twins-accelerate-estimates-20-and-claims (verifisert)
- Encircle Floor Plan — https://www.getencircle.com/solutions/floor-plan/ (verifisert)
