/**
 * The subject colour system must be readable, not merely pretty.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/subject-colours.test.ts
 *
 * ============================================================================
 * ⚠ THE FAILURE THIS EXISTS FOR IS THE ONE NOBODY SEES
 * ============================================================================
 * #F97316 is a fine dot on cream and roughly 2.3:1 as text on it. Shipping one
 * hex per subject is how a colour system quietly fails accessibility: somebody
 * uses the accent for a label, it passes review by eye because orange on cream
 * looks obviously orange, and it sits below the threshold forever.
 *
 * So the ratios are COMPUTED here from the WCAG 2.1 relative-luminance formula
 * against the real parchment token, not asserted from memory and not eyeballed.
 * If a shade is nudged for aesthetics, this goes red.
 *
 * ⚠ AND §34 SAYS SUBJECT IDENTITY MUST NOT BE CONVEYED BY COLOUR ALONE. The
 * last block asserts every subject carries a name and a short code, so a chip
 * too small for a word still says CHM rather than relying on being orange.
 */
import {
  SUBJECT_COLOURS,
  SUBJECT_ORDER,
  PARCHMENT,
  subjectColour,
  subjectVars,
  NEUTRAL_SLOT,
} from "../../../src/lib/design/subject-colours.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** WCAG 2.1 relative luminance. */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

// ============================================================================
console.log("\n=== 0. the formula itself, against known pairs ===");
// ============================================================================
{
  // ⚠ THE MEASURING STICK IS CHECKED BEFORE ANYTHING IS MEASURED WITH IT.
  // Black on white is exactly 21:1 by definition; a colour against itself is 1.
  t("black on white = 21", round2(contrast("#000000", "#FFFFFF")) === 21,
    round2(contrast("#000000", "#FFFFFF")));
  t("a colour against itself = 1", round2(contrast("#F97316", "#F97316")) === 1,
    round2(contrast("#F97316", "#F97316")));
}

// ============================================================================
console.log("\n=== 1. ⚠ EVERY `text` SHADE CLEARS AA BODY TEXT ON PARCHMENT ===");
// ============================================================================
{
  for (const key of SUBJECT_ORDER) {
    const c = SUBJECT_COLOURS[key];
    const r = contrast(c.text, PARCHMENT);
    t(`${c.name} text ${c.text} on parchment — ${round2(r)}:1 (needs 4.5)`, r >= 4.5, round2(r));
  }
}

// ============================================================================
console.log("\n=== 2. …and the ACCENT is proven UNSUITABLE as text ===");
// ============================================================================
{
  // ⚠ THIS IS THE POINT OF SPLITTING THE ROLES. If an accent ever passed as
  // body text the split would be pointless — and if one ever DID pass, this
  // asserts loudly rather than silently allowing the roles to merge.
  for (const key of SUBJECT_ORDER) {
    const c = SUBJECT_COLOURS[key];
    const rAccent = contrast(c.accent, PARCHMENT);
    const rText = contrast(c.text, PARCHMENT);
    t(`${c.name}: text is meaningfully darker than accent (${round2(rText)} vs ${round2(rAccent)})`,
      rText > rAccent + 1.5, `${round2(rText)} vs ${round2(rAccent)}`);
  }
  const chem = SUBJECT_COLOURS.chemistry;
  t("⚠ chemistry accent alone would FAIL as body text — which is why `text` exists",
    contrast(chem.accent, PARCHMENT) < 4.5, round2(contrast(chem.accent, PARCHMENT)));
}

// ============================================================================
console.log("\n=== 3. ink stays readable on every tint ===");
// ============================================================================
{
  const INK = "#0F1419";
  for (const key of SUBJECT_ORDER) {
    const c = SUBJECT_COLOURS[key];
    const r = contrast(INK, c.tint);
    t(`ink on ${c.name} tint ${c.tint} — ${round2(r)}:1`, r >= 4.5, round2(r));
  }
  const r = contrast(INK, NEUTRAL_SLOT.tint);
  t(`ink on the neutral slot tint — ${round2(r)}:1`, r >= 4.5, round2(r));
}

// ============================================================================
console.log("\n=== 4. the accents are the EXISTING values, not new ones ===");
// ============================================================================
{
  // ⚠ subject-theme.ts and 0006_subject_colours.sql already carry these. A
  // different shade here would put the marketing site and /learn/* a step
  // apart, which is worse than either shade on its own.
  t("chemistry accent is unchanged", SUBJECT_COLOURS.chemistry.accent === "#F97316", SUBJECT_COLOURS.chemistry.accent);
  t("biology accent is unchanged", SUBJECT_COLOURS.biology.accent === "#4A9D5C", SUBJECT_COLOURS.biology.accent);
  t("physics accent is unchanged", SUBJECT_COLOURS.physics.accent === "#3B7CB8", SUBJECT_COLOURS.physics.accent);
}

// ============================================================================
console.log("\n=== 5. ⚠ AN UNKNOWN SUBJECT GETS null, NOT A COLOUR ===");
// ============================================================================
{
  t("null in, null out", subjectColour(null) === null, subjectColour(null));
  t("⚠ an unrecognised subject is NOT painted orange — that would call it Chemistry",
    subjectColour("geography") === null, JSON.stringify(subjectColour("geography")));
  t("subjectVars(null) is an empty style, so a caller falls back to neutral",
    Object.keys(subjectVars(null)).length === 0, JSON.stringify(subjectVars(null)));

  // CONTROL — without it, §5 passes on a function that always returns null.
  t("CONTROL — a known slug DOES resolve", subjectColour("chemistry")?.key === "chemistry",
    subjectColour("chemistry")?.key);
  t("…and a course NAME resolves too — 'IAL Chemistry AS'",
    subjectColour("IAL Chemistry AS")?.key === "chemistry", subjectColour("IAL Chemistry AS")?.key);
  t("…case-insensitively", subjectColour("BIOLOGY")?.key === "biology", subjectColour("BIOLOGY")?.key);
}

// ============================================================================
console.log("\n=== 6. ⚠ §34 — IDENTITY IS NEVER COLOUR ALONE ===");
// ============================================================================
{
  for (const key of SUBJECT_ORDER) {
    const c = SUBJECT_COLOURS[key];
    t(`${key} carries a name and a short code, so a chip too small for a word still says ${c.code}`,
      c.name.length > 2 && /^[A-Z]{3}$/.test(c.code), `${c.name} / ${c.code}`);
  }
  const codes = SUBJECT_ORDER.map((k) => SUBJECT_COLOURS[k].code);
  t("the codes are distinct", new Set(codes).size === codes.length, codes.join(", "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
