import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, { UnauthorizedError, getCachedTesterToken } from '@/src/lib/apiFetch';
import { Note, Photo, Project } from '@/src/features/projects/types';
import {
  updateProject as updateProjectInStorage,
  getProject,
  loadProjects,
} from '@/src/storage/projectsStorage';
import {
  setSyncState,
  setMediaUploadFailures,
  clearMediaUploadFailures,
  recordOversizedFile,
  recordProjectTooLarge,
  clearProjectTooLarge,
  setVideoUploadProgress,
  clearVideoUploadProgress,
  setMediaBatchProgress,
  recordLostMedia,
} from './syncStatus';
import { logError, logAction } from '@/src/lib/logger';
import { isIdbUri, noteIdFromIdbUri, loadVideoFromIdb, deleteVideoFromIdb } from './videoIdb';

// Number of consecutive push cycles with at least one media upload failure
// before we surface a warning to the inspector.
const MEDIA_FAILURE_THRESHOLD = 3;

// Tracks consecutive push cycles that contained at least one media failure,
// keyed by project ID. Reset to 0 on a fully-clean push.
const consecutiveMediaFailures = new Map<string, number>();

const PUSH_DEBOUNCE_MS = 2000;

const pendingPushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingProjects = new Map<string, Project>();
let syncDisabled = false;

const pushMutex = new Map<string, Promise<void>>();
const PENDING_DELETES_KEY = '@inspection_pending_deletes';

async function getPendingDeletes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setPendingDeletes(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids));
  } catch {
    // best-effort
  }
}

async function addPendingDelete(id: string): Promise<void> {
  const ids = await getPendingDeletes();
  if (!ids.includes(id)) {
    ids.push(id);
    await setPendingDeletes(ids);
  }
}

async function removePendingDelete(id: string): Promise<void> {
  const ids = await getPendingDeletes();
  const next = ids.filter((x) => x !== id);
  if (next.length !== ids.length) {
    await setPendingDeletes(next);
  }
}

function projectsUrl(path = ''): string {
  return `${getApiBaseUrl()}/api/projects${path}`;
}

function mediaUploadUrl(): string {
  return `${getApiBaseUrl()}/api/media`;
}

function toTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return isNaN(t) ? 0 : t;
}

export function touchProject(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

// ---------- PROJECT UPDATE SUBSCRIPTIONS ----------
// Lets UI screens react immediately when pushProject writes remote IDs back to
// storage (e.g. videoRemoteId after a successful upload), without polling.

type ProjectUpdateListener = (project: Project) => void;
const projectUpdateListeners = new Map<string, Set<ProjectUpdateListener>>();

/**
 * Subscribe to in-process updates for a specific project.
 * Called when pushProject writes a new remote ID back to local storage so the
 * UI can re-render without waiting for the next pull.
 * Returns an unsubscribe function.
 */
export function subscribeToProjectUpdates(
  projectId: string,
  listener: ProjectUpdateListener,
): () => void {
  if (!projectUpdateListeners.has(projectId)) {
    projectUpdateListeners.set(projectId, new Set());
  }
  projectUpdateListeners.get(projectId)!.add(listener);
  return () => {
    const set = projectUpdateListeners.get(projectId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) projectUpdateListeners.delete(projectId);
    }
  };
}

function notifyProjectUpdate(project: Project): void {
  projectUpdateListeners.get(String(project.id))?.forEach((l) => {
    try { l(project); } catch { /* listener errors must not break the sync loop */ }
  });
}

// ---------- MEDIA UPLOAD ----------

function guessFileMeta(uri: string, kind: 'photo' | 'audio' | 'video'): { name: string; type: string } {
  const extMatch = uri.split('?')[0].match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch
    ? extMatch[1].toLowerCase()
    : kind === 'photo'
    ? 'jpg'
    : kind === 'video'
    ? 'mp4'
    : 'm4a';
  let type: string;
  if (kind === 'photo') {
    type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  } else if (kind === 'video') {
    type = `video/${ext}`;
  } else {
    type = `audio/${ext}`;
  }
  return { name: `${kind}.${ext}`, type };
}

/** Serverens svar på en vellykket opplasting: varig id + sjekksum (B11). */
type UploadResult = { id: string; sha256?: string };

// Guard against duplicate uploads when a stale in-memory project (without
// the remoteId that was already persisted) is pushed again.
const uploadedByUri = new Map<string, UploadResult>();
// 'lost' = kilden er varig utilgjengelig lokalt (død blob:/data:-referanse
// eller manglende IndexedDB-innslag etter omstart på web) — aldri prøv igjen,
// og marker mediet som tapt i stedet for å telle evig feil.
type UploadOutcome = UploadResult | null | 'lost';
const uploadsInFlight = new Map<string, Promise<UploadOutcome>>();
// URIs permanently rejected by the server (FILE_TOO_LARGE). Never retried.
const oversizedUris = new Set<string>();

/**
 * Clear all in-memory upload state for a URI so the sync engine will treat
 * the next upload attempt for that URI as a fresh start.  Call this before
 * replacing a stalled/failed video with a newly-selected file.
 *
 * Note: removing a URI from uploadsInFlight does NOT cancel the underlying
 * XHR — the request may still complete.  The stale-completion race is handled
 * separately by applyRemoteIds() in pushProject.
 */
export function clearVideoRetryState(uri: string | undefined): void {
  if (!uri) return;
  oversizedUris.delete(uri);
  uploadedByUri.delete(uri);
  uploadsInFlight.delete(uri);
}
async function uploadMedia(
  uri: string,
  kind: 'photo' | 'audio' | 'video',
  projectId: string,
): Promise<UploadOutcome> {
  // Permanently quarantined — server already rejected this file as too large.
  if (oversizedUris.has(uri)) return null;

  const cached = uploadedByUri.get(uri);
  if (cached) return cached;

  const inFlight = uploadsInFlight.get(uri);
  if (inFlight) return inFlight;

  const promise = doUploadMedia(uri, kind, projectId)
    .then((result) => {
      if (result && result !== 'lost') uploadedByUri.set(uri, result);
      return result;
    })
    .finally(() => {
      // Always remove from in-flight map — even on rejection — so a failed
      // upload can be retried on the next sync cycle instead of staying stuck.
      uploadsInFlight.delete(uri);
    });
  uploadsInFlight.set(uri, promise);
  return promise;
}

/**
 * Upload FormData via XMLHttpRequest so we get upload progress events.
 * Returns a minimal Response-like object compatible with the rest of doUploadMedia.
 * XHR works on both web and React Native (where fetch() has no upload progress).
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  token: string | null,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; json(): Promise<any> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    // Do NOT set Content-Type — the browser/RN fills in the multipart boundary automatically.
    if (token) xhr.setRequestHeader('x-tester-token', token);

    // Måling før bygging: hvor langt opplastingen kom og hvor stor fila var
    // inngår i feilmeldingen (→ error_logs via logError hos kalleren). Det er
    // tallene som avgjør om gjenopptakbar/chunket opplasting noen gang trengs
    // — se docs/system-design-laerdommer.md del 2.3.
    let lastPct = 0;
    let totalBytes = 0;
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        totalBytes = e.total;
        lastPct = Math.round((e.loaded / e.total) * 100);
        onProgress(lastPct);
      }
    };
    const progressInfo = () =>
      totalBytes > 0
        ? ` (${lastPct}% of ${Math.round(totalBytes / (1024 * 1024))} MB sent)`
        : '';

    xhr.onload = () => {
      const text = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => JSON.parse(text),
      });
    };

    xhr.onerror = () => reject(new Error(`Network error during video upload${progressInfo()}`));
    xhr.ontimeout = () => reject(new Error(`Video upload timed out${progressInfo()}`));
    xhr.send(formData);
  });
}

async function doUploadMedia(
  uri: string,
  kind: 'photo' | 'audio' | 'video',
  projectId: string,
): Promise<UploadOutcome> {
  const startMs = Date.now();
  try {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('kind', kind);

    const meta = guessFileMeta(uri, kind);

    if (Platform.OS === 'web') {
      // Resolve the video bytes. Two possible sources:
      //   1. idb://<noteId>  — bytes stored in IndexedDB by persistMediaLocally;
      //      survives page refreshes and is the durable path for web videos.
      //   2. blob:<url>      — in-memory reference valid only for the current
      //      session; AbortSignal.timeout prevents hanging on a revoked URL.
      let blob: Blob;

      if (isIdbUri(uri)) {
        const noteId = noteIdFromIdbUri(uri);
        const stored = await loadVideoFromIdb(noteId);
        if (!stored) {
          const err = new Error(`IndexedDB entry missing for key ${noteId} — ${kind} cannot be recovered`);
          logError(err, `upload-${kind}`);
          return 'lost';
        }
        blob = stored;
      } else {
        let response: Response;
        try {
          response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
        } catch (fetchErr: any) {
          const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
          const err = new Error(isTimeout ? 'Blob fetch timed out' : `Blob fetch failed: ${fetchErr?.message}`);
          logError(err, `upload-${kind}`);
          // En blob:/data:-referanse som feiler uten timeout er død for godt
          // (typisk: appen ble lukket og økten forsvant) — retry er meningsløst.
          if (!isTimeout && (uri.startsWith('blob:') || uri.startsWith('data:'))) {
            return 'lost';
          }
          return null;
        }
        if (!response.ok) {
          const err = new Error(`fetch blob failed: HTTP ${response.status}`);
          logError(err, `upload-${kind}`);
          return null;
        }
        blob = await response.blob();
      }

      // Pre-flight size check: catch oversized files here rather than relying on
      // a clean 413 from the server. When multer hits the cap it aborts the
      // stream, which causes the browser fetch() to throw a TypeError (connection
      // reset) instead of returning a well-formed HTTP response — so the
      // FILE_TOO_LARGE code in the response body is never parsed. Checking the
      // blob size before we POST avoids the round-trip entirely.
      const FILE_SIZE_LIMIT =
        kind === 'video' ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
      if (blob.size > FILE_SIZE_LIMIT) {
        oversizedUris.add(uri);
        recordOversizedFile();
        console.warn(
          `[sync] ${kind} upload aborted: blob exceeds ${FILE_SIZE_LIMIT / 1024 / 1024} MB limit`,
          blob.size,
          'bytes',
        );
        return null;
      }

      const type = blob.type || meta.type;
      // Safari gir video/quicktime for .mov-opptak — filnavnet må bære den
      // vanlige endelsen, ellers whitelister ikke serveren den.
      const subtype = (type.split('/')[1] || 'bin').split(';')[0].toLowerCase();
      const ext = subtype === 'quicktime' ? 'mov' : subtype;
      formData.append('file', blob, `${kind}.${ext}`);
    } else {
      formData.append('file', { uri, name: meta.name, type: meta.type } as any);
    }

    // Video uploads use XHR so we can report byte-level progress to the UI.
    // Photos and audio use the normal apiFetch path (progress isn't needed for small files).
    let response: { ok: boolean; status: number; json(): Promise<any> };
    if (kind === 'video') {
      setVideoUploadProgress(uri, 0);
      response = await uploadWithProgress(
        mediaUploadUrl(),
        formData,
        getCachedTesterToken(),
        (pct) => setVideoUploadProgress(uri, pct),
      );
    } else {
      response = await apiFetch(mediaUploadUrl(), {
        method: 'POST',
        body: formData,
        skipAuthHandling: true,
      });
    }

    if (!response.ok) {
      // Try to read a structured error body to detect a permanent rejection.
      let errorCode: string | undefined;
      try {
        const errBody: any = await response.json();
        errorCode = errBody?.code;
      } catch {
        // ignore — body may not be JSON
      }

      if (errorCode === 'FILE_TOO_LARGE') {
        // Permanent failure: quarantine so this URI is never retried, and
        // surface the specific banner rather than the generic failure counter.
        oversizedUris.add(uri);
        recordOversizedFile();
        console.warn('[sync] Media upload rejected: file too large', uri);
        return null;
      }

      console.warn('[sync] Media upload failed', response.status);
      logError(new Error(`Media upload HTTP ${response.status}`), `upload-${kind}`);
      return null;
    }

    const data: any = await response.json();
    const remoteId = typeof data.id === 'string' ? data.id : null;

    if (remoteId) {
      logAction(`upload-${kind}`, Date.now() - startMs);
      // IDB cleanup is intentionally deferred to the caller (pushProject) so
      // it happens only after the videoRemoteId is committed to local storage.
      // Deleting here — before updateProjectInStorage — would leave the note
      // pointing to a missing IDB entry if a refresh occurred in that window.
    } else {
      logError(new Error('Media upload response missing id'), `upload-${kind}`);
      return null;
    }

    return {
      id: remoteId,
      sha256: typeof data.sha256 === 'string' ? data.sha256 : undefined,
    };
  } catch (error) {
    console.warn('[sync] Media upload error', error);
    logError(error, `upload-${kind}`);
    return null;
  } finally {
    // Always clear progress so the UI doesn't stay stuck at a partial percentage.
    if (kind === 'video') clearVideoUploadProgress(uri);
  }
}

/**
 * Upload any media that has no durable server copy yet.
 * Returns an updated project (with remote IDs), whether anything changed,
 * the count of items that still failed to upload, and the list of idb://
 * URIs whose IndexedDB entries can be safely removed — but only after the
 * caller has committed the new videoRemoteId to local storage (to avoid a
 * window where the note references an already-deleted IDB entry).
 */
// Teller medier uten varig serverkopi — grunnlaget for «Laster opp X av Y».
function countPendingMedia(project: Project): number {
  let count = 0;
  for (const note of project.notes || []) {
    if (note.audioUri && !note.audioRemoteId) count += 1;
    if (note.photos) count += note.photos.filter((p) => p.uri && !p.remoteId && !p.lost).length;
    if (note.videoUri && !note.videoRemoteId) count += 1;
  }
  if (project.projectDescriptionAudioUri && !project.projectDescriptionAudioRemoteId) count += 1;
  return count;
}

async function uploadPendingMedia(
  project: Project,
): Promise<{ project: Project; changed: boolean; failedCount: number; lostCount: number; idbUrisToCleanup: string[] }> {
  let changed = false;
  let failedCount = 0;
  let lostCount = 0;
  const idbUrisToCleanup: string[] = [];

  const totalPending = countPendingMedia(project);
  let doneCount = 0;
  const bumpProgress = () => {
    doneCount += 1;
    setMediaBatchProgress({ done: doneCount, total: totalPending });
  };
  if (totalPending > 0) setMediaBatchProgress({ done: 0, total: totalPending });

  try {
  const notes: Note[] = await Promise.all(
    (project.notes || []).map(async (note) => {
      let nextNote = note;

      if (note.audioUri && !note.audioRemoteId) {
        const uploaded = await uploadMedia(note.audioUri, 'audio', project.id);
        if (uploaded && uploaded !== 'lost') {
          nextNote = { ...nextNote, audioRemoteId: uploaded.id, audioSha256: uploaded.sha256 };
          changed = true;
          bumpProgress();
        } else {
          failedCount += 1;
        }
      }

      if (note.photos && note.photos.length > 0) {
        const photos: Photo[] = await Promise.all(
          note.photos.map(async (photo) => {
            if (!photo.uri || photo.remoteId || photo.lost) return photo;
            const uploaded = await uploadMedia(photo.uri, 'photo', project.id);
            if (uploaded === 'lost') {
              // Kilden er død lokalt (app lukket før synk) — marker som tapt
              // så synken slutter å feile, og brukeren får beskjed én gang.
              changed = true;
              lostCount += 1;
              return { ...photo, lost: true };
            }
            if (uploaded) {
              changed = true;
              bumpProgress();
              if (Platform.OS === 'web' && isIdbUri(photo.uri)) {
                idbUrisToCleanup.push(photo.uri);
              }
              return { ...photo, remoteId: uploaded.id, sha256: uploaded.sha256 };
            }
            failedCount += 1;
            return photo;
          }),
        );
        nextNote = { ...nextNote, photos };
      }

      if (note.videoUri && !note.videoRemoteId) {
        const uploaded = await uploadMedia(note.videoUri, 'video', project.id);
        if (uploaded && uploaded !== 'lost') {
          nextNote = { ...nextNote, videoRemoteId: uploaded.id, videoSha256: uploaded.sha256 };
          changed = true;
          bumpProgress();
          // Schedule IDB cleanup for this note's video — deferred so the
          // caller can commit the remoteId to local storage first.
          if (Platform.OS === 'web' && isIdbUri(note.videoUri)) {
            idbUrisToCleanup.push(note.videoUri);
          }
        } else {
          failedCount += 1;
        }
      }

      return nextNote;
    }),
  );

  let next: Project = { ...project, notes };

  if (project.projectDescriptionAudioUri && !project.projectDescriptionAudioRemoteId) {
    const uploaded = await uploadMedia(project.projectDescriptionAudioUri, 'audio', project.id);
    if (uploaded && uploaded !== 'lost') {
      next = { ...next, projectDescriptionAudioRemoteId: uploaded.id };
      changed = true;
      bumpProgress();
    } else {
      failedCount += 1;
    }
  }

  return { project: next, changed, failedCount, lostCount, idbUrisToCleanup };
  } finally {
    setMediaBatchProgress(null);
  }
}

// ---------- PUSH ----------

function isDeviceLocalUri(uri?: string): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:') ||
    uri.startsWith('idb://')
  );
}

/**
 * Server copies must not carry device-local file paths — they are meaningless
 * (and misleading) on other devices. Strip them where a durable remote copy
 * exists; the origin device restores its own local URIs on pull via
 * restoreLocalNoteMedia during mergeProjects.
 */
function stripLocalUrisForServer(project: Project): Project {
  const notes = (project.notes || []).map((note) => {
    let next = note;
    if (note.audioRemoteId && isDeviceLocalUri(note.audioUri)) {
      next = { ...next, audioUri: undefined };
    }
    if (note.photos && note.photos.some((p) => p.remoteId && isDeviceLocalUri(p.uri))) {
      next = {
        ...next,
        photos: note.photos.map((p) =>
          p.remoteId && isDeviceLocalUri(p.uri) ? { ...p, uri: '' } : p,
        ),
      };
    }
    if (next.videoRemoteId && isDeviceLocalUri(next.videoUri)) {
      next = { ...next, videoUri: undefined };
    }
    return next;
  });

  let next: Project = { ...project, notes };
  if (
    next.projectDescriptionAudioRemoteId &&
    isDeviceLocalUri(next.projectDescriptionAudioUri)
  ) {
    next = { ...next, projectDescriptionAudioUri: undefined };
  }
  return next;
}

/**
 * Merge only the remote IDs learned from a just-completed upload back onto
 * the freshly re-read stored project.  A remote ID is applied only when the
 * note/photo URI in storage still matches the URI that was uploaded — if the
 * user replaced the video while the upload was in flight the URIs will differ
 * and the stale remote ID is silently dropped, preventing it from being
 * committed over the replacement.
 */
function applyRemoteIds(stored: Project, uploaded: Project): Project {
  const uploadedNoteMap = new Map<string, Note>(
    (uploaded.notes || []).map((n) => [n.id, n]),
  );

  const notes = (stored.notes || []).map((note) => {
    const up = uploadedNoteMap.get(note.id);
    if (!up) return note;

    let next = note;

    // Audio
    if (up.audioRemoteId && note.audioUri === up.audioUri) {
      next = { ...next, audioRemoteId: up.audioRemoteId };
    }

    // Photos
    if (up.photos && note.photos) {
      const upPhotoMap = new Map<string, Photo>(up.photos.map((p) => [p.id, p]));
      const photos = note.photos.map((p) => {
        const upPhoto = upPhotoMap.get(p.id);
        if (upPhoto?.remoteId && p.uri === upPhoto.uri) {
          return { ...p, remoteId: upPhoto.remoteId };
        }
        // Tapt-merking må også overleve commiten — ellers prøver neste
        // synkrunde det døde bildet på nytt og varselet gjentas evig.
        if (upPhoto?.lost && p.uri === upPhoto.uri && !p.remoteId) {
          return { ...p, lost: true };
        }
        return p;
      });
      next = { ...next, photos };
    }

    // Video — only commit the remote ID if the local URI hasn't been replaced.
    if (up.videoRemoteId && note.videoUri === up.videoUri) {
      next = { ...next, videoRemoteId: up.videoRemoteId };
    }

    return next;
  });

  let next: Project = { ...stored, notes };

  // Project description audio
  if (
    uploaded.projectDescriptionAudioRemoteId &&
    stored.projectDescriptionAudioUri === uploaded.projectDescriptionAudioUri
  ) {
    next = { ...next, projectDescriptionAudioRemoteId: uploaded.projectDescriptionAudioRemoteId };
  }

  return next;
}
export async function pushProject(project: Project): Promise<Project> {
  if (syncDisabled) return project;

  // An explicit flush (for example before creating a test copy) supersedes a
  // pending debounced push of an older snapshot.
  const pendingTimer = pendingPushTimers.get(project.id);
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingPushTimers.delete(project.id);
  pendingProjects.delete(project.id);

  // Serialise all pushes for this project so the latestForPut re-read and the
  // PUT are never interleaved with a concurrent push that writes different
  // remote IDs.  Without this, two pushes running in parallel could each read
  // storage, one PUT with remoteId2, and then the other PUT without it.
  return withPushMutex(project.id, async () => {
    setSyncState('syncing');

    try {
      const freshestProject = (await getProject(project.id)) ?? project;
      const { project: withMedia, changed, failedCount, lostCount, idbUrisToCleanup } = await uploadPendingMedia(freshestProject);
      let toPush = withMedia;

      // Varsle om medier som er varig tapt lokalt (app lukket før synk) —
      // én tydelig beskjed i stedet for evig rød feilstatus.
      if (lostCount > 0) {
        recordLostMedia(project.id, lostCount);
      }

      // Track consecutive push cycles that had media upload failures so we can
      // surface a non-blocking warning to the inspector after the threshold.
      if (failedCount > 0) {
        const prev = consecutiveMediaFailures.get(project.id) ?? 0;
        const next = prev + 1;
        consecutiveMediaFailures.set(project.id, next);
        if (next >= MEDIA_FAILURE_THRESHOLD) {
          setMediaUploadFailures(project.id, next);
        }
      } else {
        consecutiveMediaFailures.delete(project.id);
        clearMediaUploadFailures(project.id);
      }

      if (changed) {
        // Re-read storage before committing remote IDs.  If the user replaced a
        // stalled video while this upload was in flight, the stored note will
        // have a different videoUri.  applyRemoteIds() only copies a remote ID
        // when the URI in storage still matches — so a stale push can never
        // overwrite a replacement the inspector just picked.
        const storedProject = await getProject(project.id);
        const safeProject = storedProject ? applyRemoteIds(storedProject, toPush) : toPush;
        await updateProjectInStorage(safeProject);
        toPush = safeProject;

        // Notify any subscribed UI screens immediately so they can re-render
        // with the new remote IDs (e.g. videoRemoteId → "✓ Uploaded to server")
        // without waiting for the next pull cycle.
        notifyProjectUpdate(toPush);

        // Now that videoRemoteId is durable on this device, it is safe to
        // remove the IndexedDB blobs — if a refresh occurs here the note
        // already has a remoteId and the sync will use the server copy.
        // idbUrisToCleanup contains URIs from the uploaded snapshot; any entry
        // whose note URI changed (replacement picked) is now an orphaned blob
        // and is equally safe to remove.
        for (const idbUri of idbUrisToCleanup) {
          deleteVideoFromIdb(noteIdFromIdbUri(idbUri)).catch(() => {});
        }
      }

      // Re-read storage immediately before the PUT so we always send the
      // freshest authoritative state to the server.  Combined with the mutex,
      // this guarantees no other push can land between this read and the PUT.
      const latestForPut = (await getProject(project.id)) ?? toPush;
      const response = await apiFetch(projectsUrl(`/${encodeURIComponent(project.id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: stripLocalUrisForServer(latestForPut) }),
        skipAuthHandling: true,
      });

      // 404 = backend not yet redeployed with the sync routes — permanent for
      // this session. 503 er derimot forbigående (Render-kaldstart / DB-oppstart)
      // og må IKKE låse synken av; pilotfunn: låsingen ga tom prosjektliste og
      // «Lagret på enheten» helt til testeren trykket manuell synk.
      if (response.status === 404) {
        syncDisabled = true;
        setSyncState('disabled');
        return latestForPut;
      }
      if (response.status === 503) {
        setSyncState('offline');
        return latestForPut;
      }

      if (response.status === 401) {
        // No valid token — show a soft "not configured" indicator, not a red error.
        setSyncState('disabled');
        return latestForPut;
      }

      if (response.status === 413) {
        // PERMANENT: prosjektet er større enn serverens body-tak. Generisk
        // rød status så ut som en forbigående serverfeil — men hver fremtidige
        // push feiler likt, så dette må forklares, ikke bare blinke rødt.
        recordProjectTooLarge(project.id);
        logError(
          new Error(`Project ${project.id} exceeds server payload limit (413)`),
          'push-too-large',
        );
        setSyncState('error');
        return latestForPut;
      }

      if (!response.ok) {
        setSyncState('error');
        return latestForPut;
      }

      // Vellykket push av samme prosjekt rydder et ev. «for stort»-varsel —
      // testeren kan ha slettet innhold så prosjektet kom under taket igjen.
      clearProjectTooLarge(project.id);

      // Serveren svarer 200 med {stale, project} når vår versjon tapte
      // LWW-kampen (f.eks. en enhet med tregere klokke): den rekker sin
      // nyere kopi tilbake nettopp for at vi skal flette — å ignorere den og
      // vise «synket» lot endringene bli liggende kun lokalt til neste pull.
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // tomt/ugyldig svar tolereres — da gjelder vanlig synket-status
      }

      if (body && body.deleted) {
        // Tombstone på serveren er nyere enn vår kopi: prosjektet er slettet
        // på en annen enhet. Neste pullAndMerge fjerner det lokalt via
        // deleted-listen; her skal det bare ikke rapporteres som synket.
        setSyncState('synced');
        return latestForPut;
      }

      if (body && body.stale && body.project) {
        const serverCopy: Project = { ...body.project, id: String(body.project.id) };
        // Tapt-oppdatering-vern: flett mot lagringens FERSKE innhold, ikke mot
        // øyeblikksbildet fra før PUT-en — et notat skrevet mens PUT-en var
        // underveis finnes ellers i ingen av flette-inputene og går tapt.
        const fresh = (await getProject(project.id)) ?? latestForPut;
        const { project: mergedProject } = mergeProjects(fresh, serverCopy);
        await updateProjectInStorage(mergedProject);
        notifyProjectUpdate(mergedProject);
        // Flettingen satte updatedAt = max(lokal, server), så re-pushen
        // passerer serverens LWW-vakt og konvergerer — ingen løkke.
        schedulePush(mergedProject);
        setSyncState('synced');
        return mergedProject;
      }

      setSyncState('synced');
      return latestForPut;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        // Auth failure during fetch — same soft treatment.
        setSyncState('disabled');
      } else {
        setSyncState('offline');
      }
      return project;
    }
  });
}

/**
 * Debounced push: call after every local save.
 */
export function schedulePush(project: Project): void {
  if (syncDisabled) return;

  pendingProjects.set(project.id, project);

  const existing = pendingPushTimers.get(project.id);
  if (existing) clearTimeout(existing);

  pendingPushTimers.set(
    project.id,
    setTimeout(() => {
      pendingPushTimers.delete(project.id);
      const pending = pendingProjects.get(project.id);
      pendingProjects.delete(project.id);
      if (pending) {
        pushProject(pending).catch(() => {});
      }
    }, PUSH_DEBOUNCE_MS),
  );
}

// ---------- DELETE ----------

export async function deleteProjectRemote(id: string): Promise<void> {
  const timer = pendingPushTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    pendingPushTimers.delete(id);
    pendingProjects.delete(id);
  }

  // Record the delete first so a pull can never resurrect this project,
  // even if the server is unreachable right now.
  await addPendingDelete(id);

  if (syncDisabled) return;

  try {
    const response = await apiFetch(projectsUrl(`/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      skipAuthHandling: true,
    });
    if (response.status === 404) {
      syncDisabled = true;
      setSyncState('disabled');
      return;
    }
    if (response.status === 503) {
      // Forbigående (kaldstart) — sletting ligger i pendingDeletes og replayes.
      setSyncState('offline');
      return;
    }
    if (response.ok) {
      await removePendingDelete(id);
    }
  } catch (error) {
    console.warn('[sync] Failed to delete project on server (will retry on next sync)', error);
  }
}

// ---------- PULL & MERGE ----------

type ServerListResponse = {
  projects: Project[];
  deleted: { id: string; deletedAt: string }[];
};

/**
 * Fetch server projects and merge with local (last-write-wins by updatedAt).
 * Local-only projects and locally-newer projects are pushed back to the server.
 * Returns the merged list, or null when the server could not be reached.
 */
export async function pullAndMerge(localProjects: Project[]): Promise<Project[] | null> {
  setSyncState('syncing');

  // Replay deletes that never reached the server before merging, so those
  // projects cannot come back from the pull.
  const pendingDeletes = await getPendingDeletes();
  for (const id of pendingDeletes) {
    await deleteProjectRemote(id);
    if (syncDisabled) break;
  }
  const stillPendingDeletes = new Set(await getPendingDeletes());

  let data: ServerListResponse;
  try {
    const response = await apiFetch(projectsUrl(), {
      method: 'GET',
      skipAuthHandling: true,
    });

    if (response.status === 404) {
      syncDisabled = true;
      setSyncState('disabled');
      return null;
    }

    if (!response.ok) {
      // 401 = no token configured — show soft "saved on device", not a red
      // error. 503 (kaldstart/DB-oppstart) og andre feil er forbigående.
      setSyncState(response.status === 401 ? 'disabled' : 'offline');
      return null;
    }

    data = await response.json();
    syncDisabled = false;
  } catch (error) {
    setSyncState('offline');
    return null;
  }

  // Tapt-oppdatering-vern: flett mot lagringens FERSKE innhold, ikke mot
  // øyeblikksbildet kalleren tok før nettverkskallet. Med Render-kaldstart kan
  // pull-vinduet vare titalls sekunder — et notat skrevet i mellomtiden ble
  // ellers overskrevet når kalleren lagret det flettede resultatet.
  let freshLocal = localProjects;
  try {
    freshLocal = await loadProjects();
  } catch {
    // faller tilbake til kallerens liste — dårligere, men aldri verre enn før
  }

  const serverById = new Map<string, Project>();
  for (const p of data.projects || []) {
    const id = String(p.id);
    if (stillPendingDeletes.has(id)) continue; // deleted locally, replay pending
    serverById.set(id, { ...p, id });
  }

  const deletedAtById = new Map<string, number>();
  for (const tomb of data.deleted || []) {
    deletedAtById.set(String(tomb.id), toTime(tomb.deletedAt));
  }

  const merged: Project[] = [];
  const toPush: Project[] = [];
  const seen = new Set<string>();

  for (const local of freshLocal) {
    const id = String(local.id);
    seen.add(id);

    const deletedAt = deletedAtById.get(id);
    if (deletedAt !== undefined && deletedAt >= toTime(local.updatedAt)) {
      continue; // deleted on another device
    }

    const server = serverById.get(id);
    if (!server) {
      merged.push(local);
      toPush.push(local);
      continue;
    }

    const { project: mergedProject, changed } = mergeProjects(local, server);
    merged.push(mergedProject);
    if (changed) toPush.push(mergedProject);
  }

  for (const [id, server] of serverById) {
    if (!seen.has(id)) merged.push(server);
  }

  setSyncState('synced');

  // Push local-only / locally-newer projects in the background.
  for (const project of toPush) {
    schedulePush(project);
  }

  return merged;
}

function noteTime(note: Note): number {
  return toTime(note.updatedAt) || toTime(note.createdAt);
}

/**
 * Logical content of a note, ignoring its updatedAt stamp and device-local
 * media URIs (which legitimately differ per device). Used to (a) break exact
 * timestamp ties deterministically so both devices converge on the same note,
 * and (b) decide whether a merged note actually differs from the server copy.
 */
function noteLogicalKey(note: Note): string {
  const { updatedAt, audioUri, videoUri, photos, ...rest } = note;
  const normPhotos = (photos || []).map((p) => {
    const { uri, ...pRest } = p;
    return pRest;
  });
  return JSON.stringify({ ...rest, photos: normPhotos });
}

/**
 * When a note survives a merge, keep local file URIs for media that this device
 * already has (they are faster and work offline than re-downloading remotes).
 */
function restoreLocalNoteMedia(winner: Note, local?: Note): Note {
  if (!local) return winner;

  const localPhotos = new Map((local.photos || []).map((p) => [p.id, p]));
  const photos = winner.photos?.map((sp) => {
    const lp = localPhotos.get(sp.id);
    return lp && lp.uri && !sp.uri ? { ...sp, uri: lp.uri } : sp;
  });

  return {
    ...winner,
    audioUri: winner.audioUri || local.audioUri,
    videoUri: winner.videoUri || local.videoUri,
    ...(photos ? { photos } : {}),
  };
}

/**
 * Merge a project that exists on both this device and the server.
 *
 * Notes are merged per-id (union): the newest version of each note (by its
 * updatedAt) wins, notes present on only one side are kept, and a note whose
 * deletion tombstone is newer than its last edit stays deleted. Project-level
 * fields (name, inspector, report, description...) follow whole-project
 * newest-wins. `changed` is true when the merged result differs from the
 * server copy and therefore needs to be pushed back.
 */
export function mergeProjects(
  local: Project,
  server: Project,
): { project: Project; changed: boolean } {
  let changed = false;

  // Merge note tombstones (latest deletion time wins per id).
  const localDel = local.deletedNotes || {};
  const serverDel = server.deletedNotes || {};
  const deletedNotes: Record<string, string> = { ...serverDel };
  for (const [id, t] of Object.entries(localDel)) {
    if (toTime(t) > toTime(deletedNotes[id])) {
      deletedNotes[id] = t;
      if (toTime(t) > toTime(serverDel[id])) changed = true;
    }
  }

  const localNotes = new Map((local.notes || []).map((n) => [n.id, n]));
  const serverNotes = new Map((server.notes || []).map((n) => [n.id, n]));
  const allIds = new Set<string>([...localNotes.keys(), ...serverNotes.keys()]);

  const notes: Note[] = [];
  for (const id of allIds) {
    const ln = localNotes.get(id);
    const sn = serverNotes.get(id);

    let winner: Note;
    if (!sn) {
      winner = ln!;
    } else if (!ln) {
      winner = sn;
    } else {
      const lt = noteTime(ln);
      const st = noteTime(sn);
      if (lt !== st) {
        winner = lt > st ? ln : sn;
      } else if (noteLogicalKey(ln) === noteLogicalKey(sn)) {
        // Same logical content at the same time: keep server, nothing to push.
        winner = sn;
      } else {
        // Exact timestamp tie with differing content: pick deterministically by
        // logical content so both devices converge on the same note.
        winner = noteLogicalKey(ln) > noteLogicalKey(sn) ? ln : sn;
      }
    }

    const delAt = deletedNotes[id];
    if (delAt && toTime(delAt) >= noteTime(winner)) {
      // Deleted after its last edit -> stays deleted everywhere.
      if (sn && toTime(serverDel[id]) < noteTime(sn)) changed = true;
      continue;
    }

    // Push back whenever the surviving note differs from the server copy.
    if (!sn || noteLogicalKey(winner) !== noteLogicalKey(sn)) changed = true;

    notes.push(restoreLocalNoteMedia(winner, ln));
  }

  // Notes are prepended on creation (newest first); preserve that ordering.
  notes.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

  const localNewer = toTime(local.updatedAt) > toTime(server.updatedAt);
  if (localNewer) changed = true;
  const base = localNewer ? local : server;
  const isTestProject =
    base.isTestProject || local.isTestProject || server.isTestProject ? true : undefined;
  const sourceProjectId =
    base.sourceProjectId || local.sourceProjectId || server.sourceProjectId;

  const project: Project = {
    ...base,
    id: server.id,
    notes,
    deletedNotes,
    ...(isTestProject ? { isTestProject: true } : {}),
    ...(sourceProjectId ? { sourceProjectId } : {}),
    updatedAt: new Date(
      Math.max(toTime(local.updatedAt), toTime(server.updatedAt)),
    ).toISOString(),
    projectDescriptionAudioUri:
      base.projectDescriptionAudioUri ||
      local.projectDescriptionAudioUri ||
      server.projectDescriptionAudioUri,
    // Monotone felter overlever hel-dokument-LWW med finnes-vinner: reportDraft
    // er definert som uforanderlig arkiv, reportUrl/caseFile settes én gang og
    // redigeres ikke — en eldre kopi uten dem skal ikke slette dem. Bevisst
    // IKKE reportApproval/reportFinal: ny generering skal nullstille stempelet,
    // og finnes-vinner ville gjenopplivet en tilbaketrukket godkjenning.
    reportDraft: base.reportDraft || local.reportDraft || server.reportDraft,
    reportUrl: base.reportUrl || local.reportUrl || server.reportUrl,
    caseFile: base.caseFile || local.caseFile || server.caseFile,
  };

  // Gjenopprettet et fallback-felt noe serverkopien manglet, må resultatet
  // pushes tilbake — ellers reddes feltet bare lokalt og går tapt på serveren.
  // Referanselikhet er riktig her: fallback-kjeden bevarer objektreferanser.
  if (
    project.reportDraft !== server.reportDraft ||
    project.reportUrl !== server.reportUrl ||
    project.caseFile !== server.caseFile ||
    project.isTestProject !== server.isTestProject ||
    project.sourceProjectId !== server.sourceProjectId
  ) {
    changed = true;
  }

  return { project, changed };
}

/**
 * Manual "Sync now": pushes all local projects immediately, then pulls.
 */
export async function syncNow(localProjects: Project[]): Promise<Project[] | null> {
  if (syncDisabled) {
    // Allow retry after e.g. a backend redeploy.
    syncDisabled = false;
  }

  setSyncState('syncing');

  for (const project of localProjects) {
    await pushProject(project);
    if (syncDisabled) return null;
  }

  return pullAndMerge(localProjects);
}

async function withPushMutex<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  // Chain onto whatever promise is currently holding the lock for this project.
  const current = pushMutex.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const slot = new Promise<void>((r) => { release = r; });
  // Register our slot as the new tail so the next caller chains after us.
  pushMutex.set(projectId, slot);
  try {
    await current; // wait for the previous push to finish
    return await fn();
  } finally {
    release();
    // Clean up the map only when no other push queued behind us.
    if (pushMutex.get(projectId) === slot) {
      pushMutex.delete(projectId);
    }
  }
}
