const { getPool } = require("../db");
const { signedMediaUrl } = require("../mediaSign");
const {
  collectRemoteIds,
  projectContext,
  selectVideoId,
  REPORT_MEDIA_URL_TTL_MS,
} = require("../reportService");
const { getBenchmarkCase } = require("./cases");
const { scoreRun } = require("./score");

// Doc-free analysis is far cheaper than a full report, but it is still a Gemini
// call over video and photos — keep the same order of magnitude as the report
// proxy timeout rather than a short API default.
const ANALYZE_TIMEOUT_MS = 10 * 60 * 1000;

function fetchTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function fail(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Loads a project by id and returns it with the tester_token that owns it.
 * The token is read from the row, never accepted from the caller, and is
 * stripped from anything returned to the client — the same discipline
 * getReplayProject() follows.
 */
async function loadProject(pool, projectId) {
  const result = await pool.query(
    "SELECT id, data, tester_token FROM projects WHERE id = $1",
    [String(projectId)]
  );
  if (!result.rows.length) throw fail("Project not found", "LABS_PROJECT_NOT_FOUND", 404);
  const row = result.rows[0];
  return { projectId: row.id, data: row.data || {}, testerToken: row.tester_token };
}

/**
 * Signs media the tester actually owns, mirroring the production report path so
 * the model sees the same evidence it would see in a real run.
 */
async function buildEnginePayload(pool, project, apiBaseUrl) {
  const candidates = collectRemoteIds(project.data);
  let ownedIds = new Set();
  if (candidates.length) {
    const owned = await pool.query(
      "SELECT id FROM media WHERE id = ANY($1) AND tester_token = $2",
      [candidates, project.testerToken]
    );
    ownedIds = new Set(owned.rows.map((r) => String(r.id)));
  }

  const context = projectContext(project.data, apiBaseUrl, ownedIds, project.testerToken);
  const videoId = selectVideoId(project.data);
  const videoUrl =
    videoId && ownedIds.has(String(videoId))
      ? signedMediaUrl(apiBaseUrl, String(videoId), REPORT_MEDIA_URL_TTL_MS)
      : null;

  const photoCount = (context.notes || []).reduce(
    (sum, note) => sum + ((note.photos || []).length),
    0
  );

  return {
    project: context,
    reportMeta: project.data.reportMeta || {},
    videoUrl,
    photoCount,
  };
}

/**
 * Runs one doc-free analysis and records it.
 *
 * Deliberately does NOT touch report_generations, does not merge
 * reportDraft/reportFinal into projects.data, and does not create a Google Doc.
 * A Labs run is an experiment, not a report, and must never be mistakable for
 * one — which also keeps the approval gate untouched by construction.
 */
async function runLabsAnalysis({
  projectId,
  blocks = null,
  caseId = null,
  variantId = null,
  variantLabel = null,
  note = null,
  apiBaseUrl,
}) {
  const pool = getPool();
  const aiUrl = process.env.AI_ENGINE_URL;
  if (!aiUrl) throw fail("AI engine is not configured", "AI_ENGINE_NOT_CONFIGURED", 503);

  const project = await loadProject(pool, projectId);
  const payload = await buildEnginePayload(pool, project, apiBaseUrl);
  const benchmark = caseId ? await getBenchmarkCase(pool, caseId) : null;

  const startedAt = Date.now();
  let engineBody = null;
  let requestError = null;

  try {
    const response = await fetchTimeout(
      `${aiUrl}/api/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tester-token": process.env.AI_ENGINE_TOKEN || "",
        },
        body: JSON.stringify({
          video_url: payload.videoUrl || undefined,
          report_meta: payload.reportMeta,
          project: payload.project,
          blocks,
          include_prompt: true,
        }),
      },
      ANALYZE_TIMEOUT_MS
    );
    engineBody = await response.json().catch(() => null);
    if (!response.ok) {
      requestError = `AI engine returned ${response.status}`;
    }
  } catch (err) {
    requestError = err && err.message ? err.message : String(err);
  }

  const durationMs = Date.now() - startedAt;
  const failed = Boolean(requestError) || !engineBody || engineBody.status === "error";
  const analysis = failed ? null : engineBody.analysis || null;

  const score =
    analysis && benchmark
      ? scoreRun(
          analysis,
          { ...benchmark.reference, provisional: benchmark.provisional },
          { photoCount: payload.photoCount }
        )
      : null;

  const inserted = await pool.query(
    `INSERT INTO ai_test_runs (
       project_id, tester_token, case_id, variant_id, variant_label,
       blocks_enabled, prompt_version, prompt_sha256, model,
       analysis, token_usage, duration_ms,
       score_total, score_max, score_detail, status, error, note
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15::jsonb,$16,$17,$18)
     RETURNING id, created_at`,
    [
      project.projectId,
      project.testerToken,
      caseId,
      variantId,
      variantLabel,
      JSON.stringify(engineBody?.blocks_enabled ?? blocks ?? null),
      engineBody?.prompt_version ?? null,
      engineBody?.prompt_sha256 ?? null,
      engineBody?.model ?? null,
      analysis ? JSON.stringify(analysis) : null,
      engineBody?.token_usage ? JSON.stringify(engineBody.token_usage) : null,
      durationMs,
      score ? score.total : null,
      score ? score.max : null,
      score ? JSON.stringify(score.detail) : null,
      failed ? "error" : "ok",
      failed ? String(requestError || engineBody?.message || "Unknown engine error").slice(0, 2000) : null,
      note,
    ]
  );

  return {
    id: inserted.rows[0].id,
    createdAt: inserted.rows[0].created_at,
    status: failed ? "error" : "ok",
    error: failed ? String(requestError || engineBody?.message || "Unknown engine error") : null,
    projectId: project.projectId,
    caseId,
    variantId,
    variantLabel,
    blocksEnabled: engineBody?.blocks_enabled ?? blocks ?? null,
    promptVersion: engineBody?.prompt_version ?? null,
    promptSha256: engineBody?.prompt_sha256 ?? null,
    model: engineBody?.model ?? null,
    analysis,
    tokenUsage: engineBody?.token_usage ?? null,
    resolvedPrompt: engineBody?.resolved_prompt ?? null,
    durationMs,
    score,
    photoCount: payload.photoCount,
  };
}

function runRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    projectId: row.project_id,
    caseId: row.case_id,
    variantId: row.variant_id,
    variantLabel: row.variant_label,
    blocksEnabled: row.blocks_enabled,
    promptVersion: row.prompt_version,
    promptSha256: row.prompt_sha256,
    model: row.model,
    analysis: row.analysis,
    tokenUsage: row.token_usage,
    durationMs: row.duration_ms,
    scoreTotal: row.score_total,
    scoreMax: row.score_max,
    scoreDetail: row.score_detail,
    manualOverride: row.manual_override,
    status: row.status,
    error: row.error,
    note: row.note,
    // tester_token is intentionally absent — it is a credential, not metadata.
  };
}

async function listRuns(pool, { caseId = null, variantId = null, limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (caseId) {
    params.push(String(caseId));
    clauses.push(`case_id = $${params.length}`);
  }
  if (variantId) {
    params.push(String(variantId));
    clauses.push(`variant_id = $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM ai_test_runs ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params
  );
  return result.rows.map(runRow);
}

async function getRun(pool, id) {
  const result = await pool.query("SELECT * FROM ai_test_runs WHERE id = $1", [Number(id)]);
  return result.rows.length ? runRow(result.rows[0]) : null;
}

/**
 * Applies a manual override to one run and rescores from the stored analysis,
 * so a corrected heuristic call is reflected in the total without losing what
 * the scorer originally decided (kept per dimension as auto_points).
 */
async function overrideScore(pool, id, override) {
  const existing = await pool.query(
    "SELECT project_id, case_id, analysis, manual_override FROM ai_test_runs WHERE id = $1",
    [Number(id)]
  );
  if (!existing.rows.length) throw fail("Run not found", "LABS_RUN_NOT_FOUND", 404);
  const row = existing.rows[0];
  if (!row.case_id) throw fail("Run has no benchmark case to score against", "LABS_RUN_UNSCORED", 400);

  const benchmark = await getBenchmarkCase(pool, row.case_id);
  if (!benchmark) throw fail("Benchmark case no longer exists", "LABS_CASE_MISSING", 404);

  const merged = { ...(row.manual_override || {}), ...override };
  const score = scoreRun(
    row.analysis,
    { ...benchmark.reference, provisional: benchmark.provisional },
    {},
    merged
  );

  await pool.query(
    `UPDATE ai_test_runs
        SET manual_override = $2::jsonb, score_total = $3, score_max = $4, score_detail = $5::jsonb
      WHERE id = $1`,
    [Number(id), JSON.stringify(merged), score.total, score.max, JSON.stringify(score.detail)]
  );

  return getRun(pool, id);
}

module.exports = {
  ANALYZE_TIMEOUT_MS,
  buildEnginePayload,
  getRun,
  listRuns,
  loadProject,
  overrideScore,
  runLabsAnalysis,
  runRow,
};
