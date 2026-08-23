/**
 * The homepage funnel: what it may claim, and what it was forbidden to break.
 *
 * ============================================================================
 * ⚠ THE ONE HARD RULE IS THAT NO TUITION WORD IS TYPED
 * ============================================================================
 * The brief asked for "Book tuition", "Book 1-to-1" and "reserve your place".
 * None of the three is true today: CHECKOUT_BUILT is false, Stripe holds no
 * keys, every cohort is `interest` with a null enrolmentUrl, and nothing in
 * src/ inserts a booking. A hardcoded "Book" would have been a dead CTA on the
 * most-visited page — and the hero would have contradicted the calendar
 * component directly beneath it, which already states that it takes none.
 *
 * So every label is derived, and this file's job is to prove that adding a
 * payment link flips the copy with no code change. That is the same proof the
 * nav build's §30 required, moved to the surface where the wording is loudest.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  availabilityFor, groupOffer, oneToOneOffer, heroTuitionOffer,
} from "../../../src/lib/tuition/availability.ts";
import { CTA_SOURCES } from "../../../src/lib/analytics/events.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
const HOME = readFileSync("src/app/page.tsx", "utf8");
const HERO_CAL = readFileSync("src/components/calendar/HeroCalendar.tsx", "utf8");
const STICKY = readFileSync("src/components/home/StickyCta.tsx", "utf8");
const AVAIL = readFileSync("src/lib/tuition/availability.ts", "utf8");

/** Comments are prose, not code — see resources-hub.test.ts. */
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
  if (p === "/") return existsSync(join(APP, "page.tsx"));
  const want = p.split("/").filter(Boolean);
  return ROUTES.some((r) => r.length === want.length && r.every((s, i) => s.startsWith("[") || s === want[i]));
};

// ============================================================================
console.log("\n=== 1. ⚠ §2 — booking language is DERIVED, never typed ===");
// ============================================================================
{
  const NO_LINK = [{ subject: "chemistry", status: "interest", enrolmentUrl: null }];
  const PAYABLE = [{ subject: "chemistry", status: "enrolling", enrolmentUrl: "https://pay" }];

  // ── group ──
  t("⚠ §2 — with no payment link, the group CTA does NOT say Book",
    !/^Book/.test(groupOffer(NO_LINK).label), groupOffer(NO_LINK).label);
  t("⚠ §2 — add a payment link and it says Book, with no code change",
    groupOffer(PAYABLE).label === "Book group tuition", groupOffer(PAYABLE).label);
  t("§2 — a cohort marked enrolling with a NULL link is still not bookable",
    groupOffer([{ subject: "chemistry", status: "enrolling", enrolmentUrl: null }]).bookable === false);

  // ── 1-to-1: two independent routes to a real booking ──
  const shut = { checkoutBuilt: false, stripeConfigured: false, sellableTimes: 0, viewerCanRedeem: false };
  t("⚠ §2 — 1-to-1 does not say Book while checkout is unbuilt",
    oneToOneOffer(shut).label === "See 1-to-1 availability", oneToOneOffer(shut).label);
  t("§2 — checkout alone is not enough without a sellable time",
    oneToOneOffer({ ...shut, checkoutBuilt: true, stripeConfigured: true }).bookable === false);
  t("§2 — checkout + Stripe + a time makes it bookable",
    oneToOneOffer({ checkoutBuilt: true, stripeConfigured: true, sellableTimes: 3, viewerCanRedeem: false }).label === "Book 1-to-1");
  // ⚠ THE CUSTOMER WHO ALREADY PAID. canRedeem never consults Stripe, so a
  // student holding a credit really can book — telling them booking is shut is
  // the same falsehood as "Book" to everyone else, pointed the other way.
  t("⚠ §2 — a student holding a credit CAN book, with no Stripe at all",
    oneToOneOffer({ ...shut, viewerCanRedeem: true }).label === "Book 1-to-1");

  // ── the hero's combined offer ──
  const g0 = groupOffer(NO_LINK), o0 = oneToOneOffer(shut);
  t("⚠ §2 — the hero secondary CTA does not say Book today",
    heroTuitionOffer(g0, o0).label === "See tuition times", heroTuitionOffer(g0, o0).label);
  t("§2 — it flips the moment EITHER path becomes bookable",
    heroTuitionOffer(groupOffer(PAYABLE), o0).label === "Book tuition"
      && heroTuitionOffer(g0, oneToOneOffer({ ...shut, viewerCanRedeem: true })).label === "Book tuition");

  // ⚠ AND THE PAGE MUST ACTUALLY USE THEM. Deriving a label and then typing a
  // different one beside it is the failure this whole section exists to stop.
  const c = code(HOME);
  t("⚠ §2 — the page renders the derived labels, not literals",
    c.includes("{tuition.label}") && c.includes("{oneToOne.label}") && c.includes("{group.label}"));
  for (const banned of [">Book tuition", ">Book 1-to-1", "reserve your place", "Join live tuition"]) {
    t(`⚠ §2 — "${banned}" is not hardcoded anywhere on the homepage`,
      !c.includes(banned), c.includes(banned) ? banned : undefined);
  }
  t("§2 — the offer functions live beside availabilityFor, not in the page",
    AVAIL.includes("export function groupOffer") && !code(HOME).includes("function groupOffer"));
}

// ============================================================================
console.log("\n=== 2. ⚠ §25/§26 — no fake urgency, no invented capacity ===");
// ============================================================================
{
  const c = code(HOME) + code(HERO_CAL);
  const BANNED = [
    /countdown/i, /people (are )?viewing/i, /last chance/i, /hurry/i,
    /only \d+ (seats?|places?) left/i, /limited offer/i, /selling fast/i,
  ];
  for (const re of BANNED) {
    t(`⚠ §25 — no ${re.source}`, !re.test(c), c.match(re)?.[0]);
  }
  // §26 — capacity may render ONLY from a real seats-taken figure. Neither
  // surface computes one, so neither may print a places-remaining line.
  t("⚠ §26 — the homepage prints no places-remaining figure it cannot count",
    !/places? remaining|\d+\s*\/\s*\d+\s*places/i.test(c));
}

// ============================================================================
console.log("\n=== 3. ⚠ §29 — trust claims are true today ===");
// ============================================================================
{
  const c = code(HOME);
  // The forbidden list, verbatim from §29.
  for (const re of [/\d[\d,]*\+? students/i, /pass rate/i, /grade improvement/i,
                    /\d+% of (our )?students/i, /testimonial/i]) {
    t(`⚠ §29 — no ${re.source}`, !re.test(c), c.match(re)?.[0]);
  }
  t("§29 — the trust strip exists", HOME.includes('aria-label="What Ailemy is"'));
  for (const claim of ["Specification-mapped", "Mark-scheme-informed", "Progress tracked"]) {
    t(`§29 — "${claim}" is claimed, and is checkable`, HOME.includes(claim));
  }
}

// ============================================================================
console.log("\n=== 4. ⚠ §23 — no teacher tools are implied ===");
// ============================================================================
{
  const c = code(HOME);
  t("§23 — the teacher pathway exists", c.includes("audience_teacher_clicked"));
  // ⚠ NONE OF THESE EXIST IN THE CODEBASE. A teacher card offering any of them
  // would be a promise nothing can keep.
  for (const re of [/teacher dashboard/i, /class list/i, /assign(ment)?s to (your )?class/i,
                    /teacher analytics/i, /Explore teacher tools/i]) {
    t(`⚠ §23 — no ${re.source}`, !re.test(c), c.match(re)?.[0]);
  }
  t("⚠ §23 — it says plainly that teacher tools are not built",
    /Teacher tools are not built yet/.test(HOME));
}

// ============================================================================
console.log("\n=== 5. ⚠ §14 — one calendar system, not two ===");
// ============================================================================
{
  t("§14 — the hero renders the shared HeroCalendarCard", HOME.includes("<HeroCalendarCard"));
  t("§14 — fed by the same loader the other surfaces use", HOME.includes("loadCalendarEvents"));
  // ⚠ THE TUITION HEADING WENT IN THE PAGE, NOT IN THE COMPONENT. Editing the
  // shared calendar for one caller is how a second calendar starts.
  t("⚠ §14 — the hero's tuition framing lives in the page, not the component",
    HOME.includes("Learn live with an expert") && !HERO_CAL.includes("Learn live with an expert"));
  t("§14 — no second calendar component was created",
    !existsSync("src/components/home/HomeCalendar.tsx")
      && !existsSync("src/components/home/HeroTimetable.tsx"));
  t("§14 — timezone logic is not reimplemented on the homepage",
    !/Intl\.DateTimeFormat\(/.test(code(HOME)));
}

// ============================================================================
console.log("\n=== 6. ⚠ §35/§36 — CTA overload ===");
// ============================================================================
{
  /**
   * ⚠ THE TEST IS WHAT IS VISIBLE AT ONCE, NOT WHAT EXISTS ON THE PAGE.
   * §35 forbids "Start free" in the header, hero, floating bar and calendar
   * simultaneously. The floating bar already solves this by revealing on
   * scroll — so what matters is that it STILL does, and that nothing was added
   * that ignores it.
   */
  t("§36 — the floating CTA reveals on scroll rather than on load",
    /revealAfter\s*=\s*\d+/.test(STICKY) && /scrollY > revealAfter/.test(STICKY));
  t("§36 — and it is contextual, not one fixed label",
    /inTuition/.test(STICKY));
  const heroBlock = HOME.slice(HOME.indexOf("<header className"), HOME.indexOf("</header>"));
  t("⚠ §35 — the hero does not add a second 'Start free' beside the header's",
    !/Start free/.test(heroBlock), heroBlock.match(/Start free/)?.[0]);
  t("§35 — the hero's own primary CTA is a single control",
    (heroBlock.match(/data-cta="hero_start_free_clicked"/g) ?? []).length === 1);
}

// ============================================================================
console.log("\n=== 7. ⚠ §52 — nothing that worked was broken ===");
// ============================================================================
{
  const PRESERVED = [
    "/", "/resources", "/resources/[subject]", "/resources/[subject]/[course]",
    "/past-papers", "/exam-builder", "/tuition", "/tuition/one-to-one",
    "/tuition/interest", "/calendar", "/intensive",
    "/chemistry", "/biology", "/physics",
    "/login", "/signup", "/profile",
    "/learn/[subject]", "/learn/[subject]/[pathway]/[course]",
    "/learn/[subject]/[pathway]/[course]/papers/[paper]/practice",
  ];
  for (const p of PRESERVED) t(`§52 — ${p} still resolves`, hasRoute(p));

  t("§52 — the marking demo is still on the page", HOME.includes("TrySample") || /Try it\./.test(HOME));
  t("§52 — the subject cards survive", HOME.includes('id="subjects"'));
  t("§52 — the FAQ survives", HOME.includes("<HomeFaq"));
  t("§52 — the floating CTA survives", HOME.includes("<StickyCta"));
  t("§52 — the expanded calendar overlay survives", HOME.includes("<HeroCalendarOverlay"));
  // §7 of the header — no URL moved, so nothing was owed a redirect.
  t("§52 — the homepage introduces no new route of its own",
    !/redirect\(|permanentRedirect/.test(code(HOME)));
}

// ============================================================================
console.log("\n=== 8. §45 — every new control reports ===");
// ============================================================================
{
  const REQUIRED = [
    "hero_start_free_clicked", "hero_book_tuition_clicked", "hero_calendar_clicked",
    "hero_book_one_to_one_clicked", "hero_group_tuition_clicked",
    "pillar_resources_clicked", "pillar_past_papers_clicked",
    "pillar_exam_builder_clicked", "pillar_online_tuition_clicked",
    "audience_student_clicked", "audience_parent_clicked", "audience_teacher_clicked",
  ];
  for (const v of REQUIRED) {
    t(`§45 — ${v} is a declared CtaSource`, (CTA_SOURCES as readonly string[]).includes(v));
  }
  // ⚠ DECLARED IS NOT EMITTED. cta-integrity checks the reverse direction; this
  // checks the page actually carries each one.
  const all = HOME + HERO_CAL;
  for (const v of REQUIRED) {
    t(`§45 — ${v} appears on a real control`, all.includes(`"${v}"`));
  }
  t("§45 — no PII rides along", !/email|studentName|user_id/.test(
    HOME.slice(HOME.indexOf('data-cta="hero_start_free_clicked"') - 400,
               HOME.indexOf('data-cta="hero_start_free_clicked"') + 400)));
}

// ============================================================================
console.log("\n=== 9. §2/§16 — hierarchy and spacing ===");
// ============================================================================
{
  // §2 — the hero moved up. pt-16/sm:pt-24 → pt-10/sm:pt-16 is 24px and 32px,
  // both inside the brief's 20–35px range.
  // pt-16/sm:pt-24 → pt-10/sm:pt-16 is 24px and 32px off the top, both inside
  // the brief's 20–35px range. The bottom came in for §44 — see the page.
  t("⚠ §2 — the hero's top padding was reduced",
    /pt-10 pb-10 sm:pt-16 sm:pb-12/.test(HOME),
    HOME.match(/max-w-6xl px-6 pt-\d+ pb-\d+ sm:pt-\d+ sm:pb-\d+/)?.[0]);
  t("⚠ §12 — the hero columns are top-aligned, not centred",
    /lg:items-start/.test(HOME) && !/lg:items-center/.test(HOME));
  t("§3 — the headline is unchanged", /Learn it\. Practise it\./.test(HOME));

  // §16 — the product strip comes before the subject cards.
  const products = HOME.indexOf('id="products"');
  const subjects = HOME.indexOf('id="subjects"');
  const heroEnd = HOME.indexOf("</header>");
  t("⚠ §16 — the four pillars sit directly below the hero",
    heroEnd < products && products < subjects, `hero@${heroEnd} products@${products} subjects@${subjects}`);
  t("§17 — the pillars carry no subject colour",
    !/subject-accent/.test(HOME.slice(products, subjects)));
  t("§16 — Exam Builder does not promise a verb it cannot perform",
    !/Build an Exam/.test(code(HOME)));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
