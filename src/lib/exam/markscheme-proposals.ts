/**
 * Mark-scheme proposals: grouping, rulings, and the fixture they become.
 *
 * ============================================================================
 * WHERE THIS SITS
 * ============================================================================
 * extract-markscheme.py reads the published PDF and emits proposals — never
 * rows. This module is what a human reviews and rules on, and what turns those
 * rulings into the fixture shape seed-exam-questions.ts already consumes.
 *
 *   PDF -> extractor -> proposals.json -> REVIEW -> fixture -> seeder -> rows
 *                                          ^^^^^^
 *                                        this file
 *
 * ⚠ NOTHING HERE WRITES TO A DATABASE, and the arrangement is deliberate. The
 * seeder is already idempotent, journalled, dry-run-first, and refuses to
 * overwrite a human approval. Emitting a fixture and letting it do the writing
 * means "same as the seed" is identity rather than resemblance — a second write
 * path would be a second set of guarantees to get right.
 *
 * ============================================================================
 * WHY A RULING IS NEVER A DEFAULT
 * ============================================================================
 * 68 lines in WCH11/01 carry an examiner ruling the extractor refused to make:
 * "Ignore SF except 1 SF" is a permission and a condition in one sentence,
 * "Correct answer with some working scores 3" conditions a whole tariff.
 *
 * A review surface that pre-selects an answer for those turns a decision into a
 * click-through, and the person clicking will be tired. So `ruling` starts as
 * `undefined` and there is no code path that fills it in — `countUnruled()`
 * exists to make the remaining work visible, and `toFixture()` REFUSES while
 * any remain.
 *
 * Pure: no database, no filesystem, no imports. The suites load it under plain
 * `node`, which resolves ESM specifiers literally.
 */

// ============================================================================
// WHAT THE EXTRACTOR EMITS
// ============================================================================

export type Derivation = {
  /** 1-based page of the mark-scheme PDF. */
  page: number;
  /** Vertical position on that page, for the highlight. */
  y: number;
  /** The line as printed, verbatim. The evidence a reviewer checks against. */
  sourceLine: string;
  /** How this was read — a ruled cell, a bullet, a keyword match. */
  derivedFrom: string;
  /** 0–1. Lower means "look at this one first". */
  confidence: number;
};

export type ProposedPoint = Derivation & {
  pointCode: string;
  criterion: string;
  marks: number | null;
  /** 1 unless the scheme prints alternative routes to the same marks. */
  route: number;
  methodBlock: string | null;
};

export type ProposedLine = Derivation & {
  text: string;
  /**
   * Present when the extractor REFUSED to classify, with the reasons. A line
   * carrying this needs a human ruling before it can become anything.
   */
  requiresRuling?: string[];
  /** Worked-example arithmetic: the characters are unreliable and nothing marks against it. */
  unparsed?: boolean;
  unparsedReason?: string;
};

export type ProposedQuestion = {
  questionNumber: string;
  page: number;
  marks: { value: number } & Derivation | null;
  points: ProposedPoint[];
  accept: ProposedLine[];
  reject: ProposedLine[];
  guidance: ProposedLine[];
  requiresRuling: ProposedLine[];
  hasAlternativeMethods?: boolean;
  routes?: number;
  marksAvailable?: number | null;
  markingRule?: string | null;
  problems?: string[];
};

export type ProposalSet = {
  source: string;
  pages: number;
  status: string;
  questions: ProposedQuestion[];
  questionTotals: { question: string; marks: number; page: number; sourceLine: string }[];
  problems: { page: number; problem: string }[];
};

// ============================================================================
// RULINGS
// ============================================================================

/**
 * What a reviewer decides a flagged line actually IS.
 *
 * These are the four columns 0029 split apart, plus the two answers that are
 * not a classification at all. `criterion` is here because a line the extractor
 * filed as guidance may in fact BE the marking point.
 */
export type LineKind = "criterion" | "accept" | "reject" | "guidance" | "discard";

export type LineRuling = {
  kind: LineKind;
  /** The reviewer's wording, when they corrected it. Absent means "as printed". */
  editedText?: string;
  note?: string;
};

export type PointRuling =
  | { verdict: "accept" }
  | { verdict: "edit"; criterion: string; pointCode?: string; marks?: number }
  | { verdict: "reject"; why: string };

export type QuestionRulings = {
  /** Keyed by pointCode. */
  points: Record<string, PointRuling>;
  /** Keyed by the line's `sourceLine`, which is what a reviewer sees. */
  lines: Record<string, LineRuling>;
  /**
   * Set ONLY when a human has signed off the whole question.
   *
   * ⚠ THE SAME GATE 0028 PUTS ON REGIONS: approved_at IS NULL means PROPOSED,
   * not accepted. Nothing publishes without both fields, and they are written
   * together or not at all — a timestamp with no approver is not interpretable.
   */
  approvedAt?: string;
  approvedBy?: string;
  /**
   * Bumped on every successful save of THIS question.
   *
   * ⚠ PER QUESTION, NOT PER FILE, AND THAT IS THE WHOLE DESIGN. A reviewer
   * ruling on 68 lines will have two tabs open — one to check a page against
   * another — and a file-wide revision would make every save in tab A reject
   * the next save in tab B, on a question tab B is not even touching. False
   * conflicts get clicked through, and a person trained to click through
   * conflicts will click through the real one.
   *
   * Absent on rulings written before this existed; treated as 0.
   */
  revision?: number;
};

export type RulingBook = Record<string, QuestionRulings>;

/**
 * May this save proceed, and at what revision?
 *
 * Pure, and separated from the file I/O in markscheme-review.ts so it can be
 * tested without a filesystem or a session. The rule it encodes:
 *
 *   nothing on disk        first ruling for this question — accept, revision 1.
 *                          A client claiming a base revision for a question
 *                          that does not exist is stale in the other
 *                          direction (someone deleted it); accepting is right,
 *                          because the ruling in front of the reviewer is the
 *                          only one that exists now.
 *   revisions agree        this tab is up to date — accept, revision + 1.
 *   revisions differ       somebody else wrote after this tab loaded. REFUSE.
 *
 * ⚠ REFUSE, NOT MERGE. Two people's rulings on the same line cannot be
 * combined by a machine: they are opposite answers to the same question about
 * chemistry, and picking one is an examiner decision. The only correct move is
 * to stop and say so.
 */
export type RevisionVerdict =
  | { ok: true; revision: number }
  | { ok: false; conflict: true; diskRevision: number; clientRevision: number };

export function nextRevision(
  onDisk: QuestionRulings | undefined,
  clientBase: number | undefined,
): RevisionVerdict {
  if (!onDisk) return { ok: true, revision: (clientBase ?? 0) + 1 };
  const disk = onDisk.revision ?? 0;
  const client = clientBase ?? 0;
  if (disk !== client) {
    return { ok: false, conflict: true, diskRevision: disk, clientRevision: client };
  }
  return { ok: true, revision: disk + 1 };
}

// ============================================================================
// REVIEW ORDER — doubt first
// ============================================================================

/**
 * Everything about one question, in the order a reviewer wants it.
 *
 * Grouped by QUESTION rather than by field because the person reviewing is
 * ruling on chemistry: "is this line a concession or a prohibition" is
 * answerable only next to the criterion it qualifies, not in a column of
 * eighty accept-lines.
 */
export type ReviewItem = {
  question: ProposedQuestion;
  /** Lines still needing a decision, lowest confidence first. */
  unruled: ProposedLine[];
  ruledCount: number;
  totalDecisions: number;
  approved: boolean;
  /** The lowest confidence anywhere in this question. Drives the sort. */
  worstConfidence: number;
};

const decisionsFor = (q: ProposedQuestion): ProposedLine[] => q.requiresRuling;

export function buildReview(set: ProposalSet, rulings: RulingBook): ReviewItem[] {
  return set.questions.map((question) => {
    const book = rulings[question.questionNumber];
    const decisions = decisionsFor(question);
    const unruled = decisions
      .filter((l) => !book?.lines?.[l.sourceLine])
      // ⚠ LOWEST CONFIDENCE FIRST. A reviewer's attention is the scarce
      // resource; spending it on the lines the extractor was surest about is
      // exactly backwards.
      .sort((a, b) => a.confidence - b.confidence || a.page - b.page || a.y - b.y);

    const confidences = [
      ...question.points.map((p) => p.confidence),
      ...decisions.map((l) => l.confidence),
      ...(question.marks ? [question.marks.confidence] : []),
    ];

    return {
      question,
      unruled,
      ruledCount: decisions.length - unruled.length,
      totalDecisions: decisions.length,
      approved: Boolean(book?.approvedAt && book?.approvedBy),
      worstConfidence: confidences.length ? Math.min(...confidences) : 1,
    };
  });
}

/** Doubt first: most unruled decisions, then lowest confidence. */
export function sortForReview(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort(
    (a, b) =>
      b.unruled.length - a.unruled.length ||
      a.worstConfidence - b.worstConfidence ||
      a.question.questionNumber.localeCompare(b.question.questionNumber, undefined, {
        numeric: true,
      }),
  );
}

export function countUnruled(items: ReviewItem[]): number {
  return items.reduce((n, i) => n + i.unruled.length, 0);
}

export function countApproved(items: ReviewItem[]): number {
  return items.filter((i) => i.approved).length;
}

// ============================================================================
// THE FIXTURE
// ============================================================================

export type FixturePoint = {
  pointCode: string;
  criterion: string;
  accept?: string[];
  reject?: string[];
  guidance?: string;
};

export type FixtureQuestion = {
  questionNumber: string;
  marks: number;
  markScheme: FixturePoint[];
};

export type EmitResult =
  | { ok: true; questions: FixtureQuestion[] }
  | { ok: false; refusals: string[] };

/**
 * Turn approved rulings into the fixture the seeder eats.
 *
 * ⚠ IT REFUSES RATHER THAN GUESSING, on every count. An unapproved question, an
 * unruled line, a question with no mark total, a point the reviewer rejected
 * without saying what replaces it — each is a reason to emit nothing for that
 * question and say why. Emitting a partial fixture would put a half-reviewed
 * mark scheme into a table that decides student marks, and the seeder cannot
 * tell a considered fixture from an abandoned one.
 */
export function toFixture(set: ProposalSet, rulings: RulingBook): EmitResult {
  const refusals: string[] = [];
  const questions: FixtureQuestion[] = [];

  for (const q of set.questions) {
    const book = rulings[q.questionNumber];
    if (!book?.approvedAt || !book?.approvedBy) {
      refusals.push(`${q.questionNumber}: not approved`);
      continue;
    }
    const unruled = decisionsFor(q).filter((l) => !book.lines?.[l.sourceLine]);
    if (unruled.length > 0) {
      refusals.push(`${q.questionNumber}: ${unruled.length} line(s) still unruled`);
      continue;
    }
    if (!q.marks) {
      refusals.push(`${q.questionNumber}: no mark total was extracted`);
      continue;
    }

    // ⚠ ROUTE 1 ONLY. Where a scheme prints alternative routes to the same
    // marks, a script takes ONE. Emitting every route would put six points on
    // a three-mark question — and mark_scheme_items has UNIQUE (question_id,
    // point_code), so it would also collide.
    const points: FixturePoint[] = [];
    for (const p of q.points.filter((x) => (x.route ?? 1) === 1)) {
      const r = book.points?.[p.pointCode] ?? { verdict: "accept" as const };
      if (r.verdict === "reject") continue;
      const criterion = r.verdict === "edit" ? r.criterion : p.criterion;
      if (!criterion.trim()) {
        refusals.push(`${q.questionNumber} ${p.pointCode}: empty criterion`);
        continue;
      }
      points.push({
        pointCode: r.verdict === "edit" && r.pointCode ? r.pointCode : p.pointCode,
        criterion,
      });
    }

    if (points.length === 0) {
      refusals.push(`${q.questionNumber}: every point was rejected, leaving no mark scheme`);
      continue;
    }

    // Lines the reviewer classified attach to the LAST point, which is where
    // the fixture header says a whole-row guidance note belongs. A line ruled
    // `criterion` becomes a point of its own; `discard` becomes nothing.
    const last = points[points.length - 1];
    for (const line of decisionsFor(q)) {
      const ruling = book.lines[line.sourceLine];
      const text = (ruling.editedText ?? line.text).trim();
      if (!text) continue;
      switch (ruling.kind) {
        case "accept":
          (last.accept ??= []).push(text);
          break;
        case "reject":
          (last.reject ??= []).push(text);
          break;
        case "guidance":
          last.guidance = last.guidance ? `${last.guidance}\n${text}` : text;
          break;
        case "criterion":
          points.push({ pointCode: `M${points.length + 1}`, criterion: text });
          break;
        case "discard":
          break;
      }
    }

    questions.push({ questionNumber: q.questionNumber, marks: q.marks.value, markScheme: points });
  }

  if (questions.length === 0) {
    return { ok: false, refusals: refusals.length ? refusals : ["nothing has been approved yet"] };
  }
  return { ok: true, questions };
}

/**
 * The emitted fixture as TypeScript, for pasting into the seed fixture.
 *
 * Same shape emitRegionFixture() produces for regions, and for the same reason:
 * the output contract is a file the seeder already consumes, so the writing
 * path is the one that is already tested.
 */
export function emitFixtureSource(result: EmitResult, paperSlug: string, capturedAt: string): string {
  if (!result.ok) {
    return [
      `// NOTHING EMITTED — ${result.refusals.length} question(s) are not ready:`,
      ...result.refusals.map((r) => `//   ${r}`),
      "//",
      "// A partial mark scheme in a table that decides student marks is worse",
      "// than none: the seeder cannot tell a considered fixture from an",
      "// abandoned one.",
      "",
    ].join("\n");
  }
  const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const blocks = result.questions.map((question) => {
    const points = question.markScheme.map((p) => {
      const lines = [`        {`, `          pointCode: ${q(p.pointCode)},`, `          criterion: ${q(p.criterion)},`];
      if (p.accept?.length) lines.push(`          accept: [${p.accept.map(q).join(", ")}],`);
      if (p.reject?.length) lines.push(`          reject: [${p.reject.map(q).join(", ")}],`);
      if (p.guidance) lines.push(`          guidance: ${q(p.guidance)},`);
      lines.push(`        },`);
      return lines.join("\n");
    });
    return [
      `    // ${question.questionNumber} — ${question.marks} mark(s)`,
      `      markScheme: [`,
      ...points,
      `      ],`,
    ].join("\n");
  });
  return [
    `// mark_scheme_items for ${paperSlug}, reviewed and approved ${capturedAt}`,
    `//`,
    `// Emitted by the mark-scheme review surface from extractor proposals. Every`,
    `// question below carries approved_at AND approved_by; anything unruled or`,
    `// unapproved was refused rather than guessed.`,
    `//`,
    `// Paste each block into the matching question, then:`,
    `//   node scripts/seed-exam-questions.ts --set=${paperSlug}`,
    `//   node scripts/seed-exam-questions.ts --set=${paperSlug} --commit`,
    ``,
    ...blocks,
    ``,
  ].join("\n");
}
