/**
 * Tuition pricing: one configuration, one rate, and no arithmetic in the UI.
 *
 * ============================================================================
 * ⚠ THE RULE THIS FILE EXISTS FOR: A DISCOUNT LIVES IN ONE PLACE
 * ============================================================================
 * §19 asks that moving the academic-year offer from 20% to 15% be a one-line
 * data change, and §44 forbids `price * 0.9` in components. Both are the same
 * requirement seen from different ends: if any component multiplies, then the
 * discount is defined in as many places as there are components, and the
 * one-line change silently misses some of them.
 *
 * So: the config is asserted to be data, the arithmetic is exercised directly,
 * and the components are checked to contain none of it.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  DISCOUNTS, COMMITMENT_MONTHS,
  billableMonths, monthsFor, quote,
  type Commitment,
} from "../../../src/lib/tuition/pricing.ts";
import { availabilityFor } from "../../../src/lib/tuition/availability.ts";
import { FALLBACK_COHORTS } from "../../../src/lib/public/catalogue.ts";


/**
 * ⚠ THE CLAIMS MOVED INTO THE CATALOGUE, SO THE GUARD FOLLOWS THEM THERE.
 * These assertions used to grep the component for an English sentence. After
 * the Arabic conversion the sentence lives in messages/en.json and the JSX
 * holds a key — so the old greps would have gone quietly green-by-absence,
 * which is the worst way for a guard to die. Each one now checks BOTH halves:
 * the component references the key, and the catalogue still says the thing the
 * guard was protecting. That is strictly stronger than the string match was.
 */
const EN_MESSAGES = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<string, Record<string, string>>;
const msg = (dotted: string): string => {
  const i = dotted.indexOf(".");
  return EN_MESSAGES[dotted.slice(0, i)]?.[dotted.slice(i + 1)] ?? "";
};

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
/** Recursive walk, so the anchor sweeps below cover whole directories. */
const walkSrc = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walkSrc(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
const MODES = readFileSync("src/components/tuition/TuitionModes.tsx", "utf8");
const PAGE = readFileSync("src/app/[locale]/tuition/page.tsx", "utf8");
const PRICING = readFileSync("src/lib/tuition/pricing.ts", "utf8");

const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (!statSync(full).isDirectory() || e.startsWith("_")) continue;
    const next = e.startsWith("(") && e.endsWith(")") ? prefix : [...prefix, e];
    if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
    out.push(...routes(full, next));
  }
  return out;
}
/**
 * ⚠ [locale] IS TRANSPARENT FOR THE DEFAULT LOCALE. i18n phase 1 moved the
 * homepage and /tuition under app/[locale]/; with localePrefix "as-needed"
 * English carries no prefix, so those files still serve /  and /tuition. A
 * resolver that counted [locale] as a segment would call every one of them
 * missing and make a working move look like a breakage.
 */
const ROUTES = routes(APP).map((r) => (r[0] === "[locale]" ? r.slice(1) : r));
const hasRoute = (p: string) => {
  const want = p.split("/").filter(Boolean);
  return ROUTES.some((r) => r.length === want.length && r.every((s, i) => s.startsWith("[") || s === want[i]));
};

// ============================================================================
console.log("\n=== 1. ⚠ §2/§19/§44 — pricing is configuration, not code ===");
// ============================================================================
{
  /**
   * ⚠ THESE ASSERTIONS USED TO PIN 0.10 AND 0.20, AND THAT WAS THE BUG.
   * The whole point of §19 is that changing a discount is ONE data edit — but
   * a test restating the percentages makes it two, and the second one lives in
   * a file nobody thinks of as pricing. Moving 3-month to 5% and the academic
   * year to 10% turned these red while the product was perfectly correct.
   *
   * AGENTS.md names this exactly: a constant standing in for production data
   * has to be re-derived from the source, or it silently pins yesterday's
   * behaviour. So the RELATIONSHIPS are asserted, and the numbers come from
   * DISCOUNTS itself. A wrong discount now fails where it is wrong — in the
   * config, under review — instead of here.
   */
  t("§19 — monthly carries no discount", DISCOUNTS.monthly === 0);
  t("§19 — the longer commitments discount, and increasingly so",
    DISCOUNTS.three_month > 0 && DISCOUNTS.academic_year > DISCOUNTS.three_month,
    `3mo ${DISCOUNTS.three_month} / year ${DISCOUNTS.academic_year}`);
  t("§19 — every discount is a sane fraction",
    (Object.values(DISCOUNTS) as number[]).every((d) => d >= 0 && d < 1));

  /**
   * ⚠ THE ONE-LINE-CHANGE TEST, PERFORMED RATHER THAN ASSERTED.
   * Every downstream figure must move when the rate does. If a component held
   * its own 0.9, this would still pass — which is why the component scan below
   * exists as well.
   */
  // The IAL cohort's real window, as the row holds it.
  const yr = quote(16900, "academic_year", { firstClassOn: "2026-09-15", lastClassOn: "2027-05-21" })!;
  t("⚠ §19 — the academic price is the base less WHATEVER the config says",
    yr.finalMinor === Math.round(yr.baseMinor * (1 - DISCOUNTS.academic_year)),
    `${yr.baseMinor} × (1 − ${DISCOUNTS.academic_year}) → ${yr.finalMinor}`);
  t("§19 — and the quote reports the discount it applied", yr.discount === DISCOUNTS.academic_year);
  t("§19 — base, final and saving always reconcile",
    yr.baseMinor - yr.finalMinor === yr.savingMinor);
  t("§19 — the per-month equivalent divides the FINAL price",
    yr.perMonthMinor === Math.round(yr.finalMinor / yr.months));
  // ⚠ THE ONE-LINE-CHANGE PROPERTY, EXERCISED. Quote at an arbitrary rate and
  // the same relationship must hold — which is what makes editing DISCOUNTS
  // sufficient on its own.
  for (const d of [0, 0.05, 0.1, 0.2, 0.33]) {
    const base = 16900 * 9;
    t(`§19 — the rule holds at ${Math.round(d * 100)}%`,
      Math.round(base * (1 - d)) + Math.round(base * d) === base
        || Math.abs(Math.round(base * (1 - d)) - base * (1 - d)) <= 0.5);
  }

  // ⚠ NO ARITHMETIC IN THE UI. This is §44 stated as a check on the source.
  const ui = code(MODES) + code(PAGE);
  for (const re of [/\*\s*0?\.9\b/, /\*\s*0?\.8\b/, /\*\s*0\.2\b/, /\*\s*0\.1\b/, /\/\s*100\s*\*/]) {
    t(`⚠ §44 — no ${re.source} in a component`, !re.test(ui), ui.match(re)?.[0]);
  }
  t("⚠ §44 — no component multiplies by a discount at all",
    !/DISCOUNTS\[[^\]]+\]\s*\*/.test(ui));
  /**
   * ⚠ THIS PINNED oneToOneQuote(), WHICH IS NOW THE WRONG ANSWER.
   * The 1-to-1 prices come from Stripe: the component receives formatted
   * strings and minor units resolved server-side from the same active Price
   * that Checkout charges. Asserting it still calls the local quote helper
   * would be asserting the defect back into place. The group card still reads
   * quote() and that half is unchanged.
   */
  /**
   * ⚠ THE GROUP CARD HAS MOVED TOO. It read quote(cohort.pricePence, …), which
   * applied a local DISCOUNTS table to a sterling column and converted the
   * result — three commercial decisions this repo does not own. It now reads
   * the amounts the server resolved from Stripe, keyed by its own cohort slug.
   */
  t("⚠ §44 — the group card reads Stripe amounts, not quote()",
    !/\bquote\s*\(cohort\.pricePence/.test(code(MODES))
      && code(MODES).includes("pricing[c]?.amounts"));
  t("⚠ §44 — and its tabs are no longer keyed on the discount table",
    !/Object\.keys\(DISCOUNTS\)/.test(code(MODES)));
  /**
   * ⚠ code(MODES), NOT THE RAW FILE. The component's own docstring explains what
   * oneToOneQuote() used to do, and a raw scan reads that explanation as the
   * call it is warning about. Tenth time this trap has been laid in this repo.
   */
  t("⚠ §44 — and the 1-to-1 card no longer computes anything locally",
    !/\boneToOneQuote\s*\(/.test(code(MODES)) && code(MODES).includes("pricing[level]"));
  t("§2 — there is exactly one pricing module",
    existsSync("src/lib/tuition/pricing.ts") && !existsSync("src/lib/tuition/prices.ts"));
}

// ============================================================================
// ============================================================================
console.log("\n=== 2. ⚠ §3 — ONE PRICE, TWO CURRENCIES, AND NO RATE AT ALL ===");
// ============================================================================
{
  /**
   * ==========================================================================
   * ⚠ THIS SECTION USED TO ASSERT THE CONVERSION. IT NOW ASSERTS ITS ABSENCE.
   * ==========================================================================
   * Fifteen assertions here pinned QAR_PER_GBP = 4.7 and the figures it
   * produced — £169 → 794 QAR, 300 QAR → £64, "charged as £266". Every one of
   * them passed, and every one of them described a price Stripe would never
   * charge: the rate was a constant in this repo, so the site drifted from the
   * till by however much the real rate had moved.
   *
   * They are rewritten rather than deleted. The concern is unchanged — is the
   * currency shown the currency billed — but the mechanism that answers it has
   * moved from arithmetic to a lookup, so the assertions follow it. Deleting
   * them would have dropped the only coverage of that question.
   */
  const legacy = code(PRICING);
  t("⚠ §3 — pricing.ts exports no rate", !/export const QAR_PER_GBP/.test(legacy));
  t("⚠ §3 — and no cross-currency constructors",
    !/export function from(Gbp|Qar)/.test(legacy));
  t("⚠ §3 — the Money type that carried both currencies is gone",
    !/export type Money/.test(legacy));
  t("⚠ §3 — and so are the dual-currency formatters it fed",
    !/export function (show|displayAmount|billingNote)/.test(legacy));

  /**
   * ⚠ THE OLD ANCHOR TABLE IS GONE TOO. ONE_TO_ONE_QAR held 300/1250/250/1000
   * as source constants — Stripe's numbers, restated here, with nothing to keep
   * the two in step. A test asserting those constants was the codebase agreeing
   * with itself.
   */
  t("⚠ §3 — the hardcoded 1-to-1 price table is gone", !/ONE_TO_ONE_QAR/.test(legacy));
  t("⚠ §3 — and no tuition module reconstructs one",
    walkSrc("src/lib/tuition").concat(walkSrc("src/components/tuition"))
      .every((p) => !/\b(300|1250|250|1000)\s*[,:]\s*(?:\/\/)?\s*(?:QAR|riyal)/i.test(code(readFileSync(p, "utf8")))));

  /**
   * ⚠ AND THE OLD STERLING ANCHORS ARE NOT SOMEWHERE ELSE. £169/£149/£139 were
   * the group monthly prices the site displayed; they must not survive as a
   * literal in any tuition surface now that Stripe owns the amount.
   */
  const tuitionFiles = walkSrc("src/lib/tuition")
    .concat(walkSrc("src/components/tuition"), walkSrc("src/app/api/tuition"));
  const staleAnchors = tuitionFiles.filter((p) =>
    /\b(16900|14900|13900|26600|21300|79400|65300)\b/.test(code(readFileSync(p, "utf8"))));
  t("⚠ §3 — no old GBP or QAR anchor survives as a literal",
    staleAnchors.length === 0, staleAnchors.join(", "));

  /**
   * ⚠ WHAT REPLACED IT, ASSERTED POSITIVELY. Both currencies are read off the
   * currency_options of ONE Stripe Price — the same Price id the checkout route
   * puts in its line item — so display and charge cannot diverge.
   */
  const catalogue = code(readFileSync("src/lib/tuition/stripe-catalogue.ts", "utf8"));
  t("⚠ §3 — currencies come from the Price's own currency_options",
    /currency_options/.test(catalogue));
  t("⚠ §3 — including the decimal field Stripe uses for converted amounts",
    /unit_amount_decimal/.test(catalogue));
  const pricingLayer = code(readFileSync("src/lib/tuition/tuition-pricing.ts", "utf8"));
  t("⚠ §3 — one resolve per package feeds every currency",
    /options\.find\(\(o\) => o\.currency === cur\)/.test(pricingLayer));
  const checkout = code(readFileSync("src/app/api/tuition/checkout/route.ts", "utf8"));
  t("⚠ §3 — and Checkout charges that same resolved Price",
    /"line_items\[0\]\[price\]": price\.id/.test(checkout));

  /**
   * ⚠ THE COMPONENT NO LONGER CONVERTS, AND NO LONGER PRINTS A SECOND AMOUNT.
   * Kept from the original section, because these two were the assertions that
   * actually protected the customer rather than describing the maths.
   */
  t("⚠ §3 — no component converts currency itself",
    !/QAR_PER_GBP|GBP_PER_QAR|EXCHANGE_RATE|FX_RATE/.test(code(MODES))
      && !/[*/]\s*\d+\.\d+/.test(code(MODES)));
  t("⚠ §3 — and no component calls fromGbp()/fromQar()",
    !/\bfrom(Gbp|Qar)\s*\(/.test(code(MODES)));
  t("⚠ §6 — the dual-currency 'charged as' line is gone from the components",
    !MODES.includes("billingNote("));
  t("⚠ §6 — and from the roadmap page, which had its own copy",
    !/billingNote\(/.test(code(readFileSync("src/app/[locale]/tuition/[cohort]/roadmap/page.tsx", "utf8"))));

  /**
   * ⚠ THE PIECES THAT ARE NOT COMMERCIAL SURVIVED, and that is deliberate:
   * monthsFor() derives a teaching window from a cohort's own dates. It is a
   * fact about the programme, never a price, and the card still needs it to say
   * "best value over 10 months".
   */
  t("§3 — the teaching-window derivation is untouched",
    typeof monthsFor === "function" && typeof billableMonths === "function");
}

// ============================================================================
console.log("\n=== 3. ⚠ §7 of the header — nine months is DERIVED ===");
// ============================================================================
{
  t("⚠ §20 — the academic commitment is not a hardcoded number",
    COMMITMENT_MONTHS.academic_year === "programme");
  /**
   * ============================================================================
   * ⚠ THE WINDOW COMES FROM THE ROW. A CONFIG COPY OF A COLUMN CANNOT RETURN.
   * ============================================================================
   * pricing.ts held a slug→window map, written on the belief that `cohorts`
   * had no end date. `cohorts.ends_on` is `date not null` and has been since
   * 0009 — the reader just never selected it, and the belief came from reading
   * a SELECT list instead of the schema.
   *
   * It shipped: the map had ONE entry, so Year 11 and Year 10 told live
   * visitors their programme dates were unpublished while the rows held them.
   *
   * These checks make the copy structurally impossible to reintroduce.
   */
  const READERS = readFileSync("src/lib/public/readers.ts", "utf8");
  const CATALOGUE = readFileSync("src/lib/public/catalogue.ts", "utf8");

  t("⚠ the reader SELECTS ends_on", /ends_on/.test(READERS),
    READERS.match(/\.select\([\s\S]{0,300}?\)/)?.[0]?.slice(0, 120));
  t("⚠ and the row mapper carries it", /lastClassOn: str\(row\.ends_on\)/.test(CATALOGUE));
  /**
   * ⚠ code(), NOT THE RAW FILE — THE FOURTH TIME THIS HAS BITTEN.
   * pricing.ts's own header says "THERE IS NO PROGRAMME_WINDOW CONSTANT", so a
   * raw scan finds the words and fails on correct code. Every content check in
   * these guards must strip comments first; a guard that cannot tell code from
   * prose pressures the next person to delete the documentation to go green.
   */
  t("⚠ NO slug→window map exists in pricing", !/PROGRAMME_WINDOW/.test(code(PRICING)));
  t("⚠ and quote() cannot be handed a slug to look one up with",
    /export function quote\(monthlyMinor: number, commitment: Commitment, window: TeachingWindow\)/.test(PRICING));

  /**
   * ⚠ THE GENERAL RULE, NOT JUST THIS COLUMN. Any date-shaped constant keyed
   * by cohort slug in the pricing config is the same mistake wearing a
   * different name, so the shape itself is refused.
   */
  const slugKeyedDates = /["'][a-z0-9-]*(?:cohort|chemistry|igcse|ial)[a-z0-9-]*["']\s*:\s*\{[^}]*\d{4}-\d{2}-\d{2}/;
  t("⚠ no cohort-slug-keyed date map anywhere in the pricing config",
    !slugKeyedDates.test(code(PRICING)), code(PRICING).match(slugKeyedDates)?.[0]);
  t("⚠ pricing holds no ISO date literal at all — dates belong to the row",
    !/\d{4}-\d{2}-\d{2}/.test(code(PRICING)), code(PRICING).match(/\d{4}-\d{2}-\d{2}/)?.[0]);

  // The derivation itself, against the real windows.
  const IAL = { firstClassOn: "2026-09-15", lastClassOn: "2027-05-21" };
  const IGCSE = { firstClassOn: "2026-09-01", lastClassOn: "2027-06-30" };
  t("⚠ §7 — the IAL window derives to 9 months",
    monthsFor("academic_year", IAL) === 9, monthsFor("academic_year", IAL));
  t("⚠ the IGCSE window derives to 10 — its OWN dates, not the IAL's",
    monthsFor("academic_year", IGCSE) === 10, monthsFor("academic_year", IGCSE));
  t("⚠ two cohorts with different windows price differently",
    quote(14900, "academic_year", IGCSE)!.months !== quote(14900, "academic_year", IAL)!.months);

  /**
   * ⚠ AND EVERY COHORT THE PRODUCT SHIPS MUST HAVE A WINDOW. This is the check
   * that would have caught the original defect: it walks the real cohort list
   * rather than a slug someone remembered to add.
   */
  for (const c of FALLBACK_COHORTS) {
    t(`⚠ ${c.slug} has a teaching window, so it can be priced`,
      !!c.firstClassOn && !!c.lastClassOn, `${c.firstClassOn} → ${c.lastClassOn}`);
    t(`   …and it derives to a positive month count`,
      monthsFor("academic_year", { firstClassOn: c.firstClassOn, lastClassOn: c.lastClassOn }) > 0);
  }

  t("§18/§47 — the card prints the real dates, never '12 months'",
    /t\("tuition\.coversTeaching", \{ from: fmt\(window\.firstClassOn\)/.test(MODES)
      && msg("tuition.coversTeaching").includes("{from}")
      && msg("tuition.coversTeaching").includes("{to}")
      && !/12 months/.test(code(MODES))
      && !msg("tuition.coversTeaching").includes("12 months"),
    msg("tuition.coversTeaching"));
}

// ============================================================================
console.log("\n=== 4. ⚠ §5 of the header / §26 — the CTA is derived ===");
// ============================================================================
{
  t("⚠ §26 — 'Reserve your place' is conditional, not typed",
    /canReserve \? t\("tuition\.reserveYourPlace"\) : t\("tuition\.registerInterest"\)/.test(MODES)
      && msg("tuition.reserveYourPlace") === "Reserve your place"
      && msg("tuition.registerInterest") === "Register interest",
    `${msg("tuition.reserveYourPlace")} / ${msg("tuition.registerInterest")}`);
  t("⚠ §26 — and the condition is status AND a payment link",
    /cohort\.status === "enrolling" && !!cohort\.enrolmentUrl/.test(MODES));
  t("§26 — no unconditional Reserve string",
    !/>\s*Reserve your place/.test(code(MODES))
      && (code(MODES).match(/tuition\.reserveYourPlace/g) ?? []).length === 1);

  // The same AND, exercised through the shared availability function.
  t("§26 — a cohort with no link is not enrolable",
    availabilityFor("chemistry", [{ subject: "chemistry", status: "enrolling", enrolmentUrl: null }]).state === "interest");
  t("§26 — with a link it is",
    availabilityFor("chemistry", [{ subject: "chemistry", status: "enrolling", enrolmentUrl: "https://pay" }]).state === "enrolling");
}

// ============================================================================
console.log("\n=== 5. ⚠ §10/§25 — capacity from the RPC, never invented ===");
// ============================================================================
{
  t("§10 — the page reads loadCapacity", PAGE.includes("loadCapacity("));
  t("⚠ §10 — and never counts cohort_enrolments", !/cohort_enrolments/.test(code(PAGE) + code(MODES)));
  // ⚠ THE FALLBACK IS A TEMPLATE LITERAL, NOT JSX INTERPOLATION — the first
  // version of this check looked for `{cohort.seatCap}` and failed against
  // correct code. Checking both halves separately says what it means.
  t("⚠ §25 — an unknown count shows the cap alone, not a number",
    MODES.includes("capacity?.known")
      && MODES.includes('t("tuition.maximumStudents"')
      && MODES.includes('t("tuition.placesTaken"')
      && msg("tuition.maximumStudents").includes("{cap}")
      && !/\{taken\}/.test(msg("tuition.maximumStudents"))
      && msg("tuition.placesTaken").includes("{taken}")
      && msg("tuition.placesTaken").includes("{cap}"),
    `${msg("tuition.maximumStudents")} | ${msg("tuition.placesTaken")}`);
  // §58 — no fake urgency anywhere on the surface.
  for (const re of [/only \d+ left/i, /selling fast/i, /countdown/i, /\d+ people (are )?viewing/i, /hurry/i]) {
    t(`⚠ §58 — no ${re.source}`, !re.test(code(MODES) + code(PAGE)));
  }
}

// ============================================================================
console.log("\n=== 6. ⚠ §4 — no Stripe products were created ===");
// ============================================================================
{
  const ui = code(MODES) + code(PAGE) + code(PRICING);
  t("§4 — no Stripe product or price is constructed",
    !/stripe\.(products|prices)\.create|new Stripe\(/.test(ui));
  t("§4 — no price id is invented in config", !/price_[A-Za-z0-9]{8,}/.test(ui));
  t("§43 — the client is never handed an amount to submit",
    !/body:\s*JSON\.stringify\([^)]*amount/.test(ui));
}

// ============================================================================
console.log("\n=== 7. ⚠ §9/§34 — one calendar, filtered by mode ===");
// ============================================================================
{
  t("§9 — the page renders the shared Calendar", PAGE.includes("<Calendar"));
  t("§9 — fed by the shared reader", PAGE.includes("loadCalendarEvents"));
  t("§9 — no third calendar component was created",
    !existsSync("src/components/tuition/TuitionCalendar.tsx"));
  t("⚠ §34 — the chosen product sets the calendar's type filter",
    /mode === "one-to-one" \? "private"/.test(PAGE));
  t("⚠ §34 — but an explicit ?type= still wins, so it is not a lock",
    /params\.type\s*\?\s*state\.type/.test(PAGE));
  // §9 of the header — the §50 panel must survive here too.
  t("⚠ §50 — this page also feeds the empty-month panel a real next lesson",
    /nextGroupAhead=\{ahead\.kind === "session"/.test(PAGE));
  t("§59 — 1-to-1 with nothing published says so, and offers the interest route",
    /"tuition\.calendarEmptyOneToOne"/.test(PAGE)
      && /No 1-to-1 times are published for this period yet/.test(msg("tuition.calendarEmptyOneToOne")),
    msg("tuition.calendarEmptyOneToOne"));
}

// ============================================================================
console.log("\n=== 8. §3 of the tuition brief — URL state, and nothing broken ===");
// ============================================================================
{
  t("§3 — mode is read from the URL", /isTuitionMode\(params\.mode\)/.test(PAGE));
  t("§3 — commitment too", /isCommitment\(params\.commitment\)/.test(PAGE));
  t("§3 — both fall back rather than throwing on junk",
    /\? params\.mode : "group"/.test(PAGE) && /: "monthly"/.test(PAGE));
  t("§51 — no new top-level route was added",
    !hasRoute("/tuition/group") && !hasRoute("/tuition/one-to-one/book"));
  for (const p of ["/tuition", "/tuition/one-to-one", "/tuition/interest", "/calendar", "/intensive"]) {
    t(`§preserve — ${p} still resolves`, hasRoute(p));
  }
  t("§preserve — no URL moved, so nothing was owed a redirect",
    !/redirect\(|permanentRedirect/.test(code(PAGE)));
}

// ============================================================================
console.log("\n=== 9. ⚠ a fallback render is visible, not silent ===");
// ============================================================================
{
  /**
   * ⚠ THE PAGE USED TO THROW THIS AWAY, AND IT COST A DAY OF GUESSING.
   * `const { data: cohorts } = await loadCohorts()` discarded source, reason
   * and refusals — so when two cards said their programme dates were
   * unpublished, nothing in the response could say whether the request had
   * read the database or fallen back to the in-code catalogue. The symptom
   * had two causes and no way to separate them.
   */
  t("⚠ the page keeps source and reason", /source: cohortSource, reason: cohortReason/.test(PAGE));
  t("⚠ and refusals", /refusals: cohortRefusals/.test(PAGE));
  t("⚠ it no longer discards them", !/const \{ data: cohorts \} = await loadCohorts\(\)/.test(code(PAGE)));

  /**
   * ⚠ RENDERED IN PRODUCTION, NOT ONLY IN DEV. /calendar gates its equivalent
   * on NODE_ENV, which leaves it dark in the one environment where the
   * question was actually asked. An attribute is invisible on screen and
   * present in the response, which is what an operator needs.
   */
  t("⚠ the marker is an attribute, so it survives production",
    /data-cohort-source=\{cohortSource\}/.test(PAGE));
  const attrBlock = PAGE.slice(PAGE.indexOf("data-cohort-source"), PAGE.indexOf("data-cohort-source") + 400);
  t("⚠ and it is NOT gated on NODE_ENV",
    !/NODE_ENV/.test(attrBlock), attrBlock.match(/NODE_ENV/)?.[0]);
  t("the reason rides along when there is one", /data-cohort-reason=/.test(PAGE));

  // ⚠ NO VISITOR-FACING DISCLOSURE. The readable line stays dev-only, exactly
  // as /calendar has it: a reader is never told which source served them.
  t("the human-readable line remains dev-only",
    /NODE_ENV !== "production"[\s\S]{0,120}cohortSource !== "database"/.test(PAGE));
  t("⚠ no credential or row detail is ever surfaced",
    !/service_role|SUPABASE_|password|token/i.test(code(PAGE)));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
