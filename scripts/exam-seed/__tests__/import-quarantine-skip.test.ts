/**
 * R35 — _quarantine IS EXCLUDED BY RULE, NOT BY LUCK.
 *
 * ============================================================================
 * ⚠ WHAT IT PROTECTS. R24 holds files back from import deliberately, and the
 * staging trees park them in a "_quarantine" folder. Until R35 that folder was
 * excluded only because its 421 files still carry their original Pearson
 * download names ("wst03-01-rms-20260813.pdf"), which no subject regex matches.
 * That is an accident of naming, not a guard: scripts/rename-iso-files.ts
 * renames files into the importable convention in bulk, and pointing it at that
 * folder would have made every quarantined file importable in one step.
 *
 * ⚠ WHY THE PROBE MUST MATCH THE REGEX. A test that drops an unparseable file
 * into _quarantine and watches it get skipped proves nothing — it would pass
 * just as happily with SKIP_DIRECTORIES empty, because the FILENAME rejected it.
 * So the probe here is built FROM the live subject config and asserted against
 * the live regex (assertion 2) BEFORE it is used, and an identical file outside
 * the folder is required to parse successfully (assertion 7). Only then does a
 * skip inside the folder mean the directory rule did the work.
 *
 * ⚠ WHERE THE GUARD ACTUALLY LIVES. walk() returns quarantined paths — it does
 * not filter (assertion 3 pins that, so this file does not misdescribe the
 * mechanism). parseFile() is what rejects them, by path segment.
 *
 * ⚠ SABOTAGE-PROVEN. Removing "_quarantine" from SKIP_DIRECTORIES reds
 * assertions 1, 4, 5, 6, 8 and 9 — every assertion that tests that entry, and
 * nothing else in the suite or the repository.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import {
  SKIP_DIRECTORIES,
  SUBJECTS,
  buildFilenameRe,
  parseFile,
  walk,
  type Options,
} from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const SUBJECT = "ial-mathematics";
const config = SUBJECTS[SUBJECT]!;
const filenameRe = buildFilenameRe(config);

/** Derived from the live config, never typed out: the first declared code. */
const code = Object.keys(config.paperCodes)[0]!;
const PROBE = `${code}_01_0625_QU.pdf`;

const opts = (root: string): Options => ({
  root,
  subject: SUBJECT,
  config,
  commit: false,
  includeYears: new Set<number>(),
  rateMs: 0,
  status: "published",
  allowUnverified: false,
  reportPath: "",
  limit: null,
});

/** Skip is not exported; take its type from the function that consumes it. */
type Skips = Parameters<typeof parseFile>[4];

const roots: string[] = [];
const scratch = async () => {
  const d = await mkdtemp(join(tmpdir(), "r35-quarantine-"));
  roots.push(d);
  return d;
};

try {
  console.log("\n=== _quarantine is skipped structurally ===");

  t("⚠ 1. SKIP_DIRECTORIES declares _quarantine",
    SKIP_DIRECTORIES.includes("_quarantine"), SKIP_DIRECTORIES.join(", "));

  t("⚠ 2. the probe filename DOES match the live subject regex (non-vacuity)",
    filenameRe.test(PROBE), `${PROBE} rejected by ${filenameRe}`);

  const root = await scratch();
  await mkdir(join(root, "_quarantine", "nested"), { recursive: true });
  await writeFile(join(root, "_quarantine", PROBE), "%PDF-1.4 probe\n");
  await writeFile(join(root, "_quarantine", "nested", PROBE), "%PDF-1.4 probe\n");
  await writeFile(join(root, PROBE), "%PDF-1.4 probe\n");

  const found = await walk(root);
  t("⚠ 3. walk() itself does NOT filter — it returns all three probes",
    found.length === 3, `walk returned ${found.length}`);

  const skips: Skips = [];
  const parsed = found
    .map((f) => parseFile(f, root, opts(root), filenameRe, skips))
    .filter((p) => p !== null);

  const quarantined = skips.filter((s) => s.path.split(sep).includes("_quarantine"));
  t("⚠ 4. the quarantined probe is skipped despite its matching name",
    quarantined.length === 2, `${quarantined.length} of 2 skipped`);

  /** The length check is load-bearing: .every() on an empty array is true. */
  t("⚠ 5. the skip reason names the directory that caused it",
    quarantined.length === 2 &&
      quarantined.every((s) => /in a skipped directory \(_quarantine\)/.test(s.reason)),
    quarantined.map((s) => s.reason).join(" | ") || "(nothing was skipped)");

  t("⚠ 6. the rule applies at depth, not just the folder's top level",
    quarantined.some((s) => s.path.includes(`nested${sep}`)),
    quarantined.map((s) => s.path).join(", "));

  /**
   * ⚠ A CONTROL, SO IT MUST SURVIVE THE SABOTAGE. It asks only whether the probe
   * parses when no directory rule applies. Counting the others here would couple
   * it to the guard and cost the run its evidence that the name itself is good;
   * "nothing came from _quarantine" is assertion 8's job.
   */
  t("⚠ 7. the SAME filename outside _quarantine parses fine (control)",
    parsed.some((p) => p!.relPath === PROBE),
    `parsed: ${parsed.map((p) => p!.relPath).join(", ") || "(none)"}`);

  t("⚠ 8. zero parsed files come from under _quarantine",
    parsed.every((p) => !p!.relPath.split(sep).includes("_quarantine")),
    parsed.map((p) => p!.relPath).join(", "));

  /** Its own root: macOS is case-insensitive, so both spellings cannot coexist. */
  const caseRoot = await scratch();
  await mkdir(join(caseRoot, "_Quarantine"), { recursive: true });
  await writeFile(join(caseRoot, "_Quarantine", PROBE), "%PDF-1.4 probe\n");
  const caseSkips: Skips = [];
  const caseParsed = (await walk(caseRoot))
    .map((f) => parseFile(f, caseRoot, opts(caseRoot), filenameRe, caseSkips))
    .filter((p) => p !== null);
  t("⚠ 9. a Finder-cased _Quarantine is skipped too",
    caseParsed.length === 0 && caseSkips.length === 1,
    `${caseParsed.length} parsed, ${caseSkips.length} skipped`);
} finally {
  /** Deletes only the directories mkdtemp created above, by captured path. */
  for (const d of roots) await rm(d, { recursive: true, force: true });
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
