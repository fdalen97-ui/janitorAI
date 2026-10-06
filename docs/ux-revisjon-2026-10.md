# UX-revisjon av appen — oktober 2026

Kjørt 06.10.2026 mot `apps/mobile` med regelsettet i `.claude/skills/ui-ux-pro-max`
(kategori 1–9, kritisk og høy først). To metoder:

- **Kode:** hver komponent og skjerm lest mot reglene. Funnene er kontrollert i
  koden; det som ikke kunne bekreftes, er merket «usikker».
- **Måling:** web-eksporten (det testerne bruker) åpnet i Chromium på 375 × 812,
  lys og mørk modus, med redusert bevegelse. Målingen nådde hjem-skjermen og
  «Nytt prosjekt»-veiviseren. Prosjektskjermen ble ikke nådd uten API, så den er
  bare revidert i koden.

Nei-lista gjelder: dette er feil og mangler i det som finnes, ikke nye funksjoner.

## Kritisk

| # | Regel | Funn | Hvor |
|---|---|---|---|
| 1 | voiceover-sr | Knappekomponenten setter aldri `accessibilityRole="button"`. Alle primær-, sekundær- og ikonknapper blir `<div>` uten rolle på web og annonseres ikke som knapper i VoiceOver/TalkBack. Bekreftet i målingen: alle 14 kontroller på hjem-skjermen har rolle «div». | `src/ui/Buttons.tsx:41` |
| 2 | (funksjonell feil) | Filene som velges i steg 2 av «Nytt prosjekt» lagres bare som navn og størrelse. Selve filene lastes aldri opp og forsvinner uten beskjed. | `app/(tabs)/index.tsx:747-748`, `createProject` fra linje 419 |

## Høy

| # | Regel | Funn | Hvor |
|---|---|---|---|
| 3 | input-labels | Feltetiketten vises, men kobles ikke til feltet. Søk, tilgangskode, notat, romnavn, beskrivelse, bildetekst og rapportfeltene har bare placeholder. Rapportfeltene har placeholder «–», som leses opp som «strek». Målt: fire felt i veiviseren uten etikett. | `src/ui/TextField.tsx:36`, `ReportDetailsSection.tsx:75` |
| 4 | nav-label-icon | Guide-fanen bruker ikonet `info.circle.fill`, som mangler i ikonkartet. Fanen får ikke ikon på Android og web. | `components/ui/icon-symbol.tsx:16-21`, `app/(tabs)/_layout.tsx:31` |
| 5 | safe-area-awareness | `SafeAreaView` fra react-native virker bare på iOS, mens appen kjører edge-to-edge på Android. Fast bunnknapp og topplinje får ikke innrykk. | `src/ui/Screen.tsx:17`, `app.json` |
| 6 | confirmation-dialogs | «Slett lydopptak» sletter muntlig beskrivelse og transkripsjon uten bekreftelse og uten angre. | `app/projects/[id].tsx:927` |
| 7 | loading-buttons | «Transkriber» på notater har verken lasting eller sperre. Dobbelttrykk gir to kall til AI-motoren. | `app/projects/[id].tsx:2288` |
| 8 | modal-escape | Overlegget under rapportgenerering kan ikke lukkes og har ingen tilbake-handling, mens genereringen kan ta minutter. Stegene går på tidtaker, ikke på faktisk fremdrift. | `ReportGeneratingOverlay.tsx:230` |
| 9 | touch-target-size | Prosjektmenyen («⋯») er overstyrt til 34 × 34 uten utvidet trykkflate. | `app/(tabs)/index.tsx:996` |
| 10 | color-not-only | Valgt fane (Notater/Rapport) vises bare med kantfarge, uten rolle eller valgt-tilstand. | `app/projects/[id].tsx:3086-3099` |
| 11 | toast-accessibility, error-recovery | Feil vises ofte bare som toast, som forsvinner etter 2,6 s, ikke kan lukkes og mangler «Prøv igjen». Gjelder transkripsjon, bildebeskrivelse, nedlasting og deling. | `src/ui/Toast.tsx` |

## Middels

- **Trykkflater under 44 px (målt):**
  - filterchips: 29 px
  - synk-pillen: 27 px
  - søkefeltet og feltene i veiviseren: 40 px

  Andre steder i koden:
  - romchips: 36 px
  - romforslag: ca. 32 px
  - Norgeskart-lenken: 32 px
  - lukk-kryss i bannere og token-modal: ca. 26–30 px
- **Avstand mellom trykkflater:** 6 px mellom filterchips og mellom Lagre/Avbryt for bildetekst.
- **Fanetekst:** 10 px (målt), som er standarden i navigasjonsbiblioteket.
- **Kontrast:**
  - Ikonet på primærknapper er hardkodet hvitt og gir ca. 1,9:1 i mørk modus.
  - Statusfargen brukt som tekst er under kravet i mørk modus.
  - `'orange'` i `[id].tsx` er under kravet.
- **Tastatur og autoutfylling:** telefon, e-post, areal, byggeår og beløp mangler riktig tastatur og autoutfylling. Skadedato er fritekst, men koden krever formatet ÅÅÅÅ-MM-DD.
- **Lasting:** nedlasting av PDF/Word og «Opprett prosjekt» mangler lastetilstand. Dobbelttrykk lager to prosjekter.
- **Stor tekst:** knappetekster er låst til én linje med fast bredde og kuttes ved stor systemtekst.
- **Bilder** mangler tilgjengelig navn. Bildeteksten finnes og kan brukes.
- **Feil ved lasting av prosjekt** gir ingen mulighet til å prøve igjen.
- **Engelsk tekst** i deler av prosjektskjermen (`[id].tsx:110-134`, `1375-1438`).

## Lav

- «✓» brukt som ikon i romchip og «Lagret ✓».
- Dekorative ikoner er ikke skjult for skjermleser noe sted.
- Fjerning av medvirkende eller bygning skjer uten bekreftelse.
- Slett-knapper er sekundærknapper med bare rødt ikon.
- Toast-animasjonen og prikkene i genereringsoverlegget følger ikke redusert bevegelse.
- Knapper i lastetilstand mangler opptatt-tilstand for skjermleser.

## Det som er i orden

- **Sletting** av notat, prosjekt og deling, tilbaketrekking og godkjenning bekreftes, også på web.
- **Reanimated** følger systemets innstilling for redusert bevegelse.
- **Ikonknapper:** alle fire har navn og er 48 px. Primær- og sekundærknapper er minst 48 px høye.
- **Tomtilstander** har forklaring og handling.
- **Frakoblet:** «Venter på nett — lagret lokalt» vises.
- **Status** bruker både farge og tekst.
- **Emoji** brukes ikke som ikoner.
- **Bredde:** ingen vannrett rulling på 375 px, i lys eller mørk modus.

## Foreslått rekkefølge

1. **Knapperolle i knappekomponenten (funn 1):** én linje som retter alle knapper.
2. **Veiviserfilene (funn 2):** last dem opp, eller fjern steget til det virker.
3. **Etiketter på felt og ikon på Guide-fanen (funn 3 og 4):** små endringer med stor effekt.
4. **Bekreftelse, lastetilstand og lukk-mulighet (funn 6–8):** dette beskytter data og tid i felt.
5. **Trykkflater på 44 px og safe area (funn 5 og 9).**
