/**
 * The write gate.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/region-audit.test.ts
 *
 * These two rules caught faults that had survived extraction, rendering, a
 * visual review, a seed, a re-trim, a re-widen and a second seed. The cases
 * below are the real ones, in the real wording from the real paper.
 */
import { auditRegion, describeAudit } from "../../../src/lib/exam/region-audit.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const audit = (lines: string[], q = "X", page = 1) =>
  auditRegion({ questionNumber: q, pageNumber: page, linesInside: lines });

console.log("── THE REAL FAULT 1: Q1 swallowed its own marks tally ──");
{
  const p = audit([
    "1: Which row shows the numbers of neutrons and electrons in a bromide ion 79Br- ?",
    "Number of neutrons", "Number of electrons", "A", "44", "35",
    "(Total for Question 1 = 1 mark)",
  ], "1", 2);
  t("caught", p.length === 1, p);
  t("...names the furniture it found", /Total for Question 1/.test(p[0]?.problem ?? ""), p[0]?.problem);
  t("...and the question", p[0]?.questionNumber === "1");
}

console.log("\n── THE REAL FAULT 2: 22(c) swallowed the whole of unseeded 22(d) ──");
{
  const p = audit([
    "(c) Calculate the percentage yield if 1.00 g of trichlorobutane is produced",
    "(3)",
    "(d) Chlorine can be analysed in a mass spectrometer.",
    "Isotopic abundances 35Cl 75% 37Cl 25%",
    "(2)",
    "Relative abundance", "m / z",
  ], "22(c)", 17);
  t("caught", p.length === 1, p);
  t("...counts both allocations", /2 mark allocations/.test(p[0]?.problem ?? ""), p[0]?.problem);
  t("...quotes them", /\(3\)/.test(p[0]?.problem ?? "") && /\(2\)/.test(p[0]?.problem ?? ""));
  // THE POINT of this rule: it fires without knowing 22(d) exists. 22(d) is
  // not seeded, so nothing else in the pipeline can see it.
  t("detects a swallowed neighbour WITHOUT knowing the neighbour exists", p.length === 1);
}

console.log("\n── the healthy shapes must PASS (a gate that cries wolf gets removed) ──");
{
  t("a leaf with exactly one allocation", audit([
    "(i) State what is meant by complete combustion.", "(1)",
    "..........................................",
  ]).length === 0);
  t("a container stem with none", audit([
    "20: This question is about carbon dioxide.",
  ]).length === 0);
  t("a question whose prose mentions marks but is not a tally", audit([
    "Give your answer to three significant figures.", "(6)",
  ]).length === 0);
  t("an empty box (nothing to complain about)", audit([]).length === 0);
}

console.log("\n── what must NOT be mistaken for a mark allocation ──");
{
  t("'(a)' is a sub-part label, not a tariff", audit(["(a)", "(2)"]).length === 0);
  t("'(iv)' likewise", audit(["(iv)", "(2)"]).length === 0);
  t("'(2 marks)' is prose, not a bare tariff", audit(["(2 marks)", "(3)"]).length === 0);
  t("'(2)' inline in a sentence is not a whole-line tariff",
    audit(["the value (2) is given", "(3)"]).length === 0);
  t("whitespace around a tariff still counts", audit([" ( 2 ) ", "(3)"]).length === 1);
}

console.log("\n── tally wording, all the forms this paper prints ──");
{
  t("Total for Question", audit(["(Total for Question 20 = 15 marks)"]).length === 1);
  t("TOTAL FOR SECTION", audit(["TOTAL FOR SECTION B = 60 MARKS"]).length === 1);
  t("TOTAL FOR PAPER", audit(["TOTAL FOR PAPER = 80 MARKS"]).length === 1);
  t("all three at once is still reported", audit([
    "(Total for Question 23 = 21 marks)", "TOTAL FOR SECTION B = 60 MARKS", "TOTAL FOR PAPER = 80 MARKS",
  ]).length === 1);
}

console.log("\n── ⚠ THE GATE'S HONEST LIMIT, pinned so nobody assumes it covers this ──");
{
  // The container 23(c) swallowed its child's PROMPT — "(i) Describe metallic
  // bonding." — while that child's "(1)" fell OUTSIDE the box. One allocation,
  // no tally: the gate passes it. It is caught by the extractor bounding on
  // sub-part labels (bug B), NOT by this gate. Necessary, not sufficient.
  const p = audit([
    "(c) Metals are held together by metallic bonding.",
    "(i) Describe metallic bonding.",
  ], "23(c)", 22);
  t("a container swallowing a child's prompt is NOT caught here", p.length === 0, p);
  t("...which is why the extractor bounds on sub-part labels as well", true);
}

console.log("\n── the abort message names every failing question ──");
{
  const p = [
    ...audit(["(Total for Question 1 = 1 mark)"], "1", 2),
    ...audit(["(3)", "(2)"], "22(c)", 17),
  ];
  const msg = describeAudit(p);
  t("names both", /1 \(page 2\)/.test(msg) && /22\(c\) \(page 17\)/.test(msg), msg);
  t("one line each", msg.split("\n").length === 2, msg);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
