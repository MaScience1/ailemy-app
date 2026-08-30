/**
 * GUARD (b) — an unknown paper code SKIPS AND REPORTS. Never throws, never
 * inserts.
 * GUARD (c) — folder 4's byte-identical copies collapse on the dedup key, and
 * the collapse is asserted as a NUMBER.
 *
 * ============================================================================
 * ⚠ THE CONFIG IS IMPORTED, NEVER RETYPED. SUBJECTS is the thing under test.
 * A local copy of the fourteen codes would agree with itself for ever, which is
 * the failure AGENTS.md names: a model of production data has to be re-derived
 * from the source.
 *
 * ⚠ NO DATABASE, NO NETWORK, NO WRITES. Nothing here calls loadCatalogue or
 * importOne. Guard (b) exercises the pure planning path; guard (c) is pure
 * arithmetic over filenames on disk.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { SUBJECTS, buildFilenameRe } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

// ============================================================================
console.log("\n=== 1. the twenty-six unit-less codes are declared, and unit-less ===");
// ============================================================================
{
  const all = Object.entries(SUBJECTS).flatMap(([key, cfg]) =>
    Object.entries(cfg.paperCodes).map(([code, info]) => ({ key, code, ...info })),
  );
  const unitless = all.filter((r) => r.unitNumber === undefined);
  const withUnit = all.filter((r) => r.unitNumber !== undefined);

  /**
   * ⚠ 14 -> 16 -> 26. The last move is the ten UK GCE Maths and English codes
   * (8MA0/9MA0, 8FM0/9FM0, 8EN0/9EN0, 8ET0/9ET0, 8EL0/9EL0), declared unit-less
   * because they resolve the course by slug and write unit_id NULL — R22.
   */
  t("⚠ exactly 26 unit-less codes", unitless.length === 26, unitless.length);
  /** 18 -> 40: the 22 IAL Maths and English unit codes joined the unit path. */
  t("⚠ the 40 IAL codes declare a unit (nothing regressed)",
    withUnit.length === 40, withUnit.length);
  /**
   * ⚠ SIXTEEN NOW, NOT FOURTEEN. 1SC0 (GCSE Combined Science) and 4SS0
   * (International GCSE Single Science) joined the unit-less set; the fourteen
   * that were here are unchanged. Both new codes are asserted in full by
   * import-newly-declared-codes.test.ts — this line only pins the roster.
   */
  t("⚠ every unit-less code is one of the expected twenty-six",
    unitless.map((r) => r.code).sort().join(",") ===
      "1BI0,1CH0,1PH0,1SC0,4BI1,4CH1,4PH1,4SS0,8BI0,8BN0,8CH0,8EL0,8EN0,8ET0,8FM0," +
      "8MA0,8PH0,9BI0,9BN0,9CH0,9EL0,9EN0,9ET0,9FM0,9MA0,9PH0",
    unitless.map((r) => r.code).sort().join(","));
  t("⚠ every unit-less code names a course slug that is NOT an IAL one",
    unitless.every((r) => !r.courseSlug.includes("-ial-")),
    unitless.filter((r) => r.courseSlug.includes("-ial-")).map((r) => r.code).join(", "));
  /** Still one course each: ten new codes, ten new courses, no sharing. */
  t("⚠ the twenty-six resolve to twenty-six DISTINCT courses",
    new Set(unitless.map((r) => r.courseSlug)).size === 26,
    new Set(unitless.map((r) => r.courseSlug)).size);

  /**
   * ⚠ SPEC A IS 8BN0, SPEC B IS 8BI0 — pinned because the code letters read the
   * other way round and this was got wrong once from intuition. The mark
   * schemes say "GCE in Biology Spec A (8BN0)" and "Spec B (8BI0)".
   */
  const bySlug = new Map(all.map((r) => [r.code, r.courseSlug]));
  t("⚠ 8BN0 -> biology-A (not B)", bySlug.get("8BN0") === "edexcel-gce-as-biology-a", bySlug.get("8BN0"));
  t("⚠ 8BI0 -> biology-B (not A)", bySlug.get("8BI0") === "edexcel-gce-as-biology-b", bySlug.get("8BI0"));

  /** unitMetadata must be EMPTY for unit-less configs — nothing to fabricate. */
  const unitlessConfigs = Object.entries(SUBJECTS)
    .filter(([, cfg]) => Object.values(cfg.paperCodes).every((i) => i.unitNumber === undefined));
  t("⚠ every unit-less config carries an EMPTY unitMetadata",
    unitlessConfigs.every(([, cfg]) => Object.keys(cfg.unitMetadata).length === 0),
    unitlessConfigs.filter(([, cfg]) => Object.keys(cfg.unitMetadata).length > 0).map(([k]) => k).join(", "));
}

// ============================================================================
console.log("\n=== 2. GUARD (b) — an unknown code skips and reports ===");
// ============================================================================
{
  /**
   * ⚠ TESTED THROUGH THE REGEX, WHICH IS THE REAL FIRST GATE. A code no config
   * declares cannot even be parsed into a candidate: buildFilenameRe's
   * alternation is built from Object.keys(paperCodes), so an undeclared code
   * never becomes a file the planner sees. That is the skip.
   */
  const anyAccepts = (name: string) =>
    Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));

  /**
   * ⚠ 1SC0 AND 4SS0 LEFT THIS LIST BECAUSE THEY ARE NOW DECLARED, and the three
   * Z codes were added in their place — this list got STRONGER, not weaker.
   * The standalone guarantee lives in import-deferred-z-codes.test.ts; what is
   * being tested here is the regex-gate MECHANISM, with 9ZZ9 as the code that
   * does not exist anywhere at all.
   */
  const undeclared = [
    "1BIZ_1BF_0517_QU.pdf",   // Year 10 Progress Assessment — not an exam paper
    "1CHZ_1CF_0517_QU.pdf",   // Year 10 Progress Assessment — not an exam paper
    "1PHZ_1PF_0517_QU.pdf",   // Year 10 Progress Assessment — not an exam paper
    "9ZZ9_01_0625_QU.pdf",    // does not exist at all
  ];
  t("⚠ every undeclared code is rejected before planning",
    undeclared.every((n) => !anyAccepts(n)),
    undeclared.filter(anyAccepts).join(", "));

  /** The control: the SAME shape with a declared code IS accepted. */
  t("⚠ …and the identical shape with a DECLARED code is accepted",
    anyAccepts("1CH0_1F_0625_QU.pdf") && anyAccepts("4CH1_1C_0621_QU.pdf"),
    `1CH0=${anyAccepts("1CH0_1F_0625_QU.pdf")} 4CH1=${anyAccepts("4CH1_1C_0621_QU.pdf")}`);

  /**
   * ⚠ AND THE SECOND GATE, THE ONE THAT USED TO THROW. planRows looks the code
   * up again at the point it needs a unit number. The lookup is now guarded, so
   * a code that somehow reached it returns undefined and is pushed to skips
   * rather than destructured. Asserted on the SOURCE because the path is
   * unreachable while loadCatalogue aborts first — a runtime test would prove
   * nothing, and the thing being protected is precisely the unreachable case.
   */
  const src = readSource();
  t("⚠ the paperCodes lookup in planRows is guarded, not destructured",
    /const codeInfo = config\.paperCodes\[[^\]]+\];\s*if \(!codeInfo\)/.test(src),
    "guarded form not found");
  t("⚠ the unguarded destructure is gone from the code (comments stripped)",
    !/const \{ unitNumber \} = config\.paperCodes\[/.test(src),
    "unguarded destructure still present");
  /**
   * ⚠ THE WINDOW IS 400 CHARS BECAUSE THE skips.push LINE IS ITSELF ~120. My
   * first attempt allowed 120 between skips.push and continue and failed on its
   * own arithmetic, not on the code — which is the second time in this pass a
   * guard has red'd for a reason that had nothing to do with what it guards.
   */
  t("⚠ the guard SKIPS rather than throwing",
    /if \(!codeInfo\) \{[\s\S]{0,400}skips\.push[\s\S]{0,400}continue;/.test(src),
    "no skips.push/continue after the guard");
  t("⚠ …and it never throws on that path",
    !/if \(!codeInfo\) \{[\s\S]{0,400}(throw |fail\()/.test(src),
    "the guard throws or calls fail()");
}

// ============================================================================
console.log("\n=== 3. GUARD (c) — folder 4's duplicates collapse, as a number ===");
// ============================================================================
{
  const DIR = "/Users/muhammed/Desktop/Ailemy/Exams/4 - GCSE (9-1) ";
  if (!existsSync(DIR)) {
    console.log("  (corpus absent — guard (c) skipped, see the exit code)");
    if (fail === 0) { console.log(`\n${pass} passed, corpus-dependent section skipped`); process.exit(2); }
  } else {
    const names: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(".") || e === "__MACOSX") continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (e.toLowerCase().endsWith(".pdf")) names.push(e);
      }
    };
    walk(DIR);

    /**
     * ⚠ THE DEDUP KEY IS THE BASENAME, and that is a claim about the data, not
     * a convenience: three copies of 1BI0_2H_1121_QU.pdf under three different
     * directories were confirmed byte-identical by MD5. The filename is
     * authoritative (the importer's own header says so), so the same basename
     * IS the same paper.
     */
    const unique = new Set(names);
    const surplus = names.length - unique.size;

    t("⚠ folder 4 holds 1,620 PDFs on disk", names.length === 1620, names.length);
    t("⚠ they collapse to 934 unique basenames", unique.size === 934, unique.size);
    t("⚠ the surplus is exactly 686 copies", surplus === 686, surplus);

    const repeated = new Map<string, number>();
    for (const n of names) repeated.set(n, (repeated.get(n) ?? 0) + 1);
    const multi = [...repeated.values()].filter((c) => c > 1);
    t("⚠ 590 basenames appear more than once", multi.length === 590, multi.length);
    t("⚠ and the surplus is the sum of their extra copies",
      multi.reduce((a, c) => a + c - 1, 0) === surplus,
      multi.reduce((a, c) => a + c - 1, 0));

    /** ⚠ NOT VACUOUS: if dedup did nothing, surplus would be 0. */
    t("⚠ the collapse is real (surplus > 0, else this section proves nothing)",
      surplus > 0, surplus);
  }
}

/**
 * ⚠ COMMENTS STRIPPED BEFORE ANY SOURCE ASSERTION. Five guards in this
 * repository have now passed on their own explanatory prose, and one of them
 * was mine an hour ago — the comment above the guarded lookup quotes the old
 * unguarded form verbatim, so a raw search finds it and reports the bug is
 * still there.
 */
function readSource(): string {
  const raw = readFileSync("scripts/bulk-import-papers.ts", "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
