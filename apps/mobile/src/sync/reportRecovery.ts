// Hovedbok-gjenoppretting: en rapportgenerering kan fullføre på serveren etter
// at appens forespørsel døde (låst mobil, lukket fane, brutt nett i
// 10-minuttersvinduet). Serverens report_generations-hovedbok husker utfallet;
// her spørres den før et «processing»-prosjekt avskrives som avbrutt, så et
// ferdig dokument gjenfinnes i stedet for å regenereres (dobbel kostnad og et
// foreldreløst dokument i Drive).

import apiFetch from '@/src/lib/apiFetch';
import { getApiBaseUrl } from '@/src/config/api';
import { Project } from '@/src/features/projects/types';

export type ReportStatus = {
  inFlight: boolean;
  latest: {
    status: string;
    createdAt: string;
    url: string | null;
    isTestProject: boolean;
    attemptId: string | null;
  } | null;
};

/** null ved nettverksfeil/ukjent svar — kalleren beholder da lokal tilstand. */
export async function fetchReportStatus(
  projectId: string,
  attemptId?: string,
): Promise<ReportStatus | null> {
  try {
    const attemptQuery = attemptId
      ? `?attempt_id=${encodeURIComponent(attemptId)}`
      : '';
    const response = await apiFetch(
      `${getApiBaseUrl()}/report/status/${encodeURIComponent(projectId)}${attemptQuery}`,
    );
    if (!response.ok) return null;
    const data: any = await response.json();
    return {
      inFlight: Boolean(data?.inFlight),
      latest:
        data?.latest && typeof data.latest === 'object'
          ? {
              status: String(data.latest.status ?? ''),
              createdAt: String(data.latest.createdAt ?? ''),
              url: typeof data.latest.url === 'string' ? data.latest.url : null,
              isTestProject: Boolean(data.latest.isTestProject),
              attemptId:
                typeof data.latest.attemptId === 'string' ? data.latest.attemptId : null,
            }
          : null,
    };
  } catch {
    return null;
  }
}

export type RecoveryOutcome =
  | { kind: 'recovered'; project: Project }
  | { kind: 'stillRunning' }
  | { kind: 'interrupted' };

/**
 * Avgjør hva et fastlåst «processing»-prosjekt faktisk er, gitt hovedboka:
 * kjøringen pågår ennå, dokumentet ble ferdig (gjenopprett URL-en), eller
 * forsøket feilet/forsvant (avbrutt — dagens oppførsel).
 */
export function resolveStuckReport(project: Project, status: ReportStatus): RecoveryOutcome {
  if (status.inFlight) return { kind: 'stillRunning' };
  if (status.latest && status.latest.status === 'success' && status.latest.url) {
    const at = new Date().toISOString();
    return {
      kind: 'recovered',
      project: {
        ...project,
        reportUrl: status.latest.url,
        reportStatus: 'ready',
        reportError: undefined,
        reportAttemptId: undefined,
        reportResetAt: null,
        // Gjenfunnet dokument er et nytt AI-utkast brukeren ikke har sett —
        // aldri arv forrige godkjenning. Tomme markører (aldri undefined) så
        // finnes-vinner-flettingen ikke gjenoppliver et eldre utkast under den
        // nye URL-en. Selve utkastinnholdet gikk tapt med det brutte svaret;
        // dokumentet åpnes via URL-en.
        reportApproval: undefined,
        reportDraft: { content: {}, at },
        reportFinal: { content: {}, at },
      },
    };
  }
  return { kind: 'interrupted' };
}
