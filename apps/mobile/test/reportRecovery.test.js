// Focused unit coverage for exact-attempt report recovery.
// Run from the repository root:
//   node apps/mobile/test/reportRecovery.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const sourcePath = path.join(
  __dirname,
  "../src/sync/reportRecovery.ts"
);
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const moduleUnderTest = { exports: {} };
const stubRequire = (id) => {
  if (id.includes("/apiFetch")) return async () => ({ ok: false });
  if (id.includes("/config/api")) return { getApiBaseUrl: () => "" };
  if (id.includes("/projects/types")) return {};
  throw new Error(`Unexpected import: ${id}`);
};
new Function("module", "exports", "require", compiled)(
  moduleUnderTest,
  moduleUnderTest.exports,
  stubRequire
);

const { resolveStuckReport } = moduleUnderTest.exports;
const project = {
  id: "test-project",
  name: "Replay",
  inspectionDate: "2026-09-12",
  inspector: "Inspector",
  notes: [],
  isTestProject: true,
  reportStatus: "processing",
  reportAttemptId: "attempt-new",
};

assert.deepStrictEqual(
  resolveStuckReport(project, {
    inFlight: true,
    latest: {
      attemptId: "attempt-new",
      status: "processing",
      createdAt: "2026-09-12T10:00:00.000Z",
      url: null,
      isTestProject: true,
    },
  }),
  { kind: "stillRunning" }
);

assert.deepStrictEqual(
  resolveStuckReport(project, {
    inFlight: false,
    latest: {
      attemptId: "attempt-new",
      status: "processing",
      createdAt: "2026-09-12T10:00:00.000Z",
      url: null,
      isTestProject: true,
    },
  }),
  { kind: "interrupted" }
);

const recovered = resolveStuckReport(project, {
  inFlight: false,
  latest: {
    attemptId: "attempt-new",
    status: "success",
    createdAt: "2026-09-12T10:03:00.000Z",
    url: "https://docs.google.com/document/d/NEW/edit",
    isTestProject: true,
  },
});
assert.strictEqual(recovered.kind, "recovered");
assert.strictEqual(recovered.project.reportUrl, "https://docs.google.com/document/d/NEW/edit");
assert.strictEqual(recovered.project.reportStatus, "ready");
assert.strictEqual(recovered.project.reportAttemptId, undefined);

console.log("reportRecovery: all tests passed");