/**
 * 1BIZ, 1CHZ AND 1PHZ STAY OUT. This suite exists to make that survivable.
 *
 * ============================================================================
 * ⚠ WHAT THIS IS PROTECTING. The three Z codes are Year 10 Progress
 * Assessments — internal school assessments, not released Pearson exam papers.
 * They are 18 files. Nobody has reviewed them, no course exists for them, and
 * admitting them would put non-exam material in front of students under a
 * qualification banner it does not belong to.
 *
 * ⚠ WHY IT IS ITS OWN FILE. The guarantee used to be one clause inside a single
 * assertion in import-catalogue.test.ts that ALSO covered 1SC0 and 4SS0:
 *
 *     !["1SC0", "4SS0", "1BIZ", "1CHZ", "1PHZ"].some((c) => perCode.has(c))
 *
 * The moment 1SC0 and 4SS0 were legitimately declared, that assertion red'd —
 * and the one-character repair is to delete the line. Deleting it would have
 * taken the Z-code guarantee with it, silently, in a commit whose message said
 * "declare Combined Science". The assertion was SPLIT instead. A future change
 * that legitimately declares a fourth code cannot weaken this file by accident,
 * because this file names only the three and has its own reason to exist.
 *
 * ⚠ IT ASSERTS THE CORPUS STILL CONTAINS THEM. An absence test passes trivially
 * once the files are gone. Section 2 proves the 18 are still on disk, so "not
 * accepted" means "kept out" and never "not there".
 *
 * ⚠ NO DATABASE, NO NETWORK, NO WRITES.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SUBJECTS, buildFilenameRe } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** The three, and only the three. 1SC0 and 4SS0 are deliberately NOT here. */
const DEFERRED = ["1BIZ", "1CHZ", "1PHZ"];

const anyAccepts = (name: string) =>
  Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));

// ============================================================================
console.log("\n=== 1. none of the three is declared, and none parses ===");
// ============================================================================
{
  const declared = new Set(
    Object.values(SUBJECTS).flatMap((cfg) => Object.keys(cfg.paperCodes).map((c) => c.toUpperCase())),
  );
  t("⚠ no Z code is declared in SUBJECTS",
    !DEFERRED.some((c) => declared.has(c)),
    DEFERRED.filter((c) => declared.has(c)).join(", "));

  /**
   * ⚠ THROUGH THE REGEX, WHICH IS THE REAL GATE. buildFilenameRe's alternation
   * is built from Object.keys(paperCodes), so an undeclared code can never
   * become a candidate the planner sees. That is the mechanism, not a list.
   */
  const names = [
    "1BIZ_1BF_0517_QU.pdf",
    "1CHZ_1CF_0517_QU.pdf",
    "1PHZ_1PF_0517_QU.pdf",
    "1BIZ_1BH_0518_MS.pdf",
  ];
  t("⚠ no Z-code filename is accepted by any config",
    !names.some(anyAccepts), names.filter(anyAccepts).join(", "));

  /**
   * ⚠ THE POSITIVE CONTROL. The identical shape with a DECLARED code IS
   * accepted, so the rejection above is about the code and not about the shape
   * being malformed in some way that would reject everything.
   */
  t("⚠ …while the identical shape with a declared code IS accepted",
    anyAccepts("1CH0_1F_0625_QU.pdf") && anyAccepts("1SC0_1BF_0618_QU.pdf"),
    `1CH0=${anyAccepts("1CH0_1F_0625_QU.pdf")} 1SC0=${anyAccepts("1SC0_1BF_0618_QU.pdf")}`);
}

// ============================================================================
console.log("\n=== 2. the 18 files are still on disk, so the absence is a CHOICE ===");
// ============================================================================
{
  const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";
  const FOLDERS = [
    "2 - GCE AS and A level from 2015",
    "4 - GCSE (9-1) ",
    "8 - International GCSE (9-1)",
  ];
  if (!existsSync(CORPUS)) {
    console.log("\n  SKIPPED — the paper corpus is not on this machine.\n");
    process.exit(2);
  }
  function basenames(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(".") || e === "__MACOSX") continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (e.toLowerCase().endsWith(".pdf")) out.push(e);
      }
    };
    walk(root);
    return out;
  }
  const ALL: string[] = [];
  for (const f of FOLDERS) {
    const dir = join(CORPUS, f);
    if (existsSync(dir)) ALL.push(...basenames(dir));
  }
  const UNIQUE = [...new Set(ALL)];
  const per = (code: string) =>
    UNIQUE.filter((n) => n.split("_")[0].toUpperCase() === code).length;

  /** Six apiece, eighteen together — the number the deferral is about. */
  for (const c of DEFERRED) t(`⚠ ${c} is present on disk (6 files)`, per(c) === 6, per(c));
  const total = DEFERRED.reduce((s, c) => s + per(c), 0);
  t("⚠ eighteen Progress Assessment files exist in total", total === 18, total);
  t("⚠ …and this section is not vacuous (the corpus is loaded)", UNIQUE.length === 2119, UNIQUE.length);

  /** The point of the whole file: present on disk, absent from the accepted set. */
  const acceptedZ = UNIQUE.filter(
    (n) => DEFERRED.includes(n.split("_")[0].toUpperCase()) && anyAccepts(n),
  );
  t("⚠ ZERO of the eighteen is admitted by any config",
    acceptedZ.length === 0, acceptedZ.slice(0, 5).join(", "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
