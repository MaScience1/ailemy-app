/**
 * Navigation simplification: what it changed, and what it must not have.
 *
 * ============================================================================
 * ⚠ THE HEADER SHRANK FROM SIX PRODUCTS TO FOUR. NOTHING WAS DELETED.
 * ============================================================================
 * Chemistry, Biology, Physics, Calendar and Live Tuition left the primary row.
 * Every one of their pages still exists and is still reachable — that is the
 * whole difference between reorganising and deleting, and it is exactly the
 * kind of claim that rots quietly, so it is a test rather than a sentence in a
 * commit message.
 *
 * §34's active-state rule gets the same treatment: a student on /calendar must
 * see Online Tuition lit, or moving Calendar under Tuition has told them
 * nothing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { availabilityFor, availabilityLabel } from "../../../src/lib/tuition/availability.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
const NAV = readFileSync("src/components/site/SiteNav.tsx", "utf8");
const FOOTER = readFileSync("src/components/site/SiteFooter.tsx", "utf8");

function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("_")) continue;
    const next = entry.startsWith("(") && entry.endsWith(")") ? prefix : [...prefix, entry];
    if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
    out.push(...routes(full, next));
  }
  return out;
}
/**
 * ⚠ [locale] IS NOT A URL SEGMENT FOR THE DEFAULT LOCALE.
 *
 * i18n phase 1 moved the homepage and /tuition under app/[locale]/. With
 * localePrefix "as-needed" English carries NO prefix, so
 * app/[locale]/tuition/page.tsx serves /tuition — the live URL is unchanged,
 * which is the entire point of that setting. A walker counting [locale] as a
 * segment reports every one of those routes as missing and makes a working
 * move look like a breakage.
 */
/**
 * ⚠ THE ENGLISH CATALOGUE IS THE SOURCE OF THE NAV WORDS. Reading it here keeps
 * these assertions checking what a visitor sees rather than what a constant in
 * the test says — if a key is renamed and the catalogue is not updated, this
 * resolves to MISSING:<key> and fails loudly.
 */
const EN = JSON.parse(readFileSync("messages/en.json", "utf8")) as { nav: Record<string, string> };

const ROUTES = routes(APP).map((r) => (r[0] === "[locale]" ? r.slice(1) : r));
const hasRoute = (p: string) => {
  // ⚠ THE ROOT IS THE HOMEPAGE, now at app/[locale]/page.tsx, which the walker
  // never emits — it only records pages found inside a DIRECTORY it descended
  // into. Checked directly rather than teaching the walker a special case.
  if (p === "/") return existsSync(join(APP, "[locale]", "page.tsx"));
  const want = p.split("/").filter(Boolean);
  return ROUTES.some((r) => r.length === want.length && r.every((s, i) => s.startsWith("[") || s === want[i]));
};

// ============================================================================
console.log("\n=== 1. ⚠ §58 — nothing that worked was deleted ===");
// ============================================================================
{
  // The pages that LEFT the header. Every one must still resolve.
  const DEMOTED = [
    "/chemistry", "/biology", "/physics",
    "/calendar", "/tuition", "/tuition/one-to-one", "/tuition/interest", "/intensive",
  ];
  for (const p of DEMOTED) {
    t(`§58 — ${p} still exists after leaving the header`, hasRoute(p));
  }

  // And everything else the brief lists as untouchable.
  const UNTOUCHED = [
    "/", "/resources", "/past-papers", "/learn", "/login", "/signup", "/profile",
  ];
  for (const p of UNTOUCHED) {
    t(`§58 — ${p} still exists`, hasRoute(p));
  }

  // ⚠ NO URL MOVED, SO NO REDIRECT WAS OWED (§31, §52). The label changed —
  // "Live Tuition" became "Online Tuition" — while /tuition stayed /tuition,
  // which is exactly what §51 asks for: no route churn for a rename.
  t("⚠ §51 — the tuition route is unchanged; only its LABEL moved",
    NAV.includes('href: "/tuition"') && NAV.includes('labelKey: "onlineTuition"')
      && EN.nav.onlineTuition === "Online Tuition");
  t("§51 — /calendar is unchanged", hasRoute("/calendar") && NAV.includes('"/calendar"'));
}

// ============================================================================
console.log("\n=== 2. the header is four products, and only four ===");
// ============================================================================
{
  const block = NAV.slice(NAV.indexOf("const NAV_LINKS"), NAV.indexOf("const SUBJECT_LINKS"));
  /**
   * ⚠ THE LABEL IS A CATALOGUE KEY NOW, RESOLVED THROUGH messages/en.json.
   * i18n phase 1 replaced the literal in NAV_LINKS with labelKey, so the nav
   * can be translated without editing the data structure. The assertion reads
   * the same words it always did — it just follows the key to get them, which
   * also means a key with no English string fails here rather than rendering
   * the key itself on the page.
   */
  const labels = [...block.matchAll(/labelKey:\s*"([^"]+)"/g)]
    .map((m) => (EN.nav as Record<string, string>)[m[1]] ?? `MISSING:${m[1]}`);

  t("exactly four primary destinations", labels.length === 4, labels.join(" | "));
  t("in the order Resources → Past Papers → Exam Builder → Online Tuition",
    labels.join("|") === "Resources|Past Papers|Exam Builder|Online Tuition", labels.join("|"));

  // ⚠ THE FIVE THAT LEFT MUST NOT BE BACK. This is the clutter the whole
  // brief exists to remove, and it creeps back one "just this one" at a time.
  for (const gone of ["Chemistry", "Biology", "Physics", "Calendar", "Live Tuition"]) {
    t(`§2/§12/§36 — "${gone}" is not a primary header item`, !labels.includes(gone));
  }

  // Subjects are still one tap away on mobile, and in the footer (§19, §53).
  t("§19 — subjects survive as a secondary mobile group", NAV.includes("SUBJECT_LINKS"));
  for (const s of ["/chemistry", "/biology", "/physics"]) {
    t(`§53 — ${s} is still linked from the footer`, FOOTER.includes(`"${s}"`));
  }
  t("§33 — Calendar moved into the footer's Online Tuition group",
    FOOTER.includes('heading: "Online Tuition"') && FOOTER.includes('"/calendar"'));
}

// ============================================================================
console.log("\n=== 3. ⚠ §34 — active state follows the product, not the URL ===");
// ============================================================================
{
  /**
   * The rule this suite exists for: a student inside Calendar is inside Online
   * Tuition. Re-implementing the predicate here would test my own copy, so the
   * ACTIVE PREFIXES are read out of the nav source and checked against it.
   */
  const block = NAV.slice(NAV.indexOf("const NAV_LINKS"), NAV.indexOf("const SUBJECT_LINKS"));
  const entries = [...block.matchAll(/labelKey:\s*"([^"]+)"[\s\S]*?activePrefixes:\s*\[([^\]]*)\]/g)]
    .map((m) => ({
      label: (EN.nav as Record<string, string>)[m[1]] ?? `MISSING:${m[1]}`,
      prefixes: [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    }));

  const isActive = (pathname: string, prefixes: string[]) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const CASES: [string, string][] = [
    ["/calendar", "Online Tuition"],          // ⚠ the one §6 names explicitly
    ["/tuition", "Online Tuition"],
    ["/tuition/one-to-one", "Online Tuition"],
    ["/intensive", "Online Tuition"],
    ["/resources", "Resources"],
    ["/resources/chemistry/edexcel-ial-as-chemistry", "Resources"],
    ["/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/definitions-formulae-and-the-mole", "Resources"],
    ["/past-papers", "Past Papers"],
    ["/exam-builder", "Exam Builder"],
  ];
  for (const [path, expected] of CASES) {
    const lit = entries.filter((e) => isActive(path, e.prefixes)).map((e) => e.label);
    t(`§34 — ${path} lights "${expected}"`,
      lit.length === 1 && lit[0] === expected, `lit: ${lit.join(", ") || "nothing"}`);
  }

  // A subject page belongs to no single product — subjects are cross-cutting
  // (§28), so lighting one of the four would be a false claim about where the
  // student is.
  for (const p of ["/chemistry", "/biology", "/physics", "/"]) {
    const lit = entries.filter((e) => isActive(p, e.prefixes)).map((e) => e.label);
    t(`§28 — ${p} lights no product tab`, lit.length === 0, lit.join(", "));
  }

  t("§42 — active state is announced, not only drawn", NAV.includes("aria-current"));
}

// ============================================================================
console.log("\n=== 4. ⚠ §2 — Exam Builder is honest about being unbuilt ===");
// ============================================================================
{
  const page = "src/app/exam-builder/page.tsx";
  t("the route exists, so the nav slot leads somewhere real", existsSync(page));
  /**
   * ⚠ COMMENTS STRIPPED — THE SECOND TIME THIS EXACT TRAP HAS BEEN SPRUNG.
   * The Resources §40 guard failed the same way: a page whose header documents
   * "no Build my exam button" trips a check searching for that phrase. A guard
   * that cannot tell code from prose pressures the next person to delete the
   * documentation to go green, which is the opposite of what it is for.
   */
  const src = readFileSync(page, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  t("⚠ it says plainly that it is not built yet", /not built yet/i.test(src));
  t("§24 — it is a full primary nav item, not hidden in a dropdown",
    NAV.includes('labelKey: "examBuilder"') && EN.nav.examBuilder === "Exam Builder");
  t("…carrying an honest marker so the click is informed", NAV.includes('marker: "Soon"'));

  // ⚠ NO FAKE PRODUCT. The rejected design was selectors and a Build button
  // that did nothing; these assertions are what stop it coming back.
  t("⚠ no non-functional \"Build my exam\" control", !/Build my exam/i.test(src));
  t("⚠ no fake selectors", !/<select|<input/i.test(src));
  t("it offers alternatives that genuinely work today",
    src.includes("/past-papers") && src.includes("/resources"));
}

// ============================================================================
console.log("\n=== 5. §18 — Start free is for people without an account ===");
// ============================================================================
{
  t("a Start free CTA exists", NAV.includes("Start free"));
  // It must sit in the signed-OUT branch, beside Login — never rendered to a
  // student who already signed up.
  const signedOut = NAV.slice(NAV.indexOf('href="/login"'));
  t("⚠ §18 — it renders only alongside Login, never for a signed-in user",
    signedOut.includes("Start free") && !NAV.slice(NAV.indexOf("session ? ("), NAV.indexOf('href="/login"')).includes("Start free"));
  t("§16 — a search control points at the search that exists", NAV.includes("SearchIcon"));
}

// ============================================================================
console.log("\n=== 6. ⚠ §30 — tuition availability is derived, not declared ===");
// ============================================================================
{
  /**
   * ⚠ THE EXPECTED ANSWERS ARE DERIVED FROM catalogue.ts, NOT TYPED HERE.
   * AGENTS.md is explicit about why: a hand-written model of production data
   * ("Chemistry: 3 cohorts, register interest") is true the day it is written
   * and pins that day's behaviour forever after. So the cohort facts are read
   * out of the catalogue source and the same rule is applied to them.
   */
  const CAT = readFileSync("src/lib/public/catalogue.ts", "utf8");
  const cohortBlock = CAT.slice(CAT.indexOf("const COHORTS"), CAT.indexOf("// SUBJECTS"));
  const facts = [...cohortBlock.matchAll(/subject:\s*"([^"]+)"[\s\S]*?status:\s*"([^"]+)"[\s\S]*?enrolmentUrl:\s*(null|"[^"]*")/g)]
    .map((m) => ({ subject: m[1], status: m[2], enrolmentUrl: m[3] === "null" ? null : m[3].slice(1, -1) }));

  t("the catalogue's cohorts were readable at all", facts.length > 0, `${facts.length} cohorts`);

  // ⚠ A COHORT WITH NO PAYMENT LINK IS NOT ENROLMENT. This is the rule the
  // page depends on, so it is asserted on its own rather than inferred from
  // whatever the catalogue happens to hold today.
  t("⚠ §30 — status \"enrolling\" with a null link is NOT enrolment",
    availabilityFor("x", [{ subject: "x", status: "enrolling", enrolmentUrl: null }]).state === "interest");
  t("§30 — status \"enrolling\" WITH a link is enrolment",
    availabilityFor("x", [{ subject: "x", status: "enrolling", enrolmentUrl: "https://pay" }]).state === "enrolling");
  t("§30 — a subject with no cohort reads \"Not running yet\"",
    availabilityLabel(availabilityFor("x", [])) === "Not running yet");

  // And the live catalogue must agree with what the page will render.
  for (const subj of ["chemistry", "biology", "physics"]) {
    const a = availabilityFor(subj, facts);
    const listed = facts.filter((f) => f.subject === subj).length;
    t(`§30 — ${subj}: ${a.cohorts} cohort(s) → "${availabilityLabel(a)}"`, a.cohorts === listed);
  }

  // ⚠ NO SUBJECT MAY CLAIM ENROLMENT WHILE NO COHORT CAN BE PAID FOR. If a
  // payment link lands, this flips on its own — that is the point.
  const anyPayable = facts.some((f) => f.status === "enrolling" && f.enrolmentUrl);
  const claims = ["chemistry", "biology", "physics"].filter((s) => availabilityFor(s, facts).state === "enrolling");
  t("⚠ §30 — enrolment is claimed only where a cohort can actually be joined",
    anyPayable === claims.length > 0, `payable: ${anyPayable}, claiming: ${claims.join(",") || "none"}`);

  const TUI = readFileSync("src/app/[locale]/tuition/page.tsx", "utf8");
  t("§30 — the page asks the derivation rather than hard-coding a status",
    TUI.includes("availabilityFor(slug, cohorts)") && !/Enrolment open</.test(TUI));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
