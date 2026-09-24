export type ReportContributor = {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
};

export type ReportBuilding = {
  type?: string;
  size?: string;
  buildingYear?: string;
  renovationsDone?: string;
  otherInfo?: string;
  damagedAreaDescription?: string;
  damagedAreaEstimatedValue?: string;
};

/** Metadata the inspector fills in per project; maps 1-to-1 to the Google Doc template keys. */
export type ReportMeta = {
  caseNumber?: string;
  workingNumber?: string;
  inspectionDoneByName?: string;
  inspectionDoneByPhone?: string;
  inspectionDoneByCompany?: string;
  pictureObject?: string;
  insuranceCompany?: string;
  insuranceAgent?: string;
  customerName?: string;
  addressStreet?: string;
  addressPostcodeCity?: string;
  damageDate?: string;
  inspectionDate?: string;
  /** At least one contributor; rendered as report.contributor.1.*, .2.*, … */
  contributors?: ReportContributor[];
  /** At least one building; rendered as bulding.0.*, bulding.1.*, … */
  buildings?: ReportBuilding[];
  possibleRecourse?: string;
  measuresToPreventFutureDamage?: string;
  startedRepairs?: string;
  habitableValueLossPerMonth?: string;
  habitableOtherInfo?: string;
  summaryText?: string;
};

/** Posisjon fanget i felt (B9). Bevis uten geo er fortsatt gyldige. */
export type GeoPoint = {
  lat: number;
  lng: number;
};

/**
 * Strukturert rapportinnhold (A5). Feltene speiler AI-motorens DamageAnalysis
 * og er redigerbare i ferdig rapportvisning. AI-utkastet (reportDraft) er
 * uforanderlig; den godkjente versjonen (reportFinal) starter som kopi og
 * bærer takstpersonens rettelser — diffen mellom dem er pilotens viktigste
 * kvalitetsdata.
 */
export type ReportContent = {
  /** Rommet/området som inspiseres. */
  area?: string;
  /** Kilden til skaden. */
  source?: string;
  /** Strukturert kildekategori fra vannskadeanalysen. */
  sourceCategory?: string;
  /** Den tekniske årsaken. */
  cause?: string;
  /** Om skadeutviklingen vurderes som akutt eller gradvis. */
  acuteOrGradual?: string;
  /** Fyldig faglig beskrivelse. */
  description?: string;
  /** Fysisk spredning og berørte materialer. */
  extentDescription?: string;
  /** Nødvendige tekniske tiltak. */
  repairsDescription?: string;
  isHabitable?: boolean;
};

export type ReportVersion = {
  content: ReportContent;
  /** ISO-tidspunkt for når versjonen ble laget/sist endret. */
  at: string;
  /**
   * Proveniens: hvilken promptgenerasjon i AI-motoren som produserte utkastet
   * (motorens PROMPT_VERSION). Gjør draft-vs-godkjent-diffen og
   * valideringsbatteriet målbare per promptversjon.
   */
  promptVersion?: string;
};

/** Feltnøklene i ReportContent som diffes mellom utkast og godkjent versjon. */
export const REPORT_CONTENT_FIELDS = [
  'area',
  'source',
  'sourceCategory',
  'cause',
  'acuteOrGradual',
  'description',
  'extentDescription',
  'repairsDescription',
] as const;
export type ReportContentField = (typeof REPORT_CONTENT_FIELDS)[number];

/**
 * Godkjenningsstempel: takstpersonen har lest AI-utkastet og står faglig
 * ansvarlig for innholdet. Uten stempel er rapporten et utkast og kan ikke
 * deles. Ny generering nullstiller stempelet — det gjelder alltid den
 * konkrete rapportversjonen som forelå ved godkjenning.
 */
export type ReportApproval = {
  approvedBy: string;
  /** ISO-tidspunkt for godkjenningen. */
  approvedAt: string;
};

/** Saksunderlag hentet fra offentlige API-er ved adressevalg (Kartverket). */
export type CaseFile = {
  addressText: string;
  postCode?: string;
  postPlace?: string;
  municipality?: string;
  /** Firesifret kommunenummer (f.eks. «0301») — trengs for eiendomsoppslag. */
  municipalityNumber?: string;
  gnr?: number;
  bnr?: number;
  lat: number;
  lon: number;
};

/** Rom i befaringsløypa (A1) — organiserende enhet for bevis og AI-kontekst. */
export type Room = {
  id: string;
  name: string;
  /**
   * ISO-tidspunkt for når takstpersonen markerte rommet som ferdig befart
   * (Befar-mønsteret: kompletthet er en førsteklasses handling). Kan angres —
   * dette er fagpersonens egen markering, ingen automatisk vurdering.
   */
  completedAt?: string;
};

export type Photo = {
  id: string;
  uri: string;
  caption: string;
  aiGenerated?: boolean;
  /** ID of the durable copy stored on the backend (set after upload). */
  remoteId?: string;
  /** SHA-256 satt av serveren ved opplasting (B11). */
  sha256?: string;
  geo?: GeoPoint;
  /** ISO-tidspunkt for fangst i felt. */
  capturedAt?: string;
  /**
   * Bildedataene er varig tapt lokalt (web: død blob-/IDB-referanse etter at
   * appen ble lukket før opplasting). Synken hopper over bildet i stedet for
   * å feile evig; brukeren varsles og kan legge bildet til på nytt.
   */
  lost?: boolean;
};

export type Note = {
  id: string;
  text: string;
  createdAt: string;
  /** Rommet bevisene i notatet hører til (A1). Notater uten rom er gyldige. */
  roomId?: string;
  /** Last modification time (ISO). Used for per-note merge across devices. */
  updatedAt?: string;
  audioUri?: string;
  /** ID of the durable audio copy stored on the backend (set after upload). */
  audioRemoteId?: string;
  /** SHA-256 satt av serveren ved opplasting (B11). */
  audioSha256?: string;
  transcription?: string;
  images?: string[];
  photos?: Photo[];
  /** Local URI for a video clip attached to this note. */
  videoUri?: string;
  /** ID of the durable video copy stored on the backend (set after upload). */
  videoRemoteId?: string;
  /** SHA-256 satt av serveren ved opplasting (B11). */
  videoSha256?: string;
  videoGeo?: GeoPoint;
  /** ISO-tidspunkt for video-fangst i felt. */
  videoCapturedAt?: string;
};

export type Project = {
  id: string;
  /**
   * Skjemagenerasjon for prosjektdokumentet. Regel hos alle lesere:
   * «mangler = 1». Fremtidige formendringer gjøres som migrering-ved-lesing
   * («if (v < 2) …») i loadProjects i stedet for at hver leser gjetter på
   * dokumentets generasjon. Stemples ved hver lagring (projectsStorage).
   */
  schemaVersion?: number;
  /** Replayable copy used for repeated report-quality testing. */
  isTestProject?: boolean;
  /** Original project that supplied this test project's inspection evidence. */
  sourceProjectId?: string;
  name: string;
  inspectionDate: string;
  inspector: string;
  notes: Note[];
  report?: string;
  projectDescriptionText?: string;
  projectDescriptionAudioUri?: string;
  projectDescriptionAudioRemoteId?: string;
  projectDescriptionTranscription?: string;
  projectDescriptionUpdatedAt?: string;
  /** Last modification time (ISO). Used for last-write-wins sync. */
  updatedAt?: string;
  /**
   * Tombstones for notes deleted on this project: note id -> deletion time
   * (ISO). Lets the per-note merge keep a note deleted on one device deleted
   * everywhere instead of resurrecting it from another device's copy.
   */
  deletedNotes?: Record<string, string>;
  /** Per-project metadata used to populate Google Doc template placeholders. */
  reportMeta?: ReportMeta;
  /** Saksunderlag fra adressevalget i veiviseren (Kartverket m.fl.). */
  caseFile?: CaseFile;
  /** Befaringsløypas rom (A1). */
  rooms?: Room[];
  /** URL of the generated Google Doc (persisted after successful generation). */
  reportUrl?: string;
  /** Server-owned boundary hiding report history before the active session. */
  reportResetAt?: string | null;
  /** Server-derived proof that at least one Google Doc was created successfully. */
  hasSuccessfulDocument?: boolean;
  /** Server-derived timestamp for the latest successful Google Doc generation. */
  successfulDocumentCreatedAt?: string | null;
  /** Lifecycle status of the most recent report generation attempt. */
  reportStatus?: 'processing' | 'ready' | 'failed';
  /** Correlates recovery with the exact durable server-ledger attempt. */
  reportAttemptId?: string;
  /** Takstpersonens godkjenning av gjeldende rapport; kreves før deling. */
  reportApproval?: ReportApproval;
  /** AI-utkastet slik motoren leverte det — arkiveres uendret (A5). */
  reportDraft?: ReportVersion;
  /** Den redigerbare versjonen takstpersonen godkjenner og deler (A5). */
  reportFinal?: ReportVersion;
  /** Human-readable error from the last failed generation (shown on the project card). */
  reportError?: string;
};

export const PROJECT_STORAGE_KEY = '@inspection_projects';

// Sentinel-verdier som lagres i prosjektdata når felt står tomme. De er
// engelske av historiske grunner og må aldri vises rått — begge skjermene
// oversetter dem ved visning (nb.projects.dateNotSet/unknownInspector).
export const UNKNOWN_INSPECTOR = 'Unknown inspector';
export const NO_DATE_SET = 'No date set';
