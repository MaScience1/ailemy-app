import { pick, shuffle, type Family } from "../engine.ts";

/**
 * Question families for Lesson 5 — Empirical and Molecular Formulae (§33).
 *
 * ============================================================================
 * ⚠ EVERY FACT BELOW IS IN THE DECK, AND THE TESTS CHECK THAT MECHANICALLY
 * ============================================================================
 * The definitions are the deck's own CORE text (slide 6), character-for-
 * character where they are quoted. The formula pairs are the deck's pairs
 * (ethane C₂H₆/CH₃ s6, glucose C₆H₁₂O₆/CH₂O s2+s6, C₄H₈/CH₂ s12, N₂O₄/NO₂
 * s13, C₆H₆/CH s22). Every number is a deck number: the % compositions
 * (40.0% C s8, 50.0% S + 75.0% C s10, 32.4% Na + 22.5% S + 45.1% O s19,
 * 60.0% Mg + 40.0% O s22, 85.7% C s23) with the Ar values the deck itself
 * divides by (C 12, O 16, S 32, Na 23, Mg 24); the Mr pairs of the
 * scale-factor bank (14→56 s12, 30→60 and 30→180 s13, 46→92 s13, 13→78
 * s22, 15→30 s18); the combustion product masses (0.88 g CO₂ + 0.54 g H₂O
 * s15+s24, 2.20 g + 0.90 g s21, 0.36 g s22); the oxygen-by-difference
 * datasets (0.46 − 0.24 − 0.060 s15+s24, and s18's hydrocarbon where the
 * same C and H masses account for all 0.30 g); and the hydrated-salt
 * heatings (MgSO₄ 4.93→2.41 s16, Na₂CO₃ 2.86→1.06 s16, CuSO₄ 2.50→1.60
 * s17). FeSO₄·xH₂O (s20/21) is deliberately NOT in the hydrate bank: its
 * mole ratio lands at 6.965 — the deck writes "≈ 6.97 ≈ 7" — which sits
 * outside verify()'s 0.005 relative tolerance of the whole-number answer.
 * The deck's H entries (Ar = 1) are excluded from the %→moles bank because
 * ×Ar and ÷Ar coincide when Ar = 1 and the distractors would collapse.
 *
 * ⚠ THE DISTRACTORS ARE THE DECK'S OWN MISTAKES (§38). Premature rounding
 * (s7's RULE; s19's Student A and Student B), writing 1 : 1.5 instead of
 * 2 : 3 (s9's EXAM TIP), ignoring oxygen because the question doesn't
 * mention it (s24's COMMON MISTAKE), treating the whole hydrated sample as
 * the water instead of the mass LOSS (s16: mass loss = water), inverted
 * ratios and × for ÷ on n = Mr(molecular) ÷ Mr(empirical) (s13's rule that
 * n is a whole number every time exposes the inversion), and
 * order-of-magnitude slips (s19: "unit errors that are an order of
 * magnitude or more off"). Where the deck names the misconception, wrongWhy
 * repeats the deck's teaching; where it does not, wrongWhy stays silent
 * rather than inventing feedback (§39, §51).
 *
 * ⚠ verify() RE-DERIVES FROM THE RENDERED STRINGS. It parses the quantities
 * back out of the stem and the labelled-correct option text and recomputes
 * with its own inline arithmetic — so a mislabelled option, a broken
 * formatter, or a generate() bug all surface as "derivations disagree" and
 * the variant is refused at birth (§101).
 */

const SLUG = "empirical-and-molecular-formulae";

const sf3 = (x: number) => Number(x.toPrecision(3));

/** Draw until the four option strings are distinct — bounded and
 *  deterministic; the banks below make collisions rare, this makes them
 *  impossible to serve. */
function distinct4<T>(r: () => number, draw: (r: () => number) => T & { options: string[] }): T {
  for (let i = 0; i < 12; i++) {
    const q = draw(r);
    if (new Set(q.options).size === 4) return q;
  }
  throw new Error("could not draw 4 distinct options — parameter ranges too tight");
}

// ── slide 6's two definitions, verbatim ─────────────────────────────────────

const TWO_FORMULAE = [
  {
    term: "empirical formula",
    def: "Simplest whole-number ratio of atoms in the compound.",
    tail: "Found from experimental data — masses or % composition of each element.",
  },
  {
    term: "molecular formula",
    def: "Actual number of atoms of each element per molecule.",
    tail: "Always a whole-number multiple of the empirical formula — same ratio, real count.",
  },
] as const;

const DEF_DISTRACTORS = [
  "The number of empirical units that stack up to make one molecule.",
  "The mass of each element in a 100 g sample.",
] as const;

// Molecular ↔ empirical pairs the deck shows (s6, s12, s13, s22).
const PAIRS = [
  { label: "ethane, C₂H₆", mol: "C₂H₆", emp: "CH₃", slide: 6 },
  { label: "glucose, C₆H₁₂O₆", mol: "C₆H₁₂O₆", emp: "CH₂O", slide: 6 },
  { label: "C₄H₈", mol: "C₄H₈", emp: "CH₂", slide: 12 },
  { label: "N₂O₄", mol: "N₂O₄", emp: "NO₂", slide: 13 },
  { label: "C₆H₆", mol: "C₆H₆", emp: "CH", slide: 22 },
] as const;

// % → moles: every (element, %, Ar) triple is a division the deck performs.
// H (Ar = 1) is excluded — see the header.
const PERCENTS = [
  { el: "C", pct: "40.0", ar: 12, slide: 8 },
  { el: "O", pct: "53.3", ar: 16, slide: 8 },
  { el: "S", pct: "50.0", ar: 32, slide: 10 },
  { el: "C", pct: "75.0", ar: 12, slide: 10 },
  { el: "Na", pct: "32.4", ar: 23, slide: 19 },
  { el: "S", pct: "22.5", ar: 32, slide: 19 },
  { el: "O", pct: "45.1", ar: 16, slide: 19 },
  { el: "Mg", pct: "60.0", ar: 24, slide: 22 },
  { el: "O", pct: "40.0", ar: 16, slide: 22 },
  { el: "C", pct: "85.7", ar: 12, slide: 23 },
] as const;

// Mr(empirical) → Mr(molecular) pairs, each one worked in the deck.
const SCALE = [
  { emp: "CH₂", mrEmp: 14, mr: 56, mol: "C₄H₈", slide: 12 },
  { emp: "CH₂O", mrEmp: 30, mr: 60, mol: "C₂H₄O₂", slide: 13 },
  { emp: "CH₂O", mrEmp: 30, mr: 180, mol: "C₆H₁₂O₆", slide: 13 },
  { emp: "NO₂", mrEmp: 46, mr: 92, mol: "N₂O₄", slide: 13 },
  { emp: "CH", mrEmp: 13, mr: 78, mol: "C₆H₆", slide: 22 },
  { emp: "CH₃", mrEmp: 15, mr: 30, mol: "C₂H₆", slide: 18 },
] as const;

// Combustion products the deck weighs (s15, s21, s22 — and s24 reuses s15's).
const COMBUSTION = [
  { prod: "CO₂", mProd: "0.88", num: 12, den: 44, el: "carbon", slide: 15 },
  { prod: "CO₂", mProd: "2.20", num: 12, den: 44, el: "carbon", slide: 21 },
  { prod: "CO₂", mProd: "0.36", num: 12, den: 44, el: "carbon", slide: 22 },
  { prod: "H₂O", mProd: "0.54", num: 2, den: 18, el: "hydrogen", slide: 15 },
  { prod: "H₂O", mProd: "0.90", num: 2, den: 18, el: "hydrogen", slide: 21 },
] as const;

// Oxygen-by-difference datasets (s24's exam question; s18's hydrocarbon,
// where m(C) + m(H) accounts for the whole sample and m(O) = 0).
const BY_DIFFERENCE = [
  { s: "0.46", c: "0.24", h: "0.060", slide: 24 },
  { s: "0.30", c: "0.24", h: "0.060", slide: 18 },
] as const;

// Hydrated-salt heatings (s16, s17). FeSO₄ excluded — see the header.
const HYDRATES = [
  { salt: "MgSO₄", mh: "4.93", ma: "2.41", mr: "120", slide: 16 },
  { salt: "Na₂CO₃", mh: "2.86", ma: "1.06", mr: "106", slide: 16 },
  { salt: "CuSO₄", mh: "2.50", ma: "1.60", mr: "159.5", slide: 17 },
] as const;

// Slide 9's exam-tip ratio plus slide 7's ×2 rule applied to 1.50 —
// the value slide 7's rounding warning itself names.
const RATIOS = [
  {
    ratio: "1.00 : 1.49",
    right: "2 : 3",
    asIs: "1 : 1.5",
    collapsed: "1 : 1",
    inverted: "3 : 2",
    slide: 9,
    how: "Slide 9's exam tip: if a ratio comes out 1.00 : 1.49, that's 2 : 3 not 1 : 1.5 — always express as whole numbers in the empirical formula.",
  },
  {
    ratio: "1.00 : 1.50",
    right: "2 : 3",
    asIs: "1 : 1.5",
    collapsed: "1 : 2",
    inverted: "3 : 2",
    slide: 7,
    how: "Slide 7, step 4: if a ratio is close to 0.5, ×2 — so 1.00 : 1.50 doubles to 2 : 3.",
  },
] as const;

export const FAMILIES: Family[] = [
  // ══ 1.6 — definitions ═════════════════════════════════════════════════════
  {
    key: "l5-def-two-formulae",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "definition",
    sourceSlides: [4, 6],
    groundingTerms: [
      "simplest whole-number ratio of atoms",
      "actual number of atoms of each element per molecule",
      "empirical units stack up",
    ],
    generate: (r) => {
      const target = pick(r, TWO_FORMULAE);
      const other = TWO_FORMULAE.find((t) => t.term !== target.term)!;
      const options = shuffle(r, [target.def, other.def, ...DEF_DISTRACTORS]);
      return {
        stem: `Which of these is the definition of the ${target.term}?`,
        options,
        correctIndex: options.indexOf(target.def),
        explanation: `Slide 6: ${target.def} ${target.tail}`,
        wrongWhy: {
          [options.indexOf(other.def)]:
            `This is the ${other.term} — slide 6 sets the two side by side: empirical is the simplest ratio, molecular the actual count.`,
          [options.indexOf(DEF_DISTRACTORS[0])]:
            "That is what Mr tells you — how many empirical units stack up to make one molecule (slide 6's bridge), not a formula.",
        },
        reviewSlide: 6,
      };
    },
  },
  {
    key: "l5-def-mr-bridge",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "definition",
    sourceSlides: [2, 8, 25],
    groundingTerms: ["methanal", "both reduce to ch₂o", "mr is needed"],
    generate: (r) => {
      const correct = "Its relative formula mass, Mr";
      const options = shuffle(r, [
        correct,
        "Its % composition by mass",
        "The mass of the sample analysed",
        "The Ar values of its elements",
      ]);
      return {
        stem: "Methanal (HCHO, Mr = 30) and glucose (C₆H₁₂O₆, Mr = 180) both reduce to CH₂O. For a compound whose empirical formula is known, what extra information fixes the molecular formula?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 25: Mr is the bridge. n = Mr(molecular) ÷ Mr(empirical) — glucose: n = 180 ÷ 30 = 6 → C₆H₁₂O₆; methanal: n = 1 → HCHO. Same empirical formula, different molecular formulae.",
        wrongWhy: {
          [options.indexOf("Its % composition by mass")]:
            "% composition alone can't separate them — slide 8: methanal and glucose share the ratio 1 : 2 : 1, and Mr is needed to fix the molecular formula.",
        },
        reviewSlide: 25,
      };
    },
  },
  {
    key: "l5-def-percent-as-mass",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "definition",
    sourceSlides: [7, 8, 10, 23],
    groundingTerms: ["treat the percentages as masses", "100 g", "premature rounding"],
    generate: (r) => {
      const comp = pick(r, [
        "40.0% C, 6.7% H and 53.3% O",
        "50.0% S, 50.0% O",
        "85.7% carbon and 14.3% hydrogen",
      ] as const);
      const correct = "Treat the percentages as masses out of 100 g.";
      const options = shuffle(r, [
        correct,
        "Divide each percentage by the smallest percentage.",
        "Round each percentage to the nearest whole number first.",
        "Multiply each percentage by the element's Ar.",
      ]);
      return {
        stem: `A compound contains ${comp} by mass. In the four-step method, what is the first move?`,
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 7, step 1: treat the percentages as masses out of 100 g — e.g. 40.0% C means 40.0 g of C in a 100 g sample. Then divide each by Ar, divide all by the smallest, and make whole numbers only at the end.",
        wrongWhy: {
          [options.indexOf("Divide each percentage by the smallest percentage.")]:
            "Dividing by the smallest comes at step 3 — and it is the MOLE values that are divided, not the percentages (slide 7).",
          [options.indexOf("Round each percentage to the nearest whole number first.")]:
            "Premature rounding is the trap — slide 7's rule: round only at the very end.",
          [options.indexOf("Multiply each percentage by the element's Ar.")]:
            "Moles come from mass ÷ Ar (slide 7's key move), and that is step 2 — step 1 just lists the masses.",
        },
        reviewSlide: 7,
      };
    },
  },

  // ══ 1.6 — classification ══════════════════════════════════════════════════
  {
    key: "l5-cls-ratio-to-whole",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "classification",
    sourceSlides: [7, 9],
    groundingTerms: ["1.00 : 1.49", "×2 or ×3 for whole numbers", "always express as whole numbers"],
    generate: (r) => {
      const c = pick(r, RATIOS);
      const options = shuffle(r, [c.right, c.asIs, c.collapsed, c.inverted]);
      return {
        stem: `Step 3 of the four-step method gives a mole ratio of ${c.ratio}. How should it appear in the empirical formula?`,
        options,
        correctIndex: options.indexOf(c.right),
        explanation: `${c.how} Round only at the very end.`,
        wrongWhy: {
          [options.indexOf(c.asIs)]:
            "Fractions never appear in an empirical formula — slide 9's exam tip: always express as whole numbers.",
          [options.indexOf(c.collapsed)]:
            "Rounding the ratio to a whole number mid-way is premature rounding — slide 7: it turns 1.50 into 1 or 2 and breaks the formula.",
        },
        reviewSlide: c.slide,
      };
    },
  },
  {
    key: "l5-cls-rounding-trap",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "classification",
    sourceSlides: [7, 19],
    groundingTerms: ["student b", "na₂so₄", "keeps moles to 3 s.f."],
    generate: (r) => {
      const correct = "Keep the mole values to at least 3 s.f. through the calculation and round only at the very end";
      const options = shuffle(r, [
        correct,
        "Round each mole value to the nearest whole number before dividing by the smallest",
        "Round each mole value to 1 d.p. before dividing by the smallest",
        "Divide the percentages by the smallest percentage without converting to moles",
      ]);
      return {
        stem: "A compound is 32.4% Na, 22.5% S and 45.1% O by mass. Three students convert to moles (Na 1.41, S 0.703, O 2.82) and then disagree. Which method leads reliably to the correct empirical formula, Na₂SO₄?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Student C keeps Na = 1.41, S = 0.703, O = 2.82, divides by 0.703 → 2.00 : 1.00 : 4.01 and rounds at the END → Na₂SO₄. Slide 19's mark scheme gives a mark for keeping ≥ 3 s.f. through the calculation.",
        wrongWhy: {
          [options.indexOf("Round each mole value to the nearest whole number before dividing by the smallest")]:
            "Student B's working on slide 19 — rounding 1.41 to 1 collapsed the 2 : 1 ratio and produced NaSO₃.",
          [options.indexOf("Round each mole value to 1 d.p. before dividing by the smallest")]:
            "Student A's working — it produced Na₂SO₄, but only by luck; the rounding hid information (slide 19).",
          [options.indexOf("Divide the percentages by the smallest percentage without converting to moles")]:
            "The ratio is taken between MOLES, not percentages — mass ÷ Ar = moles comes first (slide 7).",
        },
        reviewSlide: 19,
      };
    },
  },

  // ══ 1.6 — formula work ════════════════════════════════════════════════════
  {
    key: "l5-formula-empirical-of",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "formula",
    sourceSlides: [6, 12, 13, 22],
    groundingTerms: ["empirical ch₃", "c₄h₈", "c₆h₆"],
    generate: (r) => {
      const target = pick(r, PAIRS);
      const others = shuffle(r, PAIRS.filter((p) => p.emp !== target.emp)).slice(0, 2);
      const options = shuffle(r, [target.emp, target.mol, others[0].emp, others[1].emp]);
      return {
        stem: `What is the empirical formula of ${target.label}?`,
        options,
        correctIndex: options.indexOf(target.emp),
        explanation: `${target.mol} reduces to ${target.emp} — the simplest whole-number ratio of atoms. Slide ${target.slide} shows this pair.`,
        wrongWhy: {
          [options.indexOf(target.mol)]:
            "That is the molecular formula unchanged — the subscripts were never reduced to the simplest whole-number ratio (slide 6).",
        },
        reviewSlide: target.slide,
      };
    },
  },

  // ══ 1.6 — calculations, every answer computed then independently verified ═
  {
    key: "l5-calc-moles-from-percent",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "calculation",
    sourceSlides: [7, 8, 10, 19, 23],
    groundingTerms: ["treat % as mass", "mass ÷ ar = moles", "40.0% c"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const p = pick(r2, PERCENTS);
        const pctN = Number(p.pct);
        const n = sf3(pctN / p.ar);
        const options = shuffle(r2, [
          `${n} mol`,
          `${sf3(pctN * p.ar)} mol`, // × for ÷
          `${sf3(p.ar / pctN)} mol`, // inverted the division
          `${sf3(n * 10)} mol`, // order-of-magnitude slip
        ]);
        return {
          stem: `A compound contains ${p.pct}% ${p.el} by mass. Treating the % as mass in a 100 g sample, how many moles of ${p.el} is that? (Ar(${p.el}) = ${p.ar})`,
          options,
          correctIndex: options.indexOf(`${n} mol`),
          explanation: `Treat % as mass: ${p.pct}% ${p.el} means ${p.pct} g in a 100 g sample. Then mass ÷ Ar = moles: ${p.pct} ÷ ${p.ar} = ${n} mol — slide 7, steps 1 and 2. Keep at least 3 s.f.`,
          wrongWhy: {
            [options.indexOf(`${sf3(pctN * p.ar)} mol`)]:
              "This multiplied by Ar — slide 7's key move is mass ÷ Ar = moles.",
            [options.indexOf(`${sf3(p.ar / pctN)} mol`)]:
              "This divided the wrong way round — Ar ÷ mass instead of mass ÷ Ar.",
          },
          reviewSlide: p.slide,
        };
      }),
    verify: (q) => {
      const pct = Number(q.stem.match(/contains ([\d.]+)% /)?.[1]);
      const ar = Number(q.stem.match(/Ar\([^)]+\) = ([\d.]+)\)/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol$/)?.[1]);
      if (![pct, ar, got].every(Number.isFinite)) return false;
      const expected = pct / ar;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l5-calc-scale-factor",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "calculation",
    sourceSlides: [11, 12, 13, 18, 22],
    groundingTerms: ["scale factor", "n = mr(molecular) ÷ mr(empirical)", "whole number every time"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const s = pick(r2, SCALE);
        const n = s.mr / s.mrEmp; // exact whole number for every bank entry
        const options = shuffle(r2, [
          `n = ${n}`,
          `n = ${sf3(s.mrEmp / s.mr)}`, // inverted ratio
          `n = ${sf3(s.mr * s.mrEmp)}`, // × for ÷
          `n = ${n * 10}`, // order-of-magnitude slip
        ]);
        return {
          stem: `A compound has empirical formula ${s.emp} and Mr = ${s.mr}. Mr(${s.emp}) = ${s.mrEmp}. What is the scale factor n?`,
          options,
          correctIndex: options.indexOf(`n = ${n}`),
          explanation: `n = Mr(molecular) ÷ Mr(empirical) = ${s.mr} ÷ ${s.mrEmp} = ${n}, so (${s.emp}) × ${n} = ${s.mol} — slide 12's three steps; slide 13's rule: whole number every time.`,
          wrongWhy: {
            [options.indexOf(`n = ${sf3(s.mrEmp / s.mr)}`)]:
              "Divided upside down — n = Mr(molecular) ÷ Mr(empirical), and slide 13's rule says n comes out a whole number every time; a fraction below 1 means the ratio is inverted.",
            [options.indexOf(`n = ${sf3(s.mr * s.mrEmp)}`)]:
              "Multiplied the two Mr values — the bridge on slide 11 is a division: n = Mr(molecular) ÷ Mr(empirical).",
          },
          reviewSlide: s.slide,
        };
      }),
    verify: (q) => {
      const mr = Number(q.stem.match(/and Mr = ([\d.]+)\./)?.[1]);
      const mrEmp = Number(q.stem.match(/Mr\([^)]+\) = ([\d.]+)\./)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^n = ([\d.]+)$/)?.[1]);
      if (![mr, mrEmp, got].every(Number.isFinite)) return false;
      const expected = mr / mrEmp;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l5-calc-combustion-element-mass",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "calculation",
    sourceSlides: [14, 15, 21, 22],
    groundingTerms: ["m(co₂) × 12/44", "m(h₂o) × 2/18", "combustion"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const c = pick(r2, COMBUSTION);
        const mProdN = Number(c.mProd);
        const m = sf3((mProdN * c.num) / c.den);
        const options = shuffle(r2, [
          `${m} g`,
          `${sf3((mProdN * c.den) / c.num)} g`, // inverted the fraction
          `${c.mProd} g`, // used the product mass unchanged
          `${sf3(m * 10)} g`, // order-of-magnitude slip
        ]);
        return {
          stem: `A sample is burned in excess oxygen and the combustion analysis collects ${c.mProd} g of ${c.prod}. What mass of ${c.el} does the sample contain?`,
          options,
          correctIndex: options.indexOf(`${m} g`),
          explanation: `m(${c.el === "carbon" ? "C" : "H"}) = m(${c.prod}) × ${c.num}/${c.den} = ${c.mProd} × ${c.num}/${c.den} = ${m} g — slide 14: all carbon ends up in CO₂, all hydrogen ends up in H₂O.`,
          wrongWhy: {
            [options.indexOf(`${sf3((mProdN * c.den) / c.num)} g`)]:
              "The fraction is upside down — slide 20's hint: m(C) = m(CO₂) × 12/44 and m(H) = m(H₂O) × 2/18.",
            [options.indexOf(`${c.mProd} g`)]:
              `That is the mass of ${c.prod} collected, not the ${c.el} inside it — each CO₂ contains one C; each H₂O contains two H (slide 14).`,
          },
          reviewSlide: c.slide,
        };
      }),
    verify: (q) => {
      const mProd = Number(q.stem.match(/collects ([\d.]+) g of/)?.[1]);
      const prod = q.stem.match(/g of (\S+)\./)?.[1];
      const frac = prod === "CO₂" ? 12 / 44 : prod === "H₂O" ? 2 / 18 : NaN;
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g$/)?.[1]);
      if (![mProd, frac, got].every(Number.isFinite)) return false;
      const expected = mProd * frac;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },

  // ══ 1.6 — application: the deck's named traps ═════════════════════════════
  {
    key: "l5-app-oxygen-by-difference",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "application",
    sourceSlides: [14, 18, 24],
    groundingTerms: ["by difference", "excess oxygen", "m(o) = m(sample) − m(c) − m(h)"],
    generate: (r) => {
      const d = pick(r, BY_DIFFERENCE);
      const sN = Number(d.s);
      const cN = Number(d.c);
      const hN = Number(d.h);
      const oxy = sN - cN - hN;
      const noOxygen = Math.abs(oxy) < 0.001;
      const ans = noOxygen ? "0 g" : `${sf3(oxy)} g`;
      const options = shuffle(
        r,
        noOxygen
          ? [ans, `${sf3(sN - cN)} g`, `${sf3(sN - hN)} g`, `${sf3(cN + hN)} g`]
          : [ans, "0 g", `${sf3(sN - cN)} g`, `${sf3(cN + hN)} g`],
      );
      return {
        stem: `A ${d.s} g sample of an organic compound is burned in excess oxygen. Combustion analysis shows it contains ${d.c} g of carbon and ${d.h} g of hydrogen. What mass of oxygen does the compound contain?`,
        options,
        correctIndex: options.indexOf(ans),
        explanation: noOxygen
          ? `m(C) + m(H) = ${d.c} + ${d.h} = ${sf3(cN + hN)} g — the whole ${d.s} g sample. Slide 18: the fact that all sample mass = m(C) + m(H) tells us no oxygen is present.`
          : `m(O) = m(sample) − m(C) − m(H) = ${d.s} − ${d.c} − ${d.h} = ${sf3(oxy)} g — oxygen is found by difference, by mass conservation (slide 14's key idea).`,
        wrongWhy: {
          ...(noOxygen
            ? {}
            : {
                [options.indexOf("0 g")]:
                  `Ignoring oxygen because the question doesn't mention it is slide 24's common mistake — m(C) + m(H) = ${sf3(cN + hN)} g falls short of the ${d.s} g sample, and the rest is oxygen.`,
              }),
          [options.indexOf(`${sf3(sN - cN)} g`)]:
            "This forgot to subtract the hydrogen — O is found by mass conservation: m(O) = m(sample) − m(C) − m(H) (slide 14).",
          [options.indexOf(`${sf3(cN + hN)} g`)]:
            "That is m(C) + m(H) — the total slide 24 says to CHECK against the sample mass, not the oxygen.",
        },
        reviewSlide: d.slide,
      };
    },
    verify: (q) => {
      const s = Number(q.stem.match(/^A ([\d.]+) g sample/)?.[1]);
      const c = Number(q.stem.match(/contains ([\d.]+) g of carbon/)?.[1]);
      const h = Number(q.stem.match(/and ([\d.]+) g of hydrogen/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g$/)?.[1]);
      if (![s, c, h, got].every(Number.isFinite)) return false;
      const expected = s - c - h;
      if (Math.abs(expected) < 0.001) return Math.abs(got) < 0.001;
      return Math.abs(got - expected) / Math.abs(expected) < 0.005;
    },
  },
  {
    key: "l5-app-hydrated-salt-x",
    lessonSlug: SLUG,
    specCode: "1.6",
    kind: "application",
    sourceSlides: [16, 17, 20],
    groundingTerms: ["heated to constant mass", "mass loss = water", "x = n(h₂o) ÷ n(feso₄)"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const hd = pick(r2, HYDRATES);
        const mhN = Number(hd.mh);
        const maN = Number(hd.ma);
        const mrN = Number(hd.mr);
        const nSalt = maN / mrN;
        const nWater = (mhN - maN) / 18;
        const x = Math.round(nWater / nSalt);
        const options = shuffle(r2, [
          `x = ${x}`,
          `x = ${Math.round(mhN / 18 / nSalt)}`, // whole hydrated sample as water
          `x = ${sf3(nSalt / nWater)}`, // inverted the ratio
          `x = ${x * 10}`, // order-of-magnitude slip
        ]);
        return {
          stem: `Heating ${hd.mh} g of ${hd.salt}·xH₂O to constant mass leaves ${hd.ma} g of anhydrous ${hd.salt}. Find x. (Mr(${hd.salt}) = ${hd.mr}; Mr(H₂O) = 18)`,
          options,
          correctIndex: options.indexOf(`x = ${x}`),
          explanation: `mass(H₂O) = ${hd.mh} − ${hd.ma} = ${sf3(mhN - maN)} g. n(${hd.salt}) = ${hd.ma} ÷ ${hd.mr} = ${sf3(nSalt)} mol; n(H₂O) = ${sf3(nWater)} mol. x = n(H₂O) ÷ n(${hd.salt}) ≈ ${x} — slide ${hd.slide}: heat to constant mass, mass loss = water, ratio gives x.`,
          wrongWhy: {
            [options.indexOf(`x = ${Math.round(mhN / 18 / nSalt)}`)]:
              `This treated the whole ${hd.mh} g hydrated sample as water. The water driven off is the mass LOSS: ${hd.mh} − ${hd.ma} g — slide 16: mass loss = water.`,
            [options.indexOf(`x = ${sf3(nSalt / nWater)}`)]:
              "Divided the wrong way round — x = n(H₂O) ÷ n(salt), the ratio slide 20's hint gives.",
          },
          reviewSlide: hd.slide,
        };
      }),
    verify: (q) => {
      const mh = Number(q.stem.match(/Heating ([\d.]+) g/)?.[1]);
      const ma = Number(q.stem.match(/leaves ([\d.]+) g/)?.[1]);
      const mr = Number(q.stem.match(/Mr\([^)]+\) = ([\d.]+)/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^x = ([\d.]+)$/)?.[1]);
      if (![mh, ma, mr, got].every(Number.isFinite)) return false;
      const expected = ((mh - ma) * mr) / (18 * ma);
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
];
