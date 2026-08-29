/**
 * Six 4CH1 files are named for the wrong sitting. Rename them to January 2022.
 *
 * ============================================================================
 * WHAT WAS WRONG
 * ============================================================================
 * Two complete triplets sat under .../Chemistry /2 - Jan /2022/ named _1121_,
 * i.e. November 2021, colliding on key with the genuine November 2021 triplets
 * in .../Chemistry /4 - November /2021/. The importer refused all twelve as
 * "ambiguous — 2 QU and 2 MS share the key, none clearly canonical", which was
 * the correct refusal: they are not byte-identical, so no tie-break applies.
 *
 * ⚠ THEY ARE NOT DUPLICATES. THEY ARE A DIFFERENT SITTING. Every mark scheme
 * and examiner report states its series on page 1, and the two groups disagree:
 *
 *     .../2 - Jan /2022/...    MS "January 2022"    ER "January 2022"
 *     .../4 - November /2021/  MS "November 2021"   ER "November 2021"
 *
 * The question papers carry no series line but carry different publication
 * codes, whose trailing digits are the page count and match it exactly:
 *
 *     1C QU  P70701A0132 (32pp, Jan)   vs  P66058RA0140 (40pp, Nov)
 *     2C QU  P70702A0128 (28pp, Jan)   vs  P66059RA0124 (24pp, Nov)
 *
 * So this rename does not resolve a collision by discarding a copy. It records
 * that there were four papers here, not two. The November files are correctly
 * named and are NOT touched.
 *
 * ============================================================================
 * ⚠ WHY THIS ONE PINS HASHES, WHEN rename-iso-files.ts PINS NOTHING
 * ============================================================================
 * That program renames whatever it discovers, so a hardcoded list would go
 * stale. This one is the opposite: a founder ruling about six specific
 * documents, identified by reading their covers. The hash IS the identity here.
 * A path can come to hold a different file; an md5 cannot. Every one of the six
 * is re-hashed at execution time and must match the value the ruling was made
 * on, or the whole run aborts before a single rename.
 *
 * ⚠ NO DATABASE, NO STORAGE, NO NETWORK. Never deletes, never overwrites.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/rename-4ch1-jan2022.ts
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/rename-4ch1-jan2022.ts --commit
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { SUBJECTS, buildFilenameRe } from "./bulk-import-papers.ts";

const CORPUS = "/Users/muhammed/Desktop/Ailemy/Exams";
/** Trailing spaces in these path segments are real and load-bearing. */
const JAN = join(CORPUS, "8 - International GCSE (9-1)", "Chemistry ", "2 - Jan ", "2022");

/**
 * Two rulings, two sets. --set is REQUIRED and has no default.
 *
 * ⚠ THE SETS ARE SEPARATE BECAUSE THEY ARE NOT THE SAME OPERATION. 1c2c was a
 * pure filesystem correction: those files had never imported, because the key
 * collision stopped them. 1cr2cr had no collision to stop it, so it IS ALREADY
 * IMPORTED under October-November 2021 — renaming those files corrects the disk
 * and leaves two past_papers rows and six Storage objects still describing the
 * wrong sitting. Running this tool does not finish that job.
 */
const SETS: Record<string, { rel: string; from: string; to: string; md5: string }[]> = {
  "1c2c": [
    { rel: "Paper 1C", from: "4CH1_1C_1121_QU.pdf", to: "4CH1_1C_0122_QU.pdf", md5: "332aa3b387fe20dbe9e059e3d22bd61a" },
    { rel: "Paper 1C", from: "4CH1_1C_1121_MS.pdf", to: "4CH1_1C_0122_MS.pdf", md5: "1cb7f3b26a3767e9ee9d7365b144b6a9" },
    { rel: "Paper 1C", from: "4CH1_1C_1121_ER.pdf", to: "4CH1_1C_0122_ER.pdf", md5: "8d34a7fea673986f84dce9cea1c63f5d" },
    { rel: "Paper 2C", from: "4CH1_2C_1121_QU.pdf", to: "4CH1_2C_0122_QU.pdf", md5: "85c3453a1bfec5b4ec377faae073d617" },
    { rel: "Paper 2C", from: "4CH1_2C_1121_MS.pdf", to: "4CH1_2C_0122_MS.pdf", md5: "9305d9f68aa72a75e4da73196f7eddee" },
    { rel: "Paper 2C", from: "4CH1_2C_1121_ER.pdf", to: "4CH1_2C_0122_ER.pdf", md5: "2c7a3d78e845893bd96bd31dd782461d" },
  ],
  "1cr2cr": [
    { rel: "Paper 1CR", from: "4CH1_1CR_1121_QU.pdf", to: "4CH1_1CR_0122_QU.pdf", md5: "2b30cfea304fae6d449cc2222ee7dcfe" },
    { rel: "Paper 1CR", from: "4CH1_1CR_1121_MS.pdf", to: "4CH1_1CR_0122_MS.pdf", md5: "68a4772e107ce97bf1aff94ab8885900" },
    { rel: "Paper 1CR", from: "4CH1_1CR_1121_ER.pdf", to: "4CH1_1CR_0122_ER.pdf", md5: "543f7846f5623d0995b25cee9a6ed6ec" },
    { rel: "Paper 2CR", from: "4CH1_2CR_1121_QU.pdf", to: "4CH1_2CR_0122_QU.pdf", md5: "8be5107a7952ef394d7e67d90a0ac5ed" },
    { rel: "Paper 2CR", from: "4CH1_2CR_1121_MS.pdf", to: "4CH1_2CR_0122_MS.pdf", md5: "9c7bde07ede386a63e2b4e5249d25884" },
    { rel: "Paper 2CR", from: "4CH1_2CR_1121_ER.pdf", to: "4CH1_2CR_0122_ER.pdf", md5: "a23a74fcff9039b68578353efd78e93d" },
  ],
};

const fail = (m: string): never => { console.error(`\nABORT — ${m}\n`); process.exit(1); };

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
 * MM -> session, read out of the importer's SESSION_BY_MONTH rather than
 * retyped. This program may not modify that file and the table is not
 * exported, so it is parsed from the source text.
 */
function sessionByMonth(): Map<string, string> {
  const src = readFileSync("scripts/bulk-import-papers.ts", "utf8");
  const blk = /const SESSION_BY_MONTH[^{]*\{([\s\S]*?)\}/.exec(src);
  if (!blk) fail("could not read SESSION_BY_MONTH out of bulk-import-papers.ts");
  const m = new Map<string, string>();
  for (const hit of blk![1].matchAll(/"(\d{2})":\s*"([^"]+)"/g)) m.set(hit[1], hit[2]);
  if (m.size === 0) fail("SESSION_BY_MONTH parsed to zero entries");
  return m;
}

const setFlag = (process.argv.find((a) => a.startsWith("--set=")) ?? "").split("=")[1];
if (!setFlag || !SETS[setFlag]) {
  console.error(`\n--set is required. One of: ${Object.keys(SETS).join(", ")}\n`);
  process.exit(1);
}
const TARGETS = SETS[setFlag];
const commit = process.argv.includes("--commit");
console.log(`\nrename-4ch1-jan2022 --set=${setFlag} — ${commit ? "COMMIT (renames files)" : "DRY RUN (touches nothing)"}`);
console.log(`base: [${JAN}]\n`);
if (!existsSync(JAN)) fail(`the January 2022 directory does not exist: ${JAN}`);

type Row = { from: string; to: string; expect: string; got: string; dir: string };
const rows: Row[] = [];

console.log("== 1. IDENTIFY BY MD5, recomputed now ==");
for (const t of TARGETS) {
  const dir = join(JAN, t.rel);
  const from = join(dir, t.from);
  if (!existsSync(from)) fail(`source missing: ${from}`);
  const got = createHash("md5").update(readFileSync(from)).digest("hex");
  const ok = got === t.md5;
  console.log(`   ${ok ? "✓" : "✗"} ${t.from}`);
  console.log(`       expected ${t.md5}`);
  console.log(`       actual   ${got}`);
  if (!ok) fail(`md5 mismatch on ${t.from}. The file at that path is not the file the ruling was made on. Nothing was renamed.`);
  rows.push({ from, to: join(dir, t.to), expect: t.md5, got, dir });
}
console.log(`   ${rows.length}/${TARGETS.length} identified by hash\n`);

console.log("== 2. COLLISION CHECK, corpus-wide, now ==");
const all = walk(CORPUS);
const names = new Set(all.map((p) => p.split("/").pop()!));
const existing0122 = all.filter((p) => /^4CH1_.*_0122_.*\.pdf$/i.test(p.split("/").pop()!));
console.log(`   pdfs walked                       : ${all.length}`);
console.log(`   existing 4CH1_*_0122_* anywhere   : ${existing0122.length}`);
for (const p of existing0122) console.log(`      ${p}`);
const collisions: string[] = [];
for (const r of rows) {
  if (existsSync(r.to)) collisions.push(`target exists: ${r.to}`);
  if (names.has(r.to.split("/").pop()!)) collisions.push(`basename already in corpus: ${r.to.split("/").pop()}`);
}
console.log(`   collisions                        : ${collisions.length}`);
for (const c of collisions) console.log(`      ${c}`);
if (collisions.length) fail(`${collisions.length} collision(s). Nothing was renamed.`);

console.log("\n== 3. ROUND TRIP through the real parser ==");
const SESSION = sessionByMonth();
const accepts = (n: string) => Object.values(SUBJECTS).some((c) => buildFilenameRe(c).test(n));
let bad = 0;
for (const r of rows) {
  const n = r.to.split("/").pop()!;
  const ok = accepts(n);
  const m = /^[0-9A-Z]{4,5}_[0-9A-Z]{1,3}_(\d{2})(\d{2})_(QU|MS|ER)\.pdf$/i.exec(n);
  const session = m ? `${SESSION.get(m[1]) ?? "?"} 20${m[2]}` : "unparsed";
  console.log(`   ${ok ? "✓" : "✗"} ${n}  ->  ${session}`);
  if (!ok || session !== "January 2022") bad++;
}
console.log(`   ${rows.length - bad}/${TARGETS.length} parse AND read January 2022`);
if (bad) fail(`${bad} name(s) failed the round trip or did not read January 2022. Nothing was renamed.`);

const now = new Date();
const p2 = (x: number) => String(x).padStart(2, "0");
const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
  `-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
const logPath = join(process.cwd(), `rename-4ch1-${setFlag}-undo-${stamp}.log`);
const undo = rows.map((r) => `${r.from}\t->\t${r.to}`).join("\n") + "\n";

if (!commit) {
  console.log("\n== 4. UNDO LOG THAT WOULD BE WRITTEN ==");
  console.log(`   path: ${logPath}\n`);
  for (const line of undo.trimEnd().split("\n")) console.log(`      ${line}`);
  console.log(`\nDRY RUN — nothing was renamed. ${rows.length} would be renamed.`);
  console.log("The six November 2021 files are correctly named and are not touched.\n");
  process.exit(0);
}

console.log("\n== 4. UNDO LOG — written BEFORE the first rename ==");
try { writeFileSync(logPath, undo, { encoding: "utf8", flag: "wx" }); }
catch (e) { fail(`could not write the undo log to ${logPath}: ${e instanceof Error ? e.message : String(e)}`); }
if (!existsSync(logPath)) fail(`undo log reported written but is not on disk: ${logPath}`);
console.log(`   written: ${logPath}  (${rows.length} lines)`);

console.log("\n== 5/6. RENAME, each verified by re-reading its directory ==");
let renamed = 0, failedCount = 0;
for (const r of rows) {
  const to = r.to.split("/").pop()!, from = r.from.split("/").pop()!;
  if (existsSync(r.to)) {
    console.log(`   ✗ ${from} — TARGET EXISTS, refusing`);
    failedCount++;
    fail(`target appeared before the rename. ${renamed} already renamed; undo log at ${logPath}.`);
  }
  if (!existsSync(r.from)) { console.log(`   ✗ ${from} — source vanished`); failedCount++; continue; }
  try { renameSync(r.from, r.to); }
  catch (e) { console.log(`   ✗ ${from} — ${e instanceof Error ? e.message : String(e)}`); failedCount++; continue; }
  const listing = new Set(readdirSync(r.dir));
  if (!(listing.has(to) && !listing.has(from))) {
    console.log(`   ✗ ${from} — rename returned but the directory disagrees ` +
      `(new present=${listing.has(to)}, old gone=${!listing.has(from)})`);
    failedCount++; continue;
  }
  console.log(`   ✓ ${from} -> ${to}`);
  renamed++;
}
console.log(`\n${renamed} renamed, ${failedCount} failed.`);
console.log(`undo log: ${logPath}\n`);
process.exit(failedCount === 0 ? 0 : 1);
