/**
 * A chemical equation, parsed into structure.
 *
 * ============================================================================
 * WHY THIS IS NOT STRING COMPARISON
 * ============================================================================
 * `2H2 + O2 → 2H2O` and `2 H₂ + O₂ -> 2 H₂O` are the same answer. So are
 * `C12H26 + 18.5O2 → 12CO2 + 13H2O` and its doubled form — 20(b)(ii)'s mark
 * scheme says "Allow multiples" in so many words. A marker that compared text
 * would fail every one of those, and would pass `12CO2 + 13H2O → C12H26 +
 * 18.5O2`, which is combustion written backwards.
 *
 * So an equation becomes: two multisets of (coefficient, species) and an arrow.
 * A species becomes: a map of element to count, a charge, and a state symbol.
 * Everything downstream compares those, never the text they came from.
 *
 * ============================================================================
 * IT FAILS CLOSED
 * ============================================================================
 * Every parse returns either a structure or a REASON. There is no partial
 * parse, no "best effort", and no branch that guesses at what a student meant.
 * A marker that awards marks on a guess carries the authority of arithmetic
 * with the reliability of a heuristic — the same rule deterministic.ts states,
 * applied to a harder input.
 *
 * Pure: no database, no network, no imports. Given a string it returns the same
 * structure on any machine, which is what lets Tier 1 award real marks for it.
 */

// ============================================================================
// RATIONALS — because 18.5 O2 is the mark scheme's own answer
// ============================================================================

/**
 * Coefficients are rationals, not numbers.
 *
 * ⚠ 20(b)(ii)'s canonical answer is `C12H26 + 18.5O2 → 12CO2 + 13H2O`. Half
 * coefficients are ordinary in combustion, students write `37/2` as often as
 * `18.5`, and "allow multiples" means the comparison is up to a scalar. Doing
 * that in floating point makes 18.5 × 2 ÷ 37 a number that is nearly 1, and
 * "nearly balanced" is not a thing a mark scheme recognises.
 */
export type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function rational(n: number, d = 1): Rational {
  if (d === 0) throw new Error("rational: zero denominator");
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export const rAdd = (a: Rational, b: Rational): Rational =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const rMul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const rDiv = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
export const rEq = (a: Rational, b: Rational): boolean => a.n * b.d === b.n * a.d;
export const rIsZero = (a: Rational): boolean => a.n === 0;
export const rIsPositive = (a: Rational): boolean => a.n > 0;
export const rToString = (a: Rational): string => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);

/**
 * For evidence. A student who typed `18.5` should not be shown `37/2` in the
 * sentence quoting their own answer back at them.
 *
 * Only when the decimal terminates — a denominator of 3 stays a fraction rather
 * than becoming 0.333….
 */
export function rToDisplay(a: Rational): string {
  if (a.d === 1) return `${a.n}`;
  let d = a.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1 ? String(a.n / a.d) : `${a.n}/${a.d}`;
}

/**
 * Parses "2", "18.5", "37/2", "0.5". Returns null for anything else.
 *
 * ⚠ BOUNDED. A 400-digit coefficient overflowed to Infinity, gcd returned NaN,
 * and the student was shown "NaN/NaN" in the evidence for a real zero. No
 * equation needs a coefficient in the thousands; anything larger is refused so
 * it reaches the unmarkable path instead.
 */
const MAX_COEFFICIENT = 100_000;

export function parseCoefficient(text: string): Rational | null {
  const t = text.trim();
  if (t === "") return rational(1);
  let m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : rational(Number(m[1]), Number(m[2]));
  m = /^(\d+)\.(\d+)$/.exec(t);
  if (m) {
    const scale = 10 ** m[2].length;
    return rational(Number(m[1]) * scale + Number(m[2]), scale);
  }
  m = /^(\d+)$/.exec(t);
  if (m) return rational(Number(m[1]));
  return null;
}

function withinBounds(r: Rational | null): Rational | null {
  if (!r) return null;
  if (!Number.isFinite(r.n) || !Number.isFinite(r.d)) return null;
  return Math.abs(r.n) > MAX_COEFFICIENT || r.d > MAX_COEFFICIENT ? null : r;
}

// ============================================================================
// NORMALISATION — every way a student can type the same character
// ============================================================================

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/**
 * ⚠ SUB- AND SUPERSCRIPT DIGITS BOTH BECOME PLAIN DIGITS, and that is safe
 * ONLY because of where each can legally appear. A subscript is a count and
 * follows an element or a `)`; a superscript is a charge magnitude and is
 * followed by `+` or `-`. `SO₄²⁻` becomes `SO42-`, which the charge rule below
 * reads back correctly as sulfate. Keeping them distinct would buy nothing and
 * would leave `SO4^2-` — the way most students type it — as a separate case.
 */
export function normalise(raw: string): string {
  let s = raw.normalize("NFKC");
  for (let i = 0; i < 10; i++) {
    s = s.split(SUBSCRIPTS[i]).join(String(i));
    s = s.split(SUPERSCRIPTS[i]).join(String(i));
  }
  s = s
    .replace(/[⁺]/g, "+")
    .replace(/[⁻−–—]/g, "-") // superscript minus, true minus, en dash, em dash
    .replace(/[·•]/g, ".") // hydrate dots
    .replace(/ /g, " ");
  // ⚠ VIA A SENTINEL, NOT BY ORDERING. Doing reversible first and single second
  // looks right and is not: the single-arrow pass then finds the `=>` inside
  // the `<=>` it just wrote and turns `A <=> B` into `A < -> B`. Every
  // reversible form failed to parse. The placeholder cannot be re-matched.
  // ⚠ THINGS STUDENTS TYPE THAT MEAN NOTHING CHEMICALLY.
  //
  // A trailing full stop made the WHOLE answer unmarkable and blamed the state
  // symbol it was attached to. A comma decimal ("18,5") is how most of Europe
  // writes 18.5. Spaces inside a formula ("C12 H26", "Ca (OH)2") are ordinary
  // handwriting habits. None changes what the student means, and refusing them
  // sends a correct answer to a human for no reason.
  s = s.replace(/[.;,]+\s*$/, "");
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  const REV = "\u0001";
  s = s.replace(/<-->|<=>|<->|⇌|⇄|⇆|⇋|↔|⟷/g, REV);
  s = s.replace(/-->|->|→|⟶|⇒|=>/g, " -> ");
  s = s.split(REV).join(" <=> ");
  return s.replace(/\s+/g, " ").trim();
}

// ============================================================================
// SPECIES
// ============================================================================

export type StateSymbol = "s" | "l" | "g" | "aq";

export type Species = {
  /** Element symbol to atom count. The identity of the substance. */
  atoms: Map<string, number>;
  /** Net charge. 0 for a neutral species. */
  charge: number;
  /** null when the student wrote none — which is different from a wrong one. */
  state: StateSymbol | null;
  /** As typed, after normalisation. For evidence strings only, never compared. */
  text: string;
};

export type ParseFailure = { ok: false; reason: string };
export type Parsed<T> = { ok: true; value: T } | ParseFailure;


/** True for "Fe", "Ca", "O" — one element symbol and nothing else. */
function isSingleElement(text: string): boolean {
  return /^[A-Z][a-z]{0,2}$/.test(text) && ELEMENTS.has(text);
}

/**
 * ⚠ `(I)` AND `(1)` ARE LIQUIDS, NOT IODINE AND NOT A NUMBER.
 *
 * A capital I is indistinguishable from a lower-case L in most sans-serif
 * fonts, and `1` sits next to both on a keyboard. `C12H26(I)` used to parse as
 * dodecane bonded to an iodine atom in a bracketed group — a different
 * substance — and a perfect answer scored 0/2. There is no formula in which a
 * trailing bracketed lone `I` or `1` is meaningful, so reading them as `(l)`
 * costs nothing and rescues an answer that is right.
 */
const STATE_RE = /\((s|l|g|aq|i|1)\)\s*$/i;
const STATE_ALIASES: Record<string, StateSymbol> = { i: "l", "1": "l" };

/**
 * Parse one species: `2` is NOT included — coefficients belong to the term.
 *
 * Handles `Ca(OH)2`, `C12H26`, `CuSO4.5H2O`, `SO4^2-`, `SO42-`, `Fe3+`, and a
 * trailing state symbol.
 */
export function parseSpecies(raw: string): Parsed<Species> {
  // ⚠ NORMALISES ITS OWN INPUT. parseEquation normalises before splitting, so
  // this used to receive clean text and assume it always would — and then
  // `parseSpecies("SO4²⁻")` called on its own silently failed. A function that
  // is exported is a function that will be called directly. normalise() is
  // idempotent, so doing it twice costs nothing.
  // Spaces inside one species carry no meaning — `C12 H26` and `Ca (OH)2` are
  // the same substances as their closed-up forms. The term was already split
  // on `+` and the arrow, so nothing can be joined that should not be.
  const text = normalise(raw).replace(/\s+/g, "").trim();
  if (!text) return { ok: false, reason: "an empty term" };

  // ── state symbol, from the right ────────────────────────────────────────
  // Taken off first so `(aq)` can never be mistaken for a group like `(OH)`.
  let body = text;
  let state: StateSymbol | null = null;
  const stateMatch = STATE_RE.exec(body);
  if (stateMatch) {
    const raw2 = stateMatch[1].toLowerCase();
    state = (STATE_ALIASES[raw2] ?? raw2) as StateSymbol;
    body = body.slice(0, stateMatch.index).trim();
  }
  if (!body) return { ok: false, reason: `"${text}" is a state symbol with no substance` };

  // ── charge, also from the right ─────────────────────────────────────────
  // `SO4^2-`, `SO42-`, `Fe3+`, `Na+`. Digits immediately before a trailing
  // +/- are the MAGNITUDE, which is why `Fe3+` is one iron ion and not three
  // iron atoms — the universal plain-text convention.
  // ⚠ THE HARDEST AMBIGUITY IN PLAIN-TEXT CHEMISTRY, AND IT IS NOT OPTIONAL.
  //
  // A digit sitting between a formula and a bare sign is either the charge
  // magnitude or the last element's subscript, and BOTH readings are valid
  // notation:
  //
  //   Fe3+   iron(III)      -> charge +3, formula Fe        (digit = charge)
  //   NO3-   nitrate        -> charge -1, formula NO3       (digit = subscript)
  //
  // The first version took the digit as the charge unconditionally, which was
  // right for Fe3+ and wrong for every ±1 polyatomic ion on the syllabus:
  // NH4+ became {N,H} charge +4, NO3- became {N,O} charge -3, MnO4- became
  // {Mn,O} charge -4. Those are not near misses, they are different
  // substances — and because the mangled parse still BALANCES against itself,
  // a perfect ionic equation came back markable with a real zero and a false
  // statement about its own atom counts. Fail-closed protects what the parser
  // knows it cannot read; this was reading confidently and wrongly.
  //
  // THE RULE, which is exact for every ion in A-level chemistry:
  //
  //   ^n±        explicit: n is the charge, however many digits
  //   two or     the LAST digit is the charge, the rest stay in the formula
  //   more       SO42- -> SO4 charge 2-;  Cr2O72- -> Cr2O7 charge 2-
  //   exactly    charge IFF the formula without it is a single element.
  //   one        Fe3+ -> "Fe" is one element  -> charge +3
  //              NO3- -> "NO" is two elements -> subscript, charge -1
  //              O2-  -> "O" is one element   -> charge -2 (oxide, correct)
  //   none       magnitude 1:  Na+, Cl-, OH-
  //
  // Residual ambiguity, stated rather than hidden: a HOMONUCLEAR polyatomic ion
  // — I3-, azide N3-, superoxide O2- — reads as monatomic with a large charge.
  // Those are genuinely ambiguous in this notation and are not A-level core;
  // `I3^-` says it unambiguously and is parsed exactly.
  let charge = 0;
  const explicit = /\^(\d*)([+-])$/.exec(body);
  if (explicit) {
    const magnitude = explicit[1] === "" ? 1 : Number(explicit[1]);
    charge = explicit[2] === "+" ? magnitude : -magnitude;
    body = body.slice(0, explicit.index);
  } else {
    const bare = /(\d*)([+-])$/.exec(body);
    if (bare) {
      const digits = bare[1];
      const sign = bare[2] === "+" ? 1 : -1;
      const before = body.slice(0, bare.index);
      if (digits.length === 0) {
        charge = sign;
        body = before;
      } else if (digits.length >= 2) {
        charge = sign * Number(digits[digits.length - 1]);
        body = before + digits.slice(0, -1);
      } else {
        // Exactly one digit: charge only if what precedes it is one element.
        charge = isSingleElement(before) ? sign * Number(digits) : sign;
        body = isSingleElement(before) ? before : before + digits;
      }
    }
  }
  if (!body) return { ok: false, reason: `"${text}" is a charge with no formula` };

  // ── hydrates: CuSO4.5H2O ────────────────────────────────────────────────
  const atoms = new Map<string, number>();
  for (const part of body.split(".")) {
    if (!part) return { ok: false, reason: `"${text}" has an empty part around a dot` };
    const lead = /^(\d+)(?=[A-Z(])/.exec(part);
    const multiplier = lead ? Number(lead[1]) : 1;
    const formula = lead ? part.slice(lead[0].length) : part;
    const parsed = parseFormula(formula);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    for (const [el, n] of parsed.value) {
      atoms.set(el, (atoms.get(el) ?? 0) + n * multiplier);
    }
  }
  if (atoms.size === 0) return { ok: false, reason: `"${text}" has no elements in it` };

  return { ok: true, value: { atoms, charge, state, text } };
}


/**
 * ⚠ THE PERIODIC TABLE IS THE VALIDATOR. Without it `/^[A-Z][a-z]{0,2}/`
 * happily reads `Zz` as an element, and an equation containing a substance that
 * does not exist parsed, balanced against itself, and was marked ZERO — when
 * the honest answer is that it could not be read and a human should look.
 * Fails closed, like every other branch here.
 */
const ELEMENTS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" "));

/** The recursive part: elements, counts and bracketed groups. */
function parseFormula(formula: string, depth = 0): Parsed<Map<string, number>> {
  // ⚠ THE ONLY PATH IN THIS FILE THAT COULD THROW. Nested brackets recurse, so
  // `((((…))))` blew the stack with a RangeError instead of returning a
  // failure — a crash rather than "left for a human", which is the one outcome
  // the fail-closed contract does not allow. Real formulae nest twice.
  if (depth > 8) {
    return { ok: false, reason: `"${formula}" has brackets nested too deeply to read` };
  }
  const atoms = new Map<string, number>();
  let i = 0;

  const readCount = (): number => {
    const m = /^\d+/.exec(formula.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };

  while (i < formula.length) {
    const ch = formula[i];

    if (ch === "(" || ch === "[") {
      const close = ch === "(" ? ")" : "]";
      let depth = 0;
      let j = i;
      for (; j < formula.length; j++) {
        if (formula[j] === ch) depth++;
        else if (formula[j] === close) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) return { ok: false, reason: `"${formula}" has an unclosed bracket` };
      const inner = parseFormula(formula.slice(i + 1, j), depth + 1);
      if (!inner.ok) return inner;
      i = j + 1;
      const n = readCount();
      for (const [el, c] of inner.value) atoms.set(el, (atoms.get(el) ?? 0) + c * n);
      continue;
    }

    // Longest match first: `Cl` before `C`, `Br` before `B`. A greedy regex
    // would read `Co` in `CoCl2` correctly but `C` in `Cs` wrongly, so the
    // candidates are tried in descending length against the real table.
    const ahead = formula.slice(i);
    const symbol =
      [3, 2, 1]
        .map((n) => ahead.slice(0, n))
        .find((c) => /^[A-Z][a-z]*$/.test(c) && ELEMENTS.has(c)) ?? null;
    if (!symbol) {
      const guess = /^[A-Z][a-z]{0,2}/.exec(ahead)?.[0] ?? ahead.slice(0, 3);
      return {
        ok: false,
        reason: `"${formula}" could not be read as a formula — "${guess}" is not an element`,
      };
    }
    const el = [symbol];
    i += el[0].length;
    const n = readCount();
    atoms.set(el[0], (atoms.get(el[0]) ?? 0) + n);
  }

  if (atoms.size === 0) return { ok: false, reason: `"${formula}" is empty` };
  return { ok: true, value: atoms };
}

// ============================================================================
// EQUATIONS
// ============================================================================

export type Term = { coefficient: Rational; species: Species };
export type ArrowKind = "single" | "reversible";

export type Equation = {
  left: Term[];
  right: Term[];
  arrow: ArrowKind;
};

/**
 * Split one side into terms on `+`.
 *
 * ⚠ A `+` IS ONLY A SEPARATOR WHEN IT HAS SPACE BEFORE IT. `Na+ + Cl-` is two
 * ions, not three terms: the first `+` is welded to `Na` and is its charge, the
 * second stands alone. This is the one place the parser depends on a student's
 * spacing, and it depends on it in the direction students actually write —
 * nobody writes a charge as `Na +`.
 */
function splitTerms(side: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < side.length; i++) {
    const ch = side[i];
    if (ch === "+" && current.trim() !== "") {
      // What comes next decides. A term can only begin with a coefficient, an
      // element, or a bracket — so if the next thing is one of those, this `+`
      // joins two terms. If it is anything else (end of side, or the `+` of a
      // separator still to come) the `+` belongs to the token as its charge.
      //
      //   Na+ + Cl-   first `+` is followed by `+` -> charge; second by `C` -> separator
      //   H2+O2       followed by `O` -> separator, which is what a student means
      //   ... -> Na+  followed by nothing -> charge
      const rest = side.slice(i + 1).trimStart();
      // ...but a bracket that opens a STATE SYMBOL is not a new term. `Ag+
      // (aq) + Cl- (aq)` writes the charge and the state apart, and reading
      // that first `+` as a separator split silver from its own state symbol.
      const startsTerm = /^[0-9A-Z[]/.test(rest) || (/^\(/.test(rest) && !STATE_RE.test(rest.slice(0, 4)));
      if (startsTerm) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

function parseTerm(raw: string): Parsed<Term> {
  const text = raw.trim();
  // A leading number is a coefficient only when a formula follows it.
  const lead = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(?=[A-Z(\[])/.exec(text);
  const coefficient = lead ? withinBounds(parseCoefficient(lead[1])) : rational(1);
  if (!coefficient) return { ok: false, reason: `"${text}" has a coefficient that could not be read` };
  if (rIsZero(coefficient)) return { ok: false, reason: `"${text}" has a coefficient of zero` };
  const species = parseSpecies(lead ? text.slice(lead[0].length) : text);
  if (!species.ok) return species;
  return { ok: true, value: { coefficient, species: species.value } };
}

export function parseEquation(raw: string): Parsed<Equation> {
  const text = normalise(raw);
  if (!text) return { ok: false, reason: "Nothing was written." };

  const reversible = text.includes("<=>");
  const marker = reversible ? "<=>" : "->";
  const sides = text.split(marker);
  if (sides.length === 1) {
    return {
      ok: false,
      reason: "No arrow was found — an equation needs a reactant side and a product side.",
    };
  }
  if (sides.length > 2) {
    return { ok: false, reason: "More than one arrow was found." };
  }
  // A single `->` alongside a `<=>` would have been split on `<=>` above, so
  // this catches the reverse: an equation with both kinds of arrow.
  if (reversible && sides.some((s) => s.includes("->"))) {
    return { ok: false, reason: "The equation mixes a reversible arrow with a single arrow." };
  }

  const parseSide = (side: string, name: string): Parsed<Term[]> => {
    const raws = splitTerms(side);
    if (raws.length === 0) return { ok: false, reason: `The ${name} side is empty.` };
    const terms: Term[] = [];
    for (const r of raws) {
      const t = parseTerm(r);
      if (!t.ok) return { ok: false, reason: `On the ${name} side, ${t.reason}` };
      terms.push(t.value);
    }
    return { ok: true, value: terms };
  };

  const left = parseSide(sides[0], "left");
  if (!left.ok) return left;
  const right = parseSide(sides[1], "right");
  if (!right.ok) return right;

  return {
    ok: true,
    value: { left: left.value, right: right.value, arrow: reversible ? "reversible" : "single" },
  };
}

// ============================================================================
// STRUCTURAL FACTS
// ============================================================================

/** A species' identity, ignoring state. Two species are the same substance iff equal. */
export function speciesKey(s: Species): string {
  const atoms = [...s.atoms.entries()].sort(([a], [b]) => a.localeCompare(b));
  return atoms.map(([el, n]) => `${el}${n}`).join("") + (s.charge ? `^${s.charge}` : "");
}

function tally(terms: Term[]): Map<string, Rational> {
  const total = new Map<string, Rational>();
  for (const t of terms) {
    for (const [el, n] of t.species.atoms) {
      total.set(el, rAdd(total.get(el) ?? rational(0), rMul(t.coefficient, rational(n))));
    }
  }
  return total;
}

function chargeTotal(terms: Term[]): Rational {
  return terms.reduce(
    (acc, t) => rAdd(acc, rMul(t.coefficient, rational(t.species.charge))),
    rational(0),
  );
}

export type BalanceReport = {
  balanced: boolean;
  /** Elements whose totals differ, with both sides. Empty when balanced. */
  offBy: { element: string; left: string; right: string }[];
  chargeBalanced: boolean;
};

/** Atom-by-atom, and charge. Nothing here looks at the expected answer. */
export function checkBalance(eq: Equation): BalanceReport {
  const l = tally(eq.left);
  const r = tally(eq.right);
  const elements = new Set([...l.keys(), ...r.keys()]);
  const offBy: BalanceReport["offBy"] = [];
  for (const el of [...elements].sort()) {
    const a = l.get(el) ?? rational(0);
    const b = r.get(el) ?? rational(0);
    if (!rEq(a, b)) offBy.push({ element: el, left: rToString(a), right: rToString(b) });
  }
  const chargeBalanced = rEq(chargeTotal(eq.left), chargeTotal(eq.right));
  return { balanced: offBy.length === 0, offBy, chargeBalanced };
}

/** The multiset of species on one side, keyed by identity, with coefficients. */
function sideMap(terms: Term[]): Map<string, Rational> {
  const m = new Map<string, Rational>();
  for (const t of terms) {
    const k = speciesKey(t.species);
    m.set(k, rAdd(m.get(k) ?? rational(0), t.coefficient));
  }
  return m;
}

const sameKeys = (a: Map<string, Rational>, b: Map<string, Rational>): boolean =>
  a.size === b.size && [...a.keys()].every((k) => b.has(k));

/**
 * Are two sides the same up to one positive scalar?
 *
 * "Allow multiples" is 20(b)(ii)'s own wording, so `2C12H26 + 37O2 → 24CO2 +
 * 26H2O` earns the equation mark exactly as the half-coefficient form does.
 * The scale is taken from one species and then REQUIRED of every other — a
 * per-species ratio would accept an equation that is not a multiple at all.
 */
function scaleBetween(a: Map<string, Rational>, b: Map<string, Rational>): Rational | null {
  if (!sameKeys(a, b)) return null;
  let scale: Rational | null = null;
  for (const [k, av] of a) {
    const bv = b.get(k)!;
    const ratio = rDiv(av, bv);
    if (!rIsPositive(ratio)) return null;
    if (scale === null) scale = ratio;
    else if (!rEq(scale, ratio)) return null;
  }
  return scale;
}

export type StateComparison = {
  /** Every species the student gave a state for has the RIGHT state. */
  allCorrect: boolean;
  /** Species with no state symbol at all. */
  missing: string[];
  /** Species whose state is present but wrong, with what was expected. */
  wrong: { species: string; got: StateSymbol; wanted: StateSymbol[] }[];
};

export type EquationComparison = {
  /** Same species on the same sides, up to a positive scalar multiple. */
  equivalent: boolean;
  /** The multiple, when equivalent. `1` for an exact match. */
  scale: Rational | null;
  /** The student's own equation balances, independent of the expected answer. */
  balance: BalanceReport;
  /** Arrow kinds agree. */
  arrowMatches: boolean;
  /** Reactants and products are the right species but on the wrong sides. */
  reversed: boolean;
  /** Which species are present but shouldn't be, and which are missing. */
  extraSpecies: string[];
  missingSpecies: string[];
};

/**
 * Compare a student's equation to the expected one, structurally.
 *
 * ⚠ NOTHING HERE READS STATE SYMBOLS. Species identity, balancing and the
 * arrow are one judgement; state symbols are a separate mark on 20(b)(ii) and
 * are compared by compareStates(). Folding them together is exactly what makes
 * an equation worth 2 marks score 0 for a missing `(l)`.
 */
export function compareEquations(student: Equation, expected: Equation): EquationComparison {
  const sl = sideMap(student.left);
  const sr = sideMap(student.right);
  const el = sideMap(expected.left);
  const er = sideMap(expected.right);

  const leftScale = scaleBetween(sl, el);
  const rightScale = scaleBetween(sr, er);
  const equivalent = leftScale !== null && rightScale !== null && rEq(leftScale, rightScale);

  const reversed =
    !equivalent && sameKeys(sl, er) && sameKeys(sr, el) && scaleBetween(sl, er) !== null;

  const expectedKeys = new Set([...el.keys(), ...er.keys()]);
  const studentKeys = new Set([...sl.keys(), ...sr.keys()]);
  const extraSpecies = [...studentKeys].filter((k) => !expectedKeys.has(k));
  const missingSpecies = [...expectedKeys].filter((k) => !studentKeys.has(k));

  return {
    equivalent,
    scale: equivalent ? leftScale : null,
    balance: checkBalance(student),
    arrowMatches: student.arrow === expected.arrow,
    reversed,
    extraSpecies,
    missingSpecies,
  };
}

/**
 * State symbols, per species, against every state the scheme allows for it.
 *
 * `accepted` maps a species key to the states that earn the mark — 20(b)(ii)
 * carries "Accept 13H2O(g)", so water is correct as either (l) or (g). A
 * species absent from the map is judged against the expected equation's own
 * state for it.
 */
export function compareStates(
  student: Equation,
  expected: Equation,
  accepted: Map<string, StateSymbol[]> = new Map(),
): StateComparison {
  const wanted = new Map<string, StateSymbol[]>();
  for (const t of [...expected.left, ...expected.right]) {
    const k = speciesKey(t.species);
    // ⚠ UNION, NOT OVERRIDE. "Accept 13H2O(g)" ADDS gas to water's allowed
    // states; it does not replace the (l) the expected equation states. The
    // first version substituted, so the mark scheme's own concession made the
    // canonical answer wrong — every correct script lost the state mark.
    const fromExpected = t.species.state ? [t.species.state] : [];
    const allow = [...new Set([...fromExpected, ...(accepted.get(k) ?? [])])];
    if (allow.length > 0) wanted.set(k, allow);
  }

  const missing: string[] = [];
  const wrong: StateComparison["wrong"] = [];
  for (const t of [...student.left, ...student.right]) {
    const k = speciesKey(t.species);
    const allow = wanted.get(k);
    if (!allow) continue; // the expected answer states nothing for it either
    if (t.species.state === null) {
      missing.push(t.species.text);
      continue;
    }
    if (!allow.includes(t.species.state)) {
      wrong.push({ species: t.species.text, got: t.species.state, wanted: allow });
    }
  }
  return { allCorrect: missing.length === 0 && wrong.length === 0, missing, wrong };
}

// ============================================================================
// MARKING
// ============================================================================
//
// ⚠ IN THIS FILE RATHER THAN ITS OWN, and not for tidiness. The suites run
// under plain `node`, which resolves ESM specifiers literally, and the app's
// tsconfig does not allow the `.ts` extension a relative import would need —
// so a second module importing this one could be typechecked but never
// executed by a test. fixture-orphans.ts is import-free for the same reason.
// The rule that keeps biting: a module the tests cannot load is a module
// nothing checks.

/**
 * Tier 1 marking for `chemical_equation`, per mark-scheme point.
 *
 * ============================================================================
 * WHY PER POINT, AND WHY THAT IS THE WHOLE DESIGN
 * ============================================================================
 * 20(b)(ii) is two marks and the scheme splits them:
 *
 *   M1  "correctly balanced equation"   accept: Allow multiples
 *   M2  "state symbols correct"         accept: Accept 13H2O(g)
 *
 * and the examiner's own report says what happens in practice — "many
 * candidates were able to balance but several lost the state symbol mark". A
 * marker that compared the whole answer to one target would give those students
 * 0 out of 2 for a correct equation with dodecane labelled (g). It has to award
 * M1 and refuse M2, separately, from the same parse.
 *
 * ============================================================================
 * HOW IT KNOWS WHICH POINT IS WHICH, AND WHY IT FAILS CLOSED
 * ============================================================================
 * `mark_scheme_items` has no machine-readable statement of WHAT a point
 * assesses. For mcq and numeric that never mattered — one point, one answer.
 * Here it does, so the criterion is READ, the way extractMcqKey() reads "the
 * only correct answer is B": a formulaic sentence treated as a contract.
 *
 * And like that function it fails CLOSED. If any point cannot be classified
 * with confidence the whole question is returned unmarkable with a reason, and
 * a human sees it. It never falls back to "the first point is the equation" —
 * an ordering guess would silently award the state-symbol mark for balancing.
 *
 * See the note at the bottom of this file: a `point_kind` column would make
 * this explicit and is worth a migration, but is not needed for it to work.
 *
 * Pure and import-free apart from the parser: no database, no model, no clock.
 */

export type EquationPointKind = "equation" | "states" | "both";

export type EquationVerdict = {
  pointCode: string;
  awarded: boolean;
  /**
   * SHOWN TO THE STUDENT.
   *
   * ⚠ It may name the correct EQUATION — that is the "correct final answer
   * after submission" exception deterministic.ts already makes for "The
   * expected answer is 307 kg". It must NEVER contain criterion text, accept[]
   * wording or guidance prose. Nothing below reads those into a string.
   */
  evidence: string;
};

export type EquationMarkResult =
  | { markable: false; reason: string }
  | {
      markable: true;
      awarded: number;
      assessedOutOf: number;
      points: EquationVerdict[];
    };

export type EquationCriterion = {
  pointCode: string;
  criterion: string;
  accept?: string[] | null;
  /**
   * "Do not award …" rules. 0029 split these out of accept[] precisely so they
   * could not be mistaken for concessions.
   *
   * ⚠ NOT HONOURED, AND THEREFORE REFUSED. This marker has no way to test a
   * prose prohibition, and silently ignoring one would award a mark the
   * examiner forbade — the exact failure 0029 existed to prevent, reintroduced
   * one layer up. A point carrying any reject rule makes the question
   * unmarkable, so a human applies it.
   */
  reject?: string[] | null;
};

/**
 * Classify one mark-scheme point.
 *
 * Deliberately narrow. "state symbol" is unambiguous; a point about balancing
 * or the equation itself is the other kind. Anything else returns null and the
 * caller refuses the question.
 */
export function classifyPoint(criterion: string): EquationPointKind | null {
  const c = criterion.toLowerCase();
  const mentionsStates = /state\s*symbol/.test(c);
  const mentionsEquation =
    /\bbalanc/.test(c) ||
    /\bequation\b/.test(c) ||
    /\bformulae?\b/.test(c) ||
    /\bspecies\b/.test(c) ||
    /\breactants?\b/.test(c) ||
    /\bproducts?\b/.test(c);

  // ⚠ A POINT THAT ASKS FOR BOTH IS ONE MARK FOR BOTH. "Balanced equation with
  // state symbols" is a common Edexcel shape, and filing it under "states"
  // would award it for state symbols on an unbalanced equation. It gets its
  // own kind and is awarded only when EVERY part of it holds.
  if (mentionsStates && mentionsEquation) return "both";
  if (mentionsStates) return "states";
  if (mentionsEquation) return "equation";
  return null;
}

/** Does this point demand the smallest whole-number ratio rather than any multiple? */
function demandsWholeNumbers(criterion: string, accept: string[] | null | undefined): boolean {
  const text = `${criterion} ${(accept ?? []).join(" ")}`.toLowerCase();
  // "Allow multiples" is an explicit permission and outranks the rest — but
  // only when it is not itself negated. "Do not allow multiples" contains the
  // permission as a substring and was read as one.
  if (/allow\s+multiples/.test(text) && !/\b(do not|don't|dont|never)\s+allow\s+multiples/.test(text)) {
    return false;
  }
  return /whole\s*number|simplest\s*(whole\s*)?ratio|smallest\s*(whole\s*)?ratio/.test(text);
}

/**
 * Pull `13H2O(g)`-shaped tokens out of examiner accept[] prose.
 *
 * ⚠ THIS READS accept[] BUT NEVER REPEATS IT. The strings are examiner marking
 * instructions; what comes back is a set of allowed STATES per species, which
 * is data, and the prose itself goes nowhere near a student.
 *
 * Unparseable tokens are ignored rather than guessed at. That makes marking
 * stricter, never looser — the failure mode is a student sent for review, not
 * a mark awarded on a misreading.
 */

/**
 * Does this examiner phrase FORBID rather than allow?
 *
 * ⚠ THE WHOLE PHRASE IS DISCARDED WHEN IT DOES, not the negated clause. "Allow
 * H2O(g) but not H2O(s)" is dropped entirely rather than split, because
 * splitting examiner prose correctly is exactly the confidence this file does
 * not have. Dropping a concession makes marking STRICTER — a student sent for a
 * mark they should have had is a visible, fixable error; the alternative is
 * awarding a mark the scheme forbids, which nothing catches.
 *
 * "Ignore …" is NOT a negation here: the fixture header records that Edexcel
 * uses it to mean "award despite", which is a permission.
 */
function forbids(phrase: string): boolean {
  return /\b(do not|don't|dont|not|never|reject|except|neither|nor)\b/i.test(phrase);
}

export function acceptedStatesFrom(criteria: EquationCriterion[]): Map<string, StateSymbol[]> {
  const allowed = new Map<string, StateSymbol[]>();
  for (const c of criteria) {
    for (const phrase of c.accept ?? []) {
      // A negated concession is not a concession. Before this, "Do not accept
      // C12H26(g)" ADDED gas to dodecane's allowed states and awarded full
      // marks for the precise error the examiner's report says candidates lost
      // the mark for.
      if (forbids(phrase)) continue;
      for (const token of phrase.match(/\d*\s*[A-Z][A-Za-z0-9().·]*\((?:s|l|g|aq)\)/g) ?? []) {
        const withoutCoefficient = token.replace(/^\d+\s*/, "");
        const parsed = parseSpecies(withoutCoefficient);
        if (!parsed.ok || parsed.value.state === null) continue;
        const key = speciesKey(parsed.value);
        const list = allowed.get(key) ?? [];
        if (!list.includes(parsed.value.state)) list.push(parsed.value.state);
        allowed.set(key, list);
      }
    }
  }
  return allowed;
}

function render(eq: Equation): string {
  const side = (terms: Equation["left"]) =>
    terms
      .map((t) => {
        const c = rEq(t.coefficient, rational(1)) ? "" : rToDisplay(t.coefficient);
        return `${c}${t.species.text}`;
      })
      .join(" + ");
  return `${side(eq.left)} ${eq.arrow === "reversible" ? "⇌" : "→"} ${side(eq.right)}`;
}

/**
 * Mark a student's equation.
 *
 * `expectedEquation` is the correct answer as text — it belongs in
 * question_expected_answers.expected_value, exactly as a numeric answer does,
 * and NOT in the mark scheme. A null means nobody has transcribed it yet, which
 * is our backlog rather than a fact about the student.
 */
export function markChemicalEquation(input: {
  answer: string | null;
  maxMarks: number;
  expectedEquation: string | null;
  criteria: EquationCriterion[];
}): EquationMarkResult {
  const { criteria } = input;

  if (criteria.length === 0) {
    return { markable: false, reason: "This question has no mark scheme." };
  }
  if (!input.expectedEquation || !input.expectedEquation.trim()) {
    return {
      markable: false,
      reason:
        "This question hasn't been set up for automatic marking yet, so it needs review.",
    };
  }

  // ── the mark scheme must be legible before the answer is even read ───────
  const kinds = criteria.map((c) => ({ ...c, kind: classifyPoint(c.criterion) }));
  const unclassified = kinds.filter((k) => k.kind === null);
  if (unclassified.length > 0) {
    return {
      markable: false,
      reason: `This question's mark scheme couldn't be read automatically (${unclassified
        .map((u) => u.pointCode)
        .join(", ")}), so it was left for a human to mark.`,
    };
  }
  if (kinds.filter((k) => k.kind === "both").length > 0 && kinds.length !== 1) {
    return {
      markable: false,
      reason:
        "This question's mark scheme mixes a combined equation-and-states point with others, which isn't supported yet — it was left for a human to mark.",
    };
  }
  if (kinds.length > 1 && kinds.filter((k) => k.kind === "equation").length !== 1) {
    return {
      markable: false,
      reason:
        "This question's mark scheme has more than one equation point, which isn't supported yet — it was left for a human to mark.",
    };
  }
  if (kinds.filter((k) => k.kind === "states").length > 1) {
    return {
      markable: false,
      reason:
        "This question's mark scheme has more than one state-symbol point, which isn't supported yet — it was left for a human to mark.",
    };
  }

  // ⚠ BEFORE ANYTHING IS MARKED. A reject rule is a veto the examiner wrote
  // down and this marker cannot evaluate; the honest response is to decline the
  // whole question rather than award marks that ignore it.
  const vetoed = kinds.filter((k) => (k.reject ?? []).length > 0);
  if (vetoed.length > 0) {
    return {
      markable: false,
      reason: `This question's mark scheme carries "do not award" rules (${vetoed
        .map((v) => v.pointCode)
        .join(", ")}) that automatic marking can't apply, so it was left for a human to mark.`,
    };
  }

  const expected = parseEquation(input.expectedEquation);
  if (!expected.ok) {
    // Ours, not theirs. Never shown as the student's fault.
    return {
      markable: false,
      reason:
        "The recorded answer for this question could not be read, so it was not marked automatically.",
    };
  }

  // ── now the answer ───────────────────────────────────────────────────────
  const written = (input.answer ?? "").trim();
  if (!written) {
    // A blank equation IS a zero: there is no hidden working to be generous
    // about, unlike a multi-mark numeric. Every point is refused explicitly.
    return {
      markable: true,
      awarded: 0,
      // The POINT COUNT, as every other path reports. Using maxMarks here made
      // a blank answer show a different denominator from a wrong one on the
      // same question.
      assessedOutOf: Math.min(kinds.length, input.maxMarks),
      points: kinds.map((k) => ({
        pointCode: k.pointCode,
        awarded: false,
        evidence: "No equation was written.",
      })),
    };
  }

  const student = parseEquation(written);
  if (!student.ok) {
    // Unreadable is NOT wrong. A human should look, rather than a parser
    // deciding that a formula it could not tokenise scored zero.
    return {
      markable: false,
      reason: `Your equation could not be read — ${student.reason} It has been left for a human to mark.`,
    };
  }

  const cmp = compareEquations(student.value, expected.value);
  const states = compareStates(student.value, expected.value, acceptedStatesFrom(criteria));
  const shown = render(student.value);
  const target = render(expected.value);

  const points: EquationVerdict[] = kinds.map((k) => {
    if (k.kind === "both") {
      // One mark for the equation AND its states. Awarded only when every part
      // holds; the message names the first thing that failed.
      const equationOk =
        cmp.balance.balanced && cmp.equivalent && cmp.arrowMatches && !cmp.reversed;
      if (!equationOk) {
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `Your equation isn't right yet. The expected equation is ${target}.`,
        };
      }
      if (!states.allCorrect) {
        const missing = states.missing.length > 0 ? `missing from ${states.missing.join(", ")}` : "";
        const wrong = states.wrong.map((w) => `${w.species} is (${w.got})`).join("; ");
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `The equation is right but the state symbols aren't — ${[missing, wrong].filter(Boolean).join("; ")}.`,
        };
      }
      return {
        pointCode: k.pointCode,
        awarded: true,
        evidence: `Your equation is balanced, correct and fully labelled: ${shown}.`,
      };
    }

    if (k.kind === "equation") {
      const wholeOnly = demandsWholeNumbers(k.criterion, k.accept);
      const coefficients = [...student.value.left, ...student.value.right].map((t) => t.coefficient);
      const integral = coefficients.every((c) => c.d === 1);
      // ⚠ SIMPLEST FORM IS A PROPERTY OF THE STUDENT'S OWN EQUATION, not of its
      // relationship to whatever happens to be stored. Requiring scale === 1
      // made the mark arithmetically unawardable whenever the transcribed
      // expected equation was not itself in smallest whole-number form — the
      // student could not win by writing the correct answer.
      const simplest =
        integral &&
        coefficients.reduce((g, c) => gcd(g, Math.abs(c.n)), 0) === 1;
      const scaleIsOne = cmp.scale !== null && rEq(cmp.scale, rational(1));

      if (!cmp.balance.balanced) {
        const off = cmp.balance.offBy
          .map((o) => `${o.element} (${o.left} on the left, ${o.right} on the right)`)
          .join(", ");
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `Your equation isn't balanced — ${off}. The expected equation is ${target}.`,
        };
      }
      if (cmp.reversed) {
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `You wrote the equation the wrong way round: your reactants are the products. The expected equation is ${target}.`,
        };
      }
      if (!cmp.equivalent) {
        const detail = [
          cmp.missingSpecies.length > 0 ? `missing ${cmp.missingSpecies.length} substance(s)` : "",
          cmp.extraSpecies.length > 0 ? `${cmp.extraSpecies.length} substance(s) that shouldn't be there` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence:
            `You wrote ${shown}, which isn't the expected reaction` +
            (detail ? ` — ${detail}` : "") +
            `. The expected equation is ${target}.`,
        };
      }
      if (!cmp.arrowMatches) {
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `The substances are right but the arrow isn't: this reaction needs ${
            expected.value.arrow === "reversible" ? "a reversible arrow (⇌)" : "a single arrow (→)"
          }.`,
        };
      }
      if (wholeOnly && !simplest) {
        return {
          pointCode: k.pointCode,
          awarded: false,
          evidence: `Your equation balances, but this question asks for the smallest whole-number coefficients. The expected equation is ${target}.`,
        };
      }
      return {
        pointCode: k.pointCode,
        awarded: true,
        evidence: scaleIsOne
          ? `Your equation is balanced and matches: ${shown}.`
          : `Your equation is balanced and is a valid multiple of the expected one (×${rToDisplay(
              cmp.scale!,
            )}): ${shown}.`,
      };
    }

    // ── the state-symbol point ──────────────────────────────────────────
    // Judged only when the substances are right. States on the wrong
    // substances are not a state-symbol error, they are the equation error
    // already reported above, and refusing both for one mistake would take
    // two marks for one fault.
    // ⚠ GATED ON THE SUBSTANCES, NOT ON THE COEFFICIENTS. The marks are
    // independent — that is the entire reason 20(b)(ii) has two of them — so a
    // student who names the right substances and labels every one correctly
    // earns the state mark even when the balancing is wrong. Requiring full
    // equivalence charged one balancing mistake twice, which is the same fault
    // as voiding it for a wrong arrow.
    //
    // What it DOES require is that the substances are the right ones: a state
    // symbol on a substance that should not be in the equation is not a
    // correct state symbol, and there is nothing to compare it against.
    if (cmp.extraSpecies.length > 0 || cmp.missingSpecies.length > 0) {
      return {
        pointCode: k.pointCode,
        awarded: false,
        evidence: "State symbols can't be judged until the right substances are there.",
      };
    }
    if (states.missing.length > 0) {
      return {
        pointCode: k.pointCode,
        awarded: false,
        evidence: `State symbols are missing from ${states.missing.join(", ")}.`,
      };
    }
    if (states.wrong.length > 0) {
      const detail = states.wrong
        .map((w) => `${w.species} is (${w.got}) but should be ${w.wanted.map((s) => `(${s})`).join(" or ")}`)
        .join("; ");
      return { pointCode: k.pointCode, awarded: false, evidence: `${detail}.` };
    }
    return { pointCode: k.pointCode, awarded: true, evidence: "Every state symbol is correct." };
  });

  const awarded = points.filter((p) => p.awarded).length;
  return {
    markable: true,
    // One point cannot award more than one mark — 0028's `awarded boolean`.
    awarded: Math.min(awarded, input.maxMarks),
    assessedOutOf: Math.min(points.length, input.maxMarks),
    points,
  };
}

/**
 * ============================================================================
 * ⚠ SCHEMA THIS WOULD LIKE, AND DELIBERATELY DOES NOT HAVE
 * ============================================================================
 * classifyPoint() reads examiner prose to decide what a mark-scheme point
 * assesses. That works, and it fails closed — but it is inference, and the
 * fixture's own header warns that examiner wording is editorial.
 *
 * A `mark_scheme_items.point_kind` column would state it: 'equation',
 * 'state_symbols', 'species', 'coefficients', … nullable, so every existing row
 * keeps working and classifyPoint stays as the fallback. That is a migration,
 * it is NOT needed for this to work, and it is not written here.
 */
