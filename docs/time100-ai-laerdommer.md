# TIME100 AI 2026: hva bransjetoppene lærer oss om DocrAI

28. august 2026. Gjennomgang av TIME100 AI-lista holdt opp mot vår
strategi — samme øvelse som bok-gjennomgangene (`ddia-laerdommer.md`,
`system-design-laerdommer.md`), men på forretningsnivå. Ærlig
førstesortering: det meste av lista (chips, datasentre, hyperskala-
infrastruktur, frontier-kappløpet) er irrelevant støy for et norsk
pilotprodukt. Fire profiler treffer oss direkte; resten bekrefter mest
hva vi IKKE skal bry oss om.

## De fire som faktisk angår oss

### 1. Arvind Krishna (IBM): verdien ligger i applikasjonslaget og dataene — vår moat, bekreftet

Krishnas veddemål: modellene blir råvarer («close enough» til å være
utbyttbare), ~90 % av verdien tilfaller dem som bygger applikasjoner
oppå — og **proprietære data + tillit** blir differensiatoren.

Det er DocrAI-tesen, uttalt av en av verdens største teknologiselskaper:
vår verdi er ikke Gemini-kallet, men det ingen andre har —
**fagkunnskapen** (Sigurds fem kilder v1, spørretreet v2),
**valideringscasene**, og **draft-vs-godkjent-parene** (AI-utkastet
arkiveres uendret; diffen mot takstpersonens godkjente versjon er
treningsgrunnlag og kvalitetsmål ingen konkurrent kan kopiere).
Tilliten (tenant-isolasjon, godkjenningsport, personvern uten
tredjeparts-sporing) er del av samme moat.

**Tiltak:** ingen nye — men bevar-lista får et strategisk hvorfor.
Rapport-parene skal behandles som et aktivum: aldri slett draft-arkivet,
og valideringsbatteriet prioriteres når kunnskapsversjon v1 integreres.

### 2. Daniel Nadler (OpenEvidence): dreieboken for vertikal fag-AI — vårt speilbilde

OpenEvidence er «DocrAI for leger» i USA, tre år foran oss, og hvert
element i suksessen deres har en DocrAI-parallell:

| OpenEvidence | DocrAI |
|---|---|
| Vekst via jungeltelegraf blant leger — ikke sykehusinnkjøp | Vinn takstpersonene én og én; Ocab-avtalen følger fagfolket, ikke omvendt |
| «Graveyard of tools» kjøpt av administrasjonen, aldri brukt av leger | Advarselen mot å selge til forsikringsselskap/ledelse før fagfolket elsker verktøyet |
| Trent kun på topptidsskrifter (kuratert fagkunnskap) | Byggforsk-henvisninger + ekspertens fagtekst — aldri generisk web-kunnskap |
| Etterlevelse innebygd (pasientdata) | Tenant-isolasjon, godkjenningsport, samtykkebasert logging |
| «Kan ikke erstatte leger» | «Takstpersonen kontrollerer og godkjenner» — identisk posisjonering |
| Gratis for legen; inntekt fra annen side | Kredittprising må aldri stå i veien for individuell takstpersons adopsjon |

**Tiltak:** GTM-dokumentene (`kampanje-takstpersoner.md`) bør eksplisitt
adoptere «individuell fagperson først»-regelen: lav friksjon for én
takstperson å ta i bruk DocrAI uten at arbeidsgiver er kunde.
Delingslenken er vår innebygde jungeltelegraf — mottakeren av en god
rapport er neste potensielle bruker.

### 3. Joëlle Pineau (Cohere): modellavhengighet er en forretningsrisiko — vårt åpne hull

«Suddenly a critical part of your infrastructure gets shut off without
you having any control. And no one can build a resilient business based
on that.» Lista dokumenterer at dette skjer i praksis: modeller trekkes
tilbake, eksportkontroll innføres, priser endres, kvoter strupes — vi
har selv et åpent Gemini-kvotespørsmål i pilotloggen.

DocrAI-eksponeringen: hele motoren står på én modell (Gemini) hos én
leverandør, med kvote og prising utenfor vår kontroll.

**Tiltak (dokumentasjon, ikke kode):** et kort beredskapsnotat —
modellbytte-runbook. Vi står allerede godt: modellkallene bor på to kjente flater
(ai-engine for analysen, `apps/api/src/index.js` for transkripsjon og
bildebeskrivelse — se tabellen i `docs/modellbytte-runbook.md`), prompten og kunnskapsgrunnlaget er modellnøytral tekst,
`PROMPT_VERSION`-regimet og valideringsbatteriet ER byttetesten (kjør
casene på kandidatmodellen, sammenlign draft-vs-godkjent-diff). Det som
mangler er å skrive ned stegene og beslutningskriteriene. **Ikke** bygg
multi-modell-abstraksjon nå — det er nei-lista-infrastruktur uten
evidens; runbooken er forsikringen til evidensen kommer.

### 4. Moustapha Cissé (Kera/Sura): menneske-i-løkka i forsikrings-KI er bransjebeste praksis

Suras regel: «AI never rejects a claim; it just sends it to humans to
review.» Vår godkjenningsport er samme prinsipp fra motsatt side: KI
konkluderer aldri alene om noe med penger i seg. Og farten deres
(30 sekunder mot 120 dager) viser hvor verdien ligger: ikke at KI-en er
smart, men at den fjerner ventetid fra en kjede mennesker er flaskehals i.

**Tiltak:** ta «KI foreslår — fagpersonen avgjør» ut av dokumentasjonen
og inn i salgsflatene som eksplisitt prinsipp (om/demo-sidene). Det er
et tillitsargument mot forsikringsselskapene, ikke en teknisk fotnote.
(Cissés pivot til å BLI forsikringsskinnen da aktørene ikke ville
samarbeide er fristende og relevant — og står fortsatt på nei-lista til
ekte evidens sier noe annet.)

## Kortere observasjoner

- **Ibrahim (DeepMind):** «bygg teknologien for og med miljøene, ikke på
  dem» — spørretre-samarbeidet med Sigurd er nøyaktig dette. Fortsett.
- **Vaz (Publicis):** ikke automatiser gammel arbeidsflyt — reimaginer
  den. Årsaksbildet er reimaginering (løpende differensialdiagnose),
  ikke digitalisering av rapportskjemaet.
- **Sulzberger (NYT):** innhold har eiere. Vår opphavsrettsdisiplin
  (Byggforsk/NS/bøker som metadata + egne ord) er samme prinsipp fra
  brukersiden — og Sigurds fagtekst er vårt eget beskyttelsesverdige IP.
- **Affleck (InterPositive):** KI tar det arbeidsintensive så mennesker
  gjør menneskearbeid — bygd på innhold skaperne selv eier. Vår modell
  i én setning.
- **Ghodsi (Databricks):** «if you're using old weapons, you're dead»
  om sikkerhet — de adversarielle gjennomgangene før ekte data forblir
  obligatoriske.

## Det lista bekrefter at vi skal ignorere

Chips og datasentre (Tan, He, Liang, Payne, Intrator, Ellison), frontier-
kappløpet (OpenAI/xAI/ByteDance/Alibaba), agent-plattformer og egen
modelltrening. På vår skala er alt dette leverandørvalg, ikke
byggeoppgaver — og leverandørrisikoen håndteres av punkt 3.

## Status

Analyse, ingen kodeendringer. Oppfølgingene er utført samme dag:
modellbytte-runbooken finnes (`docs/modellbytte-runbook.md`), GTM-regelen
er kodifisert (`docs/kampanje-takstpersoner.md` §11 «Fagperson først»),
og prinsippsetningen viste seg allerede å stå på salgsflaten (/om:
«AI foreslår. Du avgjør. Det er systemet – ikke et forbehold») — ingen
endring nødvendig der. Alt annet er bekreftelse av valg som allerede
står i `founders-playbook-docrai.md` og nei-lista.
