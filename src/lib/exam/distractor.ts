/**
 * Which wrong option a distractor explanation is about.
 *
 * ============================================================================
 * WHAT THIS IS FOR
 * ============================================================================
 * Pearson mark schemes print, under an MCQ, a line for each wrong option
 * saying why it is wrong:
 *
 *   A is incorrect because the number of electrons is for a 79Br atom
 *   C is incorrect because the number of neutrons is for a 81Br atom
 *   D is incorrect because the number of neutrons is for a 81Br- ion
 *
 * Those are worth keeping — a student who picked C can be told exactly what
 * they did — but they are NOT marking content. They award nothing, they reject
 * nothing, and they are not examiner guidance. This module answers the only
 * question that has to be answered before one can be stored: WHICH OPTION.
 *
 * ============================================================================
 * ⚠ IT REFUSES RATHER THAN GUESSES, AND THAT IS THE WHOLE DESIGN
 * ============================================================================
 * The naive rule — "the line starts with A, so it is about A" — is wrong on
 * ordinary mark-scheme prose:
 *
 *   "A student who writes mol dm-3 gains the mark"      <- not about option A
 *   "Accept 2.5 to 2 significant figures"               <- not about option A
 *   "D is the correct answer"                           <- not a distractor
 *
 * A wrong option letter attaches an explanation to a student who did not make
 * that mistake, and tells them they were wrong about something they never
 * said. So detection requires the whole Pearson shape — an option letter, then
 * an is/are, then an explicit negative — and anything short of that returns
 * `manual`, which the review surface turns into a letter the reviewer picks by
 * hand. There is no low-confidence auto-attach path.
 *
 * ============================================================================
 * PURE AND IMPORT-FREE
 * ============================================================================
 * Same reason as question-nav.ts: the review surface is a client component and
 * the emitter is server-only. This is the logic both need and neither owns.
 */

/**
 * The option letters an MCQ may use.
 *
 * A–H rather than A–D: four is the Edexcel convention, but the spec asks for
 * extensibility and a paper that prints (E) should be answerable rather than
 * silently unrecognised.
 */
export const OPTION_ALPHABET = "ABCDEFGH";

const isOption = (letter: string): boolean => OPTION_ALPHABET.includes(letter);

/**
 * ⚠ THE FULL SHAPE IS REQUIRED, NOT THE FIRST CHARACTER.
 *
 *   ^ (option )? LETTER  word-boundary  [gap]  is/are  [not] incorrect/wrong
 *
 * The gap tolerates the ellipsis Pearson prints when the line continues from
 * the option text ("A …is incorrect because"). The word boundary after the
 * letter is what stops "Accept…" and "A student…" from reading as option A:
 * in both, the character after the A is a word character, so there is no
 * boundary there.
 */
const HEAD = String.raw`^\s*(?:option\s+)?([${OPTION_ALPHABET}])\b[\s.,…:;–—-]*(?:is|are)\s+`;

const DISTRACTOR_RE = new RegExp(HEAD + String.raw`(?:incorrect|wrong|not\s+correct)\b`, "i");

/**
 * ⚠ "IS CORRECT" IS NOT "IS INCORRECT", AND IS MATCHED ON PURPOSE.
 *
 * "D is the correct answer" is a real sentence in these schemes. It has to be
 * RECOGNISED and refused with its own reason, rather than falling through to
 * the generic refusal — a reviewer told "no pattern found" will hand-file it
 * as a distractor for D, which inverts the examiner's meaning. Told "this says
 * D is CORRECT", they will not.
 */
const POSITIVE_RE = new RegExp(HEAD + String.raw`(?:the\s+)?correct\b`, "i");

/**
 * More than one option in the opening clause — "A and C are incorrect".
 *
 * ⚠ THIS IS A REFUSAL, NOT A CHOICE OF THE FIRST. One explanation covering two
 * options cannot be stored against one of them without losing the other, and
 * picking the first silently discards half the examiner's meaning.
 */
const MULTI_RE = new RegExp(
  String.raw`^\s*(?:option[s]?\s+)?[${OPTION_ALPHABET}]\b\s*(?:,|and|&|/|or)\s*[${OPTION_ALPHABET}]\b`,
  "i",
);

export type OptionDetection = {
  /** The option this line explains, or null when it must be resolved by hand. */
  option: string | null;
  /** 1 when the full Pearson shape matched, 0 otherwise. There is no middle. */
  confidence: number;
  /** Why — shown to the reviewer, so a refusal is actionable rather than mute. */
  reason: string;
};

/**
 * Read the option letter out of a distractor explanation.
 *
 * Returns `option: null` for anything that is not unmistakably one, including
 * lines that name several options and lines that say an option is CORRECT.
 */
export function detectOption(text: string): OptionDetection {
  const line = (text ?? "").trim();
  if (!line) return { option: null, confidence: 0, reason: "The line is empty." };

  if (MULTI_RE.test(line)) {
    return {
      option: null,
      confidence: 0,
      reason: "This line names more than one option; pick the one it should be filed under.",
    };
  }

  const m = DISTRACTOR_RE.exec(line);
  if (!m) {
    const positive = POSITIVE_RE.exec(line);
    if (positive) {
      return {
        option: null,
        confidence: 0,
        reason:
          `This line says ${positive[1].toUpperCase()} is CORRECT, so it is not a distractor ` +
          `explanation.`,
      };
    }
    return {
      option: null,
      confidence: 0,
      reason: 'No "<option> is incorrect because…" pattern; choose the option by hand.',
    };
  }

  return { option: m[1].toUpperCase(), confidence: 1, reason: `"${m[1].toUpperCase()} is incorrect…"` };
}

export type DistractorResolution =
  | { status: "detected"; option: string; reason: string }
  | { status: "manual"; option: null; reason: string };

/**
 * Detect the option, then cross-check it against the question's correct answer.
 *
 * ⚠ THE CROSS-CHECK IS A REFUSAL, NOT A CORRECTION. `correctOption` comes from
 * the mark scheme's own criterion (extractMcqKey), which is the same fact the
 * marking layer refuses to mark without. If a line says the CORRECT option is
 * incorrect, one of the two readings is wrong and there is no basis for
 * preferring either — the same reasoning deterministic.ts already applies when
 * expected_value disagrees with the criterion. Storing it either way would put
 * "you were wrong to pick B" in front of a student who picked the right
 * answer.
 *
 * `correctOption` may be null: rulings happen BEFORE seeding — only 25 of 80
 * marks are seeded — so an answer key often does not exist yet. A missing key
 * skips the cross-check; it never blocks detection.
 */
export function resolveDistractorOption(
  text: string,
  correctOption?: string | null,
): DistractorResolution {
  const found = detectOption(text);
  if (!found.option) return { status: "manual", option: null, reason: found.reason };

  const key = (correctOption ?? "").trim().toUpperCase();
  if (key && isOption(key) && key === found.option) {
    return {
      status: "manual",
      option: null,
      reason:
        `This line says ${found.option} is incorrect, but the mark scheme says ${key} is the ` +
        `correct answer. Resolve the disagreement before filing it.`,
    };
  }

  return { status: "detected", option: found.option, reason: found.reason };
}

/** A stored distractor explanation, as it reaches the fixture. */
export type DistractorFeedback = {
  /** "A". Always present — a ruling cannot be saved without one. */
  option: string;
  /** The examiner's words, or the reviewer's correction of them. */
  text: string;
  /** The extractor's own line, so the entry stays traceable to the page. */
  sourceLine: string;
};

/** Is this a letter we can store a ruling against? */
export function isValidOption(value: unknown): value is string {
  return typeof value === "string" && value.length === 1 && isOption(value.toUpperCase());
}
