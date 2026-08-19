/**
 * Turning interest registrations into a demand picture (§52).
 *
 * ⚠ PURE. The admin page does the I/O; every decision about how demand is
 * counted lives here, where it can be sabotaged without credentials.
 */

export type InterestRow = {
  id: string;
  subject: string;
  qualification: string;
  year_group?: string | null;
  exam_year?: number | null;
  status: string;
  created_at: string;
  country?: string | null;
  ready_to_start?: boolean | null;
};

export type DemandGroup = {
  key: string;
  subject: string;
  qualification: string;
  yearGroup: string | null;
  total: number;
  /** Rows still worth acting on — 'new' or 'contacted'. */
  open: number;
  readyToStart: number;
  earliestExamYear: number | null;
  latest: string;
};

/** Rows a cohort decision should NOT count. */
const CLOSED = new Set(["declined", "duplicate"]);

/**
 * ⚠ CONVERTED COUNTS TOWARD DEMAND, DECLINED AND DUPLICATE DO NOT.
 *
 * A converted registration is a real person who wanted this cohort and got it —
 * removing them would make a successful cohort look like it had no demand, and
 * "should I run this again" is exactly what this table is read to answer. A
 * duplicate is the same person twice and would inflate the number; a declined
 * one asked not to be contacted. `open` is tracked separately so the operator
 * can see how many are still actionable.
 */
export function groupDemand(rows: readonly InterestRow[]): DemandGroup[] {
  const acc = new Map<string, DemandGroup>();

  for (const r of rows) {
    if (CLOSED.has(r.status)) continue;

    const subject = (r.subject || "unknown").trim();
    const qualification = (r.qualification || "unknown").trim();
    // ⚠ NULL year group is its OWN bucket, never merged into a real one.
    // Before 0043 every row has null, so merging would invent a year group for
    // every registration ever taken.
    const yearGroup = r.year_group?.trim() || null;
    const key = `${subject}::${qualification}::${yearGroup ?? "-"}`;

    const g = acc.get(key) ?? {
      key, subject, qualification, yearGroup,
      total: 0, open: 0, readyToStart: 0, earliestExamYear: null, latest: r.created_at,
    };

    g.total += 1;
    if (r.status === "new" || r.status === "contacted") g.open += 1;
    if (r.ready_to_start === true) g.readyToStart += 1;
    if (typeof r.exam_year === "number") {
      g.earliestExamYear = g.earliestExamYear === null ? r.exam_year : Math.min(g.earliestExamYear, r.exam_year);
    }
    if (r.created_at > g.latest) g.latest = r.created_at;

    acc.set(key, g);
  }

  // Biggest demand first; ties broken by the most recent signup so a group that
  // is actively filling outranks a stale one of the same size.
  return [...acc.values()].sort((a, b) => b.total - a.total || b.latest.localeCompare(a.latest));
}

/** Human label for a group, without inventing a year group that is not there. */
export function demandLabel(g: DemandGroup): string {
  const parts = [g.subject, g.qualification];
  if (g.yearGroup) parts.push(g.yearGroup);
  return parts.join(" · ");
}
