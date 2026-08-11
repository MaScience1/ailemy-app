/**
 * The results screen may refuse. These are the refusals.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/results-insights.test.ts
 *
 * ============================================================================
 * WHY THE EMPTY CASE IS FIRST AND LONGEST
 * ============================================================================
 * question_topics and grade_boundaries are EMPTY today. Everything below was
 * written against that, because the screen ships before the data does — and a
 * breakdown invented from no data is worse than no breakdown: a student cannot
 * tell the difference and will revise from it.
 *
 * So the assertions are mostly about what the code REFUSES to say, and every
 * refusal must carry a reason a person can act on.
 */
import {
  gradeFor,
  topicPerformance,
  attachInsights,
  whereMarksWent,
  type MarkedQuestionLite,
  type GradeBoundary,
} from "../../../src/lib/exam/results-insights.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const PAPER = "paper-1";
const OTHER = "paper-2";

const q = (o: Partial<MarkedQuestionLite> & { questionNumber: string }): MarkedQuestionLite => ({
  questionId: `id-${o.questionNumber}`,
  maxMarks: 2, awardedMarks: 2, assessedOutOf: 2,
  answerType: "numeric", studentAnswer: "something",
  ...o,
});

console.log("── AN EMPTY DATABASE MUST PRODUCE A REFUSAL, NOT A ZERO ──");
{
  const g = gradeFor({ paperId: PAPER, confirmedMarks: 40, confirmedAvailable: 80, paperTotal: 80, boundaries: [] });
  t("no boundaries -> no grade at all, not even estimated", g.available === false, g);
  t("...and says why in a sentence a person can act on",
    !g.available && /no grade boundaries are stored/i.test(g.reason), g);

  const tp = topicPerformance({ questions: [q({ questionNumber: "1" })], topics: [] });
  t("no topics -> refuses", tp.available === false, tp);
  t("...and says it would be invented rather than measured",
    !tp.available && /invented rather than measured/i.test(tp.reason), tp);

  const ins = attachInsights({ questions: [q({ questionNumber: "1" })], insights: [] });
  t("no insights -> refuses", ins.available === false);
}

console.log("\n── 'official' IS A CLAIM ABOUT A REAL EXAMINATION ──");
{
  const estimated: GradeBoundary[] = [
    { paperId: PAPER, grade: "A", rawMarkMin: 58, boundarySource: "estimated", sourceNote: "interpolated" },
    { paperId: PAPER, grade: "B", rawMarkMin: 51, boundarySource: "estimated", sourceNote: "interpolated" },
  ];
  const g = gradeFor({ paperId: PAPER, confirmedMarks: 60, confirmedAvailable: 80, paperTotal: 80, boundaries: estimated });
  t("an estimated ladder gives a grade", g.available === true && g.grade === "A", g);
  t("...labelled estimated", g.available && g.basis === "estimated", g);

  const official: GradeBoundary[] = estimated.map((b) => ({
    ...b, boundarySource: "official" as const, sourceNote: "published",
  }));
  const g2 = gradeFor({ paperId: PAPER, confirmedMarks: 60, confirmedAvailable: 80, paperTotal: 80, boundaries: official });
  t("an all-official ladder is official", g2.available && g2.basis === "official", g2);

  // ⚠ MIXED DEGRADES. A grade is decided by where the mark sits on the WHOLE
  // ladder, so one estimated rung makes the verdict an estimate even when the
  // rung the mark landed on is published.
  const mixed: GradeBoundary[] = [
    { paperId: PAPER, grade: "A", rawMarkMin: 58, boundarySource: "official", sourceNote: "published" },
    { paperId: PAPER, grade: "B", rawMarkMin: 51, boundarySource: "estimated", sourceNote: "guess" },
  ];
  const g3 = gradeFor({ paperId: PAPER, confirmedMarks: 60, confirmedAvailable: 80, paperTotal: 80, boundaries: mixed });
  t("one estimated rung makes the whole verdict estimated",
    g3.available && g3.basis === "estimated", g3);

  // ⚠ ANOTHER SESSION'S BOUNDARIES ARE NOT THIS SESSION'S. Boundaries move
  // between sittings; borrowing one is a fabrication wearing a real label.
  const wrongPaper: GradeBoundary[] = [
    { paperId: OTHER, grade: "A", rawMarkMin: 58, boundarySource: "official", sourceNote: "published" },
  ];
  const g4 = gradeFor({ paperId: PAPER, confirmedMarks: 60, confirmedAvailable: 80, paperTotal: 80, boundaries: wrongPaper });
  t("boundaries for a DIFFERENT paper are refused, not borrowed", g4.available === false, g4);

  const below = gradeFor({
    paperId: PAPER, confirmedMarks: 10, confirmedAvailable: 80, paperTotal: 80, boundaries: official,
  });
  t("a mark below every boundary refuses rather than inventing a bottom grade",
    below.available === false, below);
}

console.log("\n── AN UNASSESSED QUESTION IS NOT A WEAKNESS ──");
{
  // Counting a question nobody marked as 0 would tell a student they are weak
  // on a topic they were never assessed on.
  const questions = [
    q({ questionNumber: "1", questionId: "a", awardedMarks: 2, assessedOutOf: 2 }),
    q({ questionNumber: "2", questionId: "b", awardedMarks: null, assessedOutOf: null, maxMarks: 3 }),
  ];
  const topics = [
    { questionId: "a", topic: "Moles" },
    { questionId: "b", topic: "Moles" },
  ];
  const r = topicPerformance({ questions, topics });
  t("it computes", r.available === true, r);
  if (r.available) {
    const moles = r.rows.find((x) => x.topic === "Moles")!;
    t("...the unassessed question is excluded from BOTH sides",
      moles.awarded === 2 && moles.outOf === 2, moles);
    t("...and is named as ignored so the omission is visible",
      r.ignoredQuestions.includes("2"), r.ignoredQuestions);
  }
}
{
  // Every marked question lacks a topic -> refuse, do not show an empty chart.
  const r = topicPerformance({
    questions: [q({ questionNumber: "1", questionId: "a" })],
    topics: [{ questionId: "zzz", topic: "Unrelated" }],
  });
  t("topics that match no marked question refuse rather than charting nothing",
    r.available === false, r);
}

console.log("\n── AN INSIGHT IS NEVER AN ACCUSATION FROM A MARK ALONE ──");
{
  const insight = {
    questionId: "a",
    insightText: "Many candidates lost the state symbol mark, with dodecane labelled as (g).",
    insightType: "common_error",
  };

  // Got it right -> the insight is not shown at all.
  const right = attachInsights({
    questions: [q({ questionNumber: "20(b)(ii)", questionId: "a", awardedMarks: 2, assessedOutOf: 2 })],
    insights: [insight],
  });
  t("a question answered correctly gets no insight", right.available === false, right);

  // Lost the mark, and the answer SUPPORTS the claim.
  const matched = attachInsights({
    questions: [q({
      questionNumber: "20(b)(ii)", questionId: "a", awardedMarks: 1, assessedOutOf: 2,
      studentAnswer: "C12H26(g) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)",
    })],
    insights: [insight],
  });
  t("a lost mark WITH supporting evidence is matched",
    matched.available && matched.insights[0].strength === "matched", matched);
  t("...and carries the evidence from their own answer",
    matched.available && matched.insights[0].evidence === "(g)", matched);

  // ⚠ THE ONE THAT MATTERS. Lost the mark, but nothing in the answer says they
  // made THIS error — they left it blank, or made a different one.
  const observed = attachInsights({
    questions: [q({
      questionNumber: "20(b)(ii)", questionId: "a", awardedMarks: 0, assessedOutOf: 2,
      studentAnswer: "C12H26 + O2 -> CO2 + H2O",
    })],
    insights: [insight],
  });
  t("a lost mark WITHOUT supporting evidence is observed, never matched",
    observed.available && observed.insights[0].strength === "observed", observed);
  t("...and carries no evidence field to quote back at them",
    observed.available && observed.insights[0].evidence === undefined);

  const blank = attachInsights({
    questions: [q({
      questionNumber: "20(b)(ii)", questionId: "a", awardedMarks: 0, assessedOutOf: 2, studentAnswer: "",
    })],
    insights: [insight],
  });
  t("a blank answer can never be matched", blank.available && blank.insights[0].strength === "observed", blank);

  const unassessed = attachInsights({
    questions: [q({
      questionNumber: "20(b)(ii)", questionId: "a", awardedMarks: null, assessedOutOf: null,
    })],
    insights: [insight],
  });
  t("an UNASSESSED question gets no insight — it is not a lost mark",
    unassessed.available === false, unassessed);
}

console.log("\n── WHERE THE MARKS WENT IS COUNTED, NEVER NARRATED ──");
{
  const questions = [
    q({ questionNumber: "1", awardedMarks: 2, assessedOutOf: 2 }),                        // no loss
    q({ questionNumber: "2", awardedMarks: 0, assessedOutOf: 2, studentAnswer: "" }),      // blank
    q({ questionNumber: "3", awardedMarks: 0, assessedOutOf: 3, maxMarks: 3, studentAnswer: "250" }), // wrong
    q({ questionNumber: "4", awardedMarks: 1, assessedOutOf: 4, maxMarks: 4, studentAnswer: "x" }),   // partial
    q({ questionNumber: "5", awardedMarks: null, assessedOutOf: null, maxMarks: 3 }),      // unassessed
  ];
  const r = whereMarksWent(questions);
  t("it computes", r.available === true, r);
  if (r.available) {
    const by = Object.fromEntries(r.rows.map((x) => [x.category, x]));
    t("blank -> not_attempted, 2 marks", by.not_attempted?.marks === 2, by.not_attempted);
    t("answered but zero -> wrong_answer, 3 marks", by.wrong_answer?.marks === 3, by.wrong_answer);
    t("part marks -> partially_correct, 3 marks", by.partially_correct?.marks === 3, by.partially_correct);
    // ⚠ NOT A LOSS. Named separately so it is never added to what they dropped.
    t("unassessed -> its own category, 3 marks", by.not_assessable?.marks === 3, by.not_assessable);
    t("...and is EXCLUDED from totalLost", r.totalLost === 8, r.totalLost);
    t("every row names the questions behind it",
      r.rows.every((x) => x.questions.length > 0), r.rows);
    t("the biggest loss comes first",
      r.rows.every((x, i, a) => i === 0 || a[i - 1].marks >= x.marks), r.rows.map((x) => x.marks));
  }
  const clean = whereMarksWent([q({ questionNumber: "1", awardedMarks: 2, assessedOutOf: 2 })]);
  t("a perfect paper refuses rather than inventing a category", clean.available === false, clean);
  t("no questions at all refuses", whereMarksWent([]).available === false);
}

console.log("\n── THE WHOLE PAPER, AS IT STANDS TODAY: EVERY SECTION REFUSES ──");
{
  // This is the state a student would see right now. Every one of these must be
  // a refusal with a reason, and not one of them a plausible-looking zero.
  const questions = [
    q({ questionNumber: "1", awardedMarks: 1, assessedOutOf: 1, maxMarks: 1 }),
    q({ questionNumber: "20(a)", awardedMarks: 4, assessedOutOf: 4, maxMarks: 4 }),
  ];
  const g = gradeFor({ paperId: PAPER, confirmedMarks: 5, confirmedAvailable: 80, paperTotal: 80, boundaries: [] });
  const tp = topicPerformance({ questions, topics: [] });
  const ins = attachInsights({ questions, insights: [] });
  t("grade: unavailable", g.available === false);
  t("topics: unavailable", tp.available === false);
  t("insights: unavailable", ins.available === false);
  t("...and each carries a reason, not an empty string",
    [g, tp, ins].every((x) => !x.available && x.reason.length > 20),
    [g, tp, ins].map((x) => (!x.available ? x.reason : "")));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
