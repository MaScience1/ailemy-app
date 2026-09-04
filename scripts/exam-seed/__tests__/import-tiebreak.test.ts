/**
 * pickOne breaks a tie ONLY when the candidates are byte-identical, and blocks
 * loudly when they are not.
 *
 * ============================================================================
 * ⚠ THE SECOND GUARD IS THE ONE THAT MATTERS. A path-preference rule applied to
 * candidates with DIFFERENT content silently picks one version of a document
 * that exists in two versions. That is the failure this whole check exists to
 * prevent, and it is invisible: the run succeeds, the row imports, and nobody
 * learns which of the two was chosen. The first guard proves the fix works; the
 * second proves it did not become a licence.
 *
 * ⚠ pickOne IS IMPORTED, NEVER REIMPLEMENTED. A local copy of the rule would
 * agree with itself whatever the importer does.
 *
 * ⚠ THE IDENTICAL CASE USES REAL CORPUS FILES; the differing case is synthetic,
 * because the corpus contains no non-identical pair — measured, all 96 were
 * byte-identical. A fixture is the only way to exercise the branch that blocks.
 * Synthetic files are written to a temp directory and removed; the corpus is
 * never touched.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

import { pickOne, type ParsedFile, type TieBreak } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const ROOT = "/Users/muhammed/Desktop/Ailemy/Exams/4 - GCSE (9-1) ";

/** Build the ParsedFile shape pickOne needs, from a real path. */
const parsed = (abs: string, kind: ParsedFile["kind"], pairKey: string): ParsedFile => ({
  absPath: abs,
  relPath: relative(ROOT, abs),
  fileName: abs.split(sep).pop() ?? "",
  code: "1CH0", entry: "2H", month: "06", year: 2019,
  kind, duplicateSuffix: false, pairKey,
});

// ============================================================================
console.log("\n=== 0. the module RESOLVES — run FIRST, before anything executes ===");
// ============================================================================
/**
 * ⚠ WHY THIS SECTION EXISTS. Sections 1-3 import pickOne and call it. That
 * proves the function is correct; it does NOT prove the MODULE runs, and the
 * two came apart: main() sits behind an entry-point check, so importing the
 * module never executes the CLI path at all. A test that exercises one function
 * in isolation while the real wiring is untested is the CHIP_HREFS hole under
 * another name — there, a hardcoded list agreed with itself; here, an import
 * graph that the test never walks.
 *
 * A missing `import { createHash } from "node:crypto"` is the concrete case.
 * Sections 1-3 would catch it ONLY because they happen to execute the line.
 * Move that line behind a branch the fixtures do not reach and the suite goes
 * green on a module that dies with ReferenceError the first time a real run
 * hits it.
 *
 * Two checks, neither of which depends on the line being executed.
 *
 * ⚠ AND IT RUNS FIRST, DELIBERATELY. When the import was removed as a sabotage,
 * section 1 called pickOne, threw ReferenceError and killed the process before
 * any summary printed — a red, but an uninformative one: a stack trace where a
 * named assertion should be. Ordering this first means a missing binding is
 * reported as "createHash is imported: false" and the run continues to say what
 * else is wrong.
 */
{
  const SRC = "scripts/bulk-import-papers.ts";
  const raw = readFileSync(SRC, "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  /**
   * ⚠ STATIC: every free identifier the tie-break code calls must be imported.
   * Derived from the source, not from a list I maintain — a hardcoded list is
   * exactly the thing that goes stale.
   */
  const fnStart = code.indexOf("function pickByContent");
  const fnEnd = code.indexOf("\nfunction ", fnStart + 1);
  const body = fnStart >= 0 ? code.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 2000) : "";
  t("⚠ pickByContent was located in the source", body.length > 100, body.length);

  const imported = new Set(
    [...raw.matchAll(/import\s*\{([^}]*)\}\s*from/g)]
      .flatMap((m) => m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!.trim()))
      .filter(Boolean),
  );
  const declaredLocally = new Set(
    [...body.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  );
  const GLOBALS = new Set([
    "Set", "Map", "Array", "Object", "String", "Number", "Boolean", "JSON", "Math", "Date",
    "null", "true", "false", "undefined", "return", "const", "let", "var", "if", "else",
    "function", "new", "typeof", "of", "in", "for", "while", "sort", "map", "filter",
    "length", "size", "push", "slice", "split", "join", "localeCompare", "update", "digest",
    "chosen", "tie", "candidates", "hashes", "distinct", "sorted", "file", "md5", "depth",
    "absPath", "relPath", "pairKey", "kind", "discarded", "chosenDepth", "discardedDepth",
    "ParsedFile", "TieBreak", "a", "b", "h", "f", "x", "m",
  ]);
  const called = [...new Set([...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))]
    .filter((id) => !GLOBALS.has(id) && !declaredLocally.has(id));
  const unimported = called.filter((id) => !imported.has(id));
  t("⚠ every function pickByContent calls is IMPORTED (a missing import is a ReferenceError at run time)",
    unimported.length === 0, `not imported: ${unimported.join(", ")}  |  checked: ${called.join(", ")}`);

  /** The specific ones this change introduced, pinned by name. */
  for (const id of ["createHash", "readFileSync"]) {
    t(`⚠ ${id} is imported`, imported.has(id), [...imported].join(", ").slice(0, 120));
  }

  /**
   * ⚠ DYNAMIC: run the REAL CLI in a subprocess and prove it initialises.
   * The guard's own import can never catch a failure in main()'s path because
   * main() does not run on import. This invokes the script the way the founder
   * does, with a root that does not exist — so it must fail on the ROOT, having
   * already loaded every module-level binding. A ReferenceError or TypeError
   * here means the module cannot run, whatever sections 1-3 say.
   */
  let cliOut = "";
  try {
    cliOut = execFileSync("node", [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", SRC,
      "--subject=gcse-chemistry", "--root=/tmp/ailemy-does-not-exist",
    ], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      /**
       * ⚠ DUMMY CREDENTIALS, DELIBERATELY. The CLI checks env before argument
       * handling, so on a machine without .env.local this section false-redded
       * on "NEXT_PUBLIC_SUPABASE_URL not found" — an env-file report dressed as
       * an init failure, and a false red is how a real red gets ignored. What
       * this section proves is that the MODULE initialises and reaches its
       * argument handling; a nonsense URL and key prove that on any machine,
       * and the nonexistent --root stops the run before anything could be
       * contacted, let alone written.
       */
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        SUPABASE_SERVICE_ROLE_KEY: "dummy-key-for-init-check",
      },
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    cliOut = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  t("⚠ the real CLI initialises and reaches its argument handling",
    /Could not read --root/.test(cliOut), cliOut.split("\n").slice(-3).join(" ").slice(0, 200));
  t("⚠ …and dies on NOTHING resembling an unresolved binding",
    !/ReferenceError|is not defined|TypeError: .* is not a function/.test(cliOut),
    cliOut.split("\n").filter((l) => /Error/.test(l)).join(" ").slice(0, 200));
}

// ============================================================================
console.log("\n=== 1. a byte-identical tie resolves to the DEEPER path ===");
// ============================================================================
if (!existsSync(ROOT)) {
  console.log("\n  SKIPPED — the paper corpus is not on this machine.\n");
  process.exit(2);
}
{
  const walk = (d: string, o: string[] = []): string[] => {
    for (const e of readdirSync(d)) {
      if (e.startsWith(".")) continue;
      const f = join(d, e);
      statSync(f).isDirectory() ? walk(f, o) : e.toLowerCase().endsWith(".pdf") && o.push(f);
    }
    return o;
  };
  const found = walk(ROOT).filter((p) => p.endsWith("1CH0_2H_0619_QU.pdf")).sort();

  t("⚠ the known key really has two candidates on disk (else this proves nothing)",
    found.length === 2, `${found.length}: ${found.map((f) => relative(ROOT, f)).join(" | ")}`);

  if (found.length === 2) {
    const ties: TieBreak[] = [];
    const chosen = pickOne(found.map((f) => parsed(f, "QU", "1CH0_2H_0619")), ties);

    t("⚠ pickOne resolves rather than blocking", chosen !== null, chosen);
    t("⚠ …to the dated 3 - June tree, not the flat Chemistry mirror",
      chosen !== null && chosen.relPath.startsWith("3 - June"),
      chosen?.relPath);
    t("⚠ …and the discarded path is the flat mirror",
      ties.length === 1 && ties[0].discarded.length === 1 &&
      ties[0].discarded[0].startsWith("Chemistry" + sep),
      JSON.stringify(ties[0]?.discarded));
    t("⚠ the tie is REPORTED, not silent (one entry, with the md5)",
      ties.length === 1 && /^[0-9a-f]{32}$/.test(ties[0].md5), JSON.stringify(ties.length));
    t("⚠ the kept path is genuinely deeper than the discarded one",
      ties.length === 1 && ties[0].chosenDepth > ties[0].discardedDepth,
      `${ties[0]?.chosenDepth} vs ${ties[0]?.discardedDepth}`);
  }
}

// ============================================================================
console.log("\n=== 2. a DIFFERING pair still blocks — the one that matters ===");
// ============================================================================
{
  const tmp = mkdtempSync(join(tmpdir(), "ailemy-tie-"));
  try {
    /**
     * ⚠ TWO REAL PDFs WITH DIFFERENT BYTES, at two depths, both clean names.
     * They are minimal but valid: pickByContent only hashes, so content need
     * only differ, and using a deep/shallow pair mirrors the corpus shape so
     * the path rule WOULD have something to prefer if it were allowed to.
     */
    const deep = join(tmp, "3 - June", "Chemistry", "2019", "Higher");
    const flat = join(tmp, "Chemistry", "C2");
    mkdirSync(deep, { recursive: true });
    mkdirSync(flat, { recursive: true });
    const a = join(deep, "1CH0_2H_0619_QU.pdf");
    const b = join(flat, "1CH0_2H_0619_QU.pdf");
    writeFileSync(a, "%PDF-1.4\n% version ALPHA — differing content\n%%EOF\n");
    writeFileSync(b, "%PDF-1.4\n% version BETA  — differing content\n%%EOF\n");

    const md5 = (p: string) =>
      execFileSync("python3", ["-c",
        "import sys,hashlib;print(hashlib.md5(open(sys.argv[1],'rb').read()).hexdigest())", p],
        { encoding: "utf8" }).trim();

    t("⚠ the two synthetic candidates really do differ (else the block is vacuous)",
      md5(a) !== md5(b), `${md5(a).slice(0, 8)} vs ${md5(b).slice(0, 8)}`);

    const mk = (abs: string): ParsedFile => ({
      absPath: abs,
      relPath: relative(tmp, abs),
      fileName: abs.split(sep).pop() ?? "",
      code: "1CH0", entry: "2H", month: "06", year: 2019,
      kind: "QU", duplicateSuffix: false, pairKey: "1CH0_2H_0619",
    });

    const ties: TieBreak[] = [];
    const chosen = pickOne([mk(a), mk(b)], ties);

    t("⚠ pickOne REFUSES to choose between differing candidates",
      chosen === null, chosen === null ? "" : (chosen as ParsedFile).relPath);
    t("⚠ …and records no tie-break (nothing was resolved, so nothing is reported)",
      ties.length === 0, ties.length);

    /**
     * ⚠ THE CONTROL: the same two paths with IDENTICAL bytes must resolve.
     * Without this, "blocks" could be true because the function blocks
     * everything, and section 1 would be the only thing standing between that
     * and a silent regression.
     */
    writeFileSync(b, "%PDF-1.4\n% version ALPHA — differing content\n%%EOF\n");
    t("⚠ the two files are now identical", md5(a) === md5(b), `${md5(a).slice(0, 8)} vs ${md5(b).slice(0, 8)}`);
    const ties2: TieBreak[] = [];
    const chosen2 = pickOne([mk(a), mk(b)], ties2);
    t("⚠ …and pickOne now resolves, to the deeper path",
      chosen2 !== null && chosen2.relPath.startsWith("3 - June"), chosen2?.relPath);
    t("⚠ …reporting exactly one tie", ties2.length === 1, ties2.length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ============================================================================
console.log("\n=== 3. the suffix rule still runs first, and costs no I/O ===");
// ============================================================================
{
  /**
   * A clean name beats a " (1)" name without either being hashed. Asserted with
   * paths that DO NOT EXIST: if pickOne tried to read them it would throw.
   */
  const ghost = (name: string, dup: boolean): ParsedFile => ({
    absPath: join(ROOT, "does-not-exist", name),
    relPath: join("does-not-exist", name),
    fileName: name,
    code: "1CH0", entry: "2H", month: "06", year: 2019,
    kind: "QU", duplicateSuffix: dup, pairKey: "1CH0_2H_0619",
  });
  let threw = "";
  let picked: ParsedFile | null = null;
  try { picked = pickOne([ghost("1CH0_2H_0619_QU (1).pdf", true), ghost("1CH0_2H_0619_QU.pdf", false)]); }
  catch (e) { threw = e instanceof Error ? e.message : String(e); }
  t("⚠ the clean name wins without reading either file", threw === "" && picked !== null, threw);
  t("⚠ …and it is the un-suffixed one", picked?.fileName === "1CH0_2H_0619_QU.pdf", picked?.fileName);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
