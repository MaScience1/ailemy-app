/**
 * IAL AS Biology mapping-fixture validator — the guard's own audit.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/spec-wbi-as-mapping-validator.test.ts
 *
 * The validator exists so a future mapping fixture cannot carry a code the
 * official specification does not contain, an A2 code (Topics 5-8), a
 * duplicate pair 0035's UNIQUE would bounce at apply time, or — the IAL
 * unit-ed impossibility — a cross-unit code on a content paper (a Topic 3/4
 * code on WBI11, or Topic 1/2 on WBI12). WBI13 is the deliberate exception:
 * the practical paper assesses Units 1-2's practicals through the whole AS
 * vocabulary, so all of Topics 1-4 must be ACCEPTED there — an over-firing
 * unit rule would be as wrong as a missing one. Every sabotage here is a
 * fixture defect the validator MUST refuse; the happy path uses the real
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
} from "../../spec-extract/validate-wbi-as-mapping.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const extraction = JSON.parse(readFileSync(repo("scripts/spec-extract/wbi-as-issue2.json"), "utf8")) as {
  points: { code: string; topic: number; unit: number }[];
};
const officialCodes = new Set(extraction.points.map((p) => p.code));
const unit1Code = extraction.points.find((p) => p.unit === 1)!.code;
const unit2Code = extraction.points.find((p) => p.unit === 2)!.code;

const valid: MappingFixture = {
  course: "edexcel-ial-as-biology",
  paper: { code: "WBI11", session: "0119" },
  mappings: [
    { questionNumber: "1(a)", specCodes: [unit1Code] },
    { questionNumber: "2(b)(i)", specCodes: ["2.6"] },
  ],
};

console.log("§1 a mechanically sound fixture passes");
t("valid WBI11 fixture (Topic 1-2 codes) yields zero problems",
  validateMappingFixture(valid, officialCodes).length === 0,
  validateMappingFixture(valid, officialCodes).join("; "));
t("a Topic 3-4 code on WBI12 is allowed — the unit rule must not over-fire",
  validateMappingFixture(
    { ...valid, paper: { ...valid.paper, code: "WBI12" },
      mappings: [{ questionNumber: "1", specCodes: [unit2Code] }] },
    officialCodes,
  ).length === 0);
t("WBI13 (the practical paper) accepts codes from ALL of Topics 1-4 — Units 1-2's vocabulary, no fabricated Unit 3 syllabus",
  validateMappingFixture(
    { ...valid, paper: { ...valid.paper, code: "WBI13" },
      mappings: [{ questionNumber: "1", specCodes: [unit1Code, unit2Code, "1.3", "4.12"] }] },
    officialCodes,
  ).length === 0,
  validateMappingFixture(
    { ...valid, paper: { ...valid.paper, code: "WBI13" },
      mappings: [{ questionNumber: "1", specCodes: [unit1Code, unit2Code, "1.3", "4.12"] }] },
    officialCodes,
  ).join("; "));
t("October-November sessions validate with both archive month codes (10 and 11)",
  validateMappingFixture({ ...valid, paper: { ...valid.paper, session: "1023" } }, officialCodes).length === 0 &&
  validateMappingFixture({ ...valid, paper: { ...valid.paper, session: "1123" } }, officialCodes).length === 0);
{
  const example = JSON.parse(
    readFileSync(repo("scripts/spec-extract/wbi-as-mapping-fixture.example.json"), "utf8"),
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
refuses("a code absent from the official 80 is refused",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["1.99"] }] },
  "not in the official IAL AS Biology specification");
refuses("⚠ an A2 code (Topics 5-8) is refused — AS papers never assess IA2 content",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["5.8"] }] },
  "IA2 content");
refuses("a malformed code is refused",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: ["1.4a"] }] },
  "malformed code");
refuses("a duplicate (question, code) pair is refused before 0035's UNIQUE ever sees it",
  { ...valid, mappings: [{ questionNumber: "1", specCodes: [unit1Code, unit1Code] }] },
  "duplicate mapping");
refuses("⚠ a Topic 3/4 code on WBI11 is refused (WBI11 assesses Topics 1-2 only)",
  { ...valid, mappings: [{ questionNumber: "3", specCodes: [unit2Code] }] },
  "assesses Topics 1-2 only");
refuses("⚠ a Topic 1/2 code on WBI12 is refused (WBI12 assesses Topics 3-4 only)",
  { ...valid, paper: { ...valid.paper, code: "WBI12" },
    mappings: [{ questionNumber: "3", specCodes: [unit1Code] }] },
  "assesses Topics 3-4 only");
refuses("a fixture aimed at another course is refused",
  { ...valid, course: "edexcel-igcse-biology" },
  "only accepts edexcel-ial-as-biology");
refuses("an A2 paper code (WBI14) is refused — out of AS scope",
  { ...valid, paper: { ...valid.paper, code: "WBI14" } },
  "IA2 and out of AS scope");
refuses("a sibling-course paper code is refused",
  { ...valid, paper: { ...valid.paper, code: "4BI1" } },
  "expected WBI11, WBI12 or WBI13");
refuses("an empty mappings list is refused",
  { ...valid, mappings: [] },
  "maps nothing");
refuses("a question with no codes is refused",
  { ...valid, mappings: [{ questionNumber: "4", specCodes: [] }] },
  "no specCodes");
refuses("a nonsense session is refused",
  { ...valid, paper: { ...valid.paper, session: "0319" } },
  "does not look like MMYY");
refuses("a cross-course Chemistry code (C suffix) is refused as malformed for IAL Biology",
  { ...valid, mappings: [{ questionNumber: "5", specCodes: ["1.5C"] }] },
  "malformed code");
refuses("a cross-course IGCSE Biology code (B suffix) is refused as malformed for IAL Biology",
  { ...valid, mappings: [{ questionNumber: "5", specCodes: ["2.5B"] }] },
  "malformed code");
refuses("a cross-course Physics code (P suffix) is refused as malformed for IAL Biology",
  { ...valid, mappings: [{ questionNumber: "5", specCodes: ["1.2P"] }] },
  "malformed code");

console.log("§3 ambiguity review flags (non-fatal) and multi-point intent");
{
  const distinct = extraction.points.filter((p) => p.unit === 1)
    .slice(0, AMBIGUITY_THRESHOLD + 1).map((p) => p.code);
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
