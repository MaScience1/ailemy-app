/**
 * The Stripe tuition layer: what may be sold, at what price, to whom, once.
 *
 * ============================================================================
 * ⚠ NO TEST HERE ASSERTS AN AMOUNT AGAINST A CONSTANT IN OUR OWN SOURCE.
 * ============================================================================
 * Stripe owns active state, default price, currency options, amounts and
 * recurring interval. A test that read 30000 out of a file in this repo and
 * compared it to 30000 in the same file would be the codebase agreeing with
 * itself. What is asserted here is BEHAVIOUR: that an archived price can never
 * be chosen, that a missing currency is a refusal, that five credits are five.
 *
 * The fixtures below are shaped from this account's REAL catalogue — including
 * its real archived price ids — so the archived-selection guard is exercised
 * against the exact thing it exists to refuse.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";

import {
  selectApprovedPrice, EXPECTED_KIND, type SelectableProduct,
} from "../../../src/lib/tuition/price-selection.ts";
import { formatMinor, savingAgainst, cheapestFor } from "../../../src/lib/tuition/pricing-math.ts";
import { grantFor, idempotencyKeyFor } from "../../../src/lib/tuition/entitlements.ts";
import {
  parseSelection, packageFitsMode, PACKAGES_FOR, COURSES, MODES, PACKAGES, CURRENCIES,
} from "../../../src/lib/tuition/tuition-types.ts";
import { verifyStripeSignature } from "../../../src/lib/tuition/stripe-signature.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

// ── fixtures, shaped from the live account ──────────────────────────────────
const asOneToOne: SelectableProduct = {
  id: "prod_V86CfDRuhrr1nZ", active: true,
  defaultPriceId: "price_1U7tWEAf3eO5OoXigtVpQ63t",
  prices: [
    { id: "price_1U7tWEAf3eO5OoXigtVpQ63t", active: true, isDefault: true, kind: "one_off",
      interval: null, nickname: null, currencies: ["gbp", "qar"] },
    { id: "price_1U7tYeAf3eO5OoXizggg5Pb2", active: true, isDefault: false, kind: "one_off",
      interval: null, nickname: "5-hour package — 5 × 60-minute lessons", currencies: ["gbp", "qar"] },
    // ⚠ REAL ARCHIVED ROWS FROM THIS ACCOUNT. Same nicknames, same shapes.
    { id: "price_1U7qzxAf3eO5OoXiran59UxW", active: false, isDefault: false, kind: "one_off",
      interval: null, nickname: "5-hour package — 5 × 60-minute lessons", currencies: ["qar"] },
    { id: "price_1U7pztAf3eO5OoXipqWTzVlu", active: false, isDefault: false, kind: "one_off",
      interval: null, nickname: null, currencies: ["gbp"] },
  ],
};
const asGroup: SelectableProduct = {
  id: "prod_V87SD7TNaBd0SH", active: true,
  defaultPriceId: "price_1U7suHAf3eO5OoXiVNwVMXFf",
  prices: [
    { id: "price_1U7suHAf3eO5OoXiVNwVMXFf", active: true, isDefault: true, kind: "recurring",
      interval: "month", nickname: null, currencies: ["gbp", "qar"] },
    { id: "price_1U7t2RAf3eO5OoXi3ZJaFM6j", active: true, isDefault: false, kind: "one_off",
      interval: null, nickname: "3-month package — 3 months upfront · approx. 10% saving", currencies: ["gbp", "qar"] },
    { id: "price_1U7t4PAf3eO5OoXidp06h0EP", active: true, isDefault: false, kind: "one_off",
      interval: null, nickname: "Academic year package — full academic year upfront", currencies: ["gbp", "qar"] },
    { id: "price_1U7rM4Af3eO5OoXiAZ90Pwp7", active: false, isDefault: false, kind: "one_off",
      interval: null, nickname: "3-month package — 3 months upfront · 5% saving", currencies: ["qar"] },
    { id: "price_1U7rIcAf3eO5OoXiE8oRz6uf", active: false, isDefault: false, kind: "recurring",
      interval: "month", nickname: null, currencies: ["qar"] },
  ],
};

// ============================================================================
console.log("\n=== 1. GUARD 6 — an archived price can never be selected ===");
// ============================================================================
{
  const r = selectApprovedPrice(asOneToOne, "five_hour", "qar");
  t("the ACTIVE 5-hour price is chosen", r.ok && r.price.id === "price_1U7tYeAf3eO5OoXizggg5Pb2",
    r.ok ? r.price.id : r.error.code);
  /**
   * ⚠ THE ARCHIVED TWIN HAS THE SAME NICKNAME. That is the whole hazard: a
   * selector matching on nickname alone finds two, and one of them is dead.
   */
  t("⚠ and its archived twin is not even a candidate",
    r.ok && r.price.id !== "price_1U7qzxAf3eO5OoXiran59UxW");
  t("⚠ archived rows never reach the result for ANY package",
    PACKAGES_FOR.one_to_one.every((p) => {
      const x = selectApprovedPrice(asOneToOne, p, "qar");
      return !x.ok || x.price.active;
    }));
  const archivedDefault: SelectableProduct = {
    ...asOneToOne,
    prices: asOneToOne.prices.map((p) => (p.isDefault ? { ...p, active: false } : p)),
  };
  t("⚠ an archived DEFAULT is a refusal, never a fallback to the survivor",
    (() => { const x = selectApprovedPrice(archivedDefault, "single", "qar");
             return !x.ok && x.error.code === "price_inactive"; })());
}

// ============================================================================
console.log("\n=== 2. GUARD 6 — ambiguity and missing matches are loud ===");
// ============================================================================
{
  const twins: SelectableProduct = {
    ...asGroup,
    prices: [...asGroup.prices, {
      id: "price_DUPLICATE", active: true, isDefault: false, kind: "one_off",
      interval: null, nickname: "3-month package — added by mistake", currencies: ["qar"],
    }],
  };
  const r = selectApprovedPrice(twins, "three_month", "qar");
  t("⚠ two active candidates is a refusal, not a coin toss",
    !r.ok && r.error.code === "ambiguous", r.ok ? r.price.id : r.error.detail);
  const none: SelectableProduct = { ...asGroup, prices: asGroup.prices.filter((p) => !/Academic/.test(p.nickname ?? "")) };
  t("no candidate is a refusal", (() => {
    const x = selectApprovedPrice(none, "academic_year", "qar");
    return !x.ok && x.error.code === "no_match";
  })());
  t("an inactive PRODUCT is a refusal", (() => {
    const x = selectApprovedPrice({ ...asGroup, active: false }, "monthly", "qar");
    return !x.ok && x.error.code === "product_inactive";
  })());
}

// ============================================================================
console.log("\n=== 3. SABOTAGE 2 — an unsupported currency is refused ===");
// ============================================================================
{
  const r = selectApprovedPrice(asGroup, "monthly", "usd");
  t("⚠ a currency the Price cannot be charged in is refused, never converted",
    !r.ok && r.error.code === "currency_unavailable", r.ok ? "selected!" : r.error.detail);
  const qarOnly: SelectableProduct = {
    ...asGroup,
    prices: asGroup.prices.map((p) => (p.isDefault ? { ...p, currencies: ["qar"] } : p)),
  };
  t("⚠ a Price with no GBP option yields no GBP price — it does not invent one",
    (() => { const x = selectApprovedPrice(qarOnly, "monthly", "gbp");
             return !x.ok && x.error.code === "currency_unavailable"; })());
  t("and both approved currencies do resolve",
    selectApprovedPrice(asGroup, "monthly", "qar").ok && selectApprovedPrice(asGroup, "monthly", "gbp").ok);
}

// ============================================================================
console.log("\n=== 4. SABOTAGE 5 — recurring/one-off shape is enforced (§11) ===");
// ============================================================================
{
  t("monthly must be recurring, everything else one-off",
    EXPECTED_KIND.monthly === "recurring"
      && EXPECTED_KIND.single === "one_off" && EXPECTED_KIND.five_hour === "one_off"
      && EXPECTED_KIND.three_month === "one_off" && EXPECTED_KIND.academic_year === "one_off");
  const recurringSingle: SelectableProduct = {
    ...asOneToOne,
    prices: asOneToOne.prices.map((p) => (p.isDefault ? { ...p, kind: "recurring" as const, interval: "month" } : p)),
  };
  /**
   * ⚠ A 1-to-1 LESSON THAT BECAME A SUBSCRIPTION IS THE EXPENSIVE MISTAKE.
   * It bills every month for a single hour somebody bought once.
   */
  t("⚠ a single lesson that turned recurring is refused",
    (() => { const x = selectApprovedPrice(recurringSingle, "single", "qar");
             return !x.ok && x.error.code === "kind_mismatch"; })());
  const yearly: SelectableProduct = {
    ...asGroup,
    prices: asGroup.prices.map((p) => (p.isDefault ? { ...p, interval: "year" } : p)),
  };
  t("⚠ a monthly price whose interval became yearly is refused",
    (() => { const x = selectApprovedPrice(yearly, "monthly", "qar");
             return !x.ok && x.error.code === "kind_mismatch"; })());
}

// ============================================================================
console.log("\n=== 5. SABOTAGE 3+4 — the browser cannot name a price or an amount ===");
// ============================================================================
{
  t("a well-formed selection parses",
    parseSelection({ course: "as", mode: "group", package: "monthly", currency: "qar" }) !== null);
  /**
   * ⚠ EXTRA FIELDS ARE NOT COPIED THROUGH. parseSelection builds a new object
   * from four validated members, so a price_id or a unit_amount riding along in
   * the body cannot reach the Stripe call even by accident.
   */
  const smuggled = parseSelection({
    course: "as", mode: "group", package: "monthly", currency: "qar",
    price_id: "price_ATTACKER", unit_amount: 1, product: "prod_X", quantity: 99, interval: "year",
  } as unknown);
  t("⚠ a smuggled price_id / unit_amount is dropped by the parser",
    smuggled !== null && !("price_id" in smuggled) && !("unit_amount" in smuggled)
      && Object.keys(smuggled).sort().join(",") === "course,currency,mode,package");
  t("an unknown course/mode/package/currency is refused", [
    { course: "physics", mode: "group", package: "monthly", currency: "qar" },
    { course: "as", mode: "hybrid", package: "monthly", currency: "qar" },
    { course: "as", mode: "group", package: "lifetime", currency: "qar" },
    { course: "as", mode: "group", package: "monthly", currency: "usd" },
  ].every((b) => parseSelection(b) === null));
  t("§11 — a mode cannot buy another mode's package",
    !packageFitsMode("group", "five_hour") && !packageFitsMode("one_to_one", "monthly")
      && packageFitsMode("group", "monthly") && packageFitsMode("one_to_one", "five_hour"));
  /**
   * ⚠ THE ROUTE NEVER READS A COMMERCIAL FIELD OFF THE REQUEST. Asserted on the
   * source, because this is the property that makes the allowlist meaningful.
   */
  const route = code(readFileSync("src/app/api/tuition/checkout/route.ts", "utf8"));
  t("⚠ the checkout route reads no price/amount/interval from the body",
    !/body\.(price|price_id|unit_amount|amount|interval|product)/.test(route)
      && !/sel\.(price|unit_amount|amount|interval|product)/.test(route));
  t("⚠ and the line item is the SERVER-resolved price id",
    /"line_items\[0\]\[price\]": price\.id/.test(route));
  t("§12 — the currency is passed explicitly to Checkout",
    /currency: sel\.currency/.test(route));
}

// ============================================================================
console.log("\n=== 6. SABOTAGE 8 — an `interest` cohort cannot expose checkout ===");
// ============================================================================
{
  const route = code(readFileSync("src/app/api/tuition/checkout/route.ts", "utf8"));
  t("⚠ group checkout consults the cohort state, not the Stripe catalogue",
    /availabilityFor\(/.test(route) && /!== "enrolling"/.test(route));
  t("⚠ and refuses when it is not enrolling", /not_enrolling/.test(route));
  t("a failed cohort read refuses the sale rather than falling back",
    /cohorts_unavailable/.test(route));
  /**
   * ⚠ availabilityFor ITSELF IS UNTOUCHED. Its derivation is sabotage-proven in
   * both directions elsewhere; this work is forbidden from adding, tightening
   * or reordering a condition inside it.
   */
  const avail = readFileSync("src/lib/tuition/availability.ts", "utf8");
  t("⚠ availabilityFor still derives from status AND enrolmentUrl, unmodified",
    /status === "enrolling"/.test(avail) && /enrolmentUrl/.test(avail));
  t("⚠ no Stripe payment link was pasted into a cohort enrolment url",
    !/buy\.stripe\.com/.test(readFileSync("src/lib/public/readers.ts", "utf8")));
}

// ============================================================================
console.log("\n=== 7. SABOTAGE 7 — no FX anywhere in the tuition layer ===");
// ============================================================================
{
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  /**
   * ⚠ NO EXCLUSION ANY MORE — THIS NOW ASSERTS ABSENCE.
   * It previously skipped src/lib/tuition/pricing.ts and PRINTED that one
   * legacy module still held QAR_PER_GBP = 4.7, because ~15 assertions covered
   * that code and deleting tested code to make a guard pass is how coverage
   * quietly falls. The rate and its Money constructors are gone now and those
   * assertions were rewritten against the new invariant rather than removed, so
   * the whole tuition layer is in scope and the guard states a fact rather than
   * a caveat.
   */
  const files = [...walk("src/lib/tuition"), ...walk("src/components/tuition"),
                 ...walk("src/app/api/tuition")].map((p) => ({ p, c: code(readFileSync(p, "utf8")) }));
  /**
   * ⚠ THE SHAPES AN FX RATE ACTUALLY TAKES. Not the digit 4 — these are the
   * forms that convert one currency into another. QAR_PER_GBP = 4.7 was real
   * and lived in this codebase until this change.
   */
  const FX: { re: RegExp; why: string }[] = [
    { re: /\b(QAR_PER_GBP|GBP_PER_QAR|EXCHANGE_RATE|FX_RATE|RATE_QAR|RATE_GBP)\b/, why: "a named rate constant" },
    { re: /\b\d+(\.\d+)?\s*\*\s*(qar|gbp)\b/i, why: "multiplying an amount by a rate" },
    { re: /\b(qar|gbp)[A-Za-z]*\s*[*/]\s*\d+\.\d+/i, why: "scaling one currency into another" },
    { re: /\bconvert(Currency|ToGbp|ToQar)\b/i, why: "a conversion helper" },
    { re: /from(Gbp|Qar)\s*\(/, why: "the old cross-currency constructor" },
  ];
  const hits: string[] = [];
  for (const f of files) for (const s of FX) if (s.re.test(f.c)) hits.push(`${f.p} — ${s.why}`);
  t("⚠ no FX constant, helper or rate arithmetic in the tuition layer",
    hits.length === 0, hits.join("\n      "));
  /**
   * ⚠ AND THE MODULE THAT HELD THE RATE NO LONGER EXPORTS IT. Asserted on the
   * export, not on the file text, because the file still EXPLAINS the removal
   * in prose and a raw scan would read the explanation as the violation.
   */
  const legacy = code(readFileSync("src/lib/tuition/pricing.ts", "utf8"));
  t("⚠ pricing.ts no longer exports QAR_PER_GBP, fromGbp or fromQar",
    !/export (const QAR_PER_GBP|function from(Gbp|Qar))/.test(legacy));
  t("⚠ and nothing in src/ calls the removed constructors",
    walk("src").every((p) => !/\bfrom(Gbp|Qar)\s*\(/.test(code(readFileSync(p, "utf8")))));
  /**
   * ⚠ THE PROPERTY THAT ACTUALLY MATTERS: the Stripe-backed pricing layer does
   * not reach for the legacy converters. If a new surface imports fromGbp or
   * QAR_PER_GBP to fill a gap, this goes red even though the legacy file is
   * allowed to exist.
   */
  const importsLegacyFx = files.filter((f) =>
    /from\s+["'][^"']*tuition\/pricing["']/.test(f.c)
      && /\b(fromGbp|fromQar|QAR_PER_GBP|ONE_TO_ONE_QAR)\b/.test(f.c)).map((f) => f.p);
  t("⚠ no Stripe-backed tuition module imports the legacy FX helpers",
    importsLegacyFx.length === 0, importsLegacyFx.join(", "));

  t("⚠ and both currencies come off ONE Price object",
    /options\.find\(\(o\) => o\.currency === cur\)/.test(
      readFileSync("src/lib/tuition/tuition-pricing.ts", "utf8")));
}

// ============================================================================
console.log("\n=== 8. GUARD 8 — savings are derived, never asserted ===");
// ============================================================================
{
  t("a real saving is reported", (() => {
    const s = savingAgainst(255000, 230000); // 3 × 850 vs 2,300, in minor units
    return s !== null && s.saveMinor === 25000 && Math.round(s.pct) === 10;
  })());
  /**
   * ⚠ NO SAVING IS A REAL ANSWER. If a package costs more than paying monthly,
   * the UI must say nothing rather than invent a percentage.
   */
  t("⚠ a package that is not cheaper yields NO saving", savingAgainst(230000, 255000) === null);
  t("⚠ and an equal price yields no saving either", savingAgainst(230000, 230000) === null);

  /**
   * ⚠ THE ACADEMIC YEAR DOES NOT WIN ON THIS CATALOGUE AT NINE MONTHS, and the
   * badge must follow the arithmetic rather than the intuition: three 3-month
   * packages cover nine months of AS for 6,900 against 7,000.
   */
  const AS = { monthly: 85000, three_month: 230000, academic_year: 700000 };
  t("⚠ at 9 months the AS academic year is NOT best value", cheapestFor(9, AS) === "three_month",
    String(cheapestFor(9, AS)));
  t("⚠ at 12 months it is", cheapestFor(12, AS) === "academic_year", String(cheapestFor(12, AS)));
  t("a tie awards nothing", cheapestFor(3, { monthly: 100000, three_month: 300000 }) === null);
  t("one option alone is not 'best value'", cheapestFor(9, { monthly: 85000 }) === null);
}

// ============================================================================
console.log("\n=== 9. §13 — entitlements, and the group/1-to-1 boundary ===");
// ============================================================================
{
  t("AS single grants exactly 1 AS credit", (() => {
    const g = grantFor("as", "one_to_one", "single");
    return g?.kind === "one_to_one_credits" && g.credits === 1 && g.level === "as_a_level";
  })());
  t("AS five-hour grants exactly 5", (() => {
    const g = grantFor("as", "one_to_one", "five_hour");
    return g?.kind === "one_to_one_credits" && g.credits === 5 && g.level === "as_a_level";
  })());
  t("GCSE single grants exactly 1 GCSE credit", (() => {
    const g = grantFor("year11", "one_to_one", "single");
    return g?.kind === "one_to_one_credits" && g.credits === 1 && g.level === "gcse";
  })());
  t("GCSE five-hour grants exactly 5", (() => {
    const g = grantFor("year10", "one_to_one", "five_hour");
    return g?.kind === "one_to_one_credits" && g.credits === 5 && g.level === "gcse";
  })());
  /**
   * ⚠ THE ONE THAT MATTERS COMMERCIALLY. A month of group tuition at 700 QAR
   * must never become private hours worth 300 QAR each.
   */
  t("⚠ NO group package ever yields 1-to-1 credits",
    PACKAGES_FOR.group.every((p) => grantFor("as", "group", p)?.kind === "group_enrolment"));
  t("⚠ and no 1-to-1 package ever yields a cohort enrolment",
    PACKAGES_FOR.one_to_one.every((p) => grantFor("as", "one_to_one", p)?.kind === "one_to_one_credits"));
  t("a package that does not fit its mode grants nothing",
    grantFor("as", "group", "five_hour") === null && grantFor("as", "one_to_one", "monthly") === null);
  t("every mode/package pair in the vocabulary has a grant",
    MODES.every((m) => PACKAGES_FOR[m].every((p) => grantFor("as", m, p) !== null)));
}

// ============================================================================
console.log("\n=== 10. SABOTAGE 6 — a replayed webhook cannot grant twice ===");
// ============================================================================
{
  t("the idempotency key is the Stripe EVENT id",
    idempotencyKeyFor("evt_1") === "stripe:evt_1" && idempotencyKeyFor("evt_2") !== idempotencyKeyFor("evt_1"));
  const grant = code(readFileSync("src/lib/tuition/webhook-grant.ts", "utf8"));
  /**
   * ⚠ THE DATABASE REFUSES THE REPLAY — 0047 carries a UNIQUE index on
   * idempotency_key. A check-then-write would leave a window in which Stripe's
   * retry lands a second batch of credits.
   */
  t("⚠ a unique violation is treated as ALREADY GRANTED, not as a failure",
    /23505/.test(grant) && /already_granted/.test(grant));
  t("⚠ and it is written with the event key, not the session id",
    /idempotencyKeyFor\(eventId\)/.test(grant));
  t("the index that enforces it exists in 0047",
    /lesson_credit_transactions_idempotency/.test(
      readFileSync("supabase/migrations/0047_packages_and_credits.sql", "utf8")));
  const route = code(readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"));
  t("⚠ a failed grant returns 500 so Stripe retries — never a silent 200",
    /status: 500/.test(route));
  t("⚠ an already-granted replay returns 200 so Stripe stops",
    /received: true, handled: true/.test(route));
  t("§22 — only the events this architecture needs are handled",
    /GRANTING_EVENTS/.test(route) && /ACKNOWLEDGED_EVENTS/.test(route));
}

// ============================================================================
console.log("\n=== 11. §21 — the webhook signature is really verified ===");
// ============================================================================
{
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_800_000_000;
  const sign = (ts: number, payload: string, key = secret) =>
    createHmac("sha256", key).update(`${ts}.${payload}`, "utf8").digest("hex");

  t("a genuine signature verifies", verifyStripeSignature({
    rawBody: body, header: `t=${now},v1=${sign(now, body)}`, secret, nowSeconds: now,
  }).ok);
  /** ⚠ THE ATTACK THIS EXISTS TO STOP: a forged body claiming a paid session. */
  t("⚠ a tampered body is rejected", !verifyStripeSignature({
    rawBody: body.replace("evt_1", "evt_forged"),
    header: `t=${now},v1=${sign(now, body)}`, secret, nowSeconds: now,
  }).ok);
  t("⚠ a signature from the wrong secret is rejected", !verifyStripeSignature({
    rawBody: body, header: `t=${now},v1=${sign(now, body, "whsec_wrong")}`, secret, nowSeconds: now,
  }).ok);
  t("⚠ a replayed old signature is rejected on the timestamp", !verifyStripeSignature({
    rawBody: body, header: `t=${now - 3600},v1=${sign(now - 3600, body)}`, secret, nowSeconds: now,
  }).ok);
  t("a missing header or secret is rejected",
    !verifyStripeSignature({ rawBody: body, header: null, secret, nowSeconds: now }).ok
      && !verifyStripeSignature({ rawBody: body, header: `t=${now},v1=x`, secret: "", nowSeconds: now }).ok);
  /** During a secret rotation Stripe sends two v1 entries; both must be tried. */
  t("⚠ one valid v1 among several verifies (secret rotation)", verifyStripeSignature({
    rawBody: body, header: `t=${now},v1=${sign(now, body, "whsec_old")},v1=${sign(now, body)}`,
    secret, nowSeconds: now,
  }).ok);
}

// ============================================================================
console.log("\n=== 12. §8 — formatting is Intl, and QAR is not given false pennies ===");
// ============================================================================
{
  t("QAR renders as whole riyals", formatMinor(85000, "qar") === "850 QAR", formatMinor(85000, "qar"));
  t("and thousands are grouped", formatMinor(700000, "qar") === "7,000 QAR", formatMinor(700000, "qar"));
  t("GBP renders with its symbol and pennies",
    formatMinor(6035, "gbp") === "£60.35", formatMinor(6035, "gbp"));
  t("a converted GBP amount keeps both pennies",
    formatMinor(20117, "gbp") === "£201.17", formatMinor(20117, "gbp"));
}

// ============================================================================
console.log("\n=== 13. the catalogue reader reads what Stripe actually returns ===");
// ============================================================================
{
  const cat = code(readFileSync("src/lib/tuition/stripe-catalogue.ts", "utf8"));
  /**
   * ⚠ unit_amount IS null ON EVERY CONVERTED CURRENCY OPTION on this account —
   * the value is in unit_amount_decimal. Reading only unit_amount reports "no
   * GBP" for all thirteen active prices, which is the one wrong conclusion that
   * leads straight to computing GBP from QAR.
   */
  t("⚠ unit_amount_decimal is read, not just unit_amount", /unit_amount_decimal/.test(cat));
  /**
   * ⚠ AND THE LIST ENDPOINT SILENTLY IGNORES expand[]=data.currency_options —
   * it returns 200 with the key absent. Active prices must be retrieved singly.
   */
  t("⚠ active prices are retrieved individually with the expand",
    /\/prices\/\$\{row\.id\}\?expand\[\]=currency_options/.test(cat));
  t("§4 — catalogue reads are cached rather than hit per render",
    /revalidate:\s*\d+/.test(cat) && /tags:\s*\["stripe-catalogue"\]/.test(cat));
  t("⚠ the secret is never interpolated into a returned string",
    !/\$\{secret\}/.test(cat.replace(/Bearer \$\{secret\}/g, "")));
  t("§21 — the module is server-only", /^import "server-only"/m.test(readFileSync("src/lib/tuition/stripe-catalogue.ts", "utf8")));
  t("§21 — no Stripe secret is exposed through a NEXT_PUBLIC name",
    !/NEXT_PUBLIC[A-Z_]*SECRET/.test(cat));
}

// ============================================================================
console.log("\n=== 14. GUARD 3 — book_slot_with_credit is still not wired ===");
// ============================================================================
{
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  const callers = walk("src").filter((p) =>
    /\.rpc\(\s*["'`]book_slot_with_credit/.test(code(readFileSync(p, "utf8"))));
  t("⚠ nothing calls the broken RPC", callers.length === 0, callers.join(", "));
  t("⚠ and the existing booking saga is intact",
    /async function compensate\(/.test(code(readFileSync("src/lib/booking/actions.ts", "utf8"))));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
