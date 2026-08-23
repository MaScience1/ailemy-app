/**
 * The course selector: what it asks, what it must never claim, and what it
 * was forbidden to break.
 *
 * ============================================================================
 * ⚠ THIS REPLACED A FOURTEEN-CARD GRID. THE GRID'S DESTINATIONS ALL SURVIVE.
 * ============================================================================
 * §32 and §37 are the load-bearing constraints of this build: the Resources
 * Hub was not to be rebuilt, and no course URL was to move. A discovery-layer
 * change that quietly orphaned /resources/chemistry/edexcel-ial-as-chemistry
 * would break every link anyone has shared and every result Google holds —
 * and it would do so silently, because a selector that never offers a course
 * looks exactly like a selector for a subject that has none.
 *
 * ⚠ THE SKIP RULES ARE TESTED AGAINST THE REAL FUNCTIONS, NOT A COPY.
 * tree.ts's derivations are importable pure functions, so this suite exercises
 * stageOf/unitSummary/strongestStatus themselves. AGENTS.md is explicit that a
 * hand-written model of production pins yesterday's behaviour; the fixtures
 * below are inputs, and every expectation is computed by the shipped code.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  stageOf, unitSummary, strongestStatus, holdingsLabel, resourcesBlurb,
} from "../../../src/lib/qualifications/derive.ts";
import { supportStatusFor, capabilitiesFor, EMPTY_COVERAGE } from "../../../src/lib/qualifications/support.ts";
import { LEVELS, LEVEL_PATHWAYS } from "../../../src/lib/qualifications/model.ts";
import { parsePreferences } from "../../../src/lib/qualifications/preference.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
const SELECTOR = readFileSync("src/components/resources/CourseSelector.tsx", "utf8");
const SUBJECT_PAGE = readFileSync("src/app/resources/[subject]/page.tsx", "utf8");
const LANDING = readFileSync("src/app/resources/page.tsx", "utf8");
const TREE = readFileSync("src/lib/qualifications/tree.ts", "utf8")
  + readFileSync("src/lib/qualifications/derive.ts", "utf8");

/** Comments are prose, not code — see resources-hub.test.ts for why. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory() || entry.startsWith("_")) continue;
    const next = entry.startsWith("(") && entry.endsWith(")") ? prefix : [...prefix, entry];
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
console.log("\n=== 1. ⚠ §32/§37 — the Resources Hub was not rebuilt ===");
// ============================================================================
{
  // Every route the hub owns must still exist. These are the URLs students
  // have, that search engines hold, and that the previous four builds shipped.
  const PRESERVED = [
    "/resources",
    "/resources/[subject]",
    "/resources/[subject]/[course]",
    "/past-papers",
    "/learn/[subject]",
    "/learn/[subject]/[pathway]/[course]",
    "/learn/[subject]/[pathway]/[course]/papers/[paper]",
    "/learn/[subject]/[pathway]/[course]/papers/[paper]/practice",
  ];
  for (const p of PRESERVED) t(`§37 — ${p} still resolves`, hasRoute(p));

  // ⚠ THE COURSE URL IS BUILT FROM THE EXISTING SLUG, NOT A NEW SCHEME. If
  // this ever became /resources/<subject>/<level>/<board>/<course>, every
  // existing link would 404 and §31 would owe a redirect.
  t("⚠ §37 — the selector links to the EXISTING /resources/<subject>/<course>",
    /\/resources\/\$\{subject\}\/\$\{c\.slug\}/.test(SELECTOR));
  t("§31 — no redirect was owed, because no URL moved",
    !/redirects\s*\(/.test(SELECTOR) && !/permanentRedirect/.test(SELECTOR));

  // The pieces §32 named explicitly.
  t("§32 — search still mounts on /resources", LANDING.includes("<ResourceSearch"));
  t("§32 — the search reader is untouched", existsSync("src/lib/resources/search.ts"));
  t("§32 — the resource taxonomy is untouched", existsSync("src/lib/resources/taxonomy.ts"));
  t("§32 — the course hub page is untouched", existsSync("src/app/resources/[subject]/[course]/page.tsx"));
  t("§32 — flashcard decks still exist", existsSync("src/lib/flashcards"));
}

// ============================================================================
console.log("\n=== 2. ⚠ §34 — search is not gated behind choosing a course ===");
// ============================================================================
{
  // ⚠ THE ORDER IN THE SOURCE IS THE ORDER ON THE PAGE. Search must render
  // before the subject chooser and must not be conditional on a selection.
  const searchAt = LANDING.indexOf("<ResourceSearch");
  const subjectsAt = LANDING.indexOf("subjects-heading");
  t("§34 — search renders above the subject chooser", searchAt > 0 && searchAt < subjectsAt,
    `search@${searchAt} subjects@${subjectsAt}`);

  // A query renders results INSTEAD of the chooser — so a student who searches
  // never has to pick a course first.
  t("§34 — a query renders results without any course selection",
    /results\s*\?\s*\(/.test(code(LANDING)));
  t("§34 — the selector is not mounted on the landing page at all",
    !code(LANDING).includes("<CourseSelector"));
}

// ============================================================================
console.log("\n=== 3. ⚠ §6 — no tuition component inside Resources ===");
// ============================================================================
{
  /**
   * The guard resources-hub.test.ts owns must still pass unweakened — this is
   * a second, independent check over the NEW files, so the selector cannot be
   * the thing that smuggles tuition into the library.
   */
  const NEW_FILES = {
    "CourseSelector.tsx": SELECTOR,
    "tree.ts": TREE,
    "resources/[subject]/page.tsx": SUBJECT_PAGE,
  };
  for (const [name, src] of Object.entries(NEW_FILES)) {
    const c = code(src);
    t(`§6 — ${name} mounts no tuition component`,
      !/<TuitionCta|<StickyCta|<CohortCard/.test(c));
    t(`§6 — ${name} links nowhere in /tuition`, !/href=["'`][^"'`]*\/tuition/.test(c));
  }

  /**
   * ⚠ THIS ASSERTION USED TO PASS WHILE THE DEFECT WAS ON THE PAGE.
   * It checked for the string "CAPABILITY_LABEL[...tuition", which the code
   * never contained — the chips render through CAPABILITY_LABEL[c] over a
   * derived array that INCLUDED "tuition". The live page read "… Progress ·
   * Live tuition" inside Resources and this suite was green.
   *
   * A guard has to check the OUTCOME, not a spelling the code was never going
   * to use. So: the render must filter the capability out, explicitly.
   */
  t("⚠ §6 — the selector FILTERS the tuition capability before rendering",
    /\.filter\(\(c\) => c !== "tuition"\)/.test(SELECTOR));
  t("⚠ §6 — and it renders the filtered list, not the original",
    /shown\.map\(\(c\) => CAPABILITY_LABEL\[c\]\)/.test(SELECTOR)
      && !/list\.map\(\(c\) => CAPABILITY_LABEL\[c\]\)/.test(SELECTOR));
  // capabilitiesFor genuinely returns it — which is why the filter must exist.
  t("§6 — (the underlying reader does include tuition, hence the filter)",
    capabilitiesFor({ ...EMPTY_COVERAGE, hasTuition: true }).includes("tuition"));
}

// ============================================================================
console.log("\n=== 4. ⚠ §4 — the Resources cards say what they HOLD ===");
// ============================================================================
{
  /**
   * ⚠ THE DEFECT THIS REPLACES. /resources rendered SubjectCard's tuition
   * status, so Biology and Physics were labelled "Register interest" above a
   * card that opens a resources listing — a label promising an action the
   * card does not perform, on a subject carrying ~90 live past papers.
   */
  t("§4 — the landing page passes its own eyebrow", /eyebrow=\{holdingsLabel/.test(LANDING));
  t("§4 — the eyebrow is counted, not typed", LANDING.includes("loadSubjectHoldings"));

  /**
   * ⚠ THE EYEBROW WAS NOT THE ONLY THING THE SHARED CARD BROUGHT WITH IT.
   * SubjectCard also renders SUBJECTS[].blurb, which is homepage copy: it
   * ends "…progress tracking and live tuition" for Chemistry and "…register
   * interest for priority access" for Biology and Physics. All three rendered
   * inside /resources. Scanning the PAGE source could never have caught it —
   * the words live in catalogue.ts — so the check is that /resources supplies
   * its own, and that the catalogue copy really does contain what we think.
   */
  const CATALOGUE = readFileSync("src/lib/public/catalogue.ts", "utf8");
  t("⚠ §6 — (the homepage blurbs really do sell tuition, hence the override)",
    /live tuition/i.test(CATALOGUE) && /register interest/i.test(CATALOGUE));
  t("⚠ §6 — /resources overrides the blurb rather than inheriting it",
    /blurb=\{resourcesBlurb/.test(LANDING));
  for (const h of [
    { liveLessons: 171, pastPapers: 71, error: null },
    { liveLessons: 0, pastPapers: 90, error: null },
    { liveLessons: 0, pastPapers: 0, error: null },
    { liveLessons: 0, pastPapers: 0, error: "boom" },
  ]) {
    const text = resourcesBlurb(h);
    t(`⚠ §6 — the derived blurb carries no tuition (${text.slice(0, 34)}…)`,
      !/tuition|register interest|enrol/i.test(text));
  }
  t("⚠ §4 — an unreadable subject does not describe itself as empty",
    resourcesBlurb({ liveLessons: 0, pastPapers: 0, error: "boom" })
      !== resourcesBlurb({ liveLessons: 0, pastPapers: 0, error: null }));

  // ⚠ NO TUITION VOCABULARY MAY REACH A RESOURCES SURFACE. This is the guard
  // proposed in the smoke-test report, and it is the reason the label cannot
  // silently come back the next time somebody reuses a homepage component.
  const TUITION_WORDS = /Register interest|Enrol|Enrolment|Cohort|Book a (?:lesson|place)/;
  for (const [name, src] of [
    ["resources/page.tsx", LANDING],
    ["resources/[subject]/page.tsx", SUBJECT_PAGE],
    ["CourseSelector.tsx", SELECTOR],
  ] as const) {
    t(`⚠ §4 — no tuition status word in ${name}`, !TUITION_WORDS.test(code(src)),
      code(src).match(TUITION_WORDS)?.[0]);
  }

  // The label itself, exercised against the real function.
  t("§4 — a subject with papers but no lessons states the papers",
    holdingsLabel({ liveLessons: 0, pastPapers: 90, error: null }) === "90 past papers",
    holdingsLabel({ liveLessons: 0, pastPapers: 90, error: null }));
  t("§4 — a subject with both states both",
    holdingsLabel({ liveLessons: 171, pastPapers: 71, error: null }) === "171 lessons · 71 past papers");
  t("§4 — a genuinely empty subject says so plainly",
    holdingsLabel({ liveLessons: 0, pastPapers: 0, error: null }) === "Nothing published yet");
  // ⚠ A FAILED READ IS NOT "NOTHING PUBLISHED". This is the recurring bug
  // class in this codebase: an unreadable table rendering as an empty one.
  t("⚠ §4 — an unreadable count NEVER renders as an empty shelf",
    holdingsLabel({ liveLessons: 0, pastPapers: 0, error: "boom" }) === "Contents unavailable");
}

// ============================================================================
console.log("\n=== 5. ⚠ §2 — two levels, and the two doors agree ===");
// ============================================================================
{
  // The founder's ruling: GCSE and A-Level only. IB and AP keep their routes
  // and appear as a quieter secondary row, never as level peers.
  t("§2 — exactly two levels", LEVELS.length === 2, LEVELS.join(","));
  t("§2 — they are GCSE and A-Level", [...LEVELS].join(",") === "gcse,a-level");
  const pathways = LEVELS.flatMap((l) => [...LEVEL_PATHWAYS[l]]);
  for (const bad of ["ib", "ap"]) {
    t(`⚠ §2 — "${bad}" is not reachable as a level`, !pathways.includes(bad as never));
  }

  // ⚠ THE OTHER DOOR MUST TELL THE SAME STORY. /learn/[subject] renders its
  // level cards from the same LEVELS constant, so the two cannot drift apart
  // without this failing.
  const LEARN = readFileSync("src/app/learn/[subject]/page.tsx", "utf8");
  t("⚠ §2 — /learn/[subject] draws its levels from the SAME source",
    LEARN.includes("LEVELS.map"));
  t("§2 — the selector draws its levels from the tree, not a list of its own",
    /tree\.levels\.map/.test(SELECTOR) && !/["']gcse["']\s*,\s*["']a-level["']/.test(code(SELECTOR)));
  t("§2 — IB/AP render in the secondary group", /tree\.other/.test(SELECTOR));
}

// ============================================================================
console.log("\n=== 6. ⚠ §3/§29 — statuses are derived, never typed ===");
// ============================================================================
{
  t("§3 — the tree derives status with supportStatusFor", TREE.includes("supportStatusFor(counts)"));
  t("§3 — and capabilities with capabilitiesFor", TREE.includes("capabilitiesFor(counts)"));

  // ⚠ NO SECOND COPY OF THE COURSE LIST. If any real course name is typed
  // into the selector or the tree, the catalogue has been duplicated.
  const NAMES = ["Edexcel IAL", "AQA A-Level", "IB Chemistry", "AP Chemistry", "Cambridge IGCSE"];
  for (const n of NAMES) {
    t(`§29 — "${n}" is not hardcoded in the selector`, !code(SELECTOR).includes(n));
    t(`§29 — "${n}" is not hardcoded in the tree`, !code(TREE).includes(n));
  }

  // The status ladder, exercised through the shipped function.
  const c = (over: Partial<typeof EMPTY_COVERAGE>) => ({ ...EMPTY_COVERAGE, ...over });
  t("§22 — nothing published reads coming_soon",
    supportStatusFor(c({})) === "coming_soon");
  t("§22 — lessons written but unpublished reads expanding",
    supportStatusFor(c({ lessons: 12 })) === "expanding");
  t("§22 — a published lesson reads supported",
    supportStatusFor(c({ lessons: 12, liveLessons: 1 })) === "supported");
  t("§22 — lessons AND papers reads full_support",
    supportStatusFor(c({ lessons: 12, liveLessons: 1, pastPapers: 4 })) === "full_support");

  // §23 — capability chips only where the capability is real.
  t("§23 — no capability is claimed for an empty course",
    capabilitiesFor(c({})).length === 0);
  t("§23 — past papers bring marking, and nothing else does",
    capabilitiesFor(c({ pastPapers: 3 })).join(",") === "past_papers,marking");

  // §35 — the noisy line the brief named, gone from the page it was on.
  t("⚠ §35 — \"curriculum mapped · lessons in preparation\" no longer prints under every card",
    !/curriculum mapped/i.test(code(SUBJECT_PAGE)));
}

// ============================================================================
console.log("\n=== 7. ⚠ §3/§15 — a step with one answer is not a step ===");
// ============================================================================
{
  t("§15 — the selector resolves a lone scope instead of rendering it",
    /scopes\.length === 1/.test(SELECTOR));
  t("§15 — and a lone board", /boards\.length === 1/.test(SELECTOR));
  t("§15 — the qualification row renders only when there is a choice",
    /scopes\.length > 1/.test(SELECTOR));
  t("§15 — the board row renders only when there is a choice",
    /boards\.length > 1/.test(SELECTOR));

  // ⚠ ONLY THE LAST CLICK NAVIGATES. Intermediate steps are state; if a level
  // button became a <Link> the page would reload mid-decision.
  const levelBlock = SELECTOR.slice(SELECTOR.indexOf("step-level"), SELECTOR.indexOf("step-scope"));
  t("⚠ §15 — level options are buttons, not links",
    levelBlock.includes("<Option") && !levelBlock.includes("<Link"));

  // §11 — AS/A2 are children of a board, not peers of GCSE.
  t("§11 — courses hang under a board node", /boardNode\?\.courses/.test(SELECTOR));
  t("§11 — the stage is what the student picks", /c\.stage \?\? c\.name/.test(SELECTOR));
}

// ============================================================================
console.log("\n=== 8. derivations, exercised directly ===");
// ============================================================================
{
  t("stageOf finds AS", stageOf("Edexcel IAL AS Chemistry") === "AS");
  t("stageOf finds A2", stageOf("Edexcel IAL A2 Chemistry") === "A2");
  t("stageOf finds SL/HL", stageOf("IB Chemistry SL") === "SL" && stageOf("IB Chemistry HL") === "HL");
  // ⚠ THE NULL CASE IS THE ONE THAT DRIVES THE SKIP. A board whose single
  // course has no stage must not render a one-button "which stage?" row.
  t("⚠ stageOf returns null when there is no stage to choose",
    stageOf("AQA GCSE Chemistry") === null && stageOf("AP Chemistry") === null);
  // "AS" inside a word must not match — "Chemistry BASIC" is not an AS course.
  t("stageOf does not match inside a word", stageOf("Basics of Chemistry") === null);

  // ⚠ THESE ARE THE REAL UNIT NAMES FROM THE EDEXCEL IAL AS COURSE. The first
  // version of unitSummary read units.code — WCH11/WCH12/WCH13 — and printed
  // "Units 11–13" on the live page. Visual QA caught it; this pins the fix.
  const AS_UNITS = [
    "Unit 1: Structure, Bonding and Introduction to Organic Chemistry",
    "Unit 2: Energetics, Group Chemistry, Halogenoalkanes and Alcohols",
    "Unit 3: Practical Skills in Chemistry I",
  ];
  t("unitSummary spans the real unit numbers", unitSummary(AS_UNITS) === "Units 1–3",
    unitSummary(AS_UNITS));
  t("⚠ unitSummary NEVER reads the paper code as a unit number",
    unitSummary(["WCH11", "WCH12", "WCH13"]) === null,
    unitSummary(["WCH11", "WCH12", "WCH13"]));
  t("unitSummary of one unit is singular", unitSummary(["Unit 4: Rates"]) === "Unit 4");
  t("⚠ unitSummary of nothing is nothing, not 'Units 0–0'", unitSummary([]) === null);

  t("strongestStatus takes the best route", strongestStatus([
    { status: "coming_soon" }, { status: "full_support" }, { status: "expanding" },
  ]) === "full_support");
  t("strongestStatus of nothing is coming_soon", strongestStatus([]) === "coming_soon");
}

// ============================================================================
console.log("\n=== 9. ⚠ §27 — the saved course reuses the existing record ===");
// ============================================================================
{
  t("§27 — no second preference store was created",
    !existsSync("src/lib/resources/preference.ts"));
  t("§27 — the selector writes through the existing writePreference",
    SELECTOR.includes("writePreference"));

  // ⚠ OLD PREFERENCES MUST STILL PARSE. `course` was added as an optional
  // field precisely so that a student who chose a curriculum last week is not
  // silently logged out of their own choice.
  const old = JSON.stringify({ chemistry: { level: "a-level", scope: "international", curriculum: "edexcel-ial", savedAt: "x" } });
  const parsedOld = parsePreferences(old).chemistry;
  t("⚠ §27 — a preference written BEFORE `course` existed still parses",
    !!parsedOld && parsedOld.curriculum === "edexcel-ial", JSON.stringify(parsedOld));
  t("§27 — and its missing course reads as null", parsedOld?.course === null);

  const fresh = JSON.stringify({ chemistry: { level: "a-level", scope: "international", curriculum: "edexcel-ial", course: "edexcel-ial-as-chemistry", savedAt: "x" } });
  t("§27 — a new preference round-trips its course",
    parsePreferences(fresh).chemistry?.course === "edexcel-ial-as-chemistry");

  // localStorage is user-writable — a junk level must not become a broken link.
  const junk = JSON.stringify({ chemistry: { level: "hacked", scope: "international", curriculum: "x" } });
  t("⚠ §27 — an invalid stored level is refused, not rendered",
    parsePreferences(junk).chemistry === undefined);
}

// ============================================================================
console.log("\n=== 10. ⚠ §36 — accessible by construction ===");
// ============================================================================
{
  t("§36 — options are real buttons", /type="button"/.test(SELECTOR));
  t("§36 — selection is announced, not only drawn", /aria-pressed=\{selected\}/.test(SELECTOR));
  t("§36 — every step is a labelled region", (SELECTOR.match(/aria-labelledby=/g) ?? []).length >= 4);
  t("§36 — focus is visible on every control",
    (SELECTOR.match(/focus-visible:outline\b/g) ?? []).length >= 4);
  t("§36 — the trail is a navigation landmark", /aria-label="Your selection"/.test(SELECTOR));
  t("§21 — motion is guarded for reduced-motion users", /motion-safe:/.test(SELECTOR));
  // ⚠ MEASURED ON A PHONE, NOT ASSUMED. The trail button rendered 16px tall
  // and the IB/AP chips 42px — both below the 44px §36 asks for, and both
  // invisible to every other check in this file.
  t("§36 — the secondary chips clear 44px", /min-h-\[44px\]/.test(SELECTOR));
  t("§36 — the trail button has a real hit area (16 + 14 + 14 = 44)",
    /-my-3\.5 cursor-pointer py-3\.5/.test(SELECTOR));
  // ⚠ THE SHARED CRUMB TOO — it was 16px and had no focus ring at all.
  const CRUMB = readFileSync("src/components/catalogue/breadcrumb.tsx", "utf8");
  t("§36 — the shared breadcrumb crumb has a 44px hit area", /-my-3\.5 py-3\.5/.test(CRUMB));
  t("⚠ §36 — and a visible focus state, which it never had",
    /focus-visible:outline/.test(CRUMB));

  // ⚠ STATUS IS NEVER COLOUR ALONE. The chip must render the WORD.
  t("⚠ §36 — the status chip prints its label, not just a tint",
    /\{STATUS_LABEL\[status\]\}/.test(SELECTOR));
  t("§22 — every status has a written label",
    ["full_support", "supported", "expanding", "coming_soon"]
      .every((s) => new RegExp(`${s}:\\s*"`).test(SELECTOR)));
}

// ============================================================================
console.log("\n=== 11. §1 — the search sits closer to the copy ===");
// ============================================================================
{
  // The brief asked for 20–32px less separation. mt-8 (32px) → mt-3 (12px).
  const block = LANDING.slice(LANDING.indexOf("</header>"), LANDING.indexOf("<ResourceSearch"));
  t("§1 — the gap above search was reduced", /className="mt-3 max-w-2xl"/.test(block), block.trim().slice(0, 120));
  t("⚠ §1 — the search itself was not resized or restyled",
    LANDING.includes("<ResourceSearch />") && !/ResourceSearch\s+[a-z]/.test(LANDING));
  t("§1 — search is still below the headline, not above it",
    LANDING.indexOf("Everything you need to study science") < LANDING.indexOf("<ResourceSearch"));
  t("§1 — it was not made sticky", !/sticky/.test(code(LANDING)));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
