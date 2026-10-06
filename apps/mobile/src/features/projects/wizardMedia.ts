import { Platform } from 'react-native';

import { newId } from '@/src/lib/ids';
import { dataUrlToObjectUrlWeb, downscalePhotoWeb, persistPhotoBytesWeb } from '@/src/lib/photoDownscale';
import { persistMediaLocally } from '@/src/sync/persistMedia';
import { Note, Photo } from './types';

// Samme grenser som foto- og videonotatene på prosjektsiden
// (app/projects/[id].tsx), så veiviseren ikke slipper gjennom noe
// prosjektsiden ville avvist.
export const WIZARD_MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const WIZARD_DOWNSCALE_TRIGGER_BYTES = 4 * 1024 * 1024;
export const WIZARD_MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const WIZARD_MAX_VIDEO_SECONDS = 120;

export type SkippedWizardFile = { name: string; reason: 'for-stor' | 'for-lang' | 'ukjent-type' };

/** Leser videolengden i sekunder i nettleseren, eller null hvis den ikke kan leses. */
function readVideoDurationWeb(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const video = document.createElement('video');
    const done = (value: number | null) => {
      video.removeAttribute('src');
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 10_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    video.src = url;
  });
}

/**
 * Gjør filene fra «Nytt prosjekt»-veiviseren om til vanlige notater:
 * alle bildene i ett bildenotat og hver video i sitt eget videonotat.
 * Bytene lagres i IndexedDB (idb://) som på prosjektsiden, så synken laster
 * dem opp selv om appen lukkes før opplastingen er ferdig.
 *
 * Bare web: veiviseren velger filer med <input type="file">. Uten dette ble
 * filene vist i veiviseren men aldri lagt i prosjektet (UX-revisjon 10.2026).
 */
export async function notesFromWizardFiles(
  files: File[],
): Promise<{ notes: Note[]; skipped: SkippedWizardFile[] }> {
  const notes: Note[] = [];
  const skipped: SkippedWizardFile[] = [];
  if (Platform.OS !== 'web' || files.length === 0) return { notes, skipped };

  const createdAt = new Date().toISOString();
  const photos: Photo[] = [];

  for (const file of files) {
    const objectUrl = URL.createObjectURL(file);

    if (file.type.startsWith('image/')) {
      let uri = objectUrl;
      if (file.size > WIZARD_DOWNSCALE_TRIGGER_BYTES) {
        const downscaled = await downscalePhotoWeb(objectUrl, WIZARD_MAX_PHOTO_BYTES);
        if (downscaled) {
          uri = downscaled;
        } else if (file.size > WIZARD_MAX_PHOTO_BYTES) {
          URL.revokeObjectURL(objectUrl);
          skipped.push({ name: file.name, reason: 'for-stor' });
          continue;
        }
      }
      const photoId = newId();
      const idbUri = await persistPhotoBytesWeb(uri, photoId);
      if (idbUri) {
        uri = idbUri;
      } else if (uri.startsWith('data:')) {
        uri = (await dataUrlToObjectUrlWeb(uri)) ?? uri;
      }
      photos.push({ id: photoId, uri: await persistMediaLocally(uri), caption: '', aiGenerated: false, capturedAt: createdAt });
      continue;
    }

    if (file.type.startsWith('video/')) {
      if (file.size > WIZARD_MAX_VIDEO_BYTES) {
        URL.revokeObjectURL(objectUrl);
        skipped.push({ name: file.name, reason: 'for-stor' });
        continue;
      }
      const seconds = await readVideoDurationWeb(objectUrl);
      if (seconds !== null && seconds > WIZARD_MAX_VIDEO_SECONDS) {
        URL.revokeObjectURL(objectUrl);
        skipped.push({ name: file.name, reason: 'for-lang' });
        continue;
      }
      const noteId = newId();
      notes.push({
        id: noteId,
        text: 'Videonotat (ingen tekst ennå)',
        createdAt,
        videoUri: await persistMediaLocally(objectUrl, noteId),
        videoCapturedAt: createdAt,
      });
      continue;
    }

    URL.revokeObjectURL(objectUrl);
    skipped.push({ name: file.name, reason: 'ukjent-type' });
  }

  if (photos.length > 0) {
    notes.unshift({ id: newId(), text: 'Bildenotat (ingen tekst ennå)', createdAt, photos });
  }
  return { notes, skipped };
}

/** Kort norsk oppsummering av filer som ikke ble lagt til, eller null. */
export function describeSkippedWizardFiles(skipped: SkippedWizardFile[]): string | null {
  if (skipped.length === 0) return null;
  const n = (reason: SkippedWizardFile['reason']) => skipped.filter((s) => s.reason === reason).length;
  const parts = [
    n('for-lang') ? `${n('for-lang')} video over 2 minutter` : '',
    n('for-stor') ? `${n('for-stor')} for store` : '',
    n('ukjent-type') ? `${n('ukjent-type')} som ikke er bilde eller video` : '',
  ].filter(Boolean);
  return `${skipped.length} ${skipped.length === 1 ? 'fil' : 'filer'} ble ikke lagt til: ${parts.join(', ')}.`;
}
