import { pick, shuffle, type Family } from "../engine.ts";

/**
 * Question families for Lesson 4 — Solution Concentration (§33).
 *
 * ============================================================================
 * ⚠ EVERY FACT BELOW IS IN THE DECK, AND THE TESTS CHECK THAT MECHANICALLY
 * ============================================================================
 * The definition is the deck's own DEFINITION text: "Concentration is the
 * amount of solute per unit volume of solution" (s6, echoed s1/s27), measured
 * as how "densely the solute is packed" (s4/s25). The formulae are the deck's:
 * c = n / V and c = m / V (s6), the volume rule 1 dm³ = 1000 cm³ / divide by
 * 1000 (s7), the bridge c (g dm⁻³) = c (mol dm⁻³) × M (s11), m = c × V × M
 * for standard solutions (s14/s15), and c₁V₁ = c₂V₂ for dilution (s16). Every
 * parameter bank holds only values the deck itself displays: moles 0.05 /
 * 0.10 / 0.20 / 0.50 (s2, s8–s10), volumes 2.0 and 5.0 dm³ (s8, s10) and 25 /
 * 50 / 100 / 250 / 500 / 1000 cm³ (s7, s9, s10, s16–s20, s22), concentrations
 * 0.10–2.0 mol dm⁻³ (s6, s13, s16, s17, s20), the dilution pairs 50→250,
 * 25→250, 100→1000 and 250→600 exactly as the deck performs them (s16, s17,
 * s20), and M(NaCl) = 58.5, M(NaOH) = 40.0, M(HCl) = 36.5 g mol⁻¹ (s11, s12,
 * s24). Each family's groundingTerms are checked against the extracted deck
 * text at serve time AND in the suite — a term the deck never shows makes the
 * family unservable (§100).
 *
 * ⚠ THE DISTRACTORS ARE THE DECK'S OWN MISTAKES (§38). Leaving V in cm³ —
 * s9's named COMMON ERROR, s19's Student A, "wrong by factor of 1000" (s7).
 * Skipping "Always convert volume to dm³ first" (s14, s23). Running the
 * M-bridge backwards — s11's EXAM TRAP spells out both directions. Stopping
 * at n = c × V without the ×M step (s15's step 4 is m = n × M). An inverted
 * V₂/V₁ ratio that makes a diluted solution MORE concentrated — against s16's
 * "volume increased 5×, concentration ÷5" and s21/s24's COMMON MISTAKE that
 * dilution conserves moles. Where the deck names the misconception, wrongWhy
 * repeats the deck's teaching; where it does not, wrongWhy stays silent
 * rather than inventing feedback (§39, §51).
 *
 * ⚠ verify() RE-DERIVES FROM THE RENDERED STRINGS. It parses the quantities
 * back out of the stem and the labelled-correct option text and recomputes
 * with its own arithmetic — so a mislabelled option, a broken formatter, or
 * a generate() bug all surface as "derivations disagree" and the variant is
 * refused at birth (§101).
 */

const SLUG = "solution-concentration";

const sf3 = (x: number) => Number(x.toPrecision(3));

/** Draw until the four option strings are distinct — the exemplar's
 *  distinct4 pattern (bounded, deterministic; the banks below make
 *  collisions rare, this makes them impossible to serve). */
function distinct4<T>(r: () => number, draw: (r: () => number) => T & { options: string[] }): T {
  for (let i = 0; i < 12; i++) {
    const q = draw(r);
    if (new Set(q.options).size === 4) return q;
  }
  throw new Error("could not draw 4 distinct options — parameter ranges too tight");
}

// ── the deck's own value banks ──────────────────────────────────────────────

// Solutes with the M values the deck itself displays (s11, s12/s15, s24).
const SOLUTES = [
  { name: "NaCl", M: 58.5, slide: 11 },
  { name: "NaOH", M: 40.0, slide: 12 },
  { name: "HCl", M: 36.5, slide: 24 },
] as const;

// Concentrations in mol dm⁻³ the deck shows (s6, s13, s16, s17).
const CONCS = [0.10, 0.20, 0.50, 1.0, 2.0] as const;

// Dilutions exactly as the deck performs them (s16 WE1, s17 WE1+WE2, s20 Q2).
const DILUTIONS = [
  { v1: 50, v2: 250, slide: 16 },
  { v1: 25, v2: 250, slide: 17 },
  { v1: 100, v2: 1000, slide: 17 },
  { v1: 250, v2: 600, slide: 20 },
] as const;

// Slide 6/7/11's unit landscape — each description is the deck's own wording.
type UnitCase = {
  desc: string;
  answer: string;
  slide: number;
  wrong: Partial<Record<string, string>>;
};
const UNITS = ["mol dm⁻³", "g dm⁻³", "g mol⁻¹", "mol cm⁻³"] as const;
const UNIT_CASES: readonly UnitCase[] = [
  {
    desc: "mass of solute per dm³ of solution — the natural unit when weighing solids on a balance",
    answer: "g dm⁻³",
    slide: 11,
    wrong: {
      "mol dm⁻³":
        "mol dm⁻³ is the count of particles per volume — the balance measures MASS, which slide 6 pairs with g dm⁻³.",
    },
  },
  {
    desc: "count of particles per volume — the chemist's preferred unit",
    answer: "mol dm⁻³",
    slide: 6,
    wrong: {
      "g dm⁻³":
        "g dm⁻³ is mass per volume — the unit used when weighing solids on a balance (slide 6), not a count of particles.",
    },
  },
  {
    desc: "the unit of M, the molar mass that bridges mol dm⁻³ and g dm⁻³",
    answer: "g mol⁻¹",
    slide: 11,
    wrong: {},
  },
  {
    desc: "the unit you actually get by mixing cm³ volumes with moles — wrong by a factor of 1000",
    answer: "mol cm⁻³",
    slide: 7,
    wrong: {
      "mol dm⁻³":
        "mol dm⁻³ is what the answer SHOULD be — slide 7's rule: in c = n/V the volume must be in dm³, or the result comes out in mol cm⁻³.",
    },
  },
];

export const FAMILIES: Family[] = [
  // ══ 1.5 — definitions ═════════════════════════════════════════════════════
  {
    key: "l4-def-concentration",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "definition",
    sourceSlides: [6, 25],
    groundingTerms: ["amount of solute per unit volume", "densely the solute is packed"],
    generate: (r) => {
      const correct = "The amount of solute per unit volume of solution.";
      const options = shuffle(r, [
        correct,
        "The total amount of solute dissolved in the solution.",
        "The volume of solution that contains one mole of solute.",
        "The mass of solvent per unit volume of solution.",
      ]);
      return {
        stem: "What is the exam definition of concentration?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 6: concentration is the amount of solute per unit volume of solution — expressed in mol dm⁻³ (count of particles per volume) or g dm⁻³ (mass per volume). Slide 25: it measures how DENSELY the solute is packed, not the total amount.",
        wrongWhy: {
          [options.indexOf("The total amount of solute dissolved in the solution.")]:
            "Concentration is not how much solute is dissolved — it's how much per unit volume. Slide 2's beakers hold the SAME 0.10 mol of NaCl at 1.0 and 0.20 mol dm⁻³.",
        },
        reviewSlide: 6,
      };
    },
  },
  {
    key: "l4-def-dilution-conserves",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "definition",
    sourceSlides: [16, 21],
    groundingTerms: ["dilution conserves moles", "only the volume increases", "c₁v₁ = c₂v₂"],
    generate: (r) => {
      const correct = "The moles of solute";
      const options = shuffle(r, [
        correct,
        "The concentration of the solution",
        "The volume of the solution",
        "The mass of water present",
      ]);
      return {
        stem: "A solution is diluted by adding more water. Which quantity stays the same?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 16: when you dilute by adding more solvent, the moles of solute don't change — only the volume increases, so c × V is conserved and c₁V₁ = c₂V₂. Slide 21 names forgetting this as the COMMON MISTAKE, and uses n₁ = n₂ as the check that catches arithmetic errors.",
        wrongWhy: {
          [options.indexOf("The concentration of the solution")]:
            "Concentration is exactly what dilution changes — slide 16's WE1: volume increased 5×, concentration ÷5.",
          [options.indexOf("The volume of the solution")]:
            "Adding solvent is what INCREASES the volume — slide 16: only the volume increases.",
        },
        reviewSlide: 16,
      };
    },
  },

  // ══ 1.5 — classification ══════════════════════════════════════════════════
  {
    key: "l4-cls-unit-match",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "classification",
    sourceSlides: [6, 7, 11],
    groundingTerms: ["weighing solids on a balance", "count of particles per volume", "mol cm⁻³"],
    generate: (r) => {
      const t = pick(r, UNIT_CASES);
      const options = shuffle(r, UNITS as readonly string[]);
      return {
        stem: `Which unit fits this description: ${t.desc}?`,
        options,
        correctIndex: options.indexOf(t.answer),
        explanation:
          "Slide 6 pairs the two concentration units — mol dm⁻³ is the count of particles per volume (the chemist's preferred unit), g dm⁻³ is mass per volume for the lab balance. M in g mol⁻¹ bridges them (slide 11). mol cm⁻³ is the wrong unit slide 7 warns about: mixing cm³ with moles, wrong by a factor of 1000.",
        wrongWhy: Object.fromEntries(
          options
            .map((o, i) => [i, o !== t.answer ? t.wrong[o] : undefined] as const)
            .filter(([, v]) => v !== undefined),
        ),
        reviewSlide: t.slide,
      };
    },
  },
  {
    key: "l4-cls-cm3-trap-student",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "classification",
    sourceSlides: [9, 19],
    groundingTerms: ["student a", "common error", "wrong by factor of 1000"],
    generate: (r) => {
      const correct =
        "The volume was never converted — the result is really 4.0 × 10⁻⁴ mol cm⁻³, wrong by a factor of 1000.";
      const options = shuffle(r, [
        correct,
        "Nothing — the substitution into c = n / V is correct as written.",
        "The formula should have been c = m / V.",
        "The result is out by a factor of 10.",
      ]);
      return {
        stem: "0.10 mol of HCl is dissolved in 250 cm³ of solution. Student A writes c = 0.10 / 250 = 4.0 × 10⁻⁴ mol dm⁻³. What has gone wrong?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 19: Student A divided by a cm³ volume, so the answer has units of mol cm⁻³, not mol dm⁻³ — off by factor 1000. Student C converts FIRST: V = 250 ÷ 1000 = 0.250 dm³, then c = 0.10 / 0.250 = 0.40 mol dm⁻³. Slide 9 names leaving V in cm³ as the COMMON ERROR in this topic.",
        wrongWhy: {
          [options.indexOf("Nothing — the substitution into c = n / V is correct as written.")]:
            "Slide 19 marks this answer WRONG — the formula is right, but slide 7's rule requires the volume in dm³ before substituting.",
          [options.indexOf("The formula should have been c = m / V.")]:
            "c = m / V is the g dm⁻³ formula for a MASS of solute (slide 6). The question gives moles, so c = n / V is the right formula — the error is the unconverted volume.",
        },
        reviewSlide: 19,
      };
    },
  },

  // ══ 1.5 — formulae ════════════════════════════════════════════════════════
  {
    key: "l4-formula-c",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "formula",
    sourceSlides: [6],
    groundingTerms: ["c = n / v", "c = m / v"],
    generate: (r) => {
      const t = pick(r, [
        {
          unit: "mol dm⁻³",
          correct: "c = n / V",
          sibling: "c = m / V",
          others: ["c = n × V", "c = V / n"],
          why: "c = m / V is the g dm⁻³ formula — mass per volume, the unit used when weighing solids on a balance (slide 6).",
        },
        {
          unit: "g dm⁻³",
          correct: "c = m / V",
          sibling: "c = n / V",
          others: ["c = m × V", "c = V / m"],
          why: "c = n / V is the mol dm⁻³ formula — moles per volume, the chemist's preferred unit (slide 6).",
        },
      ] as const);
      const options = shuffle(r, [t.correct, t.sibling, ...t.others]);
      return {
        stem: `Which formula gives concentration in ${t.unit}?`,
        options,
        correctIndex: options.indexOf(t.correct),
        explanation:
          "Slide 6: c = n / V gives mol dm⁻³ (moles of solute ÷ volume of solution in dm³) and c = m / V gives g dm⁻³ (mass ÷ volume). Both divide BY the volume — concentration is amount per unit volume.",
        wrongWhy: { [options.indexOf(t.sibling)]: t.why },
        reviewSlide: 6,
      };
    },
  },
  {
    key: "l4-formula-mass-standard",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "formula",
    sourceSlides: [14, 15],
    groundingTerms: ["m = c × v × m", "standard solution"],
    generate: (r) => {
      const correct = "m = c × V × M";
      const options = shuffle(r, [correct, "m = c × V ÷ M", "m = c ÷ (V × M)", "m = (c × M) ÷ V"]);
      return {
        stem: "Which formula gives the mass of solute to weigh out when preparing a standard solution?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 14: rearrange c = n / V to n = c × V, then use M — m = c × V × M, with V converted to dm³ first. Three numbers in, one mass out: weigh it into the volumetric flask, dissolve, make up to the line.",
        wrongWhy: {
          [options.indexOf("m = c × V ÷ M")]:
            "c × V is n, the moles — slide 15's step 4 MULTIPLIES by M (m = n × M) to reach grams; dividing goes the wrong way.",
        },
        reviewSlide: 14,
      };
    },
  },

  // ══ 1.5 — calculations, every answer computed then independently verified ═
  {
    key: "l4-calc-volume-convert",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "calculation",
    sourceSlides: [7, 22],
    groundingTerms: ["1 dm³ = 1000 cm³", "divide by 1000"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const V = pick(r2, [25, 50, 100, 250, 500] as const);
        const d = sf3(V / 1000);
        const options = shuffle(r2, [
          `${d} dm³`,
          `${sf3(V * 1000)} dm³`, // multiplied instead of dividing
          `${sf3(V / 100)} dm³`, // dropped a power of ten
          `${sf3(V / 10)} dm³`, // dropped two
        ]);
        return {
          stem: `Convert ${V} cm³ to dm³.`,
          options,
          correctIndex: options.indexOf(`${d} dm³`),
          explanation: `1 dm³ = 1000 cm³, so divide by 1000: ${V} ÷ 1000 = ${d} dm³ — slide 7's rule, done BEFORE substituting into c = n/V.`,
          wrongWhy: {
            [options.indexOf(`${sf3(V * 1000)} dm³`)]:
              "This multiplied by 1000 — the conversion runs the other way: cm³ ÷ 1000 = dm³ (slide 7: 250 cm³ ÷ 1000 = 0.250 dm³).",
          },
          reviewSlide: 7,
        };
      }),
    verify: (q) => {
      const V = Number(q.stem.match(/Convert ([\d.]+) cm³/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) dm³$/)?.[1]);
      if (![V, got].every(Number.isFinite)) return false;
      const expected = V * 0.001; // independent expression
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l4-calc-c-clean-dm3",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "calculation",
    sourceSlides: [8, 10],
    groundingTerms: ["c = n / v", "already in dm³"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const n = pick(r2, [0.05, 0.10, 0.20, 0.50] as const); // s10, s2, s8
        const V = pick(r2, [2.0, 5.0] as const); // s8, s10
        const c = sf3(n / V);
        const options = shuffle(r2, [
          `${c} mol dm⁻³`,
          `${sf3(n * V)} mol dm⁻³`, // × for ÷
          `${sf3(V / n)} mol dm⁻³`, // inverted the ratio
          `${sf3((n / V) * 10)} mol dm⁻³`, // power-of-ten slip
        ]);
        return {
          stem: `${n} mol of NaCl is dissolved in ${V} dm³ of solution. What is the concentration in mol dm⁻³?`,
          options,
          correctIndex: options.indexOf(`${c} mol dm⁻³`),
          explanation: `c = n / V = ${n} ÷ ${V} = ${c} mol dm⁻³ — slide 8's worked example: V is already in dm³, so no conversion is needed; substitute and always state the units.`,
          wrongWhy: {
            [options.indexOf(`${sf3(n * V)} mol dm⁻³`)]:
              "This multiplied n by V — c = n / V divides the moles BY the volume (slide 8's check: 0.5 ÷ 2 = 0.25).",
          },
          reviewSlide: 8,
        };
      }),
    verify: (q) => {
      const n = Number(q.stem.match(/^([\d.]+) mol of/)?.[1]);
      const V = Number(q.stem.match(/in ([\d.]+) dm³/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol dm⁻³$/)?.[1]);
      if (![n, V, got].every(Number.isFinite)) return false;
      const expected = n / V;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l4-calc-c-cm3-trap",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "calculation",
    sourceSlides: [9, 19],
    groundingTerms: ["common error", "convert first", "mol cm⁻³"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const n = pick(r2, [0.05, 0.10, 0.20, 0.50] as const); // s9, s10
        const V = pick(r2, [100, 250, 500] as const); // s10, s9, s20
        const c = sf3(n / (V / 1000));
        const options = shuffle(r2, [
          `${c} mol dm⁻³`,
          `${sf3(n / V)} mol dm⁻³`, // left V in cm³ — s9's COMMON ERROR
          `${sf3((n / (V / 1000)) * 10)} mol dm⁻³`, // power-of-ten slip
          `${sf3(n / (V / 1000) / 10)} mol dm⁻³`,
        ]);
        return {
          stem: `${n} mol of HCl is dissolved in ${V} cm³ of solution. What is the concentration in mol dm⁻³?`,
          options,
          correctIndex: options.indexOf(`${c} mol dm⁻³`),
          explanation: `Convert FIRST (slide 9): V = ${V} ÷ 1000 = ${sf3(V / 1000)} dm³, then c = n / V = ${n} ÷ ${sf3(V / 1000)} = ${c} mol dm⁻³. The mark scheme gives a mark for the conversion itself.`,
          wrongWhy: {
            [options.indexOf(`${sf3(n / V)} mol dm⁻³`)]:
              "This left V in cm³ — slide 9's COMMON ERROR and slide 19's Student A: the number has units of mol cm⁻³, not mol dm⁻³, wrong by a factor of 1000.",
          },
          reviewSlide: 9,
        };
      }),
    verify: (q) => {
      const n = Number(q.stem.match(/^([\d.]+) mol of/)?.[1]);
      const V = Number(q.stem.match(/in ([\d.]+) cm³/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol dm⁻³$/)?.[1]);
      if (![n, V, got].every(Number.isFinite)) return false;
      const expected = (n * 1000) / V; // independent expression
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l4-calc-unit-bridge",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "calculation",
    sourceSlides: [11, 13],
    groundingTerms: ["c (g dm⁻³) = c (mol dm⁻³) × m", "exam trap"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const s = pick(r2, SOLUTES);
        const c = pick(r2, CONCS);
        const g = sf3(c * s.M);
        const options = shuffle(r2, [
          `${g} g dm⁻³`,
          `${sf3(c / s.M)} g dm⁻³`, // ran the bridge backwards
          `${sf3(c * s.M * 10)} g dm⁻³`, // power-of-ten slip
          `${sf3((c * s.M) / 10)} g dm⁻³`,
        ]);
        return {
          stem: `A solution of ${s.name} has a concentration of ${c} mol dm⁻³. What is that in g dm⁻³? (M(${s.name}) = ${s.M} g mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${g} g dm⁻³`),
          explanation: `The bridge (slide 11): c (g dm⁻³) = c (mol dm⁻³) × M = ${c} × ${s.M} = ${g} g dm⁻³ — the two units express the SAME concentration, linked through M.`,
          wrongWhy: {
            [options.indexOf(`${sf3(c / s.M)} g dm⁻³`)]:
              "This DIVIDED by M — slide 11's EXAM TRAP gives both directions: multiply mol dm⁻³ by M to get g dm⁻³; divide g dm⁻³ by M to get mol dm⁻³.",
          },
          reviewSlide: 11,
        };
      }),
    verify: (q) => {
      const c = Number(q.stem.match(/concentration of ([\d.]+) mol dm⁻³/)?.[1]);
      const M = Number(q.stem.match(/= ([\d.]+) g mol⁻¹/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g dm⁻³$/)?.[1]);
      if (![c, M, got].every(Number.isFinite)) return false;
      const expected = c * M;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },

  // ══ 1.5 — application: standard solutions and dilution ════════════════════
  {
    key: "l4-app-standard-mass",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "application",
    sourceSlides: [14, 15],
    groundingTerms: ["m = c × v × m", "standard solution", "volumetric flask"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const s = pick(r2, [SOLUTES[0], SOLUTES[1]] as const); // NaCl, NaOH — the deck's weighed solids
        const c = pick(r2, [0.10, 0.20, 0.50] as const); // s14, s22, s17
        const V = pick(r2, [100, 250, 500, 1000] as const); // s18, s14, s20, s22
        const m = sf3(c * (V / 1000) * s.M);
        const options = shuffle(r2, [
          `${m} g`,
          `${sf3(c * V * s.M)} g`, // left V in cm³
          `${sf3(c * (V / 1000))} g`, // stopped at n = c × V — forgot ×M
          `${sf3(c * (V / 1000) * s.M * 10)} g`, // power-of-ten slip
        ]);
        return {
          stem: `What mass of ${s.name} must be weighed out to make ${V} cm³ of ${c} mol dm⁻³ solution? (M(${s.name}) = ${s.M} g mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${m} g`),
          explanation: `Slide 14's three steps: V = ${V} ÷ 1000 = ${sf3(V / 1000)} dm³, then m = c × V × M = ${c} × ${sf3(V / 1000)} × ${s.M} = ${m} g — weigh that into the volumetric flask, dissolve, make up to the line (slide 15).`,
          wrongWhy: {
            [options.indexOf(`${sf3(c * V * s.M)} g`)]:
              "This left V in cm³ — slide 14: Always convert volume to dm³ first. Substituting cm³ makes the mass 1000× too large.",
            [options.indexOf(`${sf3(c * (V / 1000))} g`)]:
              "This is n = c × V — the amount in moles, not a mass. Slide 15's step 4 multiplies by M: m = n × M.",
          },
          reviewSlide: 15,
        };
      }),
    verify: (q) => {
      const V = Number(q.stem.match(/make ([\d.]+) cm³/)?.[1]);
      const c = Number(q.stem.match(/of ([\d.]+) mol dm⁻³ solution/)?.[1]);
      const M = Number(q.stem.match(/= ([\d.]+) g mol⁻¹/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g$/)?.[1]);
      if (![V, c, M, got].every(Number.isFinite)) return false;
      const expected = (c * V * M) / 1000; // independent expression
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l4-app-dilution-c2",
    lessonSlug: SLUG,
    specCode: "1.5",
    kind: "application",
    sourceSlides: [16, 17, 20],
    groundingTerms: ["c₁v₁ = c₂v₂", "new concentration", "diluted"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const sub = pick(r2, ["HCl", "NaCl"] as const); // the deck's diluted solutions
        const c1 = pick(r2, [0.50, 1.0, 1.5, 2.0] as const); // s17, s16, s20, s17
        const d = pick(r2, DILUTIONS);
        const c2 = sf3((c1 * d.v1) / d.v2);
        const options = shuffle(r2, [
          `${c2} mol dm⁻³`,
          `${sf3((c1 * d.v2) / d.v1)} mol dm⁻³`, // inverted the ratio
          `${sf3(((c1 * d.v1) / d.v2) * 10)} mol dm⁻³`, // power-of-ten slip
          `${sf3((c1 * d.v1) / d.v2 / 10)} mol dm⁻³`,
        ]);
        return {
          stem: `${d.v1} cm³ of ${c1} mol dm⁻³ ${sub} is diluted with water to a final volume of ${d.v2} cm³. What is the new concentration?`,
          options,
          correctIndex: options.indexOf(`${c2} mol dm⁻³`),
          explanation: `c₁V₁ = c₂V₂ (slide 16): c₂ = c₁V₁/V₂ = (${c1} × ${d.v1}) / ${d.v2} = ${c2} mol dm⁻³. V₁ and V₂ can stay in the same unit — the ratio cancels. Check it: dilution conserves moles (slide 21).`,
          wrongWhy: {
            [options.indexOf(`${sf3((c1 * d.v2) / d.v1)} mol dm⁻³`)]:
              "This multiplied by V₂/V₁, making the diluted solution MORE concentrated. Slide 16: adding solvent spreads the same moles — in its WE1, volume increased 5×, concentration ÷5.",
          },
          reviewSlide: d.slide,
        };
      }),
    verify: (q) => {
      const v1 = Number(q.stem.match(/^([\d.]+) cm³ of/)?.[1]);
      const c1 = Number(q.stem.match(/of ([\d.]+) mol dm⁻³/)?.[1]);
      const v2 = Number(q.stem.match(/final volume of ([\d.]+) cm³/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol dm⁻³$/)?.[1]);
      if (![v1, c1, v2, got].every(Number.isFinite)) return false;
      const expected = (c1 / v2) * v1; // independent composition
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
];
