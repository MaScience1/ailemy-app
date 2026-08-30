/**
 * 1SC0 (GCSE Combined Science) and 4SS0 (International GCSE Single Science)
 * ARE NOW DECLARED, and this suite is the half that says so.
 *
 * ============================================================================
 * ⚠ WHY THIS IS A SEPARATE FILE. import-catalogue.test.ts used to assert that
 * BOTH these codes and the three Z codes stayed absent — one assertion carrying
 * two unrelated guarantees. Declaring 1SC0 and 4SS0 red'd it, and the cheap
 * repair would have been to delete the whole line. That would have silently
 * dropped the Z-code guarantee too, admitting 18 Progress Assessments that
 * nobody has reviewed. So the assertion was SPLIT rather than edited: this file
 * asserts the two codes now resolve, and import-deferred-z-codes.test.ts keeps
 * asserting the other three stay out. Neither can be satisfied by weakening the
 * other.
 *
 * ⚠ THE CONFIG IS IMPORTED, NEVER RETYPED — same rule as the suite this was
 * split out of. SUBJECTS and paperSlug are the things under test.
 *
 * ⚠ NO DATABASE, NO NETWORK, NO WRITES. Declaration and filename shape only.
 * Whether a matching course ROW exists is loadCatalogue's job and is proven by
 * a dry run, not here.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SUBJECTS, buildFilenameRe, paperSlug } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** Every declared code, flattened out of the config exactly as its owner sees it. */
const all = Object.entries(SUBJECTS).flatMap(([key, cfg]) =>
  Object.entries(cfg.paperCodes).map(([code, info]) => ({ key, code, ...info })),
);
const byCode = new Map(all.map((r) => [r.code, r]));

// ============================================================================
console.log("\n=== 1. both codes are declared, unit-less, and correctly pointed ===");
// ============================================================================
{
  const EXPECTED = [
    { code: "1SC0", courseSlug: "edexcel-gcse-combined-science", level: "GCSE" },
    { code: "4SS0", courseSlug: "edexcel-igcse-single-science", level: "IGCSE" },
  ];

  for (const e of EXPECTED) {
    const row = byCode.get(e.code);
    t(`⚠ ${e.code} is declared in SUBJECTS`, row !== undefined, "absent");
    if (!row) continue;
    /**
     * ⚠ UNIT-LESS IS THE WHOLE BRANCH. Absent unitNumber is what makes
     * loadCatalogue resolve the course by slug and write NULL unit_id, and what
     * makes paperSlug key the paper by its entry. A unitNumber here would route
     * both codes down the IAL path and look for a units row that cannot exist.
     */
    t(`⚠ …${e.code} is UNIT-LESS (unitNumber absent)`, row.unitNumber === undefined, row.unitNumber);
    t(`⚠ …${e.code} names course ${e.courseSlug}`, row.courseSlug === e.courseSlug, row.courseSlug);
    t(`⚠ …${e.code} declares level ${e.level}`, row.level === e.level, row.level);
    t(`⚠ …${e.code}'s config carries an EMPTY unitMetadata`,
      Object.keys(SUBJECTS[row.key].unitMetadata).length === 0,
      Object.keys(SUBJECTS[row.key].unitMetadata).length);
  }

  /** The two courses are distinct from each other and from every other code's. */
  const slugs = EXPECTED.map((e) => byCode.get(e.code)?.courseSlug);
  t("⚠ the two codes resolve to two DIFFERENT courses",
    new Set(slugs).size === 2, slugs.join(", "));
}

// ============================================================================
console.log("\n=== 2. the regex accepts their real entry shapes ===");
// ============================================================================
{
  const anyAccepts = (name: string) =>
    Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));

  /**
   * ⚠ THREE-CHARACTER ENTRIES ARE WHY THE ENTRY GROUP IS {1,3}. 1SC0 sits
   * entries like 1BF/2CH/2PH — a tier letter on a subject letter on a paper
   * number. 4SS0 sits two-character entries. Both are inside the widened group;
   * neither would have parsed under the old two-digit form.
   */
  const shouldAccept = [
    "1SC0_1BF_0618_QU.pdf",
    "1SC0_2CH_0619_MS.pdf",
    "1SC0_2PH_0622_ER.pdf",
    "4SS0_1B_0619_QU.pdf",
    "4SS0_2C_0621_MS.pdf",
  ];
  t("⚠ every real entry shape for the two codes is accepted",
    shouldAccept.every(anyAccepts),
    shouldAccept.filter((n) => !anyAccepts(n)).join(", "));

  /**
   * ⚠ THE NEGATIVE HALF, so this is not just "the regex says yes to everything".
   * Declaring a code must not admit its SAM/EAM material or its ISO-date
   * conventions — those are rejected on shape, independently of the code.
   */
  const shouldReject = [
    "1SC0_1BF_SAM_QU.pdf",
    "4SS0_1B_EAM_MS.pdf",
    "1SC0_1BF_2019-06-18_QU.pdf",
    "1SC0_1BF_0618_MSC.pdf",
  ];
  t("⚠ …and declaring the code does NOT admit its SAM/EAM or ISO-date files",
    shouldReject.every((n) => !anyAccepts(n)),
    shouldReject.filter(anyAccepts).join(", "));
}

// ============================================================================
console.log("\n=== 3. paperSlug gives them the unit-less form ===");
// ============================================================================
{
  /**
   * ⚠ CALLED, NOT RESTATED. The slug rule for a unit-less code is
   * `${code}-${entry}-${session}-${year}` lowercased; asserting a hand-typed
   * string here would agree with itself for ever if the function changed.
   */
  t("⚠ 1SC0 slugs by entry, lowercased, with no unit- prefix",
    paperSlug({ unitNumber: undefined, code: "1SC0", entry: "1BF", session: "May-June", year: 2018 })
      === "1sc0-1bf-may-june-2018",
    paperSlug({ unitNumber: undefined, code: "1SC0", entry: "1BF", session: "May-June", year: 2018 }));
  t("⚠ 4SS0 likewise",
    paperSlug({ unitNumber: undefined, code: "4SS0", entry: "1B", session: "May-June", year: 2019 })
      === "4ss0-1b-may-june-2019",
    paperSlug({ unitNumber: undefined, code: "4SS0", entry: "1B", session: "May-June", year: 2019 }));
  /** The IAL form is untouched — the branch, not a replacement. */
  t("⚠ …and a code WITH a unit still gets the unit- form",
    paperSlug({ unitNumber: 1, code: "WCH11", entry: "01", session: "October-November", year: 2025 })
      === "unit-1-october-november-2025",
    paperSlug({ unitNumber: 1, code: "WCH11", entry: "01", session: "October-November", year: 2025 }));
}

// ============================================================================
console.log("\n=== 4. the corpus really holds these papers (not a vacuous pass) ===");
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

  /**
   * ⚠ THE NUMBERS ARE PINNED so that a corpus change restates them rather than
   * passing quietly. 498 + 66 = 564 unique basenames carry the two codes.
   */
  t("⚠ 1SC0 is present in the corpus, 498 unique basenames", per("1SC0") === 498, per("1SC0"));
  /** 66 -> 75: the nine 4ss0-*-que/rms/pef ISO files became 4SS0_*_0625_* at 86d17c6,
   *  so they now count under this code where their ISO names did not. */
  t("⚠ 4SS0 is present in the corpus, 75 unique basenames", per("4SS0") === 75, per("4SS0"));

  /**
   * ⚠ AND NOT ALL 564 ARE ADMITTED — 508 are. The 56-file difference is the
   * SAM/EAM, ISO-date and MSC material that the shape rejects regardless of the
   * code, and stating it here is what stops "declared" being read as "all of it
   * imports".
   */
  const anyAccepts = (name: string) =>
    Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));
  const admitted = UNIQUE.filter(
    (n) => ["1SC0", "4SS0"].includes(n.split("_")[0].toUpperCase()) && anyAccepts(n),
  ).length;
  /** 508 -> 517: the same nine renamed at 86d17c6 are now admitted by the grammar. */
  t("⚠ exactly 517 of the 573 are admitted by shape", admitted === 517, admitted);
  t("⚠ …so 56 are still rejected on shape alone", per("1SC0") + per("4SS0") - admitted === 56,
    per("1SC0") + per("4SS0") - admitted);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
