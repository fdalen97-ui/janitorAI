// routes/projects.js – project persistence CRUD (behind tester token + requireDb)
// All queries are strictly scoped to req.testerToken so testers are isolated.

const express = require("express");
const { getPool, requireDb } = require("../db");
const { reconcileAfterUpsert } = require("../mediaCleanup");
const { strictGoogleDocUrl } = require("../replay");
const {
  inFlight: reportGenerationsInFlight,
  REPORT_INFLIGHT_TTL_MS,
} = require("../reportService");

const router = express.Router();

router.use(requireDb);

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

function toIsoOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const ACTIVE_REPORT_FIELDS = [
  "report",
  "reportUrl",
  "reportStatus",
  "reportError",
  "reportAttemptId",
  "reportApproval",
  "reportDraft",
  "reportFinal",
];

function clearActiveReportFields(project, resetAt) {
  const next = { ...(project || {}), reportResetAt: resetAt };
  for (const field of ACTIVE_REPORT_FIELDS) delete next[field];
  return next;
}

// ── List all projects + tombstones for this tester ───────────────────────────
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const token = req.testerToken;

    const [projectsResult, deletedResult] = await Promise.all([
      pool.query(
        `SELECT p.data, p.updated_at, p.report_reset_at,
                rg.doc_id AS successful_doc_id,
                rg.created_at AS successful_document_created_at
           FROM projects p
           LEFT JOIN LATERAL (
             SELECT doc_id, created_at
               FROM report_generations
              WHERE tester_token = p.tester_token AND project_id = p.id
                AND status = 'success' AND doc_id IS NOT NULL
                AND (p.report_reset_at IS NULL OR created_at > p.report_reset_at)
              ORDER BY created_at DESC
              LIMIT 1
           ) rg ON TRUE
          WHERE p.tester_token = $1
          ORDER BY p.updated_at DESC`,
        [token]
      ),
      pool.query(
        "SELECT id, deleted_at FROM deleted_projects WHERE tester_token = $1",
        [token]
      ),
    ]);

    res.json({
      projects: projectsResult.rows.map((row) => ({
        ...withDocumentTag(row.data, row),
        updatedAt: toIsoOrNow(row.data.updatedAt || row.updated_at),
      })),
      deleted: deletedResult.rows.map((row) => ({
        id: row.id,
        deletedAt: row.deleted_at,
      })),
    });
  } catch (err) {
    console.error("GET /api/projects error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Fetch single project (scoped) ────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT p.data, p.updated_at, p.report_reset_at,
              rg.doc_id AS successful_doc_id,
              rg.created_at AS successful_document_created_at
         FROM projects p
         LEFT JOIN LATERAL (
           SELECT doc_id, created_at
             FROM report_generations
            WHERE tester_token = p.tester_token AND project_id = p.id
              AND status = 'success' AND doc_id IS NOT NULL
               AND (p.report_reset_at IS NULL OR created_at > p.report_reset_at)
            ORDER BY created_at DESC
            LIMIT 1
         ) rg ON TRUE
        WHERE p.id = $1 AND p.tester_token = $2`,
      [String(req.params.id), req.testerToken]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ project: withDocumentTag(result.rows[0].data, result.rows[0]) });
  } catch (err) {
    console.error("GET /api/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Reset active report – preserve Google Docs and ledger history ─────────────
router.post("/:id/report/reset", async (req, res) => {
  const id = String(req.params.id);
  const token = req.testerToken;
  const pool = getPool();
  const inFlight = reportGenerationsInFlight.get(`${token}:${id}`);
  if (
    inFlight &&
    Date.now() - inFlight.startedAt < REPORT_INFLIGHT_TTL_MS
  ) {
    return res.status(409).json({
      error: "Report generation already in progress for this project",
      code: "REPORT_IN_PROGRESS",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const projectResult = await client.query(
      `SELECT data
         FROM projects
        WHERE id = $1 AND tester_token = $2
        FOR UPDATE`,
      [id, token]
    );
    if (projectResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    const activeGeneration = await client.query(
      `SELECT 1
         FROM report_generations
        WHERE project_id = $1 AND tester_token = $2
          AND status = 'processing'
          AND updated_at > now() - ($3 * interval '1 millisecond')
        LIMIT 1`,
      [id, token, REPORT_INFLIGHT_TTL_MS]
    );
    if (activeGeneration.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Report generation already in progress for this project",
        code: "REPORT_IN_PROGRESS",
      });
    }

    const resetAt = new Date().toISOString();
    const resetProject = clearActiveReportFields(
      projectResult.rows[0].data,
      resetAt
    );
    await client.query(
      `UPDATE projects
          SET data = $3::jsonb, updated_at = $4, report_reset_at = $4
        WHERE id = $1 AND tester_token = $2`,
      [id, token, JSON.stringify(resetProject), resetAt]
    );
    // Existing links remain auditable as revoked rows, but cannot continue
    // serving the report after the active report has been reset.
    await client.query(
      "UPDATE shares SET revoked = TRUE WHERE project_id = $1 AND tester_token = $2",
      [id, token]
    );
    await client.query("COMMIT");

    res.json({
      project: withDocumentTag(resetProject, {
        successful_doc_id: null,
        successful_document_created_at: null,
        report_reset_at: resetAt,
      }),
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be closed; release in finally still runs.
    }
    console.error("POST /api/projects/:id/report/reset error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── Upsert project – last-write-wins by updatedAt (scoped) ──────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const token = req.testerToken;
    const project = req.body && req.body.project;

    if (!project || typeof project !== "object" || String(project.id) !== id) {
      return res.status(400).json({ error: "Missing or mismatched project" });
    }

    const updatedAt = toIsoOrNow(project.updatedAt);
    const reportResetAt = toIsoOrNull(project.reportResetAt);
    const normalized = reportResetAt
      ? clearActiveReportFields({ ...project, id, updatedAt }, reportResetAt)
      : { ...project, id, updatedAt };
    const pool = getPool();

    // Respect tombstones scoped to this tester only.
    const tombstone = await pool.query(
      "SELECT deleted_at FROM deleted_projects WHERE id = $1 AND tester_token = $2",
      [id, token]
    );
    if (
      tombstone.rows.length > 0 &&
      new Date(tombstone.rows[0].deleted_at) >= new Date(updatedAt)
    ) {
      return res.json({ deleted: true });
    }
    if (tombstone.rows.length > 0) {
      // Project was re-created after deletion: clear this tester's tombstone.
      await pool.query(
        "DELETE FROM deleted_projects WHERE id = $1 AND tester_token = $2",
        [id, token]
      );
    }

    const result = await pool.query(
      `INSERT INTO projects (id, data, updated_at, tester_token, report_reset_at)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
          SET data = CASE
            WHEN projects.report_reset_at IS NOT NULL
              AND EXCLUDED.report_reset_at IS NULL
            THEN (EXCLUDED.data - ARRAY['report','reportUrl','reportStatus',
              'reportError','reportAttemptId','reportApproval','reportDraft',
              'reportFinal']::text[])
              || jsonb_build_object('reportResetAt', projects.report_reset_at::text)
            ELSE EXCLUDED.data
          END,
          updated_at = EXCLUDED.updated_at,
          report_reset_at = COALESCE(EXCLUDED.report_reset_at, projects.report_reset_at)
         WHERE projects.updated_at <= EXCLUDED.updated_at
           AND projects.tester_token = EXCLUDED.tester_token
       RETURNING data`,
      [id, JSON.stringify(normalized), updatedAt, token, reportResetAt]
    );

    if (result.rows.length === 0) {
      // Stored version is newer — return it so the client can merge.
      const current = await pool.query(
        "SELECT data FROM projects WHERE id = $1 AND tester_token = $2",
        [id, token]
      );
      return res.json({
        stale: true,
        project: current.rows.length > 0 ? current.rows[0].data : null,
      });
    }

    reconcileAfterUpsert();
    res.json({ project: result.rows[0].data });
  } catch (err) {
    console.error("PUT /api/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Delete project (tombstoned, scoped) ──────────────────────────────────────
// Én transaksjon rundt de tre skrivingene: et krasj midt i sekvensen kunne
// ellers gi sletting UTEN tombstone — og prosjektet gjenoppstår fra en annen
// enhets kopi ved neste synk. Medier markeres som urefererte i samme transaksjon
// og slettes først etter cleanup-fristen, med en ny referansesjekk.
router.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  const token = req.testerToken;
  const pool = getPool();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM projects WHERE id = $1 AND tester_token = $2",
      [id, token]
    );
    // Never unlink here: a local-first test copy may reference these IDs before
    // its debounced PUT reaches the server. The grace-period sweep rechecks all
    // live project JSON atomically before it removes a row and file.
    await client.query(
      `UPDATE media
       SET unreferenced_at = now()
       WHERE project_id = $1 AND tester_token = $2`,
      [id, token]
    );
    // S14: behold eierens tester_token ved konflikt — en annen tester skal
    // aldri kunne kapre en tombstone via samme id. (Prosjekt-IDer er nå
    // uforutsigbare UUID-er fra klienten, så kryss-tester-kollisjon er uansett
    // praktisk umulig; dette er forsvar i dybden mot den globale primærnøkkelen.)
    await client.query(
      `INSERT INTO deleted_projects (id, deleted_at, tester_token)
       VALUES ($1, now(), $2)
       ON CONFLICT (id) DO UPDATE SET deleted_at = now()
         WHERE deleted_projects.tester_token = EXCLUDED.tester_token`,
      [id, token]
    );

    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // tilkoblingen kan alt være død — release i finally rydder uansett
    }
    console.error("DELETE /api/projects/:id error:", sanitizeError(err));
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }

  reconcileAfterUpsert();
  res.json({ deleted: true });
});

module.exports = router;

// Response-only derived values.  They intentionally overwrite any client
// supplied flags: a stale/mobile-crafted hasSuccessfulDocument must never
// become an authorization or UI truth.
function withDocumentTag(data, row) {
  const project = { ...(data || {}) };
  const resetAt = project.reportResetAt
    ? new Date(project.reportResetAt).getTime()
    : row.report_reset_at
      ? new Date(row.report_reset_at).getTime()
      : 0;
  const ledgerDocument =
    Boolean(row.successful_doc_id) &&
    (!resetAt ||
      new Date(row.successful_document_created_at).getTime() > resetAt);
  const legacyDocument =
    strictGoogleDocUrl(project.reportUrl) && !resetAt;
  project.hasSuccessfulDocument = ledgerDocument || legacyDocument;
  project.successfulDocumentCreatedAt = ledgerDocument
    ? new Date(row.successful_document_created_at).toISOString()
    : legacyDocument
      ? (row.updated_at ? new Date(row.updated_at).toISOString() : null)
      : null;
  return project;
}

router.clearActiveReportFields = clearActiveReportFields;
router.withDocumentTag = withDocumentTag;
