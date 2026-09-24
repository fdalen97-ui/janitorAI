import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import apiFetch, {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { formatDate, nb } from '@/src/i18n/nb';
import { getApiBaseUrl } from '@/src/config/api';
import { fetchReportStatus, resolveStuckReport } from '@/src/sync/reportRecovery';
import { newId } from '@/src/lib/ids';
import { CaseFile, NO_DATE_SET, Project, UNKNOWN_INSPECTOR } from '@/src/features/projects/types';
import { formatMinutes, minutesToApproved } from '@/src/features/projects/metrics';
import {
  createTestProjectCopy,
  hasPendingProjectMedia,
} from '@/src/features/projects/testProject';

// Treff fra Kartverkets adresse-API, via /api/underlag/adresse.
type AddressHit = {
  adressetekst: string;
  postnummer?: string;
  poststed?: string;
  kommunenavn?: string;
  kommunenummer?: string;
  gnr?: number;
  bnr?: number;
  lat?: number;
  lon?: number;
};

function tidyPlace(value?: string): string {
  if (!value) return '';
  return value.charAt(0) + value.slice(1).toLowerCase();
}
import { loadProfile } from '@/src/storage/profileStorage';
import {
  loadProjects,
  saveProjects,
  deleteProject as deleteProjectFromStorage,
} from '@/src/storage/projectsStorage';
import {
  deleteProjectRemote,
  pullAndMerge,
  pushProject,
  schedulePush,
  syncNow,
  touchProject,
} from '@/src/sync/projectSync';
import MediaUploadErrorBanner from '@/src/components/MediaUploadErrorBanner';
import { recordOversizedFile } from '@/src/sync/syncStatus';
import SyncStatusIndicator from '@/src/components/SyncStatusIndicator';
import {
  Body,
  Caption,
  DateField,
  GlassCard,
  IconButton,
  localDateString,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StatusChip,
  TextField,
  Title,
  useAppTheme,
  useToast,
} from '@/src/ui';

// ── Status helpers ────────────────────────────────────────────────────────────

type ProjectStatus = 'draft' | 'processing' | 'ready' | 'failed';

function getProjectStatus(project: Project): ProjectStatus {
  if (project.reportStatus === 'processing') return 'processing';
  if (project.reportUrl || project.reportStatus === 'ready') return 'ready';
  if (project.reportStatus === 'failed') return 'failed';
  return 'draft';
}

// Kun til filterchips (kant/bakgrunn) — selve statusvisningen på kortet
// bruker StatusChip med WCAG AA-fargepar (B20).
const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft: '#7C8A96',
  processing: '#23545C',
  ready: '#2E7D4F',
  failed: '#A6453A',
};

const UNKNOWN_INSPECTOR_LABEL = nb.projects.unknownInspector;

// ── Filter helpers ────────────────────────────────────────────────────────────

type FilterStatus = 'all' | ProjectStatus;

const FILTER_CHIPS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: nb.projects.filterAll },
  { value: 'draft', label: nb.status.draft },
  { value: 'processing', label: nb.status.processing },
  { value: 'ready', label: nb.status.ready },
  { value: 'failed', label: nb.status.failed },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Index() {
  const theme = useAppTheme();
  const router = useRouter();
  const toast = useToast();

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);

  // Filter & search (ephemeral — resets on navigation)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Token
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  // Creation wizard: 0 = closed, 1/2/3 = active step
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wizardName, setWizardName] = useState('');
  const [wizardNameError, setWizardNameError] = useState<string | null>(null);
  // Saksunderlag: adresseforslag fra Kartverket mens man skriver (B17).
  const [addressHits, setAddressHits] = useState<AddressHit[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [wizardCaseFile, setWizardCaseFile] = useState<CaseFile | null>(null);
  const [wizardDate, setWizardDate] = useState(() => localDateString(new Date()));
  const [wizardInspector, setWizardInspector] = useState('');
  const [wizardDescription, setWizardDescription] = useState('');
  const [wizardMediaFiles, setWizardMediaFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<any>(null);

  // ── Token management ────────────────────────────────────────────────────────

  const handleUnauthorized = async (showModal = true) => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenError('Ugyldig tilgangskode. Skriv inn en gyldig kode for å fortsette.');
    if (showModal) setShowTokenModal(true);
  };

  useEffect(() => {
    (async () => {
      const storedToken = await loadTesterToken();
      if (!storedToken) {
        setTokenStatus('invalid');
        return;
      }
      const validation = await validateTesterToken(storedToken);
      if (validation === 'invalid') {
        // Serveren avviste koden aktivt — først da logges testeren ut.
        await handleUnauthorized(false);
        return;
      }
      // 'valid' — eller 'unreachable' (kaldstart/nettbrudd): behold koden og
      // fortsett med lokale data; synken tar igjen serveren når den svarer.
      setTokenInput(storedToken);
      setTokenStatus('valid');
      setTokenError(null);
    })();
  }, []);

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
      // Pilotfunn: uten dette sto lista tom etter innlogging på ny enhet til
      // testeren tilfeldigvis trykket på synk-chippen. Hent skyprosjektene nå.
      await handleSyncNow();
      return;
    }
    if (validation === 'unreachable') {
      // Serveren svarte ikke (kaldstart/nettbrudd) — det sier ingenting om
      // koden. Ikke kall den ugyldig; be testeren prøve igjen.
      setTokenError(nb.auth.serverUnreachable);
      return;
    }
    await handleUnauthorized();
  };

  const handleRemoveToken = async () => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenInput('');
    setTokenError(null);
    setShowTokenModal(true);
  };

  // ── Project loading & sync ──────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      let loaded: Project[] = [];
      try {
        loaded = await loadProjects();
        setProjects(loaded);
      } catch {
        console.warn('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
      // Pull server state before resetting any stuck 'processing' projects.
      // We only reset after a *successful* merge so we never clobber a report
      // the server already completed while the app was closed. If the pull
      // fails (offline / transient error), we leave local state untouched and
      // defer the reset until the next successful sync.
      try {
        const merged = await pullAndMerge(loaded);
        if (merged) {
          setProjects(merged);
          await saveProjects(merged);
          // After reconciliation with the server, reset projects that are
          // still 'processing'. At this point we have authoritative server
          // state: any project the server already finished will show as
          // 'ready' in `merged` and won't be touched. Use touchProject to
          // advance updatedAt so the reset wins future LWW merges against a
          // server copy that is also still stuck 'processing'.
          const hasStuck = merged.some((p) => p.reportStatus === 'processing');
          if (hasStuck) {
            // Hovedboka først (report_generations via /report/status): en
            // generering kan ha fullført server-side etter at appen døde.
            // Da gjenfinnes dokumentet i stedet for å avskrives som avbrutt
            // (og regenereres til dobbel kostnad). Pågår den ennå, får den stå.
            const resolved: Project[] = [];
            const changed: Project[] = [];
            for (const p of merged) {
              if (p.reportStatus !== 'processing') {
                resolved.push(p);
                continue;
              }
              const status = await fetchReportStatus(p.id, p.reportAttemptId);
              // Uten svar (offline/eldre server): dagens oppførsel — avbrutt.
              const outcome = status
                ? resolveStuckReport(p, status)
                : ({ kind: 'interrupted' } as const);
              if (outcome.kind === 'stillRunning') {
                resolved.push(p);
              } else if (outcome.kind === 'recovered') {
                const recovered = touchProject(outcome.project);
                resolved.push(recovered);
                changed.push(recovered);
              } else {
                const reset = touchProject({
                  ...p,
                  reportStatus: 'failed' as const,
                  reportError: nb.report.interrupted,
                  reportAttemptId: undefined,
                });
                resolved.push(reset);
                changed.push(reset);
              }
            }
            setProjects(resolved);
            await saveProjects(resolved);
            // Push corrected projects so the server copy matches (touchProject
            // advanced updatedAt, so the fix wins future LWW merges).
            for (const p of changed) {
              schedulePush(p);
            }
          }
        }
      } catch {
        console.warn('Initial sync failed');
      }
    })();
  }, []);

  const handleSyncNow = async () => {
    try {
      const merged = await syncNow(await loadProjects());
      if (merged) {
        setProjects(merged);
        await saveProjects(merged);
      }
    } catch {
      console.warn('Manual sync failed');
    }
  };

  const saveProjectsToStorage = async (newProjects: Project[], changedProject?: Project) => {
    let toSave = newProjects;
    let touched: Project | undefined;
    if (changedProject) {
      touched = touchProject(changedProject);
      toSave = newProjects.map((p) => (p.id === touched!.id ? touched! : p));
    }
    setProjects(toSave);
    let saved = true;
    try {
      await saveProjects(toSave);
    } catch {
      console.warn('Failed to save projects');
      saved = false;
      toast.show({ message: 'Kunne ikke lagre prosjektene på enheten', variant: 'error', durationMs: 4200 });
    }
    if (touched) {
      schedulePush(touched);
    }
    return saved;
  };

  // ── Project CRUD ────────────────────────────────────────────────────────────

  const resetWizard = () => {
    setWizardStep(0);
    setWizardName('');
    setWizardNameError(null);
    setWizardDate(localDateString(new Date()));
    setWizardInspector('');
    setWizardDescription('');
    setWizardMediaFiles([]);
    setWizardCaseFile(null);
    setAddressHits([]);
    pickedAddressRef.current = null;
  };

  // ── Saksunderlag: adressesøk mot Kartverket mens man skriver ────────────────
  const pickedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const query = wizardName.trim();
    if (wizardStep !== 1 || query.length < 4 || query === pickedAddressRef.current) {
      setAddressHits([]);
      setIsSearchingAddress(false);
      return;
    }
    let cancelled = false;
    setIsSearchingAddress(true);
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/adresse?sok=${encodeURIComponent(query)}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled) {
          setAddressHits(Array.isArray(data.adresser) ? data.adresser.slice(0, 4) : []);
        }
      } catch {
        // Adressesøket er en berikelse — feil skal aldri stoppe veiviseren.
      } finally {
        if (!cancelled) setIsSearchingAddress(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wizardName, wizardStep]);

  const pickAddress = (hit: AddressHit) => {
    const label = hit.poststed ? `${hit.adressetekst}, ${tidyPlace(hit.poststed)}` : hit.adressetekst;
    pickedAddressRef.current = label;
    setWizardName(label);
    setWizardNameError(null);
    setAddressHits([]);
    if (typeof hit.lat === 'number' && typeof hit.lon === 'number') {
      setWizardCaseFile({
        addressText: hit.adressetekst,
        postCode: hit.postnummer,
        postPlace: tidyPlace(hit.poststed),
        municipality: tidyPlace(hit.kommunenavn),
        municipalityNumber: hit.kommunenummer,
        gnr: hit.gnr,
        bnr: hit.bnr,
        lat: hit.lat,
        lon: hit.lon,
      });
    } else {
      setWizardCaseFile(null);
    }
  };

  const createProject = async () => {
    const name = wizardName.trim();
    const date = wizardDate.trim();
    const inspector = wizardInspector.trim();
    const description = wizardDescription.trim();

    if (!name) {
      setWizardStep(1);
      setWizardNameError('Gi prosjektet et navn');
      return;
    }

    const profile = await loadProfile();

    const newProject: Project = {
      id: newId(),
      name,
      inspectionDate: date || NO_DATE_SET,
      inspector: inspector || UNKNOWN_INSPECTOR,
      notes: [],
      ...(description ? { projectDescriptionText: description } : {}),
      ...(wizardCaseFile ? { caseFile: wizardCaseFile } : {}),
      reportMeta: {
        contributors: [{}],
        buildings: [{}],
        // Saksunderlaget forhåndsutfyller rapportskjemaet (B17-sporet).
        addressStreet: wizardCaseFile?.addressText || undefined,
        addressPostcodeCity: wizardCaseFile
          ? [wizardCaseFile.postCode, wizardCaseFile.postPlace].filter(Boolean).join(' ') || undefined
          : undefined,
        inspectionDoneByName: profile.name || undefined,
        inspectionDoneByPhone: profile.phone || undefined,
        inspectionDoneByCompany: profile.company || undefined,
      },
    };

    const newProjects = [newProject, ...projects];
    const saved = await saveProjectsToStorage(newProjects, newProject);
    resetWizard();
    // Ikke overskriv lagringsfeil-toasten med en suksessmelding (én toast vises om gangen).
    if (saved) {
      toast.show({ message: nb.projects.created, variant: 'success' });
    }
  };

  const duplicateAsTestProject = async (source: Project) => {
    if (duplicatingProjectId) return;
    setDuplicatingProjectId(source.id);
    try {
      // Finish source uploads first. pushProject persists successful remote IDs
      // into local storage even when the later project PUT cannot complete.
      await pushProject(source);
      const refreshed = await loadProjects();
      const durableSource = refreshed.find((project) => project.id === source.id);
      if (!durableSource || hasPendingProjectMedia(durableSource)) {
        toast.show({ message: nb.projects.testCopyNeedsUpload, variant: 'info' });
        return;
      }

      const testProject = createTestProjectCopy(
        durableSource,
        refreshed,
        newId(),
      );
      const saved = await saveProjectsToStorage(
        [testProject, ...refreshed],
        testProject,
      );
      if (saved) {
        toast.show({ message: nb.projects.testCopyCreated, variant: 'success' });
      }
    } catch {
      toast.show({ message: nb.projects.testCopyFailed, variant: 'error' });
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  // B15: bekreftelse før sletting — Alert beholdes (destruktiv bekreftelse).
  const confirmDeleteProject = (project: Project) => {
    const doDelete = async () => {
      const newProjects = await deleteProjectFromStorage(project.id);
      setProjects(newProjects);
      deleteProjectRemote(project.id).catch(() => {});
      toast.show({ message: nb.projects.deleted, variant: 'success' });
    };

    // Alert.alert is a silent no-op on web — use window.confirm instead.
    if (Platform.OS === 'web') {
      if (window.confirm(`${nb.projects.deleteTitle}\n\n${nb.projects.deleteMessage(project.name)}`)) {
        void doDelete();
      }
      return;
    }

    Alert.alert(
      nb.projects.deleteTitle,
      nb.projects.deleteMessage(project.name),
      [
        { text: nb.common.cancel, style: 'cancel' },
        { text: nb.projects.deleteConfirm, style: 'destructive', onPress: () => void doDelete() },
      ]
    );
  };

  // B15: diskret meny på kortet — valg-dialog via Alert er OK.
  const showProjectMenu = (project: Project) => {
    // På web er Alert med flere valg en no-op — gå rett til slettebekreftelsen.
    if (Platform.OS === 'web') {
      confirmDeleteProject(project);
      return;
    }
    Alert.alert(nb.projects.projectMenu, project.name, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.common.delete, style: 'destructive', onPress: () => confirmDeleteProject(project) },
    ]);
  };

  // ── Render: token modal ─────────────────────────────────────────────────────

  const renderTokenModal = () => (
    <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(false)}>
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
      }}>
        <GlassCard style={{ width: '100%', gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title>{nb.auth.accessTitle}</Title>
            <TouchableOpacity
              onPress={() => setShowTokenModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isValidatingToken}
              accessibilityLabel={nb.common.close}
            >
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
          <Body muted>{nb.auth.accessMessage}</Body>
          {tokenError && <Caption style={{ color: theme.colors.danger }}>{tokenError}</Caption>}
          <TextField
            value={tokenInput}
            onChangeText={(value) => { setTokenInput(value); setTokenError(null); }}
            placeholder={nb.auth.accessPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton onPress={saveToken} loading={isValidatingToken}>
            {nb.auth.accessSave}
          </PrimaryButton>
          <SecondaryButton onPress={handleRemoveToken} disabled={isValidatingToken}>
            Fjern koden
          </SecondaryButton>
        </GlassCard>
      </View>
    </Modal>
  );

  // ── Render: 3-step creation wizard ─────────────────────────────────────────

  const trimmedWizardName = wizardName.trim().toLowerCase();
  // B17: case-insensitiv duplikatsjekk — varsler, men blokkerer ikke.
  const isDuplicateName =
    trimmedWizardName.length > 0 &&
    projects.some((p) => p.name.trim().toLowerCase() === trimmedWizardName);

  const renderWizardModal = () => (
    <Modal
      visible={wizardStep > 0}
      transparent
      animationType="slide"
      onRequestClose={resetWizard}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: theme.radii.lg,
          borderTopRightRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xl * 2,
          gap: theme.spacing.md,
        }}>
          {/* Step label + close */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Caption muted style={{ fontWeight: '600' }}>{`Steg ${wizardStep} av 3`}</Caption>
            <IconButton onPress={resetWizard} accessibilityLabel={nb.common.close}>
              <Ionicons name="close" size={20} color={theme.colors.muted} />
            </IconButton>
          </View>

          {/* Dot progress bar */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignSelf: 'center' }}>
            {([1, 2, 3] as const).map((s) => (
              <View
                key={s}
                style={{
                  height: 8,
                  width: s === wizardStep ? 32 : 8,
                  borderRadius: 4,
                  backgroundColor: s <= wizardStep ? theme.colors.accent : theme.colors.border,
                }}
              />
            ))}
          </View>

          {/* Step 1 — Details */}
          {wizardStep === 1 && (
            <>
              <Title style={{ fontSize: 20 }}>Befaringsdetaljer</Title>
              <TextField
                label={`${nb.projects.nameLabel} *`}
                value={wizardName}
                onChangeText={(value) => {
                  setWizardName(value);
                  if (wizardNameError) setWizardNameError(null);
                }}
                placeholder={nb.projects.namePlaceholder}
                autoFocus
                error={wizardNameError ?? undefined}
              />
              {/* Saksunderlag: adresseforslag fra Kartverket */}
              {isSearchingAddress && <Caption muted>{nb.underlag.searching}</Caption>}
              {addressHits.length > 0 && (
                <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, overflow: 'hidden' }}>
                  {addressHits.map((hit, index) => (
                    <Pressable
                      key={`${hit.adressetekst}-${hit.postnummer}-${index}`}
                      onPress={() => pickAddress(hit)}
                      accessibilityRole="button"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        paddingVertical: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: theme.colors.border,
                        backgroundColor: theme.colors.surfaceSecondary,
                      }}
                    >
                      <Ionicons name="location-outline" size={16} color={theme.colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontWeight: '600' }}>{hit.adressetekst}</Body>
                        <Caption muted>
                          {[hit.postnummer, tidyPlace(hit.poststed), tidyPlace(hit.kommunenavn)]
                            .filter(Boolean)
                            .join(' · ')}
                        </Caption>
                      </View>
                    </Pressable>
                  ))}
                  <View style={{ paddingVertical: 6, paddingHorizontal: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                    <Caption muted>{nb.underlag.pickHint}</Caption>
                  </View>
                </View>
              )}
              {wizardCaseFile && addressHits.length === 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.accent} />
                  <Caption muted>{`${nb.underlag.title}: ${nb.underlag.cadastre} ${wizardCaseFile.gnr}/${wizardCaseFile.bnr} · ${wizardCaseFile.municipality}`}</Caption>
                </View>
              )}
              {/* B17: inline duplikatvarsel — ikke blokkerende */}
              {isDuplicateName && !wizardNameError && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <Ionicons name="alert-circle-outline" size={14} color={theme.colors.danger} />
                  <Caption style={{ color: theme.colors.danger }}>{nb.projects.duplicateName}</Caption>
                </View>
              )}
              <DateField label="Befaringsdato" value={wizardDate} onChange={setWizardDate} />
              <TextField
                label={nb.projects.inspectorLabel}
                value={wizardInspector}
                onChangeText={setWizardInspector}
                placeholder="Navnet ditt"
              />
              <PrimaryButton
                style={{ minHeight: 56 }}
                icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
                onPress={() => {
                  if (!wizardName.trim()) {
                    setWizardNameError('Gi prosjektet et navn');
                    return;
                  }
                  setWizardStep(2);
                }}
              >
                {nb.common.next}
              </PrimaryButton>
            </>
          )}

          {/* Step 2 — Media Upload */}
          {wizardStep === 2 && (
            <>
              <Title style={{ fontSize: 20 }}>Legg til medier</Title>
              <Caption muted>
                Velg bilder og videoer fra befaringen. Du kan legge til flere etter at prosjektet er opprettet.
              </Caption>

              {/* Drop zone — triggers the hidden file input */}
              <Pressable
                onPress={() => fileInputRef.current?.click()}
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.border,
                  borderRadius: theme.radii.md,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  backgroundColor: wizardMediaFiles.length > 0
                    ? `${theme.colors.accent}10`
                    : theme.colors.surfaceSecondary,
                }}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={40}
                  color={wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.muted}
                />
                <Body style={{ color: wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.muted, fontWeight: '600' }}>
                  {wizardMediaFiles.length > 0 ? 'Trykk for å endre utvalget' : 'Trykk for å velge filer'}
                </Body>
                <Caption muted>Bilder og videoer · Valgfritt</Caption>
              </Pressable>

              {/* Hidden file input (web only) */}
              {/* @ts-ignore */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={(e: any) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
                  setWizardMediaFiles(files.map((f) => ({ name: f.name, size: f.size, type: f.type })));
                  // Warn immediately if any selected file exceeds its media-type cap.
                  const exceedsMediaLimit = (f: File) =>
                    f.size > (f.type.startsWith('video')
                      ? 500 * 1024 * 1024
                      : 50 * 1024 * 1024);
                  if (files.some(exceedsMediaLimit)) {
                    recordOversizedFile();
                  }
                }}
              />

              {/* Selected file list */}
              {wizardMediaFiles.length > 0 && (
                <GlassCard style={{ gap: theme.spacing.xs }}>
                  <Caption muted style={{ fontWeight: '600' }}>
                    {wizardMediaFiles.length === 1 ? '1 fil valgt' : `${wizardMediaFiles.length} filer valgt`}
                  </Caption>
                  {wizardMediaFiles.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                      <Ionicons
                        name={f.type.startsWith('video') ? 'videocam-outline' : 'image-outline'}
                        size={15}
                        color={theme.colors.accent}
                      />
                      <Caption numberOfLines={1} style={{ flex: 1 }}>{f.name}</Caption>
                      <Caption muted>{(f.size / 1024 / 1024).toFixed(1)} MB</Caption>
                    </View>
                  ))}
                </GlassCard>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton
                  style={{ flex: 1, minHeight: 56 }}
                  icon={<Ionicons name="arrow-back" size={18} color={theme.colors.foreground} />}
                  onPress={() => setWizardStep(1)}
                >
                  {nb.common.back}
                </SecondaryButton>
                <PrimaryButton
                  style={{ flex: 1, minHeight: 56 }}
                  icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
                  onPress={() => setWizardStep(3)}
                >
                  {nb.common.next}
                </PrimaryButton>
              </View>
            </>
          )}

          {/* Step 3 — Notes & Review */}
          {wizardStep === 3 && (
            <>
              <Title style={{ fontSize: 20 }}>Notater og oppsummering</Title>

              {/* Initial notes / description */}
              <TextField
                label="Innledende notater (valgfritt)"
                multiline
                value={wizardDescription}
                onChangeText={setWizardDescription}
                placeholder={nb.detail.descriptionPlaceholder}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />

              {/* Review summary */}
              <GlassCard style={{ gap: theme.spacing.sm }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>{nb.projects.nameLabel}</Caption>
                  <Body>{wizardName}</Body>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>Befaringsdato</Caption>
                  <Body>{formatDate(wizardDate) || 'Ikke angitt'}</Body>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>{nb.projects.inspectorLabel}</Caption>
                  <Body>{wizardInspector.trim() || UNKNOWN_INSPECTOR_LABEL}</Body>
                </View>
                {wizardMediaFiles.length > 0 && (
                  <View style={{ gap: theme.spacing.xs }}>
                    <Caption muted>Valgte medier</Caption>
                    <Body>{wizardMediaFiles.length === 1 ? '1 fil' : `${wizardMediaFiles.length} filer`}</Body>
                  </View>
                )}
              </GlassCard>

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton
                  style={{ flex: 1, minHeight: 56 }}
                  icon={<Ionicons name="arrow-back" size={18} color={theme.colors.foreground} />}
                  onPress={() => setWizardStep(2)}
                >
                  {nb.common.back}
                </SecondaryButton>
                <PrimaryButton style={{ flex: 1, minHeight: 56 }} onPress={createProject}>
                  Opprett prosjekt
                </PrimaryButton>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Derived: per-status counts (used by filter chips) ───────────────────────

  const statusCounts = React.useMemo<Record<FilterStatus, number>>(() => {
    const counts: Record<FilterStatus, number> = {
      all: projects.length,
      draft: 0,
      processing: 0,
      ready: 0,
      failed: 0,
    };
    for (const p of projects) {
      counts[getProjectStatus(p)] += 1;
    }
    return counts;
  }, [projects]);

  // ── Derived: filtered project list ──────────────────────────────────────────

  const filteredProjects = projects.filter((p) => {
    if (filterStatus !== 'all' && getProjectStatus(p) !== filterStatus) return false;
    if (searchQuery.trim()) {
      return p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  // ── Render: empty state ─────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      minHeight: 360,
    }}>
      <View style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: theme.colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name="clipboard-outline" size={40} color={theme.colors.accent} />
      </View>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Title style={{ textAlign: 'center' }}>{nb.projects.empty}</Title>
        <Body muted style={{ textAlign: 'center', maxWidth: 280 }}>
          {nb.projects.emptyHint}
        </Body>
      </View>
      <PrimaryButton
        onPress={() => setWizardStep(1)}
        width={260}
        style={{ minHeight: 56 }}
        icon={<Ionicons name="add" size={20} color="#fff" />}
      >
        {nb.projects.newProject}
      </PrimaryButton>
    </View>
  );

  // ── Render: project card (B14: hele kortet er klikkbart) ────────────────────

  const renderProjectCard = ({ item, index }: { item: Project; index: number }) => {
    const notes = item.notes || [];
    const noteCount = notes.length;
    const audioCount = notes.filter((n) => n.audioUri).length;
    const photoCount = notes.reduce((sum, n) => sum + (n.photos?.length || 0), 0);
    const status = getProjectStatus(item);
    const approvedMinutes = minutesToApproved(item);

    const dateText = formatDate(item.inspectionDate);
    const inspectorText = item.inspector === UNKNOWN_INSPECTOR ? UNKNOWN_INSPECTOR_LABEL : item.inspector;
    const metaText = dateText ? `${dateText} · ${inspectorText}` : inspectorText;

    const openProject = () => router.push(`/projects/${item.id}`);
    // «Prøv igjen» skal faktisk prøve igjen: detaljskjermen leser retry-parameteren,
    // åpner rapport-fanen og starter genereringen på nytt.
    const retryReport = () => router.push(`/projects/${item.id}?retry=1`);

    return (
      <Animated.View entering={FadeInDown.springify().delay(index * 50)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nb.projects.openProject}: ${item.name}`}
          onPress={() => {
            Haptics.selectionAsync();
            openProject();
          }}
          style={{ marginBottom: theme.spacing.md }}
        >
          <GlassCard style={{ gap: theme.spacing.sm }}>
            {/* Name + meta + menu */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                  <Title numberOfLines={1} style={{ flexShrink: 1 }}>{item.name}</Title>
                  {item.isTestProject ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: theme.radii.pill,
                        backgroundColor: `${theme.colors.accent}1A`,
                        borderWidth: 1,
                        borderColor: theme.colors.accent,
                      }}
                    >
                      <Caption style={{ color: theme.colors.accent, fontWeight: '700' }}>
                        {nb.projects.testProject}
                      </Caption>
                    </View>
                  ) : null}
                  {item.hasSuccessfulDocument ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: theme.radii.pill,
                        backgroundColor: `${theme.colors.accent}1A`,
                        borderWidth: 1,
                        borderColor: theme.colors.accent,
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={13} color={theme.colors.accent} />
                      <Caption style={{ color: theme.colors.accent, fontWeight: '700' }}>
                        {nb.projects.documentCreated}
                      </Caption>
                    </View>
                  ) : null}
                </View>
                <Caption muted>{metaText}</Caption>
              </View>
              <IconButton
                accessibilityLabel={nb.projects.projectMenu}
                onPress={() => showProjectMenu(item)}
                style={{ width: 34, height: 34, backgroundColor: theme.colors.surfaceSecondary }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.muted} />
              </IconButton>
            </View>

            {/* Status + tellere */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <StatusChip status={status} onRetry={status === 'failed' ? retryReport : undefined} />
              <Caption muted>
                {`${noteCount} ${nb.projects.notesCount} · ${photoCount} ${nb.projects.photosCount} · ${audioCount} ${nb.projects.audioCount}`}
              </Caption>
            </View>

            {!item.isTestProject ? (
              <TouchableOpacity
                testID={`duplicate-test-project-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${nb.projects.createTestCopy}: ${item.name}`}
                disabled={duplicatingProjectId !== null}
                onPress={(event) => {
                  event.stopPropagation();
                  void duplicateAsTestProject(item);
                }}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.surfaceSecondary,
                }}
              >
                <Ionicons name="copy-outline" size={15} color={theme.colors.accent} />
                <Caption style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  {duplicatingProjectId === item.id
                    ? nb.projects.preparingTestCopy
                    : nb.projects.createTestCopy}
                </Caption>
              </TouchableOpacity>
            ) : null}

            {/* Tid til godkjent rapport — pilotmetrikken (A3). Kobber = nøkkeltall. */}
            {approvedMinutes !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="timer-outline" size={13} color={theme.colors.copper} />
                <Caption style={{ color: theme.colors.copper, fontWeight: '600' }}>
                  {nb.projects.timeToApproved(formatMinutes(approvedMinutes))}
                </Caption>
              </View>
            )}
          </GlassCard>
        </Pressable>
      </Animated.View>
    );
  };

  // ── Render: scrollable list header (søk + filter + ny) ──────────────────────

  const renderListHeader = () => (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
      {tokenStatus !== 'valid' && (
        <GlassCard style={{ gap: theme.spacing.xs }}>
          <Title muted>{nb.auth.accessTitle}</Title>
          <Body muted>{nb.auth.accessMessage}</Body>
          <PrimaryButton onPress={() => setShowTokenModal(true)}>Skriv inn kode</PrimaryButton>
        </GlassCard>
      )}

      <PrimaryButton
        style={{ minHeight: 56 }}
        icon={<Ionicons name="add" size={20} color="#fff" />}
        onPress={() => setWizardStep(1)}
      >
        {nb.projects.newProject}
      </PrimaryButton>

      {/* Search input */}
      <TextField
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={nb.projects.searchPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {FILTER_CHIPS.map((chip) => {
          const active = filterStatus === chip.value;
          const count = statusCounts[chip.value];
          const empty = count === 0;
          const chipColor = chip.value === 'all'
            ? theme.colors.accent
            : STATUS_COLOR[chip.value as ProjectStatus];
          return (
            <Pressable
              key={chip.value}
              onPress={() => setFilterStatus(chip.value)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.pill,
                borderWidth: 1.5,
                borderColor: active ? chipColor : theme.colors.border,
                backgroundColor: active ? `${chipColor}22` : theme.colors.surfaceSecondary,
                opacity: empty && !active ? 0.45 : 1,
              }}
            >
              <Caption
                style={{
                  color: active ? chipColor : theme.colors.muted,
                  fontWeight: active ? '700' : '400',
                }}
              >
                {chip.label}{' '}
                <Caption
                  style={{
                    color: active ? chipColor : theme.colors.muted,
                    fontWeight: active ? '700' : '400',
                  }}
                >
                  ({count})
                </Caption>
              </Caption>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Screen scrollable={false} style={{ flex: 1 }}>
      {renderTokenModal()}
      {renderWizardModal()}

      {/* B16: fast topprad som ikke scroller — tittel, synk-status og medievarsel */}
      <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Title>{nb.common.appName}</Title>
            <Caption muted>{nb.projects.subtitle}</Caption>
          </View>
          <IconButton accessibilityLabel={nb.auth.accessTitle} onPress={() => setShowTokenModal(true)}>
            <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
          </IconButton>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatusIndicator onSyncNow={handleSyncNow} />
        </View>
        <MediaUploadErrorBanner />
      </View>

      <FlatList
        data={isLoading ? [] : filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={
          isLoading ? null : (
            projects.length === 0
              ? renderEmptyState()
              : (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: theme.spacing.xl,
                  gap: theme.spacing.md,
                  minHeight: 200,
                }}>
                  <Ionicons name="search-outline" size={40} color={theme.colors.muted} />
                  <Body muted style={{ textAlign: 'center' }}>
                    Ingen prosjekter samsvarer med filteret.
                  </Body>
                  <SecondaryButton onPress={() => { setFilterStatus('all'); setSearchQuery(''); }}>
                    Nullstill filtrene
                  </SecondaryButton>
                </View>
              )
          )
        }
        contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
