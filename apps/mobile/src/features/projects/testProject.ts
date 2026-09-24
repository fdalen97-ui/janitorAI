import type { Project } from './types';

/** True when copying now would share device-local media with the source. */
export function hasPendingProjectMedia(project: Project): boolean {
  if (
    project.projectDescriptionAudioUri &&
    !project.projectDescriptionAudioRemoteId
  ) {
    return true;
  }

  return (project.notes || []).some((note) => {
    if (note.audioUri && !note.audioRemoteId) return true;
    if (note.videoUri && !note.videoRemoteId) return true;
    return (note.photos || []).some((photo) => photo.uri && !photo.remoteId);
  });
}

function nextTestProjectName(sourceName: string, projects: Project[]): string {
  const base = `${sourceName} — test`;
  const existingNames = new Set(projects.map((project) => project.name.trim().toLocaleLowerCase()));
  if (!existingNames.has(base.toLocaleLowerCase())) return base;

  let suffix = 2;
  while (existingNames.has(`${base} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

/**
 * Creates an independent project document while deliberately reusing durable
 * media IDs owned by the same tester. Report output is never inherited: every
 * test copy starts ready for a fresh generation.
 */
export function createTestProjectCopy(
  source: Project,
  existingProjects: Project[],
  id: string,
  createdAt = new Date().toISOString(),
): Project {
  if (hasPendingProjectMedia(source)) {
    throw new Error('Source project still has device-local media');
  }

  const cloned: Project = JSON.parse(JSON.stringify(source));
  // The copy reuses only durable server IDs. Never share file://, blob:, or
  // idb:// references: syncing one project may clean up those device-local
  // resources and make the other project's evidence unusable.
  cloned.projectDescriptionAudioUri = undefined;
  cloned.notes = (cloned.notes || []).map((note) => ({
    ...note,
    audioUri: undefined,
    videoUri: undefined,
    photos: (note.photos || []).map((photo) => ({
      ...photo,
      uri: photo.remoteId ? '' : photo.uri,
    })),
  }));
  const {
    report: _report,
    reportUrl: _reportUrl,
    reportStatus: _reportStatus,
    reportApproval: _reportApproval,
    reportDraft: _reportDraft,
    reportFinal: _reportFinal,
    reportError: _reportError,
    reportAttemptId: _reportAttemptId,
    updatedAt: _updatedAt,
    ...inspectionEvidence
  } = cloned;

  return {
    ...inspectionEvidence,
    id,
    name: nextTestProjectName(source.name, existingProjects),
    isTestProject: true,
    sourceProjectId: String(source.id),
    updatedAt: createdAt,
  };
}