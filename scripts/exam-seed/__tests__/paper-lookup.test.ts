/**
 * One slug, three subjects: which paper does a link mean?
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/paper-lookup.test.ts
 *
 * ============================================================================
 * THE DEFECT THIS PINS
 * ============================================================================
 * `past_papers.slug` is unique only WITHIN a course. "unit-1-may-june-2025" is
 * three live rows — Chemistry WCH11/01, Physics WPH11/01 and Biology WBI11/01 —
 * and across the catalogue 72 of 90 slugs are used by more than one course.
 *
 * An earlier getPaperBySlug ordered by year and took the first match. That
 * silently served ONE SUBJECT'S PAPER UNDER ANOTHER SUBJECT'S LINK, with
 * nothing logged and nothing visibly wrong: a student following a Biology link
 * sat the Chemistry paper. There is no error state in that failure — it looks
 * exactly like working software.
 *
 * ⚠ SO THE TWO OUTCOMES ARE "THE RIGHT PAPER" AND "AN EXPLICIT REFUSAL", and
 * never "a paper". Every case below asserts WHICH of those happened and, for a
 * refusal, WHICH refusal — because "ambiguous" and "not_found" send a person
 * to two different places, and collapsing them sends them to the wrong one.
 *
 * ============================================================================
 * THE FIXTURE IS THE REAL COLLISION, AND IT IS RE-DERIVABLE
 * ============================================================================
 * The three rows below are the shape of the live collision, not invented. To
 * re-derive it against the database at any time:
 *
 *   select p.slug, p.paper_code, c.slug as course
 *     from past_papers p join courses c on c.id = p.course_id
 *    where p.slug = 'unit-1-may-june-2025';
 *
 * If that ever returns ONE row, this suite is still correct but is no longer
 * testing a live hazard, and the header above should be corrected rather than
 * the test deleted.
 */
import { choosePaper } from "../../../src/lib/catalogue/paper-lookup.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

type Row = { paper_code: string; course: { slug: string } | null };

// The live collision on unit-1-may-june-2025.
const CHEM: Row = { paper_code: "WCH11/01", course: { slug: "edexcel-ial-as-chemistry" } };
const PHYS: Row = { paper_code: "WPH11/01", course: { slug: "edexcel-ial-as-physics" } };
const BIO:  Row = { paper_code: "WBI11/01", course: { slug: "edexcel-ial-as-biology" } };
const ALL_THREE = [PHYS, CHEM, BIO];   // deliberately NOT in the order a query returns

console.log("── TWO PAPERS, SAME SLUG, DIFFERENT SUBJECTS ──");
{
  // ⚠ THE CASE THE DEFECT GOT WRONG. No course supplied, several matches.
  const r = choosePaper(ALL_THREE);
  t("no course + 3 matches -> REFUSES, does not pick one", r.ok === false, r);
  t("...and the refusal is 'ambiguous', NOT 'not_found'",
    !r.ok && r.reason === "ambiguous", r);
  t("...and says how many it saw, so the log names the problem",
    !r.ok && r.reason === "ambiguous" && r.matches === 3, r);
}

console.log("\n── WITH THE COURSE, IT RETURNS THE RIGHT ONE — EVERY TIME ──");
{
  // Each subject asked for by name must get ITS OWN paper, from the same slug.
  for (const [course, expected] of [
    ["edexcel-ial-as-chemistry", "WCH11/01"],
    ["edexcel-ial-as-physics", "WPH11/01"],
    ["edexcel-ial-as-biology", "WBI11/01"],
  ] as const) {
    const r = choosePaper(ALL_THREE, course);
    t(`${course} -> ${expected}`,
      r.ok === true && r.paper.paper_code === expected,
      r.ok ? r.paper.paper_code : r);
  }

  // ⚠ DETERMINISM. The same inputs in a different order must give the same
  // answer — the old bug was an ORDER-DEPENDENT pick (order by year desc,
  // take the first), so an assertion that ignores order would not have caught
  // it. Every permutation, all three courses.
  const perms: Row[][] = [
    [CHEM, PHYS, BIO], [CHEM, BIO, PHYS], [PHYS, CHEM, BIO],
    [PHYS, BIO, CHEM], [BIO, CHEM, PHYS], [BIO, PHYS, CHEM],
  ];
  let stable = true;
  for (const perm of perms) {
    for (const [course, expected] of [
      ["edexcel-ial-as-chemistry", "WCH11/01"],
      ["edexcel-ial-as-physics", "WPH11/01"],
      ["edexcel-ial-as-biology", "WBI11/01"],
    ] as const) {
      const r = choosePaper(perm, course);
      if (!(r.ok && r.paper.paper_code === expected)) stable = false;
    }
  }
  t("all 6 row orderings x 3 courses -> 18/18 identical answers", stable);

  // And the ambiguous answer is order-independent too.
  t("the refusal is order-independent as well",
    perms.every((p) => { const r = choosePaper(p); return !r.ok && r.reason === "ambiguous"; }));
}

console.log("\n── A COURSE THAT DOES NOT HOLD THIS PAPER IS not_found ──");
{
  // ⚠ NOT 'ambiguous'. Three rows matched the slug, but none belongs to the
  // course asked for, so from that course's point of view the paper does not
  // exist. Reporting "ambiguous" here would send someone looking for a
  // disambiguator that cannot help them.
  const r = choosePaper(ALL_THREE, "edexcel-ial-as-maths");
  t("a course with no matching paper -> not_found", !r.ok && r.reason === "not_found", r);
}

console.log("\n── THE UNAMBIGUOUS CASES STILL WORK (ANTI-VACUITY) ──");
{
  // A rule that refused everything would pass every assertion above and take
  // the whole /past-papers section down.
  const one = choosePaper([CHEM]);
  t("a slug used by ONE course needs no disambiguation",
    one.ok === true && one.paper.paper_code === "WCH11/01", one);

  // An id lookup returns at most one row, so it is this same single-row path —
  // which is exactly why an id needs no course to resolve.
  const byId = choosePaper([BIO]);
  t("a single row (what an id lookup returns) resolves with no course",
    byId.ok === true && byId.paper.paper_code === "WBI11/01", byId);

  t("no rows at all -> not_found", (() => {
    const r = choosePaper([] as Row[]); return !r.ok && r.reason === "not_found";
  })());

  // A row whose course join came back null cannot be placed in a course, so it
  // is not a candidate at all.
  const orphan = choosePaper([{ paper_code: "WCH11/01", course: null }] as Row[]);
  t("a row with no course is not a candidate", !orphan.ok && orphan.reason === "not_found", orphan);
}

console.log("\n── A BROKEN UNIQUE INDEX IS REPORTED, NOT PAPERED OVER ──");
{
  // UNIQUE (course_id, slug) is supposed to make this impossible. If it ever
  // stops holding, picking one would hide it forever.
  const dup = choosePaper([CHEM, { ...CHEM }], "edexcel-ial-as-chemistry");
  t("two papers with one slug INSIDE one course -> refuses",
    dup.ok === false, dup);
  t("...and says the constraint is not holding, not 'ambiguous'",
    !dup.ok && dup.reason === "constraint_violated", dup);
}

console.log("\n── SABOTAGE: THE ORIGINAL DEFECT, REPRODUCED ──");
{
  // "order by year desc, take the first" — what the code used to do.
  const oldBehaviour = (rows: Row[]) => rows.filter((r) => r.course)[0] ?? null;

  const servedToABiologyStudent = oldBehaviour([CHEM, PHYS, BIO]);
  t("SABOTAGE — taking the first match hands a Biology link the Chemistry paper",
    servedToABiologyStudent?.paper_code === "WCH11/01",
    servedToABiologyStudent?.paper_code);
  t("...silently: it returns a paper, so nothing downstream can tell",
    servedToABiologyStudent !== null);

  // The same input through the real rule.
  const now = choosePaper([CHEM, PHYS, BIO]);
  t("...where the real rule refuses instead", now.ok === false);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
