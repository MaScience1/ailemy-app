/**
 * What the results screen may say beyond the marks — and what it may not.
 *
 * ============================================================================
 * EVERY FUNCTION HERE CAN REFUSE, AND REFUSING IS THE FEATURE
 * ============================================================================
 * question_topics and grade_boundaries are EMPTY. Nothing has been mapped and
 * no boundary has been looked up. A screen that says "topic breakdown
 * unavailable" is correct; one that shows a plausible breakdown built from
 * nothing is the failure this codebase has spent a week removing — and it is
 * the more dangerous of the two, because a student cannot tell an invented
 * breakdown from a real one and will revise from it.
 *
 * So each of these returns a discriminated union whose `unavailable` arm
 * carries the REASON, and the caller cannot reach the numbers without first
 * handling it. There is no default, no zero-filled fallback, and no "0%" that
 * means "we don't know".
 *
 * Pure: no database, no imports. Callers do the reading.
 */

// ============================================================================
// SHAPES
// ============================================================================

export type MarkedQuestionLite = {
  questionId: string;
  questionNumber: string;
  maxMarks: number;
  /** null when the question could not be assessed at all. */
  awardedMarks: number | null;
  /** Only the tariff actually assessed. null alongside awardedMarks. */
  assessedOutOf: number | null;
  answerType: string;
  /** What the student actually wrote, as text, or null. */
  studentAnswer: string | null;
};

export type QuestionTopic = { questionId: string; topic: string };

export type GradeBoundary = {
  paperId: string;
  grade: string;
  rawMarkMin: number;
  boundarySource: "official" | "estimated";
  sourceNote: string | null;
};

export type ExaminerInsight = {
  questionId: string;
  insightText: string;
  insightType: string;
};

export type Unavailable = { available: false; reason: string };

// ============================================================================
// GRADE
// ============================================================================

export type GradeVerdict =
  | Unavailable
  | {
      available: true;
      grade: string;
      /**
       * ⚠ 'official' IS A CLAIM ABOUT A REAL EXAMINATION, and it is sayable
       * ONLY where a row exists for THIS paper_id with boundary_source =
       * 'official'. Boundaries differ by session — WCH11/01 January 2021 and
       * May 2025 are different numbers for the same grade — so a boundary
       * borrowed from another sitting is a fabrication wearing a real label.
       */
      basis: "official" | "estimated";
      /** The mark that earned it, and the paper total it was measured against. */
      rawMark: number;
      outOf: number;
      sourceNote: string | null;
    };

export function gradeFor(input: {
  paperId: string;
  confirmedMarks: number;
  paperTotal: number;
  boundaries: GradeBoundary[];
}): GradeVerdict {
  // ⚠ FILTERED TO THIS PAPER BEFORE ANYTHING ELSE. A boundary set keyed to a
  // different sitting is not a worse answer, it is a different question.
  const mine = input.boundaries.filter((b) => b.paperId === input.paperId);
  if (mine.length === 0) {
    return {
      available: false,
      reason:
        "No grade boundaries are stored for this exact paper and session, so no grade can be given — not even an estimated one.",
    };
  }
  if (input.paperTotal <= 0) {
    return { available: false, reason: "This paper has no recorded total, so a grade cannot be placed." };
  }

  const sorted = [...mine].sort((a, b) => b.rawMarkMin - a.rawMarkMin);
  const hit = sorted.find((b) => input.confirmedMarks >= b.rawMarkMin);
  if (!hit) {
    return {
      available: false,
      reason: "The confirmed mark falls below every stored boundary, so no grade band applies.",
    };
  }

  // ⚠ MIXED SOURCES DEGRADE TO ESTIMATED. If any boundary in the set that could
  // have applied is an estimate, the whole verdict is an estimate: a grade is
  // decided by where the mark sits relative to the WHOLE ladder, not by the one
  // row it happened to land on.
  const anyEstimated = mine.some((b) => b.boundarySource === "estimated");
  return {
    available: true,
    grade: hit.grade,
    basis: anyEstimated ? "estimated" : "official",
    rawMark: input.confirmedMarks,
    outOf: input.paperTotal,
    sourceNote: hit.sourceNote,
  };
}

// ============================================================================
// TOPIC PERFORMANCE
// ============================================================================

export type TopicRow = { topic: string; awarded: number; outOf: number; questions: string[] };
export type TopicVerdict = Unavailable | { available: true; rows: TopicRow[]; ignoredQuestions: string[] };

export function topicPerformance(input: {
  questions: MarkedQuestionLite[];
  topics: QuestionTopic[];
}): TopicVerdict {
  if (input.topics.length === 0) {
    return {
      available: false,
      reason:
        "No questions on this paper have been mapped to topics yet, so a topic breakdown would be invented rather than measured.",
    };
  }

  const byQuestion = new Map<string, string[]>();
  for (const t of input.topics) {
    byQuestion.set(t.questionId, [...(byQuestion.get(t.questionId) ?? []), t.topic]);
  }

  const rows = new Map<string, TopicRow>();
  const ignored: string[] = [];

  for (const q of input.questions) {
    // ⚠ AN UNASSESSED QUESTION IS EXCLUDED FROM BOTH SIDES. Counting it as 0
    // would tell a student they were weak on a topic they were never marked on.
    if (q.awardedMarks === null || q.assessedOutOf === null) {
      ignored.push(q.questionNumber);
      continue;
    }
    const topics = byQuestion.get(q.questionId);
    if (!topics || topics.length === 0) {
      ignored.push(q.questionNumber);
      continue;
    }
    for (const topic of topics) {
      const row = rows.get(topic) ?? { topic, awarded: 0, outOf: 0, questions: [] };
      row.awarded += q.awardedMarks;
      row.outOf += q.assessedOutOf;
      row.questions.push(q.questionNumber);
      rows.set(topic, row);
    }
  }

  if (rows.size === 0) {
    return {
      available: false,
      reason:
        "None of the questions that were marked on this paper carry a topic, so there is nothing to break down.",
    };
  }
  return {
    available: true,
    rows: [...rows.values()].sort((a, b) => a.awarded / a.outOf - b.awarded / b.outOf),
    ignoredQuestions: ignored,
  };
}

// ============================================================================
// EXAMINER INSIGHTS
// ============================================================================

/**
 * How strongly an insight may be attached to what a student did.
 *
 *   matched   their own answer supports the claim. "You wrote (g)."
 *   observed  the insight is real and the question was dropped, but nothing in
 *             the answer says THIS student made THAT mistake.
 *
 * ⚠ THE DIFFERENCE IS THE WHOLE POINT. "Many candidates labelled dodecane (g)"
 * is a fact about a cohort. Turning it into "you labelled dodecane (g)" because
 * a student lost the mark is an accusation invented from a number — they may
 * have left it blank, or made a different error entirely, and being told
 * confidently what they did wrong when they did something else is worse than
 * silence.
 */
export type InsightStrength = "matched" | "observed";

export type AttachedInsight = {
  questionNumber: string;
  insightText: string;
  insightType: string;
  strength: InsightStrength;
  /** Present only when matched: the substring of their answer that supports it. */
  evidence?: string;
};

export type InsightVerdict = Unavailable | { available: true; insights: AttachedInsight[] };

/**
 * Quoted material from an insight, e.g. the (g) in "labelled as (g)".
 *
 * Deliberately narrow: state symbols and short quoted tokens are the only
 * things this will look for, because they are the only things it can find in a
 * student's answer without interpreting it. Everything else stays `observed`.
 */
function claimTokens(insightText: string): string[] {
  const tokens = new Set<string>();
  for (const m of insightText.matchAll(/\((s|l|g|aq)\)/gi)) tokens.add(m[0].toLowerCase());
  for (const m of insightText.matchAll(/[“"']([^”"']{2,24})[”"']/g)) tokens.add(m[1].toLowerCase());
  return [...tokens];
}

export function attachInsights(input: {
  questions: MarkedQuestionLite[];
  insights: ExaminerInsight[];
}): InsightVerdict {
  if (input.insights.length === 0) {
    return { available: false, reason: "No examiner-report insights are stored for this paper." };
  }

  const byQuestion = new Map<string, ExaminerInsight[]>();
  for (const i of input.insights) {
    byQuestion.set(i.questionId, [...(byQuestion.get(i.questionId) ?? []), i]);
  }

  const out: AttachedInsight[] = [];
  for (const q of input.questions) {
    // ⚠ ONLY WHERE A MARK WAS ACTUALLY LOST. Showing an examiner's note about a
    // common error on a question the student got right reads as an accusation.
    // An unassessed question is not a lost mark either — it is a question
    // nobody marked.
    if (q.awardedMarks === null || q.assessedOutOf === null) continue;
    if (q.awardedMarks >= q.assessedOutOf) continue;

    for (const insight of byQuestion.get(q.questionId) ?? []) {
      const answer = (q.studentAnswer ?? "").toLowerCase();
      const hit = answer ? claimTokens(insight.insightText).find((t) => answer.includes(t)) : undefined;
      out.push({
        questionNumber: q.questionNumber,
        insightText: insight.insightText,
        insightType: insight.insightType,
        strength: hit ? "matched" : "observed",
        ...(hit ? { evidence: hit } : {}),
      });
    }
  }

  if (out.length === 0) {
    return {
      available: false,
      reason: "No insight applies: every question with an examiner note was answered correctly or was not assessed.",
    };
  }
  return { available: true, insights: out };
}

// ============================================================================
// WHERE THE MARKS WENT
// ============================================================================

export type LossCategory =
  | "not_attempted"
  | "wrong_answer"
  | "partially_correct"
  | "not_assessable";

export type LossRow = {
  category: LossCategory;
  marks: number;
  questions: string[];
};

export type LossVerdict = Unavailable | { available: true; rows: LossRow[]; totalLost: number };

const LABEL: Record<LossCategory, string> = {
  not_attempted: "left blank",
  wrong_answer: "answered, but not correct",
  partially_correct: "partly right — some marks earned",
  not_assessable: "not assessed — excluded from your total",
};

export const lossCategoryLabel = (c: LossCategory) => LABEL[c];

/**
 * Where the marks went, by category, from what actually happened.
 *
 * ⚠ EVERY CATEGORY IS DERIVED FROM THE QUESTION'S OWN OUTCOME. There is no
 * branch that says "you struggled with X" from a total, and no encouragement
 * that is not a count. A student reading this should be able to point at the
 * questions behind every line.
 */
export function whereMarksWent(questions: MarkedQuestionLite[]): LossVerdict {
  if (questions.length === 0) {
    return { available: false, reason: "This attempt has no questions to account for." };
  }

  const rows = new Map<LossCategory, LossRow>();
  const add = (category: LossCategory, marks: number, qn: string) => {
    const row = rows.get(category) ?? { category, marks: 0, questions: [] };
    row.marks += marks;
    row.questions.push(qn);
    rows.set(category, row);
  };

  let totalLost = 0;
  for (const q of questions) {
    if (q.awardedMarks === null || q.assessedOutOf === null) {
      // Not a loss — it is tariff nobody reached, and it is excluded from the
      // total AND the denominator elsewhere. Named so it is not mistaken for
      // marks the student dropped.
      add("not_assessable", q.maxMarks, q.questionNumber);
      continue;
    }
    const lost = q.assessedOutOf - q.awardedMarks;
    if (lost <= 0) continue;
    totalLost += lost;
    const blank = (q.studentAnswer ?? "").trim().length === 0;
    if (blank) add("not_attempted", lost, q.questionNumber);
    else if (q.awardedMarks === 0) add("wrong_answer", lost, q.questionNumber);
    else add("partially_correct", lost, q.questionNumber);
  }

  if (rows.size === 0) {
    return { available: false, reason: "No marks were lost on this paper." };
  }
  return {
    available: true,
    rows: [...rows.values()].sort((a, b) => b.marks - a.marks),
    totalLost,
  };
}


/**
 * The four verdicts a results screen renders. Declared HERE, in the pure
 * module, so a client component can name the type without importing the
 * server-only loader that produces it.
 */
export type ResultsContext = {
  grade: GradeVerdict;
  topics: TopicVerdict;
  insights: InsightVerdict;
  loss: LossVerdict;
};
