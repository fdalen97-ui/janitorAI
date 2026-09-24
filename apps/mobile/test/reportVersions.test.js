// Focused unit coverage for the AI analysis -> report-version contract.
// Run from the repository root:
//   node apps/mobile/test/reportVersions.test.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const sourcePath = path.join(
  __dirname,
  "../src/features/projects/reportVersions.ts"
);
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const moduleUnderTest = { exports: {} };
const reportFields = [
  "area",
  "source",
  "sourceCategory",
  "cause",
  "acuteOrGradual",
  "description",
  "extentDescription",
  "repairsDescription",
];
const stubRequire = (id) => {
  if (id.endsWith("/types")) return { REPORT_CONTENT_FIELDS: reportFields };
  throw new Error(`Unexpected import: ${id}`);
};
new Function("module", "exports", "require", compiled)(
  moduleUnderTest,
  moduleUnderTest.exports,
  stubRequire
);

const { contentFromAnalysis, changedFields, effectiveContent } = moduleUnderTest.exports;

assert.deepStrictEqual(
  contentFromAnalysis({
    area: "Bad",
    source: "Lekkasje ved sluk",
    source_category: "AVLØPSRØR",
    cause: "Skjøt lekker ved bruk",
    acute_or_gradual: "GRADVIS",
    description: "Sporene utviklet seg over tid.",
    extent_description: "Gulv og svill er berørt.",
    repairs_description: "Åpne og tørk konstruksjonen.",
    is_habitable: true,
  }),
  {
    area: "Bad",
    source: "Lekkasje ved sluk",
    sourceCategory: "AVLØPSRØR",
    cause: "Skjøt lekker ved bruk",
    acuteOrGradual: "GRADVIS",
    description: "Sporene utviklet seg over tid.",
    extentDescription: "Gulv og svill er berørt.",
    repairsDescription: "Åpne og tørk konstruksjonen.",
    isHabitable: true,
  }
);

assert.strictEqual(
  contentFromAnalysis({
    source_category: null,
    acute_or_gradual: 42,
    is_habitable: "yes",
  }),
  null,
  "malformed-only structured fields must not create a report version"
);
assert.strictEqual(contentFromAnalysis(undefined), null);

const project = {
  reportDraft: {
    content: {
      sourceCategory: "USIKKER",
      acuteOrGradual: "USIKKER",
      cause: "Mistenkt lekkasje",
    },
    at: "2026-09-12T10:00:00.000Z",
  },
  reportFinal: {
    content: {
      sourceCategory: "AVLØPSRØR",
      acuteOrGradual: "USIKKER",
      cause: "Mistenkt lekkasje",
    },
    at: "2026-09-12T10:01:00.000Z",
  },
};
assert.deepStrictEqual(changedFields(project), ["sourceCategory"]);
assert.deepStrictEqual(effectiveContent(project), project.reportFinal.content);

console.log("reportVersions: all tests passed");