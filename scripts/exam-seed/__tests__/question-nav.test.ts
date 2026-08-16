/**
 * Question paths, and moving the viewer to the right row.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/question-nav.test.ts
 *
 * ============================================================================
 * THE TWO FAILURES THIS PINS
 * ============================================================================
 * 1. A PAGE INDEX OFF BY ONE. extract-markscheme.py numbers pages from 0;
 *    pdf.js numbers them from 1. Selecting Q3 (artefact page 5) rendered
 *    physical page 5 — which holds Q1 and Q2. Verified against the real PDF:
 *    physical page 5 contains labels ['1','2'], physical page 6 contains
 *    ['3','4','5']. Every page shown was a real mark-scheme page full of
 *    plausible rows, so nothing looked broken.
 *
 * 2. TWO QUESTIONS ON ONE PAGE. Q1 and Q2 are both on artefact page 4. The old
 *    code only called setPage, so moving between them changed nothing on
 *    screen and the reviewer was left to find the row by eye — the thing the
 *    whole surface exists to avoid.
 *
 * Fixtures only. No database, no credentials, no PDF.
 */
import {
  parseQuestionPath,
  isSameQuestion,
  isAncestorOf,
  compareQuestionPaths,
  compareQuestionNumbers,
  sortByQuestionNumber,
  romanValue,
  findExactRow,
  toViewerPage,
  locateBlock,
  toViewerTarget,
  navMove,
} from "../../../src/lib/exam/question-nav.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const P = (s: string) => parseQuestionPath(s)!;

console.log("── A QUESTION NUMBER IS A PATH, NOT A STRING ──");
{
  t("20 parses to one segment", P("20").canonical === "20" && P("20").depth === 1);
  t("20(a) parses to two", P("20(a)").canonical === "20.a" && P("20(a)").depth === 2);
  t("20(a)(i) parses to three", P("20(a)(i)").canonical === "20.a.i", P("20(a)(i)"));
  t("22(c) parses", P("22(c)").canonical === "22.c");
  t("whitespace and case are normalised", P(" 20(A) ").canonical === "20.a");
  t("a non-question is refused rather than guessed", parseQuestionPath("Section B") === null);
  t("...as is an empty bracket", parseQuestionPath("20()") === null);
}

console.log("\n── THE MIS-MAPPINGS THE SPEC FORBIDS ──");
{
  // ⚠ THE TWO NAMED IN THE SPEC.
  t("20(a) is NOT 20(b)", !isSameQuestion(P("20(a)"), P("20(b)")));
  t("20(a) is NOT an ancestor of 20(b)", !isAncestorOf(P("20(a)"), P("20(b)")));
  t("22(c) is NOT 22", !isSameQuestion(P("22(c)"), P("22")));
  t("22(c) does not match a generic Q22 row",
    findExactRow([{ questionNumber: "22" }], P("22(c)")) === null);

  // ⚠ THE ONE A STRING PREFIX WOULD GET WRONG. "2".startsWith-style matching
  // makes Q2 an ancestor of Q20, attaching Q2's mark scheme to all of Q20.
  t("2 is NOT an ancestor of 20", !isAncestorOf(P("2"), P("20")));
  t("2 is NOT the same as 20", !isSameQuestion(P("2"), P("20")));
  t("20 IS an ancestor of 20(a)", isAncestorOf(P("20"), P("20(a)")));
  t("20 IS an ancestor of 20(a)(i)", isAncestorOf(P("20"), P("20(a)(i)")));
  t("20(a) IS an ancestor of 20(a)(i)", isAncestorOf(P("20(a)"), P("20(a)(i)")));
  t("20(a)(i) is NOT an ancestor of 20(a)(ii)",
    !isAncestorOf(P("20(a)(i)"), P("20(a)(ii)")));
  t("a question is not its own ancestor", !isAncestorOf(P("20(a)"), P("20(a)")));

  // ⚠ EXACT-ONLY LOOKUP. Falling back to an ancestor would put the reviewer on
  // Q20's stem while the card said 20(a) — the mis-mapping in another costume.
  const rows = [{ questionNumber: "20" }, { questionNumber: "20(b)" }];
  t("no row for 20(a) returns null, NOT the 20 row",
    findExactRow(rows, P("20(a)")) === null, findExactRow(rows, P("20(a)")));
  t("...and an exact row is still found",
    findExactRow(rows, P("20(b)"))?.questionNumber === "20(b)");
}

console.log("\n── ORDERING ──");
{
  const sorted = ["20(a)", "2", "20", "20(b)", "3", "20(a)(ii)", "20(a)(i)"]
    .map(P).sort(compareQuestionPaths).map((p) => p.raw);
  t("2 before 3 before 20 before 20(a) before 20(a)(i) before 20(a)(ii) before 20(b)",
    sorted.join(" ") === "2 3 20 20(a) 20(a)(i) 20(a)(ii) 20(b)", sorted);
}

console.log("\n── THE PAGE INDEX IS CONVERTED EXACTLY ONCE ──");
{
  // ⚠ REAL NUMBERS FROM THE REAL ARTEFACT. Q1/Q2 are extraction page 4, Q3 is
  // extraction page 5, and the PDF's physical page 5 holds Q1 and Q2.
  t("extraction page 4 is viewer page 5", toViewerPage(4) === 5);
  t("extraction page 5 is viewer page 6", toViewerPage(5) === 6);
  t("SABOTAGE — passing the raw extraction page shows the page BEFORE",
    4 !== toViewerPage(4));
}

console.log("\n── A BLOCK ALWAYS KNOWS WHERE IT CAME FROM ──");
{
  // Q1 as the artefact actually holds it.
  const q1 = {
    page: 4,
    marks: { page: 4, y: 112.5 },
    points: [{ page: 4, y: 118.0 }],
    requiresRuling: [{ page: 4, y: 140.4 }],
  };
  const l1 = locateBlock(q1)!;
  t("locates Q1 on viewer page 5", l1.page === 5, l1);
  t("...as a BAND spanning its own rows, not a point",
    l1.top === 112.5 && l1.bottom === 140.4, l1);
  t("...and says the basis is the block's own provenance",
    l1.basis === "block-provenance");

  // ⚠ A ONE-LINE BLOCK STILL GETS A VISIBLE BAND. A hairline highlight is one
  // the eye slides off, which is indistinguishable from no highlight.
  const thin = locateBlock({ page: 9, marks: { page: 9, y: 200 } })!;
  t("a single-row block is padded to a visible band", thin.bottom - thin.top >= 18, thin);

  // ⚠ ONLY THE ANCHOR PAGE. A block continuing onto the next page must not
  // stretch its band across a page boundary.
  const spill = locateBlock({
    page: 6, marks: { page: 6, y: 100 }, points: [{ page: 7, y: 500 }],
  })!;
  t("rows on a LATER page do not stretch the band", spill.page === 7 && spill.bottom < 200, spill);

  t("a block with no located rows returns null rather than page 1",
    locateBlock({ page: null, marks: null }) === null);
}

console.log("\n── TWO QUESTIONS ON ONE PAGE MUST MOVE THE VIEWER ──");
{
  const PAGE_H = 595.44;                      // landscape mark scheme
  const q1 = locateBlock({ page: 4, marks: { page: 4, y: 112.5 }, requiresRuling: [{ page: 4, y: 140.4 }] })!;
  const q2 = locateBlock({ page: 4, marks: { page: 4, y: 271.6 }, requiresRuling: [{ page: 4, y: 299.5 }] })!;
  const q3 = locateBlock({ page: 5, marks: { page: 5, y: 98.7 }, requiresRuling: [{ page: 5, y: 126.6 }] })!;

  const t1 = toViewerTarget(q1, PAGE_H)!;
  const t2 = toViewerTarget(q2, PAGE_H)!;
  const t3 = toViewerTarget(q3, PAGE_H)!;

  t("Q1 and Q2 resolve to the SAME viewer page", t1.page === t2.page && t1.page === 5);
  t("...but to different bands", Math.abs(t1.topPct - t2.topPct) > 5, [t1.topPct, t2.topPct]);

  // ⚠ THE BUG, PINNED. Same page, so the old code did nothing at all.
  t("moving Q1 -> Q2 is a SCROLL, not 'nothing'", navMove(t1, t2) === "scroll", navMove(t1, t2));
  t("moving Q2 -> Q1 is also a scroll (k, backwards)", navMove(t2, t1) === "scroll");
  t("moving Q2 -> Q3 is a PAGE change", navMove(t2, t3) === "page", navMove(t2, t3));
  t("moving to where you already are is 'none'", navMove(t1, t1) === "none");
  t("arriving from nowhere is a page change", navMove(null, t1) === "page");

  // ⚠ ANTI-VACUITY. A navMove that returned "scroll" for everything would pass
  // the two scroll assertions above and break page changes entirely.
  t("ANTI-VACUITY — navMove distinguishes all three outcomes",
    new Set([navMove(t1, t2), navMove(t2, t3), navMove(t1, t1)]).size === 3);

  // Centring: the band's middle, as a fraction of the page.
  t("the scroll target centres the band",
    Math.abs(t2.centreFraction - ((t2.topPct + t2.topPct + t2.heightPct) / 200)) < 1e-9, t2);
  t("percentages stay within the page", t3.topPct >= 0 && t3.topPct + t3.heightPct <= 100, t3);
  t("a page with no height yields no target", toViewerTarget(q1, 0) === null);
}

console.log("\n── CANONICAL EXAM ORDER ──");
{
  const order = (xs: string[]) => xs.map(P).sort(compareQuestionPaths).map((p) => p.raw).join(" ");

  // ⚠ THE NUMERIC CASE. As strings, "10" sorts before "2".
  t("2 before 10 before 20 — numbers, not strings",
    order(["20", "10", "2", "3"]) === "2 3 10 20", order(["20", "10", "2", "3"]));
  t("SABOTAGE — a plain string sort gets this WRONG",
    ["20", "10", "2", "3"].slice().sort().join(" ") !== "2 3 10 20",
    ["20", "10", "2", "3"].slice().sort().join(" "));

  // ⚠ THE ROMAN CASE. As strings, "(ix)" sorts before "(viii)".
  const romans = ["20(a)(x)", "20(a)(ix)", "20(a)(viii)", "20(a)(iv)", "20(a)(v)",
                  "20(a)(i)", "20(a)(vii)", "20(a)(ii)", "20(a)(vi)", "20(a)(iii)"];
  t("(i)…(x) sort as NUMBERS",
    order(romans) === "20(a)(i) 20(a)(ii) 20(a)(iii) 20(a)(iv) 20(a)(v) 20(a)(vi) " +
                      "20(a)(vii) 20(a)(viii) 20(a)(ix) 20(a)(x)", order(romans));
  t("(viii) before (ix) — the pair a string sort inverts",
    compareQuestionPaths(P("20(viii)"), P("20(ix)")) < 0);
  t("SABOTAGE — a plain string sort puts (ix) before (viii)",
    "20(a)(ix)" < "20(a)(viii)");

  // The full hierarchy the spec spells out.
  const spec = ["21(a)", "20(b)", "20(a)(ii)", "20", "21", "20(a)", "20(a)(i)"];
  t("20 < 20(a) < 20(a)(i) < 20(a)(ii) < 20(b) < 21 < 21(a)",
    order(spec) === "20 20(a) 20(a)(i) 20(a)(ii) 20(b) 21 21(a)", order(spec));
  t("a parent sorts before its own parts", compareQuestionPaths(P("20"), P("20(a)")) < 0);
  t("22(c) sorts after 22, not instead of it",
    compareQuestionPaths(P("22"), P("22(c)")) < 0);
  t("the comparator is antisymmetric",
    compareQuestionPaths(P("20(b)"), P("20(a)")) > 0 &&
    compareQuestionPaths(P("20(a)"), P("20(a)")) === 0);
}

console.log("\n── ROMAN NUMERALS, WITHOUT EATING THE PART LETTERS ──");
{
  t("i=1, iv=4, v=5, ix=9, x=10",
    [romanValue("i"), romanValue("iv"), romanValue("v"), romanValue("ix"), romanValue("x")]
      .join() === "1,4,5,9,10");
  t("xiv=14, xxxix=39", romanValue("xiv") === 14 && romanValue("xxxix") === 39);

  // ⚠ THE TRAP THIS AVOIDS. A general roman parser reads the part letter "(c)"
  // as 100 and sorts it AFTER "(i)". Restricting the alphabet to {i,v,x} keeps
  // every other letter a letter.
  t("c is not 100 — it is the part letter (c)", romanValue("c") === null);
  t("d, l, m are letters too",
    romanValue("d") === null && romanValue("l") === null && romanValue("m") === null);
  t("(c) still sorts before (d)", compareQuestionPaths(P("22(c)"), P("22(d)")) < 0);
  t("(c) still sorts before (i)", compareQuestionPaths(P("22(c)"), P("22(i)")) < 0);
  t("(b) before (c) before (d) before (e)",
    ["22(e)", "22(c)", "22(b)", "22(d)"].map(P).sort(compareQuestionPaths)
      .map((p) => p.raw).join(" ") === "22(b) 22(c) 22(d) 22(e)");

  // ⚠ WHY THE RESTRICTION IS SAFE. For every single letter that stays
  // ambiguous, roman order and alphabetic order give the same answer.
  t("the ambiguous singles i<v<x agree either way",
    romanValue("i")! < romanValue("v")! && romanValue("v")! < romanValue("x")! &&
    "i" < "v" && "v" < "x");

  // ⚠ NON-CANONICAL SPELLINGS ARE REFUSED, not valued. Inventing a number for
  // "iiii" would impose an order the paper never printed.
  t("iiii is refused", romanValue("iiii") === null);
  t("vv and ixi are refused", romanValue("vv") === null && romanValue("ixi") === null);
  t("a letter outside {i,v,x} is refused", romanValue("a") === null);
  t("the empty string is refused", romanValue("") === null);
}

console.log("\n── SORTING THE NAVIGATOR ──");
{
  const raw = [{ q: "20(a)(ii)" }, { q: "2" }, { q: "20" }, { q: "10" },
               { q: "20(a)(i)" }, { q: "20(b)" }, { q: "20(a)" }];
  const sorted = sortByQuestionNumber(raw, (r) => r.q);
  t("the navigator lands in exam order",
    sorted.map((r) => r.q).join(" ") === "2 10 20 20(a) 20(a)(i) 20(a)(ii) 20(b)",
    sorted.map((r) => r.q));

  // ⚠ A COPY. The artefact's own order is provenance — the order the extractor
  // read the mark scheme in — and this is a display concern.
  t("the input array is NOT reordered", raw[0].q === "20(a)(ii)" && raw[1].q === "2");
  t("...and it is a different array", sorted !== (raw as unknown));
  t("nothing is dropped", sorted.length === raw.length);

  // ⚠ A LABEL WE CANNOT PARSE STILL APPEARS. A navigator that silently omitted
  // a question would hide work that still needs ruling.
  const withJunk = sortByQuestionNumber(
    [{ q: "Section B" }, { q: "20" }, { q: "QWC" }, { q: "2" }], (r) => r.q);
  t("unparseable labels sort LAST, never dropped",
    withJunk.map((r) => r.q).join(" ") === "2 20 Section B QWC", withJunk.map((r) => r.q));
  t("...and keep their recorded order between themselves (stable sort)",
    withJunk[2].q === "Section B" && withJunk[3].q === "QWC");

  t("comparing printed numbers directly agrees with the paths",
    compareQuestionNumbers("2", "10") < 0 &&
    compareQuestionNumbers("20(a)(viii)", "20(a)(ix)") < 0 &&
    compareQuestionNumbers("20(b)", "20(a)") > 0);
  t("an unparseable label loses to a real one, whichever side it is on",
    compareQuestionNumbers("Section B", "20") > 0 &&
    compareQuestionNumbers("20", "Section B") < 0 &&
    compareQuestionNumbers("Section B", "QWC") === 0);

  // ⚠ j/k WALK THE SAME LIST THE EYE DOES. The filtered view is derived from
  // the sorted one, so filtering cannot reintroduce the artefact's order.
  const unruled = sorted.filter((r) => r.q !== "20");
  t("filtering preserves exam order",
    unruled.map((r) => r.q).join(" ") === "2 10 20(a) 20(a)(i) 20(a)(ii) 20(b)");

  // ⚠ ANTI-VACUITY. If the comparator were a no-op the sort would return the
  // input order, and every assertion above about ORDER would still be checking
  // something — but this one would not.
  t("ANTI-VACUITY — the sort actually reorders",
    sorted.map((r) => r.q).join(" ") !== raw.map((r) => r.q).join(" "));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
