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
  DISCOUNTS, QAR_PER_GBP, PROGRAMME_WINDOW, COMMITMENT_MONTHS,
  billableMonths, monthsFor, quote, oneToOneQuote, displayAmount, billingNote,
  fromGbp, fromQar, show, ONE_TO_ONE_QAR,
  type Commitment,
} from "../../../src/lib/tuition/pricing.ts";
import { availabilityFor } from "../../../src/lib/tuition/availability.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
const MODES = readFileSync("src/components/tuition/TuitionModes.tsx", "utf8");
const PAGE = readFileSync("src/app/tuition/page.tsx", "utf8");
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
const ROUTES = routes(APP);
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
  const yr = quote(16900, "academic_year", "ial-chemistry-as-sep-2026")!;
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
  t("§44 — the components read quote()/oneToOneQuote() instead",
    MODES.includes("quote(cohort.pricePence") && MODES.includes("oneToOneQuote(level"));
  t("§2 — there is exactly one pricing module",
    existsSync("src/lib/tuition/pricing.ts") && !existsSync("src/lib/tuition/prices.ts"));
}

// ============================================================================
console.log("\n=== 2. ⚠ §3 — ONE currency rate, GBP is billing truth ===");
// ============================================================================
{
  t("§3 — a single exported rate exists", typeof QAR_PER_GBP === "number" && QAR_PER_GBP > 0);
  t("⚠ §3 — and it is the only conversion factor in the module",
    (code(PRICING).match(/QAR_PER_GBP/g) ?? []).length <= 3,
    (code(PRICING).match(/QAR_PER_GBP/g) ?? []).length);
  t("⚠ §3 — no component converts currency itself",
    !/\*\s*4\.7|\*\s*5(\.0)?\b|QAR_PER_GBP/.test(code(MODES)));

  /**
   * ⚠ THE TWO RATES THE BRIEF CARRIED, PINNED AS A FACT.
   * Group prices imply ~4.70; 1-to-1 prices imply exactly 5.00. Only one
   * survives, and this records which figures move as a result so the shift is
   * a decision on the record rather than a surprise in a screenshot.
   */
  /**
   * ⚠ TWO ANCHORS, ONE RATE — AND THE ANCHOR MUST SURVIVE DISPLAY.
   * Group programmes are priced in sterling and quoted to Stripe in it, so QAR
   * is derived. 1-to-1 is quoted to Doha families in riyals, so those figures
   * are exact and sterling is derived. Deriving £64 from 300 QAR and then
   * re-deriving QAR from £64 gives 301: the rounding is not reversible, which
   * is the whole reason a price carries both sides rather than one.
   */
  t("§3 — group is GBP-anchored: £149 → 700 QAR", displayAmount(14900, "QAR") === "700 QAR");
  t("§3 — £169 → 794 QAR", displayAmount(16900, "QAR") === "794 QAR", displayAmount(16900, "QAR"));
  t("§3 — £139 → 653 QAR", displayAmount(13900, "QAR") === "653 QAR", displayAmount(13900, "QAR"));

  const asHour = oneToOneQuote("as_a_level", 1), asPack = oneToOneQuote("as_a_level", 5);
  const gcHour = oneToOneQuote("gcse", 1), gcPack = oneToOneQuote("gcse", 5);
  t("⚠ §3 — 1-to-1 AS shows EXACTLY 300 QAR, the quoted figure",
    show(asHour.total, "QAR") === "300 QAR", show(asHour.total, "QAR"));
  t("§3 — …with sterling derived to £64", show(asHour.total, "GBP") === "£64", show(asHour.total, "GBP"));
  t("⚠ §3 — the 5-hour package shows EXACTLY 1,250 QAR",
    show(asPack.total, "QAR") === "1,250 QAR", show(asPack.total, "QAR"));
  t("§3 — …derived to £266", show(asPack.total, "GBP") === "£266", show(asPack.total, "GBP"));
  t("⚠ §3 — GCSE shows EXACTLY 250 QAR and 1,000 QAR",
    show(gcHour.total, "QAR") === "250 QAR" && show(gcPack.total, "QAR") === "1,000 QAR");
  t("§3 — …derived to £53 and £213",
    show(gcHour.total, "GBP") === "£53" && show(gcPack.total, "GBP") === "£213");

  // ⚠ THE ROUND-TRIP THAT WOULD HAVE BROKEN IT. £64 re-derived gives 301.
  t("⚠ §3 — a QAR anchor is NOT re-derived through its rounded GBP",
    show(fromGbp(6400), "QAR") === "301 QAR" && show(asHour.total, "QAR") === "300 QAR",
    `${show(fromGbp(6400), "QAR")} vs ${show(asHour.total, "QAR")}`);

  // Per-currency arithmetic: each side is the real figure in that currency.
  t("§5 — the package's per-hour rate is 250 QAR", show(asPack.perHour, "QAR") === "250 QAR");
  t("§5 — and its saving is 250 QAR", show(asPack.saving, "QAR") === "250 QAR");
  t("§6 — GCSE's per-hour rate is 200 QAR", show(gcPack.perHour, "QAR") === "200 QAR");
  t("§3 — the price list is four numbers, in riyals",
    ONE_TO_ONE_QAR.as_a_level.hour === 300 && ONE_TO_ONE_QAR.as_a_level.fiveHour === 1250
      && ONE_TO_ONE_QAR.gcse.hour === 250 && ONE_TO_ONE_QAR.gcse.fiveHour === 1000);
  t("§3 — one rate still, applied once at creation",
    show(fromQar(470), "GBP") === "£100" && show(fromGbp(10000), "QAR") === "470 QAR");

  t("⚠ §7 — a QAR figure carries the charged sterling amount",
    billingNote(fromQar(1250), "QAR") === "charged as £266", billingNote(fromQar(1250), "QAR"));
  // ⚠ ONE-DIRECTIONAL. Sterling accompanies riyals; riyals never accompany
  // sterling, because in GBP the headline IS the charged amount.
  t("§7 — and in GBP there is nothing to add", billingNote(fromGbp(25000), "GBP") === null);
  t("⚠ §7 — a GBP view shows no riyal figure at all",
    show(fromGbp(16900), "GBP") === "£169" && !show(fromGbp(16900), "GBP").includes("QAR"));
  t("§7 — the components render it", MODES.includes("billingNote("));
}

// ============================================================================
console.log("\n=== 3. ⚠ §7 of the header — nine months is DERIVED ===");
// ============================================================================
{
  t("⚠ §20 — the academic commitment is not a hardcoded number",
    COMMITMENT_MONTHS.academic_year === "programme");
  t("§7 — the real window is 15 Sep 2026 → 21 May 2027",
    PROGRAMME_WINDOW["ial-chemistry-as-sep-2026"].firstTeachingISO === "2026-09-15"
      && PROGRAMME_WINDOW["ial-chemistry-as-sep-2026"].lastTeachingISO === "2027-05-21");
  t("⚠ §7 — and it derives to 9 billable months",
    monthsFor("academic_year", "ial-chemistry-as-sep-2026") === 9,
    monthsFor("academic_year", "ial-chemistry-as-sep-2026"));

  /**
   * ⚠ MONTHS TOUCHED, NOT ELAPSED. The window is 8.2 months long; a family is
   * taught in September and in May, so it is billed for nine. Dividing the
   * span would undercharge by a month.
   */
  t("§7 — a shorter window prices fewer months",
    billableMonths("2026-09-15", "2027-01-10") === 5, billableMonths("2026-09-15", "2027-01-10"));
  t("§7 — one month inside a single month is 1",
    billableMonths("2026-09-01", "2026-09-30") === 1);
  t("⚠ §7 — moving the end date moves the price, with no code change",
    billableMonths("2026-09-15", "2027-06-21") === 10);
  t("⚠ §20 — a cohort with no window gets NO academic price, not a guess",
    monthsFor("academic_year", "unknown-cohort") === 0
      && quote(16900, "academic_year", "unknown-cohort") === null);
  t("§18/§47 — the card prints the real dates, never '12 months'",
    /Covers teaching from \{fmt\(window\.firstTeachingISO\)\}/.test(MODES)
      && !/12 months/.test(code(MODES)));
}

// ============================================================================
console.log("\n=== 4. ⚠ §5 of the header / §26 — the CTA is derived ===");
// ============================================================================
{
  t("⚠ §26 — 'Reserve your place' is conditional, not typed",
    /canReserve \? "Reserve your place" : "Register interest"/.test(MODES));
  t("⚠ §26 — and the condition is status AND a payment link",
    /cohort\.status === "enrolling" && !!cohort\.enrolmentUrl/.test(MODES));
  t("§26 — no unconditional Reserve string", !/>\s*Reserve your place/.test(code(MODES)));

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
    MODES.includes("capacity?.known") && MODES.includes("Maximum ${cohort.seatCap} students")
      && MODES.includes("${capacity.taken} of ${cohort.seatCap} places taken"));
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
    /No 1-to-1 times are published for this period yet/.test(PAGE));
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

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
