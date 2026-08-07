/**
 * ============================================================================
 * watermark-existing-papers.ts — re-stamp every PDF already in Supabase Storage
 * ----------------------------------------------------------------------------
 * NOT part of the app build (scripts/ is excluded from tsconfig). Run directly:
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/watermark-existing-papers.ts --from-local=<dir> [--commit]
 *                                          [--limit=N] [--only=<stored path>]
 *
 * For every past_papers row and each non-null paper_pdf_path /
 * markscheme_pdf_path / examiner_report_pdf_path: download from the `papers`
 * bucket, stamp, and re-upload to the EXACT SAME PATH with upsert. No database
 * writes — not one column is touched, so the rows keep pointing where they did.
 *
 * DRY RUN IS THE DEFAULT and uploads nothing.
 *
 * ---------------------------------------------------------------------------
 * ONE IMPLEMENTATION OF THE GEOMETRY
 * The stamp maths lives in scripts/watermark2.py and this script shells out to
 * it per file. Porting the CropBox/rotation arithmetic to TypeScript would give
 * two copies to keep in step, and they would drift the first time either is
 * touched. Python owns placement; this file owns iteration, I/O and safety.
 *
 * SKIP LOGIC IS POSITIONAL, NOT TEXTUAL
 * "Does the file contain the string Ailemy.com" is the wrong question: a file
 * carrying only a wrongly-placed stamp answers yes. `watermark2.py --inspect`
 * reports where each stamp actually sits, and a file counts as done only when
 * EVERY page carries one at the current CropBox-anchored anchor.
 *
 * TWO WAYS TO SOURCE THE BYTES
 *   default        stamp the stored object itself and put it back
 *   --from-local   stamp the PRISTINE local original and put THAT back
 *
 * --from-local is the one to use. 20 of the 183 stored objects already carry a
 * stamp from an earlier tool, in three distinct generations measured off the
 * files themselves:
 *
 *     16 objects   VISIBLE but misplaced — ~24pt below the CropBox top on body
 *                  pages, ~33pt on covers, and a separate cover treatment with
 *                  a different font size. Re-stamping these in place produces
 *                  TWO visible marks.
 *      4 objects   ABOVE the CropBox — ~6pt above the top edge, clipped by
 *                  every conforming viewer, present in the file but invisible.
 *                  Ordinary text extraction does not return them at all.
 *    163 objects   no stamp; uploaded clean by the importer.
 *
 * Sourcing from the local original sidesteps all of it: the result carries
 * exactly one correctly placed stamp whatever the stored copy had. In the
 * default mode the old stamp is left in place — removing text from an existing
 * content stream risks corrupting the file — so --commit refuses any object
 * whose existing stamp is visible unless --allow-double is passed.
 *
 * GATES UNDER --from-local, each aborting the WHOLE run:
 *   * every stored path resolves to exactly one local source
 *   * paper code, session and year parsed back out of the local filename match
 *     the past_papers row
 *   * the local source's page count equals the stored object's — the only
 *     mechanical check that catches paper A's PDF landing under paper B's row,
 *     since the storage key is a UUID that says nothing about content
 * All three run in the DRY RUN too, so a mapping fault surfaces before any
 * upload rather than partway through one.
 *
 * SAFETY
 * Any failure at any stage aborts that ONE file and moves on; a file is only
 * uploaded after Python has written a complete output that re-inspects clean.
 * A partially written PDF can never reach the bucket.
 * ============================================================================
 */

import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PAPERS_BUCKET } from "../src/lib/storage/paper-uploads.ts";

const execFileAsync = promisify(execFile);

const PYTHON = "python3";
const WATERMARK = resolve("scripts/watermark2.py");

const PATH_COLUMNS = [
  "paper_pdf_path",
  "markscheme_pdf_path",
  "examiner_report_pdf_path",
] as const;

// ============================================================================
// CLI
// ============================================================================

type Options = {
  commit: boolean;
  limit: number | null;
  allowDouble: boolean;
  rateMs: number;
  /**
   * When set, the bytes uploaded come from the PRISTINE local originals under
   * this root rather than from the stored object. That is the only way to end
   * up with exactly one stamp: the stored copies already carry a visible one,
   * and re-stamping them would double it.
   */
  fromLocal: string | null;
  /** Exact stored path to process, to the exclusion of all others. */
  only: string | null;
};

/**
 * Session name -> the MM values that session can appear as in a filename.
 * Mirrors SESSION_BY_MONTH in watermark2.py's sibling importer; a session maps
 * to more than one month, so resolution has to try each.
 */
const SESSION_MONTHS: Record<string, string[]> = {
  January: ["01", "02"],
  "May-June": ["05", "06"],
  "October-November": ["10", "11"],
};

const KIND_SUFFIX: Record<string, string> = {
  paper_pdf_path: "QU",
  markscheme_pdf_path: "MS",
  examiner_report_pdf_path: "ER",
};

const USAGE = `
watermark-existing-papers — re-stamp stored past-paper PDFs in place

  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \\
    scripts/watermark-existing-papers.ts [options]

  --commit          Actually upload. Without it nothing is written.
  --from-local=<p>  Take the bytes from the pristine local originals under <p>
                    instead of from the stored object, so the result carries
                    exactly ONE stamp. Enables the mapping gates below.
  --limit=<n>       Process at most n FILES (not rows).
  --only=<path>     Process ONLY the object at this exact stored path. Use when
                    the file you want to convert is not first in slug order,
                    which is the only thing --limit=1 can reach.
  --allow-double    Re-stamp files whose existing stamp is visible, accepting
                    that they will then carry two visible marks. Ignored under
                    --from-local, where doubling cannot arise.
  --rate-ms=<n>     Pause between files. Default 250.
  --help

Gates under --from-local, any of which aborts the WHOLE run:
  * every stored path must resolve to exactly one local source
  * paper code, session and year parsed from the local filename must match the
    past_papers row
  * the stamped local file's page count must equal the stored object's
`;

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) fail(`Unrecognised argument: ${arg}`);
    const eq = arg.indexOf("=");
    flags.set(
      eq === -1 ? arg.slice(2) : arg.slice(2, eq),
      eq === -1 ? "" : arg.slice(eq + 1),
    );
  }
  for (const key of flags.keys()) {
    if (!["commit", "limit", "allow-double", "rate-ms", "from-local", "only"].includes(key)) {
      fail(`Unrecognised flag: --${key}\n${USAGE}`);
    }
  }
  const limitRaw = flags.get("limit");
  const limit = limitRaw === undefined || limitRaw === "" ? null : Number(limitRaw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    fail("--limit expects a positive integer");
  }
  const rateRaw = flags.get("rate-ms");
  const rateMs = rateRaw === undefined || rateRaw === "" ? 250 : Number(rateRaw);
  if (!Number.isFinite(rateMs) || rateMs < 0) fail("--rate-ms expects a number");

  const fromLocalRaw = flags.get("from-local");
  if (flags.has("from-local") && !fromLocalRaw) {
    fail("--from-local needs a path");
  }

  return {
    commit: flags.has("commit"),
    limit,
    allowDouble: flags.has("allow-double"),
    rateMs,
    fromLocal: fromLocalRaw ? resolve(fromLocalRaw) : null,
    only: flags.get("only") || null,
  };
}

// ============================================================================
// Local-source resolution
// ============================================================================

/** Every PDF under the local root, indexed by lowercased basename. */
async function indexLocalPdfs(root: string): Promise<Map<string, string[]>> {
  const index = new Map<string, string[]>();
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // The SAM folder holds specimen papers that are not in past_papers.
        // Skipping it keeps them from ever being offered as a match.
        if (/(^|\s)sam(\s|$)/i.test(entry.name.replace(/^\s*\d+\s*[-–—.]\s*/, ""))) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const key = entry.name.toLowerCase();
        const list = index.get(key) ?? [];
        list.push(full);
        index.set(key, list);
      }
    }
  }
  await walk(root);
  return index;
}

type Resolution =
  | { ok: true; local: string; expected: { code: string; month: string; yy: string } }
  | { ok: false; reason: string };

/**
 * Find the one local original behind a stored object.
 *
 * Derives the filename from the DB row rather than from the stored path: the
 * stored key is a UUID and carries no information about which paper it is, so
 * the row's own paper_code / session / year are the only trustworthy source.
 * Anything other than exactly one hit is refused — guessing here is precisely
 * how paper A's PDF ends up served under paper B's row.
 */
function resolveLocal(
  index: Map<string, string[]>,
  row: { paperCode: string | null; session: string; year: number },
  column: string,
): Resolution {
  const kind = KIND_SUFFIX[column];
  if (!kind) return { ok: false, reason: `unknown column ${column}` };
  if (!row.paperCode) return { ok: false, reason: "row has no paper_code" };

  const m = /^([A-Z]{3}\d{2})\/(\d{2})$/i.exec(row.paperCode.trim());
  if (!m) return { ok: false, reason: `unparseable paper_code ${JSON.stringify(row.paperCode)}` };
  const [, code, entry] = m;

  const months = SESSION_MONTHS[row.session];
  if (!months) return { ok: false, reason: `unknown session ${JSON.stringify(row.session)}` };
  const yy = String(row.year % 100).padStart(2, "0");

  const hits: { file: string; month: string }[] = [];
  for (const month of months) {
    const name = `${code}_${entry}_${month}${yy}_${kind}.pdf`.toLowerCase();
    for (const file of index.get(name) ?? []) hits.push({ file, month });
  }

  if (hits.length === 0) {
    return {
      ok: false,
      reason: `no local file named ${code}_${entry}_{${months.join("|")}}${yy}_${kind}.pdf`,
    };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      reason: `ambiguous — ${hits.length} local files match: ${hits.map((h) => basename(h.file)).join(", ")}`,
    };
  }
  return {
    ok: true,
    local: hits[0].file,
    expected: { code: code.toUpperCase(), month: hits[0].month, yy },
  };
}

/** Values a local filename claims about the sitting it belongs to. */
type ParsedName = {
  paperCode: string;
  session: string | undefined;
  year: number;
  kind: string;
};

/** Parse a local original's filename. Null when it does not match the scheme. */
function parseLocalName(localFile: string): ParsedName | null {
  const m = /^([A-Z]{3}\d{2})_(\d{2})_(\d{2})(\d{2})_(QU|MS|ER)\.pdf$/i.exec(
    basename(localFile),
  );
  if (!m) return null;
  const [, code, entry, month, yy, kind] = m;
  return {
    paperCode: `${code.toUpperCase()}/${entry}`,
    session: Object.entries(SESSION_MONTHS).find(([, ms]) => ms.includes(month))?.[0],
    year: 2000 + Number(yy),
    kind: kind.toUpperCase(),
  };
}

/**
 * Re-derive code / session / year FROM THE FILENAME and check them against the
 * row. resolveLocal built the name from the row, so this closes the loop: it
 * catches an index collision or a hand-renamed file that happens to sit at the
 * expected name but describes a different sitting.
 */
function verifyAgainstRow(
  localFile: string,
  row: { paperCode: string | null; session: string; year: number },
): string | null {
  const name = basename(localFile);
  const m = /^([A-Z]{3}\d{2})_(\d{2})_(\d{2})(\d{2})_(QU|MS|ER)\.pdf$/i.exec(name);
  if (!m) return `local filename ${name} does not parse`;

  const [, code, entry, month, yy] = m;
  const expectedCode = `${code.toUpperCase()}/${entry}`;
  if (expectedCode !== (row.paperCode ?? "").trim().toUpperCase()) {
    return `paper_code mismatch: file says ${expectedCode}, row says ${row.paperCode}`;
  }
  const session = Object.entries(SESSION_MONTHS).find(([, ms]) => ms.includes(month))?.[0];
  if (session !== row.session) {
    return `session mismatch: file month ${month} -> ${session}, row says ${row.session}`;
  }
  if (2000 + Number(yy) !== row.year) {
    return `year mismatch: file says ${2000 + Number(yy)}, row says ${row.year}`;
  }
  return null;
}

// ============================================================================
// Environment — same hand-parse as the importer; .env.local is not shell-safe
// ============================================================================

async function loadEnv(): Promise<{ url: string; serviceKey: string }> {
  const fromFile = new Map<string, string>();
  try {
    const raw = await readFile(resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFile.set(trimmed.slice(0, eq).trim(), value);
    }
  } catch {
    /* absent .env.local is fine when the vars are exported */
  }
  const read = (k: string) => process.env[k]?.trim() || fromFile.get(k);
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL not found");
  if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY not found");
  return { url, serviceKey };
}

// ============================================================================
// watermark2.py bridge
// ============================================================================

type Inspection = {
  pages: number;
  bleed_pages: number;
  same_box_pages: number;
  rotations: Record<string, number>;
  correct_pages: number;
  above_cropbox_pages: number;
  misplaced_pages: number;
  already_correct: boolean;
  has_legacy: boolean;
  would_double: boolean;
};

async function inspectPdf(file: string): Promise<Inspection> {
  const { stdout } = await execFileAsync(
    PYTHON,
    [WATERMARK, file, "--inspect"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as Inspection;
}

async function stampPdf(src: string, dst: string): Promise<void> {
  await execFileAsync(PYTHON, [WATERMARK, src, dst, "--force"], {
    maxBuffer: 32 * 1024 * 1024,
  });
}

// ============================================================================
// Reporting helpers
// ============================================================================

function describeGeometry(i: Inspection): string {
  const box =
    i.bleed_pages && i.same_box_pages
      ? `mixed (${i.bleed_pages} bleed, ${i.same_box_pages} same)`
      : i.bleed_pages
        ? "bleed CropBox"
        : "CropBox == MediaBox";
  const rot = Object.entries(i.rotations)
    .map(([k, v]) => `${k}°×${v}`)
    .join(" ");
  return `${box}; rotation ${rot}`;
}

function describeLegacy(i: Inspection): string {
  if (!i.has_legacy) return "none";
  const bits: string[] = [];
  if (i.misplaced_pages) bits.push(`${i.misplaced_pages}p visible-misplaced`);
  if (i.above_cropbox_pages) bits.push(`${i.above_cropbox_pages}p above-CropBox`);
  return bits.join(", ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// Main
// ============================================================================

type Target = {
  slug: string;
  column: string;
  path: string;
  paperCode: string | null;
  session: string;
  year: number;
  local?: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = await loadEnv();
  const db: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // watermark2.py must exist and be runnable before anything is downloaded.
  try {
    await stat(WATERMARK);
    await execFileAsync(PYTHON, [WATERMARK, "--help"], { maxBuffer: 1 << 20 });
  } catch (err) {
    fail(`cannot run ${WATERMARK}: ${(err as Error).message}`);
  }

  console.log(`\nMode   : ${options.commit ? "COMMIT — uploads to Supabase" : "DRY RUN — writes nothing"}`);
  console.log(`Bucket : ${PAPERS_BUCKET}`);
  console.log(`Stamp  : ${WATERMARK}`);

  if (options.fromLocal) console.log(`Source : local originals under ${options.fromLocal}`);
  else console.log(`Source : the stored objects themselves`);

  const { data, error } = await db
    .from("past_papers")
    .select(`slug, paper_code, session, year, ${PATH_COLUMNS.join(", ")}`)
    .order("slug", { ascending: true });
  if (error) fail(`could not read past_papers: ${error.message}`);

  type Row = {
    slug: string;
    paper_code: string | null;
    session: string;
    year: number;
  } & Record<string, unknown>;
  const rows = (data ?? []) as unknown as Row[];
  const targets: Target[] = [];
  for (const row of rows) {
    for (const column of PATH_COLUMNS) {
      const path = row[column] as string | null;
      if (path) {
        targets.push({
          slug: row.slug,
          column,
          path,
          paperCode: row.paper_code,
          session: row.session,
          year: row.year,
        });
      }
    }
  }
  console.log(`Rows   : ${rows.length}   files referenced: ${targets.length}`);

  if (options.only) {
    const before = targets.length;
    const kept = targets.filter((t) => t.path === options.only);
    if (kept.length === 0) fail(`--only: no past_papers row references ${options.only}`);
    if (kept.length > 1) fail(`--only: ${kept.length} rows reference that path; refusing to guess`);
    targets.length = 0;
    targets.push(...kept);
    console.log(`--only : 1 of ${before} object(s) selected — ${options.only}`);
  }

  // ---- GATE 1 + 2: resolve every object to exactly one local source, and
  // cross-check the filename against the row. Done for ALL targets up front so
  // a mapping problem aborts before a single byte is written.
  if (options.fromLocal) {
    let index: Map<string, string[]>;
    try {
      index = await indexLocalPdfs(options.fromLocal);
    } catch (err) {
      return fail(`could not read --from-local: ${(err as Error).message}`);
    }
    const localCount = [...index.values()].reduce((n, v) => n + v.length, 0);
    console.log(`Local  : ${localCount} PDF(s) indexed\n`);

    const problems: string[] = [];
    for (const t of targets) {
      const res = resolveLocal(index, t, t.column);
      if (!res.ok) {
        problems.push(`${t.slug} · ${t.column.replace("_pdf_path", "")}: ${res.reason}`);
        continue;
      }
      const mismatch = verifyAgainstRow(res.local, t);
      if (mismatch) {
        problems.push(`${t.slug} · ${t.column.replace("_pdf_path", "")}: ${mismatch}`);
        continue;
      }
      t.local = res.local;
    }

    // The mapping table, printed in full — this is what gets eyeballed.
    console.log("MAPPING  stored object -> local source");
    console.log("─".repeat(112));
    for (const t of targets) {
      const kind = t.column.replace("_pdf_path", "").padEnd(16);
      const stored = t.path.replace(/^papers\//, "").padEnd(52);
      const local = t.local ? relative(options.fromLocal, t.local) : "*** UNRESOLVED ***";
      console.log(`  ${t.slug.padEnd(28)} ${kind} ${stored} <- ${local}`);
    }
    console.log("─".repeat(112));
    console.log(`resolved ${targets.filter((t) => t.local).length}/${targets.length}\n`);

    if (problems.length) {
      console.error(`GATE FAILED — ${problems.length} object(s) did not resolve cleanly:\n`);
      for (const p of problems) console.error(`  • ${p}`);
      fail("aborting the whole run; nothing was written. Never guess a mapping.");
    }
  }

  const work = options.limit === null ? targets : targets.slice(0, options.limit);
  if (options.limit !== null && targets.length > work.length) {
    console.log(`--limit=${options.limit}: ${targets.length - work.length} file(s) held back.`);
  }
  console.log("");

  const tmp = await mkdtemp(join(tmpdir(), "ailemy-wm-"));
  const tally = {
    skippedCorrect: 0,
    stamped: 0,
    wouldStamp: 0,
    refusedDouble: 0,
    failed: 0,
    legacyFiles: 0,
    doublingFiles: 0,
    exact: 0,
    pageMismatch: 0,
  };
  const failures: { path: string; error: string }[] = [];

  for (const [index, target] of work.entries()) {
    const label = `[${index + 1}/${work.length}] ${target.path}`;
    const src = join(tmp, `in-${index}.pdf`);
    const dst = join(tmp, `out-${index}.pdf`);

    try {
      // The stored object is always read, even under --from-local: its page
      // count is the gate that catches a wrong mapping.
      const { data: blob, error: dlErr } = await db.storage
        .from(PAPERS_BUCKET)
        .download(target.path);
      if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? "empty body"}`);
      await writeFile(src, Buffer.from(await blob.arrayBuffer()));

      const before = await inspectPdf(src);
      if (before.has_legacy) tally.legacyFiles++;
      if (before.would_double) tally.doublingFiles++;

      const origin = target.local
        ? `\n    source: ${relative(options.fromLocal!, target.local)}`
        : "";
      const head = `${label}\n    ${target.slug} · ${target.column.replace("_pdf_path", "")} · stored ${before.pages}p · ${describeGeometry(before)}\n    legacy stamp: ${describeLegacy(before)}${origin}`;

      // Already carrying the current anchor on every page — nothing to do, in
      // either mode. Under --from-local this is what keeps an already-converted
      // object out of the "unconverted" audit.
      if (before.already_correct) {
        tally.skippedCorrect++;
        console.log(`${head}\n    -> skip, already stamped at the correct anchor on every page`);
        continue;
      }

      // A visible existing stamp means re-stamping shows TWO marks. Cannot
      // arise under --from-local, where the bytes come from an unstamped file.
      if (!options.fromLocal && before.would_double && !options.allowDouble) {
        tally.refusedDouble++;
        console.log(`${head}\n    -> REFUSED: existing stamp is visible; a second would double it (pass --allow-double)`);
        continue;
      }

      if (!options.commit) {
        if (!options.fromLocal) {
          tally.wouldStamp++;
          console.log(`${head}\n    -> would stamp and replace with ${before.pages}p expected`);
          continue;
        }

        // --from-local dry run: run EVERY gate the commit path would run, so a
        // mapping fault is found here rather than partway through an upload.
        // The page-count comparison needs the local file read, which is why
        // this branch does more than print an intention.
        const local = target.local!;
        const rel = relative(options.fromLocal, local);
        const parsed = parseLocalName(local);
        const localPages = (await inspectPdf(local)).pages;

        const problems: string[] = [];
        if (!parsed) problems.push(`filename ${basename(local)} does not parse`);
        if (parsed && parsed.paperCode !== (target.paperCode ?? "").trim().toUpperCase())
          problems.push(`paper_code: file ${parsed.paperCode} vs row ${target.paperCode}`);
        if (parsed && parsed.session !== target.session)
          problems.push(`session: file ${parsed.session} vs row ${target.session}`);
        if (parsed && parsed.year !== target.year)
          problems.push(`year: file ${parsed.year} vs row ${target.year}`);
        if (localPages !== before.pages) {
          problems.push(`PAGE COUNT: stored ${before.pages} vs local ${localPages}`);
          tally.pageMismatch++;
        }

        console.log(
          `${label}\n` +
          `    stored : ${target.path}\n` +
          `    local  : ${rel}\n` +
          `    pages  : stored ${before.pages}  local ${localPages}  ${localPages === before.pages ? "match" : "*** MISMATCH ***"}\n` +
          `    file   : ${parsed ? `${parsed.paperCode}  ${parsed.session}  ${parsed.year}  ${parsed.kind}` : "UNPARSEABLE"}\n` +
          `    db row : ${target.paperCode}  ${target.session}  ${target.year}  ${target.column.replace("_pdf_path", "")}\n` +
          `    -> ${problems.length ? `FAIL — ${problems.join("; ")}` : "exact match"}`,
        );

        if (problems.length) failures.push({ path: target.path, error: problems.join("; ") });
        else tally.exact++;
        tally.wouldStamp++;
        continue;
      }

      await stampPdf(target.local ?? src, dst);

      // Never upload something we have not re-read. This catches a truncated
      // or malformed write before it can replace a good object in the bucket.
      //
      // These conditions END THE RUN rather than skipping the file. A stamp
      // that lands wrong is a fault in the geometry or the source, not bad luck
      // with one PDF, and continuing would spray the same fault across the rest
      // of the bucket before anyone read the log.
      const after = await inspectPdf(dst);
      if (after.correct_pages !== after.pages) {
        console.error(
          `\n✖ VERIFICATION FAILED — ${target.path}\n` +
            `    before : pages ${before.pages}  correct ${before.correct_pages}  misplaced ${before.misplaced_pages}  above ${before.above_cropbox_pages}\n` +
            `    after  : pages ${after.pages}  correct ${after.correct_pages}  misplaced ${after.misplaced_pages}  above ${after.above_cropbox_pages}\n` +
            `    correct (${after.correct_pages}) != pages (${after.pages}). Nothing uploaded for this file.`,
        );
        fail("aborting the whole run.");
      }

      // ---- GATE 3: page count. A local file with a different page count than
      // the object it is replacing means the mapping is wrong, and that is the
      // one failure that silently serves paper A under paper B's row. It ends
      // the run rather than skipping the file, because a mapping that is wrong
      // once is not to be trusted for the rest.
      if (options.fromLocal && after.pages !== before.pages) {
        console.error(
          `\n✖ GATE FAILED — page count mismatch on ${target.path}\n` +
            `    stored object : ${before.pages} pages\n` +
            `    local source  : ${after.pages} pages (${relative(options.fromLocal, target.local!)})\n` +
            `    The mapping is wrong. Nothing was uploaded for this file.`,
        );
        fail("aborting the whole run.");
      }

      // Also refuse a file whose extra stamp is not the ONLY one, which would
      // mean the "clean" local original was not clean after all.
      if (options.fromLocal && (after.misplaced_pages || after.above_cropbox_pages)) {
        console.error(
          `\n✖ GATE FAILED — ${relative(options.fromLocal, target.local!)} already carried a stamp; ` +
            `the result would not be clean.`,
        );
        fail("aborting the whole run.");
      }
      const bytes = await readFile(dst);
      if (bytes.length < 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") {
        console.error(
          `\n✖ OUTPUT REJECTED — ${target.path}\n` +
            `    ${bytes.length} bytes, header ${JSON.stringify(bytes.subarray(0, 5).toString())}\n` +
            `    Expected >=1024 bytes and a %PDF- header. Nothing uploaded for this file.`,
        );
        fail("aborting the whole run.");
      }

      const { error: upErr } = await db.storage
        .from(PAPERS_BUCKET)
        .upload(target.path, bytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      tally.stamped++;
      console.log(
        `${label}\n` +
        `    ${target.slug} · ${target.column.replace("_pdf_path", "")}` +
        (target.local ? ` · ${relative(options.fromLocal!, target.local)}` : "") + `\n` +
        `    before : pages ${before.pages}  correct ${before.correct_pages}  misplaced ${before.misplaced_pages}  above ${before.above_cropbox_pages}\n` +
        `    after  : pages ${after.pages}  correct ${after.correct_pages}  misplaced ${after.misplaced_pages}  above ${after.above_cropbox_pages}\n` +
        `    -> uploaded in place, ${bytes.length} bytes`,
      );
    } catch (err) {
      tally.failed++;
      const message = (err as Error).message;
      failures.push({ path: target.path, error: message });
      console.error(`${label}\n    ✖ ${message} — file left untouched`);
    } finally {
      await rm(src, { force: true });
      await rm(dst, { force: true });
      if (options.rateMs) await sleep(options.rateMs);
    }
  }

  await rm(tmp, { recursive: true, force: true });

  console.log("\n" + "─".repeat(66));
  console.log(`files considered            : ${work.length}`);
  console.log(`already correct, skipped    : ${tally.skippedCorrect}`);
  if (options.commit) console.log(`stamped and re-uploaded     : ${tally.stamped}`);
  else console.log(`would be stamped            : ${tally.wouldStamp}`);
  console.log(`refused (would double)      : ${tally.refusedDouble}`);
  console.log(`failed                      : ${tally.failed}`);
  console.log(`carrying a legacy stamp     : ${tally.legacyFiles}`);
  console.log(`  of which VISIBLE (doubles): ${tally.doublingFiles}`);
  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  ${f.path}\n    ${f.error}`);
  }
  if (options.fromLocal && !options.commit) {
    const ambiguous = failures.filter((f) => /ambiguous/i.test(f.error)).length;
    const unmatched = failures.filter((f) => /no local file|does not parse/i.test(f.error)).length;
    console.log(
      `\nSUMMARY  rows ${tally.wouldStamp}` +
      `  |  exact ${tally.exact}` +
      `  |  ambiguous ${ambiguous}` +
      `  |  unmatched ${unmatched}` +
      `  |  page-count mismatches ${tally.pageMismatch}` +
      `  |  already converted ${tally.skippedCorrect}`,
    );
    if (failures.length) {
      console.error(`\n✖ ABORT — ${failures.length} object(s) failed a gate. Nothing was written, and no upload would be attempted.`);
      process.exitCode = 1;
    } else {
      console.log("All gates passed. Nothing was written.");
    }
  }
  if (!options.commit) console.log("\nDRY RUN — nothing was uploaded. Re-run with --commit to write.");
  console.log("");

  if (tally.failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error("\n✖ Unhandled failure:", err);
  process.exit(1);
});
