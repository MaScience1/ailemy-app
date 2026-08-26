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


/**
 * ⚠ THE CLAIMS MOVED INTO THE CATALOGUE, SO THE GUARD FOLLOWS THEM THERE.
 * §29's three claims and §23's disclaimer used to be greppable sentences in
 * the JSX. After the Arabic conversion they are catalogue entries and the page
 * holds keys — so a plain HOME.includes() would have gone green-by-absence,
 * which is how a guard dies without anyone noticing. Each check below now
 * requires BOTH that the page references the key AND that the English still
 * makes the claim. A claim removed from the catalogue now fails here, which
 * the old string match could not do either.
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
const HOME = readFileSync("src/app/[locale]/page.tsx", "utf8");
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
/**
 * ⚠ [locale] IS TRANSPARENT FOR THE DEFAULT LOCALE. i18n phase 1 moved the
 * homepage and /tuition under app/[locale]/; with localePrefix "as-needed"
 * English carries no prefix, so those files still serve /  and /tuition. A
 * resolver that counted [locale] as a segment would call every one of them
 * missing and make a working move look like a breakage.
 */
const ROUTES = routes(APP).map((r) => (r[0] === "[locale]" ? r.slice(1) : r));
const hasRoute = (p: string) => {
  if (p === "/") return existsSync(join(APP, "[locale]", "page.tsx"));
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
  /**
   * ⚠ THIS PINNED THE EXACT WORDS "Book group tuition", AND THAT WAS THE TRAP.
   * The rule is that the label becomes an ACTION when a payment link lands —
   * not that it says one particular phrase. §11 asked for "Reserve your place"
   * and the assertion went red on a correct change, exactly as the discount
   * test did when it restated 0.10 and 0.20. So it checks the property.
   */
  const payableLabel = groupOffer(PAYABLE).label;
  const unpayableLabel = groupOffer(NO_LINK).label;
  t("⚠ §2 — a payment link changes the label, with no code change",
    payableLabel !== unpayableLabel, `${unpayableLabel} → ${payableLabel}`);
  t("⚠ §2 — and changes it from browsing to acting",
    /^(Book|Reserve|Enrol)/.test(payableLabel) && /^(See|View|Register)/.test(unpayableLabel),
    `${unpayableLabel} → ${payableLabel}`);
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
  /**
   * ⚠ THE LABELS MOVED INTO A COMPONENT, AND THIS GUARD HAD TO FOLLOW THEM.
   * It checked page.tsx alone; the hero's tuition CTAs now render inside
   * HeroAvailability, so it went red on correct code. The RULE is that no
   * tuition word is typed anywhere in the hero — so the scan covers the hero's
   * components, not one file that happened to hold them first.
   */
  // ⚠ NOT `AVAIL` — that name already holds availability.ts three lines up,
  // and shadowing it broke the very next assertion.
  const HERO_AVAIL = readFileSync("src/components/home/HeroAvailability.tsx", "utf8");
  const c = code(HOME) + code(HERO_AVAIL);
  t("⚠ §2 — the hero renders the derived labels, not literals",
    c.includes("{tuition.label}") && c.includes("{oneToOne.label}") && c.includes("{group.label}"));
  t("⚠ §2 — and the availability card takes its offers as props",
    /group: TuitionOffer;/.test(HERO_AVAIL) && /oneToOne: TuitionOffer;/.test(HERO_AVAIL));
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
  t("§29 — the trust strip exists",
    HOME.includes('aria-label={t("home.trustStripLabel")}')
      && msg("home.trustStripLabel") === "What Ailemy is",
    msg("home.trustStripLabel"));
  const TRUST_CLAIMS: Record<string, string> = {
    "Specification-mapped": "home.trustSpecificationMapped",
    "Mark-scheme-informed": "home.trustMarkSchemeInformed",
    "Progress tracked": "home.trustProgressTracked",
  };
  for (const [claim, key] of Object.entries(TRUST_CLAIMS)) {
    t(`§29 — "${claim}" is claimed, and is checkable`,
      HOME.includes(`t("${key}")`) && msg(key) === claim, `${key} = ${msg(key)}`);
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
    HOME.includes('t("home.audienceTeacherBody")')
      && /Teacher tools are not built yet/.test(msg("home.audienceTeacherBody")),
    msg("home.audienceTeacherBody"));
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

  t("§52 — the marking demo is still on the page",
    HOME.includes("TrySample") || /Try it\./.test(msg("home.tryTitle")),
    msg("home.tryTitle"));
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
  // ⚠ THE HERO'S CONTROLS LIVE IN HeroAvailability NOW — see above.
  const all = HOME + HERO_CAL + readFileSync("src/components/home/HeroAvailability.tsx", "utf8");
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
  /**
   * ⚠ §2 — THE PROPERTY, NOT THE LITERAL. This pinned `pt-10 pb-10` exactly,
   * so any further tightening of the hero failed it — which is what happened
   * when the mobile pass cut phone padding to fit the fold. The section's own
   * name is "the top padding was REDUCED", so the check is now a bound: the
   * phone value must be at or below the original 10, and the desktop values
   * must be untouched, because "desktop must not regress" is the standing rule
   * on every one of these mobile passes.
   */
  const heroPad = HOME.match(/max-w-6xl px-6 pt-(\d+) pb-(\d+) sm:pt-(\d+) sm:pb-(\d+)/);
  t("⚠ §2 — the hero's top padding is reduced at phone width",
    !!heroPad && Number(heroPad[1]) <= 10 && Number(heroPad[2]) <= 10,
    heroPad?.[0] ?? "hero padding classes not found");
  t("⚠ §2 — and desktop padding is unchanged",
    !!heroPad && heroPad[3] === "16" && heroPad[4] === "12",
    heroPad?.[0] ?? "not found");
  /**
   * ⚠ §12 INVERTED WITH THE §5 REORDER. This required lg:items-start, because
   * the hero was two columns and the invariant was "neither column hangs below
   * the other". The calendar column has been moved out to the detailed tuition
   * section, so the hero is a single column and there is nothing left to align
   * against anything. What replaces it is the reason the alignment mattered:
   * the headline must still start at the top of the hero, with no empty corner
   * above it. Kept as an assertion rather than deleted — see home-calendar for
   * the calendar's own new positional coverage.
   */
  t("⚠ §12 — the hero is a single column, so no column alignment is declared",
    !/lg:grid-cols-\[minmax\(0,1fr\)_480px\]/.test(HOME));
  /**
   * ⚠ §3 — THE HEADLINE IS UNCHANGED, AND IT IS NOW TWO CATALOGUE ENTRIES.
   * The <br> split it across two text nodes, so the conversion keyed each half
   * separately. The guard checks the page still renders both halves in order
   * AND that the English still reads exactly as it did — the wording is what
   * §3 protects, and moving it into a catalogue must not be a way to change it.
   */
  /**
   * ⚠ §3 — THE HEADLINE IS THE ONE THE FOUNDER RULED, AND IT IS ONE STRING NOW.
   * It was two catalogue entries split by a <br>; the mobile-hero pass replaced
   * both with a single line, so this pins the new wording rather than the old.
   * The guard's job is that the headline never changes BY ACCIDENT — so it
   * still fails on any edit that was not a deliberate ruling, which is exactly
   * how it caught this one.
   */
  t("§3 — the headline is the ruled wording",
    HOME.includes('{t("home.heroHeadline")}')
      && msg("home.heroHeadline") === "Learn. Revise. Practise. Get marked. Master your exams.",
    msg("home.heroHeadline"));

  /**
   * ⚠ AND THE OLD TWO-LINE KEYS ARE GONE FROM THE PAGE. Leaving them wired
   * would render both headlines, which no visual check at 375 would miss but a
   * string test easily could.
   */
  t("§3 — the superseded two-line headline is no longer rendered",
    !HOME.includes("heroHeadlineLine1") && !HOME.includes("heroHeadlineLine2"));

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

// ============================================================================
console.log("\n=== 10. ⚠ the capabilities were RELOCATED, not duplicated ===");
// ============================================================================
{
  const PANEL = readFileSync("src/components/home/ExplorePanel.tsx", "utf8");
  const STRIP = readFileSync("src/components/home/CapabilityStrip.tsx", "utf8");
  const p = code(PANEL);

  /**
   * ⚠ §3 — NOT ONE HREF IS RETYPED. capabilitiesFor() is the single source,
   * and it matters concretely: "Progress tracking" resolves to /profile for a
   * student and /login?next=/profile for a stranger. A hand-copied list would
   * lose that distinction or drift from it, and route-integrity would not
   * notice because both strings are valid routes.
   */
  t("⚠ §3 — the panel imports the existing capability list",
    /import \{ capabilitiesFor \} from "\.\/CapabilityStrip"/.test(PANEL));
  t("⚠ §3 — and hardcodes no route of its own",
    !/href=["']\/[a-z]/.test(p) && !/["']\/(learn|resources|past-papers|tuition|profile|login)["']/.test(p),
    p.match(/["']\/(learn|resources|past-papers|tuition|profile|login)["']/)?.[0]);
  t("§3 — the href comes off the item", /href=\{c\.href\}/.test(PANEL));
  t("§3 — the source still exports the seven", /export function capabilitiesFor/.test(STRIP));

  // ⚠ §2 OF THE HEADER — THE DESCRIPTIONS LIVE ON THE CAPABILITY, so a
  // reworded label cannot silently orphan its blurb.
  t("⚠ descriptions are a field, not a map keyed by label",
    /blurb: string/.test(STRIP) && !/Record<string, string>/.test(p));

  // §13 — one presentation, not two.
  t("⚠ §13 — the old band is gone from the page",
    !/What you can do on Ailemy/.test(HOME));
  /**
   * ⚠ THIS WAS GREEN-BY-ABSENCE AND HAD BEEN FOR SOME TIME. It read
   * HOME.includes("Four ways to use Ailemy") against the RAW file. The i18n
   * conversion moved that string to the catalogue, so the only copy left in
   * page.tsx was inside an explanatory COMMENT — and the assertion went on
   * passing by matching its own prose. The section title was then changed to
   * "Explore Ailemy" and this did not notice.
   *
   * Fixed the way this repo already fixes it elsewhere: check the page
   * references the KEY, with comments stripped, AND that the catalogue carries
   * a value for it. Both halves are needed — the key alone passes when the
   * catalogue entry is deleted, the value alone passes when nothing renders it.
   */
  t("⚠ §13 — the four product pillars are still a section, keyed not literal",
    code(HOME).includes('id="products"')
    && code(HOME).includes('t("home.productsTitle")'),
    code(HOME).includes('id="products"') ? "productsTitle key not referenced" : "no id=products");
  t("⚠ §13 — …and the catalogue actually carries that title",
    msg("home.productsTitle").length > 0, JSON.stringify(msg("home.productsTitle")));
  t("§13 — the strip component is retained, not deleted",
    existsSync("src/components/home/CapabilityStrip.tsx"));

  // §9 — a reserved slot, so nothing moves.
  t("⚠ §9 — the description area reserves a fixed height", /min-h-\[3rem\]/.test(PANEL));
  t("⚠ §17 — it answers focus, not only hover",
    /onFocus=/.test(PANEL) && /onBlur=/.test(PANEL) && /onMouseEnter=/.test(PANEL));
  t("§17 — and announces the change", /aria-live="polite"/.test(PANEL));
  t("§7 — the lift is guarded for reduced motion", /motion-safe:hover:-translate-y-px/.test(PANEL));
  t("§17 — every pill is a real link with a visible focus state",
    /<Link/.test(PANEL) && /focus-visible:outline\b/.test(PANEL));
  /**
   * ⚠ §14 HAS NOW INVERTED TWICE, AND THE RULE UNDERNEATH NEVER MOVED.
   * Originally: the panel must FOLLOW the calendar, because both were in the
   * hero and a phone read them in DOM order. Then the calendar left the hero,
   * so the panel necessarily preceded it. Now the panel has left the hero too,
   * and sits between the compact tuition block and the four product pillars.
   *
   * Through all three the invariant is the same: a phone must meet the explore
   * panel EARLY — before the academic explanations — and adjacent to the
   * pillars, which are the same idea at more detail. What changed each time is
   * which neighbours express "early", so the assertion names them explicitly
   * rather than pinning one relative pair that keeps going stale.
   *
   * ⚠ ORDER IS ASSERTED AGAINST BOTH NEIGHBOURS, NOT ONE. "after the hero"
   * alone is satisfied by a panel at the bottom of the page.
   */
  /**
   * ⚠ §14 HAS INVERTED A THIRD TIME, AND THIS TIME THE PANEL IS GONE.
   * It required the panel to follow the calendar; then to precede it; then to
   * sit out of the hero between compact tuition and the pillars. §6 has now
   * removed the pill list outright — seven pills, six of whose destinations one
   * of the four cards already owned, plus hardcoded English labels that
   * rendered untranslated on /ar.
   *
   * The invariant that survives all four versions: ONE explore surface, met
   * early, and it is the card grid. So that is what is asserted — the pill
   * list is absent, and the grid holds the position the panel used to.
   *
   * ⚠ THE ABSENCE IS CHECKED ON STRIPPED SOURCE. The comment explaining the
   * removal names ExplorePanel, so a raw-file search would match the very
   * prose that documents it being gone — the same trap §13 above was caught in.
   */
  t("⚠ §6 — the seven-pill explore panel no longer renders on the homepage",
    !code(HOME).includes("<ExplorePanel"), "still rendered");
  const productsAt = code(HOME).indexOf('<Section id="products"');
  t("⚠ §14 — the explore card grid is out of the hero",
    productsAt > 0 && productsAt > code(HOME).indexOf("</header>"), productsAt);
  t("⚠ §14 — …after the compact tuition block, and BEFORE the marking demo",
    productsAt > code(HOME).indexOf('id="live-tuition-heading"')
    && productsAt < code(HOME).indexOf('id="try"'),
    `products ${productsAt}, tuition ${code(HOME).indexOf('id="live-tuition-heading"')}, try ${code(HOME).indexOf('id="try"')}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
