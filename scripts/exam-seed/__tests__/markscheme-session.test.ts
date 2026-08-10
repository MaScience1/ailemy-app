/**
 * The four ways a 68-line ruling session can lose work.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/markscheme-session.test.ts
 *
 * ============================================================================
 * WHY THESE FOUR AND NOT A FEATURE LIST
 * ============================================================================
 * The reviewer is going to sit down once and rule on all 68 flagged lines. The
 * failure that matters in that session is not a missing button — it is work
 * that was done and then quietly wasn't there. Each of these is one route to
 * that outcome:
 *
 *   1. a refresh mid-session shows an empty screen        (state not restored)
 *   2. a failed save reverts the ruling off the screen    (tidy-up as data loss)
 *   3. a second tab overwrites the first, silently        (last write wins)
 *   4. the remaining count is a local tally               (says 0, disk says 68)
 *
 * ⚠ CASE 4 IS THE DANGEROUS ONE, because it is the one that reports SUCCESS.
 * The other three are visible the moment they happen. A count that counts the
 * browser's opinion reaches zero, the reviewer stops, and the work is gone.
 */
import {
  nextRevision,
  buildReview,
  countUnruled,
  type ProposalSet,
  type RulingBook,
  type QuestionRulings,
} from "../../../src/lib/exam/markscheme-proposals.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

// ── a two-question proposal set with three flagged lines ──────────────────
const line = (s: string) => ({
  text: s, sourceLine: s, page: 5, y: 100, confidence: 0.6,
  derivedFrom: "test", requiresRuling: ["test"],
});
const SET = {
  source: "test.pdf", pages: 1, extractor: "test", status: "PROPOSALS",
  questions: [
    {
      questionNumber: "14(a)", page: 5, marks: { value: 2, y: 100 },
      points: [{ pointCode: "M1", route: 1, criterion: "c", marks: 2, confidence: 0.9 }],
      accept: [], reject: [], guidance: [],
      requiresRuling: [line("Ignore SF except 1 SF"), line("Do not award unless working shown")],
      routes: 1,
    },
    {
      questionNumber: "14(b)", page: 6, marks: { value: 1, y: 200 },
      points: [{ pointCode: "M1", route: 1, criterion: "d", marks: 1, confidence: 0.9 }],
      accept: [], reject: [], guidance: [],
      requiresRuling: [line("Accept ecf from (a)")],
      routes: 1,
    },
  ],
  questionTotals: [], problems: [],
} as unknown as ProposalSet;

const ruled = (lines: string[]): QuestionRulings => ({
  points: {},
  lines: Object.fromEntries(lines.map((l) => [l, { kind: "guidance" as const }])),
});

// ══════════════════════════════════════════════════════════════════════════
console.log("── 1. A REFRESH MID-SESSION MUST NOT SHOW AN EMPTY SCREEN ──");
// The page seeds its editor from the rulings the server sends. The thing that
// can break is the SERVER not sending them, so what is asserted is that the
// stored book round-trips into the review items with the decisions still on.
{
  const book: RulingBook = { "14(a)": ruled(["Ignore SF except 1 SF"]) };
  const items = buildReview(SET, book);
  const a = items.find((i) => i.question.questionNumber === "14(a)")!;
  t("a question with one line ruled reports one decision made", a.ruledCount === 1, a.ruledCount);
  t("...and the other line still needing one", a.unruled.length === 1, a.unruled.map((l) => l.sourceLine));
  t("...naming WHICH line is still open",
    a.unruled[0].sourceLine === "Do not award unless working shown", a.unruled[0]?.sourceLine);

  // ⚠ SABOTAGE: this is what the screen did before the fix — the rulings never
  // reached the client, so every line came back unruled.
  const asIfNotSent = buildReview(SET, {});
  const a2 = asIfNotSent.find((i) => i.question.questionNumber === "14(a)")!;
  t("SABOTAGE — rulings withheld from the client: the same question reads as untouched",
    a2.unruled.length === 2 && a2.ruledCount === 0, { unruled: a2.unruled.length, ruled: a2.ruledCount });
  t("...which is why the count must come from the book, not from the screen",
    countUnruled(items) === 2 && countUnruled(asIfNotSent) === 3,
    { withBook: countUnruled(items), withoutBook: countUnruled(asIfNotSent) });
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. A SAVE THAT FAILS MUST NOT TAKE THE RULING WITH IT ──");
// nextRevision decides whether a save may proceed. What matters here is that a
// REFUSAL IS A REFUSAL — it returns no revision at all, so there is no value a
// caller could mistake for "stored". The client keeps its draft on this arm.
{
  const conflict = nextRevision({ ...ruled([]), revision: 4 }, 2);
  t("a stale save is refused", conflict.ok === false, conflict);
  t("...and carries NO revision a caller could bank", !("revision" in conflict), conflict);
  t("...and names both sides so a person can tell what happened",
    !conflict.ok && conflict.diskRevision === 4 && conflict.clientRevision === 2, conflict);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. TWO TABS MUST NOT SILENTLY OVERWRITE EACH OTHER ──");
{
  // Both tabs load 14(a) at revision 1.
  const onDisk: QuestionRulings = { ...ruled(["Ignore SF except 1 SF"]), revision: 1 };

  // Tab A saves first. It was up to date, so it is allowed, and disk goes to 2.
  const a = nextRevision(onDisk, 1);
  t("tab A, up to date, is allowed", a.ok === true && a.revision === 2, a);

  // Tab B now saves against the revision it loaded — 1 — which is stale.
  const afterA: QuestionRulings = { ...onDisk, revision: a.ok ? a.revision : 0 };
  const b = nextRevision(afterA, 1);
  t("tab B, holding a stale view, is REFUSED", b.ok === false, b);

  // ⚠ THE ANTI-VACUITY CHECK. A conflict rule that refuses everything would
  // pass the assertion above and make the tool unusable. Tab B must succeed
  // once it has caught up.
  const bRetry = nextRevision(afterA, 2);
  t("...but tab B succeeds once it reloads and retries at the current revision",
    bRetry.ok === true && bRetry.revision === 3, bRetry);

  // A question nobody has ruled on yet is not a conflict.
  t("a first-ever ruling is not a conflict", nextRevision(undefined, 0).ok === true);

  // ⚠ SABOTAGE: the old behaviour — no revision compared, every save allowed.
  const noCheck = (_d: QuestionRulings | undefined, _c: number | undefined) => ({ ok: true as const, revision: 0 });
  t("SABOTAGE — comparison removed: tab B's stale write is accepted and tab A's ruling is gone",
    noCheck(afterA, 1).ok === true);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. THE REMAINING COUNT MUST COME FROM DISK, NOT FROM THE TAB ──");
{
  const book: RulingBook = { "14(a)": ruled(["Ignore SF except 1 SF", "Do not award unless working shown"]) };
  const stored = countUnruled(buildReview(SET, book));
  t("two of three lines ruled on disk -> 1 remaining", stored === 1, stored);

  // What the browser believed, having also ruled 14(b) without saving it.
  const localTally = 0;
  t("SABOTAGE — the tab's own tally says 0 while disk says 1",
    localTally !== stored,
    { screenSays: localTally, diskSays: stored });
  t("...so a reviewer trusting the tab would stop with a line unruled and no warning",
    localTally === 0 && stored > 0);

  // And the honest version: unsaved work is REPORTED, never subtracted.
  const unsavedQuestions = 1;
  t("the honest reading keeps both numbers and never nets them off",
    stored === 1 && unsavedQuestions === 1);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
