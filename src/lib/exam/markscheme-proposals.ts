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
 * Pure: no database, no filesystem. The suites load it under plain `node`,
 * which resolves ESM specifiers LITERALLY — so the one import here carries its
 * `.ts` extension, and any import added later must too. An extensionless
 * specifier typechecks, bundles, and then fails at runtime with
 * ERR_MODULE_NOT_FOUND in every suite that loads this file. (A `import type`
 * is erased before node sees it and is exempt, which is why ./attempts is
 * imported bare elsewhere.)
 */

// ============================================================================
// WHAT THE EXTRACTOR EMITS
// ============================================================================

import { isValidOption, type DistractorFeedback } from "./distractor.ts";

export type { DistractorFeedback };

/**
 * ⚠ A COMPILE ERROR, NOT A RUNTIME ONE, IS THE POINT.
 *
 * Called from the `default` arm of a switch over a closed union. While every
 * member is handled the argument narrows to `never` and this never runs; the
 * moment a member is added and left unhandled, `tsc` rejects the call site.
 * The throw is only there for data that reached us from JSON, which the type
 * system cannot vouch for.
 */
function assertNever(value: never, context: string): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
}

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
export type LineKind =
  | "criterion"
  | "accept"
  | "reject"
  | "guidance"
  | "distractor_feedback"
  | "discard";

export type LineRuling = {
  kind: LineKind;
  /** The reviewer's wording, when they corrected it. Absent means "as printed". */
  editedText?: string;
  note?: string;
  /**
   * The MCQ option a `distractor_feedback` line explains — "A", "C", "D".
   *
   * ⚠ REQUIRED FOR THAT KIND AND MEANINGLESS FOR EVERY OTHER. It is optional
   * in the type because the other five kinds do not have one; toFixture
   * REFUSES a distractor_feedback ruling that arrives without it rather than
   * filing the explanation under no option, where nothing could ever retrieve
   * it. Detection lives in distractor.ts and never guesses — an undetectable
   * line is answered by the reviewer, not by a default.
   */
  option?: string;
  /**
   * How this ruling came to be made.
   *
   * ⚠ IT RECORDS THE ROUTE, NOT THE AUTHORITY. Every value here describes a
   * ruling a human confirmed in the browser: "batch" means they reviewed a
   * screen of precedent matches and pressed confirm, not that a machine ruled
   * on their behalf. Absent means the ruling predates this field, or was made
   * one card at a time.
   *
   * The precedentId is kept so that a rule later found to be wrong can be
   * traced to every line it touched — which is the only way to correct it
   * without re-reading the paper.
   */
  provenance?: { method: "manual" | "batch"; precedentId?: string };
};

export type PointRuling = (
  | { verdict: "accept" }
  | { verdict: "edit"; criterion: string; pointCode?: string; marks?: number }
  | { verdict: "reject"; why: string }
) & {
  /**
   * How this point came to be ruled.
   *
   * ⚠ "exact-match" MEANS THE FOUNDER CONFIRMED A SCREEN OF THEM, not that a
   * machine verified anything on its own. It is recorded so an auto-verified
   * card can be told apart at a glance, revoked in one click, and sampled into
   * the spot-check queue — none of which is possible if the route is forgotten
   * the moment the ruling is written.
   */
  provenance?: { method: "manual" | "exact-match" };
};

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

/**
 * Is this line's ruling COMPLETE — a decision nothing downstream will reject?
 *
 * ⚠ ONE PREDICATE, THREE CALLERS, DELIBERATELY. "Remaining rulings" is
 * computed in buildReview (the navigator's count), in the review panel (the
 * Approve gate) and in toFixture (the emit refusal). If they disagree, the
 * screen says a question is finished and emit says it is not — and the
 * reviewer discovers the gap after they have moved on.
 *
 * A `distractor_feedback` ruling is incomplete without its option: the
 * explanation would be filed under no option, where no student selection could
 * ever retrieve it. Every other kind is complete as soon as it is chosen.
 */
/**
 * Has every proposed marking point been ruled on EXPLICITLY?
 *
 * ⚠ THE DEFAULT IN toFixture IS A SILENT ACCEPT — `book.points?.[code] ??
 * { verdict: "accept" }` — so a question can be approved with the white card
 * never touched, and the mark scheme still emits. That is a deliberate
 * convenience and it is not being changed here. But it means "approved" alone
 * does not distinguish "I read every criterion against the page" from "I ruled
 * the yellow lines and pressed Approve", and those are different claims.
 *
 * This is the second one. Display only: nothing downstream reads it, and Emit
 * gating is untouched.
 */
export function pointsFullyRuled(
  question: ProposedQuestion,
  book: QuestionRulings | undefined,
): boolean {
  if (!book) return false;
  const ruled = book.points ?? {};
  // ⚠ A QUESTION WITH NO POINTS HAS NOT BEEN VERIFIED, IT HAS BEEN SKIPPED.
  // `every` over an empty array is true, which would stamp the badge on
  // exactly the questions where there was nothing to check.
  if (question.points.length === 0) return false;
  return question.points.every((p) => {
    const r = ruled[p.pointCode];
    if (!r) return false;
    // ⚠ "ACCEPT AS-IS" ON A BLANK CARD ACCEPTS THE EMPTY STRING, AND THAT IS
    // HOW 23(a)(iii) WAS LOST. Its answer cell is a drawing, so both marking
    // points came through with no text; both were accepted as-is; the question
    // showed as fully ruled, was approved, and toFixture then refused it for
    // "empty criterion" — silently, because 47 others emitted. Accepting
    // nothing is not a ruling. Only an EDIT, which supplies the words, can
    // resolve a point the extractor could not read.
    if (r.verdict === "accept" && !p.criterion.trim()) return false;
    if (r.verdict === "edit" && !r.criterion.trim()) return false;
    return true;
  });
}

export function isResolved(ruling: LineRuling | undefined): boolean {
  if (!ruling) return false;
  if (ruling.kind === "distractor_feedback") return isValidOption(ruling.option);
  return true;
}

export function buildReview(set: ProposalSet, rulings: RulingBook): ReviewItem[] {
  return set.questions.map((question) => {
    const book = rulings[question.questionNumber];
    const decisions = decisionsFor(question);
    const unruled = decisions
      .filter((l) => !isResolved(book?.lines?.[l.sourceLine]))
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
  /**
   * Why a student who picked each WRONG option was wrong.
   *
   * ⚠ DELIBERATELY OUTSIDE markScheme, AND THAT IS THE ARCHITECTURE. Marking
   * reads `markScheme` — criteria, accept, reject, guidance. Nothing in this
   * array is reachable from there, so a distractor explanation cannot award,
   * withhold or alter a mark however the marking layer changes later. It is
   * feedback, and it is kept where feedback belongs.
   *
   * ⚠ INERT IN THE SEEDER FOR NOW. DB persistence is deferred post-gate, so
   * the emitted module carries these as data the seeder does not read. The
   * emitter reports the count rather than dropping them silently.
   */
  distractors?: DistractorFeedback[];
};

/**
 * ⚠ REFUSALS ARE PRESENT ON SUCCESS TOO, AND THAT IS THE FIX.
 *
 * This used to be `{ok: true, questions}` with no refusals field: they were
 * computed and then thrown away whenever at least one question emitted. On
 * WCH11/01 that hid a whole question. 23(a)(iii) — an image-answer cell whose
 * two marking points had empty criteria — was refused three times over:
 *
 *   23(a)(iii) M1: empty criterion
 *   23(a)(iii) M2: empty criterion
 *   23(a)(iii): every point was rejected, leaving no mark scheme
 *
 * and because 47 other questions succeeded, the emitter reported "47
 * questions" and said nothing at all. Two marks vanished from a paper the
 * screen said was 48/48 approved, and the only clue was a count the reviewer
 * had to notice themselves.
 *
 * A partial success is not a success. `ok` now means "something was emitted",
 * never "nothing was lost" — callers must show `refusals` either way.
 */
export type EmitResult =
  | { ok: true; questions: FixtureQuestion[]; refusals: string[] }
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
    const unruled = decisionsFor(q).filter((l) => !isResolved(book.lines?.[l.sourceLine]));
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
    const distractors: DistractorFeedback[] = [];
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

        // ⚠ IT LEAVES THE MARKING CONTENT UNTOUCHED. Not a point, not an
        // accept, not a reject, not guidance — so it cannot change the tariff,
        // cannot award and cannot withhold. It is filed beside the mark
        // scheme, never inside it.
        case "distractor_feedback": {
          if (!isValidOption(ruling.option)) {
            // ⚠ REFUSE, DO NOT FILE IT UNDER NOTHING. An explanation with no
            // option is unreachable — no student selection could ever retrieve
            // it — so it would be a silent loss dressed as a success.
            refusals.push(
              `${q.questionNumber}: a distractor explanation has no option letter — ` +
                `"${text.slice(0, 60)}"`,
            );
            break;
          }
          distractors.push({
            option: ruling.option.toUpperCase(),
            text,
            sourceLine: line.sourceLine,
          });
          break;
        }

        case "discard":
          break;

        // ⚠ THE NEXT KIND CANNOT BE ADDED WITHOUT DECIDING WHAT EMIT DOES WITH
        // IT. Before this existed the switch had no default: distractor_feedback
        // would have fallen straight through and vanished from the fixture, and
        // `tsc` would not have said a word, because widening a union does not
        // break a non-exhaustive switch. This turns that silence into a
        // compile error.
        default:
          return assertNever(ruling.kind, `${q.questionNumber}: unhandled ruling kind`);
      }
    }

    // ⚠ `marks` IS THE EXTRACTED TARIFF, UNCHANGED. Distractor entries are
    // attached beside it and are counted by nothing.
    questions.push({
      questionNumber: q.questionNumber,
      marks: q.marks.value,
      markScheme: points,
      ...(distractors.length ? { distractors } : {}),
    });
  }

  if (questions.length === 0) {
    return { ok: false, refusals: refusals.length ? refusals : ["nothing has been approved yet"] };
  }
  return { ok: true, questions, refusals };
}

/**
 * The emitted fixture as TypeScript, for pasting into the seed fixture.
 *
 * Same shape emitRegionFixture() produces for regions, and for the same reason:
 * the output contract is a file the seeder already consumes, so the writing
 * path is the one that is already tested.
 */
/**
 * Natural keys the emitter stamps into the module. NEVER a uuid — see
 * fixture-adapter's PaperMeta.
 *
 * ⚠ EVERY FIELD IS REQUIRED, AND THAT IS THE FIX. They used to be optional,
 * so a lookup that found nothing left them undefined, the header was written
 * as `paperCode: undefined`, and emit reported a green 48/80. A partial stamp
 * is now a TYPE ERROR at the call site rather than a silent hole in a file
 * that claims to be complete.
 */
export type StampedMeta = {
  paperCode: string;
  session: string;
  year: number;
};

export type StampResult =
  | { ok: true; stamped: StampedMeta }
  | { ok: false; error: string };

/**
 * Read the paper's natural keys off the row the review page already resolved.
 *
 * ============================================================================
 * ⚠ BY id, NEVER BY slug — AND THE SILENT VERSION OF THIS SHIPPED
 * ============================================================================
 * The first version re-queried `past_papers` by SLUG and stamped only when
 * exactly one row came back. A slug is unique within a COURSE, not globally:
 * "unit-1-may-june-2025" is Chemistry, Physics AND Biology, and 72 of 90 slugs
 * sit on more than one row — the same fact getMarkSchemeReview carries a long
 * comment about. So the query matched three papers, the guard correctly
 * declined to guess, and the stamp was left undefined INSIDE A try/catch that
 * reported success. The header read `paperCode: undefined` under a green
 * 48 question(s), 80 mark(s).
 *
 * The review page has already disambiguated the paper and holds its id. This
 * takes that id and refuses — by name — on anything else.
 */
export function stampFrom(
  rows: readonly { id: string; paper_code: string | null; session: string | null; year: number | null }[],
  paperId: string,
): StampResult {
  const matches = rows.filter((r) => r.id === paperId);
  if (matches.length === 0) {
    return { ok: false, error: `No past_papers row has id ${paperId}. Nothing was emitted.` };
  }
  if (matches.length > 1) {
    // ⚠ IMPOSSIBLE ON A SANE DATABASE — id is the primary key — which is
    // exactly why it must refuse rather than take the first. If this ever
    // fires, the read is not what it claims to be.
    return {
      ok: false,
      error: `${matches.length} rows share id ${paperId}. Refusing to stamp an identity that is not unique.`,
    };
  }
  const row = matches[0];
  const missing = [
    row.paper_code ? null : "paper_code",
    row.session ? null : "session",
    typeof row.year === "number" ? null : "year",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    return {
      ok: false,
      error:
        `The paper row is missing ${missing.join(", ")}, so the fixture cannot carry a natural key. ` +
        `Fill it in on the paper before emitting.`,
    };
  }
  return {
    ok: true,
    stamped: { paperCode: row.paper_code!, session: row.session!, year: row.year! },
  };
}

export function emitFixtureSource(
  result: EmitResult,
  paperSlug: string,
  capturedAt: string,
  stamped: StampedMeta,
): string {
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
  /**
   * ⚠ JSON.stringify, NOT A HAND-ROLLED ESCAPER.
   *
   * This used to escape backslashes and double quotes and nothing else, so a
   * multi-line `guidance` — which toFixture builds by joining lines with "\n" —
   * emitted a literal newline inside a double-quoted string. 20(a)'s M4 came
   * out as an unterminated string literal three lines long.
   *
   * That bug was in the emitter from the start. It never surfaced because the
   * output was paste-in fragments that nothing ever parsed: the file could not
   * be imported, so its being unparseable cost nothing and said nothing. The
   * moment it became a real module and entered `npm run typecheck`, tsc found
   * it on the first run. A file nobody compiles is a file nobody checks.
   *
   * JSON string syntax is a subset of TypeScript's, so this is exact for
   * newlines, tabs, control characters and unicode alike.
   */
  const q = (s: string) => JSON.stringify(s);

  const blocks = result.questions.map((question) => {
    const points = question.markScheme.map((p) => {
      const lines = [
        `      {`,
        `        pointCode: ${q(p.pointCode)},`,
        `        criterion: ${q(p.criterion)},`,
      ];
      if (p.accept?.length) lines.push(`        accept: [${p.accept.map(q).join(", ")}],`);
      if (p.reject?.length) lines.push(`        reject: [${p.reject.map(q).join(", ")}],`);
      if (p.guidance) lines.push(`        guidance: ${q(p.guidance)},`);
      lines.push(`      },`);
      return lines.join("\n");
    });
    const distractors = question.distractors?.length
      ? [
          `    // FEEDBACK ONLY — never read by the marking layer, not yet seeded.`,
          `    distractors: [`,
          // ⚠ sourceLine IS EMITTED, because DistractorFeedback REQUIRES it and
          // because it is the traceability the whole feature rests on: an
          // explanation must stay findable on the page it came from. The old
          // emitter left it out and the file still "passed", since nothing ever
          // typechecked it.
          ...question.distractors.map(
            (d) =>
              `      { option: ${q(d.option)}, text: ${q(d.text)}, sourceLine: ${q(d.sourceLine)} },`,
          ),
          `    ],`,
        ]
      : [];
    return [
      `  {`,
      `    questionNumber: ${q(question.questionNumber)},`,
      `    marks: ${question.marks},`,
      `    markScheme: [`,
      ...points,
      `    ],`,
      ...distractors,
      `  },`,
    ].join("\n");
  });

  const emittedMarks = result.questions.reduce((n, x) => n + x.marks, 0);

  return [
    `// mark_scheme_items for ${paperSlug}, reviewed and approved ${capturedAt}`,
    `//`,
    `// Emitted by the mark-scheme review surface from extractor proposals. Every`,
    `// question below carries approved_at AND approved_by; anything unruled or`,
    `// unapproved was refused rather than guessed.`,
    `//`,
    `// ⚠ GENERATED. Do not edit — re-emit from the review surface instead.`,
    ...(result.refusals.length
      ? [
          `//`,
          `// ⚠ ${result.refusals.length} REFUSAL(S) — THESE QUESTIONS ARE NOT IN THIS FILE:`,
          ...result.refusals.map((r) => `//   ${r}`),
          `//`,
          `// A count of ${result.questions.length} question(s) is not the same as a`,
          `// complete paper. Check these against the printed totals before seeding.`,
        ]
      : []),
    `//`,
    `//   ${result.questions.length} question(s), ${emittedMarks} mark(s)`,
    ``,
    // ⚠ A TYPE-ONLY IMPORT, SO THE FILE IS CHECKED AND STILL LOADS UNDER PLAIN
    // NODE. `import type` is erased before node resolves anything; a value
    // import would need the .ts extension and drag the whole module in.
    `import type { FixtureQuestion } from "../../src/lib/exam/markscheme-proposals.ts";`,
    ``,
    // ⚠ NATURAL KEYS, AND NO uuid. A generated module carrying a paperId is
    // wrong the moment it is copied to another environment, and a uuid is
    // unreviewable — nobody reading a diff can tell a correct one from a
    // transposed one. totalMarks is the SUM OF WHAT WAS EMITTED, not a
    // constant: if a question is refused, this number drops and the seeder's
    // existing expect-check catches the disagreement with the cover page.
    `export const ${identifierFor(paperSlug)}_PAPER = {`,
    `  paperCode: ${q(stamped.paperCode)},`,
    `  session: ${q(stamped.session)},`,
    `  year: ${stamped.year},`,
    `  totalMarks: ${emittedMarks},`,
    `} as const;`,
    ``,
    `export const ${identifierFor(paperSlug)}: FixtureQuestion[] = [`,
    ...blocks,
    `];`,
    ``,
  ].join("\n");
}

/**
 * A legal TypeScript identifier for a paper slug.
 *
 * ⚠ THE EMITTED FILE USED TO BE PASTE-IN FRAGMENTS — bare `markScheme: [...]`
 * object properties under a comment naming the question, with no wrapper, no
 * export and no valid top level. It did not parse, so it could not be
 * imported, could not be typechecked, and turned `npm run typecheck` red the
 * moment a paper was emitted. The header told the reader to paste each block
 * in by hand while the emitter's own docstring claimed the seeder consumed it;
 * both could not be true, and neither was checked.
 */
export function identifierFor(paperSlug: string): string {
  const body = paperSlug.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  // An identifier may not begin with a digit.
  return /^[0-9]/.test(body) ? `PAPER_${body}` : body;
}

// ============================================================================
// TARIFF RECONCILIATION
// ============================================================================

export type TariffRow = {
  /** The top-level question number, as the paper prints its total: "21". */
  question: string;
  /** What the paper says the question is worth. */
  printed: number;
  /** What the extracted blocks actually add up to. */
  extracted: number;
  /** printed - extracted. Positive means marks are MISSING from the artefact. */
  shortfall: number;
  /** Which blocks contributed, so a shortfall can be chased to a part. */
  blocks: { questionNumber: string; marks: number; handTranscribed: boolean }[];
};

/**
 * Compare each question's printed total against the sum of its blocks.
 *
 * ⚠ THIS IS THE CHECK THAT CATCHES A SILENTLY DROPPED BLOCK. Edexcel's
 * typesetting lost 21(b)(i) — the extractor reports it and cannot propose it —
 * and the artefact still looked complete: 21(a), 21(b)(ii), 21(c)(i-iii) all
 * present and plausible, adding to 11 against a printed 13. Nothing about the
 * blocks themselves is wrong. Only the arithmetic knows.
 *
 * A hand-transcribed block counts exactly like an extracted one, because a
 * mark a person read off the page is not worth less than one a parser did.
 * That is what lets a manual entry close the gap and the guard agree.
 */
export function reconcileTariffs(set: ProposalSet): TariffRow[] {
  const top = (qn: string): string => {
    const m = /^\s*(\d+)/.exec(qn);
    return m ? m[1] : qn.trim();
  };

  const sums = new Map<string, TariffRow["blocks"]>();
  for (const q of set.questions) {
    const key = top(q.questionNumber);
    if (!sums.has(key)) sums.set(key, []);
    sums.get(key)!.push({
      questionNumber: q.questionNumber,
      marks: q.marks?.value ?? 0,
      handTranscribed: q.marks?.derivedFrom === "hand-transcribed",
    });
  }

  return (set.questionTotals ?? []).map((tot) => {
    const blocks = sums.get(top(tot.question)) ?? [];
    const extracted = blocks.reduce((n, b) => n + b.marks, 0);
    return {
      question: top(tot.question),
      printed: tot.marks,
      extracted,
      shortfall: tot.marks - extracted,
      blocks,
    };
  });
}

/** Only the questions that do not add up. Empty means the paper reconciles. */
export function tariffShortfalls(set: ProposalSet): TariffRow[] {
  return reconcileTariffs(set).filter((r) => r.shortfall !== 0);
}

/**
 * Strip a question's approval while keeping every ruling.
 *
 * ============================================================================
 * ⚠ AN APPROVAL REFERS TO THE CONTENT THAT WAS ON SCREEN WHEN IT WAS GIVEN
 * ============================================================================
 * When a hand-transcribed line is added to a block that was already approved,
 * the signature now covers content the examiner has never seen. 20(b)(iv) is
 * the live case: approved, and missing two of its own guidance lines.
 *
 * Leaving `approvedAt` in place would let Emit — which gates on exactly that
 * field — ship a mark scheme nobody approved in full. So the signature goes
 * and the question returns to needs-ruling. The RULINGS STAY: the founder's
 * earlier decisions about other lines are still theirs, and making them redo
 * those would be a punishment for the extractor's mistake.
 *
 * Pure, so the property can be tested without a filesystem or a session.
 */
export function withdrawApproval(book: QuestionRulings): QuestionRulings {
  const { approvedAt: _at, approvedBy: _by, ...rest } = book;
  return rest;
}
