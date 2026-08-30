/**
 * The importer's filename regex, asserted as COUNTS against the real corpus.
 *
 * ============================================================================
 * ⚠ WHY COUNTS AND NOT PROSE.
 * ============================================================================
 * "the regex still rejects sample material" is a sentence, and a sentence
 * cannot go red. The corpus on disk holds 234 sample/exemplar files across the
 * three folders, 21 files in two ISO-date conventions, and 29 MSC files. Each
 * of those is a NUMBER this file asserts. Widen the pattern by one character
 * and a number moves.
 *
 * ⚠ THE FIXTURE IS DERIVED, NOT TYPED. Every filename below is read off the
 * real corpus at /Users/muhammed/Desktop/Ailemy/Exams when it is present, and
 * the counts are recomputed from it. AGENTS.md: a model of production data has
 * to be re-derived from the source or it pins yesterday's behaviour. When the
 * corpus is absent — CI, another machine — the suite SKIPS rather than passing
 * on an empty set, because a guard over zero files is green for the wrong
 * reason.
 *
 * ⚠ THE REGEX IS IMPORTED, NEVER RETYPED. buildFilenameRe is the thing under
 * test; a copy here would agree with itself for ever.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildFilenameRe, SUBJECTS } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";
const FOLDERS = [
  "2 - GCE AS and A level from 2015",
  "4 - GCSE (9-1) ",
  "8 - International GCSE (9-1)",
];

if (!existsSync(CORPUS)) {
  console.log(
    "\n  SKIPPED — the paper corpus is not on this machine. This suite asserts\n" +
      "  counts against real Edexcel filenames and proves nothing without them.\n",
  );
  process.exit(2);
}

/** Every PDF basename under the three in-scope folders, deduplicated. */
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
  if (!existsSync(dir)) { t(`corpus folder present: ${f}`, false, "missing"); continue; }
  ALL.push(...basenames(dir));
}
const UNIQUE = [...new Set(ALL)];

// ============================================================================
console.log("\n=== 1. the corpus is really there (else every count below is vacuous) ===");
// ============================================================================
/**
 * ⚠ 2,811 IS THE THREE-FOLDER TOTAL: 675 + 1,620 + 516. My first draft asserted
 * > 3000, which is the FOUR-folder figure — it included folder 7's 701 IAL
 * files, which are out of scope here. The guard failed on its own arithmetic
 * before it failed on anything real.
 */
t("⚠ the three folders yield PDFs at all", ALL.length > 2500, ALL.length);
t("⚠ and deduplicate to a smaller set (folder 4 files the same paper 3 ways)",
  UNIQUE.length > 0 && UNIQUE.length < ALL.length, `${ALL.length} -> ${UNIQUE.length}`);

// ============================================================================
console.log("\n=== 2. GUARD (a) — what the regex must still REJECT, as counts ===");
// ============================================================================
{
  /**
   * ⚠ THE UNION OF ALL FOURTEEN CODES, so a file is only "rejected" here if NO
   * subject config would accept it. Testing one config at a time would call a
   * Physics paper rejected because the Chemistry config declined it.
   */
  const anyAccepts = (name: string) =>
    Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));

  const sample   = UNIQUE.filter((n) => /_(SAM|EAM|ADDSAM\d*)_/i.test(n) || /_(SAM|EAM)_/i.test(n) || /_ADDSAM/i.test(n));
  const isoUnder = UNIQUE.filter((n) => /_(que|rms|pef)_\d{8}\.pdf$/i.test(n));
  const isoDash  = UNIQUE.filter((n) => /^[0-9a-z]+-[0-9a-z]+-(que|rms|pef)-\d{8}\.pdf$/i.test(n));
  const mscType  = UNIQUE.filter((n) => /_MSC\.pdf$/i.test(n));
  const descName = UNIQUE.filter((n) => /^(Biology|Chemistry|Physics)_/i.test(n));

  const rejects = (list: string[]) => list.filter((n) => !anyAccepts(n)).length;

  t("⚠ sample/exemplar material exists in the corpus at all", sample.length > 0, sample.length);
  t(`⚠ ALL ${sample.length} sample/exemplar files are rejected`,
    rejects(sample) === sample.length, `${rejects(sample)} of ${sample.length}`);

  /**
   * ⚠ INVERTED AT 86d17c6, AND STILL A GUARD. This asserted > 0 so it could not
   * pass vacuously — the population had to exist for "all of them are rejected"
   * to mean anything. That population is now zero BY DESIGN: 86d17c6 renamed all
   * 21 ISO-named files into the MMYY grammar. So the assertion flips and its
   * subject changes. It no longer guards "we can see them"; it guards NO
   * ISO-NAMED FILE HAS RE-ENTERED THE CORPUS.
   *
   * ⚠ RUNNING 86d17c6'S UNDO LOG FIRES THIS. rename-iso-undo-20260829-123336.log
   * puts all 21 back under their old names, and this goes red. That is the
   * correct behaviour, not a false alarm.
   */
  t("⚠ no ISO-date underscore file has re-entered the corpus", isoUnder.length === 0, isoUnder.length);
  t(`⚠ ALL ${isoUnder.length} ISO-date underscore files are rejected`,
    rejects(isoUnder) === isoUnder.length, `${rejects(isoUnder)} of ${isoUnder.length}`);

  /** Same inversion, same cause (86d17c6), same undo-log consequence. */
  t("⚠ no lowercase que/rms/pef file has re-entered the corpus", isoDash.length === 0, isoDash.length);
  t(`⚠ ALL ${isoDash.length} lowercase que/rms/pef files are rejected`,
    rejects(isoDash) === isoDash.length, `${rejects(isoDash)} of ${isoDash.length}`);

  t("⚠ MSC-typed files exist", mscType.length > 0, mscType.length);
  t(`⚠ ALL ${mscType.length} MSC files are rejected`,
    rejects(mscType) === mscType.length, `${rejects(mscType)} of ${mscType.length}`);

  /**
   * ⚠ THE TYPE ALTERNATION NEEDS A SYNTHETIC CASE, AND SABOTAGE IS WHY.
   * ==========================================================================
   * The assertion above passed when MSC was ADDED to the alternation — because
   * every real MSC file in the corpus is descriptively named
   * (Chemistry_AS_P2_SAM_2015_MSC.pdf) and is rejected on its CODE, long before
   * the type group is reached. The assertion was true and its stated reason was
   * false: it never exercised (QU|MS|ER) at all.
   *
   * There is no natural MSC file with a declared code, so the case is built:
   * a real IAL code, a real entry, a real date, and MSC as the type. It can
   * only fail on the type alternation, which is the thing being claimed.
   */
  const wellFormedButWrongType = [
    "WCH11_01_0625_MSC.pdf",
    "WBI12_01_0119_QUE.pdf",
    "WPH11_01_1024_RMS.pdf",
    "WCH11_01_0625_PEF.pdf",
  ];
  t("⚠ a well-formed name with a non-QU/MS/ER type is rejected on the TYPE alone",
    wellFormedButWrongType.every((n) => !anyAccepts(n)),
    wellFormedButWrongType.filter(anyAccepts).join(", "));
  /** The same names with a legal type MUST be accepted, or the case proves nothing. */
  t("⚠ …and the identical names with QU/MS/ER are accepted (the control)",
    ["WCH11_01_0625_MS.pdf", "WBI12_01_0119_QU.pdf", "WPH11_01_1024_ER.pdf"].every(anyAccepts),
    ["WCH11_01_0625_MS.pdf", "WBI12_01_0119_QU.pdf", "WPH11_01_1024_ER.pdf"].filter((n) => !anyAccepts(n)).join(", "));

  t(`⚠ ALL ${descName.length} descriptive-name files are rejected`,
    rejects(descName) === descName.length, `${rejects(descName)} of ${descName.length}`);

  /**
   * ⚠ THE POSITIVE CONTROL SITS ON FOLDER 7, NOT ON THESE THREE, AND THE REASON
   * IS THE FINDING OF THIS WHOLE SUITE.
   * ==========================================================================
   * A regex that rejects EVERYTHING satisfies every rejection assertion above,
   * so a positive half is mandatory. But folders 2, 4 and 8 currently yield
   * ZERO accepted files — not because the entry group is wrong, but because
   * SUBJECTS still declares only the eighteen IAL codes. The code alternation
   * rejects 1CH0, 9CH0 and 4CH1 before the entry group is ever consulted.
   *
   * So the control runs against folder 7, where the codes ARE declared. That
   * proves the pattern still matches real released papers after the entry group
   * widened — which is what could have broken.
   */
  const IAL_DIR = join(CORPUS, "7 - International edexcel from 2018 ");
  const ialNames = existsSync(IAL_DIR) ? [...new Set(basenames(IAL_DIR))] : [];
  const ialAccepted = ialNames.filter(anyAccepts);
  t("⚠ folder 7 is present, so the positive control is not vacuous", ialNames.length > 600, ialNames.length);
  t("⚠ the WIDENED regex still ACCEPTS the IAL corpus (nothing regressed)",
    ialAccepted.length > 600, `${ialAccepted.length} of ${ialNames.length}`);
  t("⚠ every accepted name carries a 4-digit date, never SAM/EAM",
    ialAccepted.every((n) => /_\d{4}_(QU|MS|ER)/i.test(n)),
    ialAccepted.filter((n) => !/_\d{4}_(QU|MS|ER)/i.test(n)).slice(0, 3).join(", "));

  /**
   * ⚠ THE IN-SCOPE ACCEPTANCE COUNT, AND THIS ASSERTION HAS ALREADY DONE ITS
   * JOB ONCE.
   * ==========================================================================
   * It was written as "accepts 0" while SUBJECTS declared only the eighteen IAL
   * codes, explicitly so that extending SUBJECTS would red it and force the new
   * number to be stated rather than discovered later. It has now done that
   * TWICE. First restatement: 1,370 of 2,119 when the fourteen GCE/GCSE/IGCSE
   * codes landed. Second: declaring 1SC0 and 4SS0 red'd it exactly as the note
   * below predicted, and this is that restatement — 1,878 of 2,119.
   *
   * The move is +508, against 564 unique basenames carrying the two new codes.
   * The 56-file gap is their own SAM/EAM and ISO-date material, rejected on
   * shape rather than on code; import-newly-declared-codes.test.ts pins both
   * halves of that arithmetic.
   *
   * The remaining 241 are the still-deferred and non-released material —
   * 1BIZ/1CHZ/1PHZ Progress Assessments, plus SAM/EAM/ADDSAM, the ISO-date
   * conventions and the MSC type. Every one is separately counted above.
   *
   * ⚠ IT STILL REDS ON ANY FUTURE CHANGE, which is the point. Declare a Z code
   * and the number moves; widen the regex and the number moves.
   */
  const inScopeAccepted = UNIQUE.filter(anyAccepts);
  /**
   * ⚠ THIRD RESTATEMENT. 1,370 -> 1,878 when 1SC0/4SS0 were declared; 1,878 ->
   * 1,936 of 2,156 now. The corpus moved by +37 unique basenames under two
   * commits: 0800dd1 added 31 recovered Pearson files to folder 2, and 8b01450
   * renamed 4CH1 1C/2C out of _1121_, which had SHARED basenames with the
   * genuine November 2021 papers and now do not — six names that previously
   * collapsed into three.
   */
  t("⚠ folders 2/4/8 now accept exactly 1,936 of 2,156 unique basenames",
    inScopeAccepted.length === 1936, `${inScopeAccepted.length} of ${UNIQUE.length}`);

  /** Per code, so a regression names the qualification rather than a total. */
  const perCode = new Map<string, number>();
  for (const n of inScopeAccepted) {
    const c = n.split("_")[0].toUpperCase();
    perCode.set(c, (perCode.get(c) ?? 0) + 1);
  }
  t("⚠ all sixteen declared codes are represented (none silently matches zero)",
    perCode.size === 16, [...perCode.keys()].sort().join(","));
  /**
   * ⚠ RE-POINTED AT THE THREE Z CODES ONLY, AND NOT WIDENED BACK. 1SC0 and 4SS0
   * were removed from this list because they are now legitimately declared —
   * NOT because the assertion was in the way. The guarantee they used to share
   * with the Z codes did not evaporate: it moved to two dedicated suites,
   * import-newly-declared-codes.test.ts (these two must resolve) and
   * import-deferred-z-codes.test.ts (those three must not). Deleting this line
   * outright would have admitted 18 unreviewed Progress Assessments.
   */
  const Z_DEFERRED = ["1BIZ", "1CHZ", "1PHZ"];
  t("⚠ no deferred Z code appears among the accepted",
    !Z_DEFERRED.some((c) => perCode.has(c)),
    [...perCode.keys()].filter((c) => Z_DEFERRED.includes(c)).join(", "));
}

// ============================================================================
console.log("\n=== 3. the alphanumeric entry group is what admits GCSE/IGCSE ===");
// ============================================================================
{
  const anyAccepts = (name: string) =>
    Object.values(SUBJECTS).some((cfg) => buildFilenameRe(cfg).test(name));
  /**
   * ⚠ THESE ARE REAL NAMES FROM THE CORPUS, chosen because their entry codes
   * are NOT two digits. Under the old (\d{2}) group every one of them failed on
   * the entry alone, independently of the code alternation.
   */
  const tiered = UNIQUE.filter((n) => /^[0-9][A-Z]{2}[01]_[0-9][A-Z]{1,2}_\d{4}_(QU|MS|ER)/i.test(n));
  t("⚠ the corpus contains alphanumeric-entry filenames", tiered.length > 0, tiered.length);
  t("⚠ the OLD two-digit entry group would have rejected them",
    tiered.every((n) => !/^[0-9A-Z]+_\d{2}_\d{4}_(QU|MS|ER)/i.test(n)),
    tiered.filter((n) => /^[0-9A-Z]+_\d{2}_\d{4}_/i.test(n)).slice(0, 3).join(", "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
