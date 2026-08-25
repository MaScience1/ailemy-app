/**
 * THE PAPER WORKSPACE GATE — no CTA may promise a workspace that does not work.
 *
 * ============================================================================
 * ⚠ WHAT THIS PREVENTS: A PAID PARENT REACHING A DEAD END.
 * ============================================================================
 * "Start Test" opens a modal whose primary card advertises a timed exam with
 * "Type and save answers" and "Submit when finished". The workspace behind it
 * renders a dashed box reading "Not built yet — nothing you type anywhere on
 * this page is saved". /past-papers is public and linked from the main nav.
 *
 * ⚠ AND IT ASSERTS THE PROPERTY, NOT A LINE OF CODE. The invariant below is
 * universal over every workspace the app knows: whatever a reader may be
 * offered must be usable. That stays true if a third workspace is added.
 */
import { readFileSync } from "node:fs";

import {
  PAPER_WORKSPACES, USABLE_PAPER_WORKSPACES, isWorkspaceUsable, canOfferPaperTest,
  type PaperWorkspace,
} from "../../../src/lib/past-papers/workspaces.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
/** ⚠ BOTH COMMENT SYNTAXES — a JSX file's {/* … *​/} block would otherwise satisfy a code assertion. */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

console.log("\n=== 1. the gate is real, and not vacuous ===");
{
  t("there is more than one workspace to gate", PAPER_WORKSPACES.length > 1, PAPER_WORKSPACES.join(","));
  t("every usable workspace is one the app knows",
    USABLE_PAPER_WORKSPACES.every((w) => (PAPER_WORKSPACES as readonly string[]).includes(w)));
  /** ⚠ IF EVERYTHING WERE USABLE THIS SUITE WOULD PASS PROVING NOTHING. */
  t("at least one workspace is NOT usable — else the gate is inert",
    PAPER_WORKSPACES.some((w) => !isWorkspaceUsable(w)),
    PAPER_WORKSPACES.filter((w) => !isWorkspaceUsable(w)).join(","));
  t("at least one IS usable — the teaching tool is not collateral damage",
    USABLE_PAPER_WORKSPACES.length >= 1);
}

console.log("\n=== 2. THE INVARIANT — nothing offered is unusable ===");
{
  const offered: PaperWorkspace[] = canOfferPaperTest() ? ["test"] : [];
  const bad = offered.filter((w) => !isWorkspaceUsable(w));
  t("⚠ every workspace the UI may offer is usable", bad.length === 0, bad.join(","));
  t("the test workspace is not offered while its answer interface is a stub",
    !canOfferPaperTest());
}

console.log("\n=== 3. the stub is really a stub — the reason is still true ===");
{
  /**
   * ⚠ THE GATE'S JUSTIFICATION, RE-DERIVED FROM THE PAGE ITSELF. If somebody
   * builds the answer interface and forgets to re-enable the CTA, this fails
   * and says so — the guard is not allowed to outlive its reason.
   */
  const test = code(readFileSync("src/app/past-papers/[paper]/test/page.tsx", "utf8"));
  const stub = /nothing you type anywhere on this page is saved/i.test(test);
  t("⚠ the test workspace still tells the reader nothing is saved", stub);
  t("⚠ and the gate agrees with it — if the stub is gone, re-enable the CTA",
    stub === !canOfferPaperTest(),
    stub ? "stub present, CTA hidden — consistent" : "STUB IS GONE: rebuild the CTA or update this guard");
}

console.log("\n=== 4. nothing was deleted — this is a render gate ===");
{
  const modal = code(readFileSync("src/app/past-papers/_start-test-modal.tsx", "utf8"));
  t("the modal component still exists", modal.includes("StartTestModal"));
  t("both mode routes are still referenced by it",
    /\/test/.test(modal) && /\/classroom/.test(modal));
  const single = code(readFileSync("src/app/past-papers/_single-paper.tsx", "utf8"));
  t("⚠ the render site is gated, not removed",
    /canOfferPaperTest\(\)/.test(single) && /StartTestModal/.test(single));
  t("the classroom teaching tool is untouched and still has no stub markers",
    !/not built yet|nothing you type/i.test(
      code(readFileSync("src/app/past-papers/[paper]/classroom/page.tsx", "utf8"))));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
