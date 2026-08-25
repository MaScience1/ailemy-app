/**
 * THE COMMITMENT RENDER GATE.
 *
 * ============================================================================
 * ⚠ WHAT THIS SUITE EXISTS TO PREVENT: A TAB THAT SELLS A PRICE NOBODY CAN PAY.
 * ============================================================================
 * All three commitments are fully priced and all three map to real Stripe
 * prices. But "Reserve your place" is a single Payment Link per cohort with no
 * package dimension, so every tab sends the reader to the same checkout. A
 * three-month or academic-year tab therefore displays a total that the link
 * does not charge.
 *
 * ⚠ AND IT ASSERTS BEHAVIOUR, NOT THE PRESENCE OF A LINE OF CODE. This repo has
 * twice shipped a guard that matched its own explanatory prose, or asserted
 * that a function was CALLED rather than that the outcome OCCURRED. The
 * universal property below (§2) is the real guard: for every commitment the app
 * knows about, what the page actually renders must be purchasable. The rendered
 * half — proving no hidden tab reaches the HTML — lives in prod-routes.test.ts,
 * where a real server is already running.
 */
import { readFileSync } from "node:fs";

import {
  DISCOUNTS, COMMITMENT_LABEL, COMMITMENT_MONTHS,
  PURCHASABLE_COMMITMENTS, isPurchasable, effectiveCommitment,
  type Commitment,
} from "../../../src/lib/tuition/pricing.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");

/** ⚠ DERIVED FROM THE MODULE, NEVER TYPED OUT. A hand-written list here would
 *  pin today's commitments and go stale the moment a fourth is added. */
const ALL = Object.keys(COMMITMENT_LABEL) as Commitment[];

console.log("\n=== 1. the gate is a real set, derived from the real commitments ===");
{
  t("there is more than one commitment to gate (else this suite proves nothing)",
    ALL.length > 1, ALL.join(","));
  t("every purchasable commitment is a commitment the app actually knows",
    PURCHASABLE_COMMITMENTS.every((c) => ALL.includes(c)), PURCHASABLE_COMMITMENTS.join(","));
  t("at least one commitment IS purchasable — the page must be able to sell something",
    PURCHASABLE_COMMITMENTS.length >= 1);
  t("at least one commitment is NOT purchasable — otherwise the gate is inert and\n     this whole suite would pass vacuously",
    ALL.some((c) => !isPurchasable(c)), ALL.filter((c) => !isPurchasable(c)).join(","));
}

console.log("\n=== 2. THE INVARIANT — what renders is always buyable ===");
{
  /**
   * ⚠ THIS IS THE GUARD. Not "effectiveCommitment was called", not "a filter
   * appears in the component" — the property itself, over every input the type
   * admits. If a future edit makes any commitment render itself while unbuyable,
   * this fails and names it.
   */
  const offenders = ALL.filter((c) => !isPurchasable(effectiveCommitment(c)));
  t("for EVERY commitment, what the page renders is purchasable",
    offenders.length === 0, offenders.join(","));

  const notCoerced = ALL.filter((c) => !isPurchasable(c) && effectiveCommitment(c) === c);
  t("an unbuyable commitment is never rendered as itself",
    notCoerced.length === 0, notCoerced.join(","));

  const wronglyCoerced = ALL.filter((c) => isPurchasable(c) && effectiveCommitment(c) !== c);
  t("a buyable commitment is never silently switched to another",
    wronglyCoerced.length === 0, wronglyCoerced.join(","));

  t("coercion is idempotent — rendering the rendered value changes nothing",
    ALL.every((c) => effectiveCommitment(effectiveCommitment(c)) === effectiveCommitment(c)));
}

console.log("\n=== 3. today's decision: only 1 month can be bought ===");
{
  t("monthly is purchasable", isPurchasable("monthly"));
  t("three_month is NOT purchasable — the link does not charge its total",
    !isPurchasable("three_month"));
  t("academic_year is NOT purchasable — same reason",
    !isPurchasable("academic_year"));
  t("?commitment=three_month renders monthly", effectiveCommitment("three_month") === "monthly",
    effectiveCommitment("three_month"));
  t("?commitment=academic_year renders monthly", effectiveCommitment("academic_year") === "monthly",
    effectiveCommitment("academic_year"));
}

console.log("\n=== 4. NOTHING WAS DELETED — this is a render gate, not a removal ===");
{
  /**
   * ⚠ THE FOUNDER'S CONSTRAINT, ASSERTED. The commitment machinery must survive
   * intact so restoring a tab is one edit. If a later cleanup "tidies away" the
   * unused prices, this fails — and reversing the gate would silently produce a
   * page with a tab and no price behind it.
   */
  t("every commitment still carries a discount", ALL.every((c) => typeof DISCOUNTS[c] === "number"));
  t("every commitment still carries a month count", ALL.every((c) => COMMITMENT_MONTHS[c] !== undefined));
  t("every commitment still carries a label", ALL.every((c) => typeof COMMITMENT_LABEL[c] === "string"));

  const sel = code(readFileSync("src/lib/tuition/price-selection.ts", "utf8"));
  t("resolvePrice still maps the hidden commitments to Stripe price kinds",
    /three_month/.test(sel) && /academic_year/.test(sel));

  const page = code(readFileSync("src/app/[locale]/tuition/page.tsx", "utf8"));
  t("the query string still carries commitment — the URL contract is unchanged",
    /commitment:\s*c/.test(page) || /commitment/.test(page));
}

console.log("\n=== 5. the gate is declared apart from price, per its own warning ===");
{
  const pricing = code(readFileSync("src/lib/tuition/pricing.ts", "utf8"));
  /**
   * ⚠ COMMENTS STRIPPED FIRST. The declaration's own doc comment says the words
   * DISCOUNTS and COMMITMENT_LABEL; matching those would be matching the prose,
   * which is the exact trap this repo has hit repeatedly.
   */
  const decl = (pricing.match(/PURCHASABLE_COMMITMENTS[^=]*=\s*\[[^\]]*\]/) ?? [""])[0];
  t("PURCHASABLE_COMMITMENTS is a literal list, not derived from DISCOUNTS",
    decl.length > 0 && !/DISCOUNTS/.test(decl) && !/Object\.keys/.test(decl), decl);

  const modes = code(readFileSync("src/components/tuition/TuitionModes.tsx", "utf8"));
  t("the tab list is still sourced from COMMITMENT_LABEL, then gated",
    /Object\.keys\(COMMITMENT_LABEL\)/.test(modes) && /isPurchasable/.test(modes));
  t("1-to-1 is untouched — it has its own label map and no commitment gate",
    /Object\.keys\(ONE_TO_ONE_LEVEL_LABEL\)/.test(modes)
    && !/ONE_TO_ONE_LEVEL_LABEL\)[\s\S]{0,40}isPurchasable/.test(modes));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
