import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  UnauthorizedError,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { Image as ExpoImage } from 'expo-image';

import { getCurrentGeo } from '@/src/lib/geo';
import { newId } from '@/src/lib/ids';
import { dataUrlToObjectUrlWeb, downscalePhotoWeb, measurePhotoBytesWeb, persistPhotoBytesWeb } from '@/src/lib/photoDownscale';
import { loadProfile } from '@/src/storage/profileStorage';
import { formatMinutes, minutesToApproved } from '@/src/features/projects/metrics';
import { tileForCoordinate } from '@/src/lib/kartverket';
import { logError, logAction } from '@/src/lib/logger';
import {
  GeoPoint,
  NO_DATE_SET,
  Note,
  Project,
  REPORT_CONTENT_FIELDS,
  ReportContent,
  ReportContentField,
  ReportMeta,
  UNKNOWN_INSPECTOR,
} from '@/src/features/projects/types';
import { changedFields, contentFromAnalysis } from '@/src/features/projects/reportVersions';
import {
  ROOM_SUGGESTIONS,
  checklistForRoom,
  roomNameById,
} from '@/src/features/projects/rooms';
import { ReportDetailsSection } from '@/src/features/projects/ReportDetailsSection';
import { ReportGeneratingOverlay } from '@/src/features/projects/ReportGeneratingOverlay';
import { applyNoteChanges } from '@/src/features/projects/noteChanges';
import { nb, formatDate, formatDateTime } from '@/src/i18n/nb';
import SyncStatusIndicator from '@/src/components/SyncStatusIndicator';
import {
  loadProjects,
  saveProjects,
  getProject,
  updateProject as updateProjectInStorage,
} from '@/src/storage/projectsStorage';
import {
  clearVideoRetryState,
  pullAndMerge,
  pushProject,
  schedulePush,
  subscribeToProjectUpdates,
  touchProject,
} from '@/src/sync/projectSync';
import { fetchReportStatus, resolveStuckReport } from '@/src/sync/reportRecovery';
import { persistMediaLocally } from '@/src/sync/persistMedia';
import { displayMediaUri } from '@/src/sync/mediaUri';
import { useVideoUploadProgress } from '@/src/sync/syncStatus';
import {
  Body,
  Caption,
  GlassCard,
  IconButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StatusChip,
  TextField,
  Title,
  useAppTheme,
  useToast,
} from '@/src/ui';

// ── Video upload progress bar ─────────────────────────────────────────────────
// Defined outside ProjectDetailScreen so it can call hooks at the top level.
// Shows a live progress bar while a video is uploading, and a spinner for the
// brief "preparing" (blob fetch) and "processing" (server response) phases.
function VideoUploadStatus({
  videoUri,
  onReselect,
}: {
  videoUri: string | undefined;
  onReselect?: () => void;
}) {
  const theme = useAppTheme();
  const pct = useVideoUploadProgress(videoUri);
  // Track how many seconds we've been stuck at pct===null so we can show
  // progressively more helpful messages instead of just "Preparing…" forever.
  const [stallSeconds, setStallSeconds] = useState(0);

  useEffect(() => {
    if (pct !== null) {
      setStallSeconds(0);
      return;
    }
    const id = setInterval(() => setStallSeconds((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [pct]);

  if (pct === null) {
    const isStalled = stallSeconds >= 35;
    const label = isStalled
      ? 'Upload stalled'
      : stallSeconds >= 15
      ? 'Still preparing… (this can take a moment)'
      : 'Preparing…';

    return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ActivityIndicator size="small" color={isStalled ? 'orange' : theme.colors.accent} />
          <Caption muted style={isStalled ? { color: 'orange' } : undefined}>{label}</Caption>
        </View>
        {isStalled && onReselect && (
          <TouchableOpacity
            onPress={onReselect}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: 'orange',
            }}
            accessibilityLabel="Re-select file to retry upload"
          >
            <Caption style={{ color: 'orange' }}>Re-select file</Caption>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (pct >= 100) {
    // Bytes sent — waiting for server to confirm and return the media ID.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Caption muted>{nb.status.processing}</Caption>
      </View>
    );
  }

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Caption muted>{nb.detail.uploading}</Caption>
        <Caption style={{ color: theme.colors.accent, fontVariant: ['tabular-nums'] }}>
          {pct}%
        </Caption>
      </View>
      {/* Progress track */}
      <View style={{
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct}%` as `${number}%`,
          backgroundColor: theme.colors.accent,
          borderRadius: 2,
        }} />
      </View>
    </View>
  );
}

type ProjectTab = 'notes' | 'report';

type ProjectParam = {
  id?: string;
  retry?: string;
};

type ProjectState = {
  projects: Project[];
  project: Project | null;
};

export default function ProjectDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const toast = useToast();
  const { id, retry } = useLocalSearchParams<ProjectParam>();
  const projectId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const wantsRetry = retry === '1';

  const [state, setState] = useState<ProjectState>({ projects: [], project: null });
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [descriptionRecording, setDescriptionRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isGeneratingGoogleDoc, setIsGeneratingGoogleDoc] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ url: string; pin: string; expiresAt: string } | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [caseWeather, setCaseWeather] = useState<{ station: string; totalMm: number } | null>(null);
  const [caseBuilding, setCaseBuilding] = useState<{
    type: string;
    status: string;
    kulturminne: boolean;
    bygningsnummer: string | null;
  } | null>(null);
  const [showMoreUnderlag, setShowMoreUnderlag] = useState(false);
  const [casePlace, setCasePlace] = useState<{
    moh: number | null;
    terreng: string | null;
    tempC: number | null;
    beskrivelse: string | null;
    nedborMm: number | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('notes');
  const [describingPhotos, setDescribingPhotos] = useState<Set<string>>(new Set());
  const [editingPhotos, setEditingPhotos] = useState<Record<string, { editing: boolean; caption: string }>>({});
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isTranscribingDescription, setIsTranscribingDescription] = useState(false);

  const [reportMetaDraft, setReportMetaDraft] = useState<ReportMeta>({ contributors: [{}], buildings: [{}] });
  const [reportMetaOpen, setReportMetaOpen] = useState(false);
  const [metaSaveStatus, setMetaSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveMetaError, setSaveMetaError] = useState<string | null>(null);
  const metaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportMetaDraftRef = useRef<ReportMeta>({ contributors: [{}], buildings: [{}] });
  const projectRef = useRef<Project | null>(null);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [isResettingReport, setIsResettingReport] = useState(false);

  const project = state.project;
  const isTokenValid = tokenStatus === 'valid';

  // showModal=true only when an in-flight AI call was rejected; never on cold start.
  const handleUnauthorized = useCallback(async (showModal = true) => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenError('Ugyldig tilgangskode. Skriv inn en gyldig kode for å fortsette.');
    if (showModal) setShowTokenModal(true);
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await loadTesterToken();

      if (!storedToken) {
        // No token yet — mark invalid but don't pop modal; the banner prompts softly.
        setTokenStatus('invalid');
        return;
      }

      const validation = await validateTesterToken(storedToken);
      if (validation === 'invalid') {
        // Stored token actively rejected — clear quietly; modal only on next AI action.
        await handleUnauthorized(false);
        return;
      }
      // 'valid' — eller 'unreachable' (kaldstart/nettbrudd): behold koden.
      setTokenInput(storedToken);
      setTokenStatus('valid');
      setTokenError(null);
    })();
  }, [handleUnauthorized]);

  const saveToken = async () => {
    setTokenError(null);
    const trimmedToken = tokenInput.trim();

    if (!trimmedToken) {
      setTokenError(nb.auth.accessMissing);
      return;
    }

    setIsValidatingToken(true);
    const validation = await validateTesterToken(trimmedToken);
    setIsValidatingToken(false);

    if (validation === 'valid') {
      await setTesterToken(trimmedToken);
      setTokenStatus('valid');
      setShowTokenModal(false);
      return;
    }

    if (validation === 'unreachable') {
      setTokenError(nb.auth.serverUnreachable);
      return;
    }

    await handleUnauthorized();
  };

  const handleRemoveToken = async () => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenInput('');
    setShowTokenModal(true);
  };

  const loadProject = useCallback(async () => {
    const route = projectId ? `/projects/${projectId}` : '/projects/unknown';

    console.log('[Projects] Project detail params', {
      projectId,
      route,
      file: 'app/projects/[id].tsx',
    });

    if (!projectId) {
      setState({ projects: [], project: null });
      setLoading(false);
      return;
    }

    try {
      let projects = await loadProjects();
      let found = await getProject(projectId);

      if (!found) {
        // Not on this device yet (fresh install / other device): try the server.
        const merged = await pullAndMerge(projects);
        if (merged) {
          await saveProjects(merged);
          projects = merged;
          found = merged.find((p) => String(p.id) === String(projectId)) ?? null;
        }
      }

      console.log('[Projects] Loaded project detail result', {
        projectId,
        found: Boolean(found),
      });

      setState({ projects, project: found });
    } catch (error) {
      console.warn('[Projects] Failed to load project detail', error);
      setState({ projects: [], project: null });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Keep UI in sync when pushProject writes remote IDs back to storage
  // (e.g. videoRemoteId after upload completes) without requiring navigation.
  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribeToProjectUpdates(projectId, (updated) => {
      setState((prev) => ({ ...prev, project: updated }));
    });
    return unsub;
  }, [projectId]);

  // «Prøv igjen» fra prosjektlisten (?retry=1): åpne rapport-fanen og start
  // genereringen på nytt — men først når tilgangskoden er ferdig validert,
  // og aldri mer enn én gang per besøk.
  const retryConsumedRef = useRef(false);
  useEffect(() => {
    if (!wantsRetry || retryConsumedRef.current || loading || !project || tokenStatus === 'checking') {
      return;
    }
    retryConsumedRef.current = true;
    setActiveTab('report');
    if (tokenStatus === 'valid' && project.reportStatus === 'failed') {
      generateGoogleDocReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsRetry, loading, project, tokenStatus]);

  useEffect(() => {
    if (!isEditingDescription) {
      setDescriptionDraft(state.project?.projectDescriptionText ?? '');
    }
  }, [isEditingDescription, state.project]);

  // Initialise reportMeta draft whenever a (different) project loads.
  // Smarte standardvalg: felter vi allerede kjenner svaret på (adresse fra
  // saksunderlaget, befaringsdato, takstperson fra profilen) forhåndsutfylles —
  // aldri over noe brukeren selv har skrevet. Jobben endres fra «fyll ut» til
  // «se over og juster». Auto-utvid seksjonen når de manuelle nøkkelfeltene
  // (saksnummer, kunde) fortsatt står tomme.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    (async () => {
      // Nullstill ventende autolagring fra et ev. forrige prosjekt før
      // utkastet byttes — ellers kunne gamle felter lagres på nytt prosjekt.
      if (metaSaveTimerRef.current) {
        clearTimeout(metaSaveTimerRef.current);
        metaSaveTimerRef.current = null;
      }
      setMetaSaveStatus('idle');
      const meta: ReportMeta = {
        contributors: [{}],
        buildings: [{}],
        ...project.reportMeta,
      };

      const profile = await loadProfile();
      if (cancelled) return;
      const cf = project.caseFile;
      let filled = false;
      const fillIfEmpty = (key: keyof ReportMeta, value: string | undefined) => {
        const trimmed = (value ?? '').trim();
        if (trimmed && !(meta[key] as string | undefined)?.trim?.()) {
          (meta as any)[key] = trimmed;
          filled = true;
        }
      };
      fillIfEmpty('addressStreet', cf?.addressText);
      fillIfEmpty(
        'addressPostcodeCity',
        [cf?.postCode, cf?.postPlace].filter(Boolean).join(' '),
      );
      if (project.inspectionDate && project.inspectionDate !== NO_DATE_SET) {
        fillIfEmpty('inspectionDate', project.inspectionDate);
      }
      fillIfEmpty(
        'inspectionDoneByName',
        profile.name ||
          (project.inspector !== UNKNOWN_INSPECTOR ? project.inspector : ''),
      );
      fillIfEmpty('inspectionDoneByPhone', profile.phone);
      fillIfEmpty('inspectionDoneByCompany', profile.company);

      setReportMetaDraft(meta);
      if (filled) {
        // Persistér standardvalgene med én gang så de også når rapporten om
        // seksjonen aldri åpnes — og synkes til andre enheter.
        await updateProjectLocally({ ...project, reportMeta: meta });
      }
      const needsManualKeys = !meta.caseNumber && !meta.customerName;
      if (needsManualKeys) setReportMetaOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Restore the Google Doc URL from the persisted project record when opening/re-entering.
  useEffect(() => {
    if (project?.reportUrl && !googleDocUrl) {
      setGoogleDocUrl(project.reportUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.reportUrl]);

  const updateProjectLocally = async (updated: Project) => {
    // Stamp the change time so sync can do last-write-wins.
    const touched = touchProject(updated);
    // Update project in storage and get back all projects
    const nextProjects = await updateProjectInStorage(touched);
    const normalizedId = String(touched.id);
    const normalizedProject = { ...touched, id: normalizedId };
    setState({ projects: nextProjects, project: normalizedProject });
    schedulePush(normalizedProject);
  };

  const updateProjectNotes = async (notes: Note[]) => {
    if (!project) return;
    const updatedProject = applyNoteChanges(project, notes);
    await updateProjectLocally(updatedProject);
  };

  // Pilotfunn (aug 2026): «Lagre»-knappen ble glemt og utfylte felt gikk tapt
  // ved navigering. Feltene autolagres nå med debounce; ved lukking av
  // skjermen flushes en ventende lagring umiddelbart.
  const persistReportMeta = async (meta: ReportMeta) => {
    const current = projectRef.current;
    if (!current) return;
    try {
      setSaveMetaError(null);
      await updateProjectLocally({ ...current, reportMeta: meta });
      setMetaSaveStatus('saved');
    } catch (e: any) {
      setMetaSaveStatus('idle');
      setSaveMetaError(e?.message ?? 'Kunne ikke lagre — endringene står fortsatt i skjemaet.');
    }
  };

  const handleReportMetaChange = (meta: ReportMeta) => {
    setReportMetaDraft(meta);
    setMetaSaveStatus('saving');
    if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current);
    metaSaveTimerRef.current = setTimeout(() => {
      metaSaveTimerRef.current = null;
      void persistReportMeta(reportMetaDraftRef.current);
    }, 800);
  };

  useEffect(() => {
    reportMetaDraftRef.current = reportMetaDraft;
  }, [reportMetaDraft]);

  useEffect(() => {
    projectRef.current = project ?? null;
  }, [project]);

  useEffect(() => {
    return () => {
      // Flush en ventende autolagring når skjermen forlates.
      if (metaSaveTimerRef.current) {
        clearTimeout(metaSaveTimerRef.current);
        metaSaveTimerRef.current = null;
        void persistReportMeta(reportMetaDraftRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProjectDescriptionText = async () => {
    if (!project) return;
    const trimmed = descriptionDraft.trim();

    const updatedProject: Project = {
      ...project,
      projectDescriptionText: trimmed || undefined,
      projectDescriptionUpdatedAt: new Date().toISOString(),
    };

    await updateProjectLocally(updatedProject);
    setIsEditingDescription(false);
  };

  const cancelProjectDescriptionEdit = () => {
    setDescriptionDraft(project?.projectDescriptionText ?? '');
    setIsEditingDescription(false);
  };

  // A1 — befaringsløypa: aktivt rom er fangstkonteksten. Alt som fanges mens
  // et rom er valgt, knyttes dit; «Alle» (null) er fortsatt gyldig fangst.
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const addRoom = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !project) return;
    const existing = (project.rooms || []).find(
      (r) => r.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setActiveRoomId(existing.id);
      setAddingRoom(false);
      setNewRoomName('');
      toast.show({ message: nb.rooms.duplicate, variant: 'info' });
      return;
    }
    const room = { id: newId(), name: trimmed };
    await updateProjectLocally({ ...project, rooms: [...(project.rooms || []), room] });
    setActiveRoomId(room.id);
    setAddingRoom(false);
    setNewRoomName('');
    toast.show({ message: nb.rooms.added(trimmed), variant: 'success' });
  };

  // Befar-mønsteret «Fullfør punkt»: kompletthet er en førsteklasses handling.
  // Fagpersonens egen markering — kan angres, appen vurderer ingenting selv.
  const toggleRoomCompleted = async (roomId: string) => {
    if (!project) return;
    const room = (project.rooms || []).find((r) => r.id === roomId);
    if (!room) return;
    const completing = !room.completedAt;
    const rooms = (project.rooms || []).map((r) =>
      r.id === roomId
        ? completing
          ? { ...r, completedAt: new Date().toISOString() }
          : { ...r, completedAt: undefined }
        : r,
    );
    await updateProjectLocally({ ...project, rooms });
    toast.show({
      message: completing ? nb.rooms.completedToast(room.name) : nb.rooms.reopenedToast(room.name),
      variant: completing ? 'success' : 'info',
    });
  };

  const addTextNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || !project) return;

    const newNote: Note = {
      id: newId(),
      text: trimmed,
      createdAt: new Date().toISOString(),
      ...(activeRoomId ? { roomId: activeRoomId } : {}),
    };

    const newNotes = [newNote, ...(project.notes || [])];
    await updateProjectNotes(newNotes);
    setNoteText('');
    toast.show({ message: nb.detail.noteSaved, variant: 'success' });
  };

  const deleteNote = async (noteId: string) => {
    if (!project) return;
    const newNotes = (project.notes || []).filter((n) => n.id !== noteId);
    await updateProjectNotes(newNotes);
  };

  // B15: sletting av notat krever bekreftelse — Alert beholdes for destruktive valg.
  const confirmDeleteNote = (noteId: string) => {
    if (Platform.OS === 'web') {
      // Alert.alert er no-op på web — bruk window.confirm i stedet.
      if (window.confirm(`${nb.detail.deleteNoteTitle}\n\n${nb.detail.deleteNoteMessage}`)) {
        deleteNote(noteId);
      }
      return;
    }

    Alert.alert(nb.detail.deleteNoteTitle, nb.detail.deleteNoteMessage, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.common.delete, style: 'destructive', onPress: () => deleteNote(noteId) },
    ]);
  };

  const startRecording = async () => {
    try {
      if (!project) {
        toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.show({ message: 'Mikrofontilgang kreves for å ta opp lyd.', variant: 'error' });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: started } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(started);
    } catch {
      console.error('Failed to start recording');
      toast.show({ message: 'Kunne ikke starte opptaket.', variant: 'error' });
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording || !project) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        toast.show({ message: 'Fant ingen lydfil.', variant: 'error' });
        return;
      }

      const durableUri = await persistMediaLocally(uri);

      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Lydnotat (ingen tekst ennå – transkriberes senere)';

      const newNote: Note = {
        id: newId(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        audioUri: durableUri,
        ...(activeRoomId ? { roomId: activeRoomId } : {}),
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
      toast.show({ message: nb.detail.audioSaved, variant: 'success' });
    } catch {
      console.error('Failed to stop recording');
      toast.show({ message: 'Kunne ikke stoppe opptaket.', variant: 'error' });
      setRecording(null);
    }
  };

  const handleRecordPress = async () => {
    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startDescriptionRecording = async () => {
    try {
      if (!project) {
        toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.show({ message: 'Mikrofontilgang kreves for å ta opp lyd.', variant: 'error' });
        return;
      }

      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: started } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setDescriptionRecording(started);
    } catch {
      console.error('Failed to start recording project description');
      toast.show({ message: 'Kunne ikke starte opptaket.', variant: 'error' });
    }
  };

  const stopDescriptionRecording = async () => {
    try {
      if (!descriptionRecording || !project) return;

      await descriptionRecording.stopAndUnloadAsync();
      const uri = descriptionRecording.getURI();
      setDescriptionRecording(null);

      if (!uri) {
        toast.show({ message: 'Fant ingen lydfil.', variant: 'error' });
        return;
      }

      const durableUri = await persistMediaLocally(uri);

      const updatedProject: Project = {
        ...project,
        projectDescriptionAudioUri: durableUri,
        projectDescriptionAudioRemoteId: undefined,
        projectDescriptionTranscription: undefined,
        projectDescriptionUpdatedAt: new Date().toISOString(),
      };

      await updateProjectLocally(updatedProject);
      toast.show({ message: 'Muntlig beskrivelse lagret', variant: 'success' });
    } catch {
      console.error('Failed to stop recording project description');
      toast.show({ message: 'Kunne ikke stoppe opptaket.', variant: 'error' });
      setDescriptionRecording(null);
    }
  };

  const handleDescriptionRecordPress = async () => {
    if (descriptionRecording) {
      await stopDescriptionRecording();
    } else {
      await startDescriptionRecording();
    }
  };

  const stopPlayback = useCallback(async () => {
    try {
      if (currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          await currentSound.stopAsync();
        }
        await currentSound.unloadAsync();
      }
    } catch {
      console.error('Failed to stop playback');
    } finally {
      setCurrentSound(null);
    }
  }, [currentSound]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const playAudio = async (uri?: string) => {
    if (!uri) return;

    try {
      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync({ uri });
      setCurrentSound(sound);
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync();
          setCurrentSound(null);
        }
      });
    } catch {
      console.error('Failed to play audio');
      toast.show({ message: 'Kunne ikke spille av opptaket.', variant: 'error' });
    }
  };

  // 429 fra serverens rate limiter: hent ventetiden fra svaret (kroppsfeltet
  // foretrekkes — Retry-After-headeren er ikke alltid CORS-lesbar) så meldingen
  // kan si «om X minutter» i stedet for generisk feil. null når svaret ikke er 429.
  const rateLimitWaitMinutes = async (response: Response): Promise<number | null> => {
    if (response.status !== 429) return null;
    let seconds = 15 * 60; // limiter-vinduet som fallback
    try {
      const body: any = await response.clone().json();
      const fromBody = Number(body?.retryAfterSeconds);
      if (Number.isFinite(fromBody) && fromBody > 0) seconds = fromBody;
    } catch {
      const fromHeader = Number(response.headers?.get?.('retry-after'));
      if (Number.isFinite(fromHeader) && fromHeader > 0) seconds = fromHeader;
    }
    return Math.max(1, Math.ceil(seconds / 60));
  };

  // Serverens /transcribe forstår to kontrakter: multipart-fil («file») eller
  // JSON { audioRemoteId }. Den gamle klientkoden sendte JSON { audioUri } —
  // en kontrakt serveren aldri har forstått, så kallet døde med 400 før
  // Gemini. Foretrekk den varige serverkopien (ingen re-opplasting, eierskap
  // verifiseres server-side); fall tilbake til å sende lydbytene som FormData.
  const requestTranscription = async (
    audioUri: string,
    audioRemoteId?: string,
  ): Promise<Response> => {
    if (audioRemoteId) {
      return apiFetch(`${getApiBaseUrl()}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioRemoteId }),
      });
    }

    const formData = new FormData();
    if (Platform.OS === 'web') {
      const blobResponse = await fetch(audioUri, { signal: AbortSignal.timeout(30_000) });
      if (!blobResponse.ok) {
        throw new Error(`Fikk ikke lest lydopptaket (HTTP ${blobResponse.status})`);
      }
      const blob = await blobResponse.blob();
      const ext = (blob.type.split('/')[1] || 'm4a').split(';')[0];
      formData.append('file', blob, `audio.${ext}`);
    } else {
      const extMatch = audioUri.split('?')[0].match(/\.([A-Za-z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'm4a';
      formData.append('file', { uri: audioUri, name: `audio.${ext}`, type: `audio/${ext}` } as any);
    }
    // Ikke sett Content-Type manuelt — multipart-boundary settes automatisk.
    return apiFetch(`${getApiBaseUrl()}/transcribe`, { method: 'POST', body: formData });
  };

  const transcribeNote = async (noteId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.audioUri) {
      toast.show({ message: 'Notatet har ingen lyd å transkribere.', variant: 'info' });
      return;
    }

    try {
      const response = await requestTranscription(note.audioUri, note.audioRemoteId);

      const waitMin = await rateLimitWaitMinutes(response);
      if (waitMin !== null) {
        toast.show({ message: nb.common.rateLimited(waitMin), variant: 'info' });
        return;
      }

      if (!response.ok) {
        console.error('Backend /transcribe error: non-OK response');
        toast.show({ message: nb.detail.transcriptionFailed, variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        toast.show({ message: 'Transkripsjonen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const newNotes = project.notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              transcription: textFromApi,
            }
          : n
      );

      await updateProjectNotes(newNotes);
      toast.show({ message: nb.detail.transcriptionReady, variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      toast.show({ message: 'Fikk ikke kontakt med serveren.', variant: 'error' });
    }
  };

  const deleteProjectDescriptionAudio = async () => {
    if (!project) return;

    const updatedProject: Project = {
      ...project,
      projectDescriptionAudioUri: undefined,
      projectDescriptionAudioRemoteId: undefined,
      projectDescriptionTranscription: undefined,
      projectDescriptionUpdatedAt: new Date().toISOString(),
    };

    await updateProjectLocally(updatedProject);
  };

  const transcribeProjectDescription = async () => {
    if (!project?.projectDescriptionAudioUri) {
      toast.show({ message: 'Ta opp en muntlig prosjektbeskrivelse først.', variant: 'info' });
      return;
    }

    try {
      setIsTranscribingDescription(true);
      const response = await requestTranscription(
        project.projectDescriptionAudioUri,
        project.projectDescriptionAudioRemoteId,
      );

      const waitMin = await rateLimitWaitMinutes(response);
      if (waitMin !== null) {
        toast.show({ message: nb.common.rateLimited(waitMin), variant: 'info' });
        return;
      }

      if (!response.ok) {
        console.error('Backend /transcribe error: non-OK response');
        toast.show({ message: nb.detail.transcriptionFailed, variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        toast.show({ message: 'Transkripsjonen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const updatedProject: Project = {
        ...project,
        projectDescriptionTranscription: textFromApi,
        projectDescriptionUpdatedAt: new Date().toISOString(),
      };

      await updateProjectLocally(updatedProject);
      toast.show({ message: nb.detail.transcriptionReady, variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      toast.show({ message: 'Fikk ikke kontakt med serveren.', variant: 'error' });
    } finally {
      setIsTranscribingDescription(false);
    }
  };

  const autoDescribePhoto = async (noteId: string, photoId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.photos) {
      toast.show({ message: 'Fant ikke bildet.', variant: 'error' });
      return;
    }

    const photo = note.photos.find((p) => p.id === photoId);
    if (!photo) {
      toast.show({ message: 'Fant ikke bildet.', variant: 'error' });
      return;
    }

    const photoKey = `${noteId}-${photoId}`;
    setDescribingPhotos((prev) => new Set(prev).add(photoKey));

    try {
      const formData = new FormData();
      const uriParts = photo.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      formData.append('file', {
        uri: photo.uri,
        name: `photo.${fileType}`,
        type: `image/${fileType}`,
      } as any);

      const response = await apiFetch(`${getApiBaseUrl()}/describe-image`, {
        method: 'POST',
        body: formData,
      });

      const waitMin = await rateLimitWaitMinutes(response);
      if (waitMin !== null) {
        toast.show({ message: nb.common.rateLimited(waitMin), variant: 'info' });
        return;
      }

      if (!response.ok) {
        console.error('Backend /describe-image error: non-OK response');
        toast.show({ message: 'Bildebeskrivelsen feilet.', variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const description: string | undefined = data.description;

      if (!description) {
        toast.show({ message: 'Beskrivelsen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const newNotes = project.notes.map((n) => {
        if (n.id === noteId && n.photos) {
          return {
            ...n,
            photos: n.photos.map((p) =>
              p.id === photoId
                ? { ...p, caption: description, aiGenerated: true }
                : p
            ),
          };
        }
        return n;
      });

      await updateProjectNotes(newNotes);
      toast.show({ message: 'Bildebeskrivelse lagt til', variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Auto-describe error');
      toast.show({ message: 'Bildebeskrivelsen feilet.', variant: 'error' });
    } finally {
      setDescribingPhotos((prev) => {
        const next = new Set(prev);
        next.delete(photoKey);
        return next;
      });
    }
  };

  const updatePhotoCaption = async (noteId: string, photoId: string, newCaption: string) => {
    if (!project) return;

    const newNotes = project.notes.map((n) => {
      if (n.id === noteId && n.photos) {
        return {
          ...n,
          photos: n.photos.map((p) =>
            p.id === photoId ? { ...p, caption: newCaption } : p
          ),
        };
      }
      return n;
    });

    await updateProjectNotes(newNotes);
  };

  // Pilotfunn (aug 2026): 8 MB avviste vanlige kamerabilder. 20 MB speiler
  // serverens multer-tak for /describe-image (AI-bildebeskrivelse) — media-
  // opplastingen tåler 200 MB. Bilder over taket nedskaleres, ikke avvises.
  const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
  // Pilotfunn: 12 kamerabilder tok 3,5+ min å laste opp. Bilder over denne
  // terskelen nedskaleres (web) til 2048px JPEG — rikelig for rapport og AI,
  // og originalen ligger uansett igjen på kamerarullen.
  const DOWNSCALE_TRIGGER_BYTES = 4 * 1024 * 1024; // 4 MB
  const MAX_VIDEO_DURATION_SECONDS = 120;   // 2 minutes

  const addPhotoNote = async () => {
    if (!project) {
      toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
      return;
    }

    // B9: start geo-innhenting med en gang — den løper mens brukeren er i
    // kameraet/bildevelgeren og blokkerer aldri lagringen (null ved avslag).
    const geoPromise = getCurrentGeo();

    const pickPhoto = async (fromLibrary: boolean) => {
      if (fromLibrary) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          toast.show({ message: 'Tilgang til bildebiblioteket kreves.', variant: 'error' });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          toast.show({ message: 'Kameratilgang kreves.', variant: 'error' });
          return;
        }
      }

      const result = fromLibrary
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            exif: false,
            // Pilotfunn (aug 2026): mange bilder må kunne velges i én
            // operasjon — ett og ett tar for lang tid i felt.
            allowsMultipleSelection: true,
            selectionLimit: 0,
            orderedSelection: true,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            exif: false,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      // Kamera-appens originaler er ofte over 8 MB. Native re-enkoder velgeren
      // via quality, men på web komprimeres ingenting — der skalerer vi ned
      // selv i stedet for å avvise. Bare bilder som fortsatt er for store
      // etter det hoppes over, med oppsummering til brukeren.
      const acceptedPhotos: { id: string; uri: string }[] = [];
      let skippedOversized = 0;
      for (const asset of result.assets) {
        let assetUri = asset.uri;
        const knownSize = asset.fileSize ?? (await measurePhotoBytesWeb(asset.uri));
        if (knownSize && knownSize > DOWNSCALE_TRIGGER_BYTES) {
          const downscaled = await downscalePhotoWeb(assetUri, MAX_PHOTO_BYTES);
          if (downscaled) {
            assetUri = downscaled;
          } else if (knownSize > MAX_PHOTO_BYTES) {
            // Nedskalering utilgjengelig (native) eller feilet: slipp gjennom
            // opp til taket, hopp bare over det som er over 20 MB.
            skippedOversized += 1;
            continue;
          }
        }
        const photoId = newId();
        if (Platform.OS === 'web') {
          // Persister bytene i IndexedDB så bildet overlever at appen lukkes
          // før opplastingen er ferdig (pilotfunn aug 2026). Fallback:
          // objectURL — fungerer i økten, som før.
          const idbUri = await persistPhotoBytesWeb(assetUri, photoId);
          if (idbUri) {
            assetUri = idbUri;
          } else if (assetUri.startsWith('data:')) {
            const blobUrl = await dataUrlToObjectUrlWeb(assetUri);
            if (blobUrl) assetUri = blobUrl;
          }
        }
        acceptedPhotos.push({ id: photoId, uri: await persistMediaLocally(assetUri) });
      }

      if (acceptedPhotos.length === 0) {
        if (skippedOversized > 0) {
          toast.show({
            message: `Bildet er over 20 MB og kunne ikke komprimeres. Velg et mindre bilde.`,
            variant: 'error',
            durationMs: 4200,
          });
        }
        return;
      }

      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Bildenotat (ingen tekst ennå)';
      const capturedAt = new Date().toISOString();

      const geo = await geoPromise;
      const newNote: Note = {
        id: newId(),
        text: textForNote,
        createdAt: capturedAt,
        ...(activeRoomId ? { roomId: activeRoomId } : {}),
        photos: acceptedPhotos.map(({ id, uri }) => ({
          id,
          uri,
          caption: '',
          aiGenerated: false,
          capturedAt,
          ...(geo ? { geo } : {}),
        })),
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
      if (skippedOversized > 0) {
        toast.show({
          message: `${acceptedPhotos.length} bilder lagt til – ${skippedOversized} hoppet over (over 20 MB).`,
          variant: 'info',
          durationMs: 4200,
        });
      } else if (acceptedPhotos.length > 1) {
        toast.show({ message: `${acceptedPhotos.length} bilder lagt til`, variant: 'success' });
      } else {
        toast.show({ message: nb.detail.photoAdded, variant: 'success' });
      }
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickPhoto(true);
      return;
    }

    // Valg-dialog beholdes som Alert (B18) — men på norsk.
    Alert.alert(nb.detail.mediaSourceTitle, 'Velg kilde', [
      { text: nb.detail.takePhoto, onPress: () => pickPhoto(false) },
      { text: nb.detail.chooseFromLibrary, onPress: () => pickPhoto(true) },
      { text: nb.common.cancel, style: 'cancel' },
    ]);
  };

  const addVideoNote = async () => {
    if (!project) {
      toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
      return;
    }

    // B9: samme mønster som foto — geo hentes parallelt med opptaket.
    const geoPromise = getCurrentGeo();

    const pickVideo = async (fromLibrary: boolean) => {
      try {
        if (fromLibrary) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            toast.show({ message: 'Tilgang til bildebiblioteket kreves.', variant: 'error' });
            return;
          }
        } else {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            toast.show({ message: 'Kameratilgang kreves.', variant: 'error' });
            return;
          }
        }

        setIsAddingVideo(true);

        const result = fromLibrary
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Videos,
              videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Videos,
              videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
            });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          // On iOS Safari the browser silently returns "canceled" when it can't
          // load a video (e.g. the file is too large or stored in iCloud and
          // the download fails). Give the user a hint so they know what happened.
          if (Platform.OS === 'web') {
            toast.show({
              message: 'Fikk ikke lastet videoen. Ligger den i iCloud, last den ned til enheten først, eller prøv et kortere klipp.',
              variant: 'error',
              durationMs: 5200,
            });
          }
          return;
        }

        const asset = result.assets[0];

        // Guard: check duration (expo-image-picker reports duration in ms on all platforms)
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000) {
          toast.show({
            message: 'Videoen er for lang. Velg et klipp under 2 minutter.',
            variant: 'error',
            durationMs: 4200,
          });
          return;
        }

        // Guard: check file size (must fit within server's 500 MB video cap)
        const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          const sizeMb = (asset.fileSize / 1024 / 1024).toFixed(0);
          toast.show({
            message: `Videoen er ${sizeMb} MB. Velg et klipp under 500 MB.`,
            variant: 'error',
            durationMs: 4200,
          });
          return;
        }

        // Generate the note ID before persisting so we can pass it to
        // persistMediaLocally — on web it uses the ID as the IndexedDB key.
        const noteId = newId();
        const uri = await persistMediaLocally(asset.uri, noteId);
        const trimmed = noteText.trim();
        const textForNote = trimmed || 'Videonotat (ingen tekst ennå)';

        const geo = await geoPromise;
        const newNote: Note = {
          id: noteId,
          text: textForNote,
          createdAt: new Date().toISOString(),
          videoUri: uri,
          videoCapturedAt: new Date().toISOString(),
          ...(geo ? { videoGeo: geo } : {}),
          ...(activeRoomId ? { roomId: activeRoomId } : {}),
        };

        const newNotes = [newNote, ...(project.notes || [])];
        await updateProjectNotes(newNotes);
        setNoteText('');
        toast.show({ message: nb.detail.videoAdded, variant: 'success' });
      } catch (error) {
        console.error('[addVideoNote] Unexpected error', error);
        toast.show({ message: 'Kunne ikke legge til videoen. Prøv igjen.', variant: 'error' });
      } finally {
        setIsAddingVideo(false);
      }
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickVideo(true);
      return;
    }

    // Valg-dialog beholdes som Alert (B18) — men på norsk.
    Alert.alert(nb.detail.videoSourceTitle, 'Velg kilde', [
      { text: nb.detail.recordVideo, onPress: () => pickVideo(false) },
      { text: nb.detail.chooseVideo, onPress: () => pickVideo(true) },
      { text: nb.common.cancel, style: 'cancel' },
    ]);
  };

  /**
   * Let the inspector pick a replacement video for a note whose upload stalled.
   * Only the videoUri is replaced — all other note content (text, photos, audio)
   * is left untouched.  The old URI's in-memory upload state is cleared so the
   * sync engine treats the new URI as a fresh upload.
   */
  const reSelectVideoForNote = async (noteId: string, oldVideoUri: string | undefined) => {
    if (!project) return;

    const pickReplacement = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required to pick videos.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const asset = result.assets[0];

        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000) {
          Alert.alert(
            'Video too long',
            `Please select a video shorter than ${MAX_VIDEO_DURATION_SECONDS} seconds (2 minutes).`,
          );
          return;
        }

        const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          Alert.alert(
            'Video too large',
            `This clip is ${(asset.fileSize / 1024 / 1024).toFixed(0)} MB. Please choose a clip under 500 MB.`,
          );
          return;
        }

        // Persist the new file under a fresh IDB key so the replacement gets a
        // URI that is distinct from the stalled upload's URI.  If the same key
        // were reused, uploadMedia() would find the old in-flight promise in
        // uploadsInFlight and join it instead of starting a fresh upload.
        const idbKey = `${noteId}-r${Date.now()}`;
        const newUri = await persistMediaLocally(asset.uri, idbKey);

        // Clear the old URI from the sync engine's deduplication / quarantine maps
        // so the next push treats the new URI as a fresh upload.
        clearVideoRetryState(oldVideoUri);

        // Replace only the video fields on the matching note.
        const newNotes = (project.notes || []).map((n) =>
          n.id === noteId
            ? { ...n, videoUri: newUri, videoRemoteId: undefined }
            : n,
        );
        await updateProjectNotes(newNotes);
      } catch (error) {
        console.error('[reSelectVideoForNote] Unexpected error', error);
        Alert.alert('Could not pick video', 'Something went wrong. Please try again.');
      }
    };

    // On web Alert.alert is a no-op — go straight to library picker.
    if (Platform.OS === 'web') {
      await pickReplacement();
      return;
    }

    Alert.alert('Replace video', 'Choose a replacement video', [
      { text: 'Choose from library', onPress: pickReplacement },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const downloadReport = async (format: 'pdf' | 'docx') => {
    const reportUrl = googleDocUrl || project?.reportUrl;
    if (!reportUrl || !projectId) return;

    try {
      const apiBase = getApiBaseUrl();
      const encodedDocUrl = encodeURIComponent(reportUrl);
      const downloadUrl = `${apiBase}/api/projects/${projectId}/download/${format}?doc_url=${encodedDocUrl}`;

      if (Platform.OS === 'web') {
        // apiFetch sends the x-tester-token header automatically
        const response = await apiFetch(downloadUrl);
        if (!response.ok) {
          toast.show({ message: 'Kunne ikke laste ned rapporten.', variant: 'error' });
          return;
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.show({ message: 'Kunne ikke laste ned rapporten.', variant: 'error' });
    }
  };

  const generateGoogleDocReport = async () => {
    if (!project) return;

    const t0 = Date.now();
    // Snapshot to avoid stale-closure bugs across async boundaries
    let snap = project;
    const reportAttemptId = newId();

    try {
      setIsGeneratingGoogleDoc(true);
      setGoogleDocUrl(null);
      // Test-project identity must exist server-side before the ledger derives
      // its authoritative classification from the tenant-scoped project row.
      if (snap.isTestProject) {
        snap = await pushProject(snap);
      }
      // Ny generering gir en ny rapportversjon — godkjenningen gjelder den
      // gamle og nullstilles. Feiler genereringen, gjenoppretter feilbanene
      // (...snap) både forrige rapport og stempelet dens.
      await updateProjectLocally({
        ...snap,
        reportStatus: 'processing',
        reportError: undefined,
        reportApproval: undefined,
        reportAttemptId,
        reportResetAt: null,
      });

      // A report can be based on any available inspection evidence. Include a
      // video when one has finished uploading, but never require one.
      const videoNote = (snap.notes || []).find(n => n.videoRemoteId);
      const videoFilename = videoNote?.videoRemoteId;

      // Build enriched project context
      const enrichedNotes = (snap.notes || [])
        .filter(n => n.text || n.transcription || (n.photos && n.photos.length > 0))
        .map(n => ({
          ...(n.text ? { text: n.text } : {}),
          ...(n.transcription ? { transcription: n.transcription } : {}),
          ...(n.roomId ? { roomId: n.roomId } : {}),
          photos: (n.photos || [])
            .filter(p => p.remoteId || p.uri)
            .map(p => ({
              uri: p.remoteId ?? p.uri,
              ...(p.caption ? { caption: p.caption } : {}),
            })),
        }));

      const projectContext = {
        name: snap.name,
        inspectionDate: snap.inspectionDate,
        inspector: snap.inspector,
        ...(snap.projectDescriptionText ? { projectDescriptionText: snap.projectDescriptionText } : {}),
        ...(snap.projectDescriptionTranscription ? { projectDescriptionTranscription: snap.projectDescriptionTranscription } : {}),
        // A1: rommene følger med så API-et kan sette romnavn på hvert notat.
        ...(snap.rooms && snap.rooms.length > 0 ? { rooms: snap.rooms } : {}),
        notes: enrichedNotes,
      };

      const response = await apiFetch(`${getApiBaseUrl()}/report/google-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_meta: reportMetaDraft,
          // project_id gir serveren nøkkel til hovedboken (report_generations)
          // og til én-kjøring-om-gangen-vakten.
          project_id: snap.id,
          report_attempt_id: reportAttemptId,
          is_test_project: Boolean(snap.isTestProject),
          ...(videoFilename ? { video_filename: videoFilename } : {}),
          project: projectContext,
        }),
      });

      if (response.status === 409) {
        // Serverens idempotens-vakt: en generering pågår allerede for dette
        // prosjektet (f.eks. en retry etter timeout, eller en annen enhet).
        // Ikke marker som feilet — den pågående kjøringen eier statusen.
        let code: string | undefined;
        try {
          code = (await response.json())?.code;
        } catch {
          // uparsbart svar behandles som generisk feil under
        }
        if (code === 'REPORT_IN_PROGRESS') {
          // Denne forespørselen startet ingen generering — gjenopprett forrige
          // status/feil OG godkjenningsstempelet som pre-fetch-wipen fjernet.
          // Uten dette ville et gyldig stempel synkes bort og drepe en aktiv
          // delingslenke via serverens lesetids-410-port.
          await updateProjectLocally({ ...snap });
          toast.show({ message: nb.report.alreadyInProgress, variant: 'info' });
          return;
        }
      }

      {
        // Rate limit: ingen generering startet — gjenopprett snapshotet
        // (inkl. godkjenningsstempelet) på samme måte som 409-grenen, så et
        // gyldig stempel ikke synkes bort og dreper en aktiv delingslenke.
        const waitMin = await rateLimitWaitMinutes(response);
        if (waitMin !== null) {
          await updateProjectLocally({ ...snap });
          toast.show({ message: nb.common.rateLimited(waitMin), variant: 'info' });
          return;
        }
      }

      if (!response.ok) {
        const errMsg = `${nb.report.failed} (HTTP ${response.status})`;
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({
          ...snap,
          reportStatus: 'failed',
          reportError: errMsg,
          reportAttemptId: undefined,
          reportResetAt: null,
        });
        toast.show({ message: nb.report.failed, variant: 'error' });
        return;
      }

      const data = await response.json();
      if (data.status === 'error') {
        const errMsg = data.message || 'AI-motoren returnerte en feil.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({
          ...snap,
          reportStatus: 'failed',
          reportError: errMsg,
          reportAttemptId: undefined,
          reportResetAt: null,
        });
        toast.show({ message: nb.report.failed, variant: 'error' });
        return;
      }
      if (data.url) {
        logAction('generate-google-doc', Date.now() - t0).catch(() => {});
        setGoogleDocUrl(data.url);
        // A5: motoren returnerer den strukturerte analysen sammen med URL-en.
        // Utkastet arkiveres uendret; final starter som kopi og redigeres.
        const draftContent = contentFromAnalysis(data.analysis);
        const draftAt = new Date().toISOString();
        // Proveniens: promptversjonen som produserte utkastet lagres med det,
        // så valideringsbatteriet og draft-vs-godkjent-diffen kan skåres per
        // promptgenerasjon.
        const promptVersion =
          typeof data.prompt_version === 'string' ? data.prompt_version : undefined;
        await updateProjectLocally({
          ...snap,
          reportUrl: data.url,
          reportStatus: 'ready',
          reportError: undefined,
          reportAttemptId: undefined,
          reportResetAt: null,
          // Ny rapport er et nytt AI-utkast — aldri arv forrige godkjenning.
          reportApproval: undefined,
          // Eksplisitt tom-markør når analysen mangler (aldri undefined):
          // finnes-vinner-flettingen ville ellers gjenopplivet FORRIGE
          // genererings utkast under den nye rapportens URL på andre enheter.
          reportDraft: {
            content: draftContent ?? {},
            at: draftAt,
            promptVersion,
          },
          reportFinal: {
            content: draftContent ? { ...draftContent } : {},
            at: draftAt,
            promptVersion,
          },
        });
        toast.show({ message: nb.report.ready, variant: 'success' });
      } else {
        const errMsg = 'Fikk ingen dokumentlenke fra AI-motoren.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({
          ...snap,
          reportStatus: 'failed',
          reportError: errMsg,
          reportAttemptId: undefined,
          reportResetAt: null,
        });
        toast.show({ message: nb.report.failed, variant: 'error' });
      }
    } catch (error) {
      logError(error, 'generate-google-doc').catch(() => {});
      if (await handleApiError(error)) {
        // 401 må ikke etterlate prosjektet i evig «Behandler …».
        await updateProjectLocally({
          ...snap,
          reportStatus: 'failed',
          reportError: nb.report.unauthorized,
          reportAttemptId: undefined,
          reportResetAt: null,
        });
        return;
      }
      // Brutt forbindelse betyr ikke at genereringen feilet — motoren kan
      // fortsatt jobbe, eller alt ble ferdig uten at svaret nådde frem. Spør
      // hovedboka (/report/status) før forsøket avskrives som feil.
      const status = await fetchReportStatus(snap.id, reportAttemptId);
      if (status) {
        const outcome = resolveStuckReport(snap, status);
        if (outcome.kind === 'stillRunning') {
          await updateProjectLocally({
            ...snap,
            reportStatus: 'processing',
            reportError: undefined,
            reportApproval: undefined,
            reportAttemptId,
            reportResetAt: null,
          });
          toast.show({ message: nb.report.stillRunning, variant: 'info' });
          return;
        }
        if (outcome.kind === 'recovered') {
          setGoogleDocUrl(outcome.project.reportUrl ?? null);
          await updateProjectLocally(outcome.project);
          toast.show({ message: nb.report.recovered, variant: 'success' });
          return;
        }
      }
      const errMsg = 'Fikk ikke kontakt med serveren.';
      await updateProjectLocally({
        ...snap,
        reportStatus: 'failed',
        reportError: errMsg,
        reportAttemptId: undefined,
        reportResetAt: null,
      });
      toast.show({ message: errMsg, variant: 'error' });
    } finally {
      setIsGeneratingGoogleDoc(false);
    }
  };

  const resetReport = async () => {
    if (!project || isResettingReport || isGeneratingGoogleDoc || !isTokenValid) return;

    try {
      setIsResettingReport(true);
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/projects/${encodeURIComponent(project.id)}/report/reset`,
        { method: 'POST' },
      );

      if (response.status === 409) {
        let code: string | undefined;
        try {
          code = (await response.json())?.code;
        } catch {
          // Keep the generic reset error when the response is not JSON.
        }
        if (code === 'REPORT_IN_PROGRESS') {
          toast.show({ message: nb.report.resetInProgress, variant: 'info' });
          return;
        }
      }

      if (!response.ok) {
        toast.show({ message: nb.report.resetFailed, variant: 'error' });
        return;
      }

      const data: any = await response.json();
      if (!data?.project || String(data.project.id) !== String(project.id)) {
        toast.show({ message: nb.report.resetFailed, variant: 'error' });
        return;
      }

      const resetProject = data.project as Project;
      if (metaSaveTimerRef.current) {
        clearTimeout(metaSaveTimerRef.current);
        metaSaveTimerRef.current = null;
      }
      projectRef.current = resetProject;
      setGoogleDocUrl(null);
      setShareInfo(null);
      setReportEdit(null);
      const nextProjects = await updateProjectInStorage(resetProject);
      setState({
        projects: nextProjects,
        project: { ...resetProject, id: String(resetProject.id) },
      });
      toast.show({ message: nb.report.resetSuccess, variant: 'success' });
    } catch (error) {
      logError(error, 'reset-report').catch(() => {});
      if (await handleApiError(error)) return;
      toast.show({ message: nb.report.resetFailed, variant: 'error' });
    } finally {
      setIsResettingReport(false);
    }
  };

  const confirmResetReport = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${nb.report.resetConfirmTitle}\n\n${nb.report.resetConfirmMessage}`)) {
        void resetReport();
      }
      return;
    }

    Alert.alert(nb.report.resetConfirmTitle, nb.report.resetConfirmMessage, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.report.reset, style: 'destructive', onPress: () => void resetReport() },
    ]);
  };

  // B7/B10: kontoløs delingslenke med PIN og utløp (Wenn-mønsteret, hardnet).
  // PIN-koden vises kun her — den legges aldri i delingsmeldingen (nb.share.hint).
  // Nedbør rundt skadedato (MET Frost via API-et) — vises kun når serveren har
  // nøkkel konfigurert og saken har både posisjon og skadedato.
  useEffect(() => {
    const cf = project?.caseFile;
    const damageDate = project?.reportMeta?.damageDate;
    if (!cf || !damageDate || !/^\d{4}-\d{2}-\d{2}$/.test(damageDate) || !isTokenValid) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/vaer?lat=${cf.lat}&lon=${cf.lon}&date=${damageDate}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && data.configured && typeof data.totalMm === 'number' && data.station) {
          setCaseWeather({ station: String(data.station), totalMm: data.totalMm });
        }
      } catch {
        // værdata er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.caseFile, project?.reportMeta?.damageDate, isTokenValid]);

  // Terrenghøyde (Kartverket) og værvarsel (MET) for adressepunktet.
  useEffect(() => {
    const cf = project?.caseFile;
    if (!cf || !isTokenValid) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/stedsinfo?lat=${cf.lat}&lon=${cf.lon}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && (data.hoyde || data.vaer)) {
          setCasePlace({
            moh: data.hoyde?.moh ?? null,
            terreng: data.hoyde?.terreng ?? null,
            tempC: data.vaer?.tempC ?? null,
            beskrivelse: data.vaer?.beskrivelse ?? null,
            nedborMm: data.vaer?.nedborNeste24tMm ?? null,
          });
        }
      } catch {
        // stedsinfo er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.caseFile, isTokenValid]);

  // Bygningsdata fra den åpne matrikkelen (Geonorge) — type, status og
  // kulturminne-flagg for nærmeste bygning til adressepunktet.
  useEffect(() => {
    const cf = project?.caseFile;
    if (!cf || !isTokenValid) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/bygg?lat=${cf.lat}&lon=${cf.lon}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && data.bygning) {
          setCaseBuilding({
            type: String(data.bygning.type),
            status: String(data.bygning.status),
            kulturminne: Boolean(data.bygning.kulturminne),
            bygningsnummer: data.bygning.bygningsnummer ? String(data.bygning.bygningsnummer) : null,
          });
          // Smart standardvalg: matrikkelens bygningstype inn i rapportfeltet
          // når det står tomt — aldri over noe takstpersonen selv har skrevet.
          const bygningstype = String(data.bygning.type || '').trim();
          const draft = reportMetaDraftRef.current;
          const building = draft.buildings?.[0] ?? {};
          if (bygningstype && !(building.type ?? '').trim()) {
            handleReportMetaChange({
              ...draft,
              buildings: [{ ...building, type: bygningstype }, ...(draft.buildings ?? [{}]).slice(1)],
            });
          }
        }
      } catch {
        // åpen-matrikkel-oppslaget er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  // handleReportMetaChange er stabil nok her; effekten skal kun kjøre på nytt
  // ved adresse-/tokenendring (samme mønster som de andre underlag-effektene).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.caseFile, isTokenValid]);

  // A5 — versjonslagring: reportDraft (AI-utkastet, uforanderlig) og
  // reportFinal (redigeres i ferdig rapportvisning). Lokal redigeringstilstand
  // synkes fra prosjektet og persisteres på blur; enhver endring etter
  // godkjenning nullstiller stempelet.
  const [reportEdit, setReportEdit] = useState<ReportContent | null>(null);
  useEffect(() => {
    setReportEdit(project?.reportFinal?.content ?? project?.reportDraft?.content ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.reportDraft?.at, project?.reportFinal?.at]);

  const reportFieldChanged = (field: ReportContentField): boolean => {
    const draft = project?.reportDraft?.content;
    if (!draft || !reportEdit) return false;
    return (reportEdit[field] ?? '').trim() !== (draft[field] ?? '').trim();
  };

  const saveReportEdits = async () => {
    if (!project || !reportEdit) return;
    const persisted = project.reportFinal?.content ?? project.reportDraft?.content ?? null;
    const dirty = REPORT_CONTENT_FIELDS.some(
      (f) => (persisted?.[f] ?? '') !== (reportEdit[f] ?? '')
    );
    if (!dirty) return;
    const hadApproval = Boolean(project.reportApproval);
    await updateProjectLocally({
      ...project,
      reportFinal: { content: { ...persisted, ...reportEdit }, at: new Date().toISOString() },
      // Stempelet gjelder den konkrete teksten som forelå ved godkjenning —
      // en rettelse etterpå krever ny gjennomlesing og nytt stempel.
      reportApproval: undefined,
    });
    if (hadApproval) {
      toast.show({ message: nb.report.editClearedApproval, variant: 'info', durationMs: 4500 });
    }
  };

  // Godkjenningsflyt: takstpersonen leser AI-utkastet og stempler det med navn
  // og tidspunkt. Uten stempel nekter både appen og serveren å dele rapporten.
  const stampApproval = async () => {
    if (!project) return;
    const profile = await loadProfile();
    const name =
      profile.name.trim() ||
      (project.inspector && project.inspector !== UNKNOWN_INSPECTOR ? project.inspector : '');
    if (!name) {
      toast.show({ message: nb.report.approverNameMissing, variant: 'error', durationMs: 4500 });
      return;
    }
    await updateProjectLocally({
      ...project,
      reportApproval: { approvedBy: name, approvedAt: new Date().toISOString() },
    });
    logAction('approve-report', 0).catch(() => {});
    toast.show({ message: nb.report.approvedToast, variant: 'success' });
  };

  const confirmApproveReport = () => {
    if (Platform.OS === 'web') {
      // Alert.alert er no-op på web — bruk window.confirm i stedet.
      if (window.confirm(`${nb.report.approveConfirmTitle}\n\n${nb.report.approveConfirmMessage}`)) {
        void stampApproval();
      }
      return;
    }
    Alert.alert(nb.report.approveConfirmTitle, nb.report.approveConfirmMessage, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.report.approve, onPress: () => void stampApproval() },
    ]);
  };

  const removeApproval = async () => {
    if (!project) return;
    await updateProjectLocally({ ...project, reportApproval: undefined });
    toast.show({ message: nb.report.withdrawnToast, variant: 'success' });
  };

  const confirmWithdrawApproval = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${nb.report.withdrawConfirmTitle}\n\n${nb.report.withdrawConfirmMessage}`)) {
        void removeApproval();
      }
      return;
    }
    Alert.alert(nb.report.withdrawConfirmTitle, nb.report.withdrawConfirmMessage, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.report.withdraw, style: 'destructive', onPress: () => void removeApproval() },
    ]);
  };

  const createShare = async () => {
    if (!project || isCreatingShare) return;
    if (!project.reportApproval) {
      toast.show({ message: nb.share.requiresApproval, variant: 'error', durationMs: 4500 });
      return;
    }
    try {
      setIsCreatingShare(true);
      const response = await apiFetch(`${getApiBaseUrl()}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!response.ok) {
        // 409: serveren har ikke fått synket godkjenningen ennå (eller den er
        // trukket tilbake fra en annen enhet) — si hvorfor, ikke bare «feilet».
        const message = response.status === 409 ? nb.share.requiresApproval : nb.share.failed;
        toast.show({ message, variant: 'error', durationMs: 4500 });
        return;
      }
      const data: any = await response.json();
      if (typeof data.path !== 'string' || typeof data.pin !== 'string') {
        toast.show({ message: nb.share.failed, variant: 'error' });
        return;
      }
      // Samme-origin-bygg (base '') må få absolutt lenke — mottakeren skal
      // kunne lime den inn hvor som helst.
      const linkBase =
        getApiBaseUrl() ||
        (Platform.OS === 'web' ? ((globalThis as any)?.location?.origin ?? '') : '');
      setShareInfo({
        url: `${linkBase}${data.path}`,
        pin: data.pin,
        expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
      });
      logAction('create-share', 0).catch(() => {});
    } catch (error) {
      logError(error, 'create-share').catch(() => {});
      if (await handleApiError(error)) return;
      toast.show({ message: nb.share.failed, variant: 'error' });
    } finally {
      setIsCreatingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareInfo) return;
    const clipboard = (globalThis as any)?.navigator?.clipboard;
    if (Platform.OS === 'web' && clipboard?.writeText) {
      try {
        await clipboard.writeText(shareInfo.url);
        toast.show({ message: nb.share.copied, variant: 'success' });
      } catch {
        toast.show({ message: nb.share.failed, variant: 'error' });
      }
      return;
    }
    try {
      await Share.share({ message: shareInfo.url });
    } catch {
      // brukeren avbrøt delingsarket — ikke en feil
    }
  };

  const handleApiError = async (error: unknown) => {
    if (error instanceof UnauthorizedError || (error as any)?.status === 401) {
      await handleUnauthorized();
      return true;
    }

    return false;
  };

  const renderTokenModal = () => (
    <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <GlassCard style={{ width: '100%', gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title>{nb.auth.accessTitle}</Title>
            <TouchableOpacity
              onPress={() => setShowTokenModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={nb.common.close}
            >
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
          <Body muted>{nb.auth.accessMessage}</Body>
          {tokenError && <Caption style={{ color: theme.colors.danger }}>{tokenError}</Caption>}
          <TextField
            value={tokenInput}
            onChangeText={(value) => {
              setTokenInput(value);
              setTokenError(null);
            }}
            placeholder={nb.auth.accessPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton onPress={saveToken} loading={isValidatingToken}>
            {nb.auth.accessSave}
          </PrimaryButton>
          <SecondaryButton onPress={handleRemoveToken} disabled={isValidatingToken}>
            Fjern kode
          </SecondaryButton>
        </GlassCard>
      </View>
    </Modal>
  );

  // B9/B11: diskret bevislinje — tid, posisjon og sjekksum når de finnes.
  // Rå hash vises aldri i sin helhet i appen; delingssiden viser den fullt ut.
  const renderEvidenceMeta = (capturedAt?: string, geo?: GeoPoint, sha256?: string) => {
    if (!capturedAt && !geo && !sha256) return null;
    const parts: string[] = [];
    if (capturedAt) parts.push(formatDateTime(capturedAt));
    if (geo) parts.push(`${geo.lat.toFixed(4)}°N ${geo.lng.toFixed(4)}°Ø`);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {parts.length > 0 && <Caption muted>{parts.join(' · ')}</Caption>}
        {sha256 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.accent} />
            <Caption muted>{`SHA-256 ${sha256.slice(0, 12)}…`}</Caption>
          </View>
        ) : null}
      </View>
    );
  };

  const renderNoteItem = ({ item, index }: { item: Note; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
      <GlassCard style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}>
        <Body>{item.text}</Body>
        <Caption muted>
          {[roomNameById(project, item.roomId), formatDateTime(item.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </Caption>

        {/* Video clip — show whenever local URI or remote copy exists */}
        {(item.videoUri || item.videoRemoteId) && (
          <View
            style={{
              marginTop: theme.spacing.xs,
              padding: theme.spacing.sm,
              backgroundColor: theme.colors.surfaceSecondary,
              borderRadius: theme.radii.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="videocam-outline" size={22} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Caption>Videoklipp vedlagt</Caption>
              {item.videoRemoteId
                ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.accent} />
                    <Caption muted>{nb.detail.uploaded}</Caption>
                  </View>
                )
                : (
                  <VideoUploadStatus
                    videoUri={item.videoUri}
                    onReselect={() => reSelectVideoForNote(item.id, item.videoUri)}
                  />
                )}
              {renderEvidenceMeta(item.videoCapturedAt, item.videoGeo, item.videoSha256)}
            </View>
          </View>
        )}

        {(item.photos?.length || 0) > 0 && (
          <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.sm }}>
            {item.photos?.map((photo) => {
              const photoKey = `${item.id}-${photo.id}`;
              const isDescribing = describingPhotos.has(photoKey);
              const editState = editingPhotos[photoKey];
              const isEditingCaption = editState?.editing ?? false;
              const editedCaption = editState?.caption ?? photo.caption;

              return (
                <View key={photo.id} style={{ gap: theme.spacing.xs }}>
                  <Image
                    source={{ uri: displayMediaUri(photo.uri, photo.remoteId) }}
                    style={{ width: 82, height: 82, borderRadius: theme.radii.sm }}
                  />
                  {renderEvidenceMeta(photo.capturedAt, photo.geo, photo.sha256)}

                  {isEditingCaption ? (
                    <>
                      <TextField
                        value={editedCaption}
                        onChangeText={(text) =>
                          setEditingPhotos(prev => ({
                            ...prev,
                            [photoKey]: { editing: true, caption: text }
                          }))
                        }
                        placeholder="Beskriv bildet …"
                        multiline
                        style={{ minHeight: 60 }}
                      />
                      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                        <SecondaryButton
                          onPress={async () => {
                            await updatePhotoCaption(item.id, photo.id, editedCaption);
                            setEditingPhotos(prev => {
                              const next = { ...prev };
                              delete next[photoKey];
                              return next;
                            });
                          }}
                          width={100}
                        >
                          {nb.common.save}
                        </SecondaryButton>
                        <SecondaryButton
                          onPress={() => {
                            setEditingPhotos(prev => {
                              const next = { ...prev };
                              delete next[photoKey];
                              return next;
                            });
                          }}
                          width={100}
                        >
                          {nb.common.cancel}
                        </SecondaryButton>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.xs }}>
                        <Body style={{ flex: 1 }}>
                          {photo.caption || 'Ingen beskrivelse ennå'}
                        </Body>
                        <SecondaryButton
                          onPress={() => {
                            setEditingPhotos(prev => ({
                              ...prev,
                              [photoKey]: { editing: true, caption: photo.caption }
                            }));
                          }}
                          width={100}
                        >
                          Rediger
                        </SecondaryButton>
                      </View>
                    </>
                  )}

                  <SecondaryButton
                    onPress={() => autoDescribePhoto(item.id, photo.id)}
                    loading={isDescribing}
                    width={180}
                  >
                    {isDescribing ? 'Beskriver …' : 'Beskriv automatisk'}
                  </SecondaryButton>
                </View>
              );
            })}
          </View>
        )}

        {(item.images?.length || 0) > 0 && (
          <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.xs }}>
            <Caption muted>{item.images?.length} {nb.projects.photosCount}</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {item.images?.map((uri, idx) => (
                <Image
                  key={`${uri}-${idx}`}
                  source={{ uri }}
                  style={{ width: 82, height: 82, borderRadius: theme.radii.sm }}
                />
              ))}
            </View>
          </View>
        )}

        {item.audioUri && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <SecondaryButton
              onPress={() => playAudio(displayMediaUri(item.audioUri, item.audioRemoteId))}
              width={120}
              icon={<Ionicons name="play" size={16} color={theme.colors.foreground} />}
            >
              {nb.detail.play}
            </SecondaryButton>
            <SecondaryButton
              onPress={stopPlayback}
              width={120}
              icon={<Ionicons name="stop" size={16} color={theme.colors.foreground} />}
            >
              {nb.detail.stop}
            </SecondaryButton>
            <SecondaryButton onPress={() => transcribeNote(item.id)} width={160}>
              Transkriber
            </SecondaryButton>
          </View>
        )}

        {item.transcription && (
          <View style={{ marginTop: theme.spacing.xs }}>
            <Caption muted>Transkripsjon</Caption>
            <Body>{item.transcription}</Body>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
          <SecondaryButton
            onPress={() => confirmDeleteNote(item.id)}
            width={120}
            icon={<Ionicons name="trash-outline" size={16} color={theme.colors.danger} />}
          >
            {nb.common.delete}
          </SecondaryButton>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderReport = () => {
    const displayUrl = googleDocUrl || project?.reportUrl;
    const reportFailed = project?.reportStatus === 'failed';
    const hasReportState = Boolean(
      project?.reportUrl ||
        project?.reportStatus ||
        project?.reportDraft ||
        project?.reportFinal ||
        project?.reportApproval ||
        project?.hasSuccessfulDocument,
    );
    const generateLabel = project?.isTestProject
      ? displayUrl
        ? nb.report.regenerateTest
        : nb.report.generateTest
      : nb.report.generate;

    return (
      <View style={{ gap: theme.spacing.md }}>
        {project?.isTestProject ? (
          <GlassCard style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="flask-outline" size={18} color={theme.colors.accent} />
              <Body style={{ color: theme.colors.accent, fontWeight: '700' }}>
                {nb.projects.testProject}
              </Body>
            </View>
            <Caption muted>{nb.report.testProjectHint}</Caption>
          </GlassCard>
        ) : null}
        {project?.hasSuccessfulDocument ? (
          <View
            accessibilityLabel={nb.projects.documentCreated}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radii.pill,
              backgroundColor: `${theme.colors.accent}1A`,
              borderWidth: 1,
              borderColor: theme.colors.accent,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.accent} />
            <Caption style={{ color: theme.colors.accent, fontWeight: '700' }}>
              {nb.projects.documentCreated}
            </Caption>
          </View>
        ) : null}
        {hasReportState ? (
          <SecondaryButton
            onPress={confirmResetReport}
            loading={isResettingReport}
            disabled={
              !isTokenValid ||
              isResettingReport ||
              isGeneratingGoogleDoc ||
              project?.reportStatus === 'processing'
            }
            icon={<Ionicons name="refresh-outline" size={17} color={theme.colors.foreground} />}
          >
            {isResettingReport ? nb.report.resetting : nb.report.reset}
          </SecondaryButton>
        ) : null}
        <PrimaryButton
          testID="generate-report"
          onPress={generateGoogleDocReport}
          loading={isGeneratingGoogleDoc}
          disabled={!isTokenValid || isGeneratingGoogleDoc}
          style={{ minHeight: 56 }}
        >
          {isGeneratingGoogleDoc ? nb.report.generating : generateLabel}
        </PrimaryButton>

        {!isTokenValid && (
          <Caption muted>Skriv inn en gyldig tilgangskode for å lage rapport.</Caption>
        )}

        {/* B20: feilet generering viser status-chip med «Prøv igjen» — feilteksten under. */}
        {reportFailed && !displayUrl && (
          <GlassCard style={{ gap: theme.spacing.xs }}>
            <StatusChip status="failed" onRetry={isTokenValid ? generateGoogleDocReport : undefined} />
            {project?.reportError ? (
              <Caption muted>{project.reportError}</Caption>
            ) : null}
          </GlassCard>
        )}

        {displayUrl && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.accent} />
              <Caption muted>{nb.report.ready}</Caption>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(displayUrl)}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, minHeight: 44 }}
            >
              <Ionicons name="open-outline" size={18} color={theme.colors.accent} />
              <Body style={{ color: theme.colors.accent, textDecorationLine: 'underline' }}>
                {nb.report.openReport}
              </Body>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('pdf')}
                disabled={isGeneratingGoogleDoc}
                icon={<Ionicons name="download-outline" size={16} color={theme.colors.foreground} />}
              >
                {nb.report.downloadPdf}
              </SecondaryButton>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('docx')}
                disabled={isGeneratingGoogleDoc}
                icon={<Ionicons name="download-outline" size={16} color={theme.colors.foreground} />}
              >
                {nb.report.downloadWord}
              </SecondaryButton>
            </View>
            {/* Ærlig merking til re-fletting finnes: dokumentfilen inneholder
                AI-utkastet slik det ble flettet inn — takstpersonens rettelser
                lever i reportFinal (delingslenken), ikke i Google-dokumentet.
                Vises kun når de to versjonene faktisk avviker. */}
            {project && changedFields(project).length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.muted} />
                <Caption muted style={{ flex: 1 }}>
                  {nb.report.downloadIsDraftWarning}
                </Caption>
              </View>
            )}
          </GlassCard>
        )}

        {/* A5: utkastet redigeres i ferdig rapportvisning (Befar-mønsteret).
            AI-utkastet arkiveres uendret; endrede felter merkes, og diffen
            lagres per sak. */}
        {reportEdit && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.accent} />
              <Title style={{ fontSize: 18 }}>{nb.report.editTitle}</Title>
            </View>
            {project?.reportDraft?.at ? (
              <Caption muted>
                {nb.report.draftVersionLine(formatDateTime(project.reportDraft.at))}
              </Caption>
            ) : null}
            <Caption muted>{nb.report.editHint}</Caption>
            {(
              [
                ['area', nb.report.fieldArea, false],
                ['source', nb.report.fieldSource, false],
                ['sourceCategory', 'Kildekategori', false],
                ['cause', nb.report.fieldCause, true],
                ['acuteOrGradual', 'Tidsforløp', false],
                ['description', nb.report.fieldDescription, true],
                ['extentDescription', nb.report.fieldExtent, true],
                ['repairsDescription', nb.report.fieldRepairs, true],
              ] as [ReportContentField, string, boolean][]
            ).map(([field, label, multiline]) => (
              <View key={field} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Caption muted>{label}</Caption>
                  {reportFieldChanged(field) && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 1,
                        borderRadius: 999,
                        backgroundColor: `${theme.colors.accent}22`,
                      }}
                    >
                      <Caption style={{ color: theme.colors.accent, fontWeight: '600' }}>
                        {nb.report.fieldChanged}
                      </Caption>
                    </View>
                  )}
                </View>
                <TextField
                  value={reportEdit[field] ?? ''}
                  onChangeText={(text) =>
                    setReportEdit((prev) => ({ ...(prev ?? {}), [field]: text }))
                  }
                  onBlur={() => void saveReportEdits()}
                  multiline={multiline}
                  style={multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
                />
              </View>
            ))}
            <Caption muted>
              {nb.report.changesSummary(REPORT_CONTENT_FIELDS.filter(reportFieldChanged).length)}
            </Caption>
          </GlassCard>
        )}

        {/* Godkjenningsflyt: AI-en foreslår, takstpersonen står ansvarlig.
            Rapporten er et utkast til den aktivt stemples — og uten stempel
            nekter både appen og serveren å dele den. */}
        {displayUrl && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            {project?.reportApproval ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  {/* Kobber: identitetens signaturdetalj — kun stempel og nøkkeltall. */}
                  <Ionicons name="shield-checkmark" size={18} color={theme.colors.copper} />
                  <Body style={{ fontWeight: '600', flex: 1 }}>
                    {nb.report.approvedStamp(
                      project.reportApproval.approvedBy,
                      formatDateTime(project.reportApproval.approvedAt)
                    )}
                  </Body>
                </View>
                {(() => {
                  const minutes = minutesToApproved(project);
                  return minutes !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="timer-outline" size={13} color={theme.colors.copper} />
                      <Caption style={{ color: theme.colors.copper, fontWeight: '600' }}>
                        {nb.projects.timeToApproved(formatMinutes(minutes))}
                      </Caption>
                    </View>
                  ) : null;
                })()}
                <SecondaryButton onPress={confirmWithdrawApproval}>
                  {nb.report.withdraw}
                </SecondaryButton>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
                  <Body style={{ fontWeight: '600' }}>{nb.report.draftBadge}</Body>
                </View>
                <Caption muted>{nb.report.approvalHint}</Caption>
                <PrimaryButton style={{ minHeight: 56 }} onPress={confirmApproveReport}>
                  {nb.report.approve}
                </PrimaryButton>
              </>
            )}
          </GlassCard>
        )}

        {/* B7/B10: kontoløs deling med PIN + utløp */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Ionicons name="share-outline" size={18} color={theme.colors.accent} />
            <Title style={{ fontSize: 18 }}>{nb.share.title}</Title>
          </View>
          <Caption muted>{nb.share.hint}</Caption>

          {shareInfo ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Caption muted>{nb.share.linkLabel}</Caption>
                <Body selectable style={{ color: theme.colors.accent }}>{shareInfo.url}</Body>
              </View>
              <View style={{ gap: 2 }}>
                <Caption muted>{nb.share.pinLabel}</Caption>
                <Title
                  selectable
                  style={{
                    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
                    letterSpacing: 6,
                  }}
                >
                  {shareInfo.pin}
                </Title>
              </View>
              {shareInfo.expiresAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="lock-closed-outline" size={13} color={theme.colors.muted} />
                  <Caption muted>{`${nb.share.statusPrefix} ${formatDate(shareInfo.expiresAt)}`}</Caption>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton
                  style={{ flex: 1 }}
                  onPress={copyShareLink}
                  icon={<Ionicons name="copy-outline" size={16} color={theme.colors.foreground} />}
                >
                  {Platform.OS === 'web' ? nb.share.copyLink : nb.share.shareVia}
                </SecondaryButton>
              </View>
            </View>
          ) : (
            <PrimaryButton
              style={{ minHeight: 56 }}
              onPress={createShare}
              loading={isCreatingShare}
              disabled={!isTokenValid || isCreatingShare || !project?.reportApproval}
              icon={<Ionicons name="share-outline" size={18} color="#fff" />}
            >
              {isCreatingShare ? nb.share.creating : nb.share.create}
            </PrimaryButton>
          )}
          {!isTokenValid && <Caption muted>{nb.share.requiresToken}</Caption>}
          {isTokenValid && !shareInfo && !project?.reportApproval && (
            <Caption muted>{nb.share.requiresApproval}</Caption>
          )}
        </GlassCard>
      </View>
    );
  };

  const renderProjectDescription = () => (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 18 }}>{nb.detail.description}</Title>
        {!isEditingDescription && (
          <SecondaryButton onPress={() => setIsEditingDescription(true)} width={140}>
            Rediger tekst
          </SecondaryButton>
        )}
      </View>

      <Caption muted>Gi litt kontekst om prosjektet, så rapporten fokuserer på det viktigste.</Caption>

      {isEditingDescription ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            multiline
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            placeholder={nb.detail.descriptionPlaceholder}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <PrimaryButton onPress={saveProjectDescriptionText} width={120}>
              {nb.common.save}
            </PrimaryButton>
            <SecondaryButton onPress={cancelProjectDescriptionEdit} width={120}>
              {nb.common.cancel}
            </SecondaryButton>
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <GlassCard style={{ backgroundColor: theme.colors.glassOverlay, borderColor: theme.colors.border }}>
            <Body muted={!project?.projectDescriptionText}>
              {project?.projectDescriptionText || 'Ingen prosjektbeskrivelse ennå.'}
            </Body>
          </GlassCard>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <SecondaryButton onPress={() => setIsEditingDescription(true)} width={140}>
              Rediger tekst
            </SecondaryButton>
            <SecondaryButton
              onPress={handleDescriptionRecordPress}
              width={180}
              icon={
                <Ionicons
                  name={descriptionRecording ? 'stop-circle-outline' : 'mic-outline'}
                  size={16}
                  color={descriptionRecording ? theme.colors.danger : theme.colors.foreground}
                />
              }
            >
              {descriptionRecording ? nb.detail.stopRecording : 'Les inn beskrivelse'}
            </SecondaryButton>
          </View>
        </View>
      )}

      <View style={{ gap: theme.spacing.xs }}>
        <Caption muted>Muntlig beskrivelse</Caption>
        {project?.projectDescriptionAudioUri ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <SecondaryButton
                onPress={() => playAudio(displayMediaUri(project.projectDescriptionAudioUri, project.projectDescriptionAudioRemoteId))}
                width={120}
                icon={<Ionicons name="play" size={16} color={theme.colors.foreground} />}
              >
                {nb.detail.play}
              </SecondaryButton>
              <SecondaryButton
                onPress={stopPlayback}
                width={120}
                icon={<Ionicons name="stop" size={16} color={theme.colors.foreground} />}
              >
                {nb.detail.stop}
              </SecondaryButton>
              <SecondaryButton onPress={handleDescriptionRecordPress} width={160}>
                {descriptionRecording ? nb.detail.stopRecording : 'Ta opp på nytt'}
              </SecondaryButton>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {!project.projectDescriptionTranscription && (
                <SecondaryButton
                  onPress={transcribeProjectDescription}
                  loading={isTranscribingDescription}
                  width={160}
                >
                  Transkriber
                </SecondaryButton>
              )}
              <SecondaryButton
                onPress={deleteProjectDescriptionAudio}
                width={160}
                icon={<Ionicons name="trash-outline" size={16} color={theme.colors.danger} />}
              >
                Slett lydopptak
              </SecondaryButton>
            </View>
          </View>
        ) : (
          <Caption muted>Ingen muntlig beskrivelse ennå.</Caption>
        )}

        {project?.projectDescriptionTranscription && (
          <View style={{ gap: theme.spacing.xs }}>
            <Caption muted>Transkripsjon</Caption>
            <Body>{project.projectDescriptionTranscription}</Body>
          </View>
        )}
      </View>
    </GlassCard>
  );

  // Saksunderlaget fra adressevalget: kartutsnitt (Kartverket WMTS), matrikkel-
  // referanse og eventuell nedbørshistorikk rundt skadedato.
  const renderUnderlagCard = () => {
    const cf = project?.caseFile;
    if (!cf) return null;
    const pin = tileForCoordinate(cf.lat, cf.lon);
    const MAP = 216;
    return (
      <GlassCard style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="map-outline" size={18} color={theme.colors.accent} />
          <Title style={{ fontSize: 18 }}>{nb.underlag.title}</Title>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <View
            style={{
              width: MAP,
              height: MAP,
              borderRadius: theme.radii.md,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <ExpoImage
              source={{ uri: pin.url }}
              style={{ width: MAP, height: MAP }}
              contentFit="cover"
              accessibilityLabel={nb.underlag.mapAlt}
            />
            <View
              style={{
                position: 'absolute',
                left: pin.fx * MAP - 7,
                top: pin.fy * MAP - 7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.colors.accent,
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 180, gap: 6 }}>
            <Body style={{ fontWeight: '600' }}>
              {cf.addressText}
              {cf.postPlace ? `, ${cf.postPlace}` : ''}
            </Body>
            {cf.municipality ? (
              <Caption muted>{`${nb.underlag.municipality}: ${cf.municipality}`}</Caption>
            ) : null}
            {cf.gnr != null ? (
              <Caption muted>{`${nb.underlag.cadastre}: ${cf.gnr}/${cf.bnr}`}</Caption>
            ) : null}
            <Caption muted>{`${nb.underlag.coordinates}: ${cf.lat.toFixed(5)}°N ${cf.lon.toFixed(5)}°Ø`}</Caption>
            {caseBuilding ? (
              <Caption muted>
                {`${nb.underlag.buildingType}: ${caseBuilding.type} · ${caseBuilding.status}`}
              </Caption>
            ) : null}
            {caseBuilding?.kulturminne ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="ribbon-outline" size={13} color={theme.colors.accent} />
                <Caption style={{ color: theme.colors.accent }}>{nb.underlag.heritage}</Caption>
              </View>
            ) : null}
            {casePlace?.moh != null ? (
              <Caption muted>
                {`${nb.underlag.elevation}: ${casePlace.moh} ${nb.underlag.metersAboveSea}${casePlace.terreng ? ` · ${casePlace.terreng.toLowerCase()}` : ''}`}
              </Caption>
            ) : null}
            {casePlace?.tempC != null || casePlace?.beskrivelse ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="rainy-outline" size={13} color={theme.colors.muted} />
                <Caption muted>
                  {`${nb.underlag.weather24}: ${[
                    casePlace.tempC != null ? `${casePlace.tempC}°` : null,
                    casePlace.beskrivelse,
                    casePlace.nedborMm != null && casePlace.nedborMm > 0 ? `${String(casePlace.nedborMm).replace('.', ',')} mm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}`}
                </Caption>
              </View>
            ) : null}
            {caseWeather ? (
              <Caption muted>
                {`${nb.underlag.rainAroundDamage}: ${caseWeather.totalMm} mm (${nb.underlag.rainStation} ${caseWeather.station})`}
              </Caption>
            ) : null}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://www.norgeskart.no/#!?sok=${encodeURIComponent(cf.addressText)}`)}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
            >
              <Ionicons name="open-outline" size={14} color={theme.colors.accent} />
              <Caption style={{ color: theme.colors.accent }}>{nb.underlag.openMap}</Caption>
            </TouchableOpacity>
            <Caption muted>{nb.underlag.sourceLine}</Caption>
          </View>
        </View>

        {/* «Se mer»: dyplenker til alt vannskade-relevant offentlig innsyn */}
        <TouchableOpacity
          onPress={() => setShowMoreUnderlag((v) => !v)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}
        >
          <Ionicons
            name={showMoreUnderlag ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color={theme.colors.accent}
          />
          <Body style={{ color: theme.colors.accent, fontWeight: '600' }}>
            {showMoreUnderlag ? nb.underlag.seeLess : nb.underlag.seeMore}
          </Body>
        </TouchableOpacity>
        {showMoreUnderlag && (
          <View style={{ gap: 2 }}>
            {[
              cf.municipalityNumber && cf.gnr != null && cf.bnr != null
                ? {
                    icon: 'home-outline' as const,
                    label: nb.underlag.linkSeeiendom,
                    sub: nb.underlag.linkSeeiendomSub,
                    url: `https://seeiendom.kartverket.no/eiendom/${cf.municipalityNumber}/${cf.gnr}/${cf.bnr}/0/0`,
                  }
                : null,
              {
                icon: 'layers-outline' as const,
                label: nb.underlag.linkPlan,
                sub: nb.underlag.linkPlanSub,
                url: 'https://arealplaner.no/',
              },
              {
                icon: 'water-outline' as const,
                label: nb.underlag.linkNve,
                sub: nb.underlag.linkNveSub,
                url: 'https://temakart.nve.no/tema/flomaktsomhet',
              },
              {
                icon: 'earth-outline' as const,
                label: nb.underlag.linkNgu,
                sub: nb.underlag.linkNguSub,
                url: 'https://geo.ngu.no/kart/losmasse_mobil/',
              },
              {
                icon: 'thermometer-outline' as const,
                label: nb.underlag.linkSeklima,
                sub: nb.underlag.linkSeklimaSub,
                url: 'https://seklima.met.no/observations/',
              },
              {
                icon: 'camera-outline' as const,
                label: nb.underlag.linkFlyfoto,
                sub: nb.underlag.linkFlyfotoSub,
                url: 'https://norgeibilder.no/',
              },
              {
                icon: 'folder-open-outline' as const,
                label: nb.underlag.linkBoligmappa,
                sub: nb.underlag.linkBoligmappaSub,
                url: 'https://www.boligmappa.no/',
              },
            ]
              .filter((link): link is NonNullable<typeof link> => link !== null)
              .map((link) => (
                <TouchableOpacity
                  key={link.url}
                  onPress={() => Linking.openURL(link.url)}
                  accessibilityRole="link"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: 8,
                    minHeight: 44,
                  }}
                >
                  <Ionicons name={link.icon} size={17} color={theme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '600' }}>{link.label}</Body>
                    <Caption muted>{link.sub}</Caption>
                  </View>
                  <Ionicons name="open-outline" size={14} color={theme.colors.muted} />
                </TouchableOpacity>
              ))}
            <Caption muted style={{ marginTop: 4 }}>{nb.underlag.municipalHint}</Caption>
          </View>
        )}
      </GlassCard>
    );
  };

  const renderInfoCard = () => {
    const rawDate = project?.inspectionDate;
    const dateText =
      rawDate && rawDate !== NO_DATE_SET ? formatDate(rawDate) || rawDate : nb.projects.dateNotSet;
    const inspectorText =
      project?.inspector && project.inspector !== UNKNOWN_INSPECTOR
        ? project.inspector
        : nb.projects.unknownInspector;
    return (
      <GlassCard style={{ gap: theme.spacing.xs }}>
        <Body muted>Befaringsdato: {dateText}</Body>
        <Body muted>{nb.projects.inspectorLabel}: {inspectorText}</Body>
      </GlassCard>
    );
  };

  // B16: fast topprad (scroller ikke) — synk-status + tilgangskode.
  // Prosjektnavnet vises i navigasjonsheaderen (Stack.Screen), ikke her —
  // ellers står tittelen dobbelt og trunkeres ved siden av synk-pillen.
  // Saksunderlaget i «basics»: én kompakt linje som alltid er synlig øverst —
  // essensen av underlaget uten å flytte fangst-knappene (B13).
  const renderUnderlagStrip = () => {
    const cf = project?.caseFile;
    if (!cf) return null;
    const bits = [
      cf.municipality || null,
      cf.gnr != null && cf.bnr != null ? `gnr/bnr ${cf.gnr}/${cf.bnr}` : null,
      caseBuilding ? caseBuilding.type : null,
      casePlace?.moh != null ? `${casePlace.moh} moh.` : null,
      casePlace?.tempC != null
        ? `${casePlace.tempC}°${casePlace.beskrivelse ? ` ${casePlace.beskrivelse}` : ''}`
        : null,
    ].filter(Boolean);
    if (bits.length === 0) return null;
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
          paddingHorizontal: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceSecondary,
          borderRadius: theme.radii.pill,
        }}
      >
        <Ionicons name="map-outline" size={13} color={theme.colors.accent} />
        <Caption muted numberOfLines={1} style={{ flex: 1 }}>
          {bits.join(' · ')}
        </Caption>
      </View>
    );
  };

  // Saksfremdrift i sober form (goal gradient): fire faste steg mot godkjent
  // rapport. «Sak» teller fra opprettelsen — brukeren starter aldri på null.
  // Ingen prosenter, ingen spill: en statuslinje for en fagperson.
  const renderCaseProgress = () => {
    if (!project) return null;
    const hasEvidence =
      (project.notes ?? []).some(
        (n) =>
          (n.text ?? '').trim() ||
          (n.transcription ?? '').trim() ||
          (n.photos ?? []).length > 0 ||
          n.videoUri ||
          n.videoRemoteId ||
          n.audioUri ||
          n.audioRemoteId,
      ) || (project.rooms ?? []).some((r) => r.completedAt);
    const steps: { label: string; done: boolean }[] = [
      { label: nb.caseProgress.sak, done: true },
      { label: nb.caseProgress.befaring, done: hasEvidence },
      {
        label: nb.caseProgress.rapport,
        done: Boolean(project.reportUrl) || project.reportStatus === 'ready',
      },
      { label: nb.caseProgress.godkjent, done: Boolean(project.reportApproval) },
    ];
    const doneCount = steps.filter((s) => s.done).length;
    return (
      <View
        accessibilityLabel={nb.caseProgress.a11y(doneCount, steps.length)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        {steps.map((step, i) => (
          <View key={step.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 4,
                borderBottomWidth: 2,
                borderBottomColor: step.done ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Ionicons
                name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={12}
                color={step.done ? theme.colors.accent : theme.colors.muted}
              />
              <Caption
                muted={!step.done}
                style={step.done ? { color: theme.colors.accent, fontWeight: '600' } : undefined}
              >
                {step.label}
              </Caption>
            </View>
            {i < steps.length - 1 && (
              <Ionicons name="chevron-forward" size={10} color={theme.colors.muted} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderTopBar = () => (
    <View style={{ gap: theme.spacing.sm }}>
      {project?.isTestProject ? (
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radii.pill,
            backgroundColor: `${theme.colors.accent}1A`,
          }}
        >
          <Ionicons name="flask-outline" size={14} color={theme.colors.accent} />
          <Caption style={{ color: theme.colors.accent, fontWeight: '700' }}>
            {nb.projects.testProject}
          </Caption>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
        <SyncStatusIndicator />
        <IconButton onPress={() => setShowTokenModal(true)} accessibilityLabel={nb.auth.accessTitle}>
          <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
        </IconButton>
      </View>
      {renderUnderlagStrip()}
      {renderCaseProgress()}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <SecondaryButton
          style={{ flex: 1, borderColor: activeTab === 'notes' ? theme.colors.accent : theme.colors.border }}
          onPress={() => setActiveTab('notes')}
        >
          {nb.detail.notesTab}
        </SecondaryButton>
        <SecondaryButton
          style={{ flex: 1, borderColor: activeTab === 'report' ? theme.colors.accent : theme.colors.border }}
          onPress={() => setActiveTab('report')}
        >
          {nb.detail.reportTab}
        </SecondaryButton>
      </View>
    </View>
  );

  // B13: tre store fangst-knapper i full bredde — alltid synlige uten scrolling.
  const renderCaptureButtons = () => (
    <View style={{ gap: theme.spacing.sm }}>
      <SecondaryButton
        onPress={handleRecordPress}
        style={{
          minHeight: 56,
          borderColor: recording ? theme.colors.danger : theme.colors.border,
          borderWidth: recording ? 2 : 1,
        }}
        icon={
          <Ionicons
            name={recording ? 'stop-circle-outline' : 'mic-outline'}
            size={22}
            color={recording ? theme.colors.danger : theme.colors.foreground}
          />
        }
      >
        {recording ? nb.detail.stopRecording : nb.detail.audioNote}
      </SecondaryButton>
      <SecondaryButton
        onPress={addPhotoNote}
        style={{ minHeight: 56 }}
        icon={<Ionicons name="camera-outline" size={22} color={theme.colors.foreground} />}
      >
        {nb.detail.photo}
      </SecondaryButton>
      <SecondaryButton
        onPress={addVideoNote}
        disabled={isAddingVideo}
        style={{ minHeight: 56 }}
        icon={<Ionicons name="videocam-outline" size={22} color={theme.colors.foreground} />}
      >
        {isAddingVideo ? nb.detail.loadingVideo : nb.detail.video}
      </SecondaryButton>
    </View>
  );

  const renderTextNoteCard = () => (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <TextField
        multiline
        value={noteText}
        onChangeText={setNoteText}
        placeholder={nb.detail.notePlaceholder}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <PrimaryButton onPress={addTextNote} style={{ minHeight: 56 }}>
        {nb.detail.saveNote}
      </PrimaryButton>
    </GlassCard>
  );

  // A1: romstripen — «Alle» + rommene + «+ Rom», med hurtigvalg fra
  // taksonomien. Aktivt rom er fangstkontekst og filter samtidig.
  const renderRoomStrip = () => {
    const rooms = project?.rooms || [];
    const chip = (label: string, selected: boolean, onPress: () => void, key: string) => (
      <TouchableOpacity
        key={key}
        onPress={onPress}
        accessibilityRole="button"
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          minHeight: 36,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? `${theme.colors.accent}1A` : theme.colors.surfaceSecondary,
        }}
      >
        <Caption style={{ color: selected ? theme.colors.accent : theme.colors.muted, fontWeight: '600' }}>
          {label}
        </Caption>
      </TouchableOpacity>
    );

    const completedCount = rooms.filter((r) => r.completedAt).length;
    const activeRoom = activeRoomId ? rooms.find((r) => r.id === activeRoomId) : null;

    return (
      <View style={{ gap: theme.spacing.xs }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {chip(nb.rooms.all, activeRoomId === null, () => setActiveRoomId(null), 'all')}
          {rooms.map((room) =>
            chip(
              room.completedAt ? `✓ ${room.name}` : room.name,
              activeRoomId === room.id,
              () => setActiveRoomId(room.id),
              room.id,
            )
          )}
          {chip(nb.rooms.add, false, () => setAddingRoom((v) => !v), 'add')}
        </ScrollView>
        {rooms.length > 0 && (
          <Caption muted>{nb.rooms.completedProgress(completedCount, rooms.length)}</Caption>
        )}
        {activeRoom && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Caption muted style={{ flex: 1 }}>{nb.rooms.capturingIn(activeRoom.name)}</Caption>
            <SecondaryButton onPress={() => void toggleRoomCompleted(activeRoom.id)}>
              {activeRoom.completedAt ? nb.rooms.reopenRoom : nb.rooms.completeRoom}
            </SecondaryButton>
          </View>
        )}
        {addingRoom && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Caption muted>{nb.rooms.addTitle}</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ROOM_SUGGESTIONS.filter(
                (name) => !rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())
              ).map((name) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => void addRoom(name)}
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: theme.radii.pill,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <Caption style={{ color: theme.colors.foreground }}>{name}</Caption>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                  placeholder={nb.rooms.placeholder}
                  onSubmitEditing={() => void addRoom(newRoomName)}
                />
              </View>
              <SecondaryButton onPress={() => void addRoom(newRoomName)}>
                {nb.rooms.confirm}
              </SecondaryButton>
            </View>
          </GlassCard>
        )}
      </View>
    );
  };

  // A1: adaptiv huskeliste (Befar-mønsteret generalisert) — vises for alle
  // romkategorier med egen liste. Statisk påminnelse, ingen falske «✓».
  const renderRoomChecklist = () => {
    const activeName = roomNameById(project, activeRoomId ?? undefined);
    if (!activeName) return null;
    const checklist = checklistForRoom(activeName);
    if (!checklist) return null;
    const isWet = checklist.title === nb.rooms.wetChecklistTitle;
    return (
      <GlassCard style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons
            name={isWet ? 'water-outline' : 'checkmark-done-outline'}
            size={16}
            color={theme.colors.accent}
          />
          <Title style={{ fontSize: 15 }}>{checklist.title}</Title>
        </View>
        <Caption muted>{isWet ? nb.rooms.wetChecklistHint : nb.rooms.checklistHint}</Caption>
        {checklist.items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
            <Caption style={{ color: theme.colors.accent }}>—</Caption>
            <Caption muted style={{ flex: 1 }}>{item}</Caption>
          </View>
        ))}
      </GlassCard>
    );
  };

  const renderNotesTab = () => {
    const allNotes = project?.notes || [];
    const noteData = activeRoomId
      ? allNotes.filter((n) => n.roomId === activeRoomId)
      : allNotes;

    return (
      <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
        {/* B13: fangst-knappene ligger fast øverst, utenfor scrollingen. */}
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          {renderRoomStrip()}
          {renderCaptureButtons()}
        </View>

        <View style={{ flex: 1, marginTop: theme.spacing.md }}>
          <FlatList
            data={loading ? [] : noteData}
            keyExtractor={(item) => item.id}
            renderItem={renderNoteItem}
            ListHeaderComponent={
              <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                {renderRoomChecklist()}
                {renderUnderlagCard()}
                {renderInfoCard()}
                {renderProjectDescription()}
                {renderTextNoteCard()}
                {loading && <Caption muted>{nb.common.loadingEllipsis}</Caption>}
              </View>
            }
            ListEmptyComponent={
              !loading ? <Caption muted>Ingen notater ennå. Legg til din første observasjon.</Caption> : null
            }
            contentContainerStyle={{ paddingBottom: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Animated.View>
    );
  };

  const renderReportTab = () => (
    <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, marginTop: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {renderInfoCard()}
        <ReportDetailsSection
          meta={reportMetaDraft}
          onChange={handleReportMetaChange}
          isOpen={reportMetaOpen}
          onToggle={() => setReportMetaOpen((o) => !o)}
          saveStatus={metaSaveStatus}
          saveError={saveMetaError}
        />
        {renderReport()}
      </ScrollView>
    </Animated.View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <Screen>
          <Caption muted>{nb.common.loadingEllipsis}</Caption>
        </Screen>
      );
    }

    if (!project) {
      return (
        <Screen>
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title muted>Fant ikke prosjektet</Title>
            <Body muted>Vi fant ikke prosjektet. Det kan være slettet.</Body>
            <PrimaryButton onPress={() => router.back()}>{nb.common.back}</PrimaryButton>
          </GlassCard>
        </Screen>
      );
    }

    // Fast topprad (B16) og fast bunn-CTA (B13) — bare innholdet i midten scroller.
    return (
      <Screen scrollable={false} style={{ flex: 1 }}>
        {renderTokenModal()}
        {renderTopBar()}

        <View style={{ flex: 1 }}>
          {activeTab === 'notes' ? renderNotesTab() : renderReportTab()}
        </View>

        {/* B13: «Se rapport» fast i bunn, skjult når rapport-fanen alt er aktiv.
            Screen sin SafeAreaView gir safe-area-polstring i bunnen. */}
        {activeTab !== 'report' && (
          <View style={{ paddingTop: theme.spacing.sm }}>
            <PrimaryButton
              onPress={() => setActiveTab('report')}
              style={{ minHeight: 56 }}
              icon={<Ionicons name="document-text-outline" size={20} color="#fff" />}
            >
              {nb.detail.seeReport}
            </PrimaryButton>
          </View>
        )}
      </Screen>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Stack.Screen
        options={{
          title: project?.name ?? 'Prosjekt',
          headerShown: true,
          headerBackTitle: nb.tabs.home,
        }}
      />

      {renderContent()}

      <ReportGeneratingOverlay visible={isGeneratingGoogleDoc} />
    </View>
  );
}
