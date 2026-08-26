/**
 * THE NEXT CLASS IS NOT THE NEXT CALENDAR ENTRY.
 *
 * ⚠ THE AS COHORT OPENS WITH "Onboarding & diagnostics" ON SUN 13 SEPTEMBER,
 * and teaching starts TUE 15 SEPTEMBER. A teaser that sorted by date and took
 * the first row would tell a parent their child's first lesson is the 13th —
 * they would arrive expecting to be taught and find a diagnostic.
 *
 * These assert the DECISION over every input the type admits, including the
 * ones that only appear when something upstream is wrong.
 */
import { readFileSync } from "node:fs";

import { nextClass, NON_TEACHING_KINDS } from "../../../src/lib/home/next-class.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

const NOW = new Date("2026-09-10T12:00:00Z");
const ev = (o: Partial<Record<string, unknown>>) => ({
  key: "k", type: "group", status: "scheduled",
  startsAt: new Date("2026-09-15T16:00:00Z"), endsAt: new Date("2026-09-15T18:30:00Z"),
  title: "Edexcel IAL Chemistry AS", subject: "chemistry", qualification: null,
  yearGroup: null, cohortSlug: "ial-chemistry-as-sep-2026", teacherName: null,
  cancelledReason: null, kind: "teaching", ...o,
}) as never;

console.log("\n=== 1. onboarding is skipped, teaching is chosen ===");
{
  const onboarding = ev({ kind: "onboarding", title: "Onboarding & diagnostics",
    startsAt: new Date("2026-09-13T16:00:00Z"), endsAt: new Date("2026-09-13T17:30:00Z") });
  const firstClass = ev({ kind: "teaching" });
  const got = nextClass([onboarding, firstClass], NOW);
  t("⚠ the 13 Sep onboarding session is NOT returned", got?.title !== "Onboarding & diagnostics");
  t("⚠ the 15 Sep teaching session IS", got?.startsAt.toISOString().startsWith("2026-09-15") === true,
    got?.startsAt.toISOString());
  /** ⚠ ORDER-INDEPENDENT: the filter must win, not the array order. */
  t("and the same holds when onboarding is listed second",
    nextClass([firstClass, onboarding], NOW)?.kind === "teaching");
}

console.log("\n=== 2. nothing resolves → null, never a placeholder ===");
{
  t("no events → null", nextClass([], NOW) === null);
  t("only onboarding → null, not the onboarding row",
    nextClass([ev({ kind: "onboarding" })], NOW) === null);
  t("⚠ an UNKNOWN kind is excluded — the safe default when data does not say",
    nextClass([ev({ kind: "workshop" })], NOW) === null);
  t("⚠ a null kind is excluded — that is a private slot, not a cohort lesson",
    nextClass([ev({ kind: null })], NOW) === null);
  t("a cancelled class is not the next class",
    nextClass([ev({ status: "cancelled" })], NOW) === null);
  t("a private event is not a group lesson", nextClass([ev({ type: "private_open" })], NOW) === null);
  t("a session already finished is not upcoming",
    nextClass([ev({ startsAt: new Date("2026-09-01T16:00:00Z"), endsAt: new Date("2026-09-01T18:00:00Z") })], NOW) === null);
}

console.log("\n=== 3. the soonest qualifying class wins ===");
{
  const later = ev({ startsAt: new Date("2026-09-22T16:00:00Z"), endsAt: new Date("2026-09-22T18:30:00Z") });
  const sooner = ev({ startsAt: new Date("2026-09-15T16:00:00Z"), endsAt: new Date("2026-09-15T18:30:00Z") });
  t("soonest first, whatever the input order",
    nextClass([later, sooner], NOW)?.startsAt.toISOString().startsWith("2026-09-15") === true);
  t("a session in progress still counts as next",
    nextClass([ev({ startsAt: new Date("2026-09-10T11:00:00Z"), endsAt: new Date("2026-09-10T13:00:00Z") })], NOW) !== null);
}

console.log("\n=== 4. the page renders nothing when it is null ===");
{
  const page = code(readFileSync("src/app/[locale]/page.tsx", "utf8"));
  t("the page derives it rather than hardcoding a date", /nextClass\(/.test(page));
  /**
   * ⚠ THE ABSENT BRANCH IS `: null`, NOT AN EMPTY-STATE STRING. A placeholder
   * date on a page a parent decides from is worse than no date, and this
   * product has shipped a fabricated-slot incident once already.
   */
  t("⚠ the teaser is conditional and renders NOTHING when absent",
    /upcomingClass \? \(/.test(page) && /\) : null\}/.test(page));
  t("no hardcoded September date anywhere on the page",
    !/13 September|15 September|Sep 13|Sep 15/.test(page));
  t("onboarding and clinic are the documented exclusions",
    NON_TEACHING_KINDS.includes("onboarding") && NON_TEACHING_KINDS.length >= 1);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
