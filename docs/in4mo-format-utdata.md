# In4mo-formatet som utdata — skisse, ikke kode

Sigurds forslag 01.10.2026: DocrAI-rapporten produseres også «rett inn i
In4mo-formatet», slik at takstpersonen kan lime den inn i In4mo på
«15 sekunder copy-paste». Dette er trinn 1 i integrasjonstrappa fra
`docs/analyse-ai-skribenter.md` (kopiér/lim → utvidelse som fyller felt →
partnerintegrasjon). Det krever ingen API, bryter ikke nei-lista (vi
erstatter ikke In4mo, vi leverer inn i den), og det kan måles på ett tall:
**tid fra befaring ferdig til levert i In4mo**.

Status: skisse. Ingenting her er bygget, og In4mo-feltene er ikke bekreftet
mot en ekte sak. Det er det første som må skje.

## 1. Det vi vet, og det vi ikke vet

| Vet | Vet ikke (Sigurd må bekrefte fra en ekte In4mo-sak) |
|---|---|
| Takstpersonen fyller In4mo manuelt i dag, felt for felt, og skriver bildetekster manuelt (møtet 01.10). | De eksakte feltnavnene og rekkefølgen i In4mo Task Reporter for en vannskadesak. |
| Rapportmalen vår (Drive, `MASTER_ID`) er en blåkopi av Sigurds rapport og har disse plassholderne (`ai-engine/template_replacement.py`): saksnummer, befaring utført av (navn/telefon/firma), arbeidsnummer, forsikringsselskap og saksbehandler, kunde, adresse, skadedato, befaringsdato, medvirkende (navn/rolle/telefon/e-post), bygninger (type, størrelse, byggeår, renoveringer, annet, skadet område, anslått verdi), mulig regress, tiltak mot ny skade, påbegynte utbedringer, beboelig (verditap per måned, annet), oppsummering, planskisse, bilder. | Hvilke av feltene som er obligatoriske, hvilke som har tegnbegrensning, og om In4mo tar imot flere linjer i ett felt. |
| Analysen gir: skadested, kilde, kildekategori, årsak, akutt/gradvis, faglig beskrivelse, omfang, tiltak, beboelig, bevispunkter med tidsstempel/bildenummer og Byggforsk-referanse etter sitatporten (`ai-engine/models.py`). | Hvor årsak og akutt/gradvis skrives i In4mo: eget felt, eller i fritekst under «vurdering»? |
| Bilder lastes opp med egen bildetekst i In4mo. | Om In4mo godtar bildetekst i filnavnet ved masseopplasting, eller om teksten må limes per bilde. |
| Reparasjonsomfang skrives som standardpunkter per rom («riv/ny gulv hele rommet»). | Om In4mo har en strukturert liste for dette, eller om det er fritekst. |

## 2. Forslaget i tre trinn

### Trinn 1: «Kopier til In4mo» på godkjent rapport (ingen API)

På rapportfanen i appen og på delingssiden, bare når rapporten er godkjent:

- **Én knapp per felt** med In4mos feltnavn som etikett, i In4mos rekkefølge.
  Takstpersonen går nedover lista, kopierer, limer. Rekkefølgen er det som
  gjør det til 15 sekunder i stedet for fem minutter.
- **«Kopier alt»** gir én ren tekst med In4mo-feltnavnene som overskrifter,
  for dem som heller limer én gang og fordeler i In4mo.
- **Bildepakke:** ZIP der hver fil heter `Rom – bildetekst.jpg`, slik at
  bildeteksten følger bildet selv om In4mo ikke leser den automatisk. Bilder
  merket som AI-beskrevet beholder merket i filnavnet (`[AI]`), så ingen
  limer inn en maskintekst som sin egen uten å se det.
- **Alder per bygningsdel** får egen linje i omfang/vurdering, fordi det er
  det første saksbehandleren leter etter (01.10: «52 år, sak ferdig»).

Gate: godkjenningsporten (409 uten stempel) gjelder også her. Ingen kopi før
stempel, ellers blir In4mo fylt med et AI-utkast.

### Trinn 2: feltkart som data, ikke som kode

Feltkartet legges i én fil (`apps/api/src/in4moFelter.js` eller tilsvarende)
som sier: In4mo-feltnavn → DocrAI-kilde (`reportMeta.caseNumber`,
`reportFinal.cause`, osv.) → formatering (dato dd.mm.åååå, tall uten
desimaler). Da kan Sigurd rette rekkefølge og navn uten at noen skriver om
sider, og MEPS kan få sitt eget kart senere uten ny arkitektur.

### Trinn 3: måling før neste steg

Før noen vurderer utvidelse eller API: ti ekte saker der tiden fra «rapport
godkjent» til «levert i In4mo» noteres, før og etter. Tallet går i
`docs/pilotlogg-ocab.md`. Er gevinsten liten, var feltkartet feil, ikke idéen.

## 3. Hva Sigurd må gjøre først

1. Ta skjermbilder (uten persondata) av en In4mo-sak, felt for felt, i den
   rekkefølgen han fyller dem.
2. Merke hvilke felter han bruker mest tid på, og hvilke som er obligatoriske.
3. Skrive hvordan han i dag formulerer årsak og akutt/gradvis i In4mo, med ett
   eksempel.
4. Si om bildeteksten kan ligge i filnavnet, eller må limes per bilde.

Med det kan feltkartet skrives på en kveld, og trinn 1 kan testes på neste
sak.

## 4. Hva dette ikke er

- Ikke en In4mo-integrasjon. Ingen innlogging, ingen API, ingen avtale med
  Solera. Det kommer eventuelt etter at trinn 3 har et tall.
- Ikke en ny rapport. Det er den samme godkjente rapporten, presentert i
  mottakerens rekkefølge.
- Ikke noe som vises på salgssidene før det finnes i produktet (regel 6).
