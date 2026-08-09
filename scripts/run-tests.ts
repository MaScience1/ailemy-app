/**
 * run-tests.ts — run every suite in the repository, with node.
 *
 *   npm test
 *
 * ============================================================================
 * WHY THIS EXISTS, AND WHY NOT VITEST
 * ============================================================================
 * The suites under scripts/exam-seed/__tests__/ are plain Node programs: they
 * assert, they print, and they exit non-zero on a failure. Node 26 strips the
 * types, so they need no build step and no runner.
 *
 * Before this file there was no `test` script at all, so the obvious thing to
 * reach for was `npx vitest run` — which reported SIX FAILED SUITES against a
 * repository where every assertion passed. vitest is not a dependency of this
 * project and is not installed; npx downloads it, imports each suite, and
 * treats the `process.exit(0)` at the bottom of a PASSING run as a crash.
 *
 * That is a false red, and a false red is how a real red gets ignored. There is
 * no vitest config to fix it with, because there is no vitest — the fix is that
 * `npm test` now exists, so nobody has to guess. If the suites are ever ported
 * to vitest, install it, convert all of them, and delete this file; a
 * half-migration would put the false red back.
 *
 * ============================================================================
 * WHAT THIS RUNNER REFUSES TO DO
 * ============================================================================
 * Report success without having run anything. A runner whose glob stops
 * matching — a renamed folder, a moved suite — and which then exits 0 is the
 * same class of defect as the swallowed errors the suites below exist to catch.
 * So: zero discovered suites is a FAILURE, and every suite's exit code is
 * checked individually rather than inferred from the last one.
 */
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "public"]);
/**
 * ⚠ WIDER THAN IT LOOKS LIKE IT NEEDS TO BE, on purpose.
 *
 * Every suite today is `.test.ts` under scripts/, but the zero-discovery guard
 * below only fires when the count is zero for the WHOLE repository — and those
 * seven keep it non-zero forever. So a suite added tomorrow as `.test.tsx`
 * (the natural extension for anything under src/components) or `.spec.ts`
 * would be silently dropped with no diagnostic at all: not run, not counted,
 * not mentioned. Matching all four costs nothing and removes the blind spot.
 * `supabase/` is scanned for the same reason.
 */
const SUITE = /\.(test|spec)\.tsx?$/;

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

async function discover(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await discover(full)));
    else if (SUITE.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * A suite that never exits is the one outcome a runner cannot report on: it
 * does not pass, it does not fail, it just sits there until someone gives up.
 * These suites are pure computation and finish in milliseconds, so a minute is
 * three orders of magnitude of headroom and still bounded.
 */
const TIMEOUT_MS = 60_000;

function run(file: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", file],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    let settled = false;
    const finish = (code: number, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ code, output: output + extra });
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(1, `\n[runner] killed after ${TIMEOUT_MS / 1000}s — the suite never exited.`);
    }, TIMEOUT_MS);

    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    // A suite killed by a signal has no exit code. Treat that as a failure
    // rather than letting `?? 0` turn a segfault into a pass.
    child.on("close", (code, signal) => finish(code ?? (signal ? 1 : 1)));
    child.on("error", (error) => finish(1, String(error)));
  });
}

const suites = (await discover(ROOT)).sort();

if (suites.length === 0) {
  console.error(
    `\n${RED}${BOLD}FAILED${RESET} no ${SUITE} suites found under ${ROOT}.\n` +
      `  A test run that discovers nothing is not a pass.\n`,
  );
  process.exit(1);
}

console.log(`\n${BOLD}${suites.length} suite(s)${RESET}\n`);

let failed = 0;
let skipped = 0;
let assertions = 0;
const failures: { name: string; output: string }[] = [];

for (const file of suites) {
  const name = relative(ROOT, file);
  const { code, output } = await run(file);
  // Every suite prints "N passed, M failed" as its last line.
  const tally = output.match(/(\d+) passed, (\d+) failed/);
  const selfReportedFailures = tally ? Number(tally[2]) : 0;
  if (tally) assertions += Number(tally[1]);

  // Exit 2 is the skip channel — a suite that needs credentials or a network
  // and does not have them. NOT counted as a pass: reporting an unrun schema
  // guard as verified is the failure this whole file exists to prevent.
  if (code === 2) {
    skipped += 1;
    console.log(`  ${YELLOW}skip${RESET} ${name.padEnd(46)} ${DIM}nothing verified${RESET}`);
    console.log(output.trimEnd());
    continue;
  }

  // ⚠ THE EXIT CODE IS NOT ENOUGH ON ITS OWN, in either direction.
  //
  //   - A suite that PRINTS failures and exits 0 (its author forgot the
  //     trailing `process.exit(fail ? 1 : 0)`, or exited before an async
  //     assertion resolved) would be painted green while saying it failed.
  //   - A suite that prints NO tally ran no assertions at all — an empty stub,
  //     or a body behind a false env guard — and "it exited 0" is not evidence
  //     that anything was checked.
  //
  // Both numbers are already on screen; refusing to compare them is what turns
  // a green run into a claim nobody verified.
  const reason =
    code !== 0
      ? tally?.[0] ?? `exit ${code}`
      : selfReportedFailures > 0
        ? `exit 0 but the suite reported ${selfReportedFailures} failure(s)`
        : !tally
          ? `exit 0 but no assertions ran — the suite printed no tally`
          : null;

  if (reason === null) {
    console.log(`  ${GREEN}ok${RESET}  ${name.padEnd(46)} ${DIM}${tally![0]}${RESET}`);
  } else {
    failed += 1;
    failures.push({ name, output });
    console.log(`  ${RED}FAIL${RESET} ${name.padEnd(46)} ${reason}`);
  }
}

for (const f of failures) {
  console.log(`\n${RED}${BOLD}── ${f.name} ──${RESET}`);
  console.log(f.output.trimEnd());
}

if (failed > 0) {
  console.error(
    `\n${RED}${BOLD}FAILED${RESET} ${failed} of ${suites.length} suite(s).\n`,
  );
  process.exit(1);
}

console.log(
  `\n${GREEN}${BOLD}ALL PASS${RESET} ${suites.length - skipped} suite(s), ` +
    `${assertions} assertion(s)` +
    // Never fold a skip into the pass count. "7 suites passed" when one of them
    // never ran is the same shape of lie as a swallowed error.
    (skipped > 0 ? `${YELLOW} — ${skipped} skipped, nothing verified there${RESET}` : "") +
    `.\n`,
);
