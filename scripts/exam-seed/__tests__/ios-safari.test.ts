/**
 * iOS Safari anti-patterns, refused at the source.
 *
 * ============================================================================
 * ⚠ THIS SUITE DOES NOT VERIFY iOS. NOTHING HERE HAS RUN IN SAFARI.
 * ============================================================================
 * Safari on a device cannot be reached from this repository: previews sit
 * behind Vercel deployment protection, and a cookieless fetch cannot tell a
 * correct render from a fallback one. So this asserts the only thing that IS
 * checkable from here — that the KNOWN ANTI-PATTERNS ARE ABSENT. "The bare
 * 100vh is gone" is a weaker claim than "the layout is correct on an iPhone",
 * and the report says so in those words.
 *
 * VERSION FLOOR ASSUMED: iOS 16.4. dvh (16.4), :has() (15.4), container
 * queries (16.0), flex gap (14.1), scroll-snap (11). Nothing here needs 17+.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** ⚠ Comments are not code. Every scan below runs on the stripped text. */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(p) ? [p] : [];
  });
const FILES = walk("src").map((p) => ({ p, raw: readFileSync(p, "utf8") }));
const SRC = FILES.map((f) => ({ ...f, c: code(f.raw) }));
const GLOBALS = readFileSync("src/app/globals.css", "utf8");

const hits = (re: RegExp, filter?: (f: { p: string; c: string }) => boolean) =>
  SRC.filter((f) => (filter ? filter(f) : true))
     .flatMap((f) => (f.c.match(re) ?? []).map(() => f.p));

console.log("\n=== 1. viewport height ===");
{
  /**
   * ⚠ 100vh ON iOS IS NOT THE VISIBLE VIEWPORT. It is measured with the URL
   * bar collapsed, so a 100vh box is taller than what you can see and its last
   * rows sit under the bar. Where the parent is overflow-hidden there is no
   * scroll to rescue them — which is exactly what the paper-practice workspace
   * did before this pass.
   */
  const bare = SRC.filter((f) => /(?<!d)\b100vh\b/.test(f.c) && !/100dvh/.test(f.c)).map((f) => f.p);
  t("no bare 100vh without a dvh companion", bare.length === 0, bare.join(", "));
  /**
   * ⚠ (?<!min-) — AND THE FIRST VERSION OF THIS GUARD WAS WRONG WITHOUT IT.
   * `\bh-screen\b` matches inside `min-h-screen`, so it reported 48 files, of
   * which nearly all were page shells using min-h-screen. That is HARMLESS on
   * iOS: a minimum height lets content taller than the viewport scroll
   * normally. The dangerous shape is a FIXED h-screen, which pins the box to
   * the URL-bar-collapsed height and hides its own bottom.
   */
  const hScreen = SRC.filter((f) => /(?<!min-)\bh-screen\b/.test(f.c) && !/h-screen-safe|h-dvh/.test(f.c)).map((f) => f.p);
  t("no fixed h-screen without the -safe variant or h-dvh", hScreen.length === 0, hScreen.join(", "));
  t("the dvh utilities exist to be used", /\.h-screen-safe\b/.test(GLOBALS) && /100dvh/.test(GLOBALS));
}

console.log("\n=== 2. safe areas, and the coupling that makes them real ===");
{
  /**
   * ⚠ THE COUPLING GUARD, AND THE POINT OF THIS SECTION.
   * env(safe-area-inset-*) is 0 unless the document sets viewport-fit=cover.
   * This app deliberately does not set it: 19 fixed/sticky elements would lose
   * the browser's automatic inset at once and only a handful have padding to
   * fall back on. The day somebody adds it, every one of those elements needs
   * handling IN THE SAME COMMIT — so this test fails then, on purpose, rather
   * than shipping sixteen unverified edges.
   */
  const layout = SRC.find((f) => f.p.endsWith("app/layout.tsx"));
  const coverSet = !!layout && /viewportFit\s*:\s*["']cover["']/.test(layout.c);
  const bottomFixed = SRC.filter((f) =>
    /fixed\s+inset-x-0\s+bottom-0|fixed\s+bottom-0|fixed\s+inset-0/.test(f.c));
  const withoutInset = bottomFixed.filter((f) => !/safe-area-inset/.test(f.c)).map((f) => f.p);
  t("⚠ viewport-fit=cover is not set without every fixed surface being handled",
    !coverSet || withoutInset.length === 0,
    coverSet
      ? `viewport-fit=cover IS set and ${withoutInset.length} fixed surfaces have no inset: ${withoutInset.join(", ")}`
      : "cover not set — env() is a forward-compatible floor, which is what globals.css says");
  t("the bottom sheet carries a floor that becomes the inset later",
    /safe-area-inset-bottom/.test(SRC.find((f) => f.p.endsWith("calendar/DayPanel.tsx"))?.c ?? ""));
  t("globals.css states that env() is inert today rather than implying it works",
    /viewport-fit=cover/.test(GLOBALS) && /FORWARD-COMPATIBLE/.test(GLOBALS));
}

console.log("\n=== 3. touch, not hover ===");
{
  /**
   * ⚠ CONTENT THAT IS INVISIBLE UNTIL HOVER DOES NOT EXIST ON A PHONE.
   * A hover that changes COLOUR is fine — the thing was already visible. What
   * is refused here is opacity/visibility/display flipping from hidden to
   * shown on hover with no focus or tap equivalent.
   */
  const invisibleUntilHover = SRC.filter((f) => {
    const m = f.c.match(/\b(?:group-)?hover:(?:opacity-100|visible|block|flex|inline-flex)\b/g) ?? [];
    if (m.length === 0) return false;
    return !/focus(-visible|-within)?:(opacity-100|visible|block|flex|inline-flex)/.test(f.c);
  }).map((f) => f.p);
  t("nothing is revealed by hover alone", invisibleUntilHover.length === 0, invisibleUntilHover.join(", "));
  t("the grey tap flash is set deliberately, not inherited",
    /-webkit-tap-highlight-color\s*:/.test(GLOBALS));
  t("a 44px tap-target utility exists", /\.tap-44\b[\s\S]{0,80}min-height:\s*44px/.test(GLOBALS));
}

console.log("\n=== 4. inputs ===");
{
  /**
   * ⚠ SAFARI ZOOMS A FOCUSED CONTROL UNDER 16px AND NEVER ZOOMS BACK.
   * text-sm is 14px. The repo's own ui/input.tsx and login-form.tsx already
   * use `md:text-sm` so the control is 16px on a phone and 14px on a desktop;
   * this refuses the shape that forgets the breakpoint.
   */
  /**
   * ⚠ SCOPE, STATED OUT LOUD RATHER THAN QUIETLY APPLIED.
   * This pass covers the public, student-facing surfaces. /admin is staff-only
   * and desktop-first, and its forms are excluded — but the count is PRINTED,
   * because a guard that silently narrows its own scope reads as "everything
   * is clean" when it is not. Widening this to admin is a separate pass.
   */
  const isAdmin = (p: string) => /\/admin(-inline)?\//.test(p);
  const controls = SRC.filter((f) => /\.tsx$/.test(f.p) && /<(?:input|select|textarea)\b/.test(f.c));
  const bad = (f: { c: string }) => /text-sm/.test(f.c) && !/md:text-sm|sm:text-sm|text-base/.test(f.c);
  const zoomers = controls.filter((f) => !isAdmin(f.p) && bad(f)).map((f) => f.p);
  const adminDeferred = controls.filter((f) => isAdmin(f.p) && bad(f)).length;
  console.log(`      (scope: ${adminDeferred} admin form files NOT covered by this pass)`);
  t("no public form control is pinned to 14px on mobile", zoomers.length === 0, zoomers.join(", "));
  t("globals.css sets a 16px floor for unclassed controls",
    /input,\s*select,\s*textarea\s*\{[\s\S]{0,90}max\(16px/.test(GLOBALS));
  const pickerFiles = SRC.filter((f) => /<input[^>]*type=["'](?:date|time|datetime-local)["']/.test(f.c));
  const publicPickers = pickerFiles.filter((f) => !/\/admin(-inline)?\//.test(f.p)).map((f) => f.p);
  console.log(`      (scope: ${pickerFiles.length - publicPickers.length} admin files use native pickers, deferred)`);
  t("no native date/time picker on a public surface — the iOS wheel reflows the layout around it",
    publicPickers.length === 0, publicPickers.join(", "));
}

console.log("\n=== 5. backdrop-filter ===");
{
  /**
   * ⚠ TAILWIND ALREADY EMITS THE PREFIX — CHECKED, NOT ASSUMED.
   * The built CSS carries 15 `-webkit-backdrop-filter` declarations alongside
   * its `backdrop-filter` ones, so a guard on `backdrop-blur-*` utilities
   * would be a false-positive factory. What actually needs guarding is RAW css
   * in our own stylesheets, where nothing prefixes for us.
   */
  const cssFiles = SRC.filter((f) => f.p.endsWith(".css"));
  const rawUnprefixed = cssFiles.filter((f) => {
    const plain = (f.c.match(/(?<!-webkit-)backdrop-filter\s*:/g) ?? []).length;
    const webkit = (f.c.match(/-webkit-backdrop-filter\s*:/g) ?? []).length;
    return plain > webkit;
  }).map((f) => f.p);
  t("no raw backdrop-filter in our CSS without a -webkit- sibling",
    rawUnprefixed.length === 0, rawUnprefixed.join(", "));
  const noFallback = SRC.filter((f) => /backdrop-blur/.test(f.c))
    .filter((f) => !/bg-(parchment|ink|snow)[\/\w]*/.test(f.c)).map((f) => f.p);
  t("every blurred surface also names a solid background", noFallback.length === 0, noFallback.join(", "));
}

console.log("\n=== 6. the mobile date strip ===");
{
  t("the strip snaps, and does so on the x axis",
    /\.snap-strip\b[\s\S]{0,400}scroll-snap-type:\s*x mandatory/.test(GLOBALS));
  t("momentum scrolling is asked for explicitly",
    /-webkit-overflow-scrolling:\s*touch/.test(GLOBALS));
  t("each child aligns to a snap position",
    /\.snap-strip\s*>\s*\*[\s\S]{0,80}scroll-snap-align/.test(GLOBALS));
  /**
   * ⚠ THE AFFORDANCE IS THE POINT. iOS hides scrollbars, so a strip that can
   * scroll looks identical to one that cannot. The trailing mask fades content
   * at the edge, which is what says "there is more".
   */
  t("there is a visible edge affordance, prefixed for Safari",
    /-webkit-mask-image:\s*linear-gradient\(to right/.test(GLOBALS)
      && /(?<!-webkit-)mask-image:\s*linear-gradient\(to right/.test(GLOBALS));
}

console.log("\n=== 7. Fraunces optical sizing ===");
{
  /**
   * ⚠ A WEIGHT LIST MAKES next/font SERVE STATIC INSTANCES, and a static
   * instance has no opsz axis — so font-optical-sizing had nothing to act on
   * and display headings rendered with body-text letterforms.
   */
  const layout = SRC.find((f) => f.p.endsWith("app/layout.tsx"))?.c ?? "";
  const frauncesCall = layout.match(/Fraunces\(\{[\s\S]*?\}\)/)?.[0] ?? "";
  t("Fraunces is loaded variable, with no weight list",
    frauncesCall.length > 0 && !/weight\s*:/.test(frauncesCall), frauncesCall.slice(0, 120));
  t("and the optical axis is requested", /axes\s*:\s*\[[^\]]*["']opsz["']/.test(frauncesCall));
  t("display type engages it", /\.ai-display\b[\s\S]{0,200}font-optical-sizing:\s*auto/.test(GLOBALS));
}

console.log("\n=== 8. §79 — the agenda invents nothing ===");
{
  const cal = SRC.find((f) => f.p.endsWith("calendar/Calendar.tsx"))?.c ?? "";
  t("the mobile agenda exists", /function MonthAgenda/.test(cal));
  /**
   * ⚠ IT READS buckets AND FILTERS TO DAYS THAT HAVE EVENTS. A day with no
   * lesson is absent, never a placeholder row. If this ever grows a fallback
   * that renders a day with no events, this goes red.
   */
  t("⚠ it lists only days that actually have events",
    /buckets\.get\(d\.date\)\s*\?\?\s*\[\]\)\.length\s*>\s*0/.test(cal));
  t("the empty state is scoped to the visible period, not the whole fetch",
    /visibleCount/.test(cal) && !/events\.length === 0 && state\.view/.test(cal));
  t("§50 — the empty state still precedes the views",
    cal.indexOf("MonthEmptyState") < cal.indexOf("state.view === \"month\""));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
