/**
 * The homepage demo must not over-credit, and must not pretend to be the engine.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/try-sample.test.ts
 *
 * ============================================================================
 * ⚠ A DEMO THAT FLATTERS IS WORSE THAN NO DEMO
 * ============================================================================
 * This is keyword matching over a fixed mark scheme — the controlled fallback
 * the brief offers, because AI marking is audit-gated (200-response, ≥90%,
 * human-countersigned) and none of that has happened, and because the WCH11/01
 * mark-scheme seed has not landed.
 *
 * The failure to guard against is over-crediting. A visitor who types
 * "the reaction is more frequent" and is awarded a collision-theory mark has
 * been taught that Ailemy marks generously, which is the opposite of the
 * product's claim — and they will believe it until a real paper says otherwise.
 */
import { markSample, SAMPLE } from "../../../src/lib/home/try-sample.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

console.log("\n=== 1. the full-mark answer earns both ===");
{
  const r = markSample(
    "When you heat it the particles gain kinetic energy and move faster so they collide more often. " +
    "Also a greater proportion of collisions have energy above the activation energy so more are successful.",
  );
  t("2 / 2", r.awarded === 2 && r.outOf === 2, `${r.awarded}/${r.outOf}`);
  t("⚠ and EVERY awarded point names the phrase that earned it",
    r.points.every((p) => !p.awarded || p.evidence.length > 0),
    JSON.stringify(r.points.map((p) => [p.code, p.evidence])));
  t("no improvement text on an earned point",
    r.points.every((p) => !p.awarded || p.improve === ""), "ok");
}

console.log("\n=== 2. ⚠ THE HALF ANSWER — the one students actually write ===");
{
  const r = markSample("The particles move faster so they collide more often.");
  t("1 / 2 — the collision-frequency mark only", r.awarded === 1, `${r.awarded}/2`);
  t("MP1 awarded", r.points[0].awarded, r.points[0].evidence);
  t("⚠ MP2 REFUSED — the energy mark is not implied by the frequency mark",
    !r.points[1].awarded, r.points[1].evidence);
  t("…and the guidance explains what is missing, not that they were wrong",
    /activation energy/i.test(r.points[1].improve), r.points[1].improve.slice(0, 60));
}

console.log("\n=== 3. ⚠ NO OVER-CREDITING ON A NEAR-MISS ===");
{
  // The trap: contains "more frequent" but says nothing about collisions.
  const r = markSample("Increasing temperature makes the reaction more frequent and it finishes sooner.");
  t("⚠ 'more frequent' WITHOUT 'collision' earns nothing — every term in a clause is required",
    r.points[0].awarded === false, r.points[0].evidence);
  t("…and the total reflects it", r.awarded === 0, r.awarded);
}

console.log("\n=== 4. alternatives are accepted, as a real scheme does ===");
{
  for (const phrasing of [
    "particles gain kinetic energy",
    "the molecules move faster",
    "there are more collisions per second",
  ]) {
    const r = markSample(`${phrasing}, which speeds everything up considerably.`);
    t(`MP1 accepts "${phrasing}"`, r.points[0].awarded, r.points[0].evidence);
  }
  for (const phrasing of [
    "more particles have enough energy to react",
    "a greater proportion have energy above the barrier",
    "there are more successful collisions",
  ]) {
    const r = markSample(`${phrasing}, so the rate goes up.`);
    t(`MP2 accepts "${phrasing}"`, r.points[1].awarded, r.points[1].evidence);
  }
}

console.log("\n=== 5. ⚠ AN EMPTY BOX IS NOT 0 / 2 ===");
{
  const r = markSample("   ");
  t("refuses to mark rather than scoring zero", r.tooShort, JSON.stringify(r));
  t("⚠ …and shows no improvement guidance either — there is nothing to improve on",
    r.points.every((p) => p.improve === ""), "ok");
  t("a token answer is also refused", markSample("idk").tooShort, "ok");

  // CONTROL — a real answer IS marked, so §5 is not a function that always refuses.
  t("CONTROL — a genuine attempt is marked",
    markSample("the particles move faster and collide more often").tooShort === false, "ok");
}

console.log("\n=== 6. the question is what it claims to be ===");
{
  t("2 marks, and the scheme has exactly 2 points",
    SAMPLE.marks === 2 && SAMPLE.scheme.length === 2, `${SAMPLE.marks} / ${SAMPLE.scheme.length}`);
  t("⚠ the awarded total can never exceed the tariff",
    markSample("kinetic energy, collide more often, activation energy, successful collisions").awarded <= SAMPLE.marks,
    markSample("kinetic energy activation energy successful collision").awarded);
  t("it carries a command word and a topic, as a real question does",
    SAMPLE.commandWord.length > 0 && SAMPLE.topic.length > 0, `${SAMPLE.commandWord} / ${SAMPLE.topic}`);
}

console.log("\n=== 7. punctuation and case do not decide a mark ===");
{
  const a = markSample("KINETIC ENERGY!!! They COLLIDE MORE OFTEN.");
  t("shouting still earns MP1", a.points[0].awarded, a.points[0].evidence);
  const b = markSample("particles  gain   kinetic\nenergy");
  t("odd whitespace still earns MP1", b.points[0].awarded, b.points[0].evidence);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
