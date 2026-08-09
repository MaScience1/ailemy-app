import type { Rotation, ViewportRect } from "./region-geometry";

/**
 * The output contract: fixture source that seed-exam-questions.ts already eats.
 *
 * ============================================================================
 * WHY THE TOOL EMITS A FIXTURE INSTEAD OF WRITING THE ROWS ITSELF
 * ============================================================================
 * The requirement was idempotent, dry-run-first, journal-and-compensate — the
 * same discipline as the seed. The cheapest way to have those properties is
 * not to reimplement them in a browser: it is to emit what the seeder consumes
 * and let the seeder write. Then "same as the seed" is not a resemblance, it
 * is identity.
 *
 * That buys, for free and already tested:
 *   • a dry run that prints the exact plan, built by the SAME payload builders
 *     the writer uses, so the preview cannot drift from the write
 *   • a journal that compensates in reverse on any failure
 *   • the keyless-child rule: question_regions has no unique key, so a re-run
 *     LEAVES EXISTING ROWS ALONE and says so, rather than silently doubling
 *     them. --replace-children opts into delete-then-insert.
 *
 * ⚠ READ THIS BEFORE PASSING --replace-children. The deletion is snapshotted,
 * so a run that FAILS compensates and puts the rows back. A run that SUCCEEDS
 * replaces them — including any a human has APPROVED (approved_by /
 * approved_at set), which come back as fresh unapproved rows. The seeder
 * refuses outright in that case unless --discard-approvals is also passed.
 * Re-mapping is cheap; re-approval is not.
 *
 * ============================================================================
 * WHAT IS DELIBERATELY NOT EMITTED
 * ============================================================================
 * approved_by / approved_at. A region that came out of this tool is a
 * PROPOSAL. 0028's comment is explicit — "approved_at IS NULL means PROPOSED,
 * not accepted" — and the seeder leaves both NULL for the same reason. Human
 * approval is a separate act against a rendered overlay, not a side effect of
 * having dragged a box.
 *
 * Pure: no DOM, no database, no pdf.js. It turns data into a string.
 */

export type RegionDraft = {
  /** Must match a paper_questions.question_number on this paper, exactly. */
  questionNumber: string;
  /** 1-based, matching pdf.js getPage(n) and how humans say "page 10". */
  pageNumber: number;
  /** Viewport points. See region-geometry.ts for the space. */
  rect: ViewportRect;
  /** The page's /Rotate when this box was drawn. An assertion, not a transform. */
  rotationApplied: Rotation;
  /**
   * 0–1, and OMITTED for a hand-drawn box.
   *
   * question-set.ts says "Omit for hand-authored regions; the AI extractor
   * fills it". A human dragging a box is not 0.9 confident, they are simply
   * the author — writing a number here would make a hand-placed region
   * indistinguishable from a machine proposal in the one column that exists to
   * tell them apart.
   */
  confidence?: number;
};

/** Ordering only — the fixture lists questions in the paper's own sequence. */
export type FixtureOrdering = { questionNumber: string; displayOrder: number };

function fmt(n: number): string {
  // Integers print as integers; the rest keep at most two decimals. A fixture
  // is read by a human before it is read by the seeder.
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * One question's `regions:` block, ready to paste into the fixture.
 *
 * Emitted at the indentation the fixture uses for a question's properties (6
 * spaces), because the point is to paste it in without reformatting.
 */
export function emitRegionsBlock(drafts: RegionDraft[]): string {
  if (drafts.length === 0) return "";
  const lines = drafts.map((d) => {
    const parts = [
      `pageNumber: ${d.pageNumber}`,
      `x: ${fmt(d.rect.x)}`,
      `y: ${fmt(d.rect.y)}`,
      `width: ${fmt(d.rect.width)}`,
      `height: ${fmt(d.rect.height)}`,
    ];
    // rotationApplied defaults to 0 in both the fixture type and the DB, so
    // emitting it only when non-zero keeps the common case uncluttered while
    // making a rotated page impossible to miss in review.
    if (d.rotationApplied !== 0) parts.push(`rotationApplied: ${d.rotationApplied}`);
    if (typeof d.confidence === "number") parts.push(`confidence: ${fmt(d.confidence)}`);
    return `        { ${parts.join(", ")} },`;
  });
  return `      regions: [\n${lines.join("\n")}\n      ],`;
}

/**
 * The whole emission: every mapped question, in the paper's own order.
 *
 * Questions with no box are listed in the trailing comment rather than
 * omitted silently — "which ones did I miss" is the question this file is
 * asked most, and an absent entry looks identical to a forgotten one.
 */
export function emitRegionFixture(input: {
  paperSlug: string;
  drafts: RegionDraft[];
  ordering: FixtureOrdering[];
  /** ISO 8601. Passed in rather than read from a clock, so this stays pure. */
  capturedAt: string;
}): string {
  const orderOf = new Map(input.ordering.map((o) => [o.questionNumber, o.displayOrder]));
  const byQuestion = new Map<string, RegionDraft[]>();
  for (const d of input.drafts) {
    const list = byQuestion.get(d.questionNumber) ?? [];
    list.push(d);
    byQuestion.set(d.questionNumber, list);
  }

  const mapped = [...byQuestion.keys()].sort(
    (a, b) => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0),
  );
  const unmapped = input.ordering
    .filter((o) => !byQuestion.has(o.questionNumber))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((o) => o.questionNumber);

  const blocks = mapped.map((qn) => {
    const drafts = (byQuestion.get(qn) ?? []).sort(
      (a, b) => a.pageNumber - b.pageNumber || a.rect.y - b.rect.y,
    );
    return `    // ${qn}\n${emitRegionsBlock(drafts)}`;
  });

  const header = [
    `// question_regions for ${input.paperSlug}, captured ${input.capturedAt}`,
    `// by the admin region mapper.`,
    `//`,
    `// COORDINATES: pdf.js getViewport({ scale: 1 }) space — top-left origin,`,
    `// y DOWNWARD, /Rotate already applied. Not raw PDF user space.`,
    `//`,
    `// Paste each block into the matching question in the fixture, then:`,
    `//   node scripts/seed-exam-questions.ts --set=${input.paperSlug}`,
    `//   node scripts/seed-exam-questions.ts --set=${input.paperSlug} --commit`,
    `//`,
    `// ⚠ A question that ALREADY has regions is left untouched on a re-run and`,
    `// reported as skipped. --replace-children overwrites; a successful run`,
    `// replaces human approvals with fresh unapproved rows, so the seeder`,
    `// refuses unless --discard-approvals is passed too.`,
    `//`,
    `// ${mapped.length} of ${input.ordering.length} questions mapped.`,
  ];
  if (unmapped.length > 0) {
    header.push(`// NOT MAPPED (${unmapped.length}): ${unmapped.join(", ")}`);
  }

  return `${header.join("\n")}\n\n${blocks.join("\n\n")}\n`;
}

/**
 * The same data as JSON, for a machine.
 *
 * The TypeScript emission is for pasting into the fixture by hand; this is for
 * anything that wants to diff two mapping sessions or feed a script. Same
 * numbers, same space, no formatting opinions.
 */
export function emitRegionJson(input: {
  paperSlug: string;
  drafts: RegionDraft[];
  capturedAt: string;
}): string {
  return JSON.stringify(
    {
      paperSlug: input.paperSlug,
      capturedAt: input.capturedAt,
      coordinateSpace: "pdfjs-getViewport-scale-1-top-left-y-down",
      regions: input.drafts.map((d) => ({
        questionNumber: d.questionNumber,
        pageNumber: d.pageNumber,
        x: d.rect.x,
        y: d.rect.y,
        width: d.rect.width,
        height: d.rect.height,
        rotationApplied: d.rotationApplied,
        ...(typeof d.confidence === "number" ? { confidence: d.confidence } : {}),
      })),
    },
    null,
    2,
  );
}
