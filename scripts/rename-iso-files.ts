/**
 * Rename the ISO-named papers into the MMYY grammar the importer already reads.
 *
 * ============================================================================
 * WHAT THIS IS FOR
 * ============================================================================
 * A small number of files in the corpus are named on a different convention:
 *
 *     4BI1_1B_que_20220111.pdf          4ss0-1b-rms-20250821.pdf
 *
 * a token (que/rms/pef) and an 8-DIGIT PUBLICATION DATE, rather than
 * <code>_<entry>_<MMYY>_<QU|MS|ER>.pdf. The importer rejects them on shape, so
 * they never reach the catalogue. This renames them in place.
 *
 * ⚠ THE 8-DIGIT DATE IS NOT THE SESSION AND IS NEVER USED AS ONE. Every mark
 * scheme in the 4BI1 set is dated 20220303 for a JANUARY 2022 sitting, and
 * every 4SS0 report is dated 20250821 for a JUNE 2025 one. Renaming from the
 * filename would put all twelve 4BI1 papers in a March session that does not
 * exist. The session is read from INSIDE the pdf and from nowhere else.
 *
 * ⚠ NOTHING IS HARDCODED. The file list, the sessions and the MMYY digits are
 * all re-derived on every run. A pinned list of 21 pairs would be correct today
 * and silently wrong the first time the corpus changed — which is the exact
 * failure mode AGENTS.md names for models of production data.
 *
 * ⚠ NO DATABASE, NO STORAGE, NO NETWORK. This program renames local files and
 * does nothing else. It never deletes and never overwrites.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/rename-iso-files.ts
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/rename-iso-files.ts --commit
 *
 * ============================================================================
 * SESSION PRECEDENCE — founder ruling, binding
 * ============================================================================
 * Within one identity (code + entry):
 *
 *     MS and ER agreeing   >   a single MS or ER   >   (nothing)
 *
 * MS and ER present and DISAGREEING blocks the identity. An identity with
 * NEITHER a mark scheme nor an examiner report ALSO blocks: it does not fall
 * back to the question paper. That tightening is not caution, it is measured —
 * in a 20-file control against papers whose session was already known, the
 * question paper was wrong or unreadable 3 times out of 20 while MS and ER were
 * right 13 out of 13. QU is read and reported for evidence; it never decides.
 *
 * A copyright or publication line is not a session. "Specimen Papers - Issue 1 -
 * October 2015 (c) Pearson Education Limited 2015" produced ten false sessions
 * on 27 Aug 2026 before it was excluded. Folder names are never evidence.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { SUBJECTS, buildFilenameRe } from "./bulk-import-papers.ts";

const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";
const PYTHON = "python3";

/** que/rms/pef are the tokens the corpus actually uses. An unknown one aborts. */
const TYPE_BY_TOKEN: Record<string, string> = { que: "QU", rms: "MS", pef: "ER" };

/**
 * ISO-shaped: any basename ending in a separator, a token, a separator and an
 * 8-digit date. Deliberately token-agnostic — asserting que/rms/pef here would
 * hide a fourth token rather than report it.
 */
/** groups: 1 stem, 2 token, 3 date. Numbered, not named — tsconfig.scripts
 *  targets below ES2018 and this program may not change that config. */
const ISO_RE = /^(.+)[_-]([A-Za-z0-9]+)[_-](\d{8})\.pdf$/i;

/** The MMYY grammar, used ONLY to read the corpus's own convention back. */
const MMYY_RE = /^([0-9A-Z]{4,5})_([0-9A-Z]{1,3})_(\d{2})(\d{2})_(QU|MS|ER)(?: \(\d+\))?\.pdf$/i;

const fail = (m: string): never => {
  console.error(`\nABORT — ${m}\n`);
  process.exit(1);
};

function walk(root: string): string[] {
  const out: string[] = [];
  const rec = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e.startsWith(".") || e === "__MACOSX") continue;
      const full = join(dir, e);
      if (statSync(full).isDirectory()) rec(full);
      else if (e.toLowerCase().endsWith(".pdf")) out.push(full);
    }
  };
  rec(root);
  return out;
}

/**
 * Read the series out of a pdf.
 *
 * ⚠ THIS SHELLS OUT TO PYTHON ON PURPOSE. pypdf is what the watermarker already
 * uses (watermark-existing-papers.ts:83 does the same), and more importantly it
 * is the implementation that was measured at 20/20 against known sessions. A
 * second implementation in pdfjs would be an unvalidated extractor wearing a
 * validated extractor's result.
 */
const EXTRACTOR = `
import json, re, sys
from pypdf import PdfReader
PUBLICATION = re.compile(
    r'|'.join([r'\\u00a9', r'\\(c\\)', 'copyright', 'all rights reserved',
               'pearson education limited', 'specimen paper', r'issue\\s*\\d',
               r'publications?\\s*code', 'registered office', 'vat reg']), re.I)
MONTHS = {"january":"January","jan":"January","may":"May-June","june":"May-June",
          "summer":"May-June","may/june":"May-June","may-june":"May-June",
          "october":"October-November","november":"October-November",
          "oct":"October-November","nov":"October-November",
          "autumn":"October-November","winter":"October-November"}
MONTH_RE = re.compile(r'\\b(January|Jan|May/June|May-June|May|June|Summer|October|November|Oct|Nov|Autumn|Winter)\\b', re.I)
YEAR_RE = re.compile(r'\\b(20\\d{2})\\b')
out = {}
for path in json.load(sys.stdin):
    res = {"series": None, "year": None, "line": None, "page": None, "rejected": 0, "text": False}
    try:
        rd = PdfReader(path)
        for i in range(min(4, len(rd.pages))):
            t = rd.pages[i].extract_text() or ""
            if t.strip(): res["text"] = True
            for raw in t.split("\\n"):
                line = raw.strip()
                if not line: continue
                m, y = MONTH_RE.search(line), YEAR_RE.search(line)
                if not (m and y): continue
                if PUBLICATION.search(line):
                    res["rejected"] += 1
                    continue
                res.update(series=MONTHS[m.group(1).lower()], year=int(y.group(1)),
                           line=line, page=i + 1)
                break
            if res["series"]: break
    except Exception as e:
        res["error"] = f"{type(e).__name__}: {e}"
    out[path] = res
print(json.dumps(out))
`;

type Extracted = {
  series: string | null; year: number | null; line: string | null;
  page: number | null; rejected: number; text: boolean; error?: string;
};

function extractAll(paths: string[]): Record<string, Extracted> {
  if (paths.length === 0) return {};
  const raw = execFileSync(PYTHON, ["-c", EXTRACTOR], {
    input: JSON.stringify(paths), encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

/**
 * Which MM does this corpus write for a given session?
 *
 * ⚠ MEASURED, NOT CHOSEN. Both 01 and 02 mean January to the importer and both
 * 05 and 06 mean May-June, so "the right one" is whichever the corpus already
 * uses. Reading it back keeps a renamed file indistinguishable from a file that
 * was always named correctly. SESSION_BY_MONTH is not exported and this program
 * may not modify that file, so the mapping is rebuilt from the names on disk.
 */
function deriveMonthDigits(allPdfs: string[]): Map<string, string> {
  const SESSION_OF: Record<string, string> = {
    "01": "January", "02": "January", "05": "May-June", "06": "May-June",
    "10": "October-November", "11": "October-November",
  };
  const tally = new Map<string, Map<string, number>>();
  for (const p of allPdfs) {
    const m = MMYY_RE.exec(p.split("/").pop() ?? "");
    if (!m) continue;
    const session = SESSION_OF[m[3]];
    if (!session) continue;
    if (!tally.has(session)) tally.set(session, new Map());
    const t = tally.get(session)!;
    t.set(m[3], (t.get(m[3]) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const [session, counts] of tally) {
    const [mm, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    out.set(session, mm);
    console.log(`     ${session.padEnd(18)} -> MM=${mm}  (${n} of ${total} existing files, ` +
      `${Math.round((100 * n) / total)}%)`);
  }
  return out;
}

// ============================================================================
const commit = process.argv.includes("--commit");
console.log(`\nrename-iso-files — ${commit ? "COMMIT (renames files)" : "DRY RUN (touches nothing)"}`);
console.log(`corpus: ${CORPUS}\n`);
if (!existsSync(CORPUS)) fail(`corpus not found at ${CORPUS}`);

console.log("== 1. discovery ==");
const allPdfs = walk(CORPUS);
type Row = {
  abs: string; name: string; dir: string; token: string; type: string;
  date: string; code: string; entry: string; identity: string;
  ex?: Extracted; proposed?: string; target?: string;
};
const rows: Row[] = [];
for (const abs of allPdfs) {
  const name = abs.split("/").pop()!;
  const m = ISO_RE.exec(name);
  if (!m) continue;
  const token = m[2].toLowerCase();
  const type = TYPE_BY_TOKEN[token];
  if (!type) fail(`unknown token "${token}" in ${name} — the token map needs a ruling, not a guess`);
  const parts = m[1].split(/[-_]/);
  const code = (parts[0] ?? "").toUpperCase();
  const entry = (parts[1] ?? "").toUpperCase();
  rows.push({ abs, name, dir: dirname(abs), token, type, date: m[3],
    code, entry, identity: `${code}/${entry}` });
}
console.log(`   pdfs walked        : ${allPdfs.length}`);
console.log(`   ISO-shaped found   : ${rows.length}`);
if (rows.length === 0) { console.log("\n   nothing to do.\n"); process.exit(0); }
const identities = [...new Set(rows.map((r) => r.identity))].sort();
console.log(`   identities         : ${identities.length}`);

console.log("\n== 2. session, read from inside each pdf ==");
const ex = extractAll(rows.map((r) => r.abs));
for (const r of rows) r.ex = ex[r.abs];
const noText = rows.filter((r) => !r.ex?.text);
console.log(`   files with no text layer: ${noText.length}`);
for (const r of noText) console.log(`      ${r.name}`);

console.log("\n== 3. resolution under MS/ER precedence ==");
const resolved = new Map<string, { series: string; year: number; why: string }>();
const blocked: { identity: string; why: string }[] = [];
for (const id of identities) {
  const g = rows.filter((r) => r.identity === id);
  const of = (t: string) => {
    const r = g.find((x) => x.type === t);
    return r?.ex?.series ? { s: r.ex.series, y: r.ex.year!, line: r.ex.line!, page: r.ex.page! } : null;
  };
  const ms = of("MS"), er = of("ER"), qu = of("QU");
  const key = (v: { s: string; y: number } | null) => (v ? `${v.s} ${v.y}` : "none");
  let why = "", ok: { series: string; year: number } | null = null;
  if (ms && er) {
    if (ms.s === er.s && ms.y === er.y) { ok = { series: ms.s, year: ms.y }; why = "MS and ER agree"; }
    else why = `BLOCK — MS says ${key(ms)}, ER says ${key(er)}`;
  } else if (ms || er) {
    const one = (ms ?? er)!; ok = { series: one.s, year: one.y };
    why = `single ${ms ? "MS" : "ER"}` + (qu && (qu.s !== one.s || qu.y !== one.y)
      ? ` (overrides conflicting QU ${key(qu)})` : "");
  } else {
    why = "BLOCK — no MS and no ER; QU is not a fallback";
  }
  console.log(`   ${ok ? "OK   " : "BLOCK"} ${id.padEnd(10)} ${ok ? `${ok.series} ${ok.year}` : ""}  ${why}`);
  for (const t of ["MS", "ER", "QU"]) {
    const r = g.find((x) => x.type === t);
    if (!r) { console.log(`         ${t}: (absent)`); continue; }
    console.log(`         ${t}: ${r.ex?.series ?? "none"} ${r.ex?.year ?? ""}` +
      `  p${r.ex?.page ?? "-"} ${JSON.stringify(r.ex?.line ?? "")}` +
      (r.ex?.rejected ? `  [${r.ex.rejected} publication line(s) rejected]` : ""));
  }
  if (ok) resolved.set(id, { ...ok, why }); else blocked.push({ identity: id, why });
}

console.log("\n== 4. MMYY digits, derived from the corpus's own convention ==");
const monthDigits = deriveMonthDigits(allPdfs);

const plan = rows.filter((r) => resolved.has(r.identity));
for (const r of plan) {
  const res = resolved.get(r.identity)!;
  const mm = monthDigits.get(res.series);
  if (!mm) fail(`no MM convention found for session "${res.series}" — cannot invent one`);
  r.proposed = `${r.code}_${r.entry}_${mm}${String(res.year).slice(2)}_${r.type}.pdf`;
  r.target = join(r.dir, r.proposed);
}

console.log("\n== 5. ROUND TRIP — every proposed name through the real parser ==");
const accepts = (n: string) => Object.values(SUBJECTS).some((c) => buildFilenameRe(c).test(n));
const badRoundTrip = plan.filter((r) => !accepts(r.proposed!));
console.log(`   proposed names     : ${plan.length}`);
console.log(`   parse              : ${plan.length - badRoundTrip.length}`);
console.log(`   FAILURES           : ${badRoundTrip.length}`);
for (const r of badRoundTrip) console.log(`      ${r.name} -> ${r.proposed}`);
const stillParses = plan.filter((r) => accepts(r.name));
console.log(`   control — current names that already parse: ${stillParses.length} (want 0)`);
if (badRoundTrip.length) fail(`${badRoundTrip.length} proposed name(s) do not parse. Nothing was renamed.`);

console.log("\n== 6. COLLISION CHECK (re-run now, not trusted from any report) ==");
const onDisk = new Set(allPdfs.map((p) => p.split("/").pop()!));
const collisions: string[] = [];
const proposedSeen = new Map<string, string>();
for (const r of plan) {
  if (existsSync(r.target!)) collisions.push(`target exists: ${r.target}`);
  if (onDisk.has(r.proposed!)) collisions.push(`basename already in corpus: ${r.proposed}`);
  const prev = proposedSeen.get(r.target!);
  if (prev) collisions.push(`two sources claim ${r.target}: ${prev} and ${r.name}`);
  proposedSeen.set(r.target!, r.name);
}
console.log(`   collisions         : ${collisions.length}`);
for (const c of collisions) console.log(`      ${c}`);
if (collisions.length) fail(`${collisions.length} collision(s). Nothing was renamed.`);

console.log("\n== 7. PLAN ==");
for (const id of identities) {
  const g = plan.filter((r) => r.identity === id);
  if (!g.length) { console.log(`   ${id}  BLOCKED — no rename proposed`); continue; }
  const res = resolved.get(id)!;
  console.log(`   ${id}  ${res.series} ${res.year}  (${res.why})`);
  for (const r of g) console.log(`      ${r.name.padEnd(30)} -> ${r.proposed}`);
}
const mmyys = new Map<string, Set<string>>();
for (const r of plan) {
  if (!mmyys.has(r.identity)) mmyys.set(r.identity, new Set());
  mmyys.get(r.identity)!.add(r.proposed!.split("_")[2]);
}
const split = [...mmyys].filter(([, s]) => s.size !== 1);
console.log(`\n   triplet collapse   : ${mmyys.size} identities, ${split.length} with mixed MMYY (want 0)`);
for (const [id, s] of split) console.log(`      ${id}: ${[...s].join(", ")}`);
if (split.length) fail("an identity would split across two sessions. Nothing was renamed.");

// ---- the undo log ----------------------------------------------------------
/**
 * ⚠ THE STAMP IS THIS RUN'S WALL CLOCK, LOCAL TIME. It was briefly taken from
 * the first planned row's 8-digit filename date, which produced
 * rename-iso-undo-20220303.log — a PEARSON PUBLICATION DATE on a run artefact.
 * That is the same category error the whole program exists to avoid: the
 * 8-digit date is not a session and it is not a time of anything we did. A
 * publication date must never appear in a run artefact.
 */
const now = new Date();
const p2 = (n: number) => String(n).padStart(2, "0");
const stamp =
  `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
  `-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
const logPath = join(process.cwd(), `rename-iso-undo-${stamp}.log`);
const undo = plan.map((r) => `${r.abs}\t->\t${r.target}`).join("\n") + "\n";

if (!commit) {
  console.log("\n== 8. UNDO LOG THAT WOULD BE WRITTEN ==");
  console.log(`   path: ${logPath}`);
  console.log(`   ${plan.length} line(s), old absolute path -> new absolute path:\n`);
  for (const line of undo.trimEnd().split("\n")) console.log(`      ${line}`);
  console.log(`\nDRY RUN — nothing was renamed. ${plan.length} would be renamed, ` +
    `${blocked.length} identity/identities blocked.`);
  for (const b of blocked) console.log(`   blocked: ${b.identity} — ${b.why}`);
  console.log("\nRe-run with --commit to apply.\n");
  process.exit(0);
}

// ---- commit ----------------------------------------------------------------
console.log("\n== 8. UNDO LOG — written BEFORE the first rename ==");
try {
  writeFileSync(logPath, undo, { encoding: "utf8", flag: "wx" });
} catch (e) {
  fail(`could not write the undo log to ${logPath}: ${e instanceof Error ? e.message : String(e)}`);
}
if (!existsSync(logPath)) fail(`undo log reported written but is not on disk: ${logPath}`);
console.log(`   written: ${logPath}  (${plan.length} lines)`);

console.log("\n== 9. RENAME ==");
let renamed = 0, failedCount = 0;
for (const r of plan) {
  /** Re-checked immediately before the call: the world may have moved since step 6. */
  if (existsSync(r.target!)) {
    console.log(`   ✗ ${r.name} — TARGET EXISTS, refusing: ${r.target}`);
    failedCount++;
    fail(`target appeared before the rename. ${renamed} file(s) already renamed; ` +
      `undo log is at ${logPath}.`);
  }
  if (!existsSync(r.abs)) { console.log(`   ✗ ${r.name} — source vanished`); failedCount++; continue; }
  try { renameSync(r.abs, r.target!); }
  catch (e) {
    console.log(`   ✗ ${r.name} — ${e instanceof Error ? e.message : String(e)}`);
    failedCount++; continue;
  }
  /** An exit code is not proof the edit landed. Re-read the directory. */
  const listing = new Set(readdirSync(r.dir));
  const landed = listing.has(r.proposed!) && !listing.has(r.name);
  if (!landed) {
    console.log(`   ✗ ${r.name} — rename returned but the directory disagrees ` +
      `(new present=${listing.has(r.proposed!)}, old gone=${!listing.has(r.name)})`);
    failedCount++; continue;
  }
  console.log(`   ✓ ${r.name} -> ${r.proposed}`);
  renamed++;
}
console.log(`\n${renamed} renamed, ${failedCount} failed.`);
if (blocked.length) for (const b of blocked) console.log(`   blocked: ${b.identity} — ${b.why}`);
console.log(`undo log: ${logPath}\n`);
process.exit(failedCount === 0 ? 0 : 1);
