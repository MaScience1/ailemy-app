/**
 * The chemical equation parser and marker.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/chemical-equation.test.ts
 *
 * ============================================================================
 * WRITTEN FROM WHAT STUDENTS ACTUALLY DO
 * ============================================================================
 * 20(b)(ii)'s examiner report says it outright: "many candidates were able to
 * balance but several lost the state symbol mark, with dodecane labelled as
 * (g), (s) and occasionally (aq)". So the cases below are not a tour of the
 * parser's features — they are unbalanced equations, missing state symbols,
 * wrong formulae, non-integer coefficients, equations written backwards,
 * subscripts typed as plain numbers, and unicode arrows and minus signs.
 *
 * The load-bearing assertion in most of them is not the total but the SPLIT:
 * an equation worth 2 marks must be able to take 1.
 */
import {
  parseEquation,
  parseSpecies,
  normalise,
  checkBalance,
  compareEquations,
  speciesKey,
  parseCoefficient,
  rational,
  rEq,
  markChemicalEquation,
  classifyPoint,
  acceptedStatesFrom,
  type EquationCriterion,
} from "../../../src/lib/exam/chemistry/equation.ts";
import { WCH11_01_2025_MAY_JUNE } from "../wch11-01-2025-may-june.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

// ── 20(b)(ii), READ OUT OF THE REAL FIXTURE ────────────────────────────────
//
// ⚠ NOT A COPY OF THE MARK SCHEME. An inline transcription would keep passing
// while the seeded scheme drifted underneath it, which is the failure this
// whole codebase keeps finding. The fixture is a data module whose only import
// is type-only, so `node` loads it directly.
const Q = WCH11_01_2025_MAY_JUNE.questions.find((q) => q.questionNumber === "20(b)(ii)");
if (!Q) throw new Error("20(b)(ii) is not in the fixture — this suite marks against it");
if (!Q.expectedAnswer) throw new Error("20(b)(ii) carries no expectedAnswer to mark against");
const EXPECTED = Q.expectedAnswer.value;
const SCHEME: EquationCriterion[] = (Q.markScheme ?? []).map((p) => ({
  pointCode: p.pointCode,
  criterion: p.criterion,
  accept: p.accept ?? null,
}));
const MAX = Q.marks;
const mark = (answer: string | null) =>
  markChemicalEquation({ answer, maxMarks: MAX, expectedEquation: EXPECTED, criteria: SCHEME });
const got = (r: ReturnType<typeof mark>, code: string) =>
  r.markable ? r.points.find((p) => p.pointCode === code) : undefined;
const scored = (r: ReturnType<typeof mark>) => (r.markable ? r.awarded : null);


console.log("── THE FIXTURE IS THE SOURCE OF TRUTH FOR THIS SUITE ──");
{
  t("20(b)(ii) is worth 2 marks", MAX === 2, MAX);
  t("...with two mark-scheme points", SCHEME.length === 2, SCHEME.map((c) => c.pointCode));
  t("...one for the equation, one for the states",
    SCHEME.map((c) => classifyPoint(c.criterion)).join(",") === "equation,states",
    SCHEME.map((c) => [c.pointCode, classifyPoint(c.criterion)]));
  t("...and an expected equation that itself parses", parseEquation(EXPECTED).ok, EXPECTED);
  t("...which is balanced", (() => { const e = parseEquation(EXPECTED); return e.ok && checkBalance(e.value).balanced; })());
  t("...and carries a state symbol on every species",
    (() => { const e = parseEquation(EXPECTED); return e.ok && [...e.value.left, ...e.value.right].every((x) => x.species.state !== null); })());
}

console.log("── NORMALISATION: the same answer typed six ways ──");
{
  const forms = [
    "C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)",
    "C12H26(l) + 18.5O2(g) → 12CO2(g) + 13H2O(l)",
    "C₁₂H₂₆(l) + 18.5O₂(g) → 12CO₂(g) + 13H₂O(l)",
    "C12H26 (l)  +  18.5 O2 (g)  ⟶  12 CO2 (g)  +  13 H2O (l)",
    "C12H26(L) + 18.5O2(G) --> 12CO2(G) + 13H2O(L)",
    "C12H26(l)+18.5O2(g)=>12CO2(g)+13H2O(l)",
  ];
  for (const [i, f] of forms.entries()) {
    const r = mark(f);
    t(`form ${i + 1} scores 2/2`, scored(r) === 2, r);
  }
}

console.log("\n── SUBSCRIPTS TYPED AS PLAIN NUMBERS (what a keyboard gives you) ──");
{
  const a = parseEquation("2H2 + O2 -> 2H2O");
  const b = parseEquation("2 H₂ + O₂ -> 2 H₂O");
  t("both parse", a.ok && b.ok);
  t("...to the same structure",
    a.ok && b.ok && JSON.stringify([...a.value.left[0].species.atoms]) ===
      JSON.stringify([...b.value.left[0].species.atoms]));
  t("...and both balance", a.ok && b.ok && checkBalance(a.value).balanced && checkBalance(b.value).balanced);
}

console.log("\n── UNICODE ARROWS AND MINUS SIGNS ──");
{
  for (const arrow of ["->", "→", "⟶", "-->", "=>", "⇒"]) {
    const r = parseEquation(`2H2 + O2 ${arrow} 2H2O`);
    t(`single arrow ${JSON.stringify(arrow)}`, r.ok && r.value.arrow === "single", r);
  }
  for (const arrow of ["<=>", "⇌", "<->", "↔", "⇄"]) {
    const r = parseEquation(`N2 + 3H2 ${arrow} 2NH3`);
    t(`reversible arrow ${JSON.stringify(arrow)}`, r.ok && r.value.arrow === "reversible", r);
  }
  // ⚠ A REVERSIBLE ARROW IS NOT A SINGLE ARROW. Combustion does not go both ways.
  const rev = mark("C12H26(l) + 18.5O2(g) ⇌ 12CO2(g) + 13H2O(l)");
  t("a reversible arrow loses the equation mark", got(rev, "M1")?.awarded === false, rev);
  t("...and says why", /single arrow/.test(got(rev, "M1")?.evidence ?? ""));
}
{
  // Unicode minus in a charge must not be read as a hyphen or dropped.
  const a = parseSpecies("SO4²⁻");
  const b = parseSpecies("SO4^2-");
  const c = parseSpecies("SO42-");
  t("unicode, caret and plain charge forms agree",
    a.ok && b.ok && c.ok && speciesKey(a.value) === speciesKey(b.value) &&
      speciesKey(b.value) === speciesKey(c.value),
    [a.ok && speciesKey(a.value), b.ok && speciesKey(b.value), c.ok && speciesKey(c.value)]);
  t("...with charge -2", a.ok && a.value.charge === -2, a.ok && a.value.charge);
  const fe = parseSpecies("Fe3+");
  t("Fe3+ is ONE iron with charge +3, not three irons",
    fe.ok && fe.value.atoms.get("Fe") === 1 && fe.value.charge === 3,
    fe.ok && [...fe.value.atoms, fe.value.charge]);
}

console.log("\n── UNBALANCED ──");
{
  const r = mark("C12H26(l) + O2(g) -> CO2(g) + H2O(l)");
  t("an unbalanced equation loses M1", got(r, "M1")?.awarded === false, r);
  t("...and names the elements that don't tally",
    /O \(|H \(|C \(/.test(got(r, "M1")?.evidence ?? ""), got(r, "M1")?.evidence);
  t("...and does NOT award the state mark for it either",
    got(r, "M2")?.awarded === false);
  t("...total 0 of 2", scored(r) === 0);
  // The state-symbol refusal must not read as a second, separate mistake.
  t("...state evidence points back at the equation",
    /until the equation itself is right/.test(got(r, "M2")?.evidence ?? ""), got(r, "M2")?.evidence);
}

console.log("\n── MISSING STATE SYMBOLS — the split this whole design exists for ──");
{
  const r = mark("C12H26 + 18.5O2 -> 12CO2 + 13H2O");
  t("M1 IS awarded: the equation is right", got(r, "M1")?.awarded === true, r);
  t("M2 is NOT: no state symbols", got(r, "M2")?.awarded === false);
  t("...scoring 1 of 2, not 0", scored(r) === 1, r);
  t("...and naming what is missing",
    /missing from/.test(got(r, "M2")?.evidence ?? ""), got(r, "M2")?.evidence);
}
{
  // The examiner's own observation: dodecane labelled (g).
  const r = mark("C12H26(g) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)");
  t("one wrong state costs only the state mark", scored(r) === 1, r);
  t("...M1 still awarded", got(r, "M1")?.awarded === true);
  t("...and the evidence names the substance and both states",
    /C12H26\(g\) is \(g\) but should be \(l\)/.test(got(r, "M2")?.evidence ?? ""),
    got(r, "M2")?.evidence);
}
{
  // "Accept 13H2O(g)" — water is correct either way.
  const r = mark("C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(g)");
  t("water as (g) is accepted, per the scheme's accept[]", scored(r) === 2, r);
  const allowed = acceptedStatesFrom(SCHEME);
  const waterKey = speciesKey((parseSpecies("H2O") as { ok: true; value: never }).value ?? ({} as never));
  t("...because acceptedStatesFrom read it out of the prose",
    (allowed.get(waterKey) ?? []).includes("g"), [...allowed]);
}

console.log("\n── WRONG FORMULA ──");
{
  const r = mark("C12H26(l) + 18.5O2(g) -> 12CO(g) + 13H2O(l)");
  t("carbon monoxide instead of dioxide loses M1", got(r, "M1")?.awarded === false, r);
  t("...0 of 2", scored(r) === 0);
}
{
  const r = mark("C12H24(l) + 18O2(g) -> 12CO2(g) + 12H2O(l)");
  t("a wrong hydrocarbon that happens to balance still loses M1",
    got(r, "M1")?.awarded === false, r);
  t("...and says it isn't the expected reaction",
    /isn't the expected reaction/.test(got(r, "M1")?.evidence ?? ""), got(r, "M1")?.evidence);
}

console.log("\n── NON-INTEGER COEFFICIENTS, AND MULTIPLES ──");
{
  t("18.5 and 37/2 are the same coefficient",
    rEq(parseCoefficient("18.5")!, parseCoefficient("37/2")!));
  const half = mark("C12H26(l) + 37/2O2(g) -> 12CO2(g) + 13H2O(l)");
  t("a fraction coefficient scores 2/2", scored(half) === 2, half);

  // ⚠ "Allow multiples" is the scheme's own wording.
  const doubled = mark("2C12H26(l) + 37O2(g) -> 24CO2(g) + 26H2O(l)");
  t("the doubled all-integer form scores 2/2", scored(doubled) === 2, doubled);
  t("...and the evidence says it is a multiple",
    /valid multiple/.test(got(doubled, "M1")?.evidence ?? ""), got(doubled, "M1")?.evidence);

  const tripled = mark("3C12H26(l) + 55.5O2(g) -> 36CO2(g) + 39H2O(l)");
  t("×3 also scores 2/2", scored(tripled) === 2, tripled);

  // A "multiple" that isn't one: only some coefficients scaled.
  const bogus = mark("2C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)");
  t("scaling only one species is NOT a multiple", got(bogus, "M1")?.awarded === false, bogus);
  t("...and it is caught as unbalanced, which it is",
    /isn't balanced/.test(got(bogus, "M1")?.evidence ?? ""), got(bogus, "M1")?.evidence);
}
{
  // Where a scheme demands whole numbers, a half coefficient must NOT pass.
  const strict: EquationCriterion[] = [
    { pointCode: "M1", criterion: "balanced equation using the smallest whole number coefficients", accept: [] },
  ];
  const r = markChemicalEquation({
    answer: "C12H26 + 18.5O2 -> 12CO2 + 13H2O", maxMarks: 1,
    expectedEquation: "2C12H26 + 37O2 -> 24CO2 + 26H2O", criteria: strict,
  });
  t("a half coefficient fails a whole-number-only point", scored(r) === 0, r);
  const ok = markChemicalEquation({
    answer: "2C12H26 + 37O2 -> 24CO2 + 26H2O", maxMarks: 1,
    expectedEquation: "2C12H26 + 37O2 -> 24CO2 + 26H2O", criteria: strict,
  });
  t("...and the whole-number form passes it", scored(ok) === 1, ok);
}

console.log("\n── WRITTEN BACKWARDS ──");
{
  const r = mark("12CO2(g) + 13H2O(l) -> C12H26(l) + 18.5O2(g)");
  t("a correct equation written backwards loses M1", got(r, "M1")?.awarded === false, r);
  t("...and is told so specifically, not just 'wrong'",
    /wrong way round/.test(got(r, "M1")?.evidence ?? ""), got(r, "M1")?.evidence);
  t("...0 of 2", scored(r) === 0);
  // It balances perfectly — which is exactly why balance alone cannot mark this.
  const eq = parseEquation("12CO2 + 13H2O -> C12H26 + 18.5O2");
  t("...even though it balances atom for atom", eq.ok && checkBalance(eq.value).balanced);
}

console.log("\n── BLANK, AND UNREADABLE ──");
{
  const blank = mark("");
  t("a blank answer is a real zero, not 'unmarkable'", blank.markable === true && blank.awarded === 0, blank);
  t("...with every point explicitly refused",
    blank.markable && blank.points.length === 2 && blank.points.every((p) => !p.awarded));
  const nullish = mark(null);
  t("null behaves the same", scored(nullish) === 0);
}
{
  const r = mark("dodecane burns in oxygen to make carbon dioxide and water");
  t("prose is UNMARKABLE, never a zero", r.markable === false, r);
  t("...and says a human will look",
    !r.markable && /human/.test(r.reason), !r.markable ? r.reason : "");
}
{
  const r = mark("C12H26(l) + 18.5O2(g)");
  t("no arrow is unmarkable", r.markable === false && /arrow/.test(r.reason), r);
}
{
  const r = mark("C12H26(l) + 18.5Zz(g) -> 12CO2(g) + 13H2O(l)");
  t("an invented element symbol is unmarkable, not zero", r.markable === false, r);
}

console.log("\n── THE MARK SCHEME ITSELF MUST BE LEGIBLE, OR NOTHING IS MARKED ──");
{
  t("'correctly balanced equation' -> equation", classifyPoint("correctly balanced equation") === "equation");
  t("'state symbols correct' -> states", classifyPoint("state symbols correct") === "states");
  t("'correct formulae of reactants' -> equation", classifyPoint("correct formulae of reactants") === "equation");
  t("prose that says neither -> null", classifyPoint("award for a sensible attempt") === null);

  const opaque: EquationCriterion[] = [{ pointCode: "M1", criterion: "award for a sensible attempt" }];
  const r = markChemicalEquation({
    answer: "2H2 + O2 -> 2H2O", maxMarks: 1, expectedEquation: "2H2 + O2 -> 2H2O", criteria: opaque,
  });
  t("an unclassifiable point makes the QUESTION unmarkable", r.markable === false, r);
  t("...naming the point so a human can fix it",
    !r.markable && /M1/.test(r.reason), !r.markable ? r.reason : "");
  // ⚠ It must never fall back to point ORDER. That would award the state mark
  // for balancing on any scheme whose wording it did not recognise.
}
{
  const two: EquationCriterion[] = [
    { pointCode: "M1", criterion: "balanced equation" },
    { pointCode: "M2", criterion: "correct equation" },
  ];
  const r = markChemicalEquation({
    answer: "2H2 + O2 -> 2H2O", maxMarks: 2, expectedEquation: "2H2 + O2 -> 2H2O", criteria: two,
  });
  t("two equation points is refused rather than guessed at", r.markable === false, r);
}
{
  const r = markChemicalEquation({
    answer: "2H2 + O2 -> 2H2O", maxMarks: 2, expectedEquation: null, criteria: SCHEME,
  });
  t("no transcribed answer is OUR backlog, and says so",
    r.markable === false && /hasn't been set up/.test(r.reason), r);
}

console.log("\n── IONIC EQUATIONS: CHARGE IS PART OF BALANCING ──");
{
  const ok = parseEquation("Ag+ (aq) + Cl- (aq) -> AgCl(s)");
  t("an ionic equation parses", ok.ok, ok);
  t("...and balances, charge included", ok.ok && checkBalance(ok.value).balanced && checkBalance(ok.value).chargeBalanced);
  const bad = parseEquation("Ag+ (aq) + Cl- (aq) -> AgCl+ (s)");
  t("charge imbalance is detected", bad.ok && checkBalance(bad.value).chargeBalanced === false, bad);
}
{
  // `Na+ + Cl-` must be two terms, not three.
  const r = parseEquation("Na+ + Cl- -> NaCl");
  t("a charge '+' is not a term separator", r.ok && r.value.left.length === 2, r.ok && r.value.left.length);
}

console.log("\n── FORMULA SHAPES ──");
{
  const brackets = parseSpecies("Ca(OH)2");
  t("Ca(OH)2 is 1 Ca, 2 O, 2 H",
    brackets.ok && brackets.value.atoms.get("Ca") === 1 &&
      brackets.value.atoms.get("O") === 2 && brackets.value.atoms.get("H") === 2,
    brackets.ok && [...brackets.value.atoms]);
  const nested = parseSpecies("Al2(SO4)3");
  t("Al2(SO4)3 is 2 Al, 3 S, 12 O",
    nested.ok && nested.value.atoms.get("Al") === 2 &&
      nested.value.atoms.get("S") === 3 && nested.value.atoms.get("O") === 12,
    nested.ok && [...nested.value.atoms]);
  const hydrate = parseSpecies("CuSO4.5H2O");
  t("CuSO4.5H2O carries 9 oxygens and 10 hydrogens",
    hydrate.ok && hydrate.value.atoms.get("O") === 9 && hydrate.value.atoms.get("H") === 10,
    hydrate.ok && [...hydrate.value.atoms]);
  t("...and the · form agrees",
    (() => {
      const dot = parseSpecies(normalise("CuSO4·5H2O"));
      return dot.ok && hydrate.ok && speciesKey(dot.value) === speciesKey(hydrate.value);
    })());
  t("(aq) is a state, not a group",
    (() => { const s = parseSpecies("NaCl(aq)"); return s.ok && s.value.state === "aq" && s.value.atoms.size === 2; })());
}

console.log("\n── STATE SYMBOLS ARE NOT PART OF SPECIES IDENTITY ──");
{
  const a = parseSpecies("H2O(l)");
  const b = parseSpecies("H2O(g)");
  t("water is water whatever its state",
    a.ok && b.ok && speciesKey(a.value) === speciesKey(b.value));
  // Which is why the equation mark can be earned with the states all wrong.
  const r = mark("C12H26(aq) + 18.5O2(s) -> 12CO2(aq) + 13H2O(s)");
  t("every state wrong still earns M1", got(r, "M1")?.awarded === true, r);
  t("...and loses M2", got(r, "M2")?.awarded === false);
  t("...1 of 2", scored(r) === 1);
}

console.log("\n── EVIDENCE MUST NOT LEAK THE MARK SCHEME ──");
{
  // The boundary: the correct ANSWER may be shown after submission; criterion
  // text, accept[] wording and guidance prose never may.
  const answers = [
    "", "C12H26 + 18.5O2 -> 12CO2 + 13H2O", "C12H26(g) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)",
    "12CO2(g) + 13H2O(l) -> C12H26(l) + 18.5O2(g)", "C12H26(l) + O2(g) -> CO2(g) + H2O(l)",
  ];
  const banned = ["correctly balanced equation", "state symbols correct", "Allow multiples", "Accept 13H2O(g)"];
  let leaks = 0;
  for (const a of answers) {
    const r = mark(a);
    if (!r.markable) continue;
    for (const p of r.points) for (const b of banned) if (p.evidence.includes(b)) leaks++;
  }
  t("no criterion or accept[] wording appears in any evidence string", leaks === 0, leaks);
}

console.log("\n── DETERMINISM ──");
{
  const a = JSON.stringify(mark("C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)"));
  const b = JSON.stringify(mark("C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)"));
  t("the same answer marks identically every time", a === b);
  t("...and a multiple gives the same MARKS as the canonical form",
    scored(mark("2C12H26(l) + 37O2(g) -> 24CO2(g) + 26H2O(l)")) ===
      scored(mark("C12H26(l) + 18.5O2(g) -> 12CO2(g) + 13H2O(l)")));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
