import { pick, shuffle, type Family } from "../engine.ts";

/**
 * Question families for Lesson 1 — Definitions, Formulae and the Mole (§33).
 *
 * ============================================================================
 * ⚠ EVERY FACT BELOW IS IN THE DECK, AND THE TESTS CHECK THAT MECHANICALLY
 * ============================================================================
 * The definitions are the deck's own EXAM DEFINITION text (slide 6, 9, 12),
 * character-for-character where they are quoted. The substances are the
 * deck's substances (H₂ s8, H₂O s8/19, NaCl s8, CO₂ s13, CH₄ s17, glucose
 * s9/21, ethane + hydrogen peroxide + butene s10, Na s15, C s25, CaCO₃ s25).
 * The Ar values are the ones the deck itself displays: Na 23.0 (s15),
 * C 12.0 / O 16.0 / Ca 40.1 (s25), H 1.0 and M(H₂O)=18.0 (s19), M(glucose)=180
 * (s21). L = 6.02 × 10²³ mol⁻¹ (s12). Each family's groundingTerms are
 * checked against the extracted deck text at serve time AND in the suite —
 * a term the deck never shows makes the family unservable (§100).
 *
 * ⚠ THE DISTRACTORS ARE THE DECK'S OWN MISTAKES (§38). "Forgetting ×6"
 * (s21's COMMON MISTAKE), "Calling NaCl a molecule" (s8's EXAM TRAP),
 * "H atoms ÷ 4" inverted (s17's TRAP), × for ÷ on n = m ÷ M — not random
 * numbers. Where the deck names the misconception, wrongWhy repeats the
 * deck's teaching; where it does not, wrongWhy stays silent rather than
 * inventing feedback (§39, §51).
 *
 * ⚠ verify() RE-DERIVES FROM THE RENDERED STRINGS. It parses the quantities
 * back out of the stem and the labelled-correct option text and recomputes
 * with its own arithmetic — so a mislabelled option, a broken formatter, or
 * a generate() bug all surface as "derivations disagree" and the variant is
 * refused at birth (§101). Copying generate's expression here would make the
 * check a tautology; the sabotage test ships a family that disagrees on
 * purpose and proves the refusal fires.
 */

const SLUG = "definitions-formulae-and-the-mole";
const L_STR = "6.02 × 10²³";
const L_VAL = 6.02e23;

// ── formatting: match the deck's own notation ───────────────────────────────

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");

/** 1.51e23 → "1.51 × 10²³" — 3 s.f., the deck's house style (s21: "3 s.f."). */
export function sci(x: number): string {
  if (x === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = x / 10 ** exp;
  const m = mant.toPrecision(3);
  // 10.0 × 10²² would be malformed — renormalise.
  if (Number(m) >= 10) return sci(Number(m) * 10 ** exp);
  return `${m} × 10${sup(exp)}`;
}

/** "1.51 × 10²³" → 1.51e23 — verify()'s independent way back. */
export function parseSci(s: string): number | null {
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*×\s*10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/);
  if (!m) {
    const plain = Number(s.replace(/[^\d.eE+-]/g, ""));
    return Number.isFinite(plain) ? plain : null;
  }
  const exp = Number(
    m[2].split("").map((c) => Object.entries(SUP).find(([, v]) => v === c)?.[0] ?? "").join(""),
  );
  return Number(m[1]) * 10 ** exp;
}

const sf3 = (x: number) => Number(x.toPrecision(3));

/** "an atom", "a molecular formula" — the indefinite article by first letter. */
const article = (term: string) => (/^[aeiou]/i.test(term) ? "an" : "a");

/**
 * ⚠ §35 VARIATION FOR DEFINITION FAMILIES — WHY THESE BANKS EXIST.
 * ============================================================================
 * A calculation family varies by its numbers; a definition family has one
 * fact and would otherwise emit ONE stem forever. On 2026-08-23 that broke
 * practice on production: with two approved definition families, a ten-
 * question attempt had to repeat them, the repeat produced a byte-identical
 * stem, and the duplicate-stem guard threw before a student ever saw a
 * question. The engine now resamples and degrades honestly — and these
 * families now actually HAVE something to resample into.
 *
 * Two kinds of variation, both grounded in the deck:
 *   DIRECTION — ask for the definition of a term, or for the term a
 *     definition describes. Structurally different questions from one fact.
 *   PROBE     — the deck teaches the same fact through more than one framing
 *     (slide 11 gives the pair/dozen/mole ladder); each framing is a stem.
 * Nothing here invents chemistry: every framing is on the cited slide.
 *
 * ⚠ A DEFINITION FAMILY'S CEILING IS LOW AND THAT IS HONEST. Six variants,
 * not sixty. The route to a full varied ten is approving families across
 * kinds (§34), not squeezing more phrasings out of one definition.
 */

/** Draw until the four option strings are distinct — bounded and
 *  deterministic; ranges below make collisions rare, this makes them
 *  impossible to serve. */
function distinct4<T>(r: () => number, draw: (r: () => number) => T & { options: string[] }): T {
  for (let i = 0; i < 12; i++) {
    const q = draw(r);
    if (new Set(q.options).size === 4) return q;
  }
  throw new Error("could not draw 4 distinct options — parameter ranges too tight");
}

// ── the deck's own definition bank (slide 6, 8, 9, 12 — verbatim) ───────────

const DEFS = [
  { term: "atom", def: "The smallest particle of an element that retains its chemical identity." },
  { term: "element", def: "A substance containing only atoms with the same atomic (proton) number." },
  { term: "ion", def: "An atom (or group of atoms) with an overall charge, formed by loss or gain of electrons." },
  { term: "empirical formula", def: "Simplest whole-number ratio of atoms of each element." },
  { term: "molecular formula", def: "Actual number of atoms of each element in one molecule." },
] as const;

// Slide 7/8's classification bank — each entry is a deck example.
const CLASSIFY = [
  { case: "Na⁺ in solution", answer: "ion", slide: 7 },
  { case: "a single Cu nucleus with its electrons", answer: "atom", slide: 7 },
  { case: "H₂", answer: "molecule, but not a compound", slide: 8 },
  { case: "H₂O", answer: "both a molecule and a compound", slide: 8 },
  { case: "NaCl", answer: "compound, but not a molecule", slide: 8 },
] as const;

const CLASS_OPTIONS = [
  "ion",
  "atom",
  "molecule, but not a compound",
  "both a molecule and a compound",
  "compound, but not a molecule",
] as const;

// Slide 10's empirical-formula worked examples + slide 9's glucose.
const EMPIRICAL = [
  { name: "ethane", mol: "C₂H₆", emp: "CH₃", wrongKeep: "C₂H₆", slide: 10 },
  { name: "hydrogen peroxide", mol: "H₂O₂", emp: "HO", wrongKeep: "H₂O₂", slide: 10 },
  { name: "glucose", mol: "C₆H₁₂O₆", emp: "CH₂O", wrongKeep: "C₃H₆O₃", slide: 9 },
] as const;

// Substances for n = m ÷ M — M values the deck itself displays or computes.
const SUBSTANCES = [
  { name: "sodium", formula: "Na", M: 23.0, particle: "atoms", slide: 15 },
  { name: "carbon", formula: "C", M: 12.0, particle: "atoms", slide: 25 },
  { name: "water", formula: "H₂O", M: 18.0, particle: "molecules", slide: 19 },
  { name: "glucose", formula: "C₆H₁₂O₆", M: 180, particle: "molecules", slide: 21 },
] as const;

// Particle-multiplier cases the deck teaches (s17 CH₄→4 H, s21 glucose→6 C).
const MULTIPLIER = [
  { parent: "CH₄", sub: "hydrogen atoms", perParent: 4, slide: 17 },
  { parent: "C₆H₁₂O₆", sub: "carbon atoms", perParent: 6, slide: 21 },
  { parent: "H₂O", sub: "hydrogen atoms", perParent: 2, slide: 19 },
] as const;

// Amounts that keep answers in comfortable scientific-notation range and
// never collide distractors (n=1 would make ×L and ÷L …no; ÷ produces 1.66e-24
// scale — distinct; n≠1 also keeps "forgot multiplier" distinct).
const AMOUNTS = [0.10, 0.20, 0.25, 0.40, 0.50, 0.75, 1.5, 2.0, 2.5, 3.0] as const;
const MASSES = [2.3, 4.6, 6.9, 9.2, 11.5] as const; // ÷23 → clean; also fine for others

export const FAMILIES: Family[] = [
  // ══ 1.1 — definitions ═════════════════════════════════════════════════════
  {
    key: "l1-def-particle-terms",
    lessonSlug: SLUG,
    specCode: "1.1",
    kind: "definition",
    sourceSlides: [6],
    groundingTerms: ["exam definition", "chemical identity", "proton", "loss or gain of electrons"],
    generate: (r) => {
      const target = pick(r, DEFS.slice(0, 3)); // atom / element / ion — slide 6
      // DIRECTION (§35): definition-asked, or term-asked. 3 terms × 2 = 6 stems.
      const askForDefinition = r() < 0.5;
      const others = shuffle(r, DEFS.filter((d) => d.term !== target.term)).slice(0, 3);

      if (askForDefinition) {
        const options = shuffle(r, [target.def, ...others.map((d) => d.def)]);
        return {
          stem: `Which of these is the exam definition of ${article(target.term)} ${target.term}?`,
          options,
          correctIndex: options.indexOf(target.def),
          explanation: `Slide 6's exam definition: "${target.def}" The deck's exam rule applies — define the particle the question asks for, not a similar-sounding particle.`,
          wrongWhy: Object.fromEntries(
            options.flatMap((o, i) => {
              const owner = DEFS.find((d) => d.def === o);
              return o !== target.def && owner
                ? [[i, `This is the definition of ${article(owner.term)} ${owner.term} — a similar-sounding particle, which is exactly the trap slide 6 warns about.`]]
                : [];
            }),
          ),
          reviewSlide: 6,
        };
      }

      const options = shuffle(r, [target.term, ...others.map((d) => d.term)]);
      return {
        stem: `"${target.def}" Which term does the specification define this way?`,
        options,
        correctIndex: options.indexOf(target.term),
        explanation: `Slide 6: that is the exam definition of ${article(target.term)} ${target.term}. Reading a definition and naming the particle is the same exam skill in reverse — the wording is the mark.`,
        wrongWhy: Object.fromEntries(
          options.flatMap((o, i) => {
            const owner = DEFS.find((d) => d.term === o);
            return o !== target.term && owner
              ? [[i, `${owner.term[0].toUpperCase()}${owner.term.slice(1)} is defined as: "${owner.def}"`]]
              : [];
          }),
        ),
        reviewSlide: 6,
      };
    },
  },
  {
    key: "l1-def-empirical-formula",
    lessonSlug: SLUG,
    specCode: "1.1",
    kind: "definition",
    sourceSlides: [9, 20],
    groundingTerms: ["simplest whole-number ratio", "empirical", "molecular formula"],
    generate: (r) => {
      const EMP = "Simplest whole-number ratio of atoms of each element.";
      const MOL = "Actual number of atoms of each element in one molecule.";
      // §35: slide 9 defines BOTH formulae and contrasts them on glucose —
      // three stems from the one comparison the deck actually draws.
      const probe = r();

      if (probe < 0.66) {
        // DIRECTION: whichever half of slide 9's comparison is asked for.
        const wantEmpirical = probe < 0.33;
        const correct = wantEmpirical ? EMP : MOL;
        const other = wantEmpirical ? MOL : EMP;
        const options = shuffle(r, [
          correct,
          other,
          "The total number of atoms in one mole of the compound.",
          "The mass of one mole of the compound in grams.",
        ]);
        return {
          stem: `What is the exam definition of ${wantEmpirical ? "an empirical" : "a molecular"} formula?`,
          options,
          correctIndex: options.indexOf(correct),
          explanation: wantEmpirical
            ? `Slide 9's exam phrase: always say "simplest whole-number ratio" — the mark is for the wording.`
            : `Slide 9: the molecular formula is the ACTUAL number of atoms in one molecule — glucose is C₆H₁₂O₆, not CH₂O.`,
          wrongWhy: {
            [options.indexOf(other)]: wantEmpirical
              ? "This is the molecular formula — the other half of slide 9's comparison."
              : "This is the empirical formula — the other half of slide 9's comparison.",
          },
          reviewSlide: 9,
        };
      }

      // PROBE: the contrast itself, on the deck's own glucose example (s9).
      const correct =
        "The empirical formula gives the simplest whole-number ratio; the molecular formula gives the actual number of atoms in one molecule.";
      const flip =
        "The empirical formula gives the actual number of atoms; the molecular formula gives the simplest whole-number ratio.";
      const options = shuffle(r, [
        correct,
        flip,
        "For a compound the empirical and molecular formulae are always the same.",
        "The molecular formula gives the mass of one mole of the compound in grams.",
      ]);
      return {
        stem: "Glucose has the molecular formula C₆H₁₂O₆ and the empirical formula CH₂O. Which statement explains the difference?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 9: divide C₆H₁₂O₆ through by 6 and you get CH₂O — the simplest whole-number ratio. The molecular formula keeps the actual count of atoms in one molecule.",
        wrongWhy: {
          [options.indexOf(flip)]:
            "The two definitions are the right way round on slide 9 — it is the empirical formula that is the simplest ratio.",
          [options.indexOf("For a compound the empirical and molecular formulae are always the same.")]:
            "Slide 9's own example disproves this: glucose is C₆H₁₂O₆ but CH₂O.",
        },
        reviewSlide: 9,
      };
    },
  },
  {
    key: "l1-def-avogadro",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "definition",
    sourceSlides: [12],
    groundingTerms: ["avogadro", "specified particles", "mol⁻¹"],
    generate: (r) => {
      // DIRECTION (§35): name the meaning, or name the constant.
      if (r() < 0.5) {
        const correct = "The number of specified particles in one mole of any substance.";
        const options = shuffle(r, [
          correct,
          "The number of atoms in one gram of any substance.",
          "The mass of one mole of a substance in grams.",
          "The number of molecules in one dm³ of a gas.",
        ]);
        return {
          stem: `Avogadro's constant, L = ${L_STR} mol⁻¹. What does it represent?`,
          options,
          correctIndex: options.indexOf(correct),
          explanation:
            "Slide 12: L is the number of specified particles in one mole — and it works for atoms, ions, molecules, electrons or formula units, whichever particle is specified.",
          wrongWhy: {},
          reviewSlide: 12,
        };
      }
      const correct = "Avogadro's constant";
      const options = shuffle(r, [correct, "the molar mass", "the relative atomic mass", "the mole"]);
      return {
        stem: `One mole of any substance contains ${L_STR} specified particles. What is that number called?`,
        options,
        correctIndex: options.indexOf(correct),
        explanation: `Slide 12: the number itself is Avogadro's constant, L = ${L_STR} mol⁻¹. The mole is the UNIT of amount; L is how many particles are in it.`,
        wrongWhy: {
          [options.indexOf("the mole")]:
            "The mole is the unit of amount of substance — Avogadro's constant is the number of particles it contains.",
          [options.indexOf("the molar mass")]:
            "Molar mass is a mass per mole in g mol⁻¹, not a number of particles.",
        },
        reviewSlide: 12,
      };
    },
  },
  {
    key: "l1-def-mole-counting",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "definition",
    sourceSlides: [4, 11],
    groundingTerms: ["counting unit", "dozen", "specified"],
    generate: (r) => {
      const correct = `1 mole contains ${L_STR} specified particles`;
      const options = shuffle(r, [
        correct,
        `1 mole contains ${L_STR} grams of substance`,
        "1 mole contains 12 specified particles",
        `1 mole contains 6.02 × 10²¹ specified particles`,
      ]);
      // PROBE (§35): slide 11 gives the ladder twice — as the baker analogy
      // and as pair → dozen → mole. Each framing is one stem; the fact is one.
      // ⚠ THIS IS THE STEM THAT COLLIDED WITH ITSELF ON PRODUCTION.
      const stem =
        r() < 0.5
          ? "A chemist counts in moles the way a baker counts in dozens. Which statement is correct?"
          : "A pair is 2 items and a dozen is 12 items. Which statement completes the same counting ladder?";
      return {
        stem,
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 11's ladder: 1 pair = 2 specified items, 1 dozen = 12, 1 mole = 6.02 × 10²³. The mole is a counting unit — it links a measured amount of substance to a number of particles.",
        wrongWhy: {
          [options.indexOf("1 mole contains 12 specified particles")]:
            "12 is a dozen — the analogy on slide 11, not the mole itself.",
        },
        reviewSlide: 11,
      };
    },
  },

  // ══ 1.1 — classification ══════════════════════════════════════════════════
  {
    key: "l1-cls-particle-example",
    lessonSlug: SLUG,
    specCode: "1.1",
    kind: "classification",
    sourceSlides: [7, 8],
    groundingTerms: ["na⁺", "cu", "quick check"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const target = pick(r2, CLASSIFY);
        const options = shuffle(
          r2,
          [target.answer, ...shuffle(r2, CLASS_OPTIONS.filter((o) => o !== target.answer)).slice(0, 3)],
        );
        return {
          stem: `Classify: ${target.case}. Which term applies?`,
          options,
          correctIndex: options.indexOf(target.answer),
          explanation:
            target.case === "NaCl"
              ? "Slide 8's exam trap: NaCl is a compound made of ions — say formula unit, not molecule. Molecule describes HOW atoms join (covalently); compound describes WHAT is present (more than one element)."
              : target.case === "H₂"
                ? "Slide 8: H₂ is two atoms covalently joined — a molecule — but only one element is present, so it is not a compound."
                : `Slide ${target.slide}'s quick check — molecule describes HOW atoms join (covalent), compound describes WHAT atoms are present (more than one element).`,
          wrongWhy:
            target.case === "NaCl"
              ? {
                  [options.indexOf("both a molecule and a compound")]:
                    "Calling NaCl a molecule is slide 8's named exam trap — it is bonded ionically, not covalently.",
                }
              : {},
          reviewSlide: target.slide,
        };
      }),
  },
  {
    key: "l1-cls-molecule-vs-compound",
    lessonSlug: SLUG,
    specCode: "1.1",
    kind: "classification",
    sourceSlides: [8],
    groundingTerms: ["molecule", "compound", "covalent", "formula unit"],
    generate: (r) => {
      const rows = [
        { s: "H₂", verdict: "molecule, but not a compound" },
        { s: "H₂O", verdict: "both a molecule and a compound" },
        { s: "NaCl", verdict: "compound, but not a molecule" },
      ] as const;
      const target = pick(r, rows);
      const options = shuffle(r, [
        "molecule, but not a compound",
        "both a molecule and a compound",
        "compound, but not a molecule",
        "neither a molecule nor a compound",
      ]);
      return {
        stem: `Slide 8 draws the line between molecules and compounds. Which describes ${target.s}?`,
        options,
        correctIndex: options.indexOf(target.verdict),
        explanation:
          "Molecule = HOW atoms join (covalent). Compound = WHAT atoms are present (more than one element). H₂ joins covalently but has one element; H₂O does both; NaCl has two elements but is held ionically — a formula unit, not a molecule.",
        wrongWhy: {},
        reviewSlide: 8,
      };
    },
  },

  // ══ 1.1 — formula work ════════════════════════════════════════════════════
  {
    key: "l1-formula-empirical",
    lessonSlug: SLUG,
    specCode: "1.1",
    kind: "formula",
    sourceSlides: [9, 10],
    groundingTerms: ["c₂h₆", "h₂o₂", "ch₂o"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const target = pick(r2, EMPIRICAL);
        const others = EMPIRICAL.filter((e) => e.name !== target.name);
        const options = shuffle(r2, [
          target.emp,
          target.wrongKeep, // did not fully divide / kept molecular
          ...shuffle(r2, others).slice(0, 2).map((o) => o.emp),
        ]);
        return {
          stem: `What is the empirical formula of ${target.name}, ${target.mol}?`,
          options,
          correctIndex: options.indexOf(target.emp),
          explanation: `Divide every subscript by the highest common factor — slide ${target.slide} works ${target.mol} → ${target.emp}. The empirical formula is the simplest whole-number ratio.`,
          wrongWhy: {
            [options.indexOf(target.wrongKeep)]:
              target.wrongKeep === target.mol
                ? "That is the molecular formula unchanged — the subscripts were never divided."
                : "The subscripts were not divided all the way to the simplest whole-number ratio.",
          },
          reviewSlide: target.slide,
        };
      }),
  },

  // ══ 1.2 — calculations, every answer computed then independently verified ═
  {
    key: "l1-calc-particles-from-moles",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "calculation",
    sourceSlides: [13],
    groundingTerms: ["n × l", "co₂", "molecules"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const n = pick(r2, AMOUNTS);
        const sub = pick(r2, [
          { name: "CO₂", particle: "molecules" },
          { name: "H₂O", particle: "molecules" },
          { name: "sodium", particle: "atoms" },
        ] as const);
        const N = sf3(n * L_VAL);
        const options = shuffle(r2, [
          sci(N),
          sci(sf3(n / L_VAL)),          // divided instead of multiplied
          sci(sf3(n * L_VAL * 10)),     // power-of-ten slip
          sci(sf3(n * L_VAL) / 100),    // power-of-ten slip the other way
        ]);
        return {
          stem: `How many ${sub.particle} of ${sub.name} are in ${n} mol? (L = ${L_STR} mol⁻¹)`,
          options,
          correctIndex: options.indexOf(sci(N)),
          explanation: `N = n × L = ${n} × ${L_STR} = ${sci(N)} ${sub.particle} — slide 13's method: identify, pick the formula, substitute.`,
          wrongWhy: {
            [options.indexOf(sci(sf3(n / L_VAL)))]:
              "This divided by L instead of multiplying — that direction converts particles TO moles (n = N ÷ L).",
          },
          reviewSlide: 13,
        };
      }),
    verify: (q) => {
      const n = Number(q.stem.match(/in ([\d.]+) mol/)?.[1]);
      const got = parseSci(q.options[q.correctIndex]);
      if (!Number.isFinite(n) || got === null) return false;
      const expected = n * 6.02e23; // independent constant expression
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l1-calc-moles-from-particles",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "calculation",
    sourceSlides: [12, 17],
    groundingTerms: ["n ÷ l", "amount of substance"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const n = pick(r2, AMOUNTS);
        const N = sf3(n * L_VAL);
        const nBack = sf3(N / L_VAL);
        const options = shuffle(r2, [
          `${nBack} mol`,
          sci(sf3(N * L_VAL)),             // multiplied instead of divided
          `${sf3(nBack * 10)} mol`,        // power-of-ten slip
          `${sf3(nBack / 10)} mol`,
        ]);
        return {
          stem: `A sample contains ${sci(N)} atoms of sodium. What amount of substance is that? (L = ${L_STR} mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${nBack} mol`),
          explanation: `n = N ÷ L = ${sci(N)} ÷ ${L_STR} = ${nBack} mol — slide 12's notation: n in mol, N has no unit, L in mol⁻¹.`,
          wrongWhy: {
            [options.indexOf(sci(sf3(N * L_VAL)))]:
              "This multiplied by L — that direction converts moles TO particles (N = n × L).",
          },
          reviewSlide: 12,
        };
      }),
    verify: (q) => {
      const N = parseSci(q.stem.match(/contains (.+?) atoms/)?.[1] ?? "");
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol$/)?.[1]);
      if (N === null || !Number.isFinite(got)) return false;
      const expected = N / 6.02e23;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l1-calc-moles-from-mass",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "calculation",
    sourceSlides: [14, 15],
    groundingTerms: ["m ÷ m", "molar mass", "g mol⁻¹"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const sub = pick(r2, SUBSTANCES);
        const m = pick(r2, MASSES);
        const n = sf3(m / sub.M);
        const options = shuffle(r2, [
          `${n} mol`,
          `${sf3(m * sub.M)} mol`,   // × for ÷
          `${sf3(sub.M / m)} mol`,   // inverted the division
          `${sf3(n * 10)} mol`,      // slipped a power of ten
        ]);
        return {
          stem: `How many moles are in ${m} g of ${sub.name}? (M(${sub.formula}) = ${sub.M} g mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${n} mol`),
          explanation: `n = m ÷ M = ${m} ÷ ${sub.M} = ${n} mol — the slide 15 routine: identify, find M, write the formula then substitute, answer with units.`,
          wrongWhy: {
            [options.indexOf(`${sf3(m * sub.M)} mol`)]:
              "This multiplied m by M. The formula triangle on slide 14 is n = m ÷ M — mass divided by molar mass.",
            [options.indexOf(`${sf3(sub.M / m)} mol`)]:
              "This divided the wrong way round — M ÷ m instead of m ÷ M.",
          },
          reviewSlide: 15,
        };
      }),
    verify: (q) => {
      const m = Number(q.stem.match(/in ([\d.]+) g of/)?.[1]);
      const M = Number(q.stem.match(/= ([\d.]+) g mol⁻¹/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol$/)?.[1]);
      if (![m, M, got].every(Number.isFinite)) return false;
      const expected = m / M;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l1-calc-mass-from-moles",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "calculation",
    sourceSlides: [16, 25],
    groundingTerms: ["n × m", "three-way", "moles is always the bridge"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const sub = pick(r2, SUBSTANCES);
        const n = pick(r2, AMOUNTS);
        const mass = sf3(n * sub.M);
        const options = shuffle(r2, [
          `${mass} g`,
          `${sf3(n / sub.M)} g`,      // ÷ for ×
          `${sf3(mass * 10)} g`,
          `${sf3(mass / 10)} g`,
        ]);
        return {
          stem: `What is the mass of ${n} mol of ${sub.name}? (M(${sub.formula}) = ${sub.M} g mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${mass} g`),
          explanation: `m = n × M = ${n} × ${sub.M} = ${mass} g — the reverse leg of slide 16's three-way conversion; the exit question on slide 25 uses exactly this step for CaCO₃.`,
          wrongWhy: {
            [options.indexOf(`${sf3(n / sub.M)} g`)]:
              "This divided by M — that direction converts mass to moles, not moles to mass.",
          },
          reviewSlide: 16,
        };
      }),
    verify: (q) => {
      const n = Number(q.stem.match(/mass of ([\d.]+) mol/)?.[1]);
      const M = Number(q.stem.match(/= ([\d.]+) g mol⁻¹/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g$/)?.[1]);
      if (![n, M, got].every(Number.isFinite)) return false;
      const expected = n * M;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },

  // ══ 1.2 — application: the deck's named traps ═════════════════════════════
  {
    key: "l1-app-particle-multiplier",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "application",
    sourceSlides: [17, 21],
    groundingTerms: ["ch₄", "4 h atoms per", "transfer trap"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const t = pick(r2, MULTIPLIER);
        const n = pick(r2, AMOUNTS);
        const N = sf3(n * t.perParent * L_VAL);
        const options = shuffle(r2, [
          sci(N),
          sci(sf3(n * L_VAL)),                    // forgot the multiplier — s21's COMMON MISTAKE
          sci(sf3((n / t.perParent) * L_VAL)),    // divided instead of multiplying
          sci(sf3(n * t.perParent * L_VAL * 10)), // power of ten
        ]);
        return {
          stem: `How many ${t.sub} are in ${n} mol of ${t.parent}? (L = ${L_STR} mol⁻¹)`,
          options,
          correctIndex: options.indexOf(sci(N)),
          explanation: `${t.parent} contains ${t.perParent} ${t.sub.replace(" atoms", "")} atoms per ${t.parent === "C₆H₁₂O₆" ? "molecule" : "molecule"}: n(atoms) = ${n} × ${t.perParent}, then N = n × L = ${sci(N)}. Slide 17 calls this the transfer trap — convert particles first.`,
          wrongWhy: {
            [options.indexOf(sci(sf3(n * L_VAL)))]:
              `Forgetting ×${t.perParent} — the question asks for ${t.sub}, not ${t.parent} molecules. This is the named common mistake on slide 21.`,
            [options.indexOf(sci(sf3((n / t.perParent) * L_VAL)))]:
              "Dividing by the multiplier goes the wrong way — that would convert atoms to parent molecules, as in slide 17's worked example.",
          },
          reviewSlide: t.slide,
        };
      }),
    verify: (q) => {
      const n = Number(q.stem.match(/in ([\d.]+) mol of/)?.[1]);
      const parent = q.stem.match(/mol of (\S+)\?/)?.[1];
      const per = parent === "CH₄" ? 4 : parent === "C₆H₁₂O₆" ? 6 : parent === "H₂O" ? 2 : NaN;
      const got = parseSci(q.options[q.correctIndex]);
      if (!Number.isFinite(n) || !Number.isFinite(per) || got === null) return false;
      const expected = n * per * 6.02e23;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l1-app-mass-to-particles",
    lessonSlug: SLUG,
    specCode: "1.2",
    kind: "application",
    sourceSlides: [16, 19],
    groundingTerms: ["moles is always the bridge", "n = m ÷ m"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const sub = pick(r2, [SUBSTANCES[0], SUBSTANCES[2]]); // sodium, water
        const m = pick(r2, MASSES);
        const n = m / sub.M;
        const N = sf3(n * L_VAL);
        const options = shuffle(r2, [
          sci(N),
          sci(sf3(m * L_VAL)),        // skipped the ÷M step entirely
          `${sf3(n)} mol`,            // stopped at moles — never crossed the bridge
          sci(sf3(N * 10)),
        ]);
        return {
          stem: `Calculate the number of ${sub.particle} in ${m} g of ${sub.name}. (M = ${sub.M} g mol⁻¹, L = ${L_STR} mol⁻¹)`,
          options,
          correctIndex: options.indexOf(sci(N)),
          explanation: `Two steps, moles as the bridge (slide 16): n = m ÷ M = ${m} ÷ ${sub.M} = ${sf3(n)} mol, then N = n × L = ${sci(N)} ${sub.particle}.`,
          wrongWhy: {
            [options.indexOf(sci(sf3(m * L_VAL)))]:
              "This multiplied the MASS by L, skipping the conversion to moles — mass never touches L directly; moles is always the bridge.",
            [options.indexOf(`${sf3(n)} mol`)]:
              "This is the amount in moles — the halfway point. The question asks for the number of particles.",
          },
          reviewSlide: 16,
        };
      }),
    verify: (q) => {
      const m = Number(q.stem.match(/in ([\d.]+) g of/)?.[1]);
      const M = Number(q.stem.match(/M = ([\d.]+) g mol⁻¹/)?.[1]);
      const got = parseSci(q.options[q.correctIndex]);
      if (![m, M].every(Number.isFinite) || got === null) return false;
      const expected = (m / M) * 6.02e23;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
];
