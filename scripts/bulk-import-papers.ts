/**
 * ============================================================================
 * bulk-import-papers.ts — one-off importer for Edexcel IAL Chemistry papers
 * ----------------------------------------------------------------------------
 * NOT part of the app build. Nothing in src/ imports this, and `scripts/` is
 * excluded from tsconfig so a mistake in here can never fail `next build`.
 * It is run directly by Node (v22.6+ strips the types; this repo is on v26):
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/bulk-import-papers.ts --root=/path/to/pdfs
 *
 * DRY RUN IS THE DEFAULT. It reads the disk, resolves the catalogue against the
 * live database, prints every row it would insert, and writes nothing at all —
 * no storage objects, no table rows. Adding --commit is the only thing that
 * makes it write.
 *
 * ---------------------------------------------------------------------------
 * SOURCE LAYOUT
 *   <root>/<subject>/<session>/<year>/<Unit N>/WCH12_01_0122_QU.pdf
 *
 * The filename is authoritative. Directory names are read for exactly one
 * purpose — spotting the SAM folder so it can be skipped — because the folder
 * tree is hand-made and drifts, while the filename comes from Edexcel.
 *
 *   WCH12 _ 01 _ 0122 _ QU .pdf
 *   └─┬─┘   └┬┘   └─┬┘   └┬┘
 *     │      │      │     └── QU = question paper, MS = mark scheme,
 *     │      │      │         ER = examiner report (optional; QU+MS are not)
 *     │      │      └──────── MMYY: month + 2-digit year of the exam series
 *     │      └─────────────── entry code (the "/01" in "WCH12/01")
 *     └────────────────────── paper code; the trailing digit IS the unit number
 *
 * NOTE ON THE SPEC I WAS GIVEN: the brief described this as WCH<unit><entry>,
 * which would read WCH12 as unit 1 / entry 2. It is not — the whole of WCH12 is
 * the paper code and the NEXT field is the entry. The brief's own mapping table
 * (WCH11/12/13 = units 1/2/3) says the same thing, and the ten rows already in
 * past_papers store paper_code as "WCH12/01". The explicit table below is what
 * this script implements; the digits are never used to derive a unit.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WRITES
 *   Storage: two or three objects per paper — question paper, mark scheme, and
 *            the examiner report where one exists — at the same key shape the
 *            admin form mints, each validated by the app's own isValidPaperPath
 *            before any upload happens.
 *   Table:   one past_papers row per QU+MS pair.
 *
 * Uploads happen before the insert, so a failed insert would strand those
 * objects. The script deletes them itself in that case (see importOne) rather
 * than leaving work for the orphan sweep documented in migration 0016.
 * ============================================================================
 */

import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { basename, join, relative, resolve, sep } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

/**
 * The stamp is applied by scripts/watermark2.py — the SAME implementation
 * watermark-existing-papers.ts drives, shelled out per file rather than ported,
 * so the CropBox anchoring and /Rotate handling exist in exactly one place.
 *
 * Locked spec: "Ailemy.com", top-right, anchored to the CropBox (MediaBox only
 * where a page has no CropBox), text ending 35.00pt inside the right edge,
 * baseline 18.00pt below the top edge, 10.5pt Helvetica, grey 0.72, identical
 * on every page including the cover, no logo, rotated pages mapped through the
 * page rotation matrix so the mark reads horizontally in the visual top-right.
 */
const WATERMARK_PY = resolve("scripts/watermark2.py");

type StampInspection = {
  pages: number;
  correct_pages: number;
  misplaced_pages: number;
  above_cropbox_pages: number;
  already_correct: boolean;
};

async function inspectStamp(file: string): Promise<StampInspection> {
  const { stdout } = await execFileAsync("python3", [WATERMARK_PY, file, "--inspect"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout) as StampInspection;
}

/**
 * Stamp `src` to `dst` and refuse to return unless every page carries the mark
 * at the current anchor. Nothing reaches the bucket unverified.
 */
async function stampForUpload(src: string, dst: string): Promise<StampInspection> {
  await execFileAsync("python3", [WATERMARK_PY, src, dst, "--force"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return inspectStamp(dst);
}

// The path scheme and its validator are IMPORTED, never re-implemented. The
// brief asked for keys "matching isValidPaperPath exactly" and a second copy of
// that regex is exactly how the two drift apart.
import {
  PAPERS_BUCKET,
  buildPaperPath,
  isValidPaperPath,
} from "../src/lib/storage/paper-uploads.ts";

// ============================================================================
// CONFIGURATION — read this before running with --commit
// ============================================================================

type PaperCodeInfo = {
  unitNumber: number;
  courseSlug: string;
  level: string;
};

type UnitMetadata = {
  durationMinutes: number;
  totalMarks: number;
  /**
   * TRUE only when the value is corroborated by rows already in past_papers —
   * never when it is merely my recollection of the specification. Committing
   * any unverified row requires --allow-unverified-metadata, because this
   * script writes hundreds of rows at a time and a wrong mark total is
   * invisible once it is in.
   */
  verified: boolean;
};

type SubjectConfig = {
  /** Shown in the run header. */
  label: string;
  /**
   * Paper code -> which unit it is, and which course that unit must belong to.
   *
   * A CHECK, not a lookup: the real course_id/unit_id always come from the
   * database (see loadCatalogue). If the database ever disagrees with this
   * table the run aborts rather than guessing which of the two is right.
   */
  paperCodes: Record<string, PaperCodeInfo>;
  unitMetadata: Record<number, UnitMetadata>;
};

const SUBJECTS: Record<string, SubjectConfig> = {
  chemistry: {
    label: "Edexcel IAL Chemistry",
    paperCodes: {
      WCH11: { unitNumber: 1, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH12: { unitNumber: 2, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH13: { unitNumber: 3, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
      WCH14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
      WCH15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
      WCH16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
    },
    /**
     * Corroboration, from the 71 Chemistry rows now in past_papers:
     *   unit 1 -> 90/80   many rows agree
     *   unit 2 -> 90/80   many rows agree
     *   unit 4 -> 105/90  many rows agree
     *   unit 5 -> 105/90  confirmed by the author 2026-08-06
     *   units 3, 6        no rows, and no WCH13/WCH16 papers on disk — still
     *                     unexercised, hence still unverified.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: false },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: false },
    },
  },

  physics: {
    label: "Edexcel IAL Physics",
    paperCodes: {
      WPH11: { unitNumber: 1, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH12: { unitNumber: 2, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH13: { unitNumber: 3, courseSlug: "edexcel-ial-as-physics", level: "AS" },
      WPH14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
      WPH15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
      WPH16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-physics", level: "A2" },
    },
    /**
     * VERIFIED for units 1, 2, 4 and 5 — read off the question papers and
     * confirmed by the author 2026-08-07. Every Edexcel cover states both
     * fields; across all 76 Physics question papers in the archive each is
     * unanimous within its unit, with no year-to-year variation:
     *
     *   unit 1  WPH11  21 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WPH12  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 4  WPH14  18 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WPH15  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *
     * One paper needed care: WPH15_01_0625_QU.pdf carries a two-page
     * Clarification Notice about question 19(b) before the cover, so its
     * values are on page 3. They match the other sixteen.
     *
     * UNITS 3 AND 6 STAY UNVERIFIED. There are no WPH13 or WPH16 papers on
     * disk, so there is nothing to read them off — exactly the position
     * WCH13/WCH16 are in. The numbers below are carried over from the other
     * practical units and are guesses. --commit refuses any row that uses
     * them, which is the point.
     */
    /* superseded — see the block above.
     *
     * The cover sweep read these off every Physics question paper on disk and
     * found each field unanimous within its unit:
     *   unit 1  WPH11  21 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WPH12  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 4  WPH14  18 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WPH15  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     * Units 3 and 6 have NO papers on disk at all, so their numbers below are
     * pure guesses carried over from the other practical units.
     *
     * The sweep is evidence, not confirmation. These stay `verified: false`
     * until the author says so, exactly as Biology's did — that gate is what
     * caught Biology unit 3's duration being wrong.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: false },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: false },
    },
  },

  biology: {
    label: "Edexcel IAL Biology",
    paperCodes: {
      WBI11: { unitNumber: 1, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI12: { unitNumber: 2, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI13: { unitNumber: 3, courseSlug: "edexcel-ial-as-biology", level: "AS" },
      WBI14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
      WBI15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
      WBI16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-biology", level: "A2" },
    },
    /**
     * VERIFIED against the question papers themselves, then confirmed by the
     * author 2026-08-07. Not corroborated by past_papers — there are still no
     * Biology rows — so the evidence is the covers, which is stronger anyway.
     *
     * Every Edexcel cover states both fields. Read off page 1 of ALL 90 Biology
     * question papers in the archive, both values are unanimous within each
     * unit with no year-to-year variation:
     *
     *   unit 1  WBI11  20 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 2  WBI12  19 papers  "Time: 1 hour 30 minutes"  "…is 80"
     *   unit 3  WBI13   9 papers  "Time 1 hour 20 minutes"   "…is 50"
     *   unit 4  WBI14  17 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 5  WBI15  16 papers  "Time: 1 hour 45 minutes"  "…is 90"
     *   unit 6  WBI16   9 papers  "Time 1 hour 20 minutes"   "…is 50"
     *
     * NOTE ON UNITS 3 AND 6: 1 hour 20 minutes is 80 MINUTES, and the paper is
     * out of 50 MARKS. The two numbers are easy to transpose because the other
     * units pair 80 with marks rather than minutes — 80/50 here means duration
     * 80, marks 50, and the author confirmed that reading explicitly.
     *
     * The earlier draft of this table guessed these by analogy with Chemistry.
     * Five of six guesses happened to be right; unit 3's duration was not, and
     * would have gone in as 80 marks. That is why the gate exists.
     */
    unitMetadata: {
      1: { durationMinutes: 90, totalMarks: 80, verified: true },
      2: { durationMinutes: 90, totalMarks: 80, verified: true },
      3: { durationMinutes: 80, totalMarks: 50, verified: true },
      4: { durationMinutes: 105, totalMarks: 90, verified: true },
      5: { durationMinutes: 105, totalMarks: 90, verified: true },
      6: { durationMinutes: 80, totalMarks: 50, verified: true },
    },
  },
};

/**
 * MM from the filename -> canonical session name.
 *
 * The canonical set is the one the app validates against in
 * src/lib/catalogue/exam-sessions.ts. A month outside this map is skipped with
 * a reason rather than guessed at, so widening it is a deliberate edit here.
 */
const SESSION_BY_MONTH: Record<string, string> = {
  "01": "January",
  "02": "January",
  "05": "May-June",
  "06": "May-June",
  "10": "October-November",
  "11": "October-November",
};

/** Years after this are skipped unless named by --include-year. */
const MAX_YEAR = 2025;

/**
 * Directory names skipped wholesale, matched per path segment.
 *
 * The real trees number their folders for sort order — "1 - SAM",
 * "2 - January" — and Finder has left its own marks: Biology's is
 * "1 - SAM copy". So the comparison strips a leading "<n> - " AND a trailing
 * " copy"/" copy 2" before matching, and ignores case and surrounding space
 * (several of these folders have a trailing space). Without that this list
 * silently matches nothing and the rule only appears to work.
 */
const SKIP_DIRECTORIES = ["SAM"];

function normaliseSegment(segment: string): string {
  return segment
    .replace(/^\s*\d+\s*[-–—.]\s*/, "")
    .replace(/\s+copy(\s+\d+)?\s*$/i, "")
    .trim()
    .toLowerCase();
}

/** The content_status enum from migration 0001. Checked up front so a typo in
 *  --status is one clear error rather than the same Postgres failure per row. */
const CONTENT_STATUS = ["draft", "live", "in_progress", "coming_soon", "archived"];

/** En dash, U+2013 — matches the paper_name of every row already in the table. */
const NAME_DASH = "–";

// ============================================================================
// CLI
// ============================================================================

type Options = {
  root: string;
  subject: string;
  config: SubjectConfig;
  commit: boolean;
  includeYears: Set<number>;
  rateMs: number;
  status: string;
  allowUnverified: boolean;
  reportPath: string;
  limit: number | null;
};

const USAGE = `
bulk-import-papers — import Edexcel IAL past-paper PDFs into Supabase

  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \\
    scripts/bulk-import-papers.ts --root=<folder> [options]

  --root=<path>                 Folder to walk. Required.
  --subject=<${Object.keys(SUBJECTS).join("|")}>  Which subject's papers live under --root.
                                Default chemistry. Decides the paper codes
                                accepted, the course/unit mapping, and the
                                duration/marks table.
  --commit                      Actually upload and insert. Without this the
                                script is a dry run and writes nothing.
  --include-year=2026[,2027]    Allow a year above ${MAX_YEAR}. Repeatable.
  --rate-ms=<n>                 Pause between papers, in ms. Default 300.
  --status=<live|draft|...>     status for new rows. Default live.
  --allow-unverified-metadata   Permit rows whose unit duration/marks are not
                                corroborated by existing data.
  --limit=<n>                   Import at most n papers (useful for a first
                                real run of one or two).
  --report=<path>               JSON report destination.
                                Default ./bulk-import-report.json
  --help
`;

function parseArgs(argv: string[]): Options {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const flags = new Map<string, string[]>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) fail(`Unrecognised argument: ${arg}`);
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq === -1 ? "" : arg.slice(eq + 1);
    const existing = flags.get(key);
    if (existing) existing.push(value);
    else flags.set(key, [value]);
  }

  const known = new Set([
    "root",
    "subject",
    "commit",
    "dry-run",
    "include-year",
    "rate-ms",
    "status",
    "allow-unverified-metadata",
    "limit",
    "report",
  ]);
  for (const key of flags.keys()) {
    if (!known.has(key)) fail(`Unrecognised flag: --${key}\n${USAGE}`);
  }

  const root = flags.get("root")?.[0];
  if (!root) fail(`--root is required.\n${USAGE}`);

  // Chemistry stays the default so every command already in use keeps working.
  const subject = (flags.get("subject")?.[0] || "chemistry").toLowerCase();
  const config = SUBJECTS[subject];
  if (!config) {
    fail(`--subject must be one of: ${Object.keys(SUBJECTS).join(", ")} (got "${subject}")`);
  }

  const includeYears = new Set<number>();
  for (const raw of flags.get("include-year") ?? []) {
    for (const part of raw.split(",")) {
      const year = Number(part.trim());
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        fail(`--include-year expects a 4-digit year, got: ${part}`);
      }
      includeYears.add(year);
    }
  }

  const rateRaw = flags.get("rate-ms")?.[0];
  const rateMs = rateRaw === undefined || rateRaw === "" ? 300 : Number(rateRaw);
  if (!Number.isFinite(rateMs) || rateMs < 0) fail("--rate-ms expects a number");

  const limitRaw = flags.get("limit")?.[0];
  const limit =
    limitRaw === undefined || limitRaw === "" ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    fail("--limit expects a positive integer");
  }

  const status = flags.get("status")?.[0] || "live";
  if (!CONTENT_STATUS.includes(status)) {
    fail(`--status must be one of: ${CONTENT_STATUS.join(", ")} (got "${status}")`);
  }

  return {
    root: resolve(root),
    subject,
    config,
    commit: flags.has("commit"),
    includeYears,
    rateMs,
    status,
    allowUnverified: flags.has("allow-unverified-metadata"),
    reportPath: resolve(flags.get("report")?.[0] || "bulk-import-report.json"),
    limit,
  };
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// ============================================================================
// ENVIRONMENT
// ============================================================================

/**
 * Read .env.local by hand rather than with --env-file.
 *
 * That file is not shell-sourceable and has been hand-edited more than once, so
 * values are trimmed and surrounding quotes stripped. An already-exported
 * variable wins, so a one-off run against a different project needs no edit to
 * the file.
 */
async function loadEnv(): Promise<{ url: string; serviceKey: string }> {
  const fromFile = new Map<string, string>();
  try {
    const raw = await readFile(resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFile.set(key, value);
    }
  } catch {
    // Absent .env.local is fine when the variables are already exported.
  }

  const read = (key: string) => process.env[key]?.trim() || fromFile.get(key);
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL not found in env or .env.local");
  if (!serviceKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY not found in env or .env.local");
  }
  return { url, serviceKey };
}

// ============================================================================
// DISCOVERY
// ============================================================================

type ParsedFile = {
  absPath: string;
  relPath: string;
  fileName: string;
  code: string;
  entry: string;
  month: string;
  year: number;
  kind: FileKind;
  /** True for a browser/Finder duplicate such as "…_QU (1).pdf". */
  duplicateSuffix: boolean;
  /** Identity of the exam sitting: everything before the QU/MS/ER suffix. */
  pairKey: string;
};

/**
 * QU and MS are both required for a row to import. ER — the examiner report —
 * is optional: it exists for roughly two thirds of the sittings, and the
 * past_papers row has a third slot for it that the paper card already renders.
 * A sitting with no ER imports exactly as it did before.
 */
type FileKind = "QU" | "MS" | "ER";

type Skip = { path: string; reason: string };

/**
 * Filename rule for one subject: <CODE>_<entry>_<MMYY>_<QU|MS|ER>.pdf
 *
 * The trailing " (1)" group is the suffix a browser adds when the same file is
 * downloaded twice, and Finder keeps it on copy. It has to be tolerated: in the
 * Biology tree 29 of the question-paper/mark-scheme slots exist ONLY under a
 * suffixed name, so refusing them silently drops 15 whole papers. It is safe to
 * tolerate because the suffix is captured and, where a sitting somehow offers
 * both forms, planRows prefers the clean one rather than calling it ambiguous.
 */
function buildFilenameRe(config: SubjectConfig): RegExp {
  const codes = Object.keys(config.paperCodes).join("|");
  return new RegExp(
    `^(${codes})_(\\d{2})_(\\d{2})(\\d{2})_(QU|MS|ER)(?: \\((\\d+)\\))?\\.pdf$`,
    "i",
  );
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Finder and iCloud litter these through synced folders.
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function parseFile(
  absPath: string,
  root: string,
  options: Options,
  filenameRe: RegExp,
  skips: Skip[],
): ParsedFile | null {
  const relPath = relative(root, absPath);
  const fileName = basename(absPath);
  const note = (reason: string) => {
    skips.push({ path: relPath, reason });
    return null;
  };

  const segments = relPath.split(sep).slice(0, -1);
  const skipped = segments.find((s) =>
    SKIP_DIRECTORIES.some((d) => normaliseSegment(d) === normaliseSegment(s)),
  );
  if (skipped) return note(`in a skipped directory (${skipped})`);

  if (!fileName.toLowerCase().endsWith(".pdf")) return note("not a PDF");

  const match = filenameRe.exec(fileName);
  if (!match) {
    const codes = Object.keys(options.config.paperCodes);
    return note(
      `filename does not match <${codes[0]}…${codes[codes.length - 1]}>_<entry>_<MMYY>_<QU|MS|ER>.pdf`,
    );
  }

  const code = match[1].toUpperCase();
  const entry = match[2];
  const month = match[3];
  const year = 2000 + Number(match[4]);
  const kind = match[5].toUpperCase() as FileKind;
  const duplicateSuffix = match[6] !== undefined;

  if (!SESSION_BY_MONTH[month]) {
    return note(`month "${month}" is not a known exam session`);
  }
  if (year > MAX_YEAR && !options.includeYears.has(year)) {
    return note(`year ${year} is after ${MAX_YEAR} (pass --include-year=${year})`);
  }

  return {
    absPath,
    relPath,
    fileName,
    code,
    entry,
    month,
    year,
    kind,
    duplicateSuffix,
    pairKey: `${code}_${entry}_${month}${match[4]}`,
  };
}

// ============================================================================
// CATALOGUE RESOLUTION
// ============================================================================

type Resolved = { unitId: string; courseId: string };

/**
 * Turn every paper code the run actually needs into real ids, and abort if any
 * of it is missing or contradicts the subject's paperCodes table.
 *
 * units.code holds exactly the paper code — "WCH11".."WCH16" for Chemistry,
 * "WBI11".."WBI16" for Biology — so the unit resolves directly and carries its
 * own course_id, with no guessing from names. The declared mapping is then
 * asserted against what came back: course slug, level, and the unit number
 * parsed out of units.name must all agree, or the run stops.
 */
async function loadCatalogue(
  db: SupabaseClient,
  needed: Set<string>,
  config: SubjectConfig,
): Promise<Map<string, Resolved>> {
  const { data, error } = await db
    .from("units")
    .select("id, code, name, course:courses(id, slug, level)")
    .in("code", [...needed]);

  if (error) {
    fail(`Could not read units from the database: ${error.message}`);
  }

  type Row = {
    id: string;
    code: string | null;
    name: string;
    course: { id: string; slug: string; level: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const byCode = new Map<string, Row>();
  for (const row of rows) {
    if (!row.code) continue;
    const key = row.code.toUpperCase();
    if (byCode.has(key)) {
      fail(
        `Ambiguous catalogue: two units both have code ${key}. ` +
          `Resolve the duplicate before importing.`,
      );
    }
    byCode.set(key, row);
  }

  const resolved = new Map<string, Resolved>();
  const problems: string[] = [];

  for (const code of needed) {
    const expected = config.paperCodes[code];
    if (!expected) {
      problems.push(`${code}: not a paper code this subject declares`);
      continue;
    }
    const row = byCode.get(code);
    if (!row) {
      problems.push(`${code}: no unit row with that code`);
      continue;
    }
    if (!row.course) {
      problems.push(`${code}: unit ${row.id} has no course`);
      continue;
    }
    if (row.course.slug !== expected.courseSlug) {
      problems.push(
        `${code}: expected course ${expected.courseSlug}, database says ${row.course.slug}`,
      );
      continue;
    }
    if (row.course.level !== expected.level) {
      problems.push(
        `${code}: expected level ${expected.level}, database says ${row.course.level}`,
      );
      continue;
    }
    // units.name begins "Unit N:" — the same source the paper list card reads.
    const unitNumber = Number(/^\s*Unit\s+(\d+)/i.exec(row.name)?.[1]);
    if (unitNumber !== expected.unitNumber) {
      problems.push(
        `${code}: expected unit ${expected.unitNumber}, database name is ${JSON.stringify(row.name)}`,
      );
      continue;
    }
    resolved.set(code, { unitId: row.id, courseId: row.course.id });
  }

  if (problems.length) {
    fail(
      "Catalogue does not match the expected mapping:\n" +
        problems.map((p) => `    • ${p}`).join("\n"),
    );
  }
  return resolved;
}

// ============================================================================
// PLANNING
// ============================================================================

type PlannedRow = {
  id: string;
  courseId: string;
  unitId: string;
  code: string;
  unitNumber: number;
  entry: string;
  slug: string;
  session: string;
  year: number;
  paperCode: string;
  paperName: string;
  durationMinutes: number;
  totalMarks: number;
  metadataVerified: boolean;
  questionPaper: ParsedFile;
  markScheme: ParsedFile;
  /** Optional — most but not all sittings have one. */
  examinerReport: ParsedFile | null;
  paperPath: string;
  markschemePath: string;
  examinerReportPath: string | null;
};

function slugify(session: string): string {
  return session.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Of several files claiming the same slot, take the one with a clean name.
 *
 * "…_QU.pdf" always beats "…_QU (1).pdf". Only when every candidate is a
 * duplicate — which is the common case in the Biology tree, where 29 slots have
 * no clean copy at all — does a suffixed file get used, and then the single
 * remaining one is unambiguous. Returns null when the choice is genuinely
 * undecidable, i.e. two or more equally-clean names.
 */
function pickOne(candidates: ParsedFile[]): ParsedFile | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const clean = candidates.filter((f) => !f.duplicateSuffix);
  if (clean.length === 1) return clean[0];
  return null;
}

/**
 * Pair QU with MS, drop anything unpaired, and shape the rows.
 *
 * Pairing is global rather than per-directory: the pair key carries the paper
 * code, entry and MMYY, which identifies a sitting on its own, so a mark scheme
 * filed under the wrong year folder still finds its paper. A slot that stays
 * ambiguous after pickOne is refused rather than resolved by guessing.
 */
function planRows(
  files: ParsedFile[],
  catalogue: Map<string, Resolved>,
  config: SubjectConfig,
  skips: Skip[],
  now: () => number,
): PlannedRow[] {
  const groups = new Map<
    string,
    { QU: ParsedFile[]; MS: ParsedFile[]; ER: ParsedFile[] }
  >();
  for (const file of files) {
    let group = groups.get(file.pairKey);
    if (!group) groups.set(file.pairKey, (group = { QU: [], MS: [], ER: [] }));
    group[file.kind].push(file);
  }

  const rows: PlannedRow[] = [];
  const bySlug = new Map<string, PlannedRow>();

  for (const [pairKey, group] of [...groups].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const all = [...group.QU, ...group.MS, ...group.ER];

    // QU and MS are both required. An examiner report without them is not a
    // paper, so it is reported alongside whatever else was orphaned.
    if (group.QU.length === 0) {
      for (const f of [...group.MS, ...group.ER]) {
        skips.push({ path: f.relPath, reason: `no question paper for ${pairKey}` });
      }
      continue;
    }
    if (group.MS.length === 0) {
      for (const f of [...group.QU, ...group.ER]) {
        skips.push({ path: f.relPath, reason: `no mark scheme for ${pairKey}` });
      }
      continue;
    }
    const questionPaper = pickOne(group.QU);
    const markScheme = pickOne(group.MS);
    if (!questionPaper || !markScheme) {
      for (const f of all) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.QU.length} QU and ${group.MS.length} MS share the key ${pairKey}, none clearly canonical`,
        });
      }
      continue;
    }

    // The examiner report is optional, so an ambiguous one costs only itself:
    // the paper still imports, just without an ER rather than not at all.
    const examinerReport = pickOne(group.ER);
    if (!examinerReport && group.ER.length > 0) {
      for (const f of group.ER) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.ER.length} examiner reports share the key ${pairKey}; importing the paper without one`,
        });
      }
    }
    const resolved = catalogue.get(questionPaper.code);
    if (!resolved) continue; // loadCatalogue already aborted on anything missing.

    const { unitNumber } = config.paperCodes[questionPaper.code];
    const meta = config.unitMetadata[unitNumber];
    if (!meta) {
      for (const f of all) {
        skips.push({ path: f.relPath, reason: `no duration/marks configured for unit ${unitNumber}` });
      }
      continue;
    }

    const session = SESSION_BY_MONTH[questionPaper.month];
    const slug = `unit-${unitNumber}-${slugify(session)}-${questionPaper.year}`;

    // The slug deliberately omits the entry code, so two entries of the same
    // unit and sitting collapse onto one slug. Refuse both rather than let the
    // second silently lose to a unique-constraint skip.
    const clash = bySlug.get(slug);
    if (clash) {
      for (const f of all) {
        skips.push({
          path: f.relPath,
          reason: `slug ${slug} already claimed in this run by ${clash.questionPaper.fileName}`,
        });
      }
      continue;
    }

    const id = crypto.randomUUID();
    const paperPath = buildPaperPath(id, "paper", now());
    const markschemePath = buildPaperPath(id, "markscheme", now());
    const examinerReportPath = examinerReport
      ? buildPaperPath(id, "examiner-report", now())
      : null;

    // The app refuses to store a path it could not have minted. Assert here so
    // a bad key is a planning-time abort, not a half-uploaded paper.
    for (const path of [paperPath, markschemePath, examinerReportPath]) {
      if (path !== null && !isValidPaperPath(path)) {
        fail(`Built an invalid storage path: ${path} — refusing to continue.`);
      }
    }

    const row: PlannedRow = {
      id,
      courseId: resolved.courseId,
      unitId: resolved.unitId,
      code: questionPaper.code,
      unitNumber,
      entry: questionPaper.entry,
      slug,
      session,
      year: questionPaper.year,
      paperCode: `${questionPaper.code}/${questionPaper.entry}`,
      // Matches the ten rows already in the table, en dash included.
      paperName: `${session} ${questionPaper.year} ${NAME_DASH} Unit ${unitNumber} Question Paper`,
      durationMinutes: meta.durationMinutes,
      totalMarks: meta.totalMarks,
      metadataVerified: meta.verified,
      questionPaper,
      markScheme,
      examinerReport,
      paperPath,
      markschemePath,
      examinerReportPath,
    };
    rows.push(row);
    bySlug.set(slug, row);
  }

  return rows.sort(
    (a, b) =>
      a.unitNumber - b.unitNumber ||
      a.year - b.year ||
      a.session.localeCompare(b.session),
  );
}

/**
 * Drop rows whose (course_id, slug) is already taken.
 *
 * The unique constraint is the real guard and is still caught at insert time,
 * but checking first means an existing paper costs nothing — no PDF is read,
 * and no storage object is created only to be deleted again.
 */
async function dropExisting(
  db: SupabaseClient,
  rows: PlannedRow[],
  skips: Skip[],
): Promise<PlannedRow[]> {
  if (rows.length === 0) return rows;

  const { data, error } = await db
    .from("past_papers")
    .select("slug, course_id")
    .in("slug", [...new Set(rows.map((r) => r.slug))]);

  if (error) fail(`Could not read existing past_papers: ${error.message}`);

  const taken = new Set(
    ((data ?? []) as { slug: string; course_id: string }[]).map(
      (r) => `${r.course_id}::${r.slug}`,
    ),
  );

  return rows.filter((row) => {
    if (!taken.has(`${row.courseId}::${row.slug}`)) return true;
    skips.push({
      path: row.questionPaper.relPath,
      reason: `${row.slug} already exists in past_papers`,
    });
    return false;
  });
}


/**
 * Dry-run audit: the full per-row picture, plus the gates that must hold before
 * a single byte is written. Every one of these ABORTS the run rather than
 * skipping the row — an import that silently drops papers is worse than one
 * that stops and says why.
 */
async function auditRows(
  db: SupabaseClient,
  rows: PlannedRow[],
  config: SubjectConfig,
  subject: string,
): Promise<number> {
  // Existing (course_id, slug) pairs, to catch a duplicate before it is made.
  const { data: existing, error: exErr } = await db
    .from("past_papers")
    .select("slug, course_id, paper_code");
  if (exErr) fail(`could not read past_papers for the duplicate check: ${exErr.message}`);
  const taken = new Set(
    ((existing ?? []) as { slug: string; course_id: string }[]).map(
      (r) => `${r.course_id}::${r.slug}`,
    ),
  );

  const blocked: { row: PlannedRow; reasons: string[] }[] = [];

  console.log("\nPER-ROW DETAIL — every source file, and the row it would create\n");
  for (const [i, row] of rows.entries()) {
    const reasons: string[] = [];

    // Gate: %PDF- header on every source file.
    const files: [string, ParsedFile | null, string][] = [
      ["question paper", row.questionPaper, row.paperPath],
      ["mark scheme", row.markScheme, row.markschemePath],
      ["examiner report", row.examinerReport, row.examinerReportPath ?? ""],
    ];
    const pageCounts: Record<string, number | string> = {};
    for (const [kind, file] of files) {
      if (!file) continue;
      const fd = await readFile(file.absPath);
      if (fd.subarray(0, 5).toString() !== "%PDF-") {
        reasons.push(`${kind}: missing %PDF- header (${JSON.stringify(fd.subarray(0, 5).toString())})`);
      }
      try {
        pageCounts[kind] = (await inspectStamp(file.absPath)).pages;
      } catch (e) {
        pageCounts[kind] = "unreadable";
        reasons.push(`${kind}: unreadable — ${(e as Error).message.split("\n")[0]}`);
      }
    }

    // Gate: the paper code must be one this subject declares.
    if (!config.paperCodes[row.code]) {
      reasons.push(`paper code ${row.code} is not declared for --subject=${subject}`);
    }

    // Gate: duration and marks must be real, not placeholders. A value that is
    // present but unverified is treated as missing: it is a guess, and a wrong
    // mark total is invisible once several hundred rows carry it.
    const meta = config.unitMetadata[row.unitNumber];
    if (!meta) reasons.push(`no duration/marks configured for unit ${row.unitNumber}`);
    else if (!meta.durationMinutes || !meta.totalMarks) {
      reasons.push(`unit ${row.unitNumber}: duration_minutes or total_marks is empty`);
    } else if (!meta.verified) {
      reasons.push(
        `unit ${row.unitNumber}: duration_minutes=${meta.durationMinutes} / total_marks=${meta.totalMarks} are UNVERIFIED placeholders`,
      );
    }

    // Gate: no duplicate against an existing row.
    if (taken.has(`${row.courseId}::${row.slug}`)) {
      reasons.push(`duplicate — a past_papers row already exists for this course and slug ${row.slug}`);
    }

    console.log(
      `[${i + 1}/${rows.length}] ${row.slug}\n` +
      `    sources : ${row.questionPaper.relPath}  (${pageCounts["question paper"] ?? "-"}p)\n` +
      `              ${row.markScheme.relPath}  (${pageCounts["mark scheme"] ?? "-"}p)\n` +
      (row.examinerReport
        ? `              ${row.examinerReport.relPath}  (${pageCounts["examiner report"] ?? "-"}p)\n`
        : `              (no examiner report)\n`) +
      `    parsed  : ${row.paperCode}   ${row.session}   ${row.year}   unit ${row.unitNumber}\n` +
      `    storage : ${row.paperPath}\n` +
      `              ${row.markschemePath}\n` +
      (row.examinerReportPath ? `              ${row.examinerReportPath}\n` : "") +
      `    row     : slug=${row.slug}  paper_code=${row.paperCode}  session=${row.session}  year=${row.year}\n` +
      `              paper_name=${JSON.stringify(row.paperName)}\n` +
      `              duration_minutes=${row.durationMinutes}  total_marks=${row.totalMarks}` +
      `  (${meta?.verified ? "verified" : "UNVERIFIED"})\n` +
      `    -> ${reasons.length ? "BLOCKED — " + reasons.join("; ") : "ready"}`,
    );

    if (reasons.length) blocked.push({ row, reasons });
  }

  if (blocked.length) {
    const byReason = new Map<string, number>();
    for (const b of blocked)
      for (const r of b.reasons) {
        const k = r.replace(/unit \d+/, "unit N").replace(/slug \S+/, "slug …");
        byReason.set(k, (byReason.get(k) ?? 0) + 1);
      }
    console.error(`\n✖ ABORT — ${blocked.length} of ${rows.length} row(s) are blocked:\n`);
    for (const [reason, n] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.error(`    ${n} × ${reason}`);
    }
  }
  return blocked.length;
}

// ============================================================================
// IMPORT
// ============================================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function uploadPdf(
  db: SupabaseClient,
  fullPath: string,
  bytes: Buffer,
): Promise<void> {
  // buildPaperPath already includes the bucket segment, and storage-js prepends
  // the bucket again in _getFinalPath. That double prefix is not a bug to fix
  // here — it is the existing convention: every stored path in past_papers is
  // "papers/<uuid>/..." and every object in the bucket lives under a top-level
  // "papers/" folder. Passing the path verbatim is what reproduces it.
  const { error } = await db.storage
    .from(PAPERS_BUCKET)
    .upload(fullPath, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`upload ${fullPath}: ${error.message}`);
}

async function importOne(
  db: SupabaseClient,
  row: PlannedRow,
  status: string,
): Promise<"inserted" | "conflict"> {
  // Stamp BEFORE upload. The bytes that reach the bucket are the stamped ones;
  // the local originals are never modified.
  const work = await mkdtemp(join(tmpdir(), "ailemy-import-"));
  // Each of these conditions ENDS THE RUN rather than skipping the file. A
  // stamp landing wrong is a fault in the geometry or the source, not bad luck
  // with one PDF, and continuing would spread it across the rest of the import
  // before anyone read the log. Nothing has been uploaded at this point, so the
  // abort leaves the bucket untouched.
  const stampLog: string[] = [];
  const stampTo = async (srcPath: string, tag: string) => {
    const out = join(work, `${tag}.pdf`);
    const insp = await stampForUpload(srcPath, out);
    const bytes = await readFile(out);
    const bad: string[] = [];
    if (insp.correct_pages !== insp.pages)
      bad.push(`correct ${insp.correct_pages} != pages ${insp.pages}`);
    if (insp.misplaced_pages) bad.push(`misplaced ${insp.misplaced_pages}`);
    if (insp.above_cropbox_pages) bad.push(`above CropBox ${insp.above_cropbox_pages}`);
    if (bytes.length < 1024) bad.push(`${bytes.length} bytes (< 1KB)`);
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      bad.push(`header ${JSON.stringify(bytes.subarray(0, 5).toString())}`);

    if (bad.length) {
      console.error(
        `\n✖ STAMP VERIFICATION FAILED — ${row.slug} · ${tag}\n` +
          `    source : ${srcPath}\n` +
          `    pages ${insp.pages}  correct ${insp.correct_pages}  misplaced ${insp.misplaced_pages}  above ${insp.above_cropbox_pages}  bytes ${bytes.length}\n` +
          `    ${bad.join("; ")}\n` +
          `    Nothing was uploaded for this row.`,
      );
      await rm(work, { recursive: true, force: true });
      fail("aborting the whole run.");
    }
    stampLog.push(`${tag} ${insp.pages}p correct=${insp.correct_pages} mis=${insp.misplaced_pages} above=${insp.above_cropbox_pages} ${bytes.length}B`);
    return bytes;
  };

  const [paperBytes, markschemeBytes, examinerReportBytes] = await Promise.all([
    stampTo(row.questionPaper.absPath, "paper"),
    stampTo(row.markScheme.absPath, "markscheme"),
    row.examinerReport ? stampTo(row.examinerReport.absPath, "examiner-report") : null,
  ]);

  const uploaded: string[] = [];
  try {
    await uploadPdf(db, row.paperPath, paperBytes);
    uploaded.push(row.paperPath);
    await uploadPdf(db, row.markschemePath, markschemeBytes);
    uploaded.push(row.markschemePath);
    if (row.examinerReportPath && examinerReportBytes) {
      await uploadPdf(db, row.examinerReportPath, examinerReportBytes);
      uploaded.push(row.examinerReportPath);
    }

    const { error } = await db.from("past_papers").insert({
      id: row.id,
      course_id: row.courseId,
      unit_id: row.unitId,
      slug: row.slug,
      year: row.year,
      session: row.session,
      paper_code: row.paperCode,
      paper_name: row.paperName,
      paper_pdf_path: row.paperPath,
      markscheme_pdf_path: row.markschemePath,
      examiner_report_pdf_path: row.examinerReportPath,
      duration_minutes: row.durationMinutes,
      total_marks: row.totalMarks,
      status,
    });

    if (error) {
      // 23505 = unique_violation on (course_id, slug). The brief asks for this
      // to skip rather than end the run, so a re-run after a partial import is
      // safe. dropExisting catches almost all of these first; this covers a row
      // created between that read and this write.
      if (error.code === "23505") {
        await removeObjects(db, uploaded);
        return "conflict";
      }
      throw new Error(`insert ${row.slug}: ${error.message} (${error.code})`);
    }
    console.log(`      ${stampLog.join("\n      ")}`);
    return "inserted";
  } catch (err) {
    // Never leave objects behind for a row that does not exist.
    await removeObjects(db, uploaded);
    throw err;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function removeObjects(db: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(PAPERS_BUCKET).remove(paths);
  if (error) {
    console.warn(
      `  ! could not clean up ${paths.join(", ")}: ${error.message}\n` +
        `    Sweep it with the orphan query in supabase/migrations/0016_papers_bucket_rls.sql`,
    );
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

function printTable(rows: PlannedRow[]) {
  const header = [
    "#",
    "slug",
    "paper_code",
    "session",
    "year",
    "dur",
    "marks",
    "question paper",
    "mark scheme",
    "examiner report",
  ];
  const body = rows.map((row, i) => [
    String(i + 1),
    row.slug,
    row.paperCode,
    row.session,
    String(row.year),
    `${row.durationMinutes}${row.metadataVerified ? "" : "?"}`,
    `${row.totalMarks}${row.metadataVerified ? "" : "?"}`,
    row.questionPaper.fileName,
    row.markScheme.fileName,
    row.examinerReport?.fileName ?? "—",
  ]);

  const widths = header.map((h, c) =>
    Math.max(h.length, ...body.map((r) => r[c].length)),
  );
  const line = (cells: string[]) =>
    "  " + cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log(line(header));
  console.log("  " + widths.map((w) => "─".repeat(w)).join("  "));
  for (const r of body) console.log(line(r));
}

function printSkips(skips: Skip[]) {
  if (skips.length === 0) {
    console.log("\nSkipped: none.");
    return;
  }
  const byReason = new Map<string, Skip[]>();
  for (const skip of skips) {
    // Collapse the variable tail so the summary groups by kind of problem.
    const bucket = skip.reason.replace(/\(.*\)|\b[\w-]+\.pdf\b|unit-[\w-]+/g, "…");
    const list = byReason.get(bucket) ?? [];
    list.push(skip);
    byReason.set(bucket, list);
  }

  console.log(`\nSkipped ${skips.length} file(s):`);
  for (const [reason, list] of [...byReason].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n  ${list.length} × ${reason}`);
    for (const skip of list.slice(0, 10)) {
      console.log(`      ${skip.path}`);
      if (skip.reason !== reason) console.log(`        ↳ ${skip.reason}`);
    }
    if (list.length > 10) console.log(`      … and ${list.length - 10} more`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = await loadEnv();

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\nSubject: ${options.config.label}  (--subject=${options.subject})`);
  console.log(`Root   : ${options.root}`);
  console.log(`Mode   : ${options.commit ? "COMMIT — writes to Supabase" : "DRY RUN — writes nothing"}`);
  console.log(`Status : ${options.status}`);
  if (options.includeYears.size) {
    console.log(`Years  : ${MAX_YEAR} and earlier, plus ${[...options.includeYears].join(", ")}`);
  } else {
    console.log(`Years  : ${MAX_YEAR} and earlier`);
  }

  // ---- discover -----------------------------------------------------------
  let allPaths: string[];
  try {
    allPaths = await walk(options.root);
  } catch (err) {
    return fail(`Could not read --root: ${(err as Error).message}`);
  }

  const skips: Skip[] = [];
  const parsed: ParsedFile[] = [];
  const filenameRe = buildFilenameRe(options.config);
  for (const path of allPaths.sort()) {
    const file = parseFile(path, options.root, options, filenameRe, skips);
    if (file) parsed.push(file);
  }
  console.log(`\nFound ${allPaths.length} file(s); ${parsed.length} match the paper naming scheme.`);
  if (parsed.length === 0) {
    printSkips(skips);
    await writeReport(options, [], skips, "no-matching-files");
    return;
  }

  // ---- resolve ------------------------------------------------------------
  const needed = new Set(parsed.map((f) => f.code));
  const catalogue = await loadCatalogue(db, needed, options.config);
  console.log(
    `Resolved ${catalogue.size} paper code(s) against the catalogue: ${[...needed].sort().join(", ")}`,
  );

  // ---- plan ---------------------------------------------------------------
  let counter = 0;
  // Distinct timestamps keep the two keys of a pair apart, and keep every key
  // in a run unique even when the loop runs inside one millisecond.
  const now = () => Date.now() + counter++;

  let rows = planRows(parsed, catalogue, options.config, skips, now);
  rows = await dropExisting(db, rows, skips);
  if (options.limit !== null && rows.length > options.limit) {
    const dropped = rows.slice(options.limit);
    for (const row of dropped) {
      skips.push({ path: row.questionPaper.relPath, reason: `beyond --limit=${options.limit}` });
    }
    console.log(`\n--limit=${options.limit}: ${dropped.length} further row(s) held back.`);
    rows = rows.slice(0, options.limit);
  }

  if (rows.length === 0) {
    console.log("\nNothing to import.");
    printSkips(skips);
    await writeReport(options, [], skips, "nothing-to-import");
    return;
  }

  const withEr = rows.filter((r) => r.examinerReport).length;
  console.log(`\n${rows.length} row(s) to insert:\n`);
  printTable(rows);
  console.log(
    `\n${withEr} of ${rows.length} row(s) carry an examiner report; ${rows.length - withEr} have none.`,
  );

  // ---- unverified metadata gate ------------------------------------------
  const unverified = rows.filter((r) => !r.metadataVerified);
  if (unverified.length) {
    const units = [...new Set(unverified.map((r) => r.unitNumber))].sort();
    console.log(
      `\n⚠  ${unverified.length} row(s) carry UNVERIFIED duration/marks (marked "?" above).` +
        `\n   Unit(s) ${units.join(", ")} have no corroborating row in past_papers — the values come` +
        `\n   from SUBJECTS.${options.subject}.unitMetadata at the top of this script and nothing` +
        `\n   has checked them. Confirm them against the specification before committing.`,
    );
    if (options.commit && !options.allowUnverified) {
      printSkips(skips);
      fail(
        `Refusing to commit unverified metadata. Either correct ` +
          `SUBJECTS.${options.subject}.unitMetadata, or re-run with ` +
          `--allow-unverified-metadata once you have checked it.`,
      );
    }
  }

  // ---- dry run stops here -------------------------------------------------
  if (!options.commit) {
    const blockedCount = await auditRows(db, rows, options.config, options.subject);
    printSkips(skips);
    console.log(
      `\nSUMMARY  files found ${allPaths.length}` +
      `  |  parseable ${parsed.length}` +
      `  |  rows planned ${rows.length}` +
      `  |  ready to import ${rows.length - blockedCount}` +
      `  |  blocked ${blockedCount}`,
    );
    console.log("\nDRY RUN — nothing was stamped, uploaded or inserted.");
    await writeReport(options, rows, skips, "dry-run");
    if (blockedCount) process.exitCode = 1;
    return;
  }
  if (false) {
    printSkips(skips);
    console.log("\nDRY RUN — nothing was uploaded and nothing was inserted.");
    console.log("Re-run with --commit to write.\n");
    await writeReport(options, rows, skips, "dry-run");
    return;
  }

  // ---- commit -------------------------------------------------------------
  console.log(`\nImporting ${rows.length} paper(s)…\n`);
  let inserted = 0;
  let conflicts = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const [i, row] of rows.entries()) {
    const label = `[${i + 1}/${rows.length}] ${row.slug}`;
    try {
      const result = await importOne(db, row, options.status);
      if (result === "inserted") {
        inserted++;
        console.log(`${label} ✓ inserted`);
      } else {
        conflicts++;
        console.log(`${label} — skipped, slug already exists`);
        skips.push({ path: row.questionPaper.relPath, reason: `${row.slug} already exists (unique violation at insert)` });
      }
    } catch (err) {
      const message = (err as Error).message;
      failures.push({ slug: row.slug, error: message });
      console.error(`${label} ✖ ${message}`);
    }
    if (options.rateMs) await sleep(options.rateMs);
  }

  console.log(
    `\nDone. ${inserted} inserted, ${conflicts} already existed, ${failures.length} failed.`,
  );
  printSkips(skips);
  await writeReport(options, rows, skips, "commit", failures);
  if (failures.length) process.exitCode = 1;
}

async function writeReport(
  options: Options,
  rows: PlannedRow[],
  skips: Skip[],
  mode: string,
  failures: { slug: string; error: string }[] = [],
) {
  const report = {
    mode,
    subject: options.subject,
    root: options.root,
    committed: options.commit,
    planned: rows.map((r) => ({
      slug: r.slug,
      paper_code: r.paperCode,
      session: r.session,
      year: r.year,
      unit: r.unitNumber,
      duration_minutes: r.durationMinutes,
      total_marks: r.totalMarks,
      metadata_verified: r.metadataVerified,
      paper_pdf_path: r.paperPath,
      markscheme_pdf_path: r.markschemePath,
      examiner_report_pdf_path: r.examinerReportPath,
      source_question_paper: r.questionPaper.relPath,
      source_mark_scheme: r.markScheme.relPath,
      source_examiner_report: r.examinerReport?.relPath ?? null,
    })),
    skipped: skips,
    failures,
  };
  await writeFile(options.reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nReport written to ${options.reportPath}`);
}

main().catch((err) => {
  console.error("\n✖ Unhandled failure:", err);
  process.exit(1);
});
