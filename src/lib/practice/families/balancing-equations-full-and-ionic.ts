import { pick, shuffle, type Family } from "../engine.ts";

/**
 * Question families for Lesson 2 — Balancing Equations, Full and Ionic (§33).
 *
 * ============================================================================
 * ⚠ EVERY FACT BELOW IS IN THE DECK, AND THE TESTS CHECK THAT MECHANICALLY
 * ============================================================================
 * The equations are the deck's own. s9's quick-check bank (2Mg + O₂ → 2MgO,
 * 3H₂ + N₂ → 2NH₃, 2Fe + 3Cl₂ → 2FeCl₃, 2KClO₃ → 2KCl + 3O₂) and s7's
 * combustion (C₃H₈ + 5O₂ → 3CO₂ + 4H₂O) ground the balanced-form family;
 * s7's step-4 arithmetic (6 + 4 = 10 O atoms → 5 O₂) grounds the oxygen-last
 * counts; s25's step 3 (6 H from 2×3 + 6 H from 3×2 = 12 H) grounds the
 * hydrogen counts. The ionic equations, spectators and charge checks are the
 * deck's worked examples: AgNO₃ + NaCl (s12–13), Mg + the three acids
 * (s14–16, s22), Zn + CuSO₄ (s18), CaCO₃ + HCl (s19, s24), NaOH + HCl (s20),
 * Pb(NO₃)₂ + KI (s21–22, s29) and s23's mini-stretch bank. The observations
 * are the deck's own words: white precipitate (s2/s13), blue fades + brown
 * deposit (s17–18), bright yellow precipitate (s21), fizzing + limewater
 * milky (s19/s24). Definitions: two ledgers (s4/s6), coefficients-only
 * (s6/s9), strong electrolyte (s11), polyatomic ions as single units
 * (s8/s25). Each family's groundingTerms are checked against the extracted
 * deck text at serve time AND in the suite (§100).
 *
 * ⚠ THE DISTRACTORS ARE THE DECK'S OWN MISTAKES (§38). Changing subscripts
 * instead of coefficients (s6's rule, s9's rule, s25's COMMON MISTAKE —
 * "writing Al(OH)₂ or H₂SO₃"), splitting an (s) or (l) species — CaCO₃
 * (s19's trap, s24's COMMON MISTAKE), H₂O (s20), PbI₂ (s22's COMMON
 * MISTAKE) — counting O atoms instead of O₂ molecules and dropping CO₂'s
 * two oxygens (both straight from s7's step 4), forgetting H₂SO₄'s two
 * hydrogens (s16: "donates TWO H⁺"), ignoring a coefficient in the charge
 * ledger (s29 counts 2I⁻ as −2), and confusing spectators with the reacting
 * ions (s14: "H⁺ does the reacting"). Where the deck names the
 * misconception, wrongWhy repeats the deck's teaching; where it does not,
 * wrongWhy stays silent rather than inventing feedback (§39, §51).
 *
 * ⚠ verify() RE-DERIVES FROM THE RENDERED STRINGS (§101). The three counting
 * families parse their quantities back out of the stem and the labelled
 * option text and recompute; the balanced-form family re-parses the labelled
 * equation atom-by-atom and demands that it balances AND preserves the
 * skeleton's formulas while every other option fails one of those tests; the
 * two application families re-derive the answer from the rendered stem with
 * their own maps — observation keyword → the one species that proves it,
 * plus a charge re-parse of the labelled ionic equation; acid formula +
 * partner row → salt name + product tail — and demand every other option
 * fails. A mislabelled correctIndex, a broken bank entry, or a formatter bug
 * all surface as "derivations disagree" and the variant is refused at birth.
 */

const SLUG = "balancing-equations-full-and-ionic";

// ── parsing helpers: the deck's own notation, re-read by verify() ───────────

const SUPD: Record<string, number> = {
  "⁰": 0, "¹": 1, "²": 2, "³": 3, "⁴": 4, "⁵": 5, "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9,
};
const supNum = (s: string): number =>
  s.split("").reduce((acc, c) => acc * 10 + (SUPD[c] ?? 0), 0);

const SUBD: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/** "2KClO₃" → K:2, Cl:2, O:6 — coefficient × subscript, exactly the counting
 *  slides 7 and 25 teach. Null when the side contains anything it cannot
 *  vouch for (parentheses, stray symbols) — refusal, not a guess. */
function atomTotals(side: string): Map<string, number> | null {
  const totals = new Map<string, number>();
  for (const term of side.split(" + ")) {
    const m = term.match(/^(\d*)([A-Za-z][A-Za-z₀₁₂₃₄₅₆₇₈₉]*)$/);
    if (!m) return null;
    const coeff = m[1] ? Number(m[1]) : 1;
    let consumed = 0;
    for (const em of m[2].matchAll(/([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]*)/g)) {
      consumed += em[0].length;
      const sub = em[2] ? Number(em[2].split("").map((c) => SUBD[c]).join("")) : 1;
      totals.set(em[1], (totals.get(em[1]) ?? 0) + coeff * sub);
    }
    if (consumed !== m[2].length) return null;
  }
  return totals;
}

const formulasOf = (side: string): string[] =>
  side.split(" + ").map((t) => t.replace(/^\d+/, ""));

function sidesBalance(eq: string): boolean {
  const [l, r] = eq.split(" → ");
  if (!l || !r) return false;
  const lt = atomTotals(l);
  const rt = atomTotals(r);
  if (!lt || !rt || lt.size !== rt.size) return false;
  for (const [el, n] of lt) if (rt.get(el) !== n) return false;
  return true;
}

/** Same species in the same places, coefficients aside — a subscript change
 *  (MgO → MgO₂) is a DIFFERENT substance, s9's named foul. */
function keepsSpecies(skeleton: string, eq: string): boolean {
  const [sl, sr] = skeleton.split(" → ");
  const [el, er] = eq.split(" → ");
  if (!sl || !sr || !el || !er) return false;
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  return same(formulasOf(sl), formulasOf(el)) && same(formulasOf(sr), formulasOf(er));
}

/** Total charge of one side of a rendered ionic equation — every term must
 *  carry a state symbol (the deck always writes one); null is refusal.
 *  "Pb²⁺(aq) + 2I⁻(aq)" → (+2) + 2 × (−1) = 0, s29's own ledger. */
function sideCharge(side: string): number | null {
  let total = 0;
  for (const term of side.split(" + ")) {
    const m = term.match(/^(\d*)(.+?)\((?:s|l|g|aq)\)$/);
    if (!m) return null;
    const n = m[1] ? Number(m[1]) : 1;
    const cm = m[2].match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/);
    if (cm) {
      const mag = cm[1] ? supNum(cm[1]) : 1;
      total += n * (cm[2] === "⁺" ? mag : -mag);
    }
  }
  return total;
}

/** "+2" / "0" / "−2" — the deck writes charges with an explicit sign. */
const chg = (v: number): string => (v === 0 ? "0" : v > 0 ? `+${v}` : `−${-v}`);

/** Draw until the four option strings are distinct — bounded and
 *  deterministic; banks below make collisions rare, this makes them
 *  impossible to serve. */
function distinct4<T>(r: () => number, draw: (r: () => number) => T & { options: string[] }): T {
  for (let i = 0; i < 12; i++) {
    const q = draw(r);
    if (new Set(q.options).size === 4) return q;
  }
  throw new Error("could not draw 4 distinct options — parameter ranges too tight");
}

// ── the deck's balanced-equation bank (s9 quick check + s7 combustion) ──────

const BALANCE = [
  {
    skeleton: "Mg + O₂ → MgO",
    correct: "2Mg + O₂ → 2MgO",
    wrongs: [
      { eq: "Mg + O₂ → MgO₂", why: "This balanced by changing a subscript — MgO became MgO₂, a different substance. Slide 9's rule: use coefficients only, never change subscripts." },
      { eq: "Mg + O₂ → 2MgO", why: "Mg: 1 on the left but 2 on the right — atoms in must equal atoms out (slide 4)." },
      { eq: "2Mg + 2O₂ → 2MgO", why: "O: 4 on the left but 2 on the right — the atom ledger fails." },
    ],
    explanation: "Slide 9's reveal: 2Mg + O₂ → 2MgO. Mg: 2 = 2 and O: 2 = 2, adjusted with coefficients only.",
    slide: 9,
  },
  {
    skeleton: "H₂ + N₂ → NH₃",
    correct: "3H₂ + N₂ → 2NH₃",
    wrongs: [
      { eq: "H₂ + N₂ → 2NH₃", why: "H: 2 on the left but 6 on the right — atoms in must equal atoms out (slide 4)." },
      { eq: "2H₂ + N₂ → 2NH₃", why: "H: 4 on the left but 6 on the right." },
      { eq: "3H₂ + N₂ → NH₃", why: "N: 2 on the left but 1 on the right." },
    ],
    explanation: "Slide 9's reveal: 3H₂ + N₂ → 2NH₃. H: 6 = 6 and N: 2 = 2.",
    slide: 9,
  },
  {
    skeleton: "Fe + Cl₂ → FeCl₃",
    correct: "2Fe + 3Cl₂ → 2FeCl₃",
    wrongs: [
      { eq: "Fe + Cl₂ → FeCl₂", why: "This balanced by changing a subscript — FeCl₃ became FeCl₂, a different substance. Slide 9's rule: never change subscripts." },
      { eq: "2Fe + 3Cl₂ → FeCl₃", why: "Fe: 2 on the left but 1 on the right." },
      { eq: "Fe + 3Cl₂ → 2FeCl₃", why: "Fe: 1 on the left but 2 on the right." },
    ],
    explanation: "Slide 9's reveal: 2Fe + 3Cl₂ → 2FeCl₃. Fe: 2 = 2 and Cl: 6 = 6.",
    slide: 9,
  },
  {
    skeleton: "KClO₃ → KCl + O₂",
    correct: "2KClO₃ → 2KCl + 3O₂",
    wrongs: [
      { eq: "KClO₃ → KCl + O₂", why: "O: 3 on the left but 2 on the right — unbalanced as written." },
      { eq: "2KClO₃ → 2KCl + 2O₂", why: "O: 6 on the left but 4 on the right." },
      { eq: "2KClO₃ → KCl + 3O₂", why: "K and Cl: 2 on the left but 1 on the right." },
    ],
    explanation: "Slide 9's reveal: 2KClO₃ → 2KCl + 3O₂. K: 2 = 2, Cl: 2 = 2, O: 6 = 6.",
    slide: 9,
  },
  {
    skeleton: "C₃H₈ + O₂ → CO₂ + H₂O",
    correct: "C₃H₈ + 5O₂ → 3CO₂ + 4H₂O",
    wrongs: [
      { eq: "C₃H₈ + 5O₂ → 3CO₂ + 8H₂O", why: "H: 8 on the left but 16 on the right — 8 H atoms make 4 H₂O, slide 7's step 3." },
      { eq: "C₃H₈ + O₂ → 3CO₂ + 4H₂O", why: "O: 2 on the left but 10 on the right — slide 7's step 4 counts 6 + 4 = 10 O atoms → 5 O₂." },
      { eq: "C₃H₈ + 5O₂ → CO₂ + 4H₂O", why: "C: 3 on the left but 1 on the right — balance C first (slide 7's routine)." },
    ],
    explanation: "Slide 7's routine — balance C (3CO₂), then H (4H₂O), then O last: the right side has 6 + 4 = 10 O atoms, so 5O₂ goes on the left.",
    slide: 7,
  },
] as const;

// ── the deck's species pools for split-or-stay-whole (s10, s11, s19–s22) ────

const SPLITS = [
  { sp: "HCl(aq)", why: "Slide 14: in water HCl fully splits — HCl(aq) → H⁺(aq) + Cl⁻(aq)." },
  { sp: "HNO₃(aq)", why: "Slide 15: in water HNO₃ fully splits — HNO₃(aq) → H⁺(aq) + NO₃⁻(aq)." },
  { sp: "H₂SO₄(aq)", why: "Slide 16: H₂SO₄ donates TWO H⁺ — H₂SO₄(aq) → 2H⁺(aq) + SO₄²⁻(aq)." },
  { sp: "NaOH(aq)", why: "A group 1 hydroxide — slide 11 lists these among the species that dissolve fully into free ions." },
  { sp: "NaCl(aq)", why: "A soluble salt in (aq) — slide 10 shows NaCl dissociating into free Na⁺ and Cl⁻." },
  { sp: "AgNO₃(aq)", why: "Slide 11's own example: AgNO₃(aq) splits → Ag⁺ + NO₃⁻." },
  { sp: "KI(aq)", why: "Slide 22 splits it in the ionic working: 2K⁺ + 2I⁻." },
  { sp: "CuSO₄(aq)", why: "Slide 18 splits it: Cu²⁺ + SO₄²⁻ on the left." },
] as const;

const WHOLE = [
  { sp: "H₂O(l)", why: "Slide 20: liquid water does NOT split — water stays as a molecule." },
  { sp: "CaCO₃(s)", why: "Slide 19's trap: solid CaCO₃ does NOT split." },
  { sp: "PbI₂(s)", why: "Slide 22's common mistake is splitting PbI₂(s) — it is the solid product and stays whole." },
  { sp: "CO₂(g)", why: "A gas — slide 11: solids, liquids and gases stay together." },
  { sp: "AgCl(s)", why: "An insoluble salt — slide 11: insoluble salts stay whole." },
  { sp: "Cu(s)", why: "A solid metal deposit — slide 11: solids stay whole." },
  { sp: "BaSO₄(s)", why: "The precipitate of slide 23's Ba²⁺ + SO₄²⁻ → BaSO₄(s) — solids stay whole." },
] as const;

// ── polyatomic ions the deck names as single units (s8 rule, s25 list) ──────

const POLY = ["SO₄²⁻", "NO₃⁻", "OH⁻", "CO₃²⁻", "NH₄⁺", "PO₄³⁻"] as const;
const MONO = ["Na⁺", "Cl⁻", "H⁺", "Mg²⁺", "Ag⁺", "K⁺", "Cu²⁺", "I⁻"] as const;

// ── spectator bank — each row is a deck worked example, options authored ────

const SPECTATORS = [
  {
    rxn: "Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)",
    spect: "Cl⁻",
    others: [
      { opt: "H⁺", why: "H⁺ is not a spectator — slide 14: H⁺ does the reacting, leaving as H₂(g)." },
      { opt: "Mg²⁺", why: "Mg²⁺ appears only on the right — a spectator is the same on both sides (slide 18)." },
      { opt: "NO₃⁻" },
    ],
    explanation: "Slide 14's WE1: ionic is Mg(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂(g) — Cl⁻ is the spectator (2 each side); H⁺ does the reacting.",
    slide: 14,
  },
  {
    rxn: "Mg(s) + 2HNO₃(aq) → Mg(NO₃)₂(aq) + H₂(g)",
    spect: "NO₃⁻",
    others: [
      { opt: "H⁺", why: "H⁺ does the reacting (slide 15) — it is not a spectator." },
      { opt: "Mg²⁺", why: "Mg²⁺ appears only on the right — a spectator is the same on both sides (slide 18)." },
      { opt: "Cl⁻" },
    ],
    explanation: "Slide 15's WE1: ionic is Mg(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂(g) — NO₃⁻ is the spectator.",
    slide: 15,
  },
  {
    rxn: "Mg(s) + H₂SO₄(aq) → MgSO₄(aq) + H₂(g)",
    spect: "SO₄²⁻",
    others: [
      { opt: "H⁺", why: "H⁺ does the reacting (slide 16) — it is not a spectator." },
      { opt: "Mg²⁺" },
      { opt: "NO₃⁻" },
    ],
    explanation: "Slide 16's WE1: ionic is Mg(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂(g) — SO₄²⁻ is the spectator (1 each side).",
    slide: 16,
  },
  {
    rxn: "Zn(s) + CuSO₄(aq) → ZnSO₄(aq) + Cu(s)",
    spect: "SO₄²⁻",
    others: [
      { opt: "Cu²⁺", why: "Cu²⁺(aq) takes the electrons and ends as Cu(s) — slide 18: the ionic equation shows what really reacts." },
      { opt: "Zn²⁺" },
      { opt: "NO₃⁻" },
    ],
    explanation: "Slide 18: SO₄²⁻ is the spectator — same on both sides, drops out. The ionic equation Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s) shows what really reacts.",
    slide: 18,
  },
  {
    rxn: "NaOH(aq) + HCl(aq) → NaCl(aq) + H₂O(l)",
    spect: "Na⁺ and Cl⁻",
    others: [
      { opt: "H⁺ and OH⁻", why: "These are the reacting ions — H⁺(aq) + OH⁻(aq) → H₂O(l) (slide 20)." },
      { opt: "Na⁺ and OH⁻" },
      { opt: "H⁺ and Cl⁻" },
    ],
    explanation: "Slide 20: Na⁺ and Cl⁻ appear on both sides and cancel — the ionic equation is H⁺(aq) + OH⁻(aq) → H₂O(l).",
    slide: 20,
  },
  {
    rxn: "Pb(NO₃)₂(aq) + 2KI(aq) → PbI₂(s) + 2KNO₃(aq)",
    spect: "K⁺ and NO₃⁻",
    others: [
      { opt: "Pb²⁺ and I⁻", why: "These react — Pb²⁺(aq) + 2I⁻(aq) → PbI₂(s) (slide 22)." },
      { opt: "K⁺ and I⁻" },
      { opt: "Pb²⁺ and NO₃⁻" },
    ],
    explanation: "Slide 22: K⁺ and NO₃⁻ are spectators on both sides — ionic: Pb²⁺(aq) + 2I⁻(aq) → PbI₂(s).",
    slide: 22,
  },
  {
    rxn: "AgNO₃(aq) + NaCl(aq) → AgCl(s) + NaNO₃(aq)",
    spect: "Na⁺ and NO₃⁻",
    others: [
      { opt: "Ag⁺ and Cl⁻", why: "These react — Ag⁺ found Cl⁻ and formed insoluble AgCl (slide 2)." },
      { opt: "Na⁺ and Cl⁻" },
      { opt: "Ag⁺ and NO₃⁻" },
    ],
    explanation: "Slide 13: spectators Na⁺ and NO₃⁻ drop out — they don't take part. Ionic: Ag⁺(aq) + Cl⁻(aq) → AgCl(s).",
    slide: 13,
  },
  {
    rxn: "CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)",
    spect: "Cl⁻",
    others: [
      { opt: "H⁺", why: "H⁺ reacts with the carbonate — slide 19's ionic equation keeps CaCO₃(s) whole and shows 2H⁺ reacting." },
      { opt: "Ca²⁺" },
      { opt: "NO₃⁻" },
    ],
    explanation: "Slide 19: Cl⁻ appears on both sides and cancels — ionic: CaCO₃(s) + 2H⁺(aq) → Ca²⁺(aq) + H₂O(l) + CO₂(g).",
    slide: 19,
  },
] as const;

// ── observation ↔ ionic equation bank (s13, s17–s18, s21–s22, s24) ──────────

const OBSERVATIONS = [
  {
    obs: "two colourless solutions are mixed and a white precipitate forms",
    eq: "Ag⁺(aq) + Cl⁻(aq) → AgCl(s)",
    tag: "precipitation — two colourless solutions forming white AgCl(s) (slide 13)",
    explanation: "Slides 2 and 13: two colourless solutions form a white precipitate of AgCl(s). Ag⁺ found Cl⁻; spectators Na⁺ and NO₃⁻ drop out.",
    slide: 13,
  },
  {
    obs: "the blue solution fades and a brown solid deposits",
    eq: "Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s)",
    tag: "displacement — the blue solution fades and brown copper deposits (slide 18)",
    explanation: "Slide 18's displacement: blue → colourless as Cu²⁺(aq) leaves solution and brown Cu(s) deposits. Zn(s) gives 2 electrons; Cu²⁺(aq) takes them.",
    slide: 18,
  },
  {
    obs: "a bright yellow precipitate forms instantly",
    eq: "Pb²⁺(aq) + 2I⁻(aq) → PbI₂(s)",
    tag: "the bright yellow PbI₂(s) precipitate (slide 21)",
    explanation: "Slides 21–22: the bright yellow precipitate is PbI₂(s). Ionic: Pb²⁺(aq) + 2I⁻(aq) → PbI₂(s); K⁺ and NO₃⁻ are the spectators.",
    slide: 22,
  },
  {
    obs: "fizzing is seen and the gas turns limewater milky",
    eq: "CaCO₃(s) + 2H⁺(aq) → Ca²⁺(aq) + H₂O(l) + CO₂(g)",
    tag: "acid + carbonate — fizzing with the gas turning limewater milky (slide 24)",
    explanation: "Slide 24: fizzing plus limewater turning milky identifies CO₂ — acid + carbonate. CaCO₃(s) stays whole in the ionic equation.",
    slide: 24,
  },
  {
    obs: "there is vigorous fizzing and the magnesium ribbon dissolves",
    eq: "Mg(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂(g)",
    tag: "acid + metal — vigorous fizzing as H₂(g) forms (slide 22)",
    explanation: "Slides 21–22: vigorous fizzing is H₂(g) as the magnesium dissolves in the acid — ionic: Mg(s) + 2H⁺(aq) → Mg²⁺(aq) + H₂(g).",
    slide: 22,
  },
] as const;

// ── the acid grids (s14–s16): acid × partner → products ─────────────────────

const ACIDS = [
  { name: "HCl", salt: "a chloride salt", line: "slide 14: Cl⁻ pairs with the metal to form a chloride salt", slide: 14 },
  { name: "HNO₃", salt: "a nitrate salt", line: "slide 15: NO₃⁻ pairs with the metal to form a nitrate salt", slide: 15 },
  { name: "H₂SO₄", salt: "a sulfate salt", line: "slide 16: SO₄²⁻ pairs with the metal to form a sulfate salt", slide: 16 },
] as const;

const PARTNERS = [
  {
    name: "a reactive metal",
    extra: "+ H₂(g)",
    obsNote: "Fizzing observed → H₂(g) (slide 14).",
    whyTag: "the acid + METAL row — H₂(g) forms, with fizzing, when the acid meets a metal",
  },
  {
    name: "a base or alkali",
    extra: "+ H₂O",
    obsNote: "Classic neutralisation: water forms, no gas (slide 17).",
    whyTag: "the acid + BASE/ALKALI row — neutralisation gives water and no gas",
  },
  {
    name: "a carbonate",
    extra: "+ H₂O + CO₂",
    obsNote: "Fizzing; the gas turns limewater milky (slide 17).",
    whyTag: "the acid + CARBONATE row — H₂O and CO₂ form, with fizzing and milky limewater",
  },
] as const;

// ── charge-check bank — each left side is a deck ionic equation ─────────────

const CHARGE_CASES = [
  { left: "Ag⁺(aq) + Cl⁻(aq)", right: "AgCl(s)", ions: [[1, 1], [-1, 1]], calc: "(+1) + (−1) = 0", slide: 12 },
  { left: "Pb²⁺(aq) + 2I⁻(aq)", right: "PbI₂(s)", ions: [[2, 1], [-1, 2]], calc: "(+2) + 2 × (−1) = 0 — slide 29 writes it (+2) + (−2) = 0", slide: 29 },
  { left: "Mg(s) + 2H⁺(aq)", right: "Mg²⁺(aq) + H₂(g)", ions: [[0, 1], [1, 2]], calc: "0 + 2 × (+1) = +2, matching Mg²⁺ on the right", slide: 22 },
  { left: "Zn(s) + Cu²⁺(aq)", right: "Zn²⁺(aq) + Cu(s)", ions: [[0, 1], [2, 1]], calc: "0 + (+2) = +2 — slide 18's check: L: (+2), R: (+2)", slide: 18 },
  { left: "Ba²⁺(aq) + SO₄²⁻(aq)", right: "BaSO₄(s)", ions: [[2, 1], [-2, 1]], calc: "(+2) + (−2) = 0", slide: 23 },
  { left: "H⁺(aq) + OH⁻(aq)", right: "H₂O(l)", ions: [[1, 1], [-1, 1]], calc: "(+1) + (−1) = 0", slide: 20 },
  { left: "Cu(s) + 2Ag⁺(aq)", right: "Cu²⁺(aq) + 2Ag(s)", ions: [[0, 1], [1, 2]], calc: "0 + 2 × (+1) = +2, matching Cu²⁺ on the right", slide: 23 },
] as const;

// (a, b) pairs for the oxygen-last right side "→ aCO₂ + bH₂O". PAIRED, not
// independent draws: the stem asserts a combustion equation exists, so every
// pair must keep the implied fuel CₐH₂ᵦ a real hydrocarbon — (3,4) is the
// deck's own C₃H₈ (s7); (4,4), (5,6) and (6,6) are C₄H₈, C₅H₁₂ and C₆H₁₂.
// (An independent a × b grid manufactured impossible fuels like C₂H₈.)
// b even keeps the answer whole; a ≥ 3, b ≥ 4 keep all four options distinct.
const COMBUSTION_RHS = [
  [3, 4],
  [4, 4],
  [5, 6],
  [6, 6],
] as const;
// k even keeps the ÷2 distractor whole; the deck's own pair is k=2, j=3.
const ALOH3_COEFFS = [2, 4] as const;
const H2SO4_COEFFS = [3, 4, 5, 6] as const;

export const FAMILIES: Family[] = [
  // ══ 1.3 — definitions ═════════════════════════════════════════════════════
  {
    key: "l2-def-two-ledgers",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "definition",
    sourceSlides: [4, 6],
    groundingTerms: ["two ledgers", "atoms in = atoms out", "atom counts and total charge"],
    generate: (r) => {
      const correct = "Atom counts AND total charge";
      const options = shuffle(r, [
        correct,
        "Atom counts only",
        "Total charge only",
        "Coefficients AND subscripts",
      ]);
      return {
        stem: "Slide 4's big idea: every equation obeys two ledgers. What must balance on both sides?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 4: atoms in = atoms out · charge in = charge out. Slide 6's core rule repeats it: both sides of the equation must balance — atom counts AND total charge.",
        wrongWhy: {
          [options.indexOf("Atom counts only")]:
            "Half the ledger. The charge check matters most for ionic equations (slide 6) — slide 12: if charges don't balance, you missed a spectator.",
          [options.indexOf("Coefficients AND subscripts")]:
            "Coefficients are the tool you adjust to MAKE the ledgers balance (slide 6) — the ledgers themselves are atoms and charge.",
        },
        reviewSlide: 4,
      };
    },
  },
  {
    key: "l2-def-coefficients-only",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "definition",
    sourceSlides: [6, 9, 25],
    groundingTerms: ["the big numbers in front", "never change subscripts", "subscripts are part of the formula"],
    generate: (r) => {
      const correct = "The coefficients — the big numbers in front";
      const options = shuffle(r, [
        correct,
        "The subscripts inside the formulae",
        "Both the coefficients and the subscripts",
        "The state symbols",
      ]);
      return {
        stem: "When balancing an equation, which part of it are you allowed to change?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 6: coefficients (the big numbers in front) are the only thing you adjust — subscripts are part of the formula and are fixed. Slide 9 repeats it: use coefficients only, never change subscripts.",
        wrongWhy: {
          [options.indexOf("The subscripts inside the formulae")]:
            "Subscripts are part of the formula and are fixed (slide 6). Changing them — e.g. writing Al(OH)₂ or H₂SO₃ — is slide 25's named common mistake.",
          [options.indexOf("Both the coefficients and the subscripts")]:
            "Only the coefficients move. Slide 9's rule: use coefficients only — never change subscripts.",
          [options.indexOf("The state symbols")]:
            "State symbols record the physical state (slide 10) — the trap with them is FORGETTING them, not adjusting them. They are never a balancing tool.",
        },
        reviewSlide: 6,
      };
    },
  },

  // ══ 1.12 — definition (slides 10–11 are the deck's 1.12 coverage) ═════════
  {
    key: "l2-def-strong-electrolyte",
    lessonSlug: SLUG,
    specCode: "1.12",
    kind: "definition",
    sourceSlides: [10, 11],
    groundingTerms: ["strong electrolyte", "fully splits into ions when dissolved", "rule of thumb"],
    generate: (r) => {
      const correct = "A substance that fully splits into ions when dissolved";
      const options = shuffle(r, [
        correct,
        "A substance that stays whole when it dissolves",
        "Any species written with the state symbol (s)",
        "A weak acid in aqueous solution",
      ]);
      return {
        stem: "Slide 11's rule of thumb rests on one definition. What is a strong electrolyte?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 11: a strong electrolyte = a substance that fully splits into ions when dissolved. If the state is (aq) AND it's a strong electrolyte → write the ions separately; otherwise → keep it whole.",
        wrongWhy: {
          [options.indexOf("A substance that stays whole when it dissolves")]:
            "The opposite — staying whole is what solids, liquids, gases, water, weak acids and insoluble salts do (slide 11).",
          [options.indexOf("A weak acid in aqueous solution")]:
            "Slide 11 lists weak acids among the species that STAY WHOLE — never split them in an ionic equation.",
          [options.indexOf("Any species written with the state symbol (s)")]:
            "(s) species stay whole and never split (slide 10) — a strong electrolyte is defined by what happens when it dissolves.",
        },
        reviewSlide: 11,
      };
    },
  },

  // ══ 1.3 — classification: polyatomic ions are single units ════════════════
  {
    key: "l2-cls-polyatomic-unit",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "classification",
    sourceSlides: [8, 25],
    groundingTerms: ["never split a polyatomic ion", "treat it as one unit", "nh₄⁺"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const target = pick(r2, POLY);
        const foils = shuffle(r2, [...MONO]).slice(0, 3);
        const options = shuffle(r2, [target, ...foils]);
        return {
          stem: "Which of these is a polyatomic ion — one you treat as a single unit and never split when balancing?",
          options,
          correctIndex: options.indexOf(target),
          explanation:
            "Slide 8's exam rule: never split a polyatomic ion (SO₄, NO₃, CO₃, OH) when balancing — treat it as one unit. Slide 25's list: SO₄²⁻ · NO₃⁻ · OH⁻ · CO₃²⁻ · NH₄⁺ · PO₄³⁻.",
          wrongWhy: {},
          reviewSlide: 25,
        };
      }),
  },

  // ══ 1.12 — classification: what splits, what stays whole ══════════════════
  {
    key: "l2-cls-split-or-whole",
    lessonSlug: SLUG,
    specCode: "1.12",
    kind: "classification",
    sourceSlides: [10, 11, 19, 20, 22],
    groundingTerms: ["stays whole", "splits into ions", "state symbols"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const askSplit = r2() < 0.5;
        if (askSplit) {
          const target = pick(r2, SPLITS);
          const foils = shuffle(r2, [...WHOLE]).slice(0, 3);
          const options = shuffle(r2, [target.sp, ...foils.map((f) => f.sp)]);
          return {
            stem: "Turning a full equation into an ionic equation: which ONE of these species is written as separate ions?",
            options,
            correctIndex: options.indexOf(target.sp),
            explanation: `Slide 11's rule of thumb: state (aq) AND a strong electrolyte → write the ions separately. ${target.why} Everything (s), (l) or (g) stays whole.`,
            wrongWhy: Object.fromEntries(
              foils.map((f) => [options.indexOf(f.sp), f.why]),
            ),
            reviewSlide: 11,
          };
        }
        const target = pick(r2, WHOLE);
        const foils = shuffle(r2, [...SPLITS]).slice(0, 3);
        const options = shuffle(r2, [target.sp, ...foils.map((f) => f.sp)]);
        return {
          stem: "Turning a full equation into an ionic equation: which ONE of these species stays whole — never split into ions?",
          options,
          correctIndex: options.indexOf(target.sp),
          explanation: `${target.why} Slide 11: if a species is (s), (l) or (g) — or an (aq) species that does not fully dissociate — keep it whole.`,
          wrongWhy: Object.fromEntries(
            foils.map((f) => [options.indexOf(f.sp), f.why]),
          ),
          reviewSlide: 11,
        };
      }),
  },

  // ══ 1.12 — classification: name the spectator ═════════════════════════════
  {
    key: "l2-cls-spectator",
    lessonSlug: SLUG,
    specCode: "1.12",
    kind: "classification",
    sourceSlides: [13, 14, 15, 16, 18, 19, 20, 22],
    groundingTerms: ["spectator", "cl⁻ is the spectator", "so₄²⁻ is the spectator"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const c = pick(r2, SPECTATORS);
        const options = shuffle(r2, [c.spect, ...c.others.map((o) => o.opt)]);
        return {
          stem: `In ${c.rxn}, which ion(s) are the spectators — removed when writing the ionic equation?`,
          options,
          correctIndex: options.indexOf(c.spect),
          explanation: c.explanation,
          wrongWhy: Object.fromEntries(
            c.others
              .filter((o) => "why" in o && o.why)
              .map((o) => [options.indexOf(o.opt), (o as { opt: string; why: string }).why]),
          ),
          reviewSlide: c.slide,
        };
      }),
  },

  // ══ 1.12 — application: observation → ionic equation ══════════════════════
  {
    key: "l2-app-observation-to-ionic",
    lessonSlug: SLUG,
    specCode: "1.12",
    kind: "application",
    sourceSlides: [13, 17, 18, 22, 24],
    groundingTerms: ["white precipitate", "blue solution fades", "bright yellow precipitate", "limewater milky"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const t = pick(r2, OBSERVATIONS);
        const foils = shuffle(r2, OBSERVATIONS.filter((o) => o.eq !== t.eq)).slice(0, 3);
        const options = shuffle(r2, [t.eq, ...foils.map((o) => o.eq)]);
        return {
          stem: `In a test-tube experiment, ${t.obs}. Which ionic equation matches the observation?`,
          options,
          correctIndex: options.indexOf(t.eq),
          explanation: t.explanation,
          wrongWhy: Object.fromEntries(
            foils.map((o) => [
              options.indexOf(o.eq),
              `This equation belongs to a different observation: ${o.tag}.`,
            ]),
          ),
          reviewSlide: t.slide,
        };
      }),
    // §101 — re-derive the answer from the rendered stem with this verify's
    // OWN observation → decisive-species map (the deck's pairings: white
    // precipitate = AgCl s13, blue fading = Cu deposit s18, yellow = PbI₂
    // s21, limewater = CO₂ s24, dissolving Mg = H₂ s21): the labelled option
    // must contain the decisive species, every other option must lack it,
    // and the labelled ionic equation must re-parse as charge-balanced.
    verify: (q) => {
      const obs = q.stem.match(/In a test-tube experiment, (.+?)\. Which ionic equation/)?.[1];
      if (!obs) return false;
      const sig =
        obs.includes("white precipitate") ? "AgCl(s)"
        : obs.includes("blue") ? "Cu(s)"
        : obs.includes("yellow") ? "PbI₂(s)"
        : obs.includes("limewater") ? "CO₂(g)"
        : obs.includes("magnesium") ? "H₂(g)"
        : null;
      if (!sig) return false;
      const [l, rside] = q.options[q.correctIndex].split(" → ");
      if (!l || !rside) return false;
      const lc = sideCharge(l);
      const rc = sideCharge(rside);
      if (lc === null || rc === null || lc !== rc) return false;
      if (!q.options[q.correctIndex].includes(sig)) return false;
      return q.options.every((o, i) => i === q.correctIndex || !o.includes(sig));
    },
  },

  // ══ 1.12 — application: the acid grids ════════════════════════════════════
  {
    key: "l2-app-acid-products",
    lessonSlug: SLUG,
    specCode: "1.12",
    kind: "application",
    sourceSlides: [14, 15, 16, 17],
    groundingTerms: ["chloride salts", "nitrate salts", "sulfate salts", "carbonate"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const acid = pick(r2, ACIDS);
        const partner = pick(r2, PARTNERS);
        const otherPartners = PARTNERS.filter((p) => p.name !== partner.name);
        const otherAcid = pick(r2, ACIDS.filter((a) => a.name !== acid.name));
        const correct = `${acid.salt} ${partner.extra}`;
        const options = shuffle(r2, [
          correct,
          ...otherPartners.map((p) => `${acid.salt} ${p.extra}`),
          `${otherAcid.salt} ${partner.extra}`,
        ]);
        return {
          stem: `Dilute ${acid.name} reacts with ${partner.name}. Using the acid grids on slides 14–16, what forms?`,
          options,
          correctIndex: options.indexOf(correct),
          explanation: `The grid row: acid + ${partner.name.replace(/^a /, "")} → salt ${partner.extra}. With ${acid.name} the salt is ${acid.salt} — ${acid.line}. ${partner.obsNote}`,
          wrongWhy: Object.fromEntries(
            [
              ...otherPartners.map((p) => [
                options.indexOf(`${acid.salt} ${p.extra}`),
                `That is ${p.whyTag} (slides 14–16) — not what happens with ${partner.name}.`,
              ]),
              [
                options.indexOf(`${otherAcid.salt} ${partner.extra}`),
                `Wrong salt for this acid — ${acid.line}.`,
              ],
            ],
          ),
          reviewSlide: acid.slide,
        };
      }),
    // §101 — re-derive the row from the rendered stem with this verify's OWN
    // maps: the salt name comes from the acid's own anion (Cl → chloride,
    // NO₃ → nitrate, SO₄ → sulfate — s14–s16's headers) and the product tail
    // from the partner row (metal → H₂(g), base/alkali → H₂O, carbonate →
    // H₂O + CO₂ — the grids on s14–s16). The labelled option must satisfy
    // both; every other option must fail at least one.
    verify: (q) => {
      const m = q.stem.match(/^Dilute (HCl|HNO₃|H₂SO₄) reacts with (a reactive metal|a base or alkali|a carbonate)\./);
      if (!m) return false;
      const salt =
        m[1] === "HCl" ? "a chloride salt"
        : m[1] === "HNO₃" ? "a nitrate salt"
        : "a sulfate salt";
      const rowOk = (opt: string) => {
        if (!opt.startsWith(`${salt} + `)) return false;
        if (m[2] === "a reactive metal") return opt.endsWith("+ H₂(g)");
        if (m[2] === "a base or alkali") return opt.endsWith("+ H₂O");
        return opt.endsWith("+ H₂O + CO₂");
      };
      if (!rowOk(q.options[q.correctIndex])) return false;
      return q.options.every((o, i) => i === q.correctIndex || !rowOk(o));
    },
  },

  // ══ 1.3 — formula: pick the correctly balanced equation ═══════════════════
  {
    key: "l2-formula-balanced-form",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "formula",
    sourceSlides: [7, 9],
    groundingTerms: ["2mg + o₂ → 2mgo", "3h₂ + n₂ → 2nh₃", "2fe + 3cl₂ → 2fecl₃"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const c = pick(r2, BALANCE);
        const options = shuffle(r2, [c.correct, ...c.wrongs.map((w) => w.eq)]);
        return {
          stem: `Which is the correctly balanced form of ${c.skeleton}? (Coefficients only — never change subscripts.)`,
          options,
          correctIndex: options.indexOf(c.correct),
          explanation: c.explanation,
          wrongWhy: Object.fromEntries(
            c.wrongs.map((w) => [options.indexOf(w.eq), w.why]),
          ),
          reviewSlide: c.slide,
        };
      }),
    // §101 — re-parse the labelled equation atom-by-atom: it must balance AND
    // keep the skeleton's formulas, and every other option must fail one of
    // those two tests (a subscript change fails the first, an unbalanced
    // coefficient set fails the second).
    verify: (q) => {
      const skeleton = q.stem.match(/balanced form of (.+?)\?/)?.[1];
      if (!skeleton) return false;
      const good = (eq: string) => keepsSpecies(skeleton, eq) && sidesBalance(eq);
      if (!good(q.options[q.correctIndex])) return false;
      return q.options.every((o, i) => i === q.correctIndex || !good(o));
    },
  },

  // ══ 1.3 — calculations: the deck's own counting, independently verified ═══
  {
    key: "l2-calc-oxygen-last",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "calculation",
    sourceSlides: [7],
    groundingTerms: ["save oxygen for last", "3co₂ + 4h₂o", "o atoms"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const [a, b] = pick(r2, COMBUSTION_RHS);
        const need = (2 * a + b) / 2;
        const options = shuffle(r2, [
          `${need} O₂`,
          `${2 * a + b} O₂`, // gave the O ATOM count, forgot to halve — s7 halves 10 → 5
          `${a + b} O₂`, // dropped CO₂'s two oxygens — s7 counts 6 + 4
          `${need + 1} O₂`,
        ]);
        return {
          stem: `A combustion equation's right-hand side has been settled first (slide 7's routine — C, then H, then O last): → ${a}CO₂ + ${b}H₂O. How many O₂ are needed on the left?`,
          options,
          correctIndex: options.indexOf(`${need} O₂`),
          explanation: `Right side: ${2 * a} + ${b} = ${2 * a + b} O atoms → ${need} O₂ — slide 7's step 4. Save oxygen for last: O splits across BOTH products, so its count depends on the C and H work already done.`,
          wrongWhy: {
            [options.indexOf(`${2 * a + b} O₂`)]:
              "That is the number of O ATOMS on the right — slide 7 halves it (10 O atoms → 5 O₂), because each O₂ brings two.",
            [options.indexOf(`${a + b} O₂`)]:
              "This counted one O per CO₂ — each CO₂ carries two O, the way slide 7 counts 6 + 4 = 10.",
          },
          reviewSlide: 7,
        };
      }),
    verify: (q) => {
      const m = q.stem.match(/→ (\d+)CO₂ \+ (\d+)H₂O/);
      const got = Number(q.options[q.correctIndex].match(/^(\d+) O₂$/)?.[1]);
      if (!m || !Number.isFinite(got)) return false;
      const a = Number(m[1]);
      const b = Number(m[2]);
      const expected = a + b / 2; // independent route: one O₂ per CO₂, one per two H₂O
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l2-calc-hydrogen-count",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "calculation",
    sourceSlides: [8, 25],
    groundingTerms: ["al(oh)₃", "h₂so₄", "6 h₂o"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const k = pick(r2, ALOH3_COEFFS);
        const j = pick(r2, H2SO4_COEFFS);
        const h = 3 * k + 2 * j;
        const options = shuffle(r2, [
          `${h} H atoms`,
          `${k + j} H atoms`, // ignored the subscripts entirely
          `${3 * k + j} H atoms`, // forgot H₂SO₄ carries 2 H — s16: "donates TWO H⁺"
          `${h / 2} H atoms`, // the H₂O count, not the H atom count — s25: 12 H → 6 H₂O
        ]);
        return {
          stem: `Slide 25 counts hydrogen as coefficient × subscript. How many H atoms are there in total in ${k}Al(OH)₃ + ${j}H₂SO₄?`,
          options,
          correctIndex: options.indexOf(`${h} H atoms`),
          explanation: `${k} × 3 = ${3 * k} H from Al(OH)₃ and ${j} × 2 = ${2 * j} H from H₂SO₄ — ${3 * k} + ${2 * j} = ${h} H. Exactly slide 25's step 3: 6 H (from 2×3) + 6 H (from 3×2) = 12 H.`,
          wrongWhy: {
            [options.indexOf(`${k + j} H atoms`)]:
              "This added the coefficients and ignored the subscripts — slide 25 counts coefficient × H per formula (2×3 and 3×2).",
            [options.indexOf(`${3 * k + j} H atoms`)]:
              "This gave H₂SO₄ one hydrogen — slide 16: H₂SO₄ donates TWO H⁺ per molecule.",
            [options.indexOf(`${h / 2} H atoms`)]:
              "This is how many H₂O those atoms would make (slide 25: 12 H → 6 H₂O), not the atom count itself.",
          },
          reviewSlide: 25,
        };
      }),
    verify: (q) => {
      const m = q.stem.match(/in (\d+)Al\(OH\)₃ \+ (\d+)H₂SO₄/);
      const got = Number(q.options[q.correctIndex].match(/^(\d+) H atoms$/)?.[1]);
      if (!m || !Number.isFinite(got)) return false;
      const k = Number(m[1]);
      const j = Number(m[2]);
      const expected = k * 3 + j * 2; // re-derived from the rendered coefficients
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l2-calc-charge-check",
    lessonSlug: SLUG,
    specCode: "1.3",
    kind: "calculation",
    sourceSlides: [12, 18, 20, 22, 23, 29],
    groundingTerms: ["charge check", "(+1) + (−1) = 0", "missed a spectator"],
    generate: (r) => {
      const c = pick(r, CHARGE_CASES);
      const correct = c.ions.reduce((s, [q, n]) => s + q * n, 0);
      const noCoeff = c.ions.reduce((s, [q]) => s + q, 0);
      const absTot = c.ions.reduce((s, [q, n]) => s + Math.abs(q) * n, 0);
      const wrongs: number[] = [];
      for (const v of [noCoeff, absTot, correct + 1, correct - 1, correct + 2]) {
        if (v !== correct && !wrongs.includes(v) && wrongs.length < 3) wrongs.push(v);
      }
      const options = shuffle(r, [correct, ...wrongs].map(chg));
      const hasCoeff = c.ions.some(([, n]) => n > 1);
      const noCoeffIdx = options.indexOf(chg(noCoeff));
      return {
        stem: `Charge check — step 4 of slide 12's procedure. What is the total charge on the left-hand side of ${c.left} → ${c.right}?`,
        options,
        correctIndex: options.indexOf(chg(correct)),
        explanation: `${c.calc}. Slide 12's rule: the ionic equation must balance both atoms and total charge — if charges don't balance, you missed a spectator.`,
        wrongWhy:
          hasCoeff && noCoeff !== correct && noCoeffIdx >= 0
            ? {
                [noCoeffIdx]:
                  "A coefficient multiplies the charge — two ions carrying one unit each contribute two units, the way slide 29 counts 2I⁻ as (−2).",
              }
            : {},
        reviewSlide: c.slide,
      };
    },
    // §101 — re-parse each ion term of the RENDERED left side (coefficient,
    // superscript charge, sign) and re-sum; integer charges, so exact match.
    verify: (q) => {
      const left = q.stem.match(/left-hand side of (.+?) → /)?.[1];
      if (!left) return false;
      const total = sideCharge(left);
      if (total === null) return false;
      const os = q.options[q.correctIndex];
      const got =
        os === "0" ? 0
        : os.startsWith("+") ? Number(os.slice(1))
        : os.startsWith("−") ? -Number(os.slice(1))
        : NaN;
      return Number.isFinite(got) && got === total;
    },
  },
];
