// db.js – PostgreSQL connection + schema for project persistence
// Enabled only when DATABASE_URL is set (provision a Postgres instance on Render).

const { Pool } = require("pg");

// Prefer RENDER_DATABASE_URL when set (lets the Replit dev environment point
// directly at the Render Postgres DB without touching the runtime-managed
// DATABASE_URL that Replit provisions for its own local database).
// Falls back to DATABASE_URL so production Render deployments keep working.
const DATABASE_URL = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL;

let pool = null;
let initPromise = null;

function isDbEnabled() {
  return Boolean(DATABASE_URL);
}

function needsSsl() {
  if (!DATABASE_URL) return false;
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return true;
  return (
    DATABASE_URL.includes("render.com") ||
    DATABASE_URL.includes("sslmode=require")
  );
}

function getPool() {
  if (!isDbEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      ssl: needsSsl() ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      console.error("Postgres pool error:", err && err.message);
    });
  }
  return pool;
}

// ── Schema ────────────────────────────────────────────────────────────────────
// tester_tokens is created first so the VARCHAR FK-like references are valid.
// All other tables use ADD COLUMN IF NOT EXISTS for safe incremental migration.

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tester_tokens (
  token       VARCHAR   PRIMARY KEY,
  tester_name TEXT,
  email       TEXT,
  is_active   BOOLEAN   NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT      PRIMARY KEY,
  data          JSONB     NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tester_token  VARCHAR,
  report_reset_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deleted_projects (
  id            TEXT      PRIMARY KEY,
  deleted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tester_token  VARCHAR
);

CREATE TABLE IF NOT EXISTS media (
  id            TEXT      PRIMARY KEY,
  project_id    TEXT,
  kind          TEXT,
  mime_type     TEXT,
  original_name TEXT,
  size_bytes    BIGINT,
  file_path     TEXT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_project_id_idx ON media (project_id);

CREATE TABLE IF NOT EXISTS error_logs (
  id            BIGSERIAL   PRIMARY KEY,
  tester_token  VARCHAR,
  error_message TEXT,
  stack_trace   TEXT,
  action_context TEXT,
  device_info   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_actions (
  id            BIGSERIAL   PRIMARY KEY,
  tester_token  VARCHAR,
  action        TEXT        NOT NULL,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx  ON error_logs  (created_at DESC);
CREATE INDEX IF NOT EXISTS user_actions_created_at_idx ON user_actions (created_at DESC);

-- PIN-protected, expiring share links (B10). pin_hash doubles as the HMAC key
-- for stateless view tokens, so no session table is needed.
CREATE TABLE IF NOT EXISTS shares (
  id            VARCHAR     PRIMARY KEY,
  project_id    TEXT        NOT NULL,
  tester_token  VARCHAR     NOT NULL,
  pin_hash      TEXT        NOT NULL,
  pin_salt      TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shares_project_id_idx ON shares (project_id);

-- Pilotinteresse fra salgssiden (/om): navn + e-post, samtykkebasert.
CREATE TABLE IF NOT EXISTS pilot_interesse (
  id          SERIAL      PRIMARY KEY,
  navn        TEXT        NOT NULL,
  epost       TEXT        NOT NULL,
  melding     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cookiefri besøkslogg for de offentlige sidene: kun sti + valgfri kilde,
-- aldri IP eller fingeravtrykk. Bevisst valgt i stedet for Google Analytics
-- (ingen samtykkebanner, ingen tredjepart).
CREATE TABLE IF NOT EXISTS sidevisninger (
  id          SERIAL      PRIMARY KEY,
  sti         TEXT        NOT NULL,
  kilde       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sidevisninger_created_idx ON sidevisninger (created_at DESC);

-- COGS-måling per KI-operasjon: faktisk tokenforbruk og estimert kostnad, så
-- en kredittpris kan settes på reelle tall (se docs/prising-bruksbasert.md).
-- Dette er kostnadssynlighet/analyse — ikke fakturagrunnlag ennå.
CREATE TABLE IF NOT EXISTS cost_events (
  id            BIGSERIAL   PRIMARY KEY,
  tester_token  VARCHAR,
  operation     TEXT        NOT NULL,   -- 'transcribe' | 'describe_image' | 'report'
  model         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  total_tokens  INTEGER,
  est_cost_usd  NUMERIC(12,6),
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cost_events_op_created_idx ON cost_events (operation, created_at DESC);

-- Server-side hovedbok over rapportgenereringer: doc_id skrives her i det
-- motoren svarer, så et generert Google-dokument alltid er oppdagbart selv om
-- klienten aldri rekker å synke reportUrl (dual-write-hullet mot Drive).
CREATE TABLE IF NOT EXISTS report_generations (
  id            BIGSERIAL   PRIMARY KEY,
  tester_token  VARCHAR,
  project_id    TEXT,
  attempt_id    TEXT,
  doc_id        TEXT,
  is_test_project BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT        NOT NULL DEFAULT 'processing', -- processing | success | error
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_generations_tenant_idx ON report_generations (tester_token, project_id, created_at DESC);
-- Kvalitetsmåling (docs/taleteknologi-laerdommer.md): proveniens og sitat-
-- portens telling per kjøring, så «Byggforsk-henvisninger» kan belegges med
-- tall per promptgenerasjon — ikke bare påstås. Alle NULL for eldre rader.
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS prompt_version     TEXT;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS citations_proposed INTEGER;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS citations_verified INTEGER;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS citations_rejected INTEGER;

-- Healing (idempotent): iPhone-video (.mov/.m4v) ble tidligere lagret med
-- mime_type application/octet-stream fordi endelsen ikke var whitelistet —
-- Gemini avviste dermed rapportkjøringer. original_name husker den ekte
-- endelsen, så eksisterende rader repareres her ved boot.
UPDATE media SET mime_type = 'video/quicktime'
  WHERE mime_type = 'application/octet-stream'
    AND (lower(original_name) LIKE '%.mov' OR lower(original_name) LIKE '%.qt' OR lower(original_name) LIKE '%.quicktime');
UPDATE media SET mime_type = 'video/mp4'
  WHERE mime_type = 'application/octet-stream'
    AND lower(original_name) LIKE '%.m4v';

-- Incremental migrations for pre-existing deployments
ALTER TABLE projects        ADD COLUMN IF NOT EXISTS tester_token    VARCHAR;
ALTER TABLE projects        ADD COLUMN IF NOT EXISTS report_reset_at TIMESTAMPTZ;
ALTER TABLE deleted_projects ADD COLUMN IF NOT EXISTS tester_token   VARCHAR;
ALTER TABLE media           ADD COLUMN IF NOT EXISTS tester_token    VARCHAR;
ALTER TABLE media           ADD COLUMN IF NOT EXISTS unreferenced_at TIMESTAMPTZ;
ALTER TABLE media           ADD COLUMN IF NOT EXISTS sha256          TEXT;
ALTER TABLE tester_tokens   ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE user_actions    ADD COLUMN IF NOT EXISTS device_info    JSONB;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS is_test_project BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS attempt_id TEXT;
ALTER TABLE report_generations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS report_generations_attempt_idx
  ON report_generations (tester_token, project_id, attempt_id)
  WHERE attempt_id IS NOT NULL;

-- Replay batches are an admin-only, durable ledger.  Items are created up
-- front, before dispatch, so a process restart cannot discover a different
-- set of source projects or allocate a second copy/attempt id.
CREATE TABLE IF NOT EXISTS replay_batches (
  id            BIGSERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'queued',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS replay_batch_items (
  id                BIGSERIAL PRIMARY KEY,
  batch_id          BIGINT NOT NULL REFERENCES replay_batches(id) ON DELETE CASCADE,
  tester_token      VARCHAR NOT NULL,
  source_project_id  TEXT NOT NULL,
  copy_project_id    TEXT NOT NULL,
  report_attempt_id  TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'pending',
  progress          INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  leased_at         TIMESTAMPTZ,
  lease_until       TIMESTAMPTZ,
  dispatched_at     TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  omitted_lost_attachments INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, tester_token, source_project_id),
  UNIQUE (batch_id, copy_project_id),
  UNIQUE (batch_id, report_attempt_id)
);
-- Explicitly ordered additive migrations for deployments that may have
-- received an early replay schema revision.
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE replay_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS tester_token VARCHAR;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS source_project_id TEXT;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS copy_project_id TEXT;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS report_attempt_id TEXT;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS leased_at TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS copy_deleted_at TIMESTAMPTZ;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS omitted_lost_attachments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE replay_batch_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS replay_batch_items_claim_idx
  ON replay_batch_items (batch_id, state, lease_until, id);
CREATE INDEX IF NOT EXISTS replay_batch_items_source_idx
  ON replay_batch_items (tester_token, source_project_id);

-- Labs: prompt-iteration ledger.  Deliberately separate from
-- report_generations — a Labs run creates no Google Doc, never writes
-- reportDraft/reportFinal, and must not be mistakable for a real report.
CREATE TABLE IF NOT EXISTS ai_test_runs (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id      TEXT NOT NULL,
  tester_token    VARCHAR NOT NULL,
  case_id         TEXT,
  variant_id      TEXT,
  variant_label   TEXT,
  blocks_enabled  JSONB,
  prompt_version  TEXT,
  prompt_sha256   TEXT,
  model           TEXT,
  analysis        JSONB,
  token_usage     JSONB,
  duration_ms     INTEGER,
  score_total     INTEGER,
  score_max       INTEGER,
  score_detail    JSONB,
  manual_override JSONB,
  status          TEXT NOT NULL DEFAULT 'ok',
  error           TEXT,
  note            TEXT
);
CREATE INDEX IF NOT EXISTS ai_test_runs_case_idx
  ON ai_test_runs (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_test_runs_variant_idx
  ON ai_test_runs (variant_id, created_at DESC);

-- Reference data ("fasit") for benchmark scoring.  Loaded from the committed
-- fixture on boot so ground truth stays reviewable in git; the table is a
-- read cache, never the source of truth.
CREATE TABLE IF NOT EXISTS benchmark_cases (
  case_id       TEXT PRIMARY KEY,
  label         TEXT,
  project_id    TEXT,
  provisional   BOOLEAN NOT NULL DEFAULT TRUE,
  reference     JSONB NOT NULL,
  source_note   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL DEFAULT 'fixture'
);
-- 'fixture' rows are owned by apps/api/fixtures/benchmark-cases.json and are
-- overwritten on every boot; 'manual' rows are uploaded through the admin
-- dashboard and boot-loading never touches them. A case_id can only ever be
-- one or the other, so the two sources can never silently clobber each other.
ALTER TABLE benchmark_cases ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'fixture';
`;

// ── Default-token seed + data migration ──────────────────────────────────────
// If TESTER_TOKEN env var is set we always upsert it as an active token so
// existing clients continue to work without any manual DB setup.
// Any existing rows that have no tester_token assigned are claimed by it.

async function seedDefaultToken(p) {
  const envToken = process.env.TESTER_TOKEN;
  if (!envToken) return;

  await p.query(
    `INSERT INTO tester_tokens (token, tester_name, is_active)
     VALUES ($1, 'default', TRUE)
     ON CONFLICT (token) DO UPDATE SET is_active = TRUE`,
    [envToken]
  );

  // Migrate legacy rows that pre-date multi-tenancy
  await p.query(
    `UPDATE projects        SET tester_token = $1 WHERE tester_token IS NULL`,
    [envToken]
  );
  await p.query(
    `UPDATE deleted_projects SET tester_token = $1 WHERE tester_token IS NULL`,
    [envToken]
  );
  await p.query(
    `UPDATE media           SET tester_token = $1 WHERE tester_token IS NULL`,
    [envToken]
  );

  console.log("Tester token seeded/migrated (default)");
}

// ── Public API ────────────────────────────────────────────────────────────────

async function initDb() {
  if (!isDbEnabled()) return false;
  if (!initPromise) {
    initPromise = (async () => {
      const p = getPool();
      await p.query(SCHEMA_SQL);
      console.log("Postgres schema ready");
      await seedDefaultToken(p);
      return true;
    })().catch((err) => {
      console.error("Failed to initialize database schema:", err && err.message);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/**
 * Look up a token in the DB. Returns the token string if valid+active, else null.
 * Safe to call only when isDbEnabled() === true.
 */
/**
 * Look up a token in the DB. Returns { token, email } if valid+active, else null.
 * Safe to call only when isDbEnabled() === true.
 */
async function lookupToken(token) {
  const p = getPool();
  if (!p) return null;
  const result = await p.query(
    "SELECT token, email FROM tester_tokens WHERE token = $1 AND is_active = TRUE",
    [token]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Express middleware: rejects with 503 when persistence is not configured,
 * and ensures the schema exists before handling the request.
 */
function requireDb(req, res, next) {
  if (!isDbEnabled()) {
    return res.status(503).json({
      error:
        "Persistence not configured. Set DATABASE_URL on the server to enable project sync.",
    });
  }
  initDb()
    .then(() => next())
    .catch(() => {
      res.status(503).json({ error: "Database unavailable" });
    });
}

module.exports = { getPool, initDb, isDbEnabled, lookupToken, requireDb };
