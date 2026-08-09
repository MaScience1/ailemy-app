/**
 * The gate every question_region must pass BEFORE it can be written.
 *
 * ============================================================================
 * WHY THIS IS A GATE AND NOT A REVIEW STEP
 * ============================================================================
 * Sixteen regions were extracted, rendered, eyeballed, seeded, re-trimmed,
 * re-widened, re-seeded and presented as ready to approve. Three of them were
 * wrong the whole time, and neither the extractor's own containment assertion
 * nor a visual pass over two pages caught any of them. What did catch them —
 * instantly, from the stored rows alone, with no judgement involved — was
 * asking two questions of the text inside each box.
 *
 * So the two questions are a gate on the WRITE, not a step in a review.
 * Reviewing is fallible and does not scale to 70 more papers; this does not
 * care how tired anyone is.
 *
 * ============================================================================
 * THE TWO INVARIANTS
 * ============================================================================
 *   NO MARKS TALLY. "(Total for Question 1 = 1 mark)" is printed
 *   end-of-question furniture and belongs to the PAPER, not to the question
 *   above it. A region containing it claims the tally is part of the student's
 *   answer space. Q1 shipped that way, while Q2 on the same page did not —
 *   two boxes, one page, opposite conventions, and nothing noticed.
 *
 *   AT MOST ONE MARK ALLOCATION. Edexcel prints exactly one "(N)" per
 *   question. Two inside one box means the box spans two questions. That is
 *   how 22(c) came to contain the whole of 22(d) — its stem, its isotopic
 *   abundances, its "(2)" and an entire mass-spectrum grid.
 *
 * The second is the more valuable rule, because it detects a swallowed
 * neighbour WITHOUT KNOWING THE NEIGHBOUR EXISTS. Every paper is partially
 * seeded — this set is 25 marks of 80 — so the unseeded questions are exactly
 * the ones nothing else can see.
 *
 * ⚠ ENFORCED IN TWO PLACES ON PURPOSE. Here, on the seed write path, so no
 * region reaches the database by any route; and again in
 * scripts/exam-seed/propose-regions.py, so a bad proposal is never even
 * emitted. A hand-drawn box from the admin mapper never passes through the
 * Python, which is why the authoritative copy is this one.
 *
 * Pure: give it the lines of text that fall inside the box and it answers.
 * No PDF, no database, no coordinates.
 */

/** "(Total for Question 20 = 15 marks)", "TOTAL FOR SECTION B", … */
const TALLY = /total\s+for\s+(question|section)|total\s+for\s+paper/i;

/** A whole line that is exactly a tariff: "(2)". Not "(a)", not "(2 marks)". */
const MARK_ALLOCATION = /^\(\s*\d{1,2}\s*\)$/;

export type RegionAuditProblem = {
  questionNumber: string;
  pageNumber: number;
  problem: string;
};

/**
 * @param linesInside every non-empty line of text falling inside the box, in
 *   any order. Whitespace-normalised by the caller or by this function.
 */
export function auditRegion(input: {
  questionNumber: string;
  pageNumber: number;
  linesInside: string[];
}): RegionAuditProblem[] {
  const lines = input.linesInside
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const problems: RegionAuditProblem[] = [];

  const tallies = lines.filter((l) => TALLY.test(l));
  if (tallies.length > 0) {
    problems.push({
      questionNumber: input.questionNumber,
      pageNumber: input.pageNumber,
      problem:
        `region contains end-of-question furniture ${JSON.stringify(tallies[0])} — ` +
        `it runs past the end of this question's answer space`,
    });
  }

  const allocations = lines.filter((l) => MARK_ALLOCATION.test(l));
  if (allocations.length > 1) {
    problems.push({
      questionNumber: input.questionNumber,
      pageNumber: input.pageNumber,
      problem:
        `region contains ${allocations.length} mark allocations ` +
        `${JSON.stringify(allocations)} — a question has one, so this box spans ` +
        `more than this question`,
    });
  }

  return problems;
}

/** One abort message naming every question that failed. */
export function describeAudit(problems: RegionAuditProblem[]): string {
  const byQuestion = new Map<string, string[]>();
  for (const p of problems) {
    const key = `${p.questionNumber} (page ${p.pageNumber})`;
    byQuestion.set(key, [...(byQuestion.get(key) ?? []), p.problem]);
  }
  return [...byQuestion.entries()]
    .map(([q, ps]) => `  ${q}: ${ps.join("; ")}`)
    .join("\n");
}
