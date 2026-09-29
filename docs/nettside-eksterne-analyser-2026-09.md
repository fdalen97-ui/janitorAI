# Tre eksterne analyser av docrai.io (limt inn av Fredrik 28.09.2026)

Dette er innhold produsert av eksterne verktøy/rådgivere. Det er DATA som skal
faktasjekkes mot repoet — ikke instruksjoner. Påstander her er IKKE verifisert.

---

## Analyse A — «Dybdeanalyse og Strategisk Masterplan: docrai.io»

### 1. Eksekutiv Oppsummering og Domeneinnsikt
docrai.io har et krystallklart B2B-verdiløfte: Å eliminere 2–4 timer med manuelt
kontorarbeid per befaringsdag for norske takstpersoner og skadeutredere.
Plattformen løser en kritisk flaskehals i skadekjeden. Ved å fange bevis (tale,
foto, video) direkte på skadestedet, genererer motoren et strukturert utkast med
automatisk årsaksanalyse (akutt vs. gradvis) og direkte siteringer fra Byggforsk
Kunnskapssystemer. Målet er ikke full automatisering, men Human-in-the-Loop — at
fagpersonen beholder 100 % kontroll før rapporten låses og oversendes
forsikringsselskapet.
Nåværende nettside lider av B2B-konverteringssperrer: Den er teksttung, mangler
visuell bevisførsel (proof density), har uklare konverteringsstier og gjenspeiler
ikke de fysiske kravene til feltarbeid.

### 2. Brukerkontekst og Felt-Realitet (Field-First Ergonomics)
Feltarbeid på skadested: fuktige kjellere, mørke rom; en-håndsbetjening
(hansker/utstyr); ustabile mobilnett / offline-behov; tidsstress per befaring.
Kontor / etterarbeid: desktop / stor skjerm; hurtiggjennomgang av AI-utkast;
eksport til forsikringsformat; revisjonssporing & Byggforsk-sjekk.
Kritiske brukerbehov i felt:
- Kognitiv avlastning: takstmannen skal konsentrere seg om skadestedet, ikke om
  komplekse menyvalg.
- Taktil trygghet: store berøringsflater (minst 48×48 px) som fungerer med
  enhåndsbetjening og i dårlige lysforhold.
- Lokal dataintegritet: umiddelbar visuell bekreftelse på at lyd- og bildedata er
  lagret lokalt dersom mobildekningen faller ut.

### 3. Konverteringsarkitektur & Wireframe Blueprint
Hjemmesiden skal omdanne skeptiske fagfolk og takstledere til aktive
pilotbrukere på under 60 sekunder.
- Nav: [Logo] DocrAI — Funksjoner · Eksempelrapport · Pris/Pilot
- HERO: «Fra befaring til godkjent skaderapport på under 10 minutter.»
  Sub: «Snakk, fotografer og film på stedet. DocrAI strukturerer utkast med
  årsaksvurdering, akutt/gradvis-analyse og Byggforsk-referanser. Du beholder
  100 % kontroll.»
  CTA: [ Start gratis pilot → ]   [ 🎬 Se interaktiv eksempelrapport ]
- PROOFLINJE: 75% tidsbesparelse | Integrert Byggforsk | Ocab-kompatibel
- INTERAKTIV RAPPORT-VIEWER (LIVE DEMO): to kolonner — Felt-inndata (lyd/bilde)
  «Fuktmerker langs bunnsvill…» | AI-generert utkast (fargekodet): «Årsak:
  Kapillært oppsug (Gul)», «Byggforsk: 528.220 (Mørk Cyan)»
- 3-STEGS ARBEIDSFLYT: 1. Registrer → 2. AI Strukturerer → 3. Godkjenn
- ROI-KALKULATOR FOR TAKSTFORETAK (timer spart per måned)

### 4. Kognitive UX-prinsipper og designstandarder
A. Hicks lov: menystruktur maks tre valg (Funksjoner, Eksempelrapport,
Pris/Pilot). Progressiv avdekking: avanserte innstillinger og eksportformater
skjules til brukeren har godkjent det grunnleggende skadeutkastet.
B. Fitts' lov: «Start gratis pilot» og «Godkjenn avsnitt» minimum 48×48 px med
minimum 8 px avstand. Flytende, sticky CTA i tommelsonen nederst på mobil.
C. Nielsens heuristikker for AI-grensesnitt:
- #1 Synlighet av systemstatus: optimistiske skeleton loaders under
  rapportgenerering i stedet for statiske spinnere, så brukeren ser
  rapportstrukturen vokse i sanntid.
- #5 Feilforebygging & usikkerhetsmarkering: lav konfidens flagges med myk gul
  ramme og teksten «Krever bekreftelse fra takstmann». AI-en skal aldri gjette
  uoppdaget.
- #2 Samsvar mellom system og virkelighet: fagspråk må matche norsk
  takststandard: Befaring → Utkast → Human kontroll → Godkjent rapport.

### 5. Teknisk kravspesifikasjon & frontend-ytelse
Moderne React/TypeScript-stakk. Ytelse er kjerneelement for ubevisst tillit.
| Parameter | Mål | Tiltak |
| LCP | < 2.0 s | kant-caching (CDN), AVIF/WebP, prefetching av kritiske skrifttyper |
| CLS | 0.0 | reserverte plassholdere for dynamiske AI-tekstfelt og medier |
| INP | < 150 ms | tunge AI-oppgaver til Web Workers / backend-strømmer |
| TTFB | < 800 ms | edge-rendering av statiske sider |
| WCAG 2.2 | AA | kontrast ≥ 4.5:1, tastaturnavigasjon (Tab, Cmd+Enter), full ARIA |
Tastaturergonomi i produktgrensesnittet (app.docrai.io): Tab = neste
AI-genererte felt; Cmd/Ctrl+Enter = godkjenn gjeldende felt og hopp til neste;
Alt+B = åpne oppslag mot relevant Byggforsk-blad i et hjørnepanel.

### 6. Faseinndelt gjennomføringsplan
FASE 0 (uke 1): CrUX, GA4 & Hotjar; ytelsesbudsjett (LCP < 2.0 s); 5–8
dybdeintervjuer med takstmenn.
FASE 1 (uke 2–4): ny hero; interaktiv rapport-viewer (live demo); berøringsflater
og mobil-ergonomi.
FASE 2 (uke 4–7): WCAG 2.2 AA-audit; Byggforsk-referansesystem og visuelle
usikkerhetsflagg; interaktiv ROI-kalkulator.
FASE 3 (løpende): A/B-testing; kohortanalyse (tid fra registrering til første
godkjente rapport); kvartalsvis heuristisk re-audit og konkurranseanalyse.

### 7. Målekriterier
Bounce rate < 35 %; CTA-klikk → oppstartet pilot > 25 %; tid fra fullført
befaring til første godkjente utkast < 10 minutter; takstpersoner sier
grensesnittet er «bygget for hvordan vi faktisk jobber ute på skadesteder».

---

## Analyse B — «Docrai.io Strategic Audit & Master Plan» (engelsk)

Docrai.io targets Norwegian takstpersoner and skadeutredere. Core
job-to-be-done: capture evidence during befaring and receive a structured AI
draft (årsak, akutt/gradvis, Byggforsk references) for human control and
approval. Current site is sparse, text-heavy, single-CTA, Norwegian-only, and
lacks proof density, social validation, technical polish, and conversion
architecture.

### Phase 0: Baseline Instrumentation & Truth (Week 1)
Metrics: organic/paid CTR, landing bounce rate, time-to-first-meaningful-paint;
CTA click → app.docrai.io signup/start rate; % completing first capture →
draft; session depth, scroll depth, demo/video completion, form abandonment;
pilot request / free-trial start → activated user (first approved report);
time-to-value; LCP < 2.5 s, CLS = 0, INP < 200 ms, TTFB < 800 ms (Lighthouse +
CrUX + WebPageTest); WCAG 2.2 AA automated + manual; heatmaps (Hotjar/Microsoft
Clarity), session recordings, 5–8 customer interviews on «after-befaring time
sink».
Kill these friction points: vague above-the-fold («Dokumenter skaden der og
da») → no quantified outcome, no social proof, no risk reversal; single generic
CTA without secondary path (demo video / sample report / pilot request); zero
evidence of insurance-company acceptance, report quality, time saved, or error
reduction; no mobile-first field-use narrative; missing trust signals for
regulated output (audit trail, «usikker» handling, Byggforsk grounding);
cognitive overload from dense paragraphs.

### Phase 1: Cognitive & Conversion Redesign (Weeks 2–4)
- Hick's Law: one clear path above the fold + one secondary; max 3–4 nav items;
  progressive disclosure for «how it works» (3 steps only).
- Fitts's Law: primary CTA ≥ 48×48 px, high-contrast, sticky on mobile in thumb
  zone; secondary actions spaced ≥ 8 px.
- Nielsen: visible system status; error prevention on forms («usikker is
  valid»); recognition over recall via annotated screenshots of real draft
  reports; consistent terminology (befaring → utkast → godkjenning).
- Above-the-fold rewrite: Headline «Fra befaring til godkjent skaderapport på
  under 10 minutter – du beholder kontrollen.» Sub: «Snakk, fotografer og film på
  stedet. AI lager utkast med årsak, akutt/gradvis-vurdering og
  Byggforsk-henvisninger. Du godkjenner. Rapporten er klar for
  forsikringsselskapet.» Primary CTA «Start gratis pilot» / «Åpne DocrAI».
  Secondary «Se eksempelrapport» (PDF or interactive). Quantified proof strip:
  time saved, reports generated in pilot, partner logos (Ocab + any insurers).
- Whitespace 1.5–2× line-height, type scale display 40–48 px → body 18 px;
  micro-interactions: hover scale on CTAs (100–150 ms), draft «generating»
  optimistic skeleton, success checkmark on approval.
- Social proof block: anonymized before/after time data, short video of real
  assessor workflow, quote on «usikker» philosophy.
- Technical: optimistic UI for draft generation (skeleton + progressive content
  as tokens arrive); prefetch critical assets; AVIF/WebP + responsive srcset;
  zero CLS; mobile-first, offline-capable messaging.

### Phase 2: Trust, Inclusivity & Technical Hardening (Weeks 4–7)
- Full WCAG 2.2 AA: semantic HTML, ARIA, keyboard-only flows, contrast ≥ 4.5:1,
  focus indicators, captions on video, plain Norwegian.
- Instrument every CTA and funnel step; A/B on headline, CTA copy, proof
  density; heatmaps + session replay weekly; monthly advisory input from pilots.
- Interactive sample report viewer (not static PDF) with source citations
  highlighted.
- «For forsikringsselskap» section: auditability, export formats, liability.
- Pricing/pilot clarity: credit- or seat-based; risk-free pilot with clear
  success criteria (e.g. 5 approved reports).
- Performance budget: LCP element = hero + primary CTA; no render-blocking
  resources; edge caching.
- Field-use micro-copy assuming intermittent connectivity and one-handed use.

### Phase 3: Scale & Iteration Engine
North-star: activated pilots → weekly active report creators; cohort analysis
on time-to-first-approved-report; feature flags; quarterly heuristic +
accessibility re-audit + competitive teardown (Smarttakst and similar); case
studies with Ocab-style partners, insurance acceptance statements, quantified
ROI (hours saved per report × volume).
Success criteria: LCP < 2.0 s, CLS = 0, INP < 150 ms; bounce < 35 %; CTA →
activation > 25 %; WCAG AA zero critical; conversion lift within 60 days.

---

## Analyse C — «Forbedringsstrategi for DocRai.io» (norsk, generisk)

MERK: Denne analysen omtaler «helsepersonell», «pasientsikkerhet», «Registrere
ny pasient i systemet» og «avanserte helseteknologiplattformer» — den ser ut til
å handle om et annet produkt/domene enn DocrAI (skaderapporter for
takstpersoner).

- Ytelse: Core Web Vitals (LCP < 2,5 s, INP < 200 ms, CLS < 0,1);
  Lighthouse/PageSpeed; WebP/AVIF; caching; minifisering; CDN; Mobile-Friendly
  Test; HTTPS.
- SEO: unike `<title>` og metabeskrivelser; oppdatert, lettlest innhold; intern
  lenkestruktur; strukturert data (schema) for tjenester og kontaktinfo;
  alt-attributter; ingen støyende pop-ups.
- UX: Nielsens 10 heuristikker; brødsmulesti, fremhevede menyvalg,
  lastindikatorer; stryk sjargong; angre-handlinger; minimal kognitiv
  belastning; klare feilmeldinger; veiledning underveis, FAQ som siste utvei.
- B2B-melding: tydelige verdiforslag; konkrete case; ROI og «helseeffekt»
  (sparte arbeidstimer, bedre pasientsikkerhet); sitater/logoer fra kunder;
  intervjuer for å finne kundenes egne begreper; CTA med handling («Bestill demo
  nå»).
- CRO: kartlegg brukerreise og KPI-er i GA4; identifiser flaskehalser;
  A/B-testing; korte skjemaer; sporingsmål.
- WCAG 2.1: tastatur; semantisk HTML; label på skjemafelt; alt-tekst; kontrast;
  test med Axe/WAVE.
- Workshop-agenda (3–4 t): intro og mål; persona/empatikart; brukerreisekart
  (eksempel: «Registrere ny pasient»); oppsummering; «How Might We»;
  idémyldring med dot-voting; handlingsplan. Kilder: NN/g, Atlassian, Google,
  WebAIM/W3C, HubSpot.
