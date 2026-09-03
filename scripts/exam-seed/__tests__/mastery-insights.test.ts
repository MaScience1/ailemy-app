/**
 * Phase 2 of Service 3 — trend, retention, retrieval, rankings, history and
 * the Hydrogen read contract, every rule pinned deterministically.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/mastery-insights.test.ts
 *
 * ⚠ EVERY THRESHOLD IS IMPORTED, NEVER RETYPED (AGENTS.md). Fixtures are
 * built FROM the exported constants — move TREND_MOVE_AT or the retention
 * ladder and the expectations move with it. The clock is an argument
 * everywhere (nowIso), so no assertion depends on when the suite runs.
 */

import {
  MASTERY_EVIDENCE_FLOOR_MARKS,
  MASTERY_SECURE_AT,
} from "../../../src/lib/account/academic.ts";
import { buildCourseMastery } from "../../../src/lib/specification/mastery.ts";
import { trendFor, TREND_MOVE_AT, TREND_WINDOW_MARKS } from "../../../src/lib/specification/trend.ts";
import {
  retentionFor,
  retrievalStateFor,
  RETENTION_INTERVALS_DAYS,
  FAIL_STREAK_INTERVENTION,
} from "../../../src/lib/specification/retention.ts";
import { retrievalQueue } from "../../../src/lib/specification/retrieval.ts";
import { strengthsFor, weaknessesFor } from "../../../src/lib/specification/rankings.ts";
import { masteryAsOf, masterySeries, SERIES_POINTS } from "../../../src/lib/specification/history.ts";
import { buildCourseInsights, RECENT_ANSWER_WINDOW } from "../../../src/lib/specification/insights.ts";
import { masteryContextFor, CONTEXT_AREA_LIMIT } from "../../../src/lib/specification/hydrogen-context.ts";
import type {
  MasteryEvidenceRow,
  RetentionFacts,
  SpecMasteryFacts,
  SpecUnitNode,
} from "../../../src/lib/specification/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const NOW = "2026-09-03T12:00:00.000Z";
const daysAgo = (n: number, hour = 0) =>
  new Date(Date.parse(NOW) - n * 86_400_000 + hour * 3_600_000).toISOString();

const FLOOR = MASTERY_EVIDENCE_FLOOR_MARKS;
const W = TREND_WINDOW_MARKS;

let seq = 0;
/** n one-mark answers, k of them correct, all stamped at `at`. */
const answers = (
  code: string, correct: number, total: number, at: string | null,
): MasteryEvidenceRow[] =>
  Array.from({ length: total }, (_, i) => ({
    attemptId: `a${seq++}`,
    qIndex: i,
    specCode: code,
    markAwarded: i < correct ? 1 : 0,
    markAvailable: 1,
    attemptedAt: at,
    source: "lesson-practice" as const,
    examConditions: false,
  }));

const point = (code: string) => ({
  id: `p-${code}`, code, title: `Point ${code}`, description: `Statement ${code}`,
  commandTerms: [], lessons: [],
});
const UNITS: SpecUnitNode[] = [
  {
    id: "u1", code: "WCH11", name: "Unit 1",
    topics: [
      { id: "t1", code: "T1", name: "Formulae", points: [point("1.1"), point("1.2")] },
      { id: "t2", code: "T2", name: "Atomic structure", points: [point("2.1"), point("2.2")] },
    ],
  },
];

const facts = (state: SpecMasteryFacts["state"], awarded = W, outOf = W): SpecMasteryFacts => ({
  state, awarded, outOf, percent: null, evidenceConfidence: "limited",
  questionCount: outOf, marksShortOfFloor: 0, lastPractisedAt: null,
});

// ============================================================================
console.log("\n=== 1. trend: the window comparison, exactly ===");
// ============================================================================
{
  const improving = trendFor([
    ...answers("1.1", 0, W, daysAgo(20)),
    ...answers("1.1", W, W, daysAgo(2)),
  ]);
  t("weak earlier window, strong recent → improving", improving.state === "improving", improving.state);
  t("both window ratios are reported", improving.earlierRatio === 0 && improving.recentRatio === 1);

  const declining = trendFor([
    ...answers("1.1", W, W, daysAgo(20)),
    ...answers("1.1", 0, W, daysAgo(2)),
  ]);
  t("strong earlier, weak recent → declining", declining.state === "declining", declining.state);

  const stable = trendFor([
    ...answers("1.1", W, W, daysAgo(20)),
    ...answers("1.1", W, W, daysAgo(2)),
  ]);
  t("flat at/above secure → stable", stable.state === "stable", stable.state);

  const half = Math.ceil(W / 2);
  const stalled = trendFor([
    ...answers("1.1", half, W, daysAgo(20)),
    ...answers("1.1", half, W, daysAgo(2)),
  ]);
  t("flat below secure, two full windows → stalled", stalled.state === "stalled", stalled.state);

  const oneShort = trendFor([
    ...answers("1.1", 3, W - 1, daysAgo(20)),
    ...answers("1.1", W, W, daysAgo(2)),
  ]);
  t("earlier window one mark short → insufficient-evidence, never a guess",
    oneShort.state === "insufficient-evidence", oneShort.state);
  t("a stalled verdict is impossible on trivial evidence (insufficient fires first)",
    trendFor(answers("1.1", 1, 3, daysAgo(2))).state === "insufficient-evidence");

  // The move threshold, derived: just under it is noise, at it is a move.
  const under = trendFor([
    ...answers("1.1", half, W, daysAgo(20)),
    ...answers("1.1", half + Math.ceil(TREND_MOVE_AT * W) - 1, W, daysAgo(2)),
  ]);
  t("a delta just under TREND_MOVE_AT is not 'improving' (noise)",
    under.state !== "improving", under.state);
  const at = trendFor([
    ...answers("1.1", half, W, daysAgo(20)),
    ...answers("1.1", half + Math.ceil(TREND_MOVE_AT * W), W, daysAgo(2)),
  ]);
  t("a delta at/over TREND_MOVE_AT is 'improving'", at.state === "improving", at.state);

  const ancient = trendFor([
    ...answers("1.1", 0, 20, daysAgo(300)),
    ...answers("1.1", W, W, daysAgo(20)),
    ...answers("1.1", W, W, daysAgo(2)),
  ]);
  t("evidence older than both windows is ignored — history does not drag the verdict",
    ancient.state === "stable", ancient.state);

  t("timestampless rows cannot form a window",
    trendFor(answers("1.1", W, 2 * W, null)).state === "insufficient-evidence");
}

// ============================================================================
console.log("\n=== 2. retention: ladder, bands, failure — never rewriting mastery ===");
// ============================================================================
{
  const I1 = RETENTION_INTERVALS_DAYS[0];

  const fresh = retentionFor({
    facts: facts("secure"),
    rows: answers("1.1", W, W, daysAgo(Math.floor(I1 / 4))),
    nowIso: NOW,
  });
  t("recent demonstration → fresh, not due",
    fresh.band === "fresh" && !fresh.retrievalDue, fresh.band);
  t("one demonstration day earns the first interval", fresh.intervalDays === I1);

  const aging = retentionFor({
    facts: facts("secure"), rows: answers("1.1", W, W, daysAgo(I1 - 1)), nowIso: NOW,
  });
  t("inside the interval but past half → aging (review soon)",
    aging.band === "aging" && !aging.retrievalDue && retrievalStateFor(aging) === "review-soon",
    aging.band);

  const due = retentionFor({
    facts: facts("secure"), rows: answers("1.1", W, W, daysAgo(I1 + 3)), nowIso: NOW,
  });
  t("past the interval → at-risk and DUE",
    due.band === "at-risk" && due.retrievalDue && retrievalStateFor(due) === "retrieval-due",
    due.band);

  const stale = retentionFor({
    facts: facts("secure"), rows: answers("1.1", W, W, daysAgo(2 * I1 + 5)), nowIso: NOW,
  });
  t("past twice the interval → stale, still due", stale.band === "stale" && stale.retrievalDue);

  // The ladder: four distinct days of success stretch the interval to 60.
  const ladder = retentionFor({
    facts: facts("secure"),
    rows: [
      ...answers("1.1", 2, 2, daysAgo(120)),
      ...answers("1.1", 2, 2, daysAgo(90)),
      ...answers("1.1", 2, 2, daysAgo(70)),
      ...answers("1.1", 2, 2, daysAgo(40)),
    ],
    nowIso: NOW,
  });
  t("four demonstration days → the top interval",
    ladder.intervalDays === RETENTION_INTERVALS_DAYS[3] && ladder.demonstrationDays === 4);
  t("40 days old on a 60-day interval → aging, not due (repeated success extends the interval)",
    ladder.band === "aging" && !ladder.retrievalDue, ladder.band);

  const sameDay = retentionFor({
    facts: facts("secure"),
    rows: [
      ...answers("1.1", 2, 2, daysAgo(10, 1)),
      ...answers("1.1", 2, 2, daysAgo(10, 3)),
      ...answers("1.1", 2, 2, daysAgo(10, 8)),
    ],
    nowIso: NOW,
  });
  t("same-day repeats count as ONE demonstration day (§24 retry discount)",
    sameDay.demonstrationDays === 1 && sameDay.intervalDays === I1);

  // Failure after success: the success DATE stands; the streak grows.
  const failed = retentionFor({
    facts: facts("secure"),
    rows: [
      ...answers("1.1", W, W, daysAgo(I1 + 2)),
      ...answers("1.1", 0, 2, daysAgo(1)),
    ],
    nowIso: NOW,
  });
  t("a failed retrieval does not reset the demonstration date — still due",
    failed.retrievalDue && failed.lastDemonstratedAt === daysAgo(I1 + 2) && failed.failStreak === 2);

  const intervention = retentionFor({
    facts: facts("secure"),
    rows: [
      ...answers("1.1", W, W, daysAgo(30)),
      ...answers("1.1", 0, FAIL_STREAK_INTERVENTION, daysAgo(1)),
    ],
    nowIso: NOW,
  });
  t(`${FAIL_STREAK_INTERVENTION} consecutive failures → intervention-needed`,
    retrievalStateFor(intervention) === "intervention-needed");

  const partial = retentionFor({
    facts: facts("secure"),
    rows: [
      ...answers("1.1", W, W, daysAgo(30)),
      // 3 of 5 marks: not a demonstration (< 75%), not a failure (>= 50%).
      { attemptId: "px", qIndex: 0, specCode: "1.1", markAwarded: 3, markAvailable: 5,
        attemptedAt: daysAgo(1), source: "lesson-practice", examConditions: false },
    ],
    nowIso: NOW,
  });
  t("a middling answer neither demonstrates nor extends a fail streak",
    partial.failStreak === 0 && partial.lastDemonstratedAt === daysAgo(30));

  const emerging = retentionFor({
    facts: facts("emerging"), rows: answers("1.1", 2, W, daysAgo(3)), nowIso: NOW,
  });
  t("an emerging point is a practice concern, not a retrieval one",
    !emerging.eligible && retrievalStateFor(emerging) === null);

  const undated = retentionFor({
    facts: facts("secure"), rows: answers("1.1", W, W, null), nowIso: NOW,
  });
  t("no timestamped demonstration → honestly unscheduled, never an invented date",
    !undated.eligible);
}

// ============================================================================
console.log("\n=== 3. retrieval queue: ranked, explainable, deterministic ===");
// ============================================================================
{
  const I1 = RETENTION_INTERVALS_DAYS[0];
  const mk = (code: string, topicId: string, rows: MasteryEvidenceRow[], ratio = 1) => ({
    specCode: code,
    topicId,
    facts: facts("secure", Math.round(ratio * W), W),
    retention: retentionFor({ facts: facts("secure"), rows, nowIso: NOW }),
  });

  const points = [
    mk("1.1", "t1", answers("1.1", W, W, daysAgo(Math.floor(I1 / 4)))), // fresh
    mk("1.2", "t1", answers("1.2", W, W, daysAgo(I1 - 1))),             // review-soon
    mk("2.1", "t2", answers("2.1", W, W, daysAgo(I1 + 2))),             // due
    mk("2.2", "t2", answers("2.2", W, W, daysAgo(3 * I1))),             // stale, most overdue
  ];
  const q = retrievalQueue({ points });
  t("fresh points are never queued", q.every((c) => c.specCode !== "1.1"));
  t("most overdue due-point first, then the newer due, then review-soon",
    q.map((c) => c.specCode).join(",") === "2.2,2.1,1.2", q.map((c) => c.specCode).join(","));
  t("priorities are 1-based and sequential",
    q.map((c) => c.priority).join(",") === "1,2,3");
  t("every row explains itself with its own numbers",
    q.every((c) => /day/.test(c.reason)));

  const intervention = mk("1.2", "t1", [
    ...answers("1.2", W, W, daysAgo(6)),
    ...answers("1.2", 0, FAIL_STREAK_INTERVENTION, daysAgo(1)),
  ]);
  const q2 = retrievalQueue({ points: [...points, intervention] });
  t("intervention-needed outranks everything, even barely-aged",
    q2[0]?.specCode === "1.2" && q2[0]?.retrievalState === "intervention-needed",
    q2[0]?.specCode);

  const shuffled = retrievalQueue({ points: [...points].reverse() });
  t("the queue is idempotent — shuffled input, identical order",
    shuffled.map((c) => c.specCode).join(",") === q.map((c) => c.specCode).join(","));

  t("nothing learned → empty queue",
    retrievalQueue({ points: [mk("1.1", "t1", answers("1.1", 2, W, daysAgo(2)))].map((p) => ({
      ...p, facts: facts("emerging"), retention: retentionFor({ facts: facts("emerging"), rows: [], nowIso: NOW }),
    })) }).length === 0);
  t("limit is respected", retrievalQueue({ points, limit: 1 }).length === 1);
}

// ============================================================================
console.log("\n=== 4. strengths / weaknesses: evidence-aware, not lowest-percent ===");
// ============================================================================
{
  const noTrend = { state: "insufficient-evidence" as const, recentRatio: null, earlierRatio: null, recentMarks: 0, earlierMarks: 0 };
  const noRet: RetentionFacts = { eligible: false, band: null, retrievalDue: false,
    lastDemonstratedAt: null, demonstrationDays: 0, intervalDays: null, ageDays: null, failStreak: 0 };
  const p = (code: string, f: SpecMasteryFacts, trendState = noTrend.state, failStreak = 0) => ({
    specCode: code, topicId: "t1", facts: f,
    trend: { ...noTrend, state: trendState },
    retention: { ...noRet, failStreak },
  });
  const highConfFail: SpecMasteryFacts = { ...facts("emerging", 4, 24), evidenceConfidence: "high" };
  const thinFail: SpecMasteryFacts = { ...facts("emerging", 2, 12), evidenceConfidence: "limited" };
  const belowFloor: SpecMasteryFacts = facts("insufficient", 0, 1);

  const weak = weaknessesFor({
    points: [p("1.2", thinFail), p("1.1", highConfFail), p("2.1", belowFloor)],
  });
  t("0-of-1 evidence never enters the weakness ranking (below the floor)",
    weak.every((w) => w.specCode !== "2.1"));
  t("repeated failure on HIGH confidence outranks the same ratio on thin evidence",
    weak[0]?.specCode === "1.1", weak[0]?.specCode);

  const flat: SpecMasteryFacts = { ...facts("developing", 6, 12), evidenceConfidence: "high" };
  const weak2 = weaknessesFor({
    points: [p("1.1", flat, "improving"), p("1.2", flat, "declining"), p("2.1", flat, "stalled")],
  });
  t("equal ratios: declining first, stalled second, improving last",
    weak2.map((w) => w.specCode).join(",") === "1.2,2.1,1.1",
    weak2.map((w) => w.specCode).join(","));
  t("weakness reasons cite the marks", weak2.every((w) => /marks/.test(w.reason)));

  const strongFresh = p("1.1", { ...facts("secure", 22, 24), evidenceConfidence: "high" });
  strongFresh.retention = { ...noRet, eligible: true, band: "fresh", retrievalDue: false,
    lastDemonstratedAt: daysAgo(2), demonstrationDays: 2, intervalDays: 14, ageDays: 2 };
  const strongStale = p("1.2", { ...facts("secure", 12, 12), evidenceConfidence: "limited" });
  strongStale.retention = { ...noRet, eligible: true, band: "stale", retrievalDue: true,
    lastDemonstratedAt: daysAgo(50), demonstrationDays: 1, intervalDays: 7, ageDays: 50 };

  const strong = strengthsFor({ points: [strongStale, strongFresh] });
  t("high-confidence strength ranks above a limited one",
    strong[0]?.specCode === "1.1", strong[0]?.specCode);
  t("a strong-but-stale point says so", /not shown for a while/.test(strong[1]?.reason ?? ""));
  t("non-secure points are never strengths",
    strengthsFor({ points: [p("1.1", flat)] }).length === 0);
}

// ============================================================================
console.log("\n=== 5. history: as-of views and the derived series ===");
// ============================================================================
{
  const evidence = [
    ...answers("1.1", W, W, daysAgo(30)),
    ...answers("1.1", 0, W, daysAgo(2)),
  ];

  const before = masteryAsOf({ units: UNITS, evidence, atIso: daysAgo(35) });
  t("as of a date before any evidence: nothing is claimed",
    Object.keys(before.byCode).length === 0);

  const mid = masteryAsOf({ units: UNITS, evidence, atIso: daysAgo(10) });
  t("as of mid-history: only the earlier marks exist — no future leakage",
    mid.byCode["1.1"]?.awarded === W && mid.byCode["1.1"]?.outOf === W &&
    mid.byCode["1.1"]?.state === "secure",
    JSON.stringify(mid.byCode["1.1"]));

  const now = masteryAsOf({ units: UNITS, evidence, atIso: NOW });
  t("as of now: the full record, chronologically derived",
    now.byCode["1.1"]?.outOf === 2 * W && now.byCode["1.1"]?.state === "developing");

  const series = masterySeries({ units: UNITS, evidence, nowIso: NOW });
  t("series never exceeds SERIES_POINTS and never starts before evidence",
    series.length > 0 && series.length <= SERIES_POINTS);
  t("marks accumulate monotonically along the series",
    series.every((pt, i) => i === 0 || pt.outOf >= series[i - 1].outOf));
  t("the last point is the present cumulative record",
    series[series.length - 1]?.outOf === 2 * W);
  t("an early point above the floor carries the historical percent",
    series[0]?.percent === 100, series[0]?.percent);

  const thin = masterySeries({
    units: UNITS, evidence: answers("1.1", 3, 6, daysAgo(1)), nowIso: NOW,
  });
  t("a below-floor series point refuses a percent, exactly like the live view",
    thin.every((pt) => pt.percent === null));

  const foreign = masterySeries({
    units: UNITS,
    evidence: [...answers("9.9", 12, 12, daysAgo(5)), ...answers("1.1", W, W, daysAgo(3))],
    nowIso: NOW,
  });
  t("the series counts only usable evidence (foreign codes excluded)",
    foreign[foreign.length - 1]?.outOf === W);
}

// ============================================================================
console.log("\n=== 6. insights + the Hydrogen read contract (built, not wired) ===");
// ============================================================================
{
  const evidence = [
    ...answers("1.1", W, W, daysAgo(40)),           // secure long ago → due
    ...answers("1.2", 3, W, daysAgo(20)),
    ...answers("1.2", 3, W, daysAgo(2)),            // flat below secure → stalled
    ...answers("2.1", 0, W, daysAgo(20)),
    ...answers("2.1", W, W, daysAgo(1)),            // improving
  ];
  const mastery = buildCourseMastery({ units: UNITS, evidence });
  const insights = buildCourseInsights({ units: UNITS, mastery, evidence, nowIso: NOW });

  t("trend per code: stalled and improving where constructed",
    insights.trendByCode["1.2"]?.state === "stalled" &&
    insights.trendByCode["2.1"]?.state === "improving",
    JSON.stringify({ "1.2": insights.trendByCode["1.2"]?.state, "2.1": insights.trendByCode["2.1"]?.state }));
  t("topic trend pools its points' evidence",
    insights.trendByTopic["t1"] !== undefined);
  t("the due point is queued with a checkable reason",
    insights.queue.some((c) => c.specCode === "1.1" && /day/.test(c.reason)));
  t("evidence summary counts the recent window",
    insights.evidenceByCode["2.1"]?.recentSuccessful === Math.min(W, RECENT_ANSWER_WINDOW) &&
    insights.evidenceByCode["2.1"]?.recentTotal === RECENT_ANSWER_WINDOW);
  t("weaknesses and strengths are populated from the same facts",
    insights.weaknesses.some((w) => w.specCode === "1.2"));

  const ctx = masteryContextFor({ courseId: "c1", units: UNITS, mastery, insights });
  t("context lists are capped at CONTEXT_AREA_LIMIT",
    ctx.weakestAreas.length <= CONTEXT_AREA_LIMIT && ctx.retrievalDue.length <= CONTEXT_AREA_LIMIT);
  t("recently improved / stalled ride the trend states",
    ctx.recentlyImproved.some((a) => a.specCode === "2.1") &&
    ctx.stalledAreas.some((a) => a.specCode === "1.2"));
  t("current position is the first untouched point after the last touched one",
    ctx.currentSpecificationPosition?.specCode === "2.2",
    ctx.currentSpecificationPosition?.specCode);
  t("recent performance is the tail of the series",
    ctx.recentPerformance.length > 0 && ctx.recentPerformance.length <= 4);
  t("summary is mastery's own, not a recomputation",
    ctx.summary === mastery.summary);

  const untouched = masteryContextFor({
    courseId: "c1", units: UNITS,
    mastery: buildCourseMastery({ units: UNITS, evidence: [] }),
    insights: buildCourseInsights({
      units: UNITS, mastery: buildCourseMastery({ units: UNITS, evidence: [] }),
      evidence: [], nowIso: NOW,
    }),
  });
  t("no evidence → no position claimed, empty lists",
    untouched.currentSpecificationPosition === null && untouched.retrievalDue.length === 0);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
