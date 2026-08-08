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

/** One marked question, reduced to the only field reconciliation cares about. */
export type ReconcilableQuestion = {
  confidence: "deterministic" | "requires_review" | null;
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

  const reconciliation: MarkingReconciliation = {
    questionsIn: input.questionsIn,
    responsesIn: input.responsesIn,
    questionsOut: input.marked.length,
    confirmed,
    provisional,
    notMarked,
    persisted: input.persisted,
    persistFailed: input.persistFailed,
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
