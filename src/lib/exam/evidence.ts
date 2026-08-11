/**
 * What a student is allowed to read back from an AI-marked question.
 *
 * ============================================================================
 * PURE, AND SEPARATE FROM marking.ts ON PURPOSE
 * ============================================================================
 * marking.ts is `server-only` and alias-imports the Supabase admin client, so
 * node cannot load it in a test and neither can the mobile app. This rule is
 * the one part of Tier 2 that must be verifiable without a database, a key or
 * a network — it is the boundary that decides whether the examiner's mark
 * scheme reaches a candidate — so it lives where it can be executed directly.
 *
 * No imports. Callers supply the strings.
 */

/** Shown instead of the model's sentence when that sentence cannot be trusted. */
const EVIDENCE_WITHHELD =
  "This point wasn't awarded. The detail is being kept for your teacher's review.";
const EVIDENCE_UNGROUNDED =
  "Marked from your answer. The wording of this note is under review.";

const squashWords = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

/**
 * Every run of `n` consecutive words in a string. Used to ask whether one text
 * verbatim-quotes another, which is what an exfiltrated criterion looks like.
 */
function shingles(s: string, n: number): Set<string> {
  const w = squashWords(s);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

const SHINGLE = 6;

/**
 * The model's sentence, or a fixed one, decided in CODE rather than by asking.
 *
 * Three rules, in order:
 *
 *   1. A NOT-AWARDED point never carries the model's words. When the answer
 *      does not contain the point there are no student words to quote, so the
 *      only material the model holds for that sentence is the mark scheme.
 *      This mirrors METHOD_NOT_SHOWN exactly, and for the same reason.
 *   2. An awarded point's sentence must not verbatim-quote the mark scheme.
 *      Six consecutive words shared with any criterion, guidance, accept or
 *      reject line is not a coincidence in a two-sentence note.
 *   3. Anything the sentence puts in quotation marks must actually appear in
 *      the student's own answer. That is what "quote the student" means, and
 *      it is the form an injected payload takes when it is asked to echo the
 *      scheme back inside quotes.
 *
 * ⚠ IT FAILS CLOSED. Anything that does not pass becomes a fixed sentence, so
 * a novel phrasing costs a slightly duller note, never a disclosed mark
 * scheme. The award itself is untouched — this decides what is DISPLAYED, not
 * what was earned.
 */
export function groundedEvidence(input: {
  evidence: string;
  awarded: boolean;
  studentAnswer: string;
  schemeText: string[];
}): string {
  if (!input.awarded) return EVIDENCE_WITHHELD;

  const evidence = (input.evidence ?? "").trim();
  if (!evidence) return EVIDENCE_UNGROUNDED;

  const evidenceShingles = shingles(evidence, SHINGLE);
  for (const scheme of input.schemeText) {
    for (const run of shingles(scheme, SHINGLE)) {
      if (evidenceShingles.has(run)) return EVIDENCE_UNGROUNDED;
    }
  }

  const answer = squashWords(input.studentAnswer).join(" ");
  for (const m of evidence.matchAll(/["“”'']([^"“”'']{3,})["“”'']/g)) {
    const quoted = squashWords(m[1]).join(" ");
    if (quoted && !answer.includes(quoted)) return EVIDENCE_UNGROUNDED;
  }

  return evidence;
}
