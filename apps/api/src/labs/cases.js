const fs = require("fs");
const path = require("path");

const FIXTURE_PATH = path.join(__dirname, "../../fixtures/benchmark-cases.json");

/**
 * Reads the committed fasit fixture. Ground truth lives in git, not in the
 * database, so a change to it shows up in a diff — a silently edited fasit
 * would invalidate every score recorded before the edit.
 */
function readFixture(fixturePath = FIXTURE_PATH) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(raw);
  const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
  for (const entry of cases) {
    if (!entry.case_id) throw new Error("benchmark fixture: a case is missing case_id");
    if (!entry.reference) throw new Error(`benchmark fixture: ${entry.case_id} is missing reference`);
  }
  return cases;
}

/**
 * Upserts the fixture into benchmark_cases. The table is a read cache for the
 * dashboard; the fixture stays authoritative, so every boot overwrites it.
 */
async function loadBenchmarkCases(pool, fixturePath = FIXTURE_PATH) {
  const cases = readFixture(fixturePath);
  for (const entry of cases) {
    await pool.query(
      `INSERT INTO benchmark_cases (case_id, label, project_id, provisional, reference, source_note, updated_at, source)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now(), 'fixture')
       ON CONFLICT (case_id) DO UPDATE SET
         label = EXCLUDED.label,
         project_id = EXCLUDED.project_id,
         provisional = EXCLUDED.provisional,
         reference = EXCLUDED.reference,
         source_note = EXCLUDED.source_note,
         updated_at = now(),
         source = 'fixture'
       WHERE benchmark_cases.source = 'fixture'`,
      [
        entry.case_id,
        entry.label || entry.case_id,
        entry.project_id || null,
        entry.provisional !== false,
        JSON.stringify(entry.reference),
        entry.source_note || null,
      ]
    );
  }
  return cases.length;
}

async function listBenchmarkCases(pool) {
  const result = await pool.query(
    `SELECT case_id, label, project_id, provisional, reference, source_note, updated_at, source
       FROM benchmark_cases ORDER BY case_id`
  );
  return result.rows;
}

async function getBenchmarkCase(pool, caseId) {
  const result = await pool.query(
    `SELECT case_id, label, project_id, provisional, reference, source_note, updated_at, source
       FROM benchmark_cases WHERE case_id = $1`,
    [String(caseId)]
  );
  return result.rows[0] || null;
}

/**
 * Upserts a case uploaded through the admin dashboard. Refuses to touch a
 * case_id owned by the git fixture ('source' = 'fixture') — that one is only
 * ever edited by committing to apps/api/fixtures/benchmark-cases.json, so a
 * dashboard edit can never be silently overwritten by the next boot's fixture
 * load, and a fixture edit can never be silently overwritten by a stray
 * dashboard upload either.
 */
async function upsertManualCase(pool, { caseId, label, provisional, reference, sourceNote, projectId }) {
  const existing = await getBenchmarkCase(pool, caseId);
  if (existing && existing.source !== "manual") {
    const err = new Error(`"${caseId}" is managed by the fixture file, not the dashboard`);
    err.code = "CASE_IS_FIXTURE_OWNED";
    throw err;
  }
  await pool.query(
    `INSERT INTO benchmark_cases (case_id, label, project_id, provisional, reference, source_note, updated_at, source)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now(), 'manual')
     ON CONFLICT (case_id) DO UPDATE SET
       label = EXCLUDED.label,
       project_id = EXCLUDED.project_id,
       provisional = EXCLUDED.provisional,
       reference = EXCLUDED.reference,
       source_note = EXCLUDED.source_note,
       updated_at = now(),
       source = 'manual'
     WHERE benchmark_cases.source = 'manual'`,
    [
      String(caseId),
      label || String(caseId),
      projectId || null,
      provisional !== false,
      JSON.stringify(reference),
      sourceNote || null,
    ]
  );
  return getBenchmarkCase(pool, caseId);
}

async function deleteManualCase(pool, caseId) {
  const existing = await getBenchmarkCase(pool, caseId);
  if (!existing) return false;
  if (existing.source !== "manual") {
    const err = new Error(`"${caseId}" is managed by the fixture file, not the dashboard`);
    err.code = "CASE_IS_FIXTURE_OWNED";
    throw err;
  }
  await pool.query(`DELETE FROM benchmark_cases WHERE case_id = $1 AND source = 'manual'`, [String(caseId)]);
  return true;
}

module.exports = {
  FIXTURE_PATH,
  readFixture,
  loadBenchmarkCases,
  listBenchmarkCases,
  getBenchmarkCase,
  upsertManualCase,
  deleteManualCase,
};
