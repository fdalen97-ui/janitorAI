// Single-process durable replay worker.  Claims are transactional and leases
// make a crash safe: a later process can reclaim an item after its lease.
const { cloneProjectData, TERMINAL_ITEM_STATES } = require("./replay");

// Must exceed REPORT_PROXY_TIMEOUT_MS (10 minutes) with room for cleanup and
// ledger writes; a second worker must never reclaim a healthy long report.
const LEASE_MS = 20 * 60 * 1000;
const POLL_MS = 1000;

function collectRemoteIds(value, result = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRemoteIds(entry, result));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if ((key.toLowerCase() === "remoteid" || key.toLowerCase().endsWith("remoteid")) &&
          child != null && String(child).trim()) result.add(String(child));
      collectRemoteIds(child, result);
    }
  }
  return result;
}

async function claim(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT i.*, b.status AS batch_status
         FROM replay_batch_items i
         JOIN replay_batches b ON b.id=i.batch_id
        WHERE b.status IN ('queued','running')
          AND (i.state='pending' OR (i.state='running' AND i.lease_until < now()))
        ORDER BY i.id
        FOR UPDATE OF i SKIP LOCKED LIMIT 1`
    );
    if (!result.rows.length) {
      await client.query("COMMIT");
      return null;
    }
    const item = result.rows[0];
    const updated = await client.query(
      `UPDATE replay_batch_items
          SET state='running', progress=5, leased_at=now(),
              lease_until=now() + ($2 || ' milliseconds')::interval,
              started_at=COALESCE(started_at, now()), updated_at=now()
        WHERE id=$1 RETURNING *`,
      [item.id, String(LEASE_MS)]
    );
    await client.query(
      `UPDATE replay_batches SET status='running', started_at=COALESCE(started_at,now()),
          updated_at=now() WHERE id=$1 AND status='queued'`,
      [item.batch_id]
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function finish(pool, item, state, error = null) {
  await pool.query(
    `UPDATE replay_batch_items
        SET state=$2, progress=$3, error=$4, finished_at=now(),
            lease_until=NULL, updated_at=now()
      WHERE id=$1`,
    [item.id, state, state === "succeeded" ? 100 : 0, error ? String(error).slice(0, 2000) : null]
  );
  // A cancelled batch wins over a late worker completion.  Otherwise derive
  // the batch state exclusively from durable item states.
  await pool.query(
    `UPDATE replay_batches b
        SET status = CASE
          WHEN b.status='cancelled' THEN 'cancelled'
          WHEN NOT EXISTS (SELECT 1 FROM replay_batch_items i WHERE i.batch_id=b.id
                           AND i.state NOT IN ('succeeded','failed','skipped','cancelled'))
            AND NOT EXISTS (SELECT 1 FROM replay_batch_items i WHERE i.batch_id=b.id
                            AND i.state IN ('failed','skipped')) THEN 'completed'
          WHEN NOT EXISTS (SELECT 1 FROM replay_batch_items i WHERE i.batch_id=b.id
                           AND i.state NOT IN ('succeeded','failed','skipped','cancelled')) THEN 'failed'
          ELSE b.status END,
          finished_at = CASE WHEN b.status='cancelled' OR
            NOT EXISTS (SELECT 1 FROM replay_batch_items i WHERE i.batch_id=b.id
                       AND i.state NOT IN ('succeeded','failed','skipped','cancelled'))
            THEN COALESCE(b.finished_at, now()) ELSE b.finished_at END,
          updated_at=now()
      WHERE b.id=$1`,
    [item.batch_id]
  );
}

/**
 * Process one claimed item. generateReport is deliberately injected: the API
 * supplies its normal report service, while unit tests can provide a pure
 * function without Google or Postgres.
 */
async function processItem(pool, item, generateReport) {
  try {
    const sourceResult = await pool.query(
      "SELECT data FROM projects WHERE id=$1 AND tester_token=$2",
      [item.source_project_id, item.tester_token]
    );
    if (!sourceResult.rows.length) throw new Error("source project no longer exists");
    const ids = [...collectRemoteIds(sourceResult.rows[0].data)];
    const media = ids.length
      ? await pool.query("SELECT id FROM media WHERE tester_token=$1 AND id=ANY($2)", [item.tester_token, ids])
      : { rows: [] };
    const copied = cloneProjectData(sourceResult.rows[0].data, {
      copyProjectId: item.copy_project_id,
      batchId: item.batch_id,
      sourceProjectId: item.source_project_id,
      ownedMediaIds: media.rows.map((row) => row.id),
    });
    await pool.query(
      `INSERT INTO projects (id,data,updated_at,tester_token) VALUES ($1,$2::jsonb,now(),$3)
       ON CONFLICT (id) DO NOTHING`,
      [item.copy_project_id, JSON.stringify(copied), item.tester_token]
    );
    await pool.query(
      `UPDATE replay_batch_items
          SET omitted_lost_attachments=$2, progress=25, updated_at=now()
        WHERE id=$1`,
      [item.id, Number(copied.__replayOmissions?.lostAttachments) || 0]
    );
    const batch = await pool.query(
      "SELECT status FROM replay_batches WHERE id=$1",
      [item.batch_id]
    );
    if (!batch.rows.length || batch.rows[0].status === "cancelled") {
      await finish(pool, item, "cancelled");
      return;
    }
    if (typeof generateReport !== "function") {
      throw new Error("replay report generation service is not configured");
    }
    // Invoke first, then persist the dispatch marker while the external
    // operation is actually in flight.  A crash before this line leaves the
    // item safely retryable without claiming it was dispatched.
    const generation = generateReport({
      testerToken: item.tester_token,
      projectId: item.copy_project_id,
      attemptId: item.report_attempt_id,
    });
    await pool.query(
      "UPDATE replay_batch_items SET dispatched_at=COALESCE(dispatched_at,now()), updated_at=now() WHERE id=$1",
      [item.id]
    );
    await generation;
    await finish(pool, item, "succeeded");
  } catch (error) {
    await finish(pool, item, error.code === "REPLAY_UNREPRESENTABLE_EVIDENCE" ? "skipped" : "failed", error.message);
  }
}

function startReplayWorker({ pool, generateReport }) {
  if (!pool) return () => {};
  let stopped = false;
  let active = false;
  const tick = async () => {
    if (stopped || active) return;
    active = true;
    try {
      const item = await claim(pool);
      if (item) await processItem(pool, item, generateReport);
    } catch (error) {
      console.error("Replay worker error:", error && error.message);
    } finally {
      active = false;
    }
  };
  const timer = setInterval(tick, POLL_MS);
  tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

module.exports = { collectRemoteIds, claim, processItem, startReplayWorker };