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

// ============================================================================
// PUTTING A MISFILED LINE BACK IN FRONT OF THE EXAMINER
// ============================================================================

export type MisfiledBucket = "accept" | "reject" | "guidance";

type MovableQuestion = {
  accept?: { text: string; sourceLine?: string }[];
  reject?: { text: string; sourceLine?: string }[];
  guidance?: { text: string; sourceLine?: string }[];
  requiresRuling?: { text: string; sourceLine: string; requiresRuling?: string[] }[];
};

export type MoveResult =
  | { ok: true; movedFrom: MisfiledBucket }
  | { ok: false; error: string };

/**
 * Move one line out of a bucket nobody reads and into the ruling queue.
 *
 * ============================================================================
 * ⚠ A MOVE, NOT A COPY, AND THAT IS WHAT MAKES DEDUP STRUCTURAL
 * ============================================================================
 * toFixture reads ONLY `requiresRuling`. It never looks at accept[],
 * guidance[] or reject[] — which is why 22 of 23 bucket lines in WCH11/01
 * never reached the emitted fixture at all. So:
 *
 *   - COPYING would leave the sentence in two places in the artefact. Emit
 *     would still see one (it reads one array), so there would be no double
 *     mark — but the audit would report it forever and the next person would
 *     not know which copy was authoritative.
 *   - MOVING leaves exactly one copy, in the only array anything downstream
 *     reads. Dedup is then not a rule anyone has to remember.
 *
 * ⚠ IT MUTATES THE QUESTION IT IS GIVEN. The caller has just read the file and
 * is about to write it back; returning a copy would invite writing the copy
 * and the original.
 */
export function moveLineToRuling(q: MovableQuestion, text: string): MoveResult {
  const target = text.trim();
  if (!target) return { ok: false, error: "No line text given." };

  q.requiresRuling ??= [];
  if (q.requiresRuling.some((l) => l.text.trim() === target)) {
    // ⚠ ALREADY IN THE QUEUE. Not an error worth failing a sweep over, but it
    // must not be added again — that WOULD double it in emit.
    return { ok: false, error: "That line is already waiting for a ruling." };
  }

  for (const bucket of ["accept", "reject", "guidance"] as const) {
    const lines = q[bucket];
    if (!lines) continue;
    const i = lines.findIndex((l) => l.text.trim() === target);
    if (i === -1) continue;

    const [line] = lines.splice(i, 1);
    q.requiresRuling.push({
      ...line,
      text: line.text,
      sourceLine: line.sourceLine ?? line.text,
      // ⚠ IT SAYS WHERE IT CAME FROM. A reviewer meeting this line for the
      // first time should know it was filed away rather than newly found.
      requiresRuling: [
        `was filed under ${bucket} by the extractor and never shown to you — classify it`,
      ],
    });
    return { ok: true, movedFrom: bucket };
  }

  return { ok: false, error: "That line is not in any of this question's buckets." };
}
