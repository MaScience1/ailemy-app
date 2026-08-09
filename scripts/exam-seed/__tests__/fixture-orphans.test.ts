/**
 * Fixture orphans — a row the fixture stopped claiming must still be found.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/fixture-orphans.test.ts
 *
 * The defect this guards: the seeder writes mark_scheme_items and
 * question_expected_answers by UPSERT, which adds and overwrites but never
 * removes. Deleting a point from a fixture therefore left it in the database,
 * still being awarded by Tier 1 marking, while the run printed the same
 * "N point(s) upserted" it prints on a clean pass.
 *
 * Written both ways round on purpose: the healthy fixture must produce NO
 * warning, because a check that fires on a correct run is a check that gets
 * ignored — and this one is about to be read on every seed. For the same
 * reason the WORDING is tested as tightly as the detection: a report that
 * overstates what happens to an orphan, or that describes a dry run as damage
 * already done, teaches the same skimming habit as a false positive.
 */
import {
  findFixtureOrphans,
  describeFixtureOrphans,
  hasFixtureOrphans,
  type FixtureQuestionClaim,
  type StoredPoint,
} from "../../../src/lib/exam/fixture-orphans.ts";
// Imported rather than hand-mapped: the point of the tier tests is that the
// report agrees with what marking ACTUALLY does, so a copy here would pass
// while the real mapping drifted.
import { tierFor } from "../../../src/lib/exam/deterministic.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const throws = (n: string, fn: () => unknown, match: RegExp) => {
  try { fn(); t(n, false, "did not throw"); }
  catch (e) { t(n, match.test(e instanceof Error ? e.message : String(e)), String(e)); }
};

// numeric -> deterministic (Tier 1), long_text -> ai (Tier 2), graph -> unmarkable.
const claim = (
  questionNumber: string,
  pointCodes: string[],
  hasExpectedAnswer = false,
  answerType = "numeric",
): FixtureQuestionClaim => ({
  questionNumber, answerType, tier: tierFor(answerType), pointCodes, hasExpectedAnswer,
});

let seq = 0;
const point = (
  questionNumber: string,
  pointCode: string,
  displayOrder: number,
  criterion = "some criterion",
): StoredPoint => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  questionNumber, pointCode, displayOrder, criterion,
});
const expected = (questionNumber: string, expectedValue: string | null) => ({
  id: `11111111-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  questionNumber, expectedValue,
});

console.log("── THE REAL CASE: a point deleted from the fixture is still in the database ──");
{
  // The examiner's scheme is re-read, A2 is found to be wrong, and the fixture
  // is edited down to M1, M2, A1. The upsert cannot remove A2.
  const stale = point("5(b)", "A2", 3, "allow ions move");
  const r = findFixtureOrphans({
    claims: [claim("5(b)", ["M1", "M2", "A1"])],
    storedPoints: [point("5(b)", "M1", 0), point("5(b)", "M2", 1), point("5(b)", "A1", 2), stale],
    storedExpectedAnswers: [],
  });
  t("caught", r.points.length === 1, r.points);
  t("...names the point code", r.points[0]?.pointCode === "A2");
  t("...names the question", r.points[0]?.questionNumber === "5(b)");
  t("...carries the criterion, so the reader can judge it",
    r.points[0]?.criterion === "allow ions move");
  t("...carries the PRIMARY KEY, because the report says 'delete by id'",
    r.points[0]?.id === stale.id, r.points[0]?.id);
  t("hasFixtureOrphans agrees", hasFixtureOrphans(r));
}

console.log("\n── THE HEALTHY FIXTURE MUST BE SILENT (the cry-wolf guard) ──");
{
  const r = findFixtureOrphans({
    claims: [claim("1", ["M1"], true, "mcq"), claim("20", [], false, "other"),
             claim("20(a)", ["M1", "M2", "M3", "M4"], true)],
    storedPoints: [
      point("1", "M1", 0),
      point("20(a)", "M1", 0), point("20(a)", "M2", 1),
      point("20(a)", "M3", 2), point("20(a)", "M4", 3),
    ],
    storedExpectedAnswers: [expected("1", "B"), expected("20(a)", "0.0172")],
  });
  t("no orphan points", r.points.length === 0, r.points);
  t("no orphan expected answers", r.expectedAnswers.length === 0, r.expectedAnswers);
  t("hasFixtureOrphans is false", !hasFixtureOrphans(r));
  t("describe says nothing at all", describeFixtureOrphans(r, "planned").length === 0);
  t("...in either tense", describeFixtureOrphans(r, "written").length === 0);
  t("a container with no mark scheme and no stored points is not an orphan",
    r.points.every((p) => p.questionNumber !== "20"));
}

console.log("\n── SCOPE: rows under a question the fixture does not own are NOT counted here ──");
{
  // Question 7 is not in the fixture at all. It is already reported as an
  // orphan QUESTION; re-reporting each of its points would bury the real ones.
  const r = findFixtureOrphans({
    claims: [claim("1", ["M1"])],
    storedPoints: [point("1", "M1", 0), point("7", "M1", 0), point("7", "M2", 1)],
    storedExpectedAnswers: [expected("7", "42")],
  });
  t("the points under question 7 are not listed", r.points.length === 0, r.points);
  t("nor its expected answer", r.expectedAnswers.length === 0, r.expectedAnswers);
}

console.log("\n── A QUESTION THAT LOST ITS WHOLE MARK SCHEME ──");
{
  const r = findFixtureOrphans({
    claims: [claim("5(b)", [])],
    storedPoints: [point("5(b)", "M1", 0), point("5(b)", "M2", 1)],
    storedExpectedAnswers: [],
  });
  t("both points are orphans", r.points.length === 2, r.points);
  t("neither collides on display_order — the fixture writes nothing",
    r.points.every((p) => !p.collidesOnDisplayOrder), r.points);
}

console.log("\n── THE CONSEQUENCE MUST MATCH THE ANSWER TYPE, NOT BE ASSUMED ──");
{
  // The first draft led with "TIER 1 WILL GO ON AWARDING THEM" for every
  // orphan. tierFor() returns "unmarkable" for graph/structure/etc, and
  // marking.ts returns points: [] for those before it reads any criterion —
  // so on the real fixture that claim was false for 10 of 25 points.
  const r = findFixtureOrphans({
    claims: [claim("20(a)", [], false, "numeric"),
             claim("23(c)(ii)", [], false, "long_text"),
             claim("21(c)(i)", [], false, "graph")],
    storedPoints: [
      point("20(a)", "M4", 0), point("23(c)(ii)", "M2", 0), point("21(c)(i)", "M3", 0),
    ],
    storedExpectedAnswers: [],
  });
  const tier = (q: string) => r.points.find((p) => p.questionNumber === q)?.tier;
  t("numeric   -> deterministic", tier("20(a)") === "deterministic", tier("20(a)"));
  t("long_text -> ai", tier("23(c)(ii)") === "ai", tier("23(c)(ii)"));
  t("graph     -> unmarkable", tier("21(c)(i)") === "unmarkable", tier("21(c)(i)"));

  const text = describeFixtureOrphans(r, "written").join("\n");
  t("the marked ones are grouped as still being awarded",
    /2 on a question that IS marked/.test(text), text);
  t("the unmarkable one is NOT claimed to be awarded",
    /1 on an answer_type with no marking tier/.test(text));
  t("...and is still reported, because it is the stored mark scheme",
    text.includes("21(c)(i)") && /start being awarded the day the type is wired up/.test(text));
}
{
  // All three unmarkable: the report must not claim ANYTHING is being awarded.
  const r = findFixtureOrphans({
    claims: [claim("21(c)(i)", [], false, "graph")],
    storedPoints: [point("21(c)(i)", "M3", 0)],
    storedExpectedAnswers: [],
  });
  const text = describeFixtureOrphans(r, "written").join("\n");
  t("no 'IS marked' group when nothing is marked", !/IS marked/.test(text), text);
  t("still reported at all", hasFixtureOrphans(r));
}

console.log("\n── DISPLAY_ORDER COLLISION: dropping a point renumbers the survivors ──");
{
  // Fixture keeps 3 points, so it writes display_order 0,1,2. The orphan sat at
  // 1, which a surviving point now also holds.
  const r = findFixtureOrphans({
    claims: [claim("5(b)", ["M1", "M2", "A1"])],
    storedPoints: [
      point("5(b)", "M1", 0), point("5(b)", "MX", 1),
      point("5(b)", "M2", 2), point("5(b)", "A1", 3),
    ],
    storedExpectedAnswers: [],
  });
  t("the orphan is MX", r.points.length === 1 && r.points[0].pointCode === "MX", r.points);
  t("...and it is flagged as colliding", r.points[0]?.collidesOnDisplayOrder === true);

  // ⚠ TENSE. The duplication is created BY THE WRITE. On a dry run it has not
  // happened and declining to commit prevents it.
  const planned = describeFixtureOrphans(r, "planned").join("\n");
  const written = describeFixtureOrphans(r, "written").join("\n");
  t("a dry run says it WOULD happen", /WILL BE DUPLICATED BY THIS WRITE/.test(planned), planned);
  t("...and never asserts it already has", !/NOW DUPLICATED/.test(planned));
  t("...and does not claim the order is undetermined yet",
    /would then be undetermined/.test(planned) && !/order is undetermined/.test(planned));
  t("after the write it says it HAS", /NOW DUPLICATED/.test(written), written);
  t("...and that the order is undetermined", /order is undetermined/.test(written));
}
{
  // An orphan BEYOND the fixture's range does not collide.
  const r = findFixtureOrphans({
    claims: [claim("5(b)", ["M1", "M2"])],
    storedPoints: [point("5(b)", "M1", 0), point("5(b)", "M2", 1), point("5(b)", "MZ", 2)],
    storedExpectedAnswers: [],
  });
  t("an orphan past the end does not collide",
    r.points.length === 1 && r.points[0].collidesOnDisplayOrder === false, r.points);
  t("...and neither tense claims it does",
    !/DUPLICATED/.test(describeFixtureOrphans(r, "planned").join("\n")) &&
    !/DUPLICATED/.test(describeFixtureOrphans(r, "written").join("\n")));
}

console.log("\n── EXPECTED ANSWERS: the same gap on the deterministic-marking table ──");
{
  const row = expected("22(c)", "3.591");
  const r = findFixtureOrphans({
    claims: [claim("22(c)", ["M1"], false, "numeric")],
    storedPoints: [point("22(c)", "M1", 0)],
    storedExpectedAnswers: [row],
  });
  t("caught", r.expectedAnswers.length === 1, r.expectedAnswers);
  t("...names the question", r.expectedAnswers[0]?.questionNumber === "22(c)");
  t("...quotes the value still in force", r.expectedAnswers[0]?.expectedValue === "3.591");
  t("...carries the id", r.expectedAnswers[0]?.id === row.id);
  t("the mark scheme is clean, so no point is reported", r.points.length === 0);
  t("says deterministic marking reads it",
    /Deterministic marking reads this table/.test(describeFixtureOrphans(r, "written").join("\n")));
}
{
  // An expectedAnswer on an unmarkable question: nothing reads it, and the
  // report must not say otherwise.
  const r = findFixtureOrphans({
    claims: [claim("21(c)(i)", [], false, "graph")],
    storedPoints: [],
    storedExpectedAnswers: [expected("21(c)(i)", "7.2")],
  });
  const text = describeFixtureOrphans(r, "written").join("\n");
  t("reported", r.expectedAnswers.length === 1);
  t("...but not claimed to be in force",
    /Nothing marks this answer_type today/.test(text) &&
    !/Deterministic marking reads this table/.test(text), text);
}
{
  const r = findFixtureOrphans({
    claims: [claim("22(c)", [], false)],
    storedPoints: [],
    storedExpectedAnswers: [expected("22(c)", null)],
  });
  t("a NULL expected_value is still an orphan row", r.expectedAnswers.length === 1);
}

console.log("\n── THE WARNING MUST BE ACTIONABLE, AND ITS INSTRUCTION MUST BE FOLLOWABLE ──");
{
  const stale = point("1(a)", "M2", 5, "allow ions move");
  const r = findFixtureOrphans({
    claims: [claim("1(a)", ["M1"])],
    storedPoints: [stale],
    storedExpectedAnswers: [],
  });
  const text = describeFixtureOrphans(r, "written").join("\n");
  // ⚠ The report tells a person to delete by id, so it has to PRINT one.
  // question_number is unique per paper: "delete WHERE question_number='1(a)'
  // AND point_code='M2'" would hit every paper in the corpus.
  t("prints the primary key", text.includes(stale.id), text);
  t("says to delete BY THAT id", /delete them BY THE id ABOVE/.test(text));
  t("warns that question_number is not unique across papers",
    /unique per paper, not across/.test(text));
  t("says they were left alone", /LEFT ALONE/.test(text));
  t("refuses to guess", /will not guess/.test(text));
}
{
  const long = "Correct answer with no working scores full marks provided the ".repeat(3);
  const r = findFixtureOrphans({
    claims: [claim("5(b)", [])],
    storedPoints: [point("5(b)", "A2", 0, long)],
    storedExpectedAnswers: [],
  });
  const text = describeFixtureOrphans(r, "written").join("\n");
  t("truncates rather than printing 180 characters", !text.includes(long));
  t("...but keeps the opening words", text.includes("Correct answer with no working"));
}

console.log("\n── A DUPLICATE CLAIM IS A CALLER BUG, NOT A SILENT MERGE ──");
{
  // Last-write-wins would consult only the second entry's point codes and
  // misreport in both directions. The seeder's validator rejects duplicates
  // first, but this is exported as a general-purpose function.
  throws("duplicate questionNumber throws",
    () => findFixtureOrphans({
      claims: [claim("5(b)", ["M1", "M2"]), claim("5(b)", ["M3"])],
      storedPoints: [point("5(b)", "M1", 0)],
      storedExpectedAnswers: [],
    }),
    /duplicate questionNumber/);
}

console.log("\n── EMPTY INPUTS ──");
{
  const r = findFixtureOrphans({ claims: [], storedPoints: [], storedExpectedAnswers: [] });
  t("nothing in, nothing out",
    !hasFixtureOrphans(r) && describeFixtureOrphans(r, "planned").length === 0);
}
{
  const r = findFixtureOrphans({
    claims: [claim("1", ["M1"], true), claim("2", ["M1"], true)],
    storedPoints: [], storedExpectedAnswers: [],
  });
  t("a first seed reports no orphans", !hasFixtureOrphans(r));
}

console.log("\n── ORDERING: the report is stable, so two runs diff cleanly ──");
{
  const r = findFixtureOrphans({
    claims: [claim("20(a)", []), claim("1", [])],
    storedPoints: [point("20(a)", "M2", 1), point("1", "M1", 0), point("20(a)", "M1", 0)],
    storedExpectedAnswers: [],
  });
  t("sorted by question then point code",
    r.points.map((p) => `${p.questionNumber}/${p.pointCode}`).join(" ") ===
      "1/M1 20(a)/M1 20(a)/M2",
    r.points.map((p) => `${p.questionNumber}/${p.pointCode}`));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
