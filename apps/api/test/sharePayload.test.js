// Focused unit coverage for the recipient-facing report whitelist.
// Run from the repository root:
//   node apps/api/test/sharePayload.test.js

const assert = require("assert");
const shareRouter = require("../src/routes/share");

const buildReportPayload = shareRouter.buildReportPayload;
assert.strictEqual(typeof buildReportPayload, "function");

const payload = buildReportPayload(
  {
    name: "Test project",
    inspectionDate: "2026-09-12",
    inspector: "Inspector",
    notes: [],
    reportDraft: {
      content: {
        sourceCategory: "USIKKER",
        acuteOrGradual: "USIKKER",
        source: "Fukt ved sluk",
        secretInternalField: "must not leak",
      },
    },
    reportFinal: {
      content: {
        sourceCategory: "AVLØPSRØR",
        acuteOrGradual: "GRADVIS",
        source: "Lekkasje ved bruk",
        isHabitable: false,
        secretInternalField: "must not leak",
      },
    },
  },
  new Map()
);

assert.deepStrictEqual(payload.content, {
  sourceCategory: "AVLØPSRØR",
  acuteOrGradual: "GRADVIS",
  source: "Lekkasje ved bruk",
  isHabitable: false,
});
assert.deepStrictEqual(payload.draftChangedFields, [
  "source",
  "sourceCategory",
  "acuteOrGradual",
]);
assert.ok(!("secretInternalField" in payload.content));

console.log("sharePayload: all tests passed");