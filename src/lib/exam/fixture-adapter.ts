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

/** Paper identity. Stamped by the emitter, which knows the row; never typed. */
export type PaperMeta = {
  paperId: string;
  paperCode: string;
  session: string;
  year: number;
  totalMarks: number;
};

export type DerivedQuestion = {
  questionNumber: string;
  parentQuestionNumber: string | null;
  displayOrder: number;
  marks: number;
  answerType: AnswerType;
  expectedAnswer?: { value: string };
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
      ...(key ? { expectedAnswer: { value: key } } : {}),
      markScheme: q.markScheme,
    });
  });

  // ⚠ PAPER IDENTITY IS THE EMITTER'S TO STAMP, because only it has the row.
  // Absent, this refuses rather than inventing a uuid — a fixture applied to
  // the wrong paper writes a mark scheme onto someone else's questions.
  const need: (keyof PaperMeta)[] = ["paperId", "paperCode", "session", "year", "totalMarks"];
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
