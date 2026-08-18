/**
 * The review model: doubt first, and nothing publishes on a default.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/markscheme-proposals.test.ts
 *
 * ============================================================================
 * WHAT THESE GUARD
 * ============================================================================
 * 68 lines in WCH11/01 carry an examiner ruling the extractor refused to make.
 * The one thing a review surface must never do is turn those into a
 * click-through — so the assertions below are mostly about REFUSAL: unruled
 * lines are not emitted, unapproved questions are not emitted, and a ruling is
 * never inferred from the absence of one.
 *
 * ⚠ THE PROPOSAL SET IS READ FROM THE REAL ARTEFACT, not a copy. A hand-written
 * model of production data pins yesterday's behaviour — reconcile.test.ts spent
 * a week asserting 20(b)(ii) was unmarkable after it stopped being.
 */
import { readFileSync } from "node:fs";
import {
  buildReview,
  sortForReview,
  countUnruled,
  countApproved,
  toFixture,
  emitFixtureSource,
  identifierFor,
  pointsFullyRuled,
  type ProposalSet,
  type RulingBook,
} from "../../../src/lib/exam/markscheme-proposals.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const SET = JSON.parse(
  readFileSync("scripts/exam-seed/proposals/unit-1-may-june-2025.markscheme.json", "utf8"),
) as ProposalSet;

const APPROVER = "00000000-0000-4000-8000-000000000001";
const NOW = "2026-08-10T12:00:00.000Z";

console.log("── THE ARTEFACT IS THE REAL EXTRACTION ──");
{
  // ⚠ NOT "47 BLOCKS". The extractor produced 47; the founder has since added
  // 21(b)(i) by hand through the review surface, and a count pinned to 47
  // fails for the best possible reason. Derive both halves instead.
  const handAdded = SET.questions.filter((q) => q.marks?.derivedFrom === "hand-transcribed");
  t("47 blocks came from the extractor",
    SET.questions.length - handAdded.length === 47, SET.questions.length - handAdded.length);
  t("...plus whatever was hand-transcribed since",
    SET.questions.length === 47 + handAdded.length,
    { total: SET.questions.length, hand: handAdded.map((q) => q.questionNumber) });
  t("every block carries a mark total", SET.questions.every((q) => q.marks !== null));
  t("it says outright that nothing is published", /PROPOSALS/.test(SET.status), SET.status);
  const ruling = SET.questions.reduce((n, q) => n + q.requiresRuling.length, 0);
  const buckets = SET.questions.reduce(
    (n, q) => n + (q.accept?.length ?? 0) + (q.reject?.length ?? 0) + (q.guidance?.length ?? 0), 0);
  // ⚠ NOT "68". The extractor produced 68 flagged lines and 133 filed into
  // accept/reject/guidance — 201 in total. The founder is now RESTORING the
  // misfiled ones, which MOVES a line out of a bucket and into the queue, so
  // the two counts trade against each other while their sum does not change.
  // Pinning 68 fails the moment the sweep starts, for the best possible reason.
  //
  // The conserved total is the real invariant, and it is exactly what
  // "restore is a move, not a copy" guarantees on live data: if a restore ever
  // COPIED, this number would climb.
  t("the extractor's lines are conserved across the buckets and the queue",
    ruling + buckets === 201, { ruling, buckets, total: ruling + buckets });
  t("at least the original 68 are flagged, never fewer", ruling >= 68, ruling);
  t("every one of them says WHY",
    SET.questions.every((q) => q.requiresRuling.every((l) => (l.requiresRuling ?? []).length > 0)));
  t("every proposal carries page, y and the source line",
    SET.questions.every((q) =>
      q.points.every((p) => p.page > 0 && typeof p.y === "number" && p.sourceLine.length > 0)));
}

console.log("\n── DOUBT FIRST, OR THE SORT IS DECORATION ──");
{
  const items = sortForReview(buildReview(SET, {}));
  t("nothing is approved before anyone has approved anything", countApproved(items) === 0);
  // ⚠ DERIVED FROM THE ARTEFACT, not from the 68 it held when this was written.
  const flagged = SET.questions.reduce((n, q) => n + q.requiresRuling.length, 0);
  t("the unruled count matches the artefact", countUnruled(items) === flagged, countUnruled(items));
  const withWork = items.filter((i) => i.unruled.length > 0);
  t("questions needing a decision sort above those that do not",
    items.indexOf(withWork[0]) === 0 && items.slice(0, withWork.length).every((i) => i.unruled.length > 0));
  const first = items[0];
  t("...and within a question the least confident line comes first",
    first.unruled.every((l, i, a) => i === 0 || a[i - 1].confidence <= l.confidence),
    first.unruled.map((l) => l.confidence));
}

console.log("\n── A RULING IS NEVER A DEFAULT ──");
{
  // ⚠ THE CENTRAL GUARANTEE. There is no code path that fills in a ruling, so
  // a reviewer who clicks past a question cannot publish it by accident.
  const items = buildReview(SET, {});
  const anyPreRuled = items.some((i) => i.ruledCount > 0);
  t("no line arrives pre-ruled", !anyPreRuled);
  t("...and totalDecisions equals unruled before any ruling",
    items.every((i) => i.totalDecisions === i.unruled.length));
}

console.log("\n── toFixture() REFUSES RATHER THAN GUESSING ──");
{
  const q1 = SET.questions.find((q) => q.questionNumber === "1")!;

  t("nothing approved -> refuses outright",
    (() => { const r = toFixture(SET, {}); return !r.ok && r.refusals.length > 0; })());

  // approved, but its lines are still unruled
  const halfDone: RulingBook = {
    "1": { points: {}, lines: {}, approvedAt: NOW, approvedBy: APPROVER },
  };
  const r1 = toFixture(SET, halfDone);
  t("approved with unruled lines -> still refuses",
    !r1.ok && r1.refusals.some((x) => x.startsWith("1:") && /unruled/.test(x)),
    !r1.ok ? r1.refusals.slice(0, 3) : r1);

  // every line ruled, but nobody approved it
  const ruledNotApproved: RulingBook = {
    "1": {
      points: {},
      lines: Object.fromEntries(q1.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
    },
  };
  const r2 = toFixture(SET, ruledNotApproved);
  t("fully ruled but unapproved -> refuses, naming approval",
    !r2.ok && r2.refusals.some((x) => x.startsWith("1:") && /not approved/.test(x)),
    !r2.ok ? r2.refusals.slice(0, 3) : r2);

  // ⚠ HALF-APPROVED IS NOT APPROVED. 0028 pairs the two fields for regions
  // because a timestamp with no approver is not interpretable.
  for (const partial of [
    { approvedAt: NOW }, { approvedBy: APPROVER },
  ]) {
    const book: RulingBook = {
      "1": {
        points: {},
        lines: Object.fromEntries(q1.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
        ...partial,
      },
    };
    const r = toFixture(SET, book);
    t(`only ${Object.keys(partial)[0]} set -> refuses`, !r.ok, r);
  }
}

console.log("\n── A COMPLETE RULING EMITS, AND EMITS WHAT WAS RULED ──");
{
  const q1 = SET.questions.find((q) => q.questionNumber === "1")!;
  const [d1, d2, d3] = q1.requiresRuling;
  const book: RulingBook = {
    "1": {
      points: {},
      lines: {
        [d1.sourceLine]: { kind: "reject" },
        [d2.sourceLine]: { kind: "accept", editedText: "Allow the 79Br- form" },
        [d3.sourceLine]: { kind: "discard" },
      },
      approvedAt: NOW, approvedBy: APPROVER,
    },
  };
  const r = toFixture(SET, book);
  t("it emits", r.ok, r);
  if (r.ok) {
    const emitted = r.questions.find((x) => x.questionNumber === "1")!;
    t("...only the approved question", r.questions.length === 1, r.questions.map((x) => x.questionNumber));
    t("...with the paper's own tariff", emitted.marks === 1, emitted.marks);
    const last = emitted.markScheme[emitted.markScheme.length - 1];
    t("...the rejected line under reject[]", (last.reject ?? []).includes(d1.text), last.reject);
    t("...the EDITED wording, not the printed one",
      (last.accept ?? []).includes("Allow the 79Br- form") && !(last.accept ?? []).includes(d2.text),
      last.accept);
    t("...and the discarded line nowhere",
      JSON.stringify(emitted).includes(d3.text) === false);
  }
}

console.log("\n── ALTERNATIVE ROUTES: ROUTE 1 ONLY, NEVER SUMMED ──");
{
  // 22(c) prints three marks twice, once per route to the answer. A script
  // takes one and earns three. Emitting both would be six points on a
  // three-mark question — and would collide on UNIQUE (question_id, point_code).
  const q = SET.questions.find((x) => x.questionNumber === "22(c)")!;
  t("the artefact flags it as having alternatives", q.hasAlternativeMethods === true);
  t("...and carries 6 proposed points across 2 routes",
    q.points.length === 6 && new Set(q.points.map((p) => p.route)).size === 2,
    q.points.map((p) => [p.pointCode, p.route]));

  const book: RulingBook = {
    "22(c)": {
      points: {},
      lines: Object.fromEntries(q.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  };
  const r = toFixture(SET, book);
  t("it emits", r.ok, r);
  if (r.ok) {
    const emitted = r.questions[0];
    t("...3 points, not 6", emitted.markScheme.length === 3, emitted.markScheme.map((p) => p.pointCode));
    t("...and never more points than the tariff", emitted.markScheme.length <= emitted.marks);
    t("...with no ALT-prefixed code", emitted.markScheme.every((p) => !p.pointCode.startsWith("ALT")));
  }
}

console.log("\n── AN EDITED OR REJECTED POINT ──");
{
  const q = SET.questions.find((x) => x.questionNumber === "20(a)")!;
  const book: RulingBook = {
    "20(a)": {
      points: {
        M1: { verdict: "edit", criterion: "convert the temperature to kelvin" },
        M2: { verdict: "reject", why: "duplicated by M3" },
      },
      lines: Object.fromEntries(q.requiresRuling.map((l) => [l.sourceLine, { kind: "guidance" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  };
  const r = toFixture(SET, book);
  t("it emits", r.ok, r);
  if (r.ok) {
    const m = r.questions[0].markScheme;
    t("the edited criterion replaces the printed one",
      m.some((p) => p.criterion === "convert the temperature to kelvin"));
    t("...and the rejected point is gone", !m.some((p) => p.pointCode === "M2"));
    t("guidance rulings land on the last point",
      Boolean(m[m.length - 1].guidance), m[m.length - 1]);
  }
}
{
  // Rejecting everything leaves no mark scheme — which is a refusal, not an
  // empty question written to a table that decides marks.
  const q = SET.questions.find((x) => x.questionNumber === "20(a)")!;
  const book: RulingBook = {
    "20(a)": {
      points: Object.fromEntries(q.points.map((p) => [p.pointCode, { verdict: "reject" as const, why: "x" }])),
      lines: Object.fromEntries(q.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  };
  const r = toFixture(SET, book);
  t("rejecting every point refuses rather than emitting an empty scheme",
    !r.ok && r.refusals.some((x) => /leaving no mark scheme/.test(x)), r);
}

console.log("\n── THE EMITTED SOURCE SAYS WHAT IT IS ──");
{
  const refused = emitFixtureSource({ ok: false, refusals: ["1: not approved"] }, "wch11", NOW);
  t("a refusal emits NO fixture", !refused.includes("markScheme: ["), refused.slice(0, 60));
  t("...and lists what is not ready", refused.includes("1: not approved"));

  const q1 = SET.questions.find((q) => q.questionNumber === "1")!;
  const ok = toFixture(SET, {
    "1": {
      points: {},
      lines: Object.fromEntries(q1.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  });
  const src = emitFixtureSource(ok, "wch11-01-2025-may-june", NOW);
  // ⚠ WAS "carries the seeder commands". The emitted file used to be paste-in
  // fragments, so its header told the reader to paste each block by hand and
  // then run the seeder. It is a real module now, so what has to be true is
  // that it EXPORTS the fixture under a name derived from the slug — the
  // seeder imports it rather than being told about it in a comment.
  t("an emission exports a named fixture",
    src.includes(`export const ${identifierFor("wch11-01-2025-may-june")}: FixtureQuestion[] = [`),
    src.split("\n").find((l) => l.startsWith("export const")));
  t("...and warns it is generated", /GENERATED\. Do not edit/.test(src));

  // ⚠ TESTED WITH A STRING THAT ACTUALLY CONTAINS A QUOTE. The first version of
  // this assertion pattern-matched the whole emitted file and flagged ordinary
  // content — a check that fires on correct output is a check that gets deleted.
  // The real question is whether a criterion carrying " and \\ survives the
  // round trip into a pasteable literal.
  const nasty = 'he said "no" \\ and left';
  const edited = toFixture(SET, {
    "1": {
      points: { M1: { verdict: "edit", criterion: nasty } },
      lines: Object.fromEntries(q1.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  });
  const nastySrc = emitFixtureSource(edited, "wch11", NOW);
  const literal = /criterion: ("(?:[^"\\]|\\.)*")/.exec(nastySrc)?.[1];
  t("a criterion containing a quote and a backslash emits as a valid literal",
    literal !== undefined && JSON.parse(literal) === nasty, literal);
}

console.log("\n── EVERY REFUSAL NAMES THE QUESTION ──");
{
  // A refusal a reviewer cannot act on is a refusal they will ignore.
  const r = toFixture(SET, {});
  t("refusals are per question, not one summary line",
    !r.ok && r.refusals.length > 1 && r.refusals.every((x) => /^[\w()]+:/.test(x)),
    !r.ok ? r.refusals.slice(0, 3) : r);
}

console.log("\n── THE VERIFIED BADGE IS EARNED, NOT ENUMERATED ──");
{
  // ⚠ WHY IT WAS UNSTAMPED. toFixture defaults an unruled point to accept, so
  // a question can be approved with the white card never touched. "Approved"
  // therefore cannot distinguish "I read every criterion against the page"
  // from "I ruled the yellow lines and pressed Approve". This is the second
  // claim, and it is display-only.
  const q = SET.questions.find((x) => x.questionNumber === "1")!;
  const codes = q.points.map((p) => p.pointCode);

  t("no ruling book at all is not verified", !pointsFullyRuled(q, undefined));
  t("an empty book is not verified",
    !pointsFullyRuled(q, { points: {}, lines: {} }));
  t("approval ALONE is not verification",
    !pointsFullyRuled(q, { points: {}, lines: {}, approvedAt: NOW, approvedBy: APPROVER }));
  t("every point ruled IS verification",
    pointsFullyRuled(q, {
      points: Object.fromEntries(codes.map((c) => [c, { verdict: "accept" as const }])),
      lines: {},
    }));
  t("an EDIT counts as having ruled the point",
    pointsFullyRuled(q, {
      points: Object.fromEntries(codes.map((c) => [c, { verdict: "edit" as const, criterion: "x" }])),
      lines: {},
    }));
  t("so does a REJECT — the point was looked at either way",
    pointsFullyRuled(q, {
      points: Object.fromEntries(codes.map((c) => [c, { verdict: "reject" as const, why: "no" }])),
      lines: {},
    }));

  // ⚠ PARTIAL IS NOT VERIFIED. A multi-point question with one point ruled.
  const multi = SET.questions.find((x) => x.points.length > 1)!;
  t("a fixture with more than one point exists to test this", multi.points.length > 1);
  t("ruling SOME points is not verification",
    !pointsFullyRuled(multi, {
      points: { [multi.points[0].pointCode]: { verdict: "accept" } }, lines: {},
    }), multi.questionNumber);
  t("ruling ALL of them is",
    pointsFullyRuled(multi, {
      points: Object.fromEntries(multi.points.map((p) => [p.pointCode, { verdict: "accept" as const }])),
      lines: {},
    }));

  // ⚠ A QUESTION WITH NOTHING TO CHECK IS NOT VERIFIED, IT IS SKIPPED.
  // `every` over an empty array is true, which would stamp the badge on
  // exactly the questions where no criterion was ever read.
  t("a question with no points is NOT verified",
    !pointsFullyRuled({ ...q, points: [] }, { points: {}, lines: {} }));

  // ⚠ A RULING FOR A POINT THAT NO LONGER EXISTS DOES NOT COUNT.
  t("rulings keyed to other point codes do not verify this question",
    !pointsFullyRuled(q, { points: { ZZ9: { verdict: "accept" } }, lines: {} }));

  // The real artefact: Section A was ruled through the surface.
  const ruled = SET.questions.filter((x) =>
    pointsFullyRuled(x, ((SET as ProposalSet & { rulings?: RulingBook }).rulings ?? {})[x.questionNumber]));
  t("Section A earns the badge from the founder's own rulings",
    ruled.length >= 10, ruled.map((x) => x.questionNumber));
  // ⚠ WAS "...and unruled questions do not [earn the badge]". Every question
  // is ruled now, so there are none left to be the negative case — the
  // assertion fell to zero coverage rather than failing honestly. The durable
  // property is that the badge is EARNED, so a book with no point rulings must
  // not earn it, whatever the rest of the paper looks like.
  const bare = SET.questions.find((q) => q.points.length > 0)!;
  t("...and a question with no point rulings does not earn it",
    !pointsFullyRuled(bare, { points: {}, lines: {} }));
  t("...nor one ruled on a different point code",
    !pointsFullyRuled(bare, { points: { ZZ9: { verdict: "accept" } }, lines: {} }));

  // ⚠ EMIT GATING IS UNTOUCHED. Verification is a badge, not a gate.
  const book: RulingBook = {
    "1": {
      points: Object.fromEntries(codes.map((c) => [c, { verdict: "accept" as const }])),
      lines: Object.fromEntries(q.requiresRuling.map((l) => [l.sourceLine, { kind: "discard" as const }])),
      approvedAt: NOW, approvedBy: APPROVER,
    },
  };
  const verifiedEmit = toFixture({ ...SET, questions: [q] }, book);
  const unverifiedEmit = toFixture({ ...SET, questions: [q] }, {
    "1": { ...book["1"], points: {} },
  });
  t("an unverified question still emits, exactly as before",
    unverifiedEmit.ok === true, unverifiedEmit.ok ? "" : unverifiedEmit);
  t("...producing the identical mark scheme",
    verifiedEmit.ok && unverifiedEmit.ok &&
    JSON.stringify(verifiedEmit.questions) === JSON.stringify(unverifiedEmit.questions));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
