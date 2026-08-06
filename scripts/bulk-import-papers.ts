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

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Paper code -> which unit it is, and which course that unit must belong to.
 *
 * This is the brief's mapping, written out literally. It is a CHECK, not a
 * lookup: the real course_id/unit_id always come from the database (see
 * loadCatalogue). If the database ever disagrees with this table, the run
 * aborts rather than guessing which of the two is right.
 */
const PAPER_CODES = {
  WCH11: { unitNumber: 1, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
  WCH12: { unitNumber: 2, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
  WCH13: { unitNumber: 3, courseSlug: "edexcel-ial-as-chemistry", level: "AS" },
  WCH14: { unitNumber: 4, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
  WCH15: { unitNumber: 5, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
  WCH16: { unitNumber: 6, courseSlug: "edexcel-ial-a2-chemistry", level: "A2" },
} as const;

type PaperCode = keyof typeof PAPER_CODES;

/**
 * Exam duration and mark total, keyed by unit number.
 *
 * `verified: true` means the value is corroborated by rows an admin already
 * entered by hand in past_papers — it is not my guess. `verified: false` means
 * it comes from the Edexcel specification as I recall it and NOTHING in the
 * database confirms it. Committing any unverified row requires
 * --allow-unverified-metadata, because this script writes hundreds of rows at a
 * time and a wrong mark total is invisible once it is in.
 *
 * Corroboration at the time of writing (10 existing rows):
 *   unit 1 -> 90/80   4 rows agree
 *   unit 2 -> 90/80   3 rows agree
 *   unit 4 -> 105/90  2 rows agree
 *   unit 5 -> 105/90  confirmed by the author 2026-08-06. The existing
 *                     unit-5-january-2021 row says 58 marks; that is a typo in
 *                     THAT ROW and wants correcting by hand. Nothing here
 *                     updates a row that already exists.
 *   units 3, 6        no rows exist yet, and no WCH13/WCH16 papers are on disk,
 *                     so these two entries are unexercised so far.
 */
const UNIT_METADATA: Record<
  number,
  { durationMinutes: number; totalMarks: number; verified: boolean }
> = {
  1: { durationMinutes: 90, totalMarks: 80, verified: true },
  2: { durationMinutes: 90, totalMarks: 80, verified: true },
  3: { durationMinutes: 80, totalMarks: 50, verified: false },
  4: { durationMinutes: 105, totalMarks: 90, verified: true },
  5: { durationMinutes: 105, totalMarks: 90, verified: true },
  6: { durationMinutes: 80, totalMarks: 50, verified: false },
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
 * The real tree numbers its folders for sort order — "1 - SAM", "2 - January" —
 * so the comparison strips a leading "<n> - " before matching, and ignores case
 * and surrounding space (several of these folders have a trailing space).
 * Without that this list silently matches nothing.
 */
const SKIP_DIRECTORIES = ["SAM"];

function normaliseSegment(segment: string): string {
  return segment
    .replace(/^\s*\d+\s*[-–—.]\s*/, "")
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
  commit: boolean;
  includeYears: Set<number>;
  rateMs: number;
  status: string;
  allowUnverified: boolean;
  reportPath: string;
  limit: number | null;
};

const USAGE = `
bulk-import-papers — import Edexcel IAL Chemistry PDFs into Supabase

  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \\
    scripts/bulk-import-papers.ts --root=<folder> [options]

  --root=<path>                 Folder to walk. Required.
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
  code: PaperCode;
  entry: string;
  month: string;
  year: number;
  kind: FileKind;
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

const FILENAME_RE = /^(WCH1[1-6])_(\d{2})_(\d{2})(\d{2})_(QU|MS|ER)\.pdf$/i;

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

  const match = FILENAME_RE.exec(fileName);
  if (!match) {
    return note("filename does not match WCH1n_<entry>_<MMYY>_<QU|MS|ER>.pdf");
  }

  const code = match[1].toUpperCase() as PaperCode;
  const entry = match[2];
  const month = match[3];
  const year = 2000 + Number(match[4]);
  const kind = match[5].toUpperCase() as FileKind;

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
    pairKey: `${code}_${entry}_${month}${match[4]}`,
  };
}

// ============================================================================
// CATALOGUE RESOLUTION
// ============================================================================

type Resolved = { unitId: string; courseId: string };

/**
 * Turn every paper code the run actually needs into real ids, and abort if any
 * of it is missing or contradicts PAPER_CODES.
 *
 * units.code holds exactly "WCH11".."WCH16", so the unit resolves directly and
 * carries its own course_id — no guessing from names. The brief's mapping is
 * then asserted against what came back.
 */
async function loadCatalogue(
  db: SupabaseClient,
  needed: Set<PaperCode>,
): Promise<Map<PaperCode, Resolved>> {
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

  const resolved = new Map<PaperCode, Resolved>();
  const problems: string[] = [];

  for (const code of needed) {
    const expected = PAPER_CODES[code];
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
  code: PaperCode;
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
 * Pair QU with MS, drop anything unpaired, and shape the rows.
 *
 * Pairing is global rather than per-directory: the pair key carries the paper
 * code, entry and MMYY, which identifies a sitting on its own, so a mark scheme
 * filed under the wrong year folder still finds its paper. A key holding two
 * QUs (or two MSs) is refused rather than resolved by picking one.
 */
function planRows(
  files: ParsedFile[],
  catalogue: Map<PaperCode, Resolved>,
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
    if (group.QU.length > 1 || group.MS.length > 1) {
      for (const f of all) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.QU.length} QU and ${group.MS.length} MS share the key ${pairKey}`,
        });
      }
      continue;
    }

    const questionPaper = group.QU[0];
    const markScheme = group.MS[0];

    // The examiner report is optional, so an ambiguous one costs only itself:
    // the paper still imports, just without an ER rather than not at all.
    let examinerReport: ParsedFile | null = null;
    if (group.ER.length === 1) {
      examinerReport = group.ER[0];
    } else if (group.ER.length > 1) {
      for (const f of group.ER) {
        skips.push({
          path: f.relPath,
          reason: `ambiguous — ${group.ER.length} examiner reports share the key ${pairKey}; importing the paper without one`,
        });
      }
    }
    const resolved = catalogue.get(questionPaper.code);
    if (!resolved) continue; // loadCatalogue already aborted on anything missing.

    const { unitNumber } = PAPER_CODES[questionPaper.code];
    const meta = UNIT_METADATA[unitNumber];
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
  const [paperBytes, markschemeBytes, examinerReportBytes] = await Promise.all([
    readFile(row.questionPaper.absPath),
    readFile(row.markScheme.absPath),
    row.examinerReport ? readFile(row.examinerReport.absPath) : null,
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
    return "inserted";
  } catch (err) {
    // Never leave objects behind for a row that does not exist.
    await removeObjects(db, uploaded);
    throw err;
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

  console.log(`\nRoot   : ${options.root}`);
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
  for (const path of allPaths.sort()) {
    const file = parseFile(path, options.root, options, skips);
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
  const catalogue = await loadCatalogue(db, needed);
  console.log(
    `Resolved ${catalogue.size} paper code(s) against the catalogue: ${[...needed].sort().join(", ")}`,
  );

  // ---- plan ---------------------------------------------------------------
  let counter = 0;
  // Distinct timestamps keep the two keys of a pair apart, and keep every key
  // in a run unique even when the loop runs inside one millisecond.
  const now = () => Date.now() + counter++;

  let rows = planRows(parsed, catalogue, skips, now);
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
        `\n   Unit(s) ${units.join(", ")} have no corroborating row in past_papers — the values` +
        `\n   come from UNIT_METADATA at the top of this script and nothing has checked them.` +
        `\n   Confirm them against the specification before committing.`,
    );
    if (options.commit && !options.allowUnverified) {
      printSkips(skips);
      fail(
        "Refusing to commit unverified metadata. Either correct UNIT_METADATA, " +
          "or re-run with --allow-unverified-metadata once you have checked it.",
      );
    }
  }

  // ---- dry run stops here -------------------------------------------------
  if (!options.commit) {
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
