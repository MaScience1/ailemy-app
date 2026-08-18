/**
 * The extractor, measured against the five questions transcribed BY HAND.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/markscheme-verified.test.ts
 *
 * ============================================================================
 * THE QUESTION THIS ANSWERS
 * ============================================================================
 * 68 lines on WCH11/01 are flagged `requiresRuling`, and every one of them is
 * presented to a human as a decision. But five of those questions were
 * transcribed by hand before the extractor existed, so for those the answer is
 * ALREADY KNOWN. Comparing the two says how many of the 68 are genuinely an
 * examiner's to decide, and how many are the extractor being over-cautious —
 * flagging a line whose reading was never actually in doubt.
 *
 * Both numbers matter and they pull opposite ways:
 *
 *   over-cautious   costs the reviewer time, 68 decisions where 40 were real.
 *                   Cheap, recoverable, and the SAFE direction to be wrong in.
 *   under-cautious  files an examiner ruling by guess. "Do not accept C12H26(g)"
 *                   read as a concession is the exact failure that shipped
 *                   once. Not recoverable — it arrives wearing the authority
 *                   of the printed scheme.
 *
 * ⚠ SO THIS SUITE NEVER ASSERTS THE FLAG COUNT SHOULD FALL. It measures. A
 * change that "fixed" over-caution by classifying more lines automatically
 * would be the dangerous direction, and the assertion below that would fail
 * first is the one about lines the fixture proves are inverting.
 *
 * ============================================================================
 * ⚠ EVERYTHING IS DERIVED FROM THE TWO SOURCES, NOTHING TYPED OUT
 * ============================================================================
 * Per AGENTS.md: a model of production data must be re-derived, never copied.
 * The expected values here come from the FIXTURE (the hand transcription) and
 * the PROPOSAL SET (the extractor's output), both read at run time. Nothing
 * below hardcodes a criterion, a tariff or a count.
 */
import { readFileSync } from "node:fs";
import { WCH11_01_2025_MAY_JUNE } from "../wch11-01-2025-may-june.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const SET = JSON.parse(
  readFileSync("scripts/exam-seed/proposals/unit-1-may-june-2025.markscheme.json", "utf8"),
);

// The five, taken from the fixture rather than named here — if the fixture
// gains a sixth hand-transcribed question this widens on its own.
const HAND = WCH11_01_2025_MAY_JUNE.questions.filter(
  (q: { markScheme?: unknown[] }) => Array.isArray(q.markScheme) && q.markScheme.length > 0,
);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

console.log("── THE FIVE ARE ACTUALLY IN BOTH SOURCES ──");
{
  t("the fixture carries hand-written mark schemes", HAND.length >= 5, HAND.length);
  const missing = HAND.filter(
    (q: { questionNumber: string }) =>
      !SET.questions.some((p: { questionNumber: string }) => p.questionNumber === q.questionNumber),
  ).map((q: { questionNumber: string }) => q.questionNumber);
  t("the extractor proposed a block for every hand-transcribed question",
    missing.length === 0, missing);
}

console.log("\n── TARIFFS: THE EXTRACTOR MUST AGREE WITH THE TRANSCRIPTION ──");
{
  // ⚠ THE ONE FIELD WHERE DISAGREEMENT IS UNAMBIGUOUSLY A BUG. A criterion can
  // be worded two ways and both be right; a tariff is a number on the page.
  const wrong: unknown[] = [];
  for (const q of HAND as { questionNumber: string; marks: number }[]) {
    const p = SET.questions.find((x: { questionNumber: string }) => x.questionNumber === q.questionNumber);
    if (!p?.marks) continue;
    if (p.marks.value !== q.marks) {
      wrong.push({ q: q.questionNumber, fixture: q.marks, extracted: p.marks.value });
    }
  }
  t("every extracted tariff matches the hand transcription", wrong.length === 0, wrong);
}

console.log("\n── HOW MANY FLAGS WERE REALLY NECESSARY ──");
{
  // A flagged line on a hand-transcribed question is OVER-CAUTIOUS when the
  // fixture already records that exact text under accept/reject/guidance —
  // the reading was settled, and the extractor asked anyway.
  const settledText = new Set<string>();
  for (const q of HAND as { markScheme: { accept?: string[]; reject?: string[]; guidance?: string }[] }[]) {
    for (const m of q.markScheme) {
      for (const a of m.accept ?? []) settledText.add(norm(a));
      for (const r of m.reject ?? []) settledText.add(norm(r));
      if (m.guidance) for (const g of m.guidance.split("\n")) settledText.add(norm(g));
    }
  }

  // ⚠ THE DIRECTION OF THIS TEST IS EASY TO GET BACKWARDS, so it is written
  // out. A flagged line whose text the reviewer ALSO recorded in the fixture is
  // a line the reviewer made a judgement about — they decided it was an accept
  // rather than a reject, or prose worth keeping as guidance. The extractor was
  // RIGHT to ask. That is a warranted flag, not an over-cautious one.
  //
  // A flagged line with no counterpart in the fixture is the ambiguous case,
  // and the data cannot resolve it: the reviewer may have looked at it and
  // decided it carried nothing worth storing (so the flag cost them a moment),
  // or may simply never have reached it. Both are reported as "unmatched"
  // rather than guessed at.
  let warranted = 0, unmatched = 0;
  const unmatchedLines: string[] = [];
  for (const q of HAND as { questionNumber: string }[]) {
    const p = SET.questions.find((x: { questionNumber: string }) => x.questionNumber === q.questionNumber);
    for (const l of (p?.requiresRuling ?? []) as { sourceLine: string }[]) {
      if (settledText.has(norm(l.sourceLine))) warranted++;
      else { unmatched++; unmatchedLines.push(`${q.questionNumber}: ${l.sourceLine}`); }
    }
  }

  const flaggedOnHand = warranted + unmatched;
  const totalFlagged = SET.questions.reduce(
    (n: number, q: { requiresRuling: unknown[] }) => n + q.requiresRuling.length, 0);

  console.log(`\n    on the five hand-transcribed questions: ${flaggedOnHand} flagged line(s)`);
  console.log(`      the reviewer DID rule on (warranted)  : ${warranted}`);
  console.log(`      no counterpart in the transcription   : ${unmatched}  (cannot tell over-caution`);
  console.log(`                                                 from never-reached — see comment)`);
  console.log(`    across the whole paper                 : ${totalFlagged} flagged line(s)`);
  if (unmatchedLines.length) {
    console.log(`\n    the unmatched ones:`);
    for (const g of unmatchedLines) console.log(`      · ${g}`);
  }

  // ⚠ THE MEASURE THAT MATTERS: the flags on these five were overwhelmingly
  // lines a human genuinely ruled on. If that ratio ever inverts, the extractor
  // has started flagging noise and the 68 stop being worth a reviewer's day.
  t("most flags on the verified five are lines the reviewer actually ruled on",
    warranted > unmatched, { warranted, unmatched });

  t("the five questions do carry flagged lines to measure", flaggedOnHand > 0, flaggedOnHand);
  // ⚠ NOT A LITERAL 68. Restoring a misfiled line moves it into the queue, so
  // this number GROWS as the sweep proceeds — it was 68 when the extractor
  // finished and is larger now. What must stay true is that it never shrinks:
  // a flagged line disappearing would mean the tool stopped asking about
  // something it had already decided was a human's call.
  t("the paper-wide flag count is at least the 68 the extractor produced",
    totalFlagged >= 68, totalFlagged);
}

console.log("\n── THE FLAGS THAT MUST NEVER BE AUTOMATED AWAY ──");
{
  // ⚠ THIS IS THE GUARD THAT SHOULD FAIL IF SOMEONE MAKES THE EXTRACTOR
  // "SMARTER". Any flagged line carrying an inverting construction is an
  // examiner ruling by definition — the polarity trap that awarded full marks
  // for the exact error the examiner's report named. It must stay a flag.
  const INVERTING = /\b(do not|don't|unless|except|only if|provided|but not|but no|reject)\b/i;
  const all = SET.questions.flatMap((q: { questionNumber: string; requiresRuling: { sourceLine: string }[] }) =>
    q.requiresRuling.map((l) => ({ qn: q.questionNumber, line: l.sourceLine })));
  const inverting = all.filter((x: { line: string }) => INVERTING.test(x.line));

  t("inverting lines exist in this paper at all (anti-vacuity)", inverting.length > 0, inverting.length);
  console.log(`    ${inverting.length} of ${all.length} flagged lines carry an inverting construction`);

  // Every one of them must be in requiresRuling — which is what `all` is — and
  // must NOT have been filed under accept.
  const leaked: unknown[] = [];
  for (const q of SET.questions as { questionNumber: string; accept: { sourceLine: string }[] }[]) {
    for (const a of q.accept ?? []) {
      if (INVERTING.test(a.sourceLine)) leaked.push({ q: q.questionNumber, line: a.sourceLine });
    }
  }
  t("NO inverting line was filed under accept[] — the polarity trap stays shut",
    leaked.length === 0, leaked);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
