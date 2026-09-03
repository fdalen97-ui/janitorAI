# RF Studio – presentasjoner for eiendomsansvarlige i PFT

To PowerPoint-presentasjoner som gir eiendomsansvarlige innblikk i
utviklingsarbeidet RF Studio gjør i PFT Eiendom (Politiets Fellestjenester).

| Fil | Varighet | Slides | Bruk |
|---|---|---|---|
| `RF-Studio-15-min.pptx` | 15 min | 11 | Kort orientering, f.eks. som innslag på et eiendomsmøte |
| `RF-Studio-30-min.pptx` | 30 min | 18 | Egen sesjon med to aktiviteter og et sjekkpunkt |

Begge er bygget over samme mal og samme budskap, slik at 15-minutteren er en
ren forkortelse av 30-minutteren – ikke en annen historie.

## Før du presenterer: fyll inn det som er merket

Alt som er RF Studio-spesifikt og som ikke kunne verifiseres fra offentlige
kilder, står i **blå kursiv i klammer**, f.eks. `[fyll inn]`. Søk etter `[`
i PowerPoint. Listen:

| Slide | Hva som må inn |
|---|---|
| Tittel | Dato og navn på presentatør |
| Hva er RF Studio | Hva «RF» står for, etableringsår, organisatorisk plassering. Juster definisjonen så den stemmer med RF Studios mandat |
| Tre utfordringer | Bytt ut de tre foreslåtte utfordringene med de RF Studio faktisk jobber med |
| Hvem er vi (30 min) | Navn og roller i teamet; juster partnerne i figuren |
| Det vi jobber med nå (30 min) | Tre faktiske fokusområder med status |
| Eksempel 1 (og 2) | Ett ekte case i før/etter-format, helst med ett tall og ett bilde |
| Slik kan du bidra | Kanal for innmelding, lenke til veiledere/standarder, fire milepæler |
| Spørsmål | Kontaktinfo og lenke |

Tallene på «Politiets lokaler i tall» (780 000 m², 350 lokasjoner) er hentet
fra PFT Eiendoms offentlige presentasjon (eiendomsyrker.no) og bør verifiseres
mot siste årsrapport.

## Kjøreplan

**15 minutter**

| Min | Slide | Innhold | Pedagogisk grep |
|---|---|---|---|
| 0–1 | 1–2 | Åpning, læringsmål og tidsatt agenda | Løfte + skilting (Gagné 1–2) |
| 1–3 | 3 | Tall + spørsmål til salen | Aktivere forkunnskap (Gagné 3) |
| 3–5 | 4 | Tre utfordringer | Problem før løsning, chunking |
| 5–8 | 5–6 | Definisjon, tre verb, prosessen | Én setning + dual coding |
| 8–10 | 7 | Ett eksempel før/etter | Konkret etter abstrakt, historie |
| 10–12 | 8 | Hva betyr det for deg | WIIFM / relevans (ARCS) |
| 12–13 | 9 | Slik kan du bidra + tidslinje | Handling med lavt første steg |
| 13–15 | 10–11 | Tre ting å huske, spørsmål | Speil læringsmålene (Gagné 8–9) |

**30 minutter**

| Min | Slide | Innhold | Pedagogisk grep |
|---|---|---|---|
| 0–1 | 1–2 | Åpning, læringsmål, agenda | Løfte + skilting |
| 1–3 | 3 | Tall + spørsmål | Aktivere forkunnskap |
| 3–6 | 4 | Tenk–par–del | Alle får en stemme, eierskap |
| 6–8 | 5 | Tre utfordringer | Problem før løsning |
| 8–12 | 6–8 | Definisjon, hvem er vi, fokusområder | Plassere tilhøreren i bildet |
| 12–16 | 9–10 | Prosessen og tre prinsipper | Dual coding, «tenkeregler» (Bloom: anvende) |
| 16–18 | 11 | Sjekkpunkt sant/usant | Hentetrening midt i økten |
| 18–23 | 12–13 | To eksempler | Historie, før/etter, også det som ikke virket |
| 23–25 | 14 | Hva betyr det for deg | WIIFM |
| 25–29 | 15–16 | Diskusjon + slik kan du bidra | Overføring til egen situasjon |
| 29–30 | 17–18 | Tre ting å huske, spørsmål | Speil læringsmålene |

Hver slide har **presentasjonsnotater** med tidsbruk, hva du skal si, hva
som må fylles inn, og hvilket pedagogisk grep sliden bygger på.

## Pedagogiske verktøy som er brukt

- **Læringsmål først, og sjekk til slutt.** Slide 2 lover tre ting; nest
  siste slide speiler dem én til én. Publikum kan selv vurdere om løftet holdt.
- **Gagnés ni hendelser** som ryggrad: fang oppmerksomhet (tall), opplys om
  målet, aktiver forkunnskap (spørsmål til salen), presenter innhold, gi
  veiledning (prosess + prinsipper), øv (aktiviteter), gi tilbakemelding
  (sjekkpunkt), vurder (tre ting å huske), styrk overføring (diskusjon).
- **Kognitiv belastning:** maks tre punkter per slide, én idé per slide,
  samme mønster på parallelle kort, ingen fulle setninger som skal leses
  mens noen snakker.
- **Dual coding:** hvert budskap har både ord og et visuelt anker (ikon,
  prosessfigur, før/etter-kolonner, økosystemfigur).
- **Problem før løsning:** utfordringene kommer før RF Studio forklares.
- **Konkret–abstrakt-veksling:** prosess (abstrakt) etterfølges av case
  (konkret).
- **Hentetrening (retrieval practice):** sant/usant-sjekkpunkt halvveis i
  30-minutteren bryter passiviteten etter 12–15 minutter.
- **Relevans (ARCS):** egen «hva betyr det for deg»-slide med skifte til
  oransje ikoner og direkte tiltale.
- **Overføring:** tenk–par–del og diskusjon lar deltakerne bruke
  strukturen (behov → hvor mange gjelder det) på sin egen hverdag, og gir
  RF Studio ekte innspill.
- **Handling med lav terskel:** avslutningen ber om én konkret ting denne
  uken.

## Regenerere

Deckene bygges av `gen.js` (pptxgenjs). Endre tekst i skriptet og kjør:

```bash
cd presentation/rf-studio
npm install pptxgenjs react-icons react react-dom sharp   # første gang
node gen.js .
```
