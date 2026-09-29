# Erfaringer fra konkurrentene — krav til eksisterende løsning

Kilde: App Store-gjennomgang august 2026 av in4mo Task Reporter (Solera, 1,9★)
og Wenn Property (5,0★, 3 vurderinger). Anmeldelsene av in4mo kommer fra
takstpersoner som er bundet til appen gjennom forsikringsselskapene (If, Frende)
— altså akkurat brukerne DocrAI bygges for. Hvert punkt under er formulert som
en læresetning, med status i dagens løsning og hva som gjenstår.

## 1. Hastighet er en funksjon, ikke en optimalisering

**Observasjon:** «Tregeste appen som finnes» er gjennomgangstonen i
1-stjernes-anmeldelsene. Treghet i felt betyr at takstpersonen står i en fuktig
kjeller og venter.

**Prinsipp:** Ingen brukerhandling i feltløypa (foto, video, lydnotat, notat)
skal noen gang vente på nett. Nettverk skjer i bakgrunnen, alltid.

**Status:** Bygget. Offline-first-synk med lokal lagring først og
bakgrunnsopplasting (`projectSync.ts`), synkstatus vises uten å blokkere.

**Gjenstår:** Sett et målbart ytelsesbudsjett for feltløypa (f.eks. foto lagret
lokalt < 500 ms, skjermbytte < 200 ms) og mål det før hver lansering.

## 2. Stabilitet i felt er tillitsgrunnlaget

**Observasjon:** Krasj-klager går igjen. En krasj midt i en befaring kan bety
tapt dokumentasjon og en ny utrykning.

**Prinsipp:** Feltdata skal aldri kunne gå tapt — hver fangst persisteres lokalt
i det øyeblikket den skjer, før noe annet får kjøre.

**Status:** Delvis bygget. Lagring skjer umiddelbart lokalt; hjelpefunksjoner
som geo-oppslag er skrevet så de aldri kaster. Saksunderlag-oppslag feiler
stille uten å påvirke flyten.

**Gjenstår:** Krasjrapportering (f.eks. Sentry) med eksplisitt mål: null
datatap-krasj i feltløypa. Gjenopprettingstest: drep appen midt i opptak og
verifiser at alt fram til da er bevart.

## 3. Aldri be brukeren tegne — hent tegningen

**Observasjon:** Det mest hatede enkeltelementet i in4mo er «tegneprogrammet»
for planskisser («skulle tro det var en 2-åring som har utviklet dette»).

**Prinsipp:** DocrAI skal ikke bygge et bedre tegneverktøy. Behovet fjernes:
godkjente plantegninger hentes fra byggesaksarkivet, og takstpersonen pinner
rom og skader på en ferdig tegning.

**Status:** Strategien ligger i totalbildet (dokumentlaget: kommunalt
byggesaksarkiv / Ambita/Norkart per bestilling, Boligmappa som partnerskap).
Ikke implementert i appen ennå.

**Gjenstår:** Rom/fuktlogg-skjermen bygges med plantegning-som-underlag fra
start — pinning på tegning, aldri frihåndstegning som primærløype.

## 4. Varsler skal lande der handlingen skjer

**Observasjon:** in4mo-brukere har i over ti år fått chat-varsler som ikke
leder til meldingen («brukt appen i over 10 år og denne feilen har enda ikke
blitt rettet»).

**Prinsipp:** Ethvert varsel, enhver feilmelding og enhver «Prøv igjen»-knapp
skal ta brukeren direkte til stedet der handlingen fullføres — aldri bare til
forsiden.

**Status:** Bygget som mønster. «Prøv igjen» på prosjektkortet navigerer til
rapportfanen og utløser regenerering (`?retry=1`), ikke bare til skjermen.

**Gjenstår:** Håndhev mønsteret som sjekklistepunkt for alle fremtidige
varsler/toasts: hver toast med handling skal ha et dypmål.

## 5. Kjøper og bruker er splittet — det er kilen, ikke hindringen

**Observasjon:** Anmelderne («Takst2», «IF Partner», Frende-omtaler) bruker
in4mo fordi forsikringsselskapet krever det, ikke fordi de vil.

**Prinsipp:** DocrAI konkurrerer ikke med in4mo om å være skinnen mot
forsikringsselskapene — vi vinner takstpersonen på feltopplevelse og leverer
strukturert inn i den flyten forsikringsselskapet allerede krever.

**Status:** In4mo-eksport ligger i totalbildet som planlagt integrasjon.
Rapportgenereringen produserer allerede strukturert, forsikringsklart innhold.

**Gjenstår:** Definer eksportformatet mot in4mo (felter, medier, sjekklister)
og bygg eksporten som egen backlogpost.

## 6. Markedet ber eksplisitt om AI-laget

**Observasjon:** Wenn Property holder 5,0★, og anmeldelsen sier: «Ekstremt
tidsbesparende. Link den opp med en AI-agent, så sparer du mye tid.» Brukerne
ber om akkurat det DocrAI er.

**Prinsipp:** AI-dybden er differensieringen — årsaksvurdering
(akutt/gradvis), Byggforsk-forankring og forsikringsklar rapport, ikke bare
raskere dokumentasjon. Wenn er produktkonkurrenten å slå på dette; god
feltopplevelse er inngangsbilletten, ikke målet.

**Status:** Rapportmotoren med årsak/omfang er kjernen i dagens løsning.
Byggforsk-RAG og godkjenningsstempel ligger i planen.

**Gjenstår:** Byggforsk-RAG med siterbare referanser i rapporten, og
godkjenningsflyt der takstpersonen står faglig ansvarlig for AI-utkastet.

## 7. Feltfeil rettes først — alltid

**Observasjon:** At en kjent feil kan stå urettet i ti år viser hva som skjer
når feltappen er en bigeskjeft for leverandøren. Det er in4mos strukturelle
svakhet — og den blir DocrAIs hvis vi arver holdningen.

**Prinsipp:** Feil som rammer feltløypa (fangst, lagring, synk, rapport)
prioriteres foran all funksjonsutvikling. Ingen kjent feltfeil skal overleve
mer enn én utviklingssyklus.

**Status:** Praktisert i denne fasen (feillisten fra gjennomgangen ble rettet
før nye funksjoner). Må formaliseres når flere bidrar.

## Ny konkurrent oppdaget august 2026: Befar (befar.io)

Norsk befaringsapp for takstmenn, bygget «av fagfolk som selv står ute på
befaring» (utviklet med byrået Hellevang & Co). Viktig presisering: Befar er
et **bolighandel-verktøy** — tilstandsrapporter etter NS 3600:2025 og
forskrift til avhendingslova — ikke et skadeverktøy. De er Norges svar på
Spectora. Ingen video/lyd-fangst, ingen beviskjede, ingen saksunderlag fra
offentlige kilder; motoren er et regelstyrt faglig rammeverk. (Merk:
markedsføringen nevner ikke AI, men brukeravtalen deres krever verifisering
av «AI-genererte forslag» — et AI-lag er på vei. Forretningsmodell: 500 kr
per rapport + 2 000 kr/år NS 3600-lisens — se `ns3600-og-befar-ui.md`.)

**Validering (deres pitch speiler våre veddemål):**
- «Rapporten bygges opp mens du jobber» ↔ vårt AI-utkast fra fangsten.
- Adaptiv struktur («alt du ikke trenger, forsvinner») ↔ romløypa vår.
- «Det er alltid takstmannens vurderinger som gjelder» ↔ godkjenningsflyten.
- Standard-forankring (NS 3600) ↔ Byggforsk-forankringen vår.
Markedet konvergerer mot de samme sannhetene — veddemålene våre er riktige,
og de haster mer.

**Forskjellen som beskytter oss:** Befar selger *uavhengighet fra
forsikringsselskaper* som verdi — riktig i bolighandel, der habilitet er
poenget. Vårt marked er det motsatte: skadesaker der oppgjøret SKJER i
forsikringsflyten, og årsak/akutt-gradvis, beviskjede og in4mo-leveranse er
kjernen. Segmentene er naboer med samme bruker, ikke samme jobb.

**Trusler å ta på alvor:**
1. Samme brukerrelasjon — de kan ekspandere fra tilstand til skade senere.
2. Samme oppmerksomhetskanaler (Norsk takst-miljøet): kampanjebudskapet vårt
   må alltid si «skadesak/forsikring» eksplisitt, så vi ikke høres ut som
   «enda en befaringsapp».
3. Fagfolk-bygget gir dem domenetroverdighet — vår motsvarighet er faglig
   råd + ride-alongs (kapabilitet 1 i faseplanen), ikke markedsføringsspråk.

**Å lære av dem (inn i løsningen):**
- «Arbeid direkte i den ferdige rapportvisningen» — ingen eksport-hopping,
  ingen separate skrivevinduer. Dette er riktig UX for A5: når rapporten
  flyttes til Postgres, bygges redigeringen i ferdig rapportvisning med
  felt-diff — ikke som skjema.
- Deres uavhengighets-posisjonering tvinger frem vår: «uavhengig av
  forsikringsselskapene — men leverer rett inn i flyten deres.»

## Statusoppdatering 14. august 2026 — verifisert mot primærkilder

Full re-research av konkurrentbildet (selskapssider, brukeravtaler, App Store/
Google Play, Brønnøysund, Forskningsrådets prosjektbank, presse). Kun endringer
og nye funn under — alt annet i dokumentet står uendret og er re-verifisert.

### in4mo (Solera) — fortsatt 1,9★, fortsatt uten AI
- Task Reporter 17.0.0 slapp 13. aug 2026 (ansiktssladding, romdetaljer på
  foto, stabilitet) — appen utvikles aktivt, men uten AI-funksjoner.
- Soleras AI-satsing («Solera AI Engine» apr 2026, Qapter-fotoanalyse) er
  eksplisitt kun bil. AI i property-skinnen: reell, ikke-materialisert trussel.
- **Merk:** in4mo skygget Ocab — vår pilotpartner — i felt i mai 2025
  («customer collaboration»). De kjenner Ocabs arbeidsflyt og smertepunkter.

### Befar — uendret produkt, tidligere fase enn antatt
- Prising (500 kr/rapport + 2 000 kr/år), gated onboarding og
  bolighandel-scope uendret; brukeravtalen (oppdatert 16.06.2026) har nå en
  eksplisitt AI-klausul med verifiseringsplikt.
- BEFAR AS ble stiftet 08.04.2026 (Sarpsborg, aksjekapital 30 000 kr, ingen
  registrerte ansatte, ikke MVA-registrert) — svært tidlig fase. Ingen app i
  App Store/Google Play (webbasert), null presseomtale funnet.
- Ny uttalt ambisjon på hjelpesidene: hele arbeidsflyten «fra booking til
  fakturering».

### Wenn Property — beveger seg mot skadedomenet via FoU
- Prising uendret (350/999 kr/mnd). ARR >2 MNOK (apr 2026), 100+ betalende
  bedrifter, churn 4 %; regnskap 2025: 0,5 MNOK omsetning, −3,3 MNOK resultat.
  Android-app mai 2026 (50+ nedlastinger); App Store fortsatt 5,0★/3.
- Feb 2026: API/MCP-kobling — kundene kan koble Claude/ChatGPT til
  prosjektdataene sine.
- **Viktigst:** Wenn leder FoU-prosjektet CliVa (Forskningsrådet, 10,9 MNOK).
  Wenns investorside beskriver CliVa som klimarisikoanalyse på bygningsnivå (2025–2028), ikke AI-skadevurdering (rettet 29.09.2026, jf. `docs/verdens-beste-losning.md` §6). Klimarisiko per bygg, med SINTEF
  Byggforsk-levetidsdata og forsikringsbransjen som uttalt interessent.
  FoU, ikke produkt — men dokumentert kurs mot vårt domene; trussel 2 i
  USA-analysen er skjerpet. Produktflatene er fortsatt 100 % håndverker/
  tilbudsfase.
- **Korreksjon:** MesterAlliansen-avtalen er ikke lenger synlig hos noen av
  partene; profilerte partnere nå: Bygghåndverk Norge, NKF, Byggmann,
  VestlandsHus.

### Skinnene automatiserer rundt rapporten — ikke rapporten
- Gjensidige utvidet Scalepoint-samarbeidet til bygningsskader 11.05.2026
  («AI Cost Control»): regelbasert sanntidsgodkjenning av håndverkertilbud —
  kostnadskontroll, ikke rapportskriving eller fotoanalyse.
- CAB/MEPS: første AI-verktøy sep 2025 (CABAS Assistant, kun bil — «første i
  en serie»), videobefaring i MEPS okt 2025. If bruker MEPS for byggskader i
  hele Norden (siden 2023) parallelt med in4mo.

### Nye aktører inn i analysen
| Aktør | Hva | Trussel |
|---|---|---|
| **Pretakst** (pretakst.no) | Tal inn under befaringen → AI skriver tilstandsrapporten (bolighandel/avhendingslova). 149 kr/rapport. Pre-lansering. | Samme mekanikk som oss i nabosegmentet — direkte konkurrent ved pivot til skade. Prisen treffer vårt veiledende klippekortnivå (jf. `beslutningsnotat-prising.md`). |
| **Smarttakst** | Etablert takstverktøy (15 000+ rapporter), dekker også skadetakst. AI = skrivehjelp. 190 kr/rapport el. 2 490–3 690 kr/mnd. | I vårt segment, men uten media-analyse og årsaksvurdering. |
| **Bdeo** (via CAB) | Kunden filmer skaden, AI vurderer — selvbetjent triage for forsikringsselskap, nordisk distribusjon via CAB. | Foto/video-AI i forsikringsflyten — men uten fagperson og årsaksrapport. |
| **Simplifai** (Oslo) | Dokument-AI for skadeoppgjør (kunde: Claims Link). | Angriper flyten fra back-office, ikke befaringen. |
| **iVerdi/IVIT** | ~100 000 tilstandsrapporter/år, regelbasert TG-forslag. | Største distribusjonsrisikoen hvis de legger gen-AI oppå. Overvåk. |

### Konklusjon — nisjen står åpen, men konvergensen er dokumentert
Fortsatt ingen aktør i Norden som kombinerer befaringsmedia → AI-utkast med
årsak og akutt/gradvis → Byggforsk-forankring → godkjenningsstempel →
forsikringsklar rapport. Men presset kommer nå fra tre kanter samtidig: Wenn
(FoU mot skadevurdering), Pretakst (samme mekanikk i nabosegmentet) og
skinnene (automatisering tett rundt rapporten). Farten vår er forsvaret.

Hoveddokumentet med markedskart, trusselvurderinger og tilpasningsstrategi er
`konkurrentanalyse.md`. Selskapsverifiseringen (org.nr, eiere, regnskap —
dobbeltverifisert mot Brønnøysund/Regnskapsregisteret for IN-søknaden) ligger i
`konkurrent-selskapsanalyse.md`. Nytt der (aug 2026): Vendu AS er konkurs, og
iVerdi er del av Spir Group (samme konsern som Ambita og Boligmappa).

## Oppsummert kobling til backlog

| Erfaring | Dekkes av | Nytt/utestående |
|---|---|---|
| 1 Hastighet | B14/B15 offline-synk (bygget) | Ytelsesbudsjett + måling |
| 2 Stabilitet | Lokal-først-lagring (bygget) | Krasjrapportering, gjenopprettingstest |
| 3 Ikke tegn — hent | Dokumentlaget i totalbildet | Rom/fuktlogg på plantegning |
| 4 Varsler med dypmål | `?retry=1`-mønsteret (bygget) | Sjekklistepunkt for alle varsler |
| 5 Kjøper ≠ bruker | Totalbildet (In4mo-eksport) | Eksportformat + implementasjon |
| 6 AI-laget | Rapportmotoren (bygget) | Byggforsk-RAG, godkjenningsstempel |
| 7 Feltfeil først | Praktisert | Formaliseres som arbeidsregel |
