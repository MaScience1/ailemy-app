/**
 * Copy must not promise a control that does not exist.
 *
 * ============================================================================
 * ⚠ THE FAULT THIS GUARDS IS NOT A LIE, IT IS AN HONEST PAGE WITH A FALSE EXIT
 * ============================================================================
 * OnboardingSteps told the student the truth about the big thing — "nothing you
 * typed has been sent anywhere" — and then, in the very next sentence, sent
 * them to a profile editor that does not exist. That is worse than the
 * limitation it was being careful about: the student goes looking, finds no
 * control, and concludes they are the one who is lost. An accurate warning
 * followed by a false remedy reads as a working product with a confusing UI.
 *
 * ⚠ SO THE ASSERTION IS TWO-SIDED, AND THAT IS THE WHOLE DESIGN. It is not
 * "never mention a target grade". It is "the claim and the control agree".
 *
 *   no writer  →  copy must not promise one     (today)
 *   a writer   →  this test goes RED            (when Phase 3 lands)
 *
 * The red is the point. When the editor is built, this suite fails and forces
 * the copy to be revisited in the same change, instead of the correction
 * quietly outliving the reason for it and the page under-promising forever.
 * A guard that only ever gets looser is not a guard.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const ROOT = new URL("../../../src", import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT);
const rel = (p: string) => p.slice(ROOT.length - 3);

console.log("\n=== 0. the scan reaches real files ===");
{
  // ⚠ THE MEASURING STICK FIRST. A repo scan that silently matched nothing
  // would report a clean bill of health for every rule below it.
  t(`walked src/ and found ${FILES.length} ts/tsx files`, FILES.length > 200, FILES.length);
  t("OnboardingSteps.tsx is among them — the file this guard exists for",
    FILES.some((f) => f.endsWith("OnboardingSteps.tsx")), "not found");
}

// ============================================================================
console.log("\n=== 1. IS THERE A TARGET-GRADE WRITER? ===");
// ============================================================================
/**
 * ⚠ A WRITE IS AN UPDATE OR AN UPSERT NAMING THE COLUMN OR ITS TABLE — not a
 * mention of the word. profile-reader.ts SELECTs student_courses and must not
 * count; a settings action that updates it must.
 */
const WRITE = /\.(update|upsert|insert)\s*\(/;
const writers = FILES.filter((f) => {
  const src = readFileSync(f, "utf8");
  if (!/target_grade|student_courses/.test(src)) return false;
  return src.split("\n").some((line, i, all) => {
    const window = all.slice(Math.max(0, i - 3), i + 4).join("\n");
    return WRITE.test(line) && /target_grade|student_courses/.test(window);
  });
});
const hasWriter = writers.length > 0;
console.log(`  target-grade writers found: ${writers.length}${writers.length ? " → " + writers.map(rel).join(", ") : ""}`);

// ============================================================================
console.log("\n=== 2. THE CLAIM AND THE CONTROL MUST AGREE ===");
// ============================================================================
{
  /** Phrases that promise the student a place to SET a target grade. */
  const PROMISES = [
    /can be set today/i,
    /set a target grade any time/i,
    /set your target grade (on|from|in) your profile/i,
    /target grade.{0,40}\b(on|from|in) your profile/i,
  ];

  const offenders: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    for (const re of PROMISES) {
      const m = src.match(re);
      if (m) offenders.push(`${rel(f)} — "${m[0].slice(0, 70)}"`);
    }
  }

  if (!hasWriter) {
    t("⚠ NO WRITER EXISTS, so no file may promise the student a place to set one",
      offenders.length === 0, offenders.join("\n      "));
    console.log("      (when a writer lands, section 3 flips this and demands the copy back)");
  } else {
    t("a writer exists, so the promise is allowed to reappear", true, writers.map(rel).join(", "));
  }
}

// ============================================================================
console.log("\n=== 3. ⚠ THE DELIBERATE RED, FOR WHEN PHASE 3 LANDS ===");
// ============================================================================
{
  /**
   * ⚠ THIS IS NOT A BUG WHEN IT FIRES. If you are reading this because the
   * suite went red here, you have just built the target-grade writer — good.
   * Go back to src/components/account/OnboardingSteps.tsx and restore the
   * remedy sentence and the profile-first button order, then delete this
   * section. The copy was made deliberately vague because the control did not
   * exist; it should not stay vague once it does.
   */
  t("no target-grade writer yet — /welcome's cautious copy is still the honest one",
    !hasWriter,
    `A WRITER NOW EXISTS (${writers.map(rel).join(", ")}). This is expected on the Phase 3 ` +
    `commit. Update OnboardingSteps.tsx to point at the real editor, then remove this section.`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
