/**
 * Demand grouping (§52) — what a cohort decision is allowed to be based on.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/demand.test.ts
 *
 * ⚠ NO CREDENTIALS. groupDemand is pure precisely so the counting rules can be
 * sabotaged without touching a PII table.
 */
import { groupDemand, demandLabel, type InterestRow } from "../../../src/lib/admin/demand.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

let n = 0;
const row = (o: Partial<InterestRow> = {}): InterestRow => ({
  id: `r${++n}`, subject: "chemistry", qualification: "ial-as",
  status: "new", created_at: `2026-08-${String(10 + n).padStart(2, "0")}T00:00:00Z`, ...o,
});

console.log("── GROUPING ──");
{
  const g = groupDemand([row(), row(), row({ qualification: "gcse-y11" })]);
  t("two distinct qualifications make two groups", g.length === 2, g.map((x) => x.key));
  t("the larger group leads", g[0].total === 2, g.map((x) => x.total));
  t("label omits an absent year group", demandLabel(g[0]) === "chemistry · ial-as", demandLabel(g[0]));
  const withYear = groupDemand([row({ year_group: "Year 11" })])[0];
  t("…and includes it when present",
    demandLabel(withYear) === "chemistry · ial-as · Year 11", demandLabel(withYear));
}

console.log("\n── WHICH STATUSES COUNT ──");
{
  const rows = [
    row({ status: "new" }), row({ status: "contacted" }), row({ status: "converted" }),
    row({ status: "declined" }), row({ status: "duplicate" }),
  ];
  const g = groupDemand(rows)[0];
  // ⚠ converted counts (a cohort that filled is evidence it should run again);
  // declined and duplicate do not (one asked not to be contacted, one is the
  // same person twice and would inflate the number).
  t("declined and duplicate are excluded from total", g.total === 3, g.total);
  t("converted is INCLUDED in total", g.total === 3);
  t("only new + contacted count as open", g.open === 2, g.open);
}

console.log("\n── NULL YEAR GROUP IS ITS OWN BUCKET ──");
{
  // ⚠ THE SABOTAGE THAT MATTERS BEFORE 0043. Every existing row has a null
  // year group. Folding null into a real bucket would invent a year group for
  // every registration ever taken.
  const g = groupDemand([row({ year_group: "Year 11" }), row({ year_group: null }), row({})]);
  t("null does not merge into 'Year 11'", g.length === 2, g.map((x) => x.yearGroup));
  const nullGroup = g.find((x) => x.yearGroup === null)!;
  t("the two null rows group together", nullGroup.total === 2, nullGroup.total);
  t("…and the labelled one stays alone",
    g.find((x) => x.yearGroup === "Year 11")!.total === 1);
  t("whitespace counts as absent",
    groupDemand([row({ year_group: "  " }), row({ year_group: null })]).length === 1);
}

console.log("\n── THE DERIVED FIGURES ──");
{
  const g = groupDemand([
    row({ ready_to_start: true, exam_year: 2028 }),
    row({ ready_to_start: true, exam_year: 2027 }),
    row({ ready_to_start: false }),
    row({ ready_to_start: null }),
  ])[0];
  t("ready-to-start counts only explicit true", g.readyToStart === 2, g.readyToStart);
  t("earliest exam year is the minimum, not the first seen", g.earliestExamYear === 2027, g.earliestExamYear);
  t("a group with no exam years reports null",
    groupDemand([row()])[0].earliestExamYear === null);
}

console.log("\n── ORDERING ──");
{
  const g = groupDemand([
    row({ subject: "biology" }), row({ subject: "biology" }), row({ subject: "biology" }),
    row({ subject: "physics" }),
  ]);
  t("biggest demand first", g[0].subject === "biology" && g[0].total === 3, g.map((x) => [x.subject, x.total]));
  // A tie goes to the group that is still filling.
  const tie = groupDemand([
    row({ subject: "biology", created_at: "2026-01-01T00:00:00Z" }),
    row({ subject: "physics", created_at: "2026-09-01T00:00:00Z" }),
  ]);
  t("a tie is broken by the most recent signup", tie[0].subject === "physics", tie.map((x) => x.subject));
}

console.log("\n── EMPTY AND DEGENERATE INPUT ──");
{
  t("no rows is no groups", groupDemand([]).length === 0);
  t("only declined rows is no groups",
    groupDemand([row({ status: "declined" }), row({ status: "duplicate" })]).length === 0);
  t("a blank subject does not crash and is labelled",
    groupDemand([row({ subject: "" })])[0].subject === "unknown");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
