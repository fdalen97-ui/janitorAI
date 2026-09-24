// Norsk bokmål — all brukersynlig tekst i appen hentes herfra (backlog B2).
// Nøkler er gruppert per flate. Backend-verdier (statuskoder, feltnavn) oversettes
// ved visning, aldri ved lagring.

export const nb = {
  common: {
    appName: 'DocrAI',
    ok: 'OK',
    cancel: 'Avbryt',
    save: 'Lagre',
    delete: 'Slett',
    retry: 'Prøv igjen',
    close: 'Lukk',
    back: 'Tilbake',
    next: 'Neste',
    done: 'Ferdig',
    open: 'Åpne',
    search: 'Søk',
    loadingEllipsis: 'Laster …',
    error: 'Noe gikk galt',
    rateLimited: (minutes: number) =>
      minutes <= 1
        ? 'Mange KI-forespørsler på kort tid — vent et minutt og prøv igjen.'
        : `Mange KI-forespørsler på kort tid — prøv igjen om ca. ${minutes} minutter.`,
  },

  tabs: {
    home: 'Prosjekter',
    guide: 'Guide',
  },

  notFound: {
    headerTitle: 'Ikke funnet',
    code: '404 — ikke funnet',
    title: 'Denne siden finnes ikke.',
    hint: 'Lenken kan være skrevet feil, eller siden er flyttet.',
    goHome: 'Til prosjektene',
  },

  sync: {
    idle: 'Skysynk',
    syncing: 'Synkroniserer …',
    synced: 'Lagret i skyen',
    offline: 'Venter på nett — lagret lokalt',
    error: 'Synkfeil',
    disabled: 'Lagret på enheten',
    mediaNotSynced: 'Medier ikke synkronisert',
    syncNow: 'Synkroniser nå',
  },

  status: {
    draft: 'Utkast',
    processing: 'Behandler …',
    ready: 'Klar',
    failed: 'Feilet',
  },

  // Saksfremdrift (goal gradient i sober form): fire steg mot godkjent rapport.
  caseProgress: {
    sak: 'Sak',
    befaring: 'Befaring',
    rapport: 'Rapport',
    godkjent: 'Godkjent',
    a11y: (done: number, total: number) => `Saksfremdrift: ${done} av ${total} steg fullført`,
  },

  projects: {
    title: 'Prosjekter',
    subtitle: 'Befaringer og skadesaker',
    created: 'Prosjektet ble opprettet',
    dateNotSet: 'Ikke angitt',
    unknownInspector: 'Ukjent takstperson',
    empty: 'Ingen prosjekter ennå',
    emptyHint: 'Opprett et prosjekt for å starte en befaring.',
    newProject: 'Nytt prosjekt',
    searchPlaceholder: 'Søk i prosjekter',
    filterAll: 'Alle',
    inspectorLabel: 'Takstperson',
    createdLabel: 'Opprettet',
    openProject: 'Åpne prosjekt',
    notesCount: 'notater',
    photosCount: 'bilder',
    audioCount: 'lydklipp',
    deleteTitle: 'Slette prosjektet?',
    deleteMessage: (name: string) =>
      `«${name}» og alle notater, bilder og opptak slettes. Dette kan ikke angres.`,
    deleteConfirm: 'Slett prosjektet',
    deleted: 'Prosjektet ble slettet',
    duplicateName: 'Et prosjekt har allerede dette navnet',
    nameLabel: 'Prosjektnavn',
    namePlaceholder: 'F.eks. Solbergveien 14, Rykkinn',
    nameFromAddressHint: 'Tips: bruk adressen som prosjektnavn',
    useAddress: 'Bruk adressen',
    projectMenu: 'Prosjektmeny',
    testProject: 'Testprosjekt',
    createTestCopy: 'Lag testkopi',
    preparingTestCopy: 'Forbereder testkopi …',
    testCopyCreated: 'Testprosjektet ble opprettet',
    testCopyNeedsUpload:
      'Testkopien kan lages når alle bilder og opptak er lastet opp. Prøv igjen når synkroniseringen er ferdig.',
    testCopyFailed: 'Kunne ikke lage testkopien',
    documentCreated: 'Dokument opprettet',
    timeToApproved: (duration: string) => `Befaring → godkjent rapport: ${duration}`,
  },

  detail: {
    notesTab: 'Notater',
    reportTab: 'Rapport',
    audioNote: 'Lydnotat',
    photo: 'Bilde',
    video: 'Video',
    stopRecording: 'Stopp opptak',
    recording: 'Tar opp …',
    seeReport: 'Se rapport',
    saveNote: 'Lagre notat',
    notePlaceholder: 'Skriv et notat …',
    play: 'Spill av',
    stop: 'Stopp',
    transcribing: 'Transkriberer …',
    transcriptionReady: 'Transkripsjon klar',
    transcriptionFailed: 'Transkripsjonen feilet',
    uploaded: 'Lastet opp',
    uploading: 'Laster opp …',
    deleteNoteTitle: 'Slette notatet?',
    deleteNoteMessage: 'Notatet og tilhørende medier slettes. Dette kan ikke angres.',
    photoAdded: 'Bilde lagt til',
    videoAdded: 'Video lagt til',
    audioSaved: 'Lydnotat lagret',
    noteSaved: 'Notat lagret',
    takePhoto: 'Ta bilde',
    chooseFromLibrary: 'Velg fra biblioteket',
    recordVideo: 'Ta opp video',
    chooseVideo: 'Velg video',
    mediaSourceTitle: 'Legg til bilde',
    videoSourceTitle: 'Legg til video',
    loadingVideo: 'Laster video …',
    description: 'Prosjektbeskrivelse',
    descriptionPlaceholder: 'Beskriv befaringen kort …',
  },

  report: {
    generate: 'Lag rapport',
    generateTest: 'Lag testrapport',
    regenerateTest: 'Kjør rapport på nytt',
    generating: 'Lager rapport …',
    testProjectHint:
      'Dette prosjektet kan brukes om igjen. Hver kjøring lager et nytt Google-dokument, mens tidligere forsøk beholdes i rapporthistorikken.',
    generatingSteps: [
      'Samler befaringens dokumentasjon',
      'Vurderer observasjoner',
      'Sammenstiller faglig grunnlag',
      'Skriver rapport',
    ],
    ready: 'Rapporten er klar',
    failed: 'Rapportgenereringen feilet',
    reset: 'Tilbakestill rapport',
    resetting: 'Tilbakestiller …',
    resetConfirmTitle: 'Tilbakestille rapporten?',
    resetConfirmMessage:
      'Rapportlenken og godkjenningen fjernes fra dette prosjektet, men Google-dokumentet og befaringens dokumentasjon beholdes. Du kan lage en ny rapport senere.',
    resetSuccess: 'Rapporten er tilbakestilt til utkast',
    resetFailed: 'Kunne ikke tilbakestille rapporten',
    resetInProgress:
      'Rapporten lages fortsatt — vent til genereringen er ferdig før du tilbakestiller.',
    alreadyInProgress:
      'En rapport genereres allerede for dette prosjektet — vent til den er ferdig.',
    openReport: 'Åpne rapporten',
    downloadPdf: 'Last ned PDF',
    downloadWord: 'Last ned Word',
    downloadIsDraftWarning:
      'PDF/Word-filen er det opprinnelige AI-utkastet fra dokumentet. Rettelsene dine vises i delingslenken, men er ennå ikke flettet inn i dokumentfilen.',
    interrupted: 'Genereringen ble avbrutt — prøv igjen.',
    stillRunning:
      'Rapporten lages fortsatt på serveren — resultatet hentes inn når du åpner prosjektlisten om noen minutter.',
    recovered: 'Fant rapporten fra forrige forsøk — dokumentet er klart.',
    unauthorized: 'Tilgangskoden er ugyldig eller utløpt.',
    details: 'Rapportdetaljer',
    approvedBy: 'Godkjent av takstperson',
    draftBadge: 'AI-utkast — ikke godkjent',
    approvalHint:
      'AI-en har laget et utkast. Du står faglig ansvarlig for innholdet — les gjennom rapporten, kontroller årsak og om skaden er akutt eller gradvis, og godkjenn før deling.',
    approve: 'Godkjenn rapport',
    approveConfirmTitle: 'Godkjenn rapporten?',
    approveConfirmMessage:
      'Du bekrefter at du har lest rapporten og faglig vurdert innholdet, inkludert årsak og om skaden er akutt eller gradvis. Godkjenningen stemples i rapporten med navn og tidspunkt.',
    approvedToast: 'Rapporten er godkjent',
    approvedStamp: (name: string, when: string) => `Godkjent av ${name} · ${when}`,
    withdraw: 'Trekk tilbake godkjenningen',
    withdrawConfirmTitle: 'Trekke tilbake godkjenningen?',
    withdrawConfirmMessage:
      'Rapporten markeres som utkast igjen, og nye delingslenker kan ikke lages før den godkjennes på nytt.',
    withdrawnToast: 'Godkjenningen er trukket tilbake',
    approverNameMissing: 'Legg inn navnet ditt under Guide → Takstperson før du godkjenner.',
    editTitle: 'Rapporten — rediger direkte',
    editHint:
      'Slik mottakeren får den. Trykk i et felt og rett rett i rapporten — AI-utkastet arkiveres uendret, og endringene dine merkes.',
    draftVersionLine: (when: string) => `AI-utkast · ${when} — arkiveres uendret`,
    fieldChanged: 'endret',
    fieldArea: 'Skadested',
    fieldSource: 'Kilde',
    fieldCause: 'Årsak',
    fieldDescription: 'Faglig beskrivelse',
    fieldExtent: 'Omfang',
    fieldRepairs: 'Tiltak',
    editClearedApproval: 'Endringen fjernet godkjenningen — les gjennom og godkjenn på nytt.',
    changesSummary: (n: number) =>
      n === 0
        ? 'Ingen felter endret fra AI-utkastet ennå.'
        : n === 1
          ? 'Ett felt endret fra AI-utkastet.'
          : `${n} felter endret fra AI-utkastet.`,
  },

  underlag: {
    title: 'Saksunderlag',
    searching: 'Søker i Kartverket …',
    pickHint: 'Velg adressen fra Kartverket, så fylles saken ut automatisk.',
    municipality: 'Kommune',
    cadastre: 'Gnr/bnr',
    coordinates: 'Posisjon',
    openMap: 'Åpne i Norgeskart',
    mapAlt: 'Kartutsnitt over eiendommen',
    rainAroundDamage: 'Nedbør rundt skadedato',
    rainStation: 'målt ved',
    elevation: 'Terreng',
    metersAboveSea: 'moh.',
    weather24: 'Vær neste døgn',
    buildingType: 'Bygningstype',
    buildingStatus: 'Bygningsstatus',
    heritage: 'Kulturminne/SEFRAK-registrert',
    buildingNumber: 'Bygningsnr.',
    sourceLine: 'Kilde: Kartverket og åpen matrikkel (Geonorge)',
    seeMore: 'Se mer underlag',
    seeLess: 'Vis mindre',
    linkSeeiendom: 'Eiendommen hos Kartverket',
    linkSeeiendomSub: 'matrikkel og grunnbok',
    linkPlan: 'Planinnsyn — reguleringsplaner',
    linkPlanSub: 'arealplaner.no',
    linkNve: 'Flom- og skredaktsomhet',
    linkNveSub: 'NVE temakart',
    linkNgu: 'Grunnforhold og løsmasser',
    linkNguSub: 'NGU — drenering og infiltrasjon',
    linkSeklima: 'Historisk vær og nedbør',
    linkSeklimaSub: 'Seklima (MET)',
    linkFlyfoto: 'Flyfoto av eiendommen',
    linkFlyfotoSub: 'Norge i bilder',
    linkBoligmappa: 'Boligmappa',
    linkBoligmappaSub: 'boligens dokumenthistorikk',
    municipalHint: 'Byggesaks- og VA-innsyn varierer per kommune — sjekk kommunens innsynsportal.',
  },

  rooms: {
    all: 'Alle',
    add: '+ Rom',
    addTitle: 'Nytt rom',
    placeholder: 'F.eks. Kjeller bad',
    confirm: 'Legg til',
    added: (name: string) => `«${name}» lagt til`,
    duplicate: 'Rommet finnes allerede',
    capturingIn: (name: string) => `Fanger i: ${name}`,
    wetChecklistTitle: 'Huskeliste — våtrom',
    wetChecklistHint:
      'Rommet er et våtrom. Dokumentér punktene under — de styrer også hvilke Byggforsk-anvisninger rapporten forankres i.',
    checklistHint:
      'Dokumentér punktene under mens du er i rommet — huskelisten er en påminnelse, vurderingen er din.',
    completeRoom: 'Fullfør rom',
    reopenRoom: 'Gjenåpne rom',
    completedToast: (name: string) => `«${name}» markert ferdig befart`,
    reopenedToast: (name: string) => `«${name}» gjenåpnet`,
    completedProgress: (done: number, total: number) => `${done} av ${total} rom ferdig befart`,
  },

  share: {
    title: 'Del rapporten',
    create: 'Lag delingslenke',
    creating: 'Lager lenke …',
    linkLabel: 'Lenke',
    pinLabel: 'PIN-kode',
    statusPrefix: 'PIN-beskyttet · utløper',
    copyLink: 'Kopier lenke',
    copied: 'Lenke kopiert',
    shareVia: 'Del lenken',
    hint: 'Mottakeren åpner lenken uten konto og låser opp med PIN-koden. Send PIN-koden i en annen kanal enn selve lenken.',
    failed: 'Kunne ikke lage delingslenke',
    requiresToken: 'Skriv inn en gyldig tilgangskode for å dele.',
    requiresApproval: 'Rapporten må godkjennes av takstperson før den kan deles.',
  },

  auth: {
    accessTitle: 'Tilgangskode',
    accessMessage: 'Skriv inn tilgangskoden fra DocrAI',
    accessPlaceholder: 'Tilgangskode',
    accessSave: 'Lagre kode',
    accessMissing: 'Du må oppgi en tilgangskode for å synkronisere.',
    serverUnreachable:
      'Fikk ikke kontakt med serveren. Koden kan være riktig — vent litt og prøv igjen.',
  },

  guide: {
    title: 'Slik fungerer DocrAI',
    profileTitle: 'Takstperson',
    nameLabel: 'Navn',
    phoneLabel: 'Telefon',
    companyLabel: 'Firma',
  },
} as const;

// dd.mm.åååå (B2: norske datoformater)
export function formatDate(input: Date | string | number): string {
  // Rene datostrenger ('2026-08-04') må ikke innom Date: new Date tolker dem
  // som UTC-midnatt, som viser gårsdagens dato i tidssoner vest for UTC.
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function formatTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export function formatDateTime(input: Date | string | number): string {
  const date = formatDate(input);
  const time = formatTime(input);
  return date && time ? `${date} kl. ${time}` : date;
}
