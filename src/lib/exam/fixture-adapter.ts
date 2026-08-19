/**
 * Turn an emitted mark scheme into something the seeder can accept.
 *
 * ============================================================================
 * ⚠ THE EMITTED MODULE IS MARK-SCHEME CONTENT. THE SEEDER WANTS A PAPER.
 * ============================================================================
 * emitFixtureSource writes `FixtureQuestion[]` — questionNumber, marks and the
 * criteria. The seeder's FIXTURES map is `Record<string, QuestionSet>`, and a
 * QuestionSet additionally needs a paper identity and, per question,
 * `parentQuestionNumber`, `displayOrder` and `answerType`. None of those are in
 * the emitted file, so `--set=<slug>-generated` could never have resolved: the
 * emitter's docstring said the seeder consumed its output and it never could.
 *
 * This derives the missing structure rather than asking anyone to type it, so
 * a new paper costs no hand-authoring.
 *
 * ============================================================================
 * ⚠ WHAT IT CANNOT DERIVE, IT REFUSES — IT NEVER DEFAULTS
 * ============================================================================
 * The tempting default is `answerType: "other"` for anything unrecognised.
 * That is a guess wearing a value's clothes: `other` reaches the database, the
 * marking layer routes on it, and a question that should have been
 * numeric_with_unit gets marked as free text with nobody told. Every
 * underivable field produces a REFUSAL naming the question and the field, and
 * refusals travel in the result and into the generated module's header.
 *
 * Pure. `.ts` specifiers on value imports — see markscheme-proposals.ts.
 */
import { compareQuestionNumbers, parseQuestionPath } from "./question-nav.ts";
import { extractMcqKey } from "./deterministic.ts";
import { ANSWER_TYPES, type AnswerType } from "./question-set.ts";
import type { FixtureQuestion } from "./markscheme-proposals.ts";

/**
 * Paper identity, as NATURAL KEYS. Stamped by the emitter, which knows the
 * row; never typed by hand.
 *
 * ⚠ NO uuid IN THE FILE. A generated module carrying a paperId is a generated
 * module that is wrong the moment it is copied to another environment, and a
 * uuid is unreviewable — nobody reading a diff can tell a correct one from a
 * transposed one. (paper_code, session, year) is legible, and the seeder
 * resolves it against the database AT RUN TIME, refusing unless exactly one
 * row matches.
 */
export type PaperMeta = {
  paperCode: string;
  session: string;
  year: number;
  totalMarks: number;
};

/** What the seeder reads back from past_papers to resolve the identity. */
export type PaperRow = {
  id: string;
  paper_code: string | null;
  session: string;
  year: number;
  total_marks: number | null;
};

export type ResolveResult =
  | { ok: true; paperId: string }
  | { ok: false; error: string };

/**
 * Resolve the uuid from natural keys, at run time, against real rows.
 *
 * ⚠ ZERO MATCHES AND MANY MATCHES ARE BOTH REFUSALS, and they are different
 * refusals. Zero means the paper is not in the catalogue — seeding would
 * create a mark scheme for nothing. Many means the natural key is not unique
 * on this database, and PICKING ONE would write a mark scheme onto another
 * subject's questions: "unit-1-may-june-2025" is Chemistry, Physics AND
 * Biology, which is the same lesson the review loader learned when
 * .maybeSingle() on a slug raised PGRST116.
 *
 * ⚠ AND A total_marks DISAGREEMENT IS A REFUSAL TOO. The stamped total is the
 * sum of the emitted questions' tariffs; the row's is the cover page. If they
 * differ, one of them is wrong about which paper this is, and neither can be
 * preferred.
 */
export function resolvePaperId(rows: readonly PaperRow[], meta: PaperMeta): ResolveResult {
  const matches = rows.filter(
    (r) => r.paper_code === meta.paperCode && r.session === meta.session && r.year === meta.year,
  );
  const key = `${meta.paperCode} ${meta.session} ${meta.year}`;

  if (matches.length === 0) {
    return { ok: false, error: `No paper in the catalogue matches ${key}. Nothing was seeded.` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error:
        `${matches.length} papers match ${key} (${matches.map((m) => m.id).join(", ")}). ` +
        `A natural key that is not unique cannot identify a paper — refusing rather than picking one.`,
    };
  }

  const row = matches[0];
  if (row.total_marks !== null && row.total_marks !== meta.totalMarks) {
    return {
      ok: false,
      error:
        `${key} is recorded as ${row.total_marks} marks but the fixture totals ${meta.totalMarks}. ` +
        `One of them is about a different paper; refusing rather than choosing.`,
    };
  }
  return { ok: true, paperId: row.id };
}

export type DerivedQuestion = {
  questionNumber: string;
  parentQuestionNumber: string | null;
  displayOrder: number;
  marks: number;
  answerType: AnswerType;
  /**
   * ⚠ marksOnCorrectAnswer IS THE TARIFF, AND ONLY FOR AN MCQ. Choosing the
   * right option earns the whole of a multiple-choice question — there is no
   * partial credit and no working to assess. It is NOT derived for any other
   * type, where "the right final answer" and "the marks it earns" are
   * genuinely different questions that the mark scheme answers per point.
   */
  expectedAnswer?: { value: string; marksOnCorrectAnswer: number };
  markScheme: FixtureQuestion["markScheme"];
};

export type AdapterResult = {
  questions: DerivedQuestion[];
  /** Named, per question and field. Empty means the whole paper derived. */
  refusals: string[];
  meta: PaperMeta | null;
};

/**
 * ⚠ SPARSE, LIKE THE HAND FIXTURE. Gaps let a later pass insert 20(b)(v)
 * without renumbering everything after it, and 0028 makes display_order unique
 * per paper so a renumber is a migration rather than an edit.
 */
const ORDER_STEP = 10;

// ============================================================================
// ANSWER TYPE, FROM WHAT THE MARK SCHEME ACTUALLY SAYS
// ============================================================================

/**
 * ⚠ EVERY RULE READS THE ARTEFACT, NOT THE QUESTION NUMBER.
 *
 * "Questions 1–19 are Section A, therefore MCQ" is true of this paper and is
 * not a derivation — it is this paper's answer key hardcoded as a range, and
 * the next paper with 18 or 20 multiple-choice questions would seed silently
 * wrong. The MCQ signal used here is the mark scheme's own sentence, "The only
 * correct answer is B", which is the same fact deterministic.ts refuses to
 * mark without.
 */
const TYPE_RULES: { type: AnswerType; re: RegExp; why: string }[] = [
  { type: "chemical_equation", re: /\b(equation|→|⇌)\b/i, why: "names an equation" },
  { type: "mechanism", re: /\bmechanism\b|\bcurly arrow/i, why: "names a mechanism" },
  { type: "graph", re: /\b(graph|plot|axis|axes|line of best fit)\b/i, why: "names a graph" },
  { type: "structure", re: /\b(structure|skeletal|displayed formula|dot and cross|dots and crosses|isomer)\b/i, why: "names a drawn structure" },
  { type: "apparatus", re: /\bapparatus\b|\bdiagram of the\b/i, why: "names apparatus" },
  { type: "numeric_with_unit", re: /\(\s*(kg|g|mol|dm3|cm3|kJ|J|K|s|%)\s*\)|\b(mol dm|kJ mol)/i, why: "names a unit" },
  { type: "numeric", re: /\bcalculat|\bwork out\b|\bvalue of\b/i, why: "names a calculation" },
];

export type TypeDecision =
  | { type: AnswerType; why: string }
  | { type: null; why: string };

export function deriveAnswerType(q: FixtureQuestion): TypeDecision {
  const text = q.markScheme.map((p) => `${p.criterion} ${p.guidance ?? ""}`).join(" ");

  // ⚠ MCQ FIRST AND ON ITS OWN EVIDENCE. "The only correct answer is B
  // (0.072 dm3)" also names a unit; read as numeric_with_unit it would be
  // marked by comparing free text to "0.072 dm3" instead of by option letter.
  if (q.markScheme.some((p) => extractMcqKey(p.criterion))) {
    return { type: "mcq", why: 'criterion states "the only correct answer is X"' };
  }
  for (const rule of TYPE_RULES) {
    if (rule.re.test(text)) return { type: rule.type, why: rule.why };
  }
  return { type: null, why: "no signal in the criteria for any answer type" };
}

/** The MCQ answer key, from the criterion that states it. */
export function deriveExpectedAnswer(q: FixtureQuestion): string | null {
  for (const p of q.markScheme) {
    const key = extractMcqKey(p.criterion);
    if (key) return key;
  }
  return null;
}

// ============================================================================
// STRUCTURE
// ============================================================================

/**
 * The nearest ancestor that is itself a question in this set.
 *
 * ⚠ NEAREST PRESENT ANCESTOR, NOT "STRIP ONE SEGMENT". 20(b)(iii)'s parent is
 * 20(b) if that exists as its own block and 20 otherwise; naming a parent that
 * was never inserted makes the seeder reference a row it has not written.
 */
export function deriveParent(questionNumber: string, all: readonly string[]): string | null {
  const path = parseQuestionPath(questionNumber);
  if (!path) return null;
  const present = new Set(all);
  for (let depth = path.segments.length - 1; depth >= 1; depth--) {
    const candidate = path.segments
      .slice(0, depth)
      .map((seg, i) => (i === 0 ? seg : `(${seg})`))
      .join("");
    if (candidate !== questionNumber && present.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Derive a seedable set, or say exactly what is missing.
 *
 * ⚠ SORTED CANONICALLY FIRST, WHICH IS WHAT MAKES PARENTS SAFE. The seeder
 * inserts in array order and cannot reference a row it has not written yet;
 * canonical order puts 20 before 20(b) before 20(b)(iii) by construction, so
 * the ordering is a property of the sort rather than a rule to remember.
 */
export function deriveQuestionSet(
  questions: readonly FixtureQuestion[],
  meta: Partial<PaperMeta> | null,
): AdapterResult {
  const refusals: string[] = [];

  const ordered = [...questions].sort((a, b) =>
    compareQuestionNumbers(a.questionNumber, b.questionNumber),
  );
  const names = ordered.map((q) => q.questionNumber);

  const derived: DerivedQuestion[] = [];
  ordered.forEach((q, i) => {
    if (!parseQuestionPath(q.questionNumber)) {
      refusals.push(`${q.questionNumber}: question number does not parse — cannot order or parent it`);
      return;
    }
    const decision = deriveAnswerType(q);
    if (!decision.type) {
      refusals.push(`${q.questionNumber}: answerType — ${decision.why}`);
      return;
    }
    const key = deriveExpectedAnswer(q);
    if (decision.type === "mcq" && !key) {
      refusals.push(`${q.questionNumber}: expectedAnswer — an MCQ with no stated answer letter`);
      return;
    }
    derived.push({
      questionNumber: q.questionNumber,
      parentQuestionNumber: deriveParent(q.questionNumber, names),
      displayOrder: (i + 1) * ORDER_STEP,
      marks: q.marks,
      answerType: decision.type,
      ...(key ? { expectedAnswer: { value: key, marksOnCorrectAnswer: q.marks } } : {}),
      markScheme: q.markScheme,
    });
  });

  // ⚠ PAPER IDENTITY IS THE EMITTER'S TO STAMP, because only it has the row.
  // Absent, this refuses rather than inventing one — a fixture applied to the
  // wrong paper writes a mark scheme onto someone else's questions. The uuid
  // is deliberately NOT among these: it is resolved at run time by
  // resolvePaperId, so no generated file carries an environment-specific id.
  const need: (keyof PaperMeta)[] = ["paperCode", "session", "year", "totalMarks"];
  const missing = need.filter((k) => meta?.[k] === undefined || meta?.[k] === null || meta?.[k] === "");
  for (const k of missing) {
    refusals.push(`paper identity: ${k} — not stamped by the emitter, so this cannot be seeded`);
  }

  return {
    questions: derived,
    refusals,
    meta: missing.length === 0 ? (meta as PaperMeta) : null,
  };
}

/** Every value the schema allows, for a reader checking what may be derived. */
export const SCHEMA_ANSWER_TYPES: readonly AnswerType[] = ANSWER_TYPES;

// ============================================================================
// THE FOUNDER'S OVERLAY
// ============================================================================

export type AnswerTypeOverlay = {
  /** questionNumber -> answerType, exactly as the schema spells it. */
  answerTypes: Record<string, string>;
};

/**
 * Apply founder-supplied answer types to the questions derivation refused.
 *
 * ============================================================================
 * ⚠ REFUSAL-ONLY, AND THAT IS THE WHOLE CONSTRAINT
 * ============================================================================
 * The overlay exists because `answerType` is a property of the QUESTION PAPER
 * — whether it says "State…" or "Explain…" — and this pipeline reads only the
 * mark scheme, which records what earns a mark and never what form the answer
 * takes. Seventeen questions on WCH11/01 are pure prose and no amount of
 * pattern work on their criteria recovers it.
 *
 * So a person supplies those. What they may NOT do is quietly overrule a
 * derivation:
 *
 *   - An entry for a question that DERIVED is a CONFLICT, not an override. If
 *     the mark scheme says "The only correct answer is B" and the overlay says
 *     long_text, one of them is wrong about the paper and the disagreement has
 *     to be looked at — silently preferring either is how a hand-maintained
 *     file drifts from the artefact it is meant to complete.
 *   - An entry naming a question that does not exist is a typo that would
 *     otherwise do nothing, forever, invisibly.
 *   - A value outside the schema enum is refused here rather than at the
 *     database constraint, where it would surface as an opaque CHECK violation
 *     three layers from the file that caused it.
 *
 * ⚠ IT IS A SEPARATE FILE FROM THE PROPOSALS ARTEFACT. The artefact is the
 * examiner's ruled work and is read-only to everything here; answer types are
 * a different kind of fact about a different document.
 */
export type OverlayResult = {
  applied: Record<string, AnswerType>;
  refusals: string[];
};

export function applyOverlay(
  overlay: AnswerTypeOverlay | null,
  refusedQuestionNumbers: readonly string[],
  allQuestionNumbers: readonly string[],
): OverlayResult {
  const applied: Record<string, AnswerType> = {};
  const refusals: string[] = [];
  if (!overlay) return { applied, refusals };

  const refused = new Set(refusedQuestionNumbers);
  const known = new Set(allQuestionNumbers);

  for (const [questionNumber, value] of Object.entries(overlay.answerTypes ?? {})) {
    if (!known.has(questionNumber)) {
      refusals.push(`overlay: ${questionNumber} is not a question in this paper`);
      continue;
    }
    if (!refused.has(questionNumber)) {
      refusals.push(
        `overlay: ${questionNumber} already derives its answerType — remove the entry, ` +
          `or say why the mark scheme is wrong`,
      );
      continue;
    }
    if (!(ANSWER_TYPES as readonly string[]).includes(value)) {
      refusals.push(
        `overlay: ${questionNumber} has answerType ${JSON.stringify(value)}, which the schema ` +
          `does not allow (${ANSWER_TYPES.join(", ")})`,
      );
      continue;
    }
    applied[questionNumber] = value as AnswerType;
  }
  return { applied, refusals };
}

/** Where a derived row's answerType came from. Printed in the table. */
export type TypeSource = "derived" | "founder-supplied";

export type OverlaidResult = AdapterResult & {
  sources: Record<string, TypeSource>;
};

/**
 * Derive, then fill the refused ones from the overlay.
 *
 * ⚠ THE OVERLAY CANNOT RESCUE ANYTHING BUT answerType. A question refused for
 * an unparseable number, or an MCQ with no stated letter, stays refused: those
 * are faults in the mark scheme, and a person typing a type over them would be
 * papering over a different problem.
 */
export function deriveWithOverlay(
  questions: readonly FixtureQuestion[],
  meta: Partial<PaperMeta> | null,
  overlay: AnswerTypeOverlay | null,
): OverlaidResult {
  const base = deriveQuestionSet(questions, meta);
  const sources: Record<string, TypeSource> = {};
  for (const q of base.questions) sources[q.questionNumber] = "derived";

  const refusedTypes = base.refusals
    .filter((r) => /: answerType —/.test(r))
    .map((r) => r.slice(0, r.indexOf(":")));
  const all = questions.map((q) => q.questionNumber);
  const { applied, refusals: overlayRefusals } = applyOverlay(overlay, refusedTypes, all);

  const names = [...questions].map((q) => q.questionNumber);
  const rescued: DerivedQuestion[] = [];
  const rescueRefusals: string[] = [];
  for (const [questionNumber, answerType] of Object.entries(applied)) {
    const q = questions.find((x) => x.questionNumber === questionNumber)!;

    // ⚠ AN OVERLAY MAY NOT CREATE AN UNMARKABLE MCQ. Found by a test: a
    // criterion reading "only correct answer is" with no letter never
    // registers as MCQ, so it is refused on answerType — and the overlay could
    // then declare it `mcq` anyway, seeding a multiple-choice question the
    // deterministic marker has nothing to compare against. The answer key is
    // the mark scheme's to state; typing the TYPE does not supply it.
    if (answerType === "mcq" && !deriveExpectedAnswer(q)) {
      rescueRefusals.push(
        `overlay: ${questionNumber} is declared mcq but its mark scheme states no answer letter — ` +
          `fix the criterion, do not seed an MCQ nothing can mark`,
      );
      continue;
    }

    rescued.push({
      questionNumber,
      parentQuestionNumber: deriveParent(questionNumber, names),
      displayOrder: 0, // reassigned below
      marks: q.marks,
      answerType,
      markScheme: q.markScheme,
    });
    sources[questionNumber] = "founder-supplied";
  }

  // ⚠ RENUMBERED OVER THE COMBINED SET. displayOrder is UNIQUE per paper
  // (0028), so numbering the derived rows and then slotting rescued ones in
  // would collide or leave the order not matching the paper.
  const merged = [...base.questions, ...rescued].sort((a, b) =>
    compareQuestionNumbers(a.questionNumber, b.questionNumber),
  );
  merged.forEach((q, i) => {
    q.displayOrder = (i + 1) * ORDER_STEP;
  });

  const stillRefused = base.refusals.filter(
    (r) => !Object.keys(applied).some((qn) => r.startsWith(`${qn}: answerType`)),
  );

  return {
    questions: merged,
    refusals: [...stillRefused, ...overlayRefusals, ...rescueRefusals],
    meta: base.meta,
    sources,
  };
}
