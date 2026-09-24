// routes/share.js – PIN-protected, expiring share links for forensic reports
// (backlog B7 + B10, patterned on Wenn's account-free sharing but hardened
// with a PIN gate and expiry).
//
// Auth model:
//   POST   /api/share                → tester token (owner creates a link)
//   DELETE /api/share/:id            → tester token (owner revokes)
//   GET    /api/share/:id/meta       → public (expiry status for the PIN gate)
//   POST   /api/share/:id/unlock     → public + PIN (rate-limited)
//   GET    /api/share/:id/report     → view token from unlock
//   GET    /api/share/:id/media/:mid → view token from unlock (?vt= query,
//                                      media tags cannot set headers)
// The recipient never sees a tester token, and every media id is checked
// against the shared project before it is streamed.

const express = require("express");
const fs = require("fs");
const path = require("path");
const { getPool, requireDb } = require("../db");
const requireTesterToken = require("../middleware/requireTesterToken");
const { applySafeMediaHeaders } = require("../mediaTypes");
const {
  PIN_LENGTH,
  generateShareId,
  generatePin,
  generateSalt,
  hashPin,
  pinMatches,
  createViewToken,
  verifyViewToken,
  isLockedOut,
  registerFailedAttempt,
  clearAttempts,
} = require("../shareUtils");

const router = express.Router();

// S22: alle delings-svar er per-mottaker (PIN / visningstoken) og skal aldri
// caches av nettleser eller mellomledd. Settes FØR requireDb så også 503
// bærer headeren. Media-strømmen (GET /:id/media/:mediaId lenger ned) over-
// styrer bevisst med «private, max-age=3600» — res.set erstatter. Ikke flytt
// den linja.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.use(requireDb);

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 90;

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

async function loadShare(shareId) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, project_id, tester_token, pin_hash, pin_salt, expires_at, revoked FROM shares WHERE id = $1",
    [String(shareId)]
  );
  return result.rows[0] || null;
}

function shareState(share, now = Date.now()) {
  if (!share || share.revoked) return "revoked";
  if (new Date(share.expires_at).getTime() < now) return "expired";
  return "active";
}

// Whitelist the recipient-facing payload: never leak sync bookkeeping,
// local URIs, tester data or tombstones from the raw project JSON.
function buildReportPayload(project, mediaById) {
  const describeMedia = (remoteId, extra = {}) => {
    if (!remoteId) return null;
    const row = mediaById.get(String(remoteId));
    return {
      mediaId: String(remoteId),
      sha256: row?.sha256 || null,
      uploadedAt: row?.created_at || null,
      mimeType: row?.mime_type || null,
      ...extra,
    };
  };

  const notes = (project.notes || []).map((note) => ({
    id: note.id,
    text: note.transcription || note.text || "",
    createdAt: note.createdAt || null,
    audio: describeMedia(note.audioRemoteId),
    video: describeMedia(note.videoRemoteId, {
      geo: note.videoGeo || null,
      capturedAt: note.videoCapturedAt || null,
    }),
    photos: (note.photos || [])
      .filter((p) => p.remoteId)
      .map((p) =>
        describeMedia(p.remoteId, {
          caption: p.caption || "",
          aiGenerated: Boolean(p.aiGenerated),
          geo: p.geo || null,
          capturedAt: p.capturedAt || null,
        })
      ),
  }));

  // A5: mottakeren får den godkjente versjonen (final), og en liste over
  // hvilke felter takstpersonen faglig korrigerte fra AI-utkastet — et
  // tillitssignal, ikke en svakhet.
  const CONTENT_FIELDS = [
    "area", "source", "sourceCategory", "cause", "acuteOrGradual", "description",
    "extentDescription", "repairsDescription",
  ];
  const draftContent = (project.reportDraft && project.reportDraft.content) || null;
  const finalContent = (project.reportFinal && project.reportFinal.content) || draftContent;
  const pickContent = (c) =>
    CONTENT_FIELDS.reduce(
      (acc, f) => (c[f] ? { ...acc, [f]: String(c[f]) } : acc),
      typeof c.isHabitable === "boolean" ? { isHabitable: c.isHabitable } : {}
    );

  return {
    name: project.name || "",
    inspectionDate: project.inspectionDate || null,
    inspector: project.inspector || null,
    description: project.projectDescriptionText || null,
    descriptionTranscription: project.projectDescriptionTranscription || null,
    reportMeta: project.reportMeta || {},
    reportStatus: project.reportStatus || null,
    content: finalContent ? pickContent(finalContent) : null,
    draftChangedFields:
      draftContent && finalContent
        ? CONTENT_FIELDS.filter(
            (f) => String(finalContent[f] || "").trim() !== String(draftContent[f] || "").trim()
          )
        : [],
    approval:
      project.reportApproval && project.reportApproval.approvedAt
        ? {
            approvedBy: String(project.reportApproval.approvedBy || ""),
            approvedAt: project.reportApproval.approvedAt,
          }
        : null,
    notes,
  };
}

// ── Create (owner) ───────────────────────────────────────────────────────────
router.post("/", requireTesterToken, async (req, res) => {
  try {
    const projectId = req.body && req.body.projectId ? String(req.body.projectId) : null;
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const requestedDays = Number(req.body && req.body.expiresInDays);
    const days =
      Number.isFinite(requestedDays) && requestedDays >= 1
        ? Math.min(Math.floor(requestedDays), MAX_EXPIRY_DAYS)
        : DEFAULT_EXPIRY_DAYS;

    const pool = getPool();
    const owned = await pool.query(
      "SELECT data FROM projects WHERE id = $1 AND tester_token = $2",
      [projectId, req.testerToken]
    );
    if (owned.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Godkjenningsport: bare rapporter takstpersonen aktivt har godkjent kan
    // deles — AI-utkast skal aldri nå en mottaker. Håndheves her (ikke bare i
    // appen) så porten holder uansett klient.
    const approval = (owned.rows[0].data || {}).reportApproval;
    if (!approval || !approval.approvedAt) {
      return res
        .status(409)
        .json({ error: "Report not approved", code: "REPORT_NOT_APPROVED" });
    }

    const id = generateShareId();
    const pin = generatePin();
    const salt = generateSalt();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO shares (id, project_id, tester_token, pin_hash, pin_salt, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, projectId, req.testerToken, hashPin(pin, salt), salt, expiresAt.toISOString()]
    );

    // The PIN is returned exactly once and never stored in clear text.
    res.json({
      shareId: id,
      path: `/share/${id}`,
      pin,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/share error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Revoke (owner) ───────────────────────────────────────────────────────────
router.delete("/:id", requireTesterToken, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      "UPDATE shares SET revoked = TRUE WHERE id = $1 AND tester_token = $2",
      [String(req.params.id), req.testerToken]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Share not found" });
    }
    res.json({ revoked: true });
  } catch (err) {
    console.error("DELETE /api/share/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Meta for the PIN gate (public, deliberately minimal) ─────────────────────
router.get("/:id/meta", async (req, res) => {
  try {
    const share = await loadShare(req.params.id);
    const state = shareState(share);
    if (state !== "active") {
      // Same body for missing/revoked/expired so share ids cannot be probed.
      return res.status(410).json({ state: "unavailable" });
    }
    res.json({ state: "active", expiresAt: share.expires_at, pinLength: PIN_LENGTH });
  } catch (err) {
    console.error("GET /api/share/:id/meta error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Unlock with PIN (public, rate-limited) ───────────────────────────────────
router.post("/:id/unlock", async (req, res) => {
  try {
    const shareId = String(req.params.id);
    const share = await loadShare(shareId);
    if (shareState(share) !== "active") {
      return res.status(410).json({ error: "Lenken er utløpt eller trukket tilbake" });
    }

    if (isLockedOut(shareId)) {
      return res.status(429).json({ error: "For mange forsøk — prøv igjen om et kvarter" });
    }

    const pin = req.body && req.body.pin ? String(req.body.pin) : "";
    if (!pinMatches(pin, share.pin_salt, share.pin_hash)) {
      registerFailedAttempt(shareId);
      return res.status(401).json({ error: "Feil PIN-kode" });
    }

    clearAttempts(shareId);
    res.json({ viewToken: createViewToken(share), expiresAt: share.expires_at });
  } catch (err) {
    console.error("POST /api/share/:id/unlock error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── View-token gate for the two read endpoints ───────────────────────────────
async function requireViewToken(req, res, next) {
  try {
    const share = await loadShare(req.params.id);
    if (shareState(share) !== "active") {
      return res.status(410).json({ error: "Lenken er utløpt eller trukket tilbake" });
    }
    const token = req.get("x-view-token") || req.query.vt;
    if (!verifyViewToken(share, token)) {
      return res.status(401).json({ error: "Ugyldig eller utløpt visningsøkt" });
    }
    req.share = share;
    next();
  } catch (err) {
    console.error("share view-token gate error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
}

// ── Report payload (recipient) ───────────────────────────────────────────────
router.get("/:id/report", requireViewToken, async (req, res) => {
  try {
    const pool = getPool();
    const projectResult = await pool.query(
      "SELECT data FROM projects WHERE id = $1 AND tester_token = $2",
      [req.share.project_id, req.share.tester_token]
    );
    if (projectResult.rows.length === 0) {
      return res.status(410).json({ error: "Prosjektet finnes ikke lenger" });
    }

    // Godkjenningsporten gjelder hele lenkens levetid, ikke bare opprettelsen:
    // trekkes godkjenningen (eller nullstilles den av redigering/regenerering),
    // skal en aktiv lenke slutte å servere innhold — invarianten «AI-utkast
    // når aldri en mottaker» håndheves ved lesing, der den faktisk teller.
    const projectData = projectResult.rows[0].data || {};
    const approval = projectData.reportApproval;
    if (!approval || !approval.approvedAt) {
      return res
        .status(410)
        .json({ error: "Rapporten er ikke lenger godkjent for deling" });
    }

    // S3: skoper også på eierens tester_token, så eventuelle rader plantet under
    // prosjektet av en annen tester aldri når mottakeren.
    const mediaResult = await pool.query(
      "SELECT id, sha256, mime_type, created_at FROM media WHERE project_id = $1 AND tester_token = $2",
      [req.share.project_id, req.share.tester_token]
    );
    const mediaById = new Map(mediaResult.rows.map((row) => [String(row.id), row]));

    res.json({
      expiresAt: req.share.expires_at,
      report: buildReportPayload(projectData, mediaById),
    });
  } catch (err) {
    console.error("GET /api/share/:id/report error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── Media streaming (recipient) ──────────────────────────────────────────────
router.get("/:id/media/:mediaId", requireViewToken, async (req, res) => {
  try {
    const pool = getPool();

    // Samme lesetids-port som /report: uten godkjenning streames heller ikke
    // bevismedia til mottakeren (JSONB-oppslaget er indeksert på primærnøkkel).
    const approved = await pool.query(
      `SELECT 1 FROM projects
       WHERE id = $1 AND tester_token = $2
         AND data->'reportApproval'->>'approvedAt' IS NOT NULL`,
      [req.share.project_id, req.share.tester_token]
    );
    if (approved.rows.length === 0) {
      return res
        .status(410)
        .json({ error: "Rapporten er ikke lenger godkjent for deling" });
    }

    const result = await pool.query(
      "SELECT file_path, mime_type FROM media WHERE id = $1 AND project_id = $2 AND tester_token = $3",
      [String(req.params.mediaId), req.share.project_id, req.share.tester_token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const { file_path: filePath, mime_type: mimeType } = result.rows[0];
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing on server" });
    }

    // S7: avledet, whitelistet MIME + nosniff også på mottaker-strømmen.
    applySafeMediaHeaders(res, mimeType);
    res.set("Cache-Control", "private, max-age=3600");
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error("GET /api/share/:id/media error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// Expose the pure payload builder to the unit tests without adding a route or
// changing the public HTTP surface.
router.buildReportPayload = buildReportPayload;
module.exports = router;
