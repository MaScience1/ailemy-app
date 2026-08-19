/**
 * Dual-currency display: what a visitor sees, and what they can never be shown.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/currency.test.ts
 *
 * ============================================================================
 * ⚠ THE ONE RULE THIS SUITE EXISTS FOR
 * ============================================================================
 * GBP is the amount a parent is charged. QAR is a label the founder typed. So
 * a QAR figure may never appear without its sterling line beside it, and a
 * cohort with no QAR price may never be shown a QAR figure at all — not by
 * geography, not by a toggle, not by both together.
 *
 * No FX rate appears anywhere in the source under test, and the last block
 * asserts that as source text rather than trusting the reading.
 *
 * ⚠ FIXTURES DERIVED FROM THE REAL CATALOGUE (AGENTS.md). The cohorts are
 * FALLBACK_COHORTS entries, so a price change cannot leave a hand-typed number
 * here pinning last week's figure.
 */
import { readFileSync } from "node:fs";

import {
  resolveCurrency, priceDisplay, isCurrency, offersCurrencyChoice,
  CURRENCY_COOKIE, COUNTRY_HEADER,
} from "../../../src/lib/public/currency.ts";
import { FALLBACK_COHORTS, priceLabel, type Cohort } from "../../../src/lib/public/catalogue.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const AS = FALLBACK_COHORTS.find((c) => c.slug === "ial-chemistry-as-sep-2026")!;
const Y11 = FALLBACK_COHORTS.find((c) => c.slug === "igcse-chemistry-y11")!;
const Y10 = FALLBACK_COHORTS.find((c) => c.slug === "igcse-chemistry-y10")!;

console.log("── RESOLUTION: GEOGRAPHY IS A GUESS, THE TOGGLE IS AN ANSWER ──");
{
  t("QA header with no cookie → QAR",
    resolveCurrency({ country: "QA" }).currency === "QAR", resolveCurrency({ country: "QA" }));
  t("…and the source says it was geography",
    resolveCurrency({ country: "QA" }).source === "geo");
  t("no header at all → GBP", resolveCurrency({}).currency === "GBP", resolveCurrency({}));
  t("null header → GBP", resolveCurrency({ country: null }).currency === "GBP");
  t("empty header → GBP", resolveCurrency({ country: "" }).currency === "GBP");
  t("some other country → GBP", resolveCurrency({ country: "GB" }).currency === "GBP");
  t("…including a neighbour", resolveCurrency({ country: "AE" }).currency === "GBP");

  // A lowercase rewrite from a proxy must not silently change a price.
  t("a lowercase 'qa' is still Qatar", resolveCurrency({ country: "qa" }).currency === "QAR");
  t("…and whitespace is tolerated", resolveCurrency({ country: " QA " }).currency === "QAR");

  // ⚠ THE COOKIE WINS, BOTH WAYS. A visitor in Doha who asked for GBP must get
  // GBP, or the toggle is decorative.
  t("cookie GBP beats a QA header",
    resolveCurrency({ country: "QA", cookie: "GBP" }).currency === "GBP",
    resolveCurrency({ country: "QA", cookie: "GBP" }));
  t("…and the source says it was the cookie",
    resolveCurrency({ country: "QA", cookie: "GBP" }).source === "cookie");
  t("cookie QAR beats no header",
    resolveCurrency({ cookie: "QAR" }).currency === "QAR");
  t("cookie QAR beats a non-QA header",
    resolveCurrency({ country: "GB", cookie: "QAR" }).currency === "QAR");

  // The cookie is the one input a browser can set to anything.
  for (const junk of ["USD", "qar", "'; DROP", "", "  ", "GBPX"]) {
    const r = resolveCurrency({ country: "GB", cookie: junk });
    t(`junk cookie ${JSON.stringify(junk)} is ignored → GBP`, r.currency === "GBP" && r.source !== "cookie", r);
  }
  t("…but junk does not suppress geography",
    resolveCurrency({ country: "QA", cookie: "USD" }).currency === "QAR");

  t("isCurrency accepts exactly the two", isCurrency("GBP") && isCurrency("QAR"));
  t("…and nothing else", !isCurrency("qar") && !isCurrency("USD") && !isCurrency(null) && !isCurrency(800));

  t("the cookie and header names are the ones the server reads",
    CURRENCY_COOKIE === "ailemy_currency" && COUNTRY_HEADER === "x-vercel-ip-country",
    { CURRENCY_COOKIE, COUNTRY_HEADER });
}

console.log("\n── DISPLAY: THE GBP TRUTH IS ALWAYS ON SCREEN ──");
{
  const q = priceDisplay(AS, "QAR");
  t("AS in QAR reads '800 QAR/month'", q.primary === "800 QAR/month", q.primary);
  t("…and carries the sterling line", q.billedIn === "Billed in GBP (£169/month)", q.billedIn);
  t("…and the line names the SAME figure the GBP view shows",
    q.billedIn === `Billed in GBP (${priceLabel(AS)})`, { line: q.billedIn, gbp: priceLabel(AS) });
  t("…and reports it is showing QAR", q.shown === "QAR");

  const g = priceDisplay(AS, "GBP");
  t("AS in GBP reads '£169/month'", g.primary === "£169/month", g.primary);
  t("…with no second line, because the headline IS the billed amount",
    g.billedIn === null, g.billedIn);

  t("Y11 in QAR is 700", priceDisplay(Y11, "QAR").primary === "700 QAR/month", priceDisplay(Y11, "QAR").primary);
  t("Y10 in QAR is 650", priceDisplay(Y10, "QAR").primary === "650 QAR/month", priceDisplay(Y10, "QAR").primary);
  t("Y11's sterling line is £149", priceDisplay(Y11, "QAR").billedIn === "Billed in GBP (£149/month)");
  t("Y10's sterling line is £139", priceDisplay(Y10, "QAR").billedIn === "Billed in GBP (£139/month)");

  // ⚠ STRUCTURAL, NOT A CONVENTION. Every QAR display carries a line; no GBP
  // display does. A template cannot get this wrong because it is not asked.
  for (const c of FALLBACK_COHORTS) {
    const d = priceDisplay(c, "QAR");
    t(`${c.slug}: QAR view has a sterling line iff it is showing QAR`,
      (d.shown === "QAR") === (d.billedIn !== null), d);
  }
}

console.log("\n── SABOTAGE: NULL price_qar NEVER RENDERS QAR ──");
{
  // The spec's named sabotage. A cohort with no QAR figure must render GBP
  // however hard the request asks for QAR.
  const noQar: Cohort = { ...AS, priceQar: null };
  const d = priceDisplay(noQar, "QAR");
  t("asking for QAR on a NULL price returns the GBP figure",
    d.primary === "£169/month", d.primary);
  t("…and says it is showing GBP, not QAR", d.shown === "GBP", d.shown);
  t("…with no sterling line, because the headline already IS sterling",
    d.billedIn === null, d.billedIn);
  t("…and the string 'QAR' appears nowhere in the output",
    !JSON.stringify(d).includes("QAR"), d);

  // 0042 refuses 0 and negatives, but a stale cache or a hand-edited row must
  // not be able to print "0 QAR/month" either.
  for (const bad of [0, -1, -800]) {
    const r = priceDisplay({ ...AS, priceQar: bad }, "QAR");
    t(`price_qar ${bad} renders GBP, never a QAR figure`,
      r.shown === "GBP" && r.primary === "£169/month", r);
  }

  // Geography alone must not conjure one either — resolution and display are
  // separate, and this is the pair that matters.
  const viaGeo = resolveCurrency({ country: "QA" }).currency;
  t("a Qatari visitor on a NULL-price cohort still sees GBP",
    priceDisplay(noQar, viaGeo).shown === "GBP");
}

console.log("\n── A TOGGLE THAT WOULD CHANGE NOTHING IS NOT SHOWN ──");
{
  t("cohorts with QAR prices offer the choice", offersCurrencyChoice(FALLBACK_COHORTS));
  t("none with a price → no toggle",
    !offersCurrencyChoice(FALLBACK_COHORTS.map((c) => ({ ...c, priceQar: null }))));
  t("an empty page offers nothing", !offersCurrencyChoice([]));
  t("one priced cohort is enough",
    offersCurrencyChoice([{ priceQar: null }, { priceQar: 700 }]));
  t("zero does not count as a price", !offersCurrencyChoice([{ priceQar: 0 }]));
}

console.log("\n── NO FX ANYWHERE IN THE SOURCE ──");
{
  // ⚠ ASSERTED AS TEXT, NOT AS A READING. The rule is that no rate exists; the
  // cheapest way for it to be broken later is somebody adding one here.
  const files = [
    "src/lib/public/currency.ts",
    "src/lib/public/currency-server.ts",
    "src/components/public/CohortPrice.tsx",
    "src/app/_actions/currency.ts",
  ];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    t(`${f}: no exchange-rate arithmetic`,
      !/\b(rate|fx|convert|exchange)\s*[:=(]/i.test(code), (code.match(/\b(rate|fx|convert|exchange)\s*[:=(]/i) ?? [])[0]);
    t(`${f}: no network call`, !/\bfetch\s*\(|axios|https?:\/\//.test(code));
  }
  // The one multiplication allowed near money is pence → pounds, and it lives
  // in priceLabel, not here.
  const cur = readFileSync("src/lib/public/currency.ts", "utf8");
  t("currency.ts does no arithmetic on priceQar at all",
    !/priceQar\s*[*/+-]/.test(cur));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
