// mediaCleanup.js – removes media files that are no longer referenced by any
// project, so partial edits (deleted notes/photos, re-recorded audio) don't
// leak files onto the persistent disk forever.
//
// Safety model (two-phase):
//   1. A sweep computes the set of media ids referenced by ANY project JSON.
//      Media not in that set gets `unreferenced_at = now()` (marked). Media
//      that is referenced again gets un-marked. Fresh uploads (< UPLOAD_GRACE)
//      are never marked — they may not be linked to a project yet.
//   2. Media that has stayed marked for longer than the deletion grace period
//      is deleted (row + file). The grace period matters because the per-note
//      merge can make a note (and its media reference) vanish from the server
//      copy temporarily until the device that owns the note re-pushes it.
//
// Whole-project deletion marks its media immediately, then this same guarded
// sweep removes files only after the grace period and a live reference recheck.

const fs = require("fs");
const path = require("path");
const { getPool, initDb, isDbEnabled } = require("./db");
const { checkAndLogDiskUsage } = require("./diskSpace");

const MEDIA_DIR =
  process.env.MEDIA_DIR || path.join(__dirname, "../media-uploads");

// Never mark media uploaded less than this long ago (upload happens before
// the project PUT that links it).
const UPLOAD_GRACE_MS = 60 * 60 * 1000; // 1 hour

// How long media must stay unreferenced before it is deleted.
const DELETE_GRACE_MS =
  Math.max(1, Number(process.env.MEDIA_CLEANUP_GRACE_HOURS) || 72) *
  60 *
  60 *
  1000;

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

/** Collect every media id referenced by a project's JSON. */
function extractMediaIds(projectData, into = new Set()) {
  if (!projectData || typeof projectData !== "object") return into;

  if (projectData.projectDescriptionAudioRemoteId) {
    into.add(String(projectData.projectDescriptionAudioRemoteId));
  }

  const notes = Array.isArray(projectData.notes) ? projectData.notes : [];
  for (const note of notes) {
    if (!note || typeof note !== "object") continue;
    if (note.audioRemoteId) into.add(String(note.audioRemoteId));
    // Video var utelatt her: hver synkede befaringsvideo ble permanent merket
    // ureferert og overlevde kun det defensive LIKE-sikkerhetsnettet ved
    // sletting. Kjernebevis skal telles som referert på lik linje med foto.
    if (note.videoRemoteId) into.add(String(note.videoRemoteId));
    const photos = Array.isArray(note.photos) ? note.photos : [];
    for (const photo of photos) {
      if (photo && photo.remoteId) into.add(String(photo.remoteId));
    }
  }

  return into;
}

/** Media ids referenced by ANY stored project. */
async function getAllReferencedMediaIds(pool) {
  const result = await pool.query("SELECT data FROM projects");
  const referenced = new Set();
  for (const row of result.rows) {
    extractMediaIds(row.data, referenced);
  }
  return referenced;
}

/**
 * One sweep pass: un-mark re-referenced media, mark newly-unreferenced media,
 * and delete media that has been unreferenced for longer than the grace
 * period. Returns counts for logging/verification.
 */
async function sweepOrphanedMedia({
  deleteGraceMs = DELETE_GRACE_MS,
  uploadGraceMs = UPLOAD_GRACE_MS,
} = {}) {
  // Kill-switch for gjenoppretting: etter en DB-restore kan basen bære
  // foreldede unreferenced_at-merker fra før backup-tidspunktet, og første
  // boot-sweep ville slette filer som faktisk er i bruk. Runbook: restore med
  // MEDIA_SWEEP_DISABLED=true, slå på igjen når klientene har synket.
  if (process.env.MEDIA_SWEEP_DISABLED === "true") {
    return null;
  }

  const pool = getPool();
  if (!pool) return null;

  const referenced = [...(await getAllReferencedMediaIds(pool))];

  const unmarked = await pool.query(
    `UPDATE media SET unreferenced_at = NULL
     WHERE unreferenced_at IS NOT NULL AND id = ANY($1)`,
    [referenced]
  );

  const marked = await pool.query(
    `UPDATE media SET unreferenced_at = now()
     WHERE unreferenced_at IS NULL
       AND NOT (id = ANY($1))
       AND created_at < now() - ($2::bigint * interval '1 millisecond')`,
    [referenced, uploadGraceMs]
  );

  // Atomic conditional delete: every predicate is re-validated at delete
  // time, including a live recheck that no project JSON still contains the
  // id (ids are UUIDs, so a substring match cannot produce false negatives;
  // a false positive only postpones deletion, which is safe). This protects
  // against a concurrent PUT re-referencing a file mid-sweep.
  const expired = await pool.query(
    `DELETE FROM media m
     WHERE m.unreferenced_at IS NOT NULL
       AND NOT (m.id = ANY($1))
       AND m.unreferenced_at < now() - ($2::bigint * interval '1 millisecond')
       AND NOT EXISTS (
         SELECT 1 FROM projects p WHERE p.data::text LIKE '%' || m.id || '%'
       )
     RETURNING m.id, m.file_path`,
    [referenced, deleteGraceMs]
  );

  for (const row of expired.rows) {
    fs.unlink(row.file_path, () => {});
  }

  // Katalogskann: filer i MEDIA_DIR uten media-rad. Oppstår ved krasj mellom
  // filskriving og INSERT, eller når rad-sletting lyktes men unlink krasjet —
  // rader uten fil er ufarlige, filer uten rad ryddes her. 24 t frist så en
  // fil aldri fjernes mens dens INSERT fortsatt kan være underveis.
  let orphanFiles = 0;
  try {
    orphanFiles = await sweepOrphanFiles(pool);
  } catch (err) {
    console.error("Media orphan-file sweep error:", sanitizeError(err));
  }

  const counts = {
    referenced: referenced.length,
    unmarked: unmarked.rowCount,
    marked: marked.rowCount,
    deleted: expired.rows.length,
    orphanFiles,
  };
  if (counts.marked || counts.deleted || counts.unmarked || counts.orphanFiles) {
    console.log(
      `Media sweep: ${counts.deleted} deleted, ${counts.marked} newly unreferenced, ${counts.unmarked} re-referenced, ${counts.orphanFiles} orphan files removed (${counts.referenced} referenced in total)`
    );
  }
  return counts;
}

const ORPHAN_FILE_GRACE_MS = 24 * 60 * 60 * 1000;

/** Slett filer i MEDIA_DIR (eldre enn fristen) som ingen media-rad peker på. */
async function sweepOrphanFiles(pool) {
  let entries;
  try {
    entries = await fs.promises.readdir(MEDIA_DIR);
  } catch {
    return 0; // katalogen finnes ikke ennå — ingenting å rydde
  }

  const candidates = [];
  const now = Date.now();
  for (const name of entries) {
    const fullPath = path.join(MEDIA_DIR, name);
    let stat;
    try {
      stat = await fs.promises.stat(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (now - stat.mtimeMs < ORPHAN_FILE_GRACE_MS) continue;
    // Filnavnet er `${id}${ext}` fra opplastingen — id-en er basename uten ext.
    candidates.push({ id: path.basename(name, path.extname(name)), fullPath });
  }
  if (candidates.length === 0) return 0;

  // Fornuftsgulv: svarer basen «tom» eller «kjenner nesten ingenting» mens
  // katalogen er full, er det mest sannsynlig basen som er gal (feil
  // DATABASE_URL, fersk restore) — da skal skannet stå over og rope, ikke
  // slette hele mediekatalogen.
  const totalRows = await pool.query("SELECT count(*)::int AS n FROM media");
  const totalMediaRows = totalRows.rows[0].n;
  if (totalMediaRows === 0) {
    console.error(
      `Media orphan-file sweep SKIPPED: media table is empty while ${candidates.length} candidate file(s) exist in MEDIA_DIR — refusing to delete (wrong DB / fresh restore?)`
    );
    return 0;
  }

  const known = await pool.query("SELECT id FROM media WHERE id = ANY($1)", [
    candidates.map((c) => c.id),
  ]);
  const knownIds = new Set(known.rows.map((r) => String(r.id)));
  const unmatched = candidates.filter((c) => !knownIds.has(c.id));

  if (unmatched.length >= 10 && unmatched.length > candidates.length / 2) {
    console.error(
      `Media orphan-file sweep SKIPPED: ${unmatched.length}/${candidates.length} files unmatched by media table — refusing bulk delete (wrong DB / fresh restore?)`
    );
    return 0;
  }

  let deleted = 0;
  for (const c of unmatched) {
    try {
      await fs.promises.unlink(c.fullPath);
      deleted++;
    } catch {
      // best effort — neste sweep prøver igjen
    }
  }
  return deleted;
}

/**
 * Fire-and-forget reconciliation after a project upsert: promptly un-marks
 * media the new copy references and marks media nothing references anymore
 * (deletion still waits for the grace period via the sweep).
 */
function reconcileAfterUpsert() {
  sweepOrphanedMedia().catch((err) => {
    console.error("Media reconcile error:", sanitizeError(err));
  });
}

/**
 * Run a sweep on boot and every SWEEP_INTERVAL_MS thereafter. Each run also
 * checks free space on the media disk and logs a prominent warning when
 * usage crosses the warn/critical thresholds (see diskSpace.js).
 */
function startMediaSweepScheduler() {
  const checkDisk = () =>
    checkAndLogDiskUsage(MEDIA_DIR).catch((err) => {
      console.error("Media disk check error:", sanitizeError(err));
    });

  const run = () => {
    checkDisk();
    if (!isDbEnabled()) return;
    initDb()
      .then(() => sweepOrphanedMedia())
      .catch((err) => {
        console.error("Media sweep error:", sanitizeError(err));
      });
  };

  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  extractMediaIds,
  sweepOrphanedMedia,
  reconcileAfterUpsert,
  startMediaSweepScheduler,
};
