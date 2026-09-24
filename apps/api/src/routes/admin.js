// routes/admin.js – token provisioning / revocation for admins.
// Protected by x-admin-secret header checked against ADMIN_SECRET env var.
// Mount BEFORE the global requireTesterToken guard in index.js.

const express = require("express");
const crypto = require("crypto");
const { getPool, requireDb } = require("../db");
const {
  preview: replayPreview,
  createBatch: createReplayBatch,
  getBatch: getReplayBatch,
  getReplayProject,
  deleteReplayProject,
} = require("../replay");
const { reconcileAfterUpsert } = require("../mediaCleanup");
const { listBenchmarkCases, upsertManualCase, deleteManualCase } = require("../labs/cases");
const { runLabsAnalysis, listRuns, getRun, overrideScore } = require("../labs/runner");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// Timing-sikker strengsammenligning (S11): unngår at responstid lekker hvor
// mange tegn av hemmeligheten som stemmer.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── Admin secret guard ────────────────────────────────────────────────────────
function requireAdminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "ADMIN_SECRET not configured on server" });
  }
  const provided = req.headers["x-admin-secret"];
  if (typeof provided !== "string" || !safeEqual(provided, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdminSecret);
router.use(requireDb);

// ── Replay batches ───────────────────────────────────────────────────────────
// These endpoints intentionally expose tester names/masked labels only.  A
// replay is an operational action, so confirmation is explicit and repeated
// starts are idempotent while a batch is active.
router.get("/replay/preview", async (req, res) => {
  try {
    res.json(await replayPreview(getPool()));
  } catch (err) {
    console.error("GET /api/admin/replay/preview error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/replay/projects/:id", async (req, res) => {
  try {
    const configuredBase = process.env.API_BASE_URL;
    const requestBase = `${req.protocol}://${req.get("host")}`;
    const project = await getReplayProject(getPool(), req.params.id, {
      mediaBaseUrl: (configuredBase || requestBase).replace(/\/$/, ""),
    });
    if (!project) return res.status(404).json({ error: "Replay project not found" });
    res.json({ project });
  } catch (err) {
    console.error("GET /api/admin/replay/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/replay/projects/:id", async (req, res) => {
  if (!req.body || req.body.confirmed !== true) {
    return res.status(400).json({ error: "confirmed:true is required" });
  }
  try {
    const result = await deleteReplayProject(getPool(), req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Replay copy not found" });
    }
    reconcileAfterUpsert();
    res.json(result);
  } catch (err) {
    if (err && [
      "REPLAY_SOURCE_PROTECTED",
      "REPLAY_PROJECT_ACTIVE",
      "REPLAY_PROJECT_NOT_COPY",
    ].includes(err.code)) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    console.error("DELETE /api/admin/replay/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/replay/batches", async (req, res) => {
  if (!req.body || req.body.confirmed !== true) {
    return res.status(400).json({ error: "confirmed:true is required" });
  }
  try {
    if (typeof req.body.previewId !== "string" || !req.body.previewId) {
      return res.status(400).json({ error: "previewId is required" });
    }
    const batch = await createReplayBatch(
      getPool(),
      req.body.previewId,
      req.body.projectIds
    );
    res.status(batch.existing ? 200 : 201).json({ batch });
  } catch (err) {
    if (err && ["REPLAY_PREVIEW_STALE", "REPLAY_SELECTION_STALE"].includes(err.code)) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    if (err && err.code === "REPLAY_SELECTION_INVALID") {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error("POST /api/admin/replay/batches error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/replay/batches/latest", async (req, res) => {
  try {
    const result = await getPool().query(
      "SELECT id FROM replay_batches ORDER BY id DESC LIMIT 1"
    );
    if (!result.rows.length) return res.status(404).json({ error: "No replay batches" });
    res.json({ batch: await getReplayBatch(getPool(), result.rows[0].id) });
  } catch (err) {
    console.error("GET latest replay batch error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/replay/batches/:id", async (req, res) => {
  try {
    const batch = await getReplayBatch(getPool(), req.params.id);
    if (!batch) return res.status(404).json({ error: "Replay batch not found" });
    res.json({ batch });
  } catch (err) {
    console.error("GET replay batch error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/replay/batches/:id/resume", async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT status FROM replay_batches WHERE id=$1 FOR UPDATE",
      [req.params.id]
    );
    if (!current.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Replay batch not found" });
    }
    if (current.rows[0].status === "cancelled" && req.body?.confirmed !== true) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Cancelled batches require confirmed:true to resume undispatched items",
        code: "REPLAY_RESUME_CONFIRMATION_REQUIRED",
      });
    }
    const result = await client.query(
      `UPDATE replay_batches
          SET status='queued', updated_at=now(), finished_at=NULL, cancelled_at=NULL
        WHERE id=$1 AND status <> 'completed'
      RETURNING id, status`,
      [req.params.id]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Completed replay batches cannot be resumed" });
    }
    // Cancelled rows were never dispatched. Failed/skipped rows are explicit
    // admin retries. A running row is reclaimed only after its durable lease
    // expires; an immediate cancel/resume must not duplicate live work.
    await client.query(
      `UPDATE replay_batch_items
          SET state='pending', leased_at=NULL, lease_until=NULL, updated_at=now()
        WHERE batch_id=$1
          AND (
            state IN ('failed','skipped','cancelled')
            OR (state='running' AND lease_until < now())
          )`,
      [req.params.id]
    );
    await client.query("COMMIT");
    res.json({ batch: await getReplayBatch(pool, req.params.id) });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("POST replay resume error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

router.post("/replay/batches/:id/cancel", async (req, res) => {
  try {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const batch = await client.query(
        `UPDATE replay_batches
            SET status='cancelled', cancelled_at=now(), finished_at=now(), updated_at=now()
          WHERE id=$1 AND status NOT IN ('completed','cancelled')
        RETURNING id`,
        [req.params.id]
      );
      if (!batch.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Replay batch not found or already terminal" });
      }
      await client.query(
        `UPDATE replay_batch_items SET state='cancelled', finished_at=now(), updated_at=now()
          WHERE batch_id=$1 AND state='pending'`,
        [req.params.id]
      );
      await client.query("COMMIT");
      res.json({ batch: await getReplayBatch(getPool(), req.params.id) });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST replay cancel error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/admin/tokens – provision a new tester token ────────────────────
router.post("/tokens", async (req, res) => {
  const { token, tester_name, email } = req.body || {};

  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ error: "token is required" });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO tester_tokens (token, tester_name, email, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (token) DO UPDATE
         SET tester_name = EXCLUDED.tester_name, email = EXCLUDED.email, is_active = TRUE
       RETURNING token, tester_name, email, is_active, created_at`,
      [token.trim(), tester_name ? String(tester_name).trim() : null, email ? String(email).trim() : null]
    );
    res.status(201).json({ token: result.rows[0] });
  } catch (err) {
    console.error("POST /api/admin/tokens error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/admin/tokens/:token – revoke a tester token ──────────────────
router.delete("/tokens/:token", async (req, res) => {
  const token = String(req.params.token);

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tester_tokens SET is_active = FALSE WHERE token = $1 RETURNING token, tester_name`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Token not found" });
    }
    res.json({ revoked: true, token: result.rows[0] });
  } catch (err) {
    console.error("DELETE /api/admin/tokens/:token error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/tokens – list all tokens (handy when on vacation) ──────────
router.get("/tokens", async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT token, tester_name, email, is_active, created_at FROM tester_tokens ORDER BY created_at DESC"
    );
    res.json({ tokens: result.rows });
  } catch (err) {
    console.error("GET /api/admin/tokens error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/cost – COGS-aggregat per operasjon ────────────────────────
// Grunnlaget for å sette en kredittpris (docs/prising-bruksbasert.md): faktisk
// tokenforbruk og estimert kostnad per operasjonstype. ?days=N (standard 30).
router.get("/cost", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         operation,
         COUNT(*)::int                             AS antall,
         ROUND(AVG(input_tokens))::int             AS snitt_input_tokens,
         ROUND(AVG(output_tokens))::int            AS snitt_output_tokens,
         ROUND(AVG(total_tokens))::int             AS snitt_total_tokens,
         (percentile_cont(0.95) WITHIN GROUP (ORDER BY total_tokens))::int AS p95_total_tokens,
         MAX(total_tokens)::int                    AS maks_total_tokens,
         ROUND(AVG(est_cost_usd)::numeric, 6)      AS snitt_kostnad_usd,
         ROUND(SUM(est_cost_usd)::numeric, 4)      AS sum_kostnad_usd,
         ROUND(AVG(duration_ms))::int              AS snitt_ms
       FROM cost_events
       WHERE created_at >= now() - ($1 || ' days')::interval
       GROUP BY operation
       ORDER BY sum_kostnad_usd DESC NULLS LAST`,
      [String(days)]
    );
    // Overslagsregningen (docs/overslag-pilotokonomi.md) selvbetjent: fordeling
    // per tester/uke (er forbruket jevnt eller drevet av én?) og tapt kostnad
    // på feilede rapportkjøringer (betalte tokens uten leveranse).
    const perTester = await pool.query(
      `SELECT COALESCE(t.tester_name, LEFT(c.tester_token, 8) || '…') AS tester,
              date_trunc('week', c.created_at)::date AS uke,
              COUNT(*)::int                          AS antall,
              ROUND(SUM(c.est_cost_usd)::numeric, 4) AS sum_kostnad_usd
       FROM cost_events c
       LEFT JOIN tester_tokens t ON t.token = c.tester_token
       WHERE c.created_at >= now() - ($1 || ' days')::interval
       GROUP BY 1, 2
       ORDER BY uke DESC, sum_kostnad_usd DESC NULLS LAST`,
      [String(days)]
    );
    const rapportSvinn = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE operation = 'report')::int        AS rapporter_ok,
              COUNT(*) FILTER (WHERE operation = 'report_failed')::int AS rapporter_feilet,
              ROUND(COALESCE(SUM(est_cost_usd) FILTER (WHERE operation = 'report_failed'), 0)::numeric, 4) AS tapt_kostnad_usd
       FROM cost_events
       WHERE created_at >= now() - ($1 || ' days')::interval`,
      [String(days)]
    );

    res.json({
      windowDays: days,
      note: "Kostnad er ESTIMAT (verifiser priser mot Google før kredittpris settes).",
      operations: result.rows,
      perTester: perTester.rows,
      rapportSvinn: rapportSvinn.rows[0],
    });
  } catch (err) {
    console.error("GET /api/admin/cost error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/logs – 200 most recent errors + actions ───────────────────
router.get("/logs", async (req, res) => {
  try {
    const pool = getPool();

    const [errResult, actResult] = await Promise.all([
      pool.query(
        `SELECT id, tester_token, error_message, stack_trace, action_context, device_info, created_at
         FROM error_logs
         ORDER BY created_at DESC
         LIMIT 200`
      ),
      pool.query(
        `SELECT id, tester_token, action, duration_ms, created_at
         FROM user_actions
         ORDER BY created_at DESC
         LIMIT 200`
      ),
    ]);

    res.json({
      errors: errResult.rows,
      actions: actResult.rows,
    });
  } catch (err) {
    console.error("GET /api/admin/logs error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Labs: prompt iteration ───────────────────────────────────────────────────
// Doc-free test runs against stored cases, scored against committed reference
// data. Shares this router's admin-secret guard. None of these endpoints touch
// report_generations, projects.data or Google Docs — a Labs run is an
// experiment, never a report.

function labsStatus(err) {
  return err && Number.isInteger(err.status) ? err.status : 500;
}

router.get("/labs/blocks", async (req, res) => {
  const aiUrl = process.env.AI_ENGINE_URL;
  if (!aiUrl) {
    return res.status(503).json({ error: "AI engine is not configured" });
  }
  try {
    const response = await fetch(`${aiUrl}/api/prompt/blocks`, {
      headers: { "x-tester-token": process.env.AI_ENGINE_TOKEN || "" },
    });
    if (!response.ok) {
      return res.status(502).json({ error: `AI engine returned ${response.status}` });
    }
    res.json(await response.json());
  } catch (err) {
    console.error("GET /api/admin/labs/blocks error:", sanitizeError(err));
    res.status(502).json({ error: "Could not reach AI engine" });
  }
});

router.get("/labs/cases", async (req, res) => {
  try {
    const pool = getPool();
    const cases = await listBenchmarkCases(pool);
    // Replay copies are as valid a test subject as their source, so both are
    // offered; tester_token never leaves the server.
    const projects = await pool.query(
      `SELECT p.id,
              p.data->>'name' AS project_name,
              p.data->>'inspectionDate' AS inspection_date,
              (p.data->>'isTestProject' = 'true') AS is_test_project,
              p.updated_at,
              t.tester_name
         FROM projects p
         LEFT JOIN tester_tokens t ON t.token = p.tester_token
        WHERE p.tester_token IS NOT NULL
        ORDER BY p.updated_at DESC
        LIMIT 200`
    );
    res.json({
      cases: cases.map((c) => ({
        caseId: c.case_id,
        label: c.label,
        projectId: c.project_id,
        provisional: c.provisional,
        sourceNote: c.source_note,
        reference: c.reference,
        source: c.source,
      })),
      projects: projects.rows.map((row) => ({
        projectId: row.id,
        projectName: row.project_name,
        inspectionDate: row.inspection_date,
        isTestProject: row.is_test_project,
        tester: row.tester_name,
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/labs/cases error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// Upload a reference case through the dashboard, without touching git. Only
// ever creates or edits a 'manual' case — a case_id already owned by the
// fixture file is refused (409), so a dashboard upload can never clobber the
// committed fasit, and the next boot's fixture load can never clobber a
// dashboard upload. See labs/cases.js#upsertManualCase.
router.put("/labs/cases/:caseId", async (req, res) => {
  const caseId = String(req.params.caseId || "").trim();
  const body = req.body || {};
  if (!caseId) {
    return res.status(400).json({ error: "caseId is required" });
  }
  if (!body.reference || typeof body.reference !== "object" || Array.isArray(body.reference)) {
    return res.status(400).json({ error: "reference must be an object" });
  }
  try {
    const saved = await upsertManualCase(getPool(), {
      caseId,
      label: body.label ? String(body.label).slice(0, 300) : null,
      provisional: body.provisional !== false,
      reference: body.reference,
      sourceNote: body.sourceNote ? String(body.sourceNote).slice(0, 2000) : null,
      projectId: body.projectId ? String(body.projectId) : null,
    });
    res.status(200).json({
      case: {
        caseId: saved.case_id,
        label: saved.label,
        projectId: saved.project_id,
        provisional: saved.provisional,
        sourceNote: saved.source_note,
        reference: saved.reference,
        source: saved.source,
      },
    });
  } catch (err) {
    if (err && err.code === "CASE_IS_FIXTURE_OWNED") {
      return res.status(409).json({ error: sanitizeError(err), code: err.code });
    }
    console.error("PUT /api/admin/labs/cases/:caseId error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/labs/cases/:caseId", async (req, res) => {
  const caseId = String(req.params.caseId || "").trim();
  try {
    const deleted = await deleteManualCase(getPool(), caseId);
    if (!deleted) return res.status(404).json({ error: "Case not found" });
    res.status(204).end();
  } catch (err) {
    if (err && err.code === "CASE_IS_FIXTURE_OWNED") {
      return res.status(409).json({ error: sanitizeError(err), code: err.code });
    }
    console.error("DELETE /api/admin/labs/cases/:caseId error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/labs/runs", async (req, res) => {
  const body = req.body || {};
  if (!body.projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }
  if (body.blocks != null && !Array.isArray(body.blocks)) {
    return res.status(400).json({ error: "blocks must be an array of block ids, or omitted" });
  }
  try {
    const run = await runLabsAnalysis({
      projectId: body.projectId,
      blocks: body.blocks == null ? null : body.blocks.map(String),
      caseId: body.caseId ? String(body.caseId) : null,
      variantId: body.variantId ? String(body.variantId) : null,
      variantLabel: body.variantLabel ? String(body.variantLabel) : null,
      note: body.note ? String(body.note).slice(0, 2000) : null,
      apiBaseUrl:
        process.env.API_BASE_URL ||
        `${req.protocol}://${req.get("host")}`,
    });
    res.status(201).json({ run });
  } catch (err) {
    console.error("POST /api/admin/labs/runs error:", sanitizeError(err));
    res.status(labsStatus(err)).json({ error: sanitizeError(err), code: err && err.code });
  }
});

router.get("/labs/runs", async (req, res) => {
  try {
    const runs = await listRuns(getPool(), {
      caseId: req.query.caseId || null,
      variantId: req.query.variantId || null,
      limit: req.query.limit,
    });
    res.json({ runs });
  } catch (err) {
    console.error("GET /api/admin/labs/runs error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/labs/runs/:id", async (req, res) => {
  try {
    const run = await getRun(getPool(), req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json({ run });
  } catch (err) {
    console.error("GET /api/admin/labs/runs/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/labs/runs/:id/score", async (req, res) => {
  const override = (req.body || {}).override;
  if (!override || typeof override !== "object") {
    return res.status(400).json({ error: "override object is required" });
  }
  try {
    const run = await overrideScore(getPool(), req.params.id, override);
    res.json({ run });
  } catch (err) {
    console.error("PATCH /api/admin/labs/runs/:id/score error:", sanitizeError(err));
    res.status(labsStatus(err)).json({ error: sanitizeError(err), code: err && err.code });
  }
});

module.exports = router;
