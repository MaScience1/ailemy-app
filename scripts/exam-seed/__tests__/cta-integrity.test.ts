/**
 * Every data-cta in the markup must be a declared CtaSource.
 *
 * ============================================================================
 * ⚠ THE COMMENT THIS SUITE EXISTS TO MAKE TRUE
 * ============================================================================
 * src/lib/analytics/events.ts says of the CTA names: "they are also the
 * data-cta attributes already sitting on the buttons, so the markup and the
 * analytics cannot drift — the attribute IS the event property."
 *
 * They had drifted. Four buttons in the lesson practice surface carried
 * data-cta values that were not members of CTA_SOURCES, and Analytics.tsx
 * filters against that list — so those four buttons looked instrumented,
 * were reviewed as instrumented, and emitted nothing. Nobody noticed because
 * the failure is silent by construction: a missing event looks exactly like a
 * button nobody pressed.
 *
 * A claim in a comment is not a guarantee. This is the guarantee.
 *
 * ⚠ THE LIST IS DERIVED FROM THE SOURCE FILE, NOT COPIED. A hard-coded list
 * here would go stale the first time somebody adds a CTA, which is the exact
 * failure mode this suite exists to catch.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { CTA_SOURCES } from "../../../src/lib/analytics/events.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
t("the scan found source files at all (an empty sweep must not pass)", files.length > 50, files.length);

// ── every data-cta="…" literal in the markup ────────────────────────────────
const found = new Map<string, string[]>(); // value -> files
for (const f of files) {
  const text = readFileSync(f, "utf8");
  /**
   * ⚠ A data-cta CAN BE A FIELD RATHER THAN AN ATTRIBUTE, AND THE ORIGINAL
   * SCAN COULD NOT SEE THOSE. The nav renders `data-cta={link.cta}` from a
   * NAV_LINKS table, so the only literal in the file is `cta: "nav_resources"`.
   * Matching attributes alone left eleven values declared-but-unscanned, which
   * meant a TYPO in the table — `nav_resorces` — was invisible to this suite
   * and silently discarded by Analytics.tsx at runtime. That is precisely the
   * failure this file exists to prevent, reappearing one indirection later.
   */
  for (const m of text.matchAll(/(?:data-cta=["'{`]?["']|\bcta:\s*")([a-z0-9_]+)["']/g)) {
    const v = m[1];
    found.set(v, [...(found.get(v) ?? []), f.replace(process.cwd() + "/", "")]);
  }
}

t("data-cta attributes exist to check (a regex that matches nothing proves nothing)",
  found.size > 0, `${found.size} distinct values`);

const declared = new Set<string>(CTA_SOURCES);
const undeclared = [...found.entries()].filter(([v]) => !declared.has(v));

t("⚠ every data-cta in the markup is a declared CtaSource — an undeclared one is SILENTLY DISCARDED by Analytics.tsx",
  undeclared.length === 0,
  undeclared.map(([v, fs]) => `${v} (${fs.join(", ")})`).join(" · "));

// ── and the reverse: a declared source nobody uses is dead vocabulary ───────
// Not a failure — a name may be declared a beat before its button lands, and
// some sources are passed as props rather than written as literals. Reported
// so the drift is visible rather than accumulating unseen.
const unused = [...declared].filter((v) => !found.has(v));
console.log(
  unused.length === 0
    ? "  · every declared CtaSource appears in the markup"
    : `  · declared but not found as a literal (may be passed as a prop): ${unused.join(", ")}`,
);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
