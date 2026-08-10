/**
 * Did every input come out the other side?
 *
 * ============================================================================
 * WHY THIS IS A SEPARATE, PURE MODULE
 * ============================================================================
 * marking.ts is `server-only` and cannot be imported by a test or a script. A
 * check that only ever runs inside the thing it is checking is not evidence,
 * so the arithmetic lives here: importable, tested, and callable by an audit
 * that wants to assert the same invariant independently.
 *
 * No database, no network, no types that need one.
 *
 * ============================================================================
 * ⚠ WHY THIS IS NOT "N RESPONSES IN, N MARKING RESULTS OUT"
 * ============================================================================
 * That is the obvious assertion, and here it would be WRONG — wrong in the
 * dangerous direction, because it fires on CORRECT behaviour, and an assertion
 * that cries wolf gets switched off by the third time someone sees it.
 *
 * A response legitimately produces no marking_results row in cases WCH11/01
 * actually contains:
 *
 *   20(b)(ii), 20(b)(iv), 21(c)(i)  answer types with no editor — nothing was
 *                                   collected, so there is nothing to mark
 *   22(c)                           the scheme records no figure to award on
 *                                   a bare answer, deliberately
 *   any unparseable numeric         reported for review rather than guessed at
 *
 * Six of that paper's ten answerable questions are not a 1:1 mapping. A strict
 * count would abort on a completely healthy run.
 *
 * So the invariant is different, and strictly stronger: every question_attempt
 * lands in EXACTLY ONE bucket, and the buckets sum to the input count. A
 * silent drop cannot satisfy that — the sum falls short and the caller aborts.
 * A question honestly reported as unmarkable satisfies it exactly.
 *
 * ============================================================================
 * ⚠ FOR AUDITS RUNNING VOLUME THROUGH THIS STACK
 * ============================================================================
 * Assert on these numbers. Do NOT infer success from a 200, from a summary
 * that renders, or from a screen that looks complete.
 *
 * Every failure found on this stack so far reported green:
 *   - a table that did not exist read as an RLS pass (PGRST205 and a real
 *     denial are identical from the client)
 *   - six rejected writes read as success, because persist() logged and
 *     returned
 *   - five discarded read errors read as "there is nothing here"
 *   - a dropped question read as a complete paper, because nobody counted
 *
 * The question is never "did it come back?" — it is "do the counts add up, and
 * how many actually landed?". `persisted` is the landing count, and it is
 * deliberately separate from `questionsOut`: a run can produce a full, correct
 * set of verdicts and store none of them.
 */

/**
 * One marked question, reduced to what reconciliation checks.
 *
 * ⚠ THE MARK FIELDS ARE HERE BECAUSE A QUESTION CENSUS IS NOT ENOUGH. This type
 * used to be `{ confidence }` alone, so every failure branch below compared
 * COUNTS OF QUESTIONS — and no combination of mark values could make the check
 * fail. Working capture then introduced a per-question mark invariant that
 * marking.ts states in a comment ("the totals would stop adding up") and that
 * nothing asserted: a question could report more marks of outcome than it is
 * worth and still reconcile perfectly, because one question went in and one
 * came out.
 *
 * A summary documented as "proof that nothing was dropped" has to be proof
 * about the marks too, or it is proof about the wrong thing.
 */
export type ReconcilableQuestion = {
  confidence: "deterministic" | "requires_review" | null;
  /** The tariff snapshotted on the attempt. The ceiling for everything below. */
  maxMarks: number;
  /** Denominator Tier 1 assessed. */
  assessedOutOf: number | null;
  /** Marks Tier 2 judged provisionally. Beside the confirmed total, never in it. */
  provisionalOutOf: number;
  /** Tariff nobody reached. */
  unassessedMarks: number;
};

export type MarkingReconciliation = {
  /** question_attempts rows read for this attempt. The denominator. */
  questionsIn: number;
  /** student_responses rows found for those questions. */
  responsesIn: number;
  /** Verdicts returned. MUST equal questionsIn. */
  questionsOut: number;
  /** confidence === 'deterministic' */
  confirmed: number;
  /** confidence === 'requires_review' */
  provisional: number;
  /** confidence === null — reported as unmarked, with a reason on screen. */
  notMarked: number;
  /** Rows this run wrote AND read back. NOT the number of verdicts. */
  persisted: number;
  /** Marks worked out and then lost on the way to the database. */
  persistFailed: number;
  /** Sum of every question's tariff. The ceiling the three buckets share. */
  marksIn: number;
  /** assessedOutOf + provisionalOutOf + unassessedMarks, across the paper. */
  marksAccountedFor: number;
};

export type ReconcileResult =
  | { ok: true; reconciliation: MarkingReconciliation }
  | { ok: false; reconciliation: MarkingReconciliation; problem: string };

export function reconcileMarking(input: {
  questionsIn: number;
  responsesIn: number;
  marked: ReconcilableQuestion[];
  persisted: number;
  persistFailed: number;
}): ReconcileResult {
  const confirmed = input.marked.filter((m) => m.confidence === "deterministic").length;
  const provisional = input.marked.filter((m) => m.confidence === "requires_review").length;
  const notMarked = input.marked.filter((m) => m.confidence === null).length;

  const marksIn = input.marked.reduce((n, m) => n + m.maxMarks, 0);
  // ⚠ A WHOLLY AI-MARKED QUESTION COUNTS ITS MARKS ONCE, NOT TWICE. On those,
  // assessedOutOf and provisionalOutOf describe THE SAME MARKS — the question
  // is provisional in its entirety, so its denominator is its tariff and
  // provisionalOutOf merely says how many points carried it. Summing both would
  // report a 2-mark long_text as 4 and abort a completely healthy paper, which
  // is the cry-wolf failure this file exists to avoid. The summary already
  // buckets it this way; this mirrors it rather than inventing a second rule.
  const accountedFor = (m: ReconcilableQuestion) =>
    m.confidence === "requires_review"
      ? (m.assessedOutOf ?? 0) + m.unassessedMarks
      : (m.assessedOutOf ?? 0) + m.provisionalOutOf + m.unassessedMarks;

  const marksAccountedFor = input.marked.reduce((n, m) => n + accountedFor(m), 0);

  const reconciliation: MarkingReconciliation = {
    questionsIn: input.questionsIn,
    responsesIn: input.responsesIn,
    questionsOut: input.marked.length,
    confirmed,
    provisional,
    notMarked,
    persisted: input.persisted,
    persistFailed: input.persistFailed,
    marksIn,
    marksAccountedFor,
  };

  // BOTH halves are checked. A bug that dropped one question and double-counted
  // another would satisfy either one alone.
  if (reconciliation.questionsOut !== reconciliation.questionsIn) {
    return {
      ok: false,
      reconciliation,
      problem: `${reconciliation.questionsIn} questions in, ${reconciliation.questionsOut} out — ${reconciliation.questionsIn - reconciliation.questionsOut} unaccounted for`,
    };
  }

  const bucketed = confirmed + provisional + notMarked;
  if (bucketed !== reconciliation.questionsOut) {
    return {
      ok: false,
      reconciliation,
      problem: `${reconciliation.questionsOut} verdicts but ${bucketed} bucketed (${confirmed} confirmed + ${provisional} provisional + ${notMarked} not marked)`,
    };
  }

  // ⚠ PER QUESTION, NOT JUST IN TOTAL. A paper-wide sum can hide one question
  // over-reporting while another under-reports, and the two faults have
  // different causes. This catches the shape working capture made possible:
  // Tier 1 confirming k marks for one point while Tier 2 is handed every
  // remaining point, so a 6-mark question reports 7 marks of outcome.
  const over = input.marked.find((m) => accountedFor(m) > m.maxMarks);
  if (over) {
    return {
      ok: false,
      reconciliation,
      problem:
        `a question worth ${over.maxMarks} mark(s) reports ${accountedFor(over)} ` +
        `(${over.assessedOutOf ?? 0} assessed + ${over.provisionalOutOf} provisional + ` +
        `${over.unassessedMarks} unassessed)`,
    };
  }

  if (marksAccountedFor > marksIn) {
    return {
      ok: false,
      reconciliation,
      problem: `${marksAccountedFor} marks of outcome reported on a paper worth ${marksIn}`,
    };
  }

  // Not a hard failure — persistence failures are ALREADY surfaced to the
  // student, and the verdicts themselves are sound. But an audit must be able
  // to see the shortfall without doing the subtraction itself, because the
  // subtraction is exactly what nobody did the first time.
  return { ok: true, reconciliation };
}

/**
 * One line, for an audit log or an abort message.
 *
 * States what landed, not just what was computed — `persisted` is the number
 * an audit should be reading.
 */
export function describeReconciliation(r: MarkingReconciliation): string {
  return (
    `${r.questionsIn} in -> ${r.questionsOut} out ` +
    `(${r.confirmed} confirmed, ${r.provisional} provisional, ${r.notMarked} not marked); ` +
    `${r.responsesIn} responses; ${r.persisted} persisted` +
    (r.persistFailed > 0 ? `, ${r.persistFailed} FAILED TO PERSIST` : "")
  );
}
