/**
 * What the extractor filed somewhere nobody could rule on it.
 *
 * ============================================================================
 * ⚠ THE FAILURE THIS EXISTS TO FIND IS NOT "MISSING". IT IS "MISFILED".
 * ============================================================================
 * 20(b)(iii) was reported as "guidance-cell answer lines never captured". They
 * were captured. The artefact holds all four:
 *
 *   "307 (kg)"                      -> guidance[]
 *   "Allow 306 (kg)"                -> accept[]
 *   "Allow 307000 / 306000 g"       -> accept[]
 *   "(check mole ratio from 20bii)" -> guidance[]
 *
 * The extractor read them, decided what they were, and put them in buckets the
 * review surface never asks about. Only `requiresRuling` reaches a reviewer, so
 * a line sorted into `accept` or `guidance` is a line the examiner never sees
 * and never rules on — while the question still shows "0 to rule" and can be
 * approved. That is worse than dropping it: a dropped block leaves a hole the
 * tariff arithmetic finds, and a misfiled line leaves no trace at all.
 *
 * "307 (kg)" is the ANSWER to a six-mark calculation, sitting in a bucket
 * labelled examiner prose.
 *
 * Pure and read-only. This module reports; it never rewrites the artefact.
 */

export type AuditClass =
  | "answer-value-in-guidance"
  | "concession-never-flagged"
  | "mid-line-truncation"
  | "empty-marking-point";

export type AuditFinding = {
  questionNumber: string;
  /** Which bucket the extractor put it in: "guidance", "accept", "reject". */
  bucket: string;
  cls: AuditClass;
  text: string;
  why: string;
};

export type AuditReport = {
  findings: AuditFinding[];
  byQuestion: { questionNumber: string; count: number; classes: AuditClass[] }[];
};

/**
 * A value a student could WRITE — the answer, not a remark about the answer.
 *
 * ⚠ REQUIRES A NUMBER AND LITTLE ELSE. "307 (kg)" is an answer;
 * "(11400) × 9.25 = 105 450" is a line of worked example, which belongs in
 * guidance and is not a finding. The discriminator is that a worked line
 * carries an operator or an equals sign and an answer line does not.
 */
const WORKED_EXAMPLE = /[=×x÷+]|\bcalculation\b|^example\b/i;
const HAS_NUMBER = /\d/;
const UNIT_TAIL = /\(?\s*(kg|g|mol|dm3|cm3|%|s|K|J|kJ)\s*\)?\s*$/i;

/** Concession and scope language: the examiner telling a marker what to do. */
const CONCESSION = /^\s*(allow|accept|ignore|do not|reject|credit|penalis)/i;

/** A note asking the marker to go and check something else. */
const CHECK_STYLE = /^\s*\(?\s*check\b/i;

/**
 * A line that stops mid-sentence.
 *
 * ⚠ THE LIVE CASE: 22(c) carries "TE throughout, but final answer must be less
 * than" as a flagged line, and "100%" as a SEPARATE guidance entry. The
 * examiner's sentence was cut in two by the extractor's line handling, and the
 * half that reached the reviewer was the half that says nothing. The founder
 * hand-completed it; nothing warned them it was incomplete.
 */
const TRAILING_CONNECTIVE =
  /\b(than|less than|greater than|more than|at least|up to|and|or|of|to|for|from|with|between|if|unless|except)\s*$/i;

const isAnswerValue = (text: string): boolean => {
  const t = text.trim();
  if (!t || !HAS_NUMBER.test(t)) return false;
  if (WORKED_EXAMPLE.test(t)) return false;
  // A bare number with a unit, or a short numeric fragment, reads as an answer.
  return UNIT_TAIL.test(t) || t.replace(/[\d\s.,()/-]/g, "").length <= 3;
};

type AuditLine = { text: string; derivedFrom?: string };

type AuditQuestion = {
  questionNumber: string;
  points: readonly { pointCode: string; criterion: string; derivedFrom?: string }[];
  accept?: readonly AuditLine[];
  reject?: readonly AuditLine[];
  guidance?: readonly AuditLine[];
  requiresRuling?: readonly AuditLine[];
};

/**
 * ⚠ A HAND-TRANSCRIBED LINE IS NOT MISFILED, BY DEFINITION.
 *
 * When a person types a block in, they classify every line by choosing which
 * field to type it into. 21(b)(i) carries "Allow between 8496 and 27107" in
 * guidance because the founder decided it belonged there. Reporting that back
 * to them as a finding is noise, and noise in an audit is how the real
 * findings stop being read.
 */
const HAND = "hand-transcribed";
const byHand = (l: { derivedFrom?: string }): boolean => l.derivedFrom === HAND;

/**
 * Everything the extractor decided on the reviewer's behalf, and should not
 * have.
 *
 * ⚠ IT REPORTS; IT DOES NOT REPAIR. Rewriting the artefact from a heuristic
 * would be the same mistake one level up — a machine deciding which of an
 * examiner's sentences matter. The output is a list for a person to act on.
 */
export function auditArtefact(questions: readonly AuditQuestion[]): AuditReport {
  const findings: AuditFinding[] = [];

  for (const q of questions) {
    const flagged = new Set((q.requiresRuling ?? []).map((l) => l.text.trim()));

    // ── lines filed into a bucket the reviewer is never shown ──────────
    for (const [bucket, lines] of [
      ["guidance", q.guidance ?? []],
      ["accept", q.accept ?? []],
      ["reject", q.reject ?? []],
    ] as const) {
      for (const line of lines) {
        const text = line.text.trim();
        if (!text || flagged.has(text) || byHand(line)) continue;

        if (CONCESSION.test(text)) {
          findings.push({
            questionNumber: q.questionNumber, bucket, text,
            cls: "concession-never-flagged",
            why: "A concession or scope instruction the examiner never got to rule on.",
          });
        } else if (CHECK_STYLE.test(text)) {
          findings.push({
            questionNumber: q.questionNumber, bucket, text,
            cls: "concession-never-flagged",
            why: "A check-this-elsewhere note, filed as prose.",
          });
        } else if (bucket === "guidance" && isAnswerValue(text)) {
          findings.push({
            questionNumber: q.questionNumber, bucket, text,
            cls: "answer-value-in-guidance",
            why: "This looks like the ANSWER, filed as examiner prose.",
          });
        }
      }
    }

    // ── a sentence cut in half ─────────────────────────────────────────
    for (const line of q.requiresRuling ?? []) {
      if (byHand(line)) continue;
      if (TRAILING_CONNECTIVE.test(line.text.trim())) {
        findings.push({
          questionNumber: q.questionNumber, bucket: "requiresRuling",
          text: line.text.trim(), cls: "mid-line-truncation",
          why: "Ends on a connective — the rest of the sentence is elsewhere or lost.",
        });
      }
    }

    // ── a marking point with no criterion at all ───────────────────────
    for (const p of q.points) {
      if (byHand(p)) continue;
      if (!p.criterion.trim()) {
        findings.push({
          questionNumber: q.questionNumber, bucket: `points.${p.pointCode}`,
          text: "(empty)", cls: "empty-marking-point",
          why: "The answer cell is a drawing, so there is no text to extract. Needs hand-transcription.",
        });
      }
    }
  }

  const byQuestion = [...new Set(findings.map((f) => f.questionNumber))].map((qn) => {
    const mine = findings.filter((f) => f.questionNumber === qn);
    return { questionNumber: qn, count: mine.length, classes: [...new Set(mine.map((f) => f.cls))] };
  });

  return { findings, byQuestion };
}
