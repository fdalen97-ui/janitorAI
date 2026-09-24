// Focused unit coverage for the reusable test-project copy helper.
// Run from the repository root:
//   node apps/mobile/test/testProject.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const sourcePath = path.join(
  __dirname,
  "../src/features/projects/testProject.ts"
);
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const moduleUnderTest = { exports: {} };
new Function("module", "exports", "require", compiled)(
  moduleUnderTest,
  moduleUnderTest.exports,
  require
);

const {
  createTestProjectCopy,
  hasPendingProjectMedia,
} = moduleUnderTest.exports;

const sourceProject = {
  id: "source-1",
  name: "Furulia 12",
  inspectionDate: "2026-09-12",
  inspector: "Takstperson",
  notes: [
    {
      id: "note-1",
      text: "Fukt ved sluk",
      createdAt: "2026-09-12T08:00:00.000Z",
      transcription: "Synlig fuktskade",
      photos: [
        {
          id: "photo-1",
          uri: "file://source-photo.jpg",
          remoteId: "media-photo-1",
          caption: "Fuktskjold",
        },
      ],
      videoRemoteId: "media-video-1",
      videoUri: "idb://note-1",
    },
  ],
  reportMeta: { caseNumber: "CASE-1" },
  report: "legacy output",
  reportUrl: "https://docs.google.com/document/d/OLD/edit",
  reportStatus: "ready",
  reportApproval: {
    approvedBy: "Takstperson",
    approvedAt: "2026-09-12T09:00:00.000Z",
  },
  reportDraft: { content: { cause: "Old" }, at: "2026-09-12T09:00:00.000Z" },
  reportFinal: { content: { cause: "Edited" }, at: "2026-09-12T09:05:00.000Z" },
  reportError: "old error",
  reportAttemptId: "old-attempt",
  updatedAt: "2026-09-12T09:05:00.000Z",
};

const copy = createTestProjectCopy(
  sourceProject,
  [sourceProject, { ...sourceProject, id: "test-1", name: "Furulia 12 — test" }],
  "test-2",
  "2026-09-12T10:00:00.000Z"
);

assert.strictEqual(copy.id, "test-2");
assert.strictEqual(copy.name, "Furulia 12 — test 2");
assert.strictEqual(copy.isTestProject, true);
assert.strictEqual(copy.sourceProjectId, "source-1");
assert.strictEqual(copy.updatedAt, "2026-09-12T10:00:00.000Z");
assert.strictEqual(copy.notes[0].photos[0].remoteId, "media-photo-1");
assert.strictEqual(copy.notes[0].photos[0].uri, "");
assert.strictEqual(copy.notes[0].videoRemoteId, "media-video-1");
assert.strictEqual(copy.notes[0].videoUri, undefined);
assert.deepStrictEqual(copy.reportMeta, { caseNumber: "CASE-1" });

for (const field of [
  "report",
  "reportUrl",
  "reportStatus",
  "reportApproval",
  "reportDraft",
  "reportFinal",
  "reportError",
  "reportAttemptId",
]) {
  assert.ok(!(field in copy), `${field} must be cleared`);
}

copy.notes[0].text = "Changed only in copy";
copy.reportMeta.caseNumber = "CASE-2";
assert.strictEqual(sourceProject.notes[0].text, "Fukt ved sluk");
assert.strictEqual(sourceProject.reportMeta.caseNumber, "CASE-1");
assert.strictEqual(sourceProject.notes[0].videoUri, "idb://note-1");
assert.strictEqual(sourceProject.notes[0].photos[0].uri, "file://source-photo.jpg");

const pendingSource = JSON.parse(JSON.stringify(sourceProject));
delete pendingSource.notes[0].videoRemoteId;
assert.strictEqual(hasPendingProjectMedia(pendingSource), true);
assert.throws(
  () =>
    createTestProjectCopy(
      pendingSource,
      [pendingSource],
      "unsafe-copy",
      "2026-09-12T10:00:00.000Z"
    ),
  /device-local media/
);

console.log("testProject: all tests passed");