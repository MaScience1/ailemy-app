/**
 * What is in the database that the fixture no longer claims.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * The seeder writes `mark_scheme_items` and `question_expected_answers` by
 * UPSERT. An upsert adds and overwrites; it never removes. So deleting a point
 * from a fixture does not delete it from the database — the row stays, with its
 * original criterion and accept[], now backed by nothing, and the run reports
 * "3 point(s) upserted" exactly as it would on a clean pass.
 *
 * That is not cosmetic. Marking reads `mark_scheme_items` by question_id. A
 * point deleted from the fixture because the examiner's scheme was re-read and
 * it was wrong goes on being awarded to students, and the only way to find out
 * is to read the table by hand.
 *
 * `seed-exam-questions.ts` already does this reconciliation one level up: a
 * question on the paper that the fixture does not contain is reported as an
 * orphan and left alone. This is the same rule one level down.
 *
 * ============================================================================
 * IT MUST NOT OVERSTATE THE CONSEQUENCE
 * ============================================================================
 * The first draft of this report led with "TIER 1 MARKING WILL GO ON AWARDING
 * THEM" for every orphan. That is false for most of them: tierFor() returns
 * "unmarkable" for structure, graph, chemical_equation, mechanism, apparatus,
 * freehand and other, and marking.ts returns `points: []` for those before it
 * ever reads the criteria. On the WCH11/01 fixture the blanket claim would have
 * been wrong for 10 of 25 points.
 *
 * A warning a reader can check and find false is what teaches them to skim it —
 * the same reason this must stay silent on a correct fixture. So the tier is
 * carried per point and the consequence is stated per group.
 *
 * ============================================================================
 * SCOPED TO QUESTIONS THE FIXTURE CONTAINS
 * ============================================================================
 * Rows hanging off a question the fixture does not mention are NOT orphans
 * here. That question is already reported as an orphan itself, and a fixture
 * makes no claim about the children of a question it does not contain —
 * counting them again would turn one honest warning into a wall of derived
 * ones. The rule is: for a question the fixture DOES own, the fixture is the
 * complete statement of that question's mark scheme and expected answer.
 *
 * ============================================================================
 * REPORTED, NEVER DELETED — AND ALWAYS WITH THE ID
 * ============================================================================
 * Nothing here deletes anything, and nothing here should. A cleanup path may
 * only delete rows it created, by id — an orphan is by definition a row this
 * run did not create, and it may be the more correct of the two.
 *
 * But the report TELLS a person to delete by id, so it has to print one. The
 * first draft printed question_number and point_code only, and question_number
 * is unique per PAPER, not globally: a reader following the instruction would
 * naturally write `WHERE question_number = '1(a)' AND point_code = 'M2'` and
 * hit every paper in the corpus. Naming a row by a key that is not unique, in
 * the same sentence that says "delete", is how that happens.
 *
 * Pure: no database, no I/O, AND NO IMPORTS. Callers do the reading, and they
 * also supply each question's marking tier rather than this module calling
 * tierFor() itself — the seeder runs these suites under plain `node`, which
 * resolves ESM specifiers literally, and the app's tsconfig does not allow the
 * `.ts` extension that would need. Keeping the module import-free means the
 * rule can be tested with no module graph at all.
 */

/** What tierFor() says about an answer_type. Supplied by the caller. */
export type MarkingTierName = "deterministic" | "ai" | "unmarkable";

/** One question as the fixture states it. */
export type FixtureQuestionClaim = {
  questionNumber: string;
  /** paper_questions.answer_type — printed, so the reader can check the tier. */
  answerType: string;
  /** tierFor(answerType), computed by the caller. Decides the consequence. */
  tier: MarkingTierName;
  /** Every point code the fixture carries for this question. May be empty. */
  pointCodes: string[];
  /** Whether the fixture carries an expectedAnswer block for it. */
  hasExpectedAnswer: boolean;
};

/** One `mark_scheme_items` row as the database holds it. */
export type StoredPoint = {
  /** The primary key. Required: the report tells a person to delete by it. */
  id: string;
  questionNumber: string;
  pointCode: string;
  /** 0028: `display_order integer NOT NULL DEFAULT 0`. Never null. */
  displayOrder: number;
  criterion: string;
};

/** One `question_expected_answers` row as the database holds it. */
export type StoredExpectedAnswer = {
  id: string;
  questionNumber: string;
  expectedValue: string | null;
};

export type OrphanPoint = StoredPoint & {
  answerType: string;
  /**
   * What actually happens to this point today, from tierFor().
   *
   *   deterministic  Tier 1 awards it. This is the alarming one.
   *   ai             Tier 2 sends it for review.
   *   unmarkable     nothing reads it — no editor collected an answer of this
   *                  type. Still worth reporting: it is the stored mark scheme,
   *                  and it starts being awarded the day the type is wired up.
   */
  tier: MarkingTierName;
  /**
   * True when a point the fixture DOES carry will be written to this same
   * display_order.
   *
   * A PREDICTION about the write, not an observation. buildMarkSchemeRows()
   * assigns display_order from the fixture array index, so dropping a point
   * renumbers every survivor after it while the orphan keeps its old ordinal.
   * 0028 puts no unique constraint on (question_id, display_order), so this
   * does not error — it surfaces as two points claiming one position and an
   * order that depends on the heap. describeFixtureOrphans() words it as a
   * prediction or a fact depending on whether the write has happened.
   */
  collidesOnDisplayOrder: boolean;
};

export type OrphanExpectedAnswer = StoredExpectedAnswer & {
  answerType: string;
  tier: MarkingTierName;
};

export type FixtureOrphans = {
  points: OrphanPoint[];
  expectedAnswers: OrphanExpectedAnswer[];
};

export function findFixtureOrphans(input: {
  claims: FixtureQuestionClaim[];
  storedPoints: StoredPoint[];
  storedExpectedAnswers: StoredExpectedAnswer[];
}): FixtureOrphans {
  // A duplicate would be last-write-wins, silently consulting one entry's point
  // codes and discarding the other's — misreporting in BOTH directions. The
  // seeder's validator rejects duplicates before this is reached, but this is
  // exported as a general-purpose function, so it states its own precondition.
  const claimed = new Map<string, FixtureQuestionClaim>();
  for (const c of input.claims) {
    if (claimed.has(c.questionNumber)) {
      throw new Error(
        `findFixtureOrphans: duplicate questionNumber ${JSON.stringify(c.questionNumber)} ` +
          `in claims — the fixture must state each question once`,
      );
    }
    claimed.set(c.questionNumber, c);
  }

  const points: OrphanPoint[] = [];
  for (const row of input.storedPoints) {
    const claim = claimed.get(row.questionNumber);
    if (!claim) continue; // the question itself is the orphan; reported there.
    if (claim.pointCodes.includes(row.pointCode)) continue;
    points.push({
      ...row,
      answerType: claim.answerType,
      tier: claim.tier,
      // The fixture will occupy display_order 0 … pointCodes.length - 1.
      collidesOnDisplayOrder: row.displayOrder < claim.pointCodes.length,
    });
  }

  const expectedAnswers: OrphanExpectedAnswer[] = [];
  for (const row of input.storedExpectedAnswers) {
    const claim = claimed.get(row.questionNumber);
    if (!claim) continue;
    if (claim.hasExpectedAnswer) continue;
    expectedAnswers.push({
      ...row,
      answerType: claim.answerType,
      tier: claim.tier,
    });
  }

  const byQuestionThenCode = (
    a: { questionNumber: string; pointCode?: string },
    b: { questionNumber: string; pointCode?: string },
  ) =>
    a.questionNumber.localeCompare(b.questionNumber) ||
    (a.pointCode ?? "").localeCompare(b.pointCode ?? "");

  points.sort(byQuestionThenCode);
  expectedAnswers.sort(byQuestionThenCode);
  return { points, expectedAnswers };
}

export function hasFixtureOrphans(orphans: FixtureOrphans): boolean {
  return orphans.points.length > 0 || orphans.expectedAnswers.length > 0;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Has the renumbering that creates a display_order collision actually happened?
 *
 * On a dry run it has not, and saying "NOW DUPLICATED" there describes a
 * database state that does not exist and that declining to commit will prevent.
 */
export type ReportTense = "planned" | "written";

/**
 * The warning, as lines. Says what was found, what it means for marking, and
 * what to do — an orphan report that only lists ids gets skimmed.
 */
export function describeFixtureOrphans(
  orphans: FixtureOrphans,
  tense: ReportTense,
): string[] {
  const lines: string[] = [];
  const willOrDoes = tense === "written" ? "does" : "will";

  if (orphans.points.length > 0) {
    lines.push(
      `${orphans.points.length} mark-scheme point(s) exist in the database but are ` +
        `not in the fixture for a question the fixture DOES own.`,
    );
    lines.push(
      `They are LEFT ALONE — an upsert never deletes, and this script never ` +
        `removes a row it did not create:`,
    );

    const marked = orphans.points.filter((p) => p.tier !== "unmarkable");
    const inert = orphans.points.filter((p) => p.tier === "unmarkable");

    const render = (p: OrphanPoint) =>
      `    ${p.questionNumber}  ${p.pointCode}  ` +
      `(display_order ${p.displayOrder}` +
      (p.collidesOnDisplayOrder
        ? tense === "written"
          ? ", NOW DUPLICATED"
          : ", WILL BE DUPLICATED BY THIS WRITE"
        : "") +
      `)  ${p.answerType}/${p.tier}\n` +
      `        id ${p.id}\n` +
      `        "${truncate(p.criterion, 60)}"`;

    if (marked.length > 0) {
      lines.push(
        `  ${marked.length} on a question that IS marked — these are still being ` +
          `awarded to students:`,
      );
      for (const p of marked) lines.push(render(p));
    }
    if (inert.length > 0) {
      lines.push(
        `  ${inert.length} on an answer_type with no marking tier, so nothing reads ` +
          `them today. They are still this question's stored mark scheme, and they ` +
          `start being awarded the day the type is wired up:`,
      );
      for (const p of inert) lines.push(render(p));
    }

    const collisions = orphans.points.filter((p) => p.collidesOnDisplayOrder);
    if (collisions.length > 0) {
      lines.push(
        `${collisions.length} of them ${willOrDoes} share a display_order with a point ` +
          `the fixture carries, because dropping a point renumbers the ones after it. ` +
          `Their order ${tense === "written" ? "is" : "would then be"} undetermined.`,
      );
    }
  }

  if (orphans.expectedAnswers.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(
      `${orphans.expectedAnswers.length} expected answer(s) exist in the database ` +
        `for a question whose fixture entry no longer carries one:`,
    );
    for (const e of orphans.expectedAnswers) {
      lines.push(
        `    ${e.questionNumber}  expected_value ${JSON.stringify(e.expectedValue)}  ` +
          `${e.answerType}/${e.tier}\n        id ${e.id}` +
          (e.tier === "deterministic"
            ? `\n        Deterministic marking reads this table — the removed answer is still in force.`
            : `\n        Nothing marks this answer_type today, so nothing reads it.`),
      );
    }
  }

  if (lines.length > 0) {
    lines.push("");
    lines.push(
      `Either restore them to the fixture, or delete them BY THE id ABOVE — ` +
        `deliberately, by hand. question_number is unique per paper, not across ` +
        `papers, so a DELETE keyed on it would hit every paper in the table. ` +
        `This script will not guess which you meant.`,
    );
  }

  return lines;
}
