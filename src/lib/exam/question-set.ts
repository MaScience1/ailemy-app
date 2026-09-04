/**
 * The question-set contract.
 *
 * ============================================================================
 * THIS FILE IS THE DOMAIN-LAYER BOUNDARY
 * ============================================================================
 * Everything here is pure: types, constants and a validator. No Supabase
 * client, no filesystem, no `process`, no network. That is deliberate and it
 * is the whole point of the module.
 *
 * Three consumers will eventually produce a QuestionSet, and all three must
 * agree on what a valid one is:
 *
 *   1. scripts/seed-exam-questions.ts   — the hand-authored seed (today)
 *   2. the admin extraction/approval UI — AI proposes, a human approves
 *   3. any future bulk backfill         — 233 papers, unattended
 *
 * If validation lived inside the seed script, (2) and (3) would each grow
 * their own copy and the three would drift — the same failure mode that
 * `isValidPaperPath` was extracted to prevent in the storage layer. So the
 * rule is the same one: THE VALIDATOR IS IMPORTED, NEVER RE-IMPLEMENTED.
 *
 * The database constraints in migration 0028 are the real enforcement. This
 * validator exists to fail *before* the write, with a message that names the
 * question, rather than after it with a Postgres constraint name. Every rule
 * below mirrors a constraint in 0028; where it adds a rule 0028 cannot express
 * (mark totals reconciling with the mark scheme, for instance) that is called
 * out in the comment.
 */

// ============================================================================
// ANSWER TYPES
// ============================================================================

/**
 * Mirrors `paper_questions_answer_type_check` in migration 0028 exactly.
 * Adding a member here without adding it to the CHECK constraint produces a
 * runtime 23514 on insert, which is why the array is the single source and
 * the type is derived from it rather than written twice.
 */
export const ANSWER_TYPES = [
  "mcq",
  "short_text",
  "long_text",
  "numeric",
  "numeric_with_unit",
  "chemical_equation",
  "structure",
  "mechanism",
  "graph",
  "apparatus",
  "freehand",
  "other",
] as const;

export type AnswerType = (typeof ANSWER_TYPES)[number];

/**
 * A question that carries children is a *container*: it holds the stem and the
 * shared context, and its marks are the sum of its parts rather than something
 * a student earns directly. `marks` on such a row is therefore expected to be
 * 0 — the leaves carry the marks. Enforced by `validateQuestionSet`.
 */
export const CONTAINER_ANSWER_TYPE: AnswerType = "other";

// ============================================================================
// THE SHAPE
// ============================================================================

/**
 * One mark-scheme point, as printed.
 *
 * An Edexcel mark scheme row has four columns — Question Number | Answer |
 * Additional Guidance | Mark — and the fields below split them by WHAT A
 * MARKER MUST DO with each line, which is the distinction 0029 added and the
 * one thing a single `accepted_alternatives` array could not express:
 *
 *   criterion  the Answer-column bullet. What earns the mark.
 *   accept[]   still earns it.        "Allow 306 (kg)", "Accept 13H2O(g)"
 *   reject[]   must NOT earn it.      "Do not award ions move"
 *   guidance   neither; prose.        worked examples, TE rules
 *
 * `reject` is the only one that can veto, and it is the reason the split
 * exists: flattened into one array, "Do not award ions move" reads as another
 * acceptable answer and the marker awards the exact thing the examiner forbids.
 */
export type MarkSchemeItemInput = {
  /**
   * The label as printed on the mark scheme — "M1", "A1", "IC1". Edexcel
   * frequently prints unlabelled bullets; in that case the importer's author
   * assigns "M1", "M2", … in printed order and says so in `criterion`.
   *
   * This value is a FOREIGN KEY BY CONVENTION: marking_results.point_code
   * refers to it by string within the same question. Renaming a point after
   * marking has happened silently orphans those results.
   */
  pointCode: string;
  /** The Answer-column bullet, verbatim. What earns the mark. */
  criterion: string;
  /**
   * Responses that DO earn the mark despite differing from `criterion`.
   *
   * "Ignore X" belongs here, not in `guidance`: operationally it instructs the
   * marker to award the mark despite X, which is an accept rule wearing
   * different words.
   */
  accept?: string[];
  /**
   * Responses that must NOT earn the mark, however plausible they look.
   *
   * An automated marker MUST evaluate this before awarding. Everything else on
   * this type is advisory; this is not.
   */
  reject?: string[];
  /**
   * Additional Guidance prose that neither grants nor withholds the mark:
   * worked examples, transferred-error rules, marking instructions. Verbatim.
   *
   * The guidance column is ONE MERGED CELL spanning every bullet in the row,
   * so attributing a line to a specific point is an interpretation. Attribute
   * a line to the point it plainly concerns, and row-wide rules ("Allow TE
   * throughout") to the last point.
   */
  guidance?: string;
  /**
   * @deprecated Superseded by {@link accept}, {@link reject} and
   * {@link guidance} in migration 0029. The column still exists so its DROP
   * can be its own migration; nothing should write to it. Retained on the type
   * only so an older fixture still compiles — the importer ignores it.
   */
  acceptedAlternatives?: string[];
};

/** Examiner-report commentary. NEVER student-readable — see 0028's RLS. */
export type ExaminerInsightInput = {
  insightText: string;
  /** Mirrors `examiner_report_insights_type_check` in 0028. */
  insightType?: "common_error" | "strong_candidates" | "warning";
};

/**
 * Where the question sits on the page.
 *
 * COORDINATE SPACE — pdf.js `getViewport({ scale: 1 })`: top-left origin, y
 * increasing DOWNWARD, `/Rotate` already applied. This is NOT raw PDF user
 * space (bottom-left origin, y up); the two differ by `y = pageHeight - y`
 * and conflating them mirrors every overlay vertically. See the long note on
 * `question_regions` in migration 0028.
 *
 * `rotationApplied` is the page's `/Rotate` when the bbox was captured. It is
 * not used to transform anything on read — the bbox is already in rotated
 * space — it exists so a renderer can assert the page still has the rotation
 * the region was authored against and refuse rather than draw sideways.
 */
export type QuestionRegionInput = {
  /** 1-based, matching pdf.js `getPage(n)` and how humans say "page 10". */
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationApplied?: 0 | 90 | 180 | 270;
  /** 0–1. Omit for hand-authored regions; the AI extractor fills it. */
  confidence?: number;
};

export type QuestionInput = {
  /** As printed: "1", "20", "20(b)(iii)". NOT sortable — see displayOrder. */
  questionNumber: string;
  /**
   * The question as printed, verbatim — what the student reads, and what the
   * marker reasons against. Added by migration 0029; before it there was
   * nowhere to put this, and an LLM asked "does this answer earn M2?" had to
   * infer the question from a cropped page image.
   *
   * Optional, and legitimately absent where the question IS a diagram (read
   * this spectrum, complete this mechanism). A placeholder is worse than null.
   *
   * ⚠ STUDENT-READABLE the moment the paper is live — paper_questions carries
   * a public read policy for live papers. Never put answers, mark-scheme
   * content or internal notes here; those belong on mark_scheme_items, which
   * no student-facing policy can reach.
   */
  questionText?: string;
  /**
   * `questionNumber` of the parent, or null for a top-level question. Resolved
   * to a uuid at insert time. A parent must appear EARLIER in the array than
   * its children — validated, not assumed, because the importer inserts in
   * array order and cannot reference a row it has not written yet.
   */
  parentQuestionNumber: string | null;
  /**
   * Sort key within the paper. Unique per paper (0028 enforces it). Sparse
   * numbering is intentional: leaving gaps lets a later pass insert 20(b)(v)
   * without renumbering everything after it.
   */
  displayOrder: number;
  marks: number;
  answerType: AnswerType;
  /** "State", "Calculate", "Explain", "Draw" — drives the marking prompt. */
  commandWord?: string;
  topic?: string;
  /**
   * @deprecated The single-value 0028 column, superseded by {@link specPoints}
   * and the question_spec_points table (0035). Retained so an older fixture
   * still compiles; the importer ignores it.
   */
  specPoint?: string;
  /**
   * Specification codes this question assesses — question_spec_points rows
   * (0035), written by the importer, which RESOLVES each code against the
   * paper's own course specification (spec_points via topics) and REFUSES a
   * code the catalogue does not hold: an invented code would silently create
   * evidence no specification map can place.
   *
   * ⚠ ORDER IS THE MAPPING'S RANKING: the FIRST code is the primary — the
   * point the question chiefly assesses — and it is the one the mastery
   * evidence model attributes the marks to (display_order carries the order
   * into the table; see src/lib/specification/exam-evidence.ts for why the
   * marks go to exactly one code). Codes after it are secondary context.
   *
   * Leaves only: a container's marks live on its children, so mapping the
   * container would create evidence attribution nothing can use.
   */
  specPoints?: string[];
  /**
   * The final answer a deterministic marker compares against (migration 0031).
   *
   * Transcribed by hand from the mark scheme, NOT parsed out of `guidance` at
   * runtime: on 22(c) that paragraph contains 10, 58, 0.17241, 161.5, 27.844
   * and 3.591, and picking the right one by pattern is guesswork that marks
   * correct students wrong. Absent means "not markable automatically", which
   * the marker reports honestly rather than guessing around.
   */
  expectedAnswer?: {
    /** A string, always: "0.0172" and "1.72e-2" differ in significant figures. */
    value: string;
    /** Omit where the scheme requires no unit — a percentage yield has none. */
    unit?: string;
    /** RELATIVE, e.g. 0.005 = ±0.5%. Omit for exact match. */
    tolerance?: number;
    /** Alternates the scheme explicitly allows ("Allow 306 (kg)"). */
    acceptedValues?: string[];
    /**
     * Marks awarded when the final answer matches, AS THE SCHEME STATES IT.
     *
     *   20(a)  "Correct answer with no working scores (4)"     -> 4
     *   22(c)  "Correct answer with SOME WORKING scores 3"     -> null
     *
     * ⚠ REQUIRED, AND `number | null` RATHER THAN OPTIONAL, ON PURPOSE.
     *
     * null means "this scheme states no figure we can act on" — a decision
     * somebody made while reading the mark scheme. Omitting the field used to
     * mean the same thing, which made a deliberate ruling and a half-finished
     * transcription look identical in the database, and the marking layer then
     * showed the student the same sentence for both. Requiring the key makes
     * the ruling a keystroke: forget it and the build fails.
     *
     * 22(c) is the case that forced it. "With SOME WORKING" is a condition
     * this app cannot test, because it captures no working — so those 3 marks
     * go to review rather than being awarded on a bare answer. See the note
     * beside `marksOnCorrectAnswer` in deterministic.ts, and 0031.
     */
    marksOnCorrectAnswer: number | null;
  };
  regions?: QuestionRegionInput[];
  markScheme?: MarkSchemeItemInput[];
  examinerInsights?: ExaminerInsightInput[];
  /**
   * A worked answer shown only after submission. Separate table, separate
   * policy — 0028 gives model_answers no policy mentioning auth.uid(), so a
   * student cannot read one through the API at all yet.
   */
  modelAnswer?: string;
};

export type QuestionSet = {
  /**
   * The `past_papers.id` UUID. NOT a slug: a slug is unique only within a
   * course, and two subjects already share "unit-1-january-2019". The
   * importer refuses a value that is not a uuid.
   */
  paperId: string;
  /**
   * Human-readable identity, checked against the database before writing so a
   * fixture cannot be applied to the wrong paper if its uuid is ever mistyped.
   */
  expect: {
    paperCode: string;
    session: string;
    year: number;
    /** Cover-page total. Reconciled against the sum of leaf marks. */
    totalMarks: number;
  };
  /**
   * False while the set covers only part of the paper. When false the
   * importer SKIPS the "leaf marks must sum to totalMarks" check and says so
   * loudly, because a partial seed cannot sum to 80.
   */
  complete: boolean;
  questions: QuestionInput[];
};

// ============================================================================
// VALIDATION
// ============================================================================

export type ValidationIssue = {
  /** `questionNumber`, or "" for whole-set issues. */
  where: string;
  message: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every rule that can be checked without touching the database.
 *
 * Returns issues rather than throwing so a caller can print all of them at
 * once — an importer that dies on the first problem makes you run it fifteen
 * times to find fifteen typos.
 */
export type ValidateOptions = {
  /**
   * True when the caller will resolve `paperId` from natural keys before it is
   * used — see the seeder's RESOLVE_BY.
   *
   * ⚠ IT WAIVES THE uuid CHECK AND NOTHING ELSE, AND ONLY ON DEMAND. A
   * generated fixture carries `paperId: ""` because no generated artefact may
   * hold an environment-specific uuid; validation runs BEFORE the resolution
   * (step 1 has no network, deliberately), so without this the empty string
   * failed the check that exists to catch a slug being passed as an id.
   *
   * The waiver is opt-in per set. A set that is NOT resolved at run time and
   * still has no uuid is exactly the mistake this check was written for, and
   * must still fail here — at step 1, before anything touches a database.
   */
  paperIdResolvedAtRuntime?: boolean;
};

export function validateQuestionSet(
  set: QuestionSet,
  options: ValidateOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (where: string, message: string) =>
    issues.push({ where, message });

  if (options.paperIdResolvedAtRuntime) {
    // ⚠ AN UNRESOLVED SET MUST BE EMPTY, NOT WRONG. Waiving the uuid check is
    // not the same as accepting anything: a set that claims runtime resolution
    // while carrying some other string is asserting two different identities.
    if (set.paperId !== "") {
      push(
        "",
        `paperId ${JSON.stringify(set.paperId)} is set on a fixture whose id is resolved at run ` +
          `time from natural keys. Leave it empty, or remove it from RESOLVE_BY.`,
      );
    }
  } else if (!UUID_RE.test(set.paperId)) {
    push(
      "",
      `paperId ${JSON.stringify(set.paperId)} is not a uuid. It must be past_papers.id, not a slug — a slug is unique only within a course.`,
    );
  }
  if (set.questions.length === 0) {
    push("", "the set contains no questions.");
    return issues;
  }

  const byNumber = new Map<string, QuestionInput>();
  const seenOrder = new Map<number, string>();
  const childMarks = new Map<string, number>();

  set.questions.forEach((q, index) => {
    const at = q.questionNumber;

    // --- identity ---------------------------------------------------------
    if (!at.trim()) push(`#${index}`, "questionNumber is empty.");
    if (byNumber.has(at)) {
      push(at, "duplicate questionNumber — 0028 is UNIQUE (paper_id, question_number).");
    }
    byNumber.set(at, q);

    const prior = seenOrder.get(q.displayOrder);
    if (prior !== undefined) {
      push(
        at,
        `displayOrder ${q.displayOrder} already used by ${prior} — 0028 is UNIQUE (paper_id, display_order).`,
      );
    }
    seenOrder.set(q.displayOrder, at);

    // --- parentage --------------------------------------------------------
    if (q.parentQuestionNumber !== null) {
      if (q.parentQuestionNumber === at) {
        push(at, "is its own parent.");
      } else if (!byNumber.has(q.parentQuestionNumber)) {
        // Ordering is a hard requirement, not a nicety: the importer resolves
        // parent uuids from rows it has already inserted this run.
        push(
          at,
          `parent ${q.parentQuestionNumber} is not defined earlier in the array. A parent must precede its children.`,
        );
      } else {
        childMarks.set(
          q.parentQuestionNumber,
          (childMarks.get(q.parentQuestionNumber) ?? 0) + q.marks,
        );
      }
    }

    // --- marks ------------------------------------------------------------
    if (!Number.isInteger(q.marks) || q.marks < 0) {
      push(at, `marks must be a non-negative integer, got ${q.marks}.`);
    }

    // --- answer type ------------------------------------------------------
    if (!ANSWER_TYPES.includes(q.answerType)) {
      push(
        at,
        `answerType ${JSON.stringify(q.answerType)} is not in the 0028 CHECK constraint.`,
      );
    }

    // --- regions ----------------------------------------------------------
    for (const r of q.regions ?? []) {
      if (!Number.isInteger(r.pageNumber) || r.pageNumber < 1) {
        push(at, `region pageNumber must be a 1-based integer, got ${r.pageNumber}.`);
      }
      if (r.width <= 0 || r.height <= 0) {
        push(at, `region has non-positive size (${r.width} x ${r.height}).`);
      }
      if (r.x < 0 || r.y < 0) {
        push(
          at,
          `region origin is negative (${r.x}, ${r.y}). Viewport space starts at the top-left corner — a negative value usually means raw PDF user space was used by mistake.`,
        );
      }
      if (r.confidence !== undefined && (r.confidence < 0 || r.confidence > 1)) {
        push(at, `region confidence must be 0..1, got ${r.confidence}.`);
      }
    }

    // --- mark scheme ------------------------------------------------------
    const points = q.markScheme ?? [];
    const codes = new Set<string>();
    for (const p of points) {
      if (codes.has(p.pointCode)) {
        push(
          at,
          `duplicate mark-scheme pointCode ${p.pointCode} — 0028 is UNIQUE (question_id, point_code).`,
        );
      }
      codes.add(p.pointCode);
      if (!p.criterion.trim()) {
        push(at, `mark-scheme point ${p.pointCode} has an empty criterion.`);
      }

      // The importer does not write acceptedAlternatives any more. Leaving it
      // populated would silently drop transcribed mark-scheme content on the
      // floor, so this is an error rather than a warning.
      if (p.acceptedAlternatives !== undefined) {
        push(
          at,
          `mark-scheme point ${p.pointCode} still uses acceptedAlternatives, which 0029 replaced. Split it into accept[] / reject[] / guidance — the importer ignores it and the content would be lost.`,
        );
      }

      for (const [field, entries] of [
        ["accept", p.accept],
        ["reject", p.reject],
      ] as const) {
        for (const entry of entries ?? []) {
          if (!entry.trim()) {
            push(at, `${p.pointCode} has an empty ${field}[] entry.`);
          }
        }
      }

      // A swapped accept/reject pair is the one transcription error with real
      // consequences — it awards a mark the examiner explicitly forbids — and
      // it is invisible in a diff. Edexcel's wording is formulaic enough that
      // the leading verb catches it.
      for (const entry of p.reject ?? []) {
        if (/^\s*(allow|accept)\b/i.test(entry)) {
          push(
            at,
            `${p.pointCode}: reject[] entry starts "${entry.trim().split(/\s+/)[0]}" — ${JSON.stringify(entry)}. That reads as an ACCEPT rule. If it is one, move it; a mark-scheme line in the wrong array inverts the marking decision.`,
          );
        }
      }
      for (const entry of p.accept ?? []) {
        if (/^\s*(do not|don't|never)\b/i.test(entry)) {
          push(
            at,
            `${p.pointCode}: accept[] entry reads as a REJECT rule — ${JSON.stringify(entry)}. Move it to reject[], or the marker will award the mark this line forbids.`,
          );
        }
      }
    }

    // --- spec points --------------------------------------------------------
    const specCodes = new Set<string>();
    for (const code of q.specPoints ?? []) {
      if (!code.trim()) push(at, "specPoints contains a blank code.");
      if (specCodes.has(code)) {
        push(at, `duplicate spec code ${code} — 0035 is UNIQUE (question_id, spec_code).`);
      }
      specCodes.add(code);
    }

    // A leaf worth n marks should have n mark-scheme points. This is the rule
    // 0028 CANNOT express — it needs the mark scheme and the question side by
    // side — and it is the one that catches a transcription that dropped a
    // bullet. Containers are exempt: their points live on the children.
    const isContainer = set.questions.some(
      (other) => other.parentQuestionNumber === at,
    );
    if (!isContainer && points.length > 0 && points.length !== q.marks) {
      push(
        at,
        `${points.length} mark-scheme point(s) for a ${q.marks}-mark question. Every mark should be traceable to one point, or marking cannot award partial credit.`,
      );
    }
    if (!isContainer && q.marks > 0 && points.length === 0) {
      push(at, `${q.marks} marks but no mark-scheme points — nothing to mark against.`);
    }
  });

  // --- containers ---------------------------------------------------------
  for (const [parentNumber, sum] of childMarks) {
    const parent = byNumber.get(parentNumber);
    if (!parent) continue;
    if (parent.marks !== 0 && parent.marks !== sum) {
      push(
        parentNumber,
        `carries ${parent.marks} marks of its own but its children sum to ${sum}. A container should hold 0 and let the leaves carry the marks, or double-counting follows.`,
      );
    }
    if (parent.answerType !== CONTAINER_ANSWER_TYPE) {
      push(
        parentNumber,
        `has children but answerType is ${JSON.stringify(parent.answerType)}. A container is not answerable — use ${JSON.stringify(CONTAINER_ANSWER_TYPE)}.`,
      );
    }
    if ((parent.specPoints?.length ?? 0) > 0) {
      push(
        parentNumber,
        "is a container but carries specPoints. Marks live on the leaves, so spec mapping must too — evidence attribution reads the leaf's codes.",
      );
    }
  }

  // --- paper total --------------------------------------------------------
  if (set.complete) {
    const leafTotal = set.questions
      .filter((q) => !set.questions.some((o) => o.parentQuestionNumber === q.questionNumber))
      .reduce((sum, q) => sum + q.marks, 0);
    if (leafTotal !== set.expect.totalMarks) {
      push(
        "",
        `complete: true, but leaf marks sum to ${leafTotal} and the paper is worth ${set.expect.totalMarks}.`,
      );
    }
  }

  return issues;
}

/** Leaf marks in the set, whether or not it is complete. */
export function leafMarkTotal(set: QuestionSet): number {
  return set.questions
    .filter((q) => !set.questions.some((o) => o.parentQuestionNumber === q.questionNumber))
    .reduce((sum, q) => sum + q.marks, 0);
}
