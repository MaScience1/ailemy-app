/**
 * The public catalogue's honesty rules.
 *
 * ⚠ THESE ARE THE SPEC'S "NO FAKE FUNCTIONALITY" CLAUSES AS ASSERTIONS. A dead
 * Enrol button, an invented timetable, or an AI-marking claim are each a
 * promise the product cannot keep, and each is cheaper to catch here than on a
 * parent's screen.
 */
import {
  FALLBACK_COHORTS, ctaFor, priceLabel, activeAnnouncement, SUBJECTS,
  type Cohort, type Announcement,
} from "../../../src/lib/exam/../public/catalogue.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const bySlug = (s: string) => FALLBACK_COHORTS.find((c) => c.slug === s)!;

console.log("── THE AS CHEMISTRY CARD, EXACTLY AS SPECIFIED ──");
{
  const as = bySlug("ial-chemistry-as-sep-2026");
  t("£169/month", priceLabel(as) === "£169/month", priceLabel(as));
  t("4 live hours a week", as.hoursPerWeek === 4);
  t("2 sessions", as.sessionsPerWeek === 2);
  t("Tue + Sat, 7:00–9:30 PM Doha, 2 hours + short break",
    as.scheduleSummary === "Tuesday + Saturday · 7:00–9:30 PM Doha · 2 hours teaching + short break",
    as.scheduleSummary);
  t("onboarding Sun 13 Sep 2026", as.onboardingOn === "2026-09-13");
  t("first class Tue 15 Sep 2026", as.firstClassOn === "2026-09-15");
  t("cap 20", as.seatCap === 20);
}

console.log("\n── NO DEAD ENROL, EVER ──");
{
  for (const c of FALLBACK_COHORTS) {
    const cta = ctaFor(c);
    t(`${c.slug}: CTA leads somewhere`, cta.href.length > 1, cta);
    if (cta.kind === "enrol") t(`${c.slug}: an Enrol CTA has a real url`, Boolean(c.enrolmentUrl));
  }
  // ⚠ THE SABOTAGE: a cohort claiming to be enrolling with no link must NOT
  // produce an Enrol button. This is 0041's cohorts_enrolling_needs_url
  // expressed in the UI layer, so a row that slipped through still cannot
  // render a dead button.
  const rogue: Cohort = { ...bySlug("igcse-chemistry-y10"), status: "enrolling", enrolmentUrl: null };
  t("status=enrolling with no url falls back to Register interest",
    ctaFor(rogue).kind === "interest", ctaFor(rogue));
  const real: Cohort = { ...rogue, enrolmentUrl: "https://pay.example/x" };
  t("...and WITH a url it does say Enrol", ctaFor(real).kind === "enrol");
}

console.log("\n── NO INVENTED TIMETABLES ──");
{
  t("Y11 publishes no schedule", bySlug("igcse-chemistry-y11").scheduleSummary === null);
  t("Y10 publishes no schedule", bySlug("igcse-chemistry-y10").scheduleSummary === null);
  t("Y11 is £149/month", priceLabel(bySlug("igcse-chemistry-y11")) === "£149/month");
  t("Y11 is 4 hours", bySlug("igcse-chemistry-y11").hoursPerWeek === 4);
  t("Y10 is £139/month", priceLabel(bySlug("igcse-chemistry-y10")) === "£139/month");
  t("Y10 is 3 hours", bySlug("igcse-chemistry-y10").hoursPerWeek === 3);
  t("both are Register interest",
    ctaFor(bySlug("igcse-chemistry-y11")).label === "Register interest" &&
    ctaFor(bySlug("igcse-chemistry-y10")).label === "Register interest");
}

console.log("\n── NO AI-MARKING CLAIM ANYWHERE ──");
{
  const corpus = JSON.stringify({ FALLBACK_COHORTS, SUBJECTS }).toLowerCase();
  for (const banned of ["ai marking", "ai-marking", "ai mark", "artificial intelligence", "ai-powered", "ai powered"]) {
    t(`the catalogue never says "${banned}"`, !corpus.includes(banned));
  }
  t("...and it does say mark-scheme-informed",
    corpus.includes("mark-scheme-informed"));
}

console.log("\n── THE ANNOUNCEMENT BAR DISAPPEARS WHEN IT SHOULD ──");
{
  const now = new Date("2026-09-01T12:00:00Z");
  const base = { id: "a", title: "A", body: null, ctaLabel: null, ctaUrl: null, priority: 0 };
  const on = { ...base, enabled: true, startsAt: null, endsAt: null };
  t("nothing configured shows nothing", activeAnnouncement([], now) === null);
  t("disabled shows nothing", activeAnnouncement([{ ...on, enabled: false }], now) === null);
  t("not started yet shows nothing",
    activeAnnouncement([{ ...on, startsAt: "2026-10-01T00:00:00Z" }], now) === null);
  t("expired shows nothing",
    activeAnnouncement([{ ...on, endsAt: "2026-08-01T00:00:00Z" }], now) === null);
  t("in-window and enabled shows", activeAnnouncement([on], now)?.id === "a");
  t("highest priority wins",
    activeAnnouncement([on, { ...on, id: "b", title: "B", priority: 5 }], now)?.id === "b");
  // ⚠ A TIE MUST BE STABLE, or the bar flickers between two banners per render.
  const tie = [{ ...on, id: "z", title: "Z" }, { ...on, id: "m", title: "M" }];
  t("a priority tie resolves stably", activeAnnouncement(tie, now)?.id === activeAnnouncement([...tie].reverse(), now)?.id);
}

console.log("\n── SUBJECT HONESTY ──");
{
  t("Chemistry is available and links somewhere",
    SUBJECTS[0].status === "available" && Boolean(SUBJECTS[0].exploreHref));
  t("Biology does not claim resources it lacks",
    SUBJECTS[1].status === "interest" && SUBJECTS[1].exploreHref === null);
  t("Physics likewise",
    SUBJECTS[2].status === "interest" && SUBJECTS[2].exploreHref === null);
  t("every subject lists four qualifications",
    SUBJECTS.every((s) => s.qualifications.length === 4));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
