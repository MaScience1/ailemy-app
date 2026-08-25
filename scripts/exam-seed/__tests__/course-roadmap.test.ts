/**
 * Course roadmaps: an arrangement of rows, and nothing it authored itself.
 *
 * ============================================================================
 * ⚠ THE BRIEF LISTED THIRTY-SIX LESSON TITLES. NONE OF THEM IS IN THE CODE.
 * ============================================================================
 * §2 of the header is the rule this file mainly exists for, and it names the
 * precedent: PROGRAMME_WINDOW was a config copy of `cohorts.ends_on`, it had
 * one entry, and it told two live programmes their dates were unpublished. A
 * hand-typed list of lesson titles is the same defect with more rows to drift.
 *
 * So roadmap sessions carry a lesson ID and render the title from the row, and
 * the checks below refuse the SHAPE — no lesson-title literals, no slug-keyed
 * lesson map — not merely the specific titles the brief happened to list.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  COHORT_COURSE, cohortProgress, currentWeekNumber, mondayOf, weekdayOf, daysUntil,
  WEEK_KIND_LABEL, type RoadmapWeek,
} from "../../../src/lib/roadmap/model.ts";


/**
 * ⚠ THE CLAIMS MOVED INTO THE CATALOGUE, SO THE GUARD FOLLOWS THEM THERE.
 * These greps used to match an English sentence in the JSX. After the Arabic
 * conversion the sentence is in messages/en.json and the JSX holds a key, so
 * the old form would have gone green-by-absence — a guard dying quietly.
 * Each now checks the component references the key AND the catalogue still
 * carries the claim.
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
const MODEL = readFileSync("src/lib/roadmap/model.ts", "utf8");
const READER = readFileSync("src/lib/roadmap/reader.ts", "utf8");
const PHASES = readFileSync("src/components/roadmap/RoadmapPhases.tsx", "utf8");
const PAGE = readFileSync("src/app/[locale]/tuition/[cohort]/roadmap/page.tsx", "utf8");
const MODES = readFileSync("src/components/tuition/TuitionModes.tsx", "utf8");

const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/**
 * ⚠ STRIPPED ONCE, USED EVERYWHERE. Five separate guards in this codebase have
 * now failed on their own explanatory comments — including one in this file,
 * which defined code() and then tested the raw source anyway. Naming the
 * stripped forms here makes the raw strings the exception rather than the
 * default.
 */
const MODEL_C = code(MODEL), READER_C = code(READER);
const PHASES_C = code(PHASES), PAGE_C = code(PAGE), MODES_C = code(MODES);
const ROADMAP_CODE = MODEL_C + READER_C + PHASES_C + PAGE_C;

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
console.log("\n=== 1. ⚠ §2 — no second representation of lesson data ===");
// ============================================================================
{
  /**
   * ⚠ A SAMPLE OF THE BRIEF'S OWN LIST. If any of these strings appears in the
   * roadmap layer, somebody has copied the lesson table into code.
   */
  const BRIEF_TITLES = [
    "Definitions, formulae and the mole",
    "Balancing Equations",
    "Relative Mass, Molar Mass and ppm",
    "Empirical and molecular formulae",
    "Mass spectrometry",
    "Ionic bonding and lattices",
    "Free radical substitution",
    "Addition polymerisation",
  ];
  for (const title of BRIEF_TITLES) {
    t(`⚠ "${title.slice(0, 34)}" is not in the roadmap code`,
      !ROADMAP_CODE.includes(title));
  }

  // ⚠ AND THE SHAPE, not just these eight. A map keyed by lesson slug, or an
  // array of lesson-shaped literals, is the same defect under another name.
  const slugKeyedLessons = /["'][a-z0-9-]{8,}["']\s*:\s*\{[^}]*(title|lesson)/i;
  t("⚠ §2 — no lesson-slug-keyed map anywhere in the roadmap layer",
    !slugKeyedLessons.test(ROADMAP_CODE), ROADMAP_CODE.match(slugKeyedLessons)?.[0]);
  t("⚠ §2 — no array of lesson titles",
    !/(LESSONS|LESSON_TITLES|SEQUENCE)\s*(:|=)\s*\[/.test(ROADMAP_CODE));

  // The positive: the title comes from the row, every time.
  t("§28 — a session carries a lesson ID", /lessonId: lesson \? String\(lesson\.id\) : null/.test(READER));
  t("⚠ §28 — and the title is read off the row", /lessonTitle: lesson \? String\(lesson\.title\) : null/.test(READER));
  t("§28 — the component renders that field, not a literal",
    /\{s\.lessonTitle\}/.test(PHASES) && !/lessonTitle === ["']/.test(code(PHASES)));
  t("⚠ §28 — the sequence is the lesson table's own",
    /\.order\("lesson_number"/.test(READER));
  // ⚠ ORDERING BY sort_order ALONE PUT LESSON 2 IN WEEK 1's TUESDAY SLOT.
  // ⚠ SCOPED TO THE LESSONS QUERY. The units query orders by sort_order too,
  // so a whole-file index comparison compared the wrong two statements.
  const lessonsQuery = READER_C.slice(READER_C.indexOf('from("lessons")'), READER_C.indexOf("]);", READER_C.indexOf('from("lessons")')));
  t("⚠ and sort_order is only the tiebreak, not the sequence",
    lessonsQuery.indexOf('.order("lesson_number"') < lessonsQuery.indexOf('.order("sort_order"'),
    lessonsQuery.trim().slice(0, 90));

  // Phases are units — not a parallel structure with its own names.
  t("§27 — phases come from the units table", /from\("units"\)/.test(READER));
  t("⚠ §2 — and their titles are the unit rows'", /title: String\(u\.name\)/.test(READER));
}

// ============================================================================
console.log("\n=== 2. ⚠ §3 — no invented calendar data ===");
// ============================================================================
{
  t("§3 — dates come from the shared schedule engine", /loadCalendarEvents/.test(READER));
  t("§3 — bounded by the cohort's own window",
    /from: cohort\.firstClassOn, to: cohort\.lastClassOn/.test(READER));
  t("⚠ §3 — schedule_summary is NOT parsed for weekdays",
    !/scheduleSummary[\s\S]{0,80}(split|match|parse)/i.test(ROADMAP_CODE));
  t("⚠ §3 — no weekday literal is assigned to a session",
    !/(day|weekday)\s*[:=]\s*["'](Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)["']/.test(ROADMAP_CODE));
  t("§3 — the weekday is derived from the date", /weekdayOf\(dayISO\)/.test(READER));

  // ⚠ NO TBC, EVER (§39).
  t("⚠ §39 — the word TBC appears nowhere", !/\bTBC\b/.test(ROADMAP_CODE));
  t("§39 — a cohort with no schedule gets weeks:0 and a stated reason",
    /mine\.length === 0/.test(READER) && /weekly timetable has not been published/.test(READER));
  t("⚠ §3 — no examination date is invented",
    !/\b(exam|examination)\s*(date|day)?\s*[:=]\s*["']\d{4}-\d{2}-\d{2}/i.test(ROADMAP_CODE));
  t("⚠ §3 — no ISO date literal in the roadmap layer at all",
    !/\d{4}-\d{2}-\d{2}/.test(code(MODEL) + code(READER)),
    (code(MODEL) + code(READER)).match(/\d{4}-\d{2}-\d{2}/)?.[0]);

  // ⚠ WEEK KINDS ARE NOT GUESSED. Nothing marks revision or mocks in the data.
  t("⚠ §9 — no rule-of-thumb assigns revision or mock weeks",
    !/weekNumber\s*%\s*\d/.test(ROADMAP_CODE));
  t("§8 — but every kind exists in the model for when data marks them",
    Object.keys(WEEK_KIND_LABEL).length === 6);
}

// ============================================================================
console.log("\n=== 3. ⚠ §5/§22 — price, CTA and capacity are derived ===");
// ============================================================================
{
  /**
   * ⚠ THE SERVICE CHANGED, SO THE ASSERTION FOLLOWS IT. This pinned
   * displayAmount(cohort.pricePence), which read a sterling column and
   * converted it at a fixed 4.7 — so the roadmap could quote a different figure
   * from the card that linked to it. The price now comes from the same active
   * Stripe Price the tuition card shows and Checkout charges.
   */
  t("§21 — the price comes from the Stripe pricing layer",
    /loadPricing\(course, "group"\)/.test(PAGE) && /views\.monthly\?\.formatted/.test(PAGE));
  t("⚠ §21 — and the course is derived from the cohort's qualification, not its slug",
    /courseForQualification\(cohort\.qualification\)/.test(PAGE));
  t("⚠ §5 — the CTA label is derived, not typed",
    /canReserve \? t\("reserveYourPlace"\) : t\("registerInterest"\)/.test(PAGE)
      && msg("tuition.reserveYourPlace") === "Reserve your place"
      && msg("tuition.registerInterest") === "Register interest",
    `${msg("tuition.reserveYourPlace")} / ${msg("tuition.registerInterest")}`);
  t("⚠ §5 — from availabilityFor, the same AND every other surface uses",
    /availabilityFor\(cohort\.subject, \[cohort\]\)/.test(PAGE));
  t("§22 — capacity comes from loadCapacity", /loadCapacity\(cohort\.slug/.test(PAGE));
  t("⚠ §22 — cohort_enrolments is never touched", !/cohort_enrolments/.test(ROADMAP_CODE));
  t("⚠ §22 — an unknown count shows the cap alone",
    PAGE.includes("capacity.known")
      && PAGE.includes('t("maximumStudents"')
      && PAGE.includes('t("placesTaken"')
      && msg("tuition.maximumStudents").includes("{cap}")
      && !msg("tuition.maximumStudents").includes("{taken}")
      && msg("tuition.placesTaken").includes("{taken}"),
    `${msg("tuition.maximumStudents")} | ${msg("tuition.placesTaken")}`);
  for (const re of [/only \d+ left/i, /selling fast/i, /hurry/i, /\d+ people/i]) {
    t(`⚠ no fake urgency: ${re.source}`, !re.test(ROADMAP_CODE));
  }
}

// ============================================================================
console.log("\n=== 4. ⚠ §6 — no protected content is reachable ===");
// ============================================================================
{
  // ⚠ THE TWO TABLES A PUBLIC PAGE MUST NOT ASK FOR. paper_questions refuses
  // anon with 42501; deck sources are protected. Asking would fail the whole
  // read for a logged-out visitor, which is how the qualification build shipped
  // an empty board list to every anonymous student.
  t("⚠ §6 — paper_questions is never queried", !/paper_questions/.test(ROADMAP_CODE));
  t("⚠ §6 — question_spec_points is never queried", !/question_spec_points/.test(ROADMAP_CODE));
  t("⚠ §6 — deck sources are never read", !/deck_path|deck_source|lesson_decks/.test(ROADMAP_CODE));
  t("§6 — the reader uses the VIEWER's client, not a service role",
    /createClient\(\)/.test(READER) && !/SERVICE_ROLE|service_role/.test(ROADMAP_CODE));
  t("§6 — only public lesson columns are selected",
    /select\("id, title, slug, unit_id, lesson_number, sort_order, status"\)/.test(READER));
  // §14 — no endorsement implied.
  t("⚠ §14 — no claim of Pearson endorsement",
    !/(endorsed|approved|official)\s+(by\s+)?(pearson|edexcel)/i.test(ROADMAP_CODE));
  t("§14 — no mark-scheme content is exposed", !/mark_scheme|markScheme/.test(ROADMAP_CODE));
}

// ============================================================================
console.log("\n=== 5. ⚠ §4 — generic system, honest where content is absent ===");
// ============================================================================
{
  t("§4 — the wiring covers every cohort qualification in use",
    ["ial-as", "ial-a2", "gcse-y11", "gcse-y10"].every((q) => q in COHORT_COURSE));
  t("⚠ §4 — no subject is hardcoded anywhere in the roadmap layer",
    !/["'](chemistry|biology|physics)["']/.test(code(MODEL) + code(READER)),
    (code(MODEL) + code(READER)).match(/["'](chemistry|biology|physics)["']/)?.[0]);
  t("⚠ an ambiguous course match is refused, not guessed",
    /candidates\.length === 1 \? candidates\[0\] : undefined/.test(READER));
  t("…and it says why", /covers more than one course/.test(READER));
  t("§39 — a failed read is an error, never an empty roadmap",
    /roadmap\.error/.test(PAGE) && /const fail = \(error: string\)/.test(READER));
}

// ============================================================================
console.log("\n=== 6. §10/§12 — position is the cohort's, never a student's ===");
// ============================================================================
{
  const wk = (n: number, s: string, e: string): RoadmapWeek =>
    ({ weekNumber: n, startISO: s, endISO: e, kind: "core", sessions: [] });
  const weeks = [wk(1, "2026-09-14", "2026-09-20"), wk(2, "2026-09-21", "2026-09-27"), wk(3, "2026-09-28", "2026-10-04")];

  t("§10 — the current week is found", currentWeekNumber(weeks, "2026-09-23") === 2);
  t("⚠ §10 — and is null BEFORE teaching starts, not week 1",
    currentWeekNumber(weeks, "2026-08-01") === null);
  t("⚠ §10 — and null after it ends", currentWeekNumber(weeks, "2027-01-01") === null);

  const p = cohortProgress(weeks, "2026-09-23");
  t("§12 — progress counts weeks already finished", p.taught === 1 && p.total === 3);
  t("§12 — nothing taught before the start", cohortProgress(weeks, "2026-08-01").taught === 0);
  t("§12 — everything taught after the end", cohortProgress(weeks, "2027-01-01").percent === 100);
  t("§12 — an empty roadmap is 0%, not NaN", cohortProgress([], "2026-09-23").percent === 0);

  // ⚠ §8 OF THE HEADER — COHORT POSITION ONLY. The completion tables are
  // parked and unapplied, so a personal percentage would be invented.
  t("⚠ §12 — no per-student progress is read",
    !/lesson_completions|user_progress|student_progress/.test(ROADMAP_CODE));
  t("§12 — the label says whose progress it is", /Where the class is/.test(PHASES));

  t("date helpers: Monday of a Saturday", mondayOf("2026-09-19") === "2026-09-14");
  t("date helpers: weekday from a date", weekdayOf("2026-09-15") === "Tuesday");
  t("date helpers: days until", daysUntil("2026-09-01", "2026-09-15") === 14);
}

// ============================================================================
console.log("\n=== 7. ⚠ §7 of the header — nothing was broken ===");
// ============================================================================
{
  for (const p of ["/tuition", "/tuition/one-to-one", "/tuition/interest", "/tuition/[cohort]/roadmap",
                   "/calendar", "/intensive", "/resources", "/past-papers", "/exam-builder", "/"]) {
    t(`preserved — ${p} resolves`, p === "/" ? existsSync(join(APP, "[locale]", "page.tsx")) : hasRoute(p));
  }
  /**
   * ⚠ THE STATIC SIBLINGS MUST STILL WIN. /tuition/one-to-one and
   * /tuition/interest sit beside a new dynamic [cohort] segment; Next sorts
   * static above dynamic, so they are unshadowed — but the check is cheap and
   * the failure would be a 404 on a live page.
   */
  t("⚠ the new dynamic segment did not replace the static ones",
    existsSync("src/app/[locale]/tuition/one-to-one/page.tsx")
      && existsSync("src/app/[locale]/tuition/interest/page.tsx")
      && existsSync("src/app/[locale]/tuition/[cohort]/roadmap/page.tsx"));
  t("§7 — no URL moved, so nothing was owed a redirect",
    !/redirect\(|permanentRedirect/.test(code(PAGE) + code(MODES)));
  t("preserved — the commitment selector still renders",
    /Object\.keys\(COMMITMENT_LABEL\)/.test(MODES));
  /**
   * ⚠ SAME MOVE ON THE CARD. quote(cohort.pricePence, …) applied a local
   * discount table to a converted column; the card now renders the Stripe
   * amounts the server resolved for its own cohort slug.
   */
  t("preserved — pricing still comes from the pricing layer, now Stripe's",
    !/quote\(cohort\.pricePence/.test(MODES) && /pricing\[c\]\?\.amounts/.test(MODES));
  t("§1 — every cohort card links to its roadmap",
    /href=\{`\/tuition\/\$\{cohort\.slug\}\/roadmap`\}/.test(MODES));
  t("⚠ §1 — the roadmap CTA is secondary, not a second filled button",
    /border-\[var\(--subject-accent\)\] bg-\[var\(--subject-tint\)\]/.test(MODES)
      && !/roadmap`\}[\s\S]{0,300}bg-ink\b/.test(MODES));
}

// ============================================================================
console.log("\n=== 8. §37 — accessible, and light ===");
// ============================================================================
{
  t("§37 — accordions are native <details>",
    /<details/.test(PHASES_C) && !/useState/.test(PHASES_C));
  t("§38 — the roadmap ships no client JS", !/"use client"/.test(PHASES_C) && !/"use client"/.test(PAGE_C));
  t("§37 — the progress rail is announced", /role="progressbar"/.test(PHASES) && /aria-valuenow/.test(PHASES));
  t("§37 — phases are labelled regions", /aria-labelledby=\{`h-\$\{p\.id\}`\}/.test(PHASES));
  t("§37 — summaries clear 44px", /min-h-\[44px\]/.test(PHASES));
  t("§24 — motion is guarded", /motion-safe:/.test(MODES));
  t("§35 — opening a week reports", /data-cta="course_roadmap_week_expanded"/.test(PHASES));
  t("§35 — and opening a roadmap does", /data-cta="course_roadmap_opened"/.test(MODES));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
