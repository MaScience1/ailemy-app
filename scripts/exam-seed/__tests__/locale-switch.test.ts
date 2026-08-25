/**
 * THE LANGUAGE TOGGLE MUST PRODUCE EXACTLY ONE LOCALE SEGMENT.
 *
 * ============================================================================
 * ⚠ TWO WAYS THE TOGGLE SENDS A READER TO A 404, AND THIS ASSERTS THE HREF.
 * ============================================================================
 *  1. DOUBLING — /ar + /ar = /ar/ar. next-intl's Link prefixes whatever it is
 *     given, so handing it a path that still carries its locale prefixes twice.
 *  2. PREFIXING AN UNLOCALISED ROOT — /calendar becomes /ar/calendar, and
 *     twenty-four route folders deliberately live outside the locale segment.
 *     Reproduced on production 2026-08-25: pressing العربية on /calendar,
 *     /past-papers or /resources lands on a 404.
 *
 * ⚠ EVERY ASSERTION BELOW CHECKS THE RESULTING HREF, never that a helper was
 * called. A guard that checked "localeSwitchPath appears in the component"
 * would pass while the reader still landed on /ar/ar.
 */
import { readFileSync } from "node:fs";

import {
  stripLocale, localeSwitchPath, localeSwitchHref, UNLOCALISED_SAMPLE,
} from "../../../src/i18n/locale-switch.ts";
import { routing } from "../../../src/i18n/routing.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/** How many locale segments a path starts with. The number that must be ≤ 1. */
const localeSegments = (href: string): number => {
  let n = 0;
  let parts = href.split("/").filter(Boolean);
  for (const p of parts) {
    if ((routing.locales as readonly string[]).includes(p)) n++;
    else break;
  }
  return n;
};

/** ⚠ THE MATRIX, derived — the founder's four plus every unlocalised root. */
const MATRIX = [
  "/", "/tuition", "/ar", "/ar/tuition",
  "/tuition/one-to-one", "/tuition/ial-chemistry-as-sep-2026/roadmap",
  "/ar/tuition/ial-chemistry-as-sep-2026/roadmap",
  ...UNLOCALISED_SAMPLE,
  ...UNLOCALISED_SAMPLE.map((p) => `/ar${p}`),
];

console.log("\n=== 1. THE INVARIANT — exactly one locale segment, every path, every locale ===");
{
  const bad: string[] = [];
  for (const p of MATRIX) {
    for (const loc of routing.locales) {
      const href = localeSwitchHref(p, loc);
      const n = localeSegments(href);
      const expected = loc === routing.defaultLocale ? 0 : 1;
      if (n !== expected) bad.push(`${p} + ${loc} -> ${href} (${n} segments, expected ${expected})`);
    }
  }
  t(`⚠ every path in the matrix yields the right prefix count (${MATRIX.length} paths × ${routing.locales.length} locales)`,
    bad.length === 0, bad.slice(0, 6).join("\n      "));
  t("the matrix is not empty and covers both localised and unlocalised roots",
    MATRIX.length > 20 && MATRIX.includes("/calendar") && MATRIX.includes("/ar/tuition"),
    `${MATRIX.length} paths`);
}

console.log("\n=== 2. DOUBLING is impossible by construction ===");
{
  t("/ar + ar -> /ar, not /ar/ar", localeSwitchHref("/ar", "ar") === "/ar",
    localeSwitchHref("/ar", "ar"));
  t("/ar/tuition + ar -> /ar/tuition", localeSwitchHref("/ar/tuition", "ar") === "/ar/tuition",
    localeSwitchHref("/ar/tuition", "ar"));
  /** ⚠ EVEN IF A CALLER HANDS IT AN ALREADY-PREFIXED PATH. This is the case
   *  next-intl's usePathname() normally prevents — the guard does not rely on
   *  that behaviour holding. */
  t("⚠ an already-prefixed path is stripped, not prefixed again",
    stripLocale("/ar/tuition") === "/tuition" && stripLocale("/ar") === "/");
  t("stripLocale is idempotent", stripLocale(stripLocale("/ar/tuition")) === "/tuition");
  t("a path that merely STARTS with the letters is not treated as a locale",
    stripLocale("/architecture") === "/architecture");
}

console.log("\n=== 3. UNLOCALISED ROOTS go to the locale root, not to a 404 ===");
{
  t("/calendar + ar -> /ar (not /ar/calendar)", localeSwitchHref("/calendar", "ar") === "/ar",
    localeSwitchHref("/calendar", "ar"));
  t("/past-papers + ar -> /ar", localeSwitchHref("/past-papers", "ar") === "/ar");
  t("/login + ar -> /ar", localeSwitchHref("/login", "ar") === "/ar");
  const leaked = UNLOCALISED_SAMPLE.filter((p) => localeSwitchHref(p, "ar") !== "/ar");
  t("⚠ NO unlocalised root is ever prefixed", leaked.length === 0, leaked.join(", "));
  /** ⚠ AND THE CONTROL STAYS USEFUL — it must not resolve to nothing. */
  t("the toggle never produces an empty or relative href",
    MATRIX.every((p) => routing.locales.every((l) => localeSwitchHref(p, l).startsWith("/"))));
}

console.log("\n=== 4. localised paths are PRESERVED, not flattened ===");
{
  /** ⚠ THE OPPOSITE FAILURE. Sending everything to /ar would satisfy §3 while
   *  destroying the feature — a reader on /ar/tuition must stay on tuition. */
  t("/tuition + ar keeps the page", localeSwitchHref("/tuition", "ar") === "/ar/tuition");
  t("a deep localised path keeps its whole tail",
    localeSwitchHref("/tuition/ial-chemistry-as-sep-2026/roadmap", "ar")
      === "/ar/tuition/ial-chemistry-as-sep-2026/roadmap");
  t("English drops the prefix entirely (localePrefix: as-needed)",
    localeSwitchHref("/ar/tuition", "en") === "/tuition");
}

console.log("\n=== 5. the component actually routes through it ===");
{
  const toggle = code(readFileSync("src/components/i18n/LanguageToggle.tsx", "utf8"));
  t("the toggle imports localeSwitchPath", /localeSwitchPath/.test(toggle));
  t("⚠ and the href is built from its result, not from the raw pathname",
    /pathname:\s*target/.test(toggle) && !/href=\{\{\s*pathname,\s*params\s*\}/.test(toggle));
}

console.log("\n=== 6. the toggle is REACHABLE, not merely present ===");
{
  /**
   * ⚠ THE FAILURE THIS CATCHES IS INVISIBILITY, NOT A WRONG HREF. The toggle
   * had exactly one render site, inside a `hidden … md:flex` container, so
   * below the md breakpoint it was in the DOM and had zero visible size.
   * Measured at 375 on /ar before the fix: two toggle anchors present, ZERO
   * visible, and none inside the drawer. Every href assertion above passed the
   * whole time — a reader on a phone simply could not reach the control.
   */
  const nav = code(readFileSync("src/components/site/SiteNav.tsx", "utf8"));
  const sites = (nav.match(/<LanguageToggle\s*\/>/g) ?? []).length;
  t("⚠ the toggle renders in BOTH the desktop bar and the mobile drawer",
    sites >= 2, `${sites} render site(s)`);

  /**
   * ⚠ AND THE SECOND ONE IS NOT INSIDE THE DESKTOP-ONLY CONTAINER. Splitting on
   * the drawer's own marker is what distinguishes "rendered twice" from
   * "rendered twice in the same hidden box".
   */
  const drawerAt = nav.indexOf("absolute inset-x-0 top-full");
  t("the drawer exists to anchor against", drawerAt > 0);
  const afterDrawer = nav.slice(drawerAt);
  t("⚠ one render site is inside the mobile drawer",
    /<LanguageToggle\s*\/>/.test(afterDrawer));

  const desktopOnly = nav.slice(0, drawerAt);
  t("and one is still in the desktop bar", /<LanguageToggle\s*\/>/.test(desktopOnly));

  /**
   * ⚠ ONE IMPLEMENTATION, TWO PLACEMENTS. A second component emitting locale
   * links would be a second place for the doubling bug to return, and would
   * not inherit localeSwitchPath's strip.
   */
  t("⚠ LanguageToggle is still the ONLY thing emitting a locale link",
    (code(readFileSync("src/components/i18n/LanguageToggle.tsx", "utf8")).match(/hrefLang/g) ?? []).length >= 1
    && !/hrefLang/.test(nav));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
