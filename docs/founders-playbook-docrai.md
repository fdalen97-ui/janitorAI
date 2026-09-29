# The Founder's Playbook, brukt på DocrAI — vurdering og tiltak

Gjennomgang av Anthropics «The Founder's Playbook: Building an AI-Native
Startup» (juni 2026) holdt opp mot DocrAIs faktiske tilstand. Playbooken deler
reisen i fire faser — **Idea → MVP → Launch → Scale** — og advarer mot de
spesifikke fellene AI-native oppstarter går i. Nedenfor: hvor DocrAI står, hva
playbooken bekrefter at vi gjør riktig, og — viktigst — hullene den avdekker.

> Ærlig rammemerknad: playbooken er også markedsføring for Claude/Claude Code/
> Cowork. Startup-rådene er likevel solide og standard (valider før du bygger,
> unngå scope creep, sikkerhet før brukere, måling før lansering, vollgrav via
> domenedybde + data + workflow-lock-in). Vi leser den for visdommen, ikke pitchen.

## Hvor er DocrAI i faseløpet?

**Midt i MVP-fasen, ved utgangsdøra — men uten å ha gått gjennom den.**
- **Idea-fasen: bestått.** Problemet er reelt og spesifikt (takstingeniører bruker
  ~50 % av tiden på etterarbeid), vi har en designpartner (Ocab), og
  konkurranselandskapet er kartlagt (In4mo/MEPS, Wenn, Befar, USA-aktørene).
- **MVP-fasen: produktet er bygget — bevisene er ikke hentet.** Playbookens
  utgangskriterium for MVP er *genuint bevis på product-market fit*: at en
  identifiserbar brukergruppe kommer tilbake (retensjon), betaler (inntekt) eller
  anbefaler (referral). Det har vi **ikke** ennå — piloten har ikke kjørt med ekte
  målte tall, ingen betalende bruker, ingen retensjonsdata.

**Konsekvens:** vi er usedvanlig sterke på *bygging og herding*, men tynne på
*validert bevis*. Det er nøyaktig posisjonen playbooken advarer mest mot.

## Det playbooken bekrefter at vi gjør riktig

- **Sikkerhetsgjennomgang før brukere** (MVP-felle «Insecure by inexperience»).
  Vi gjorde nettopp en adversariell revisjon: 42 funn, tenant-isolasjons-
  angrepstest i CI, signerte medie-URL-er, 0 npm-audit-sårbarheter. Playbookens
  resept — «a security review before any user touches your app is the minimum
  responsible threshold» — er utført.
- **Strukturert djevelens advokat** («a core use case at every stage»). Vi bruker
  adversariell verifisering rutinemessig (refuter-funnet-QA, uavhengige agenter).
- **Konkurrent-kartlegging** (mot «competitor neglect»). Egne dybdeanalyser av
  Befar, Wenn, In4mo/MEPS og USA-markedet.
- **Domenedybde som vollgrav** (Scale-fasens moat). Byggforsk-forankring, norsk
  fagterm-transkripsjon, NS 3600-struktur — presis vertikal-logikk en generalist-
  AI ikke matcher. Playbookens «proprietary knowledge substrate».
- **Måling av enhetsøkonomi** (COGS per operasjon via `/api/admin/cost`).

## Hullene playbooken avdekker (de verdifulle)

**1. «Mistaking building for validating» — vår største risiko.**
Playbookens sentrale advarsel: når AI fjerner byggekostnaden, forveksler man lett
et ferdig produkt med validering. Vi har bygget svært mye (16 skjermer, sikkerhet,
COGS, prising, SEO, tre paletter …) *før* piloten har målt reell verdi. Det ene
tiltaket med høyest gjennomslag er ikke mer bygging — det er **å få Ocab-piloten
live og måle tid-til-godkjent, gjennomstrømning og kost-per-sak mot baseline.**

**2. Betalingsvilje er modellert, ikke validert.**
Vi har COGS, kredittmodell og beslutningsnotat — men ingen betalende kunde, ikke
engang en skriftlig forpliktelse. Playbookens «false product-market fit»: lanserings-
energi ≠ PMF. **Tiltak:** hent en intensjonsavtale/forhåndsforpliktelse om betaling
fra minst én pilot før vi bygger kredittmekanikken.

**3. Ingen CLAUDE.md — playbookens mest fremhevede MVP-artefakt manglet (løst: finnes i repo-roten).**
«Founders who skip specs, architectural decisions, and context files (like
CLAUDE.md) hit a predictable wall.» Vi har en rik `docs/`-mappe, men ingen
CLAUDE.md som Claude Code leser automatisk hver økt. **Tiltak (gjort nå):** opprettet
`CLAUDE.md` i repo-roten med arkitektur, sikkerhetsinvarianter, nei-lista og
testkommandoer — persistent kontekst som gjør at hver økt starter fra samme forståelse.

**4. Måle-rammeverk *før* lansering — delvis på plass.**
Playbooken: sett retensjons-benchmarks, aktiveringskriterier og Dag 7/Dag 30-mål
før første bruker, og **definer hva en falsk positiv er** (påmelding uten aktivering,
inntekt uten retensjon). Vi har go/no-go-tall i `avklaringer-og-roller.md`
(≥5 pilotforetak, median tid-til-godkjent <30 min, ≥60 % godkjent med <3
feltendringer), men mangler en eksplisitt «falsk positiv»-definisjon. **Tiltak:** legg
den til før pilot.

**5. Scope creep uten friksjon — reell, men delvis dempet.**
«When building feels effortless, there's always one more feature.» Vi har bygget
bredt. Vi *har* en nei-liste (i `inkorporering.md`/`avklaringer-og-roller.md`), men
den bør heves til en formell, evidenskravs-basert scope-port: en ny funksjon bygges
først når *ekte brukere* har sagt de ikke får verdi uten den. Nå i CLAUDE.md.

**6. Steelman konkurrentene — vi lener mot vår egen fordel.**
Playbooken vil at vi «make the most compelling argument for why Befar would
succeed while you do not». Vår Befar-analyse forklarer hvorfor de er tilstøtende;
den argumenterer ikke for hvorfor de *vinner*. **Tiltak:** kjør én ærlig red-team-
runde der vi antar Befar/Wenn utvider inn i forsikringstakst — hva er vårt svar?

## Prioritert tiltaksliste

| # | Tiltak | Fase-driver | Status |
|---|---|---|---|
| 1 | Ocab-pilot live + mål tid-til-godkjent / gjennomstrømning / kost | MVP-exit (PMF-bevis) | **Ikke kode — pilotrekruttering** |
| 2 | Forhåndsforpliktelse om betaling fra ≥1 pilot | Mot «false PMF» | Salg/avtale |
| 3 | CLAUDE.md (arkitektur + invarianter + nei-liste + tester) | Persistent kontekst | ✅ Gjort |
| 4 | Definer «falsk positiv» + Dag 7/30-mål før pilot | Måling før lansering | Kort dok-tillegg |
| 5 | Formell scope-port (evidenskrav for nye funksjoner) | Mot scope creep | I CLAUDE.md |
| 6 | Red-team: «hva om Befar tar forsikringstakst?» | Mot competitor neglect | Halvdags analyse |

## Kjernebudskapet

Playbooken validerer *måten* vi jobber på (spec-drevet, adversariell QA,
sikkerhet-først, domenedybde). Men dens skarpeste lærdom for oss er
ubehagelig og riktig: **vi har bygget mer enn vi har validert.** Neste
gjennombrudd ligger ikke i én skjerm til — det ligger i én ekte pilot som måler
seg selv, og én kunde som forplikter seg til å betale.
