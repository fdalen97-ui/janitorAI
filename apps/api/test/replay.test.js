const test = require("node:test");
const assert = require("node:assert/strict");
const {
  strictGoogleDocUrl,
  cloneProjectData,
  normalizeSelectedProjectIds,
  getReplayProject,
  getBatch,
  deleteReplayProject,
} = require("../src/replay");
const { processItem } = require("../src/replayWorker");
const {
  canResumeExistingAttempt,
  collectRemoteIds,
  selectReportSnapshot,
  selectVideoId,
} = require("../src/reportService");
const { createBatch, scopeDigest } = require("../src/replay");
const projectsRouter = require("../src/routes/projects");
const fs = require("node:fs");

test("only replay workers may resume a processing ledger attempt", () => {
  assert.equal(canResumeExistingAttempt(true, "processing"), true);
  assert.equal(canResumeExistingAttempt(false, "processing"), false);
  assert.equal(canResumeExistingAttempt(true, "success"), false);
});

test("admin dashboard treats queued replay batches as active and pollable", () => {
  const html = fs.readFileSync(
    require.resolve("../src/admin-dashboard.html"), "utf8"
  );
  assert.match(html, /active = \['queued','pending','running','active','processing','in_progress'\]/);
  assert.match(html, /!?\['queued','pending','running','active','processing','in_progress'\]\.includes\(replayStatus\(batch\)\)/);
});

test("report snapshots prefer a newer HTTP override but replay uses persisted data", () => {
  const persisted = { name: "stale", notes: [{ text: "old" }] };
  const newer = { name: "new", notes: [{ text: "fresh" }] };
  assert.equal(selectReportSnapshot(persisted, newer), newer);
  assert.equal(selectReportSnapshot(persisted, null), persisted);
});

test("explicit video filename takes precedence over snapshot video ID", () => {
  const snapshot = { videoRemoteId: "stale-video" };
  assert.equal(selectVideoId(snapshot, "new-video"), "new-video");
  assert.equal(selectVideoId(snapshot, "demo"), "stale-video");
});

test("media ownership candidates include every snapshot ID and explicit video", () => {
  const candidates = collectRemoteIds({
    notes: [{ photos: [{ remoteId: "photo-1" }] }],
    videoRemoteId: "snapshot-video",
  });
  candidates.add("explicit-video");
  assert.deepEqual([...candidates].sort(), ["explicit-video", "photo-1", "snapshot-video"]);
});

test("HTTP report adapter forwards the request project snapshot override", () => {
  const indexSource = fs.readFileSync(
    require.resolve("../src/index.js"), "utf8"
  );
  assert.match(indexSource, /projectOverride:\s*body\.project/);
});

test("batch creation locks the transaction before active-batch discovery", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === "SELECT pg_advisory_xact_lock($1)") return { rows: [] };
      if (sql.includes("FROM replay_batches")) return { rows: [] };
      if (sql.includes("INSERT INTO replay_batches")) {
        return { rows: [{ id: 9, status: "queued", requested_at: new Date() }] };
      }
      if (sql.includes("FROM projects p")) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  await createBatch({ connect: async () => client }, scopeDigest([]));
  assert.equal(calls[0], "BEGIN");
  assert.equal(calls[1], "SELECT pg_advisory_xact_lock($1)");
  assert.match(calls[2], /FROM replay_batches|FROM projects p/);
});

test("replay selection accepts unique IDs and rejects an empty selection", () => {
  assert.deepEqual(normalizeSelectedProjectIds(["a", "a", " b "]), ["a", "b"]);
  assert.throws(() => normalizeSelectedProjectIds([]), {
    code: "REPLAY_SELECTION_INVALID",
  });
  assert.throws(() => normalizeSelectedProjectIds(["", "  "]), {
    code: "REPLAY_SELECTION_INVALID",
  });
});

test("batch creation only inserts the selected projects from the signed preview scope", async () => {
  const calls = [];
  const scopeRows = [
    { source_project_id: "source-a", tester_token: "tenant-a", report_doc_id: "doc-a" },
    { source_project_id: "source-b", tester_token: "tenant-b", report_doc_id: "doc-b" },
  ];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "SELECT pg_advisory_xact_lock($1)") return { rows: [] };
      if (sql.includes("FROM projects p")) return { rows: scopeRows };
      if (sql.includes("FROM replay_batches")) return { rows: [] };
      if (sql.includes("INSERT INTO replay_batches")) {
        return { rows: [{ id: 10, status: "queued", requested_at: new Date() }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };

  await createBatch(
    { connect: async () => client },
    scopeDigest(scopeRows),
    ["source-b"]
  );

  const itemInsert = calls.find((call) => call.sql.includes("INSERT INTO replay_batch_items"));
  assert.ok(itemInsert);
  assert.equal(itemInsert.params[2], "source-b");
  assert.equal(
    calls.filter((call) => call.sql.includes("INSERT INTO replay_batch_items")).length,
    1
  );
});

test("batch creation rejects a project outside the signed preview scope", async () => {
  const scopeRows = [
    { source_project_id: "source-a", tester_token: "tenant-a", report_doc_id: "doc-a" },
  ];
  const client = {
    async query(sql) {
      if (sql === "SELECT pg_advisory_xact_lock($1)") return { rows: [] };
      if (sql.includes("FROM projects p")) return { rows: scopeRows };
      return { rows: [] };
    },
    release() {},
  };

  await assert.rejects(
    createBatch({ connect: async () => client }, scopeDigest(scopeRows), ["not-eligible"]),
    { code: "REPLAY_SELECTION_STALE" }
  );
});

test("replay project inspection returns tenant-safe signed media without tester tokens", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT p.id, p.data")) {
        return {
          rows: [{
            id: "copy-1",
            tester_token: "secret-tenant-token",
            tester_name: "Inspector",
            updated_at: "2026-09-12T10:00:00.000Z",
            data: {
              id: "copy-1",
              name: "Copied inspection",
              isTestProject: true,
              notes: [{ text: "Wall damp", photos: [{ remoteId: "photo-1" }] }],
            },
          }],
        };
      }
      if (sql.includes("SELECT i.batch_id")) {
        return {
          rows: [{
            batch_id: 10,
            source_project_id: "source-1",
            copy_project_id: "copy-1",
            state: "pending",
            progress: 0,
            error: null,
            started_at: null,
            finished_at: null,
            omitted_lost_attachments: 2,
            batch_status: "queued",
            source_data: { name: "Original inspection" },
            copy_data: { name: "Copied inspection" },
          }],
        };
      }
      if (sql.includes("SELECT id, kind, mime_type")) {
        return {
          rows: [{
            id: "photo-1",
            kind: "photo",
            mime_type: "image/jpeg",
            original_name: "wall.jpg",
            size_bytes: 123,
            created_at: "2026-09-12T10:00:00.000Z",
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const result = await getReplayProject(pool, "copy-1", {
    mediaBaseUrl: "https://api.example.test",
  });
  assert.equal(result.role, "replay-copy");
  assert.equal(result.tester, "Inspector");
  assert.equal(result.media[0].url.startsWith("https://api.example.test/api/media/photo-1?"), true);
  assert.equal(JSON.stringify(result).includes("secret-tenant-token"), false);
  assert.equal(result.replay.sourceProjectId, "source-1");
  assert.equal(result.replay.omittedLostAttachments, 2);
  assert.deepEqual(result.replayOmissions, { lostAttachments: 2 });
});

test("replay batch results aggregate omitted lost attachments", async () => {
  const pool = {
    async query(sql) {
      if (sql.startsWith("SELECT * FROM replay_batches")) {
        return { rows: [{ id: 7, status: "completed" }] };
      }
      if (sql.includes("FROM replay_batch_items i")) {
        return {
          rows: [
            {
              id: 1,
              source_project_id: "source-1",
              copy_project_id: "copy-1",
              state: "succeeded",
              progress: 100,
              error: null,
              finished_at: null,
              copy_deleted_at: null,
              omitted_lost_attachments: 2,
              tester_name: "Inspector",
              project_name: "Inspection",
            },
            {
              id: 2,
              source_project_id: "source-2",
              copy_project_id: "copy-2",
              state: "skipped",
              progress: 0,
              error: "media is not owned by tester",
              finished_at: null,
              copy_deleted_at: null,
              omitted_lost_attachments: 0,
              tester_name: "Inspector",
              project_name: "Other inspection",
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const result = await getBatch(pool, 7);

  assert.equal(result.omittedLostAttachments, 2);
  assert.equal(result.counts.omittedLostAttachments, 2);
  assert.equal(result.items[0].omittedLostAttachments, 2);
  assert.equal(result.items[1].omittedLostAttachments, 0);
});

test("replay copy deletion removes only a terminal copy and retains audit history", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM replay_batch_items i")) {
        return {
          rows: [{
            id: 21,
            batch_id: 10,
            tester_token: "tenant-a",
            source_project_id: "source-1",
            copy_project_id: "copy-1",
            state: "succeeded",
            lease_until: null,
            copy_deleted_at: null,
            batch_status: "completed",
          }],
        };
      }
      if (sql.includes("SELECT id, data") && sql.includes("FROM projects")) {
        return {
          rows: [{
            id: "copy-1",
            data: { id: "copy-1", isTestProject: true, sourceProjectId: "source-1" },
          }],
        };
      }
      if (sql.includes("UPDATE replay_batch_items")) {
        return { rows: [{ copy_deleted_at: "2026-09-12T12:00:00.000Z" }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };

  const result = await deleteReplayProject({ connect: async () => client }, "copy-1");

  assert.deepEqual(result, {
    deleted: true,
    projectId: "copy-1",
    batchId: 10,
    copyDeletedAt: "2026-09-12T12:00:00.000Z",
  });
  const projectLock = calls.find((call) => call.sql.includes("SELECT id, data"));
  assert.deepEqual(projectLock.params, ["copy-1", "tenant-a"]);
  assert.ok(calls.some((call) => call.sql.startsWith("DELETE FROM projects")));
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO deleted_projects")));
  assert.ok(calls.some((call) => call.sql.includes("UPDATE media")));
  assert.ok(calls.some((call) => call.sql.includes("copy_deleted_at = now()")));
  assert.equal(calls.some((call) => call.sql.startsWith("DELETE FROM replay_batch_items")), false);
});

test("replay copy deletion protects source projects", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM replay_batch_items i")) {
        return {
          rows: [{
            id: 22,
            batch_id: 11,
            tester_token: "tenant-a",
            source_project_id: "source-1",
            copy_project_id: "copy-2",
            state: "succeeded",
            lease_until: null,
            copy_deleted_at: null,
            batch_status: "completed",
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  };

  await assert.rejects(
    deleteReplayProject({ connect: async () => client }, "source-1"),
    { code: "REPLAY_SOURCE_PROTECTED" }
  );
  assert.equal(calls[0], "BEGIN");
  assert.match(calls[1], /FROM replay_batch_items i/);
  assert.equal(calls[2], "ROLLBACK");
  assert.equal(calls.some((sql) => sql.startsWith("DELETE FROM projects")), false);
});

test("replay copy deletion protects active or leased workers", async () => {
  const client = {
    async query(sql) {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM replay_batch_items i")) {
        return {
          rows: [{
            id: 23,
            batch_id: 12,
            tester_token: "tenant-b",
            source_project_id: "source-2",
            copy_project_id: "copy-3",
            state: "running",
            lease_until: "2026-09-12T12:10:00.000Z",
            copy_deleted_at: null,
            batch_status: "running",
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  };

  await assert.rejects(
    deleteReplayProject({ connect: async () => client }, "copy-3"),
    { code: "REPLAY_PROJECT_ACTIVE" }
  );
});

test("admin replay dashboard requires confirmed deletion and exposes safe copy actions", () => {
  const html = fs.readFileSync(
    require.resolve("../src/admin-dashboard.html"), "utf8"
  );
  assert.match(html, /deleteReplayProject/);
  assert.match(html, /confirmed: true/);
  assert.match(html, /Delete replay copy/);
  assert.match(html, /source project will be kept/);
});

test("strict Google Docs legacy URL validation", () => {
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc_123/edit"), true);
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc_123"), true);
  assert.equal(strictGoogleDocUrl("http://docs.google.com/document/d/abc/edit"), false);
  assert.equal(strictGoogleDocUrl("https://docs.google.com/document/d/abc/export?format=pdf"), false);
  assert.equal(strictGoogleDocUrl("https://evil.example/document/d/abc/edit"), false);
});

test("report reset clears active report state but preserves inspection evidence", () => {
  const source = {
    id: "project-1",
    name: "Inspection",
    notes: [{ id: "note-1", text: "Keep this evidence", photos: [{ remoteId: "photo-1" }] }],
    reportMeta: { customerName: "Customer" },
    reportUrl: "https://docs.google.com/document/d/old/edit",
    reportStatus: "ready",
    reportError: "old error",
    reportAttemptId: "attempt-old",
    reportApproval: { approvedBy: "Inspector", approvedAt: "2026-09-12T10:00:00.000Z" },
    reportDraft: { content: { area: "Kitchen" }, at: "2026-09-12T10:00:00.000Z" },
    reportFinal: { content: { area: "Kitchen" }, at: "2026-09-12T10:00:00.000Z" },
  };

  const reset = projectsRouter.clearActiveReportFields(
    source,
    "2026-09-22T08:00:00.000Z"
  );

  assert.equal(reset.reportUrl, undefined);
  assert.equal(reset.reportStatus, undefined);
  assert.equal(reset.reportError, undefined);
  assert.equal(reset.reportAttemptId, undefined);
  assert.equal(reset.reportApproval, undefined);
  assert.equal(reset.reportDraft, undefined);
  assert.equal(reset.reportFinal, undefined);
  assert.equal(reset.reportResetAt, "2026-09-22T08:00:00.000Z");
  assert.deepEqual(reset.notes, source.notes);
  assert.deepEqual(reset.reportMeta, source.reportMeta);
  assert.equal(source.reportUrl, "https://docs.google.com/document/d/old/edit");
});

test("document tag hides ledger history before reset and reveals newer generations", () => {
  const resetAt = "2026-09-22T08:00:00.000Z";
  const old = projectsRouter.withDocumentTag(
    { id: "project-1", reportResetAt: resetAt },
    {
      successful_doc_id: "old-doc",
      successful_document_created_at: "2026-09-21T10:00:00.000Z",
      report_reset_at: resetAt,
    }
  );
  assert.equal(old.hasSuccessfulDocument, false);
  assert.equal(old.successfulDocumentCreatedAt, null);

  const newer = projectsRouter.withDocumentTag(
    { id: "project-1", reportResetAt: resetAt },
    {
      successful_doc_id: "new-doc",
      successful_document_created_at: "2026-09-22T09:00:00.000Z",
      report_reset_at: resetAt,
    }
  );
  assert.equal(newer.hasSuccessfulDocument, true);
  assert.equal(newer.successfulDocumentCreatedAt, "2026-09-22T09:00:00.000Z");
});

test("clone strips local evidence, keeps owned media, clears report state, and does not mutate source", () => {
  const source = {
    id: "source-1",
    name: "Source",
    reportUrl: "https://docs.google.com/document/d/old/edit",
    reportStatus: "ready",
    reportDraft: { content: { old: true } },
    reportFinal: { content: { old: true } },
    reportApproval: { approvedBy: "someone" },
    notes: [{ photos: [{ uri: "file:///private/photo.jpg", remoteId: "media-1", caption: "durable" }] }],
  };
  const before = JSON.stringify(source);
  const copy = cloneProjectData(source, {
    copyProjectId: "copy-1",
    sourceProjectId: "source-1",
    batchId: 7,
    ownedMediaIds: ["media-1"],
  });
  assert.equal(JSON.stringify(source), before);
  assert.equal(copy.id, "copy-1");
  assert.equal(copy.sourceProjectId, "source-1");
  assert.equal(copy.replayBatchId, "7");
  assert.equal(copy.isTestProject, true);
  assert.equal(copy.reportUrl, undefined);
  assert.equal(copy.reportStatus, undefined);
  assert.equal(copy.notes[0].photos[0].remoteId, "media-1");
  assert.equal(copy.notes[0].photos[0].uri, undefined);
});

test("clone rejects missing and cross-tenant media instead of dropping evidence", () => {
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "file:///x", remoteId: "missing" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "file:///x" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "idb://photo-1" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
  assert.throws(() => cloneProjectData({
    id: "source", notes: [{ photos: [{ uri: "https://temporary.example/photo.jpg" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
});

test("clone omits only explicitly lost photos without durable media", () => {
  const source = {
    id: "source",
    notes: [{
      photos: [
        { uri: "idb://lost-photo", lost: true, caption: "Unavailable original" },
        { uri: "file:///durable-photo", remoteId: "media-1", caption: "Durable photo" },
      ],
    }],
  };
  const before = JSON.stringify(source);
  const copy = cloneProjectData(source, {
    copyProjectId: "copy",
    sourceProjectId: "source",
    batchId: 1,
    ownedMediaIds: ["media-1"],
  });

  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(copy.notes[0].photos, [{
    remoteId: "media-1",
    caption: "Durable photo",
  }]);
  assert.deepEqual(copy.__replayOmissions, { lostAttachments: 1 });
  assert.equal(JSON.stringify(copy).includes("__replayOmissions"), false);
});

test("clone still rejects a lost photo with an unowned durable media ID", () => {
  assert.throws(() => cloneProjectData({
    id: "source",
    notes: [{ photos: [{ uri: "file:///lost", lost: true, remoteId: "foreign-media" }] }],
  }, { copyProjectId: "copy", batchId: 1, ownedMediaIds: [] }), {
    code: "REPLAY_UNREPRESENTABLE_EVIDENCE",
  });
});

function fakePool(source, mediaIds = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT data FROM projects")) return { rows: [{ data: source }] };
      if (sql.startsWith("SELECT id FROM media")) return { rows: mediaIds.map((id) => ({ id })) };
      if (sql.startsWith("SELECT status FROM replay_batches")) return { rows: [{ status: "running" }] };
      return { rows: [], rowCount: 1 };
    },
  };
}

test("worker isolates a failed item and records a durable failure", async () => {
  const pool = fakePool({ id: "source", notes: [] });
  const item = {
    id: 1, batch_id: 4, source_project_id: "source", copy_project_id: "copy",
    report_attempt_id: "attempt", tester_token: "tenant-a",
  };
  await processItem(pool, item, async () => { throw new Error("engine unavailable"); });
  const finish = pool.calls.find((call) => call.sql.includes("SET state=$2"));
  assert.ok(finish);
  assert.equal(finish.params[1], "failed");
  assert.match(finish.params[3], /engine unavailable/);
});

test("worker processes durable evidence when a known-lost photo is present", async () => {
  const pool = fakePool({
    id: "source",
    notes: [{
      photos: [
        { uri: "idb://lost-photo", lost: true, caption: "Unavailable original" },
        { uri: "file:///durable-photo", remoteId: "media-1", caption: "Durable photo" },
      ],
    }],
  }, ["media-1"]);
  const item = {
    id: 2, batch_id: 5, source_project_id: "source", copy_project_id: "copy",
    report_attempt_id: "attempt", tester_token: "tenant-a",
  };
  let generatedFor = null;

  await processItem(pool, item, async (request) => {
    generatedFor = request;
  });

  assert.deepEqual(generatedFor, {
    testerToken: "tenant-a",
    projectId: "copy",
    attemptId: "attempt",
  });
  const insert = pool.calls.find((call) => call.sql.startsWith("INSERT INTO projects"));
  assert.ok(insert);
  const copied = JSON.parse(insert.params[1]);
  assert.deepEqual(copied.notes[0].photos, [{
    remoteId: "media-1",
    caption: "Durable photo",
  }]);
  const omissionUpdate = pool.calls.find((call) =>
    call.sql.includes("omitted_lost_attachments")
  );
  assert.deepEqual(omissionUpdate.params, [2, 1]);
  const finish = pool.calls.find((call) => call.sql.includes("SET state=$2"));
  assert.equal(finish.params[1], "succeeded");
});

test("worker keeps mixed lost and unowned evidence as a skipped error", async () => {
  const pool = fakePool({
    id: "source",
    notes: [{
      photos: [
        { uri: "idb://lost-photo", lost: true },
        { uri: "file:///foreign-photo", lost: true, remoteId: "foreign-media" },
      ],
    }],
  });
  const item = {
    id: 3, batch_id: 6, source_project_id: "source", copy_project_id: "copy",
    report_attempt_id: "attempt", tester_token: "tenant-a",
  };

  await processItem(pool, item, async () => {});

  const finish = pool.calls.find((call) => call.sql.includes("SET state=$2"));
  assert.equal(finish.params[1], "skipped");
  assert.match(finish.params[3], /not owned by tester/);
  assert.equal(
    pool.calls.some((call) => call.sql.includes("omitted_lost_attachments")),
    false
  );
});
