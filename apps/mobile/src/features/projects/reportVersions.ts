// A5 — versjonslagring: hjelpere for AI-utkast vs. godkjent rapportversjon.
// Utkastet er uforanderlig; final starter som kopi og redigeres i ferdig
// rapportvisning. Diffen (hvilke felter takstpersonen endret) er både
// UI-signal («endret»-merke) og pilotens kvalitetsmåling av AI-en.

import {
  Project,
  REPORT_CONTENT_FIELDS,
  ReportContent,
  ReportContentField,
} from './types';

/** Motorens analysefelter (snake_case fra Python) → ReportContent. */
export function contentFromAnalysis(analysis: unknown): ReportContent | null {
  if (!analysis || typeof analysis !== 'object') return null;
  const a = analysis as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const content: ReportContent = {
    area: str(a.area),
    source: str(a.source),
    sourceCategory: str(a.source_category),
    cause: str(a.cause),
    acuteOrGradual: str(a.acute_or_gradual),
    description: str(a.description),
    extentDescription: str(a.extent_description),
    repairsDescription: str(a.repairs_description),
    isHabitable: typeof a.is_habitable === 'boolean' ? a.is_habitable : undefined,
  };
  const hasAny = REPORT_CONTENT_FIELDS.some((f) => content[f] !== undefined);
  return hasAny ? content : null;
}

/** Feltene der godkjent versjon avviker fra AI-utkastet. */
export function changedFields(project: Project): ReportContentField[] {
  const draft = project.reportDraft?.content;
  const final = project.reportFinal?.content;
  if (!draft || !final) return [];
  return REPORT_CONTENT_FIELDS.filter(
    (f) => (final[f] ?? '').trim() !== (draft[f] ?? '').trim()
  );
}

/** Innholdet som vises/deles: final når den finnes, ellers utkastet. */
export function effectiveContent(project: Project): ReportContent | null {
  return project.reportFinal?.content ?? project.reportDraft?.content ?? null;
}
