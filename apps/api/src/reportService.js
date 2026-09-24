// Authoritative report generation service shared by HTTP and replay workers.
// No Express objects are accepted here: ownership, project data and tester
// email are resolved from the tenant-scoped database before any media URL is
// signed or external call is made.
const { getPool, isDbEnabled } = require("./db");
const { signedMediaUrl } = require("./mediaSign");
const { recordCost } = require("./costTracking");
const { randomUUID } = require("crypto");

const REPORT_PROXY_TIMEOUT_MS = 10 * 60 * 1000;
const REPORT_MEDIA_URL_TTL_MS = 60 * 60 * 1000;
const REPORT_INFLIGHT_TTL_MS = 15 * 60 * 1000;
const inFlight = new Map();
function canResumeExistingAttempt(resumeExistingAttempt, status) {
  return resumeExistingAttempt === true && status === "processing";
}

function fetchTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function docIdFromUrl(url) {
  const match = String(url || "").match(/\/document\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function findRemoteId(value, predicate) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRemoteId(item, predicate);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (predicate(key.toLowerCase()) && typeof child === "string" && child.trim()) return child;
      const found = findRemoteId(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

function collectRemoteIds(value, requested = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRemoteIds(item, requested));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      if (key.toLowerCase().endsWith("remoteid") && child != null && String(child).trim()) {
        requested.add(String(child));
      }
      collectRemoteIds(child, requested);
    });
  }
  return requested;
}

function selectReportSnapshot(persisted, projectOverride) {
  return projectOverride && typeof projectOverride === "object" && !Array.isArray(projectOverride)
    ? projectOverride
    : (persisted && typeof persisted === "object" ? persisted : {});
}

function selectVideoId(snapshot, videoFilename) {
  if (videoFilename && videoFilename !== "demo") return String(videoFilename);
  return findRemoteId(snapshot, (keyName) =>
    keyName === "videoremoteid" || keyName === "video_remote_id"
  );
}

async function begin(pool, testerToken, projectId, attemptId, testHint, resumeExistingAttempt) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const persisted = projectId
      ? await client.query(
          "SELECT data FROM projects WHERE id=$1 AND tester_token=$2 FOR UPDATE",
          [projectId, testerToken]
        )
      : { rows: [] };
    if (!persisted.rows.length) {
      if (testHint) {
        const err = new Error("Test project must be synced before report generation");
        err.code = "TEST_PROJECT_NOT_SYNCED";
        throw err;
      }
      const err = new Error("Project not found");
      err.code = "PROJECT_NOT_FOUND";
      throw err;
    }
    const source = persisted.rows[0].data || {};
    const isTestProject = source.isTestProject === true;
    const inserted = await client.query(
      `INSERT INTO report_generations
        (tester_token,project_id,attempt_id,doc_id,status,is_test_project)
       VALUES ($1,$2,$3,NULL,'processing',$4)
       ON CONFLICT DO NOTHING RETURNING attempt_id`,
      [testerToken, projectId, attemptId, isTestProject]
    );
    if (inserted.rows.length) {
      // A new attempt starts a new active report session. The reset boundary is
      // retained in the ledger, but no longer masks this attempt from the UI.
      await client.query(
        `UPDATE projects
            SET data = data || jsonb_build_object('reportResetAt', NULL::text),
                report_reset_at = NULL,
                updated_at = now()
          WHERE id = $1 AND tester_token = $2`,
        [projectId, testerToken]
      );
      await client.query("COMMIT");
      return { source, isTestProject, existingDocId: null };
    }
    const prior = await client.query(
      `SELECT doc_id,status,is_test_project FROM report_generations
        WHERE tester_token=$1 AND project_id=$2 AND attempt_id=$3 LIMIT 1`,
      [testerToken, projectId, attemptId]
    );
    const row = prior.rows[0];
    if (row && row.status === "success" && row.doc_id) {
      await client.query("COMMIT");
      return { source, isTestProject: Boolean(row.is_test_project), existingDocId: row.doc_id };
    }
    if (row && (row.status === "error" || row.status === "failed")) {
      await client.query(
        `UPDATE report_generations SET status='processing',doc_id=NULL,updated_at=now()
          WHERE tester_token=$1 AND project_id=$2 AND attempt_id=$3`,
        [testerToken, projectId, attemptId]
      );
      await client.query("COMMIT");
      return { source, isTestProject: Boolean(row.is_test_project), existingDocId: null };
    }
    if (row && canResumeExistingAttempt(resumeExistingAttempt, row.status)) {
      await client.query("COMMIT");
      return { source, isTestProject: Boolean(row.is_test_project), existingDocId: null };
    }
    const err = new Error("Report attempt already exists");
    err.code = "REPORT_ATTEMPT_EXISTS";
    throw err;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function finish(pool, testerToken, projectId, attemptId, docId, status) {
  const result = await pool.query(
    `UPDATE report_generations SET doc_id=$4,status=$5,updated_at=now()
      WHERE tester_token=$1 AND project_id=$2 AND attempt_id=$3`,
    [testerToken, projectId, attemptId, docId || null, status]
  );
  if (result.rowCount !== 1) throw new Error("Report generation ledger row was not updated");
}

function projectContext(source, apiBaseUrl, ownedPhotoIds, testerToken) {
  const rooms = new Map((Array.isArray(source.rooms) ? source.rooms : [])
    .filter((room) => room && room.id && room.name)
    .map((room) => [String(room.id), String(room.name)]));
  const notes = (Array.isArray(source.notes) ? source.notes : []).map((note) => {
    const photos = (Array.isArray(note.photos) ? note.photos : []).map((photo) => {
      if (!photo || !photo.remoteId || !ownedPhotoIds.has(String(photo.remoteId))) return null;
      return {
        uri: signedMediaUrl(apiBaseUrl, String(photo.remoteId), REPORT_MEDIA_URL_TTL_MS),
        ...(photo.caption ? { caption: photo.caption } : {}),
      };
    }).filter(Boolean);
    const result = {};
    if (note.text) result.text = note.text;
    if (note.transcription) result.transcription = note.transcription;
    if (note.roomId && rooms.has(String(note.roomId))) result.room = rooms.get(String(note.roomId));
    if (photos.length) result.photos = photos;
    return result;
  }).filter((note) => Object.keys(note).length);
  const context = {};
  for (const key of ["name", "inspectionDate", "inspector", "projectDescriptionText",
    "projectDescriptionTranscription"]) {
    if (source[key]) context[key] = source[key];
  }
  if (notes.length) context.notes = notes;
  return context;
}

async function generateReport({
  testerToken, projectId, attemptId = randomUUID(), isTestProjectHint = false,
  reportMeta = {}, videoFilename = null, apiBaseUrl,
  requestId = null, resumeExistingAttempt = false, projectOverride = null,
}) {
  if (!isDbEnabled()) {
    const err = new Error("Persistence not configured");
    err.code = "PERSISTENCE_NOT_CONFIGURED";
    throw err;
  }
  const key = `${testerToken}:${projectId || ""}`;
  const old = inFlight.get(key);
  if (old && Date.now() - old.startedAt < REPORT_INFLIGHT_TTL_MS) {
    const err = new Error("Report generation already in progress for this project");
    err.code = "REPORT_IN_PROGRESS";
    throw err;
  }
  const entry = { startedAt: Date.now(), attemptId };
  inFlight.set(key, entry);
  const pool = getPool();
  let started = false;
  let source;
  const record = async (docId, status) => {
    if (!started) return;
    await finish(pool, testerToken, projectId, attemptId, docId, status);
    started = false;
  };
  try {
    const begun = await begin(
      pool,
      testerToken,
      projectId,
      attemptId,
      isTestProjectHint,
      resumeExistingAttempt
    );
    source = selectReportSnapshot(begun.source, projectOverride);
    if (begun.existingDocId) {
      await pool.query(
        `UPDATE projects SET data=data || $3::jsonb,updated_at=now(),
          report_reset_at = NULL
          WHERE id=$1 AND tester_token=$2`,
        [projectId, testerToken, JSON.stringify({
          reportUrl: `https://docs.google.com/document/d/${begun.existingDocId}`,
          reportStatus: "ready", reportError: null, reportAttemptId: attemptId,
          reportResetAt: null,
        })]
      );
      return { status: "success", url: `https://docs.google.com/document/d/${begun.existingDocId}`, analysis: null, idempotent: true };
    }
    started = true;
    const base = apiBaseUrl || process.env.API_BASE_URL;
    if (!base) throw new Error("API_BASE_URL is required for report media");
    const requested = collectRemoteIds(source);
    const explicitVideo = videoFilename && videoFilename !== "demo"
      ? String(videoFilename) : null;
    if (explicitVideo) requested.add(explicitVideo);
    const owned = requested.size
      ? await pool.query("SELECT id FROM media WHERE id=ANY($1) AND tester_token=$2", [[...requested], testerToken])
      : { rows: [] };
    const ownedIds = new Set(owned.rows.map((row) => String(row.id)));
    const requestedVideo = selectVideoId(source, videoFilename);
    if (requestedVideo && !ownedIds.has(requestedVideo)) {
      const err = new Error("Video not found for this tester");
      err.code = "MEDIA_NOT_OWNED";
      throw err;
    }
    const videoUrl = requestedVideo ? signedMediaUrl(base, requestedVideo, REPORT_MEDIA_URL_TTL_MS) : null;
    const context = projectContext(source, base, ownedIds, testerToken);
    const aiUrl = process.env.AI_ENGINE_URL;
    if (!aiUrl) {
      const err = new Error("AI engine not configured");
      err.code = "AI_ENGINE_NOT_CONFIGURED";
      throw err;
    }
    const startedAt = Date.now();
    const response = await fetchTimeout(`${aiUrl}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tester-token": process.env.AI_ENGINE_TOKEN || "",
        ...(requestId ? { "X-Request-Id": requestId } : {}),
      },
      body: JSON.stringify({
        ...(videoUrl ? { video_url: videoUrl } : {}),
        report_meta: Object.keys(reportMeta || {}).length ? reportMeta : (source.reportMeta || {}),
        project: context,
        tester_email: (await pool.query("SELECT email FROM tester_tokens WHERE token=$1", [testerToken])).rows[0]?.email || "",
        report_attempt_id: attemptId,
      }),
    }, REPORT_PROXY_TIMEOUT_MS);
    const data = await response.json();
    const failed = !response.ok || data?.status === "error" || !data?.url;
    if (data?.token_usage) {
      await recordCost({
        testerToken, operation: failed ? "report_failed" : "report",
        model: data.token_usage.model || "gemini-2.5-flash", usage: {
          input: data.token_usage.input_tokens || 0, output: data.token_usage.output_tokens || 0,
          total: data.token_usage.total_tokens || 0,
        }, durationMs: Date.now() - startedAt,
      }).catch(() => {});
    }
    if (failed) {
      await record(data?.doc_id || null, "error");
      await pool.query(
        `UPDATE projects SET data=data || $3::jsonb,updated_at=now()
          ,report_reset_at = NULL
          WHERE id=$1 AND tester_token=$2`,
        [projectId, testerToken, JSON.stringify({
          reportStatus: "failed",
          reportError: String(data?.message || "AI engine error").slice(0, 1000),
          reportAttemptId: attemptId,
          reportResetAt: null,
        })]
      ).catch(() => {});
      const err = new Error(data?.message || "AI engine error");
      err.code = "AI_ENGINE_ERROR";
      throw err;
    }
    const docId = docIdFromUrl(data.url);
    await record(docId, "success");
    const update = {
      reportUrl: data.url, reportStatus: "ready", reportError: null,
      reportAttemptId: attemptId,
      reportResetAt: null,
    };
    const versionAt = new Date().toISOString();
    const versionContent = data.analysis && typeof data.analysis === "object"
      ? data.analysis
      : {};
    update.reportDraft = {
      at: versionAt,
      content: versionContent,
      ...(data.prompt_version ? { promptVersion: data.prompt_version } : {}),
    };
    update.reportFinal = {
      at: versionAt,
      content: { ...versionContent },
      ...(data.prompt_version ? { promptVersion: data.prompt_version } : {}),
    };
    await pool.query(
      `UPDATE projects SET data=data || $3::jsonb,updated_at=now()
          ,report_reset_at = NULL
        WHERE id=$1 AND tester_token=$2`,
      [projectId, testerToken, JSON.stringify(update)]
    );
    return data;
  } catch (error) {
    if (started) {
      try {
        await finish(pool, testerToken, projectId, attemptId, error.doc_id || null, "error");
      } catch (_) {}
      await pool.query(
        `UPDATE projects SET data=data || $3::jsonb,updated_at=now()
          ,report_reset_at = NULL
          WHERE id=$1 AND tester_token=$2`,
        [projectId, testerToken, JSON.stringify({
          reportStatus: "failed", reportError: String(error.message || error).slice(0, 1000),
          reportAttemptId: attemptId,
          reportResetAt: null,
        })]
      ).catch(() => {});
      started = false;
    }
    throw error;
  } finally {
    if (inFlight.get(key) === entry) inFlight.delete(key);
  }
}

module.exports = {
  generateReport,
  inFlight,
  REPORT_PROXY_TIMEOUT_MS,
  REPORT_MEDIA_URL_TTL_MS,
  canResumeExistingAttempt,
  collectRemoteIds,
  projectContext,
  selectReportSnapshot,
  selectVideoId,
};