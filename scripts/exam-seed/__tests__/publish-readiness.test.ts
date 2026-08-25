/**
 * A LESSON MAY NOT GO LIVE WITH NO SPEC POINTS MAPPED.
 *
 * ============================================================================
 * ⚠ WHY THIS RULE EXISTS, AND WHY IT IS INVISIBLE TODAY.
 * ============================================================================
 * 7 lesson_spec_points rows exist in total, covering five lessons. Exactly one
 * lesson is published — and it is one of those five. So the one page a student
 * can open looks finished, and the gap behind the other 76 is undetectable
 * until the second lesson is published.
 *
 * At that moment a student gets a "THIS LESSON COVERS" heading with "Spec point
 * mapping coming soon" underneath, and a live-looking "Start practice" button
 * whose engine refuses — practice questions are selected BY spec point.
 *
 * ⚠ THE GUARD ASSERTS BEHAVIOUR: the decision function's output over every
 * input, and that the publish path actually consults it. Not that a line exists.
 */
import { readFileSync } from "node:fs";

import { publishBlocker, needsSpecPointCheck } from "../../../src/lib/admin/publish-readiness.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
/** ⚠ BOTH COMMENT SYNTAXES — this file's own prose names every symbol below. */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

console.log("\n=== 1. the decision, over every input ===");
{
  t("zero spec points blocks publishing", publishBlocker({ specPointCount: 0 }) !== null);
  t("one spec point is enough", publishBlocker({ specPointCount: 1 }) === null);
  t("many spec points are fine", publishBlocker({ specPointCount: 12 }) === null);
  /** ⚠ A NEGATIVE COUNT IS A BUG UPSTREAM, AND MUST NOT READ AS "MAPPED". */
  t("a negative count is treated as unmapped, not as satisfied",
    publishBlocker({ specPointCount: -1 }) !== null,
    String(publishBlocker({ specPointCount: -1 })));
}

console.log("\n=== 2. it SURFACES — the refusal is a sentence, not a silence ===");
{
  const msg = publishBlocker({ specPointCount: 0, lessonTitle: "Moles and molar mass" }) ?? "";
  t("the refusal names the lesson", msg.includes("Moles and molar mass"));
  t("⚠ the refusal says WHAT the student would have seen", /coming soon/i.test(msg));
  t("⚠ and says what to DO about it", /map at least one spec point/i.test(msg));
  t("it is a real sentence, not a code", msg.length > 80, `${msg.length} chars`);
  const anon = publishBlocker({ specPointCount: 0 }) ?? "";
  t("it still reads sensibly with no title", anon.startsWith("This lesson") && anon.length > 80);
}

console.log("\n=== 3. UNPUBLISHING IS NEVER BLOCKED ===");
{
  /**
   * ⚠ THE FIRST THING ANYONE DOES WITH A PAGE THAT LOOKS WRONG IS TAKE IT DOWN.
   * A guard that prevented that would be actively harmful, so only 'live' is
   * ever checked.
   */
  t("publishing is checked", needsSpecPointCheck("live"));
  t("⚠ unpublishing to draft is NOT checked", !needsSpecPointCheck("draft"));
  t("no other status triggers the check",
    !needsSpecPointCheck("archived") && !needsSpecPointCheck("coming_soon"));
}

console.log("\n=== 4. the publish path actually consults it ===");
{
  const actions = code(readFileSync("src/app/admin/lessons/actions.ts", "utf8"));
  t("setLessonStatus imports the decision", /publishBlocker/.test(actions) && /needsSpecPointCheck/.test(actions));
  t("⚠ it counts lesson_spec_points for the lesson being published",
    /lesson_spec_points/.test(actions) && /eq\("lesson_id", lessonId\)/.test(actions));
  /**
   * ⚠ A FAILED COUNT MUST REFUSE, NOT PUBLISH. `count` is null on error, and
   * `null ?? 0` is 0 — which happens to block, but for the wrong reason. The
   * explicit error branch is what makes that deliberate rather than lucky.
   */
  t("⚠ a failed count refuses rather than deciding on missing data",
    /countErr/.test(actions) && /not published/.test(actions));
  t("the refusal is returned as `error`, which the toggle already alerts",
    /return \{ error: blocker \}/.test(actions));
  const toggle = code(readFileSync("src/app/admin/_components/StatusToggle.tsx", "utf8"));
  t("⚠ StatusToggle surfaces result.error to the person pressing the button",
    /result\?\.error/.test(toggle) && /alert\(/.test(toggle));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
