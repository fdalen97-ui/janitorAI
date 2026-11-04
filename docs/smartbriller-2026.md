# Smartbriller som fangstverktøy — status oktober 2026

Notis til produktmanuset (`docs/produktmanus-2026-10.html`) og pilotloggen
(`docs/pilotlogg-ocab.md`, «Video fra Meta-briller som fangst»). Skrevet
30.10.2026 etter et NORA.ai-foredrag om brilleklassene, og etter søk på
tilgjengelighet i Europa. Alt som ikke er lenket, er vår egen vurdering.

## Fire klasser, ikke én

Foredraget delte brillene etter hva de har om bord. Det er den inndelingen
som avgjør hva de kan gjøre for en takstperson:

| Klasse | Eksempel | Gir i felt | Verdi for DocrAI |
|---|---|---|---|
| Lyd + mikrofon | enkle lydbriller | Talenotat med hendene fri. Ingen bilder. | Lav. Telefonen i lomma gjør det samme. |
| Lyd + kamera + mikrofon | Ray-Ban Meta, Oakley Meta | Video og tale fra øyehøyde, hendene fri. | **Det første trinnet.** Det Sigurd allerede tester. |
| Skjerm + mikrofon, uten kamera | Even Realities G2 + R1-ring | Tekst i synsfeltet. Ingen bevis. | Lav for oss: ingen bilder, ingen video. |
| Lyd + kamera + skjerm + mikrofon | Meta Ray-Ban Display + Neural Band | Fanger bevis **og** viser svar i brillene. | Det som gjør «Kameraet først» (konsept A) til mer enn en telefon-app. |

AR-briller og VR-headset ble også vist. De er ikke aktuelle for befaring.

## Tilgjengelighet (verifisert 30.10.2026, søk)

- **Ray-Ban Meta (kamera + mikrofon):** selges i Norge. Sigurd har et par
  (pilotloggen).
- **Meta Ray-Ban Display:** i USA siden september 2025. Europa-lanseringen
  ble [utsatt i januar 2026](https://www.dutchitchannel.nl/news/721947/meta-stelt-lancering-van-meta-ray-ban-display-in-eu-uit)
  på grunn av etterspørsel i USA. Ny dato etter Connect 2026:
  [13. oktober i Storbritannia, Frankrike, Tyskland og Italia](https://www.t3.com/tech/vr/meta-ray-ban-display-finally-coming-to-the-uk-and-europe-the-smart-glasses-with-a-screen-set-to-arrive-soon),
  [899 euro inkludert armbåndet](https://pasqualepillitteri.it/de/news/18061/meta-ray-ban-display-deutschland-899-euro-13-oktober).
  Norge står ikke på listen. Om salget faktisk startet 13.10, er ikke
  bekreftet.
- **Even Realities G2 + R1:** selges [direkte i Europa](https://www.evenrealities.com/de-DE/products/r1)
  og via [Proshop i Norge](https://www.proshop.no/Aktivitetsring/Even-Realities-R1-Smart-Ring-Size-7/3508083).
  Uten kamera er de lite verdt for oss.

## Hva brillene faktisk gjør

Siste slide i foredraget («What am I looking at?» / «What is she saying?»)
viser arkitekturen: brillene sender video, lyd og bilder til telefonen, og
telefonen gjør jobben. Det er vår flyt allerede. Vi trenger ikke bygge for
brillene; vi trenger at appen tar imot det telefonen får fra dem.

Det som stopper brillevideo i appen i dag (funnet i oktober-testen av et
Meta-klipp via ChatGPT):

- Videogrensen er 2 minutter (`apps/mobile/src/features/projects/wizardMedia.ts:14`,
  `apps/mobile/app/projects/[id].tsx:1142`). Klippene fra brillene er
  typisk ~3 minutter.
- Én video per rapport. Brillene gir flere klipp per befaring.
- Tid og sted hentes ikke fra filens metadata (brillene legger inn GPS og
  opptakstid).
- HDR-video (HEVC HLG) gir blasse stillbilder når rammer hentes ut.

## Hva dette betyr for prioriteringene

1. **Porten i produktmanuset står:** ti videosaker med vanlige Ray-Ban Meta
   før noe bygges for briller. Hardware og leasing står på nei-lista.
   Ray-Ban Meta kan kjøpes i Norge i dag, så porten kan passeres uten å
   vente på skjermversjonen.
2. **Konsept A («Kameraet først») er verdt å teste nå**, selv om
   skjermbrillene ikke er i Norge ennå: «Mangler: badet over» og «P1 = 18
   registrert» i synsfeltet er det eneste brillene gir som telefonen ikke
   gir. Testen på telefon viser om takstpersonene vil ha det.
3. **Personvern før første ekte sak med briller.** Brillene filmer folks
   hjem og eieren som snakker. Informasjon til beboer før opptak og
   databehandleravtalen er Port 0 i produktmanuset og gjelder her like mye.
4. **Mål før kjøp:** når Display-brillene kommer til Norge, skal vi ha tall
   på hvor mye av brilleklippene som faktisk når rapporten. Da vet vi om en
   skjerm er verdt 899 euro per takstperson.

## Åpne oppgaver

| Oppgave | Eier | Status |
|---|---|---|
| Filme de neste sakene med Ray-Ban Meta og telle hvor mange klipp som når rapporten | Sigurd | avtalt i pilotloggen |
| Heve videogrensen fra 2 til minst 4 minutter, og tillate flere klipp per rapport | William | ikke startet |
| Lese opptakstid og GPS fra filens metadata | William | ikke startet |
| Sjekke om Meta Ray-Ban Display selges i Norge | Fredrik | åpen |
