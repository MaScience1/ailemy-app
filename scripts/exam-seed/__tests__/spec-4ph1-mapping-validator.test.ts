/**
 * 4PH1 mapping-fixture validator — the guard's own audit.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/spec-4ph1-mapping-validator.test.ts
 *
 * The validator exists so a future mapping fixture cannot carry a code the
 * official specification does not contain, a duplicate pair 0035's UNIQUE
 * would bounce at apply time, or — the Physics-specific impossibility — a
 * P-suffix (Paper 2-only) code on a Paper 1 question. Every sabotage here is
 * a fixture defect the validator MUST refuse; the happy path uses the real
 * committed extraction and the committed example fixture, so the example can
 * never rot into something the validator rejects.
 *
 * No credentials, no database, nothing written anywhere.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  AMBIGUITY_THRESHOLD,
  validateMappingFixture,
  warnMappingFixture,
  type MappingFixture,
} from "../../spec-extract/validate-4ph1-mapping.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const extraction = JSON.parse(readFileSync(repo("scripts/spec-extract/4ph1-issue4.json"), "utf8")) as {
  points: { code: string; pOnly: boolean }[];
};
const officialCodes = new Set(extraction.points.map((p) => p.code));
const aPCode = extraction.points.find((p) => p.pOnly)!.code;
const aCoreCode = extraction.points.find((p) => !p.pOnly)!.code;

const valid: MappingFixture = {
  course: "edexcel-igcse-physics",
  paper: { code: "4PH1", component: "2P", session: "0619" },
  mappings: [
    { questionNumber: "1(a)", specCodes: [aCoreCode] },
    { questionNumber: "2(b)(i)", specCodes: [aPCode] }, // P-code fine on Paper 2
  ],
};

console.log("§1 a mechanically sound fixture passes");
t("valid Paper 2 fixture (core + P-suffix codes) yields zero problems",
  validateMappingFixture(valid, officialCodes).length === 0,
  validateMappingFixture(valid, officialCodes).join("; "));
t("a P-suffix code on PAPER 2 is allowed — the rule must not over-fire",
  validateMappingFixture(
    { ...valid, paper: { ...valid.paper, component: "2PR" } },
    officialCodes,
  ).length === 0);
{
  const example = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ph1-mapping-fixture.example.json"), "utf8"),
  ) as MappingFixture;
  t("the committed example fixture validates against the real extraction (it cannot rot)",
    validateMappingFixture(example, officialCodes).length === 0,
    validateMappingFixture(example, officialCodes).join("; "));
}

console.log("§2 every mechanical impossibility is refused (sabotage-as-test)");
const refuses = (label: string, f: MappingFixture, needle: string) => {
  const problems = validateMappingFixture(f, officialCodes);
  t(label, problems.length > 0 && problems.some((p) => p.includes(needle)),
    problems.join("; ") || "(accepted!)");
};
refuses("a code absent from the official 195 is refused",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["2.99"] }] },
  "not in the official 4PH1 specification");
refuses("a plain code the document only defines WITH its P suffix is refused (1.2 exists only as 1.2P)",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["1.2"] }] },
  "not in the official 4PH1 specification");
refuses("a malformed code is refused",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["2.5p"] }] },
  "malformed code");
refuses("a duplicate (question, code) pair is refused before 0035's UNIQUE ever sees it",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: [aCoreCode, aCoreCode] }] },
  "duplicate mapping");
refuses("⚠ a P-suffix code on a Paper 1 component is refused (the official Paper 1 rule)",
  { ...valid, paper: { ...valid.paper, component: "1P" },
    mappings: [{ questionNumber: "3", specCodes: [aPCode] }] },
  "Paper 1 assesses only non-P content");
refuses("the same P-code refusal fires for the regional 1PR component",
  { ...valid, paper: { ...valid.paper, component: "1PR" },
    mappings: [{ questionNumber: "3", specCodes: [aPCode] }] },
  "Paper 1 assesses only non-P content");
refuses("a fixture aimed at another course is refused",
  { ...valid, course: "edexcel-igcse-biology" },
  "only accepts edexcel-igcse-physics");
refuses("a wrong paper code is refused",
  { ...valid, paper: { ...valid.paper, code: "4BI1" } },
  "expected 4PH1");
refuses("an empty mappings list is refused",
  { ...valid, mappings: [] },
  "maps nothing");
refuses("a question with no codes is refused",
  { ...valid, mappings: [{ questionNumber: "4", specCodes: [] }] },
  "no specCodes");
refuses("a nonsense component is refused",
  { ...valid, paper: { ...valid.paper, component: "3P" } },
  "not one of 1P/1PR/2P/2PR");
refuses("a Biology component on a Physics fixture is refused",
  { ...valid, paper: { ...valid.paper, component: "1B" } },
  "not one of 1P/1PR/2P/2PR");
refuses("a cross-course Chemistry code (C suffix) is refused as malformed for Physics",
  { ...valid, mappings: [{ questionNumber: "5", specCodes: ["1.5C"] }] },
  "malformed code");
refuses("a cross-course Biology code (B suffix) is refused as malformed for Physics",
  { ...valid, mappings: [{ questionNumber: "5", specCodes: ["2.5B"] }] },
  "malformed code");

console.log("§3 ambiguity review flags (non-fatal) and multi-point intent");
{
  const distinct = extraction.points.filter((p) => !p.pOnly).slice(0, AMBIGUITY_THRESHOLD + 1)
    .map((p) => p.code);
  const wide: MappingFixture = {
    ...valid, mappings: [{ questionNumber: "6", specCodes: distinct }],
  };
  t("a question over the ambiguity threshold VALIDATES (multi-point is intentional)…",
    validateMappingFixture(wide, officialCodes).length === 0,
    validateMappingFixture(wide, officialCodes).join("; "));
  t("…but raises exactly one review warning naming the question",
    warnMappingFixture(wide).length === 1 && warnMappingFixture(wide)[0].includes("6:"),
    warnMappingFixture(wide).join("; "));
  t("a question at or below the threshold raises no warning",
    warnMappingFixture({
      ...valid,
      mappings: [{ questionNumber: "7", specCodes: distinct.slice(0, AMBIGUITY_THRESHOLD) }],
    }).length === 0);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
