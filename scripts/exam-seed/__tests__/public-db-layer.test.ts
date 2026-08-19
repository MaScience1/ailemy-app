/**
 * The database-backed public surface: mappers, fallback choice, admin validation.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/public-db-layer.test.ts
 *
 * ============================================================================
 * ⚠ NO CREDENTIALS AND NO NETWORK
 * ============================================================================
 * Everything asserted here is pure, which is why it was separated from
 * readers.ts in the first place: the I/O is three lines of supabase-js and the
 * decisions are all here, where they can be sabotaged without a database.
 *
 * ⚠ THE ROW FIXTURES ARE DERIVED FROM THE REAL CATALOGUE, NOT TYPED OUT.
 * rowFrom() turns a FALLBACK_COHORTS entry into the database row that would
 * produce it, so a change to the founder's catalogue cannot leave a
 * hand-written row here pinning last week's shape (AGENTS.md).
 */
import {
  FALLBACK_COHORTS,
  cohortFromRow,
  announcementFromRow,
  chooseCohorts,
  type Cohort,
} from "../../../src/lib/public/catalogue.ts";
import {
  readAnnouncementForm,
  toInstant,
  toRow,
  isLiveNow,
  CATEGORIES,
  STATUSES,
} from "../../../src/lib/admin/announcement-form.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

/** The database row that would produce this cohort. Derived, never transcribed. */
const rowFrom = (c: Cohort): Record<string, unknown> => ({
  slug: c.slug, title: c.title, subject: c.subject, qualification: c.qualification,
  price_pence: c.pricePence, currency: c.currency, hours_per_week: c.hoursPerWeek,
  sessions_per_week: c.sessionsPerWeek, schedule_summary: c.scheduleSummary,
  onboarding_on: c.onboardingOn, starts_on: c.firstClassOn, seat_cap: c.seatCap,
  status: c.status, enrolment_url: c.enrolmentUrl, summary: c.summary, features: c.features,
});

const AS = FALLBACK_COHORTS.find((c) => c.slug === "ial-chemistry-as-sep-2026")!;
const Y11 = FALLBACK_COHORTS.find((c) => c.slug === "igcse-chemistry-y11")!;

console.log("── A ROW BECOMES THE COHORT IT CAME FROM ──");
{
  for (const c of FALLBACK_COHORTS) {
    const m = cohortFromRow(rowFrom(c));
    t(`${c.slug} round-trips`, m.ok, m.ok ? undefined : m.reason);
    if (m.ok) {
      t(`  …identically`, JSON.stringify(m.value) === JSON.stringify(c),
        m.ok ? { got: m.value, want: c } : undefined);
    }
  }
}

console.log("\n── A ROW MISSING SOMETHING IS REFUSED, NOT DEFAULTED ──");
{
  // ⚠ SABOTAGE, FIELD BY FIELD. A mapper that quietly defaults `subject` puts a
  // Chemistry price on a Biology page and nothing on screen says so.
  const required = ["slug", "title", "subject", "qualification", "price_pence", "status"];
  for (const field of required) {
    const broken = { ...rowFrom(AS) };
    delete broken[field];
    const m = cohortFromRow(broken);
    t(`missing ${field} is refused`, m.ok === false, m.ok ? m.value : m.reason);
    if (!m.ok) t(`  …and the reason names it`, m.reason.includes(field === "price_pence" ? "price_pence" : field.replace("_", " ")) || m.reason.includes(field), m.reason);
  }
  const bogus = cohortFromRow({ ...rowFrom(AS), status: "publishing" });
  t("an unknown status is refused", bogus.ok === false, bogus.ok ? bogus.value : bogus.reason);
}

console.log("\n── THE DEAD-CTA RULE SURVIVES THE DATABASE ──");
{
  // A row claiming to be enrolling with no url is downgraded on the way past,
  // so ctaFor() can never be handed one.
  const m = cohortFromRow({ ...rowFrom(Y11), status: "enrolling", enrolment_url: null });
  t("enrolling with no url is downgraded to interest", m.ok && m.value.status === "interest",
    m.ok ? m.value.status : m.reason);
  const withUrl = cohortFromRow({ ...rowFrom(Y11), status: "enrolling", enrolment_url: "https://pay.example/x" });
  t("…and WITH a url it stays enrolling", withUrl.ok && withUrl.value.status === "enrolling",
    withUrl.ok ? withUrl.value.status : withUrl.reason);
}

console.log("\n── NO INVENTED TIMETABLE FROM A NULL COLUMN ──");
{
  const m = cohortFromRow({ ...rowFrom(Y11), schedule_summary: null });
  t("a null schedule_summary stays null", m.ok && m.value.scheduleSummary === null,
    m.ok ? m.value.scheduleSummary : m.reason);
  const blank = cohortFromRow({ ...rowFrom(Y11), schedule_summary: "   " });
  t("…and whitespace is null too, not a blank line on the card",
    blank.ok && blank.value.scheduleSummary === null, blank.ok ? blank.value.scheduleSummary : blank.reason);
}

console.log("\n── AN EMPTY DATABASE IS NOT AN EMPTY CATALOGUE ──");
{
  const empty = chooseCohorts([], FALLBACK_COHORTS);
  t("no rows falls back", empty.source === "fallback", empty.source);
  t("…to the real catalogue, not to nothing", empty.data.length === FALLBACK_COHORTS.length, empty.data.length);
  t("…and says why", Boolean(empty.reason), empty.reason);

  const some = chooseCohorts([AS], FALLBACK_COHORTS);
  t("rows are used", some.source === "database" && some.data.length === 1, some);

  // ⚠ SABOTAGE: the reader orders by display_order, so this must not re-sort.
  // An earlier version sorted by slug here, which would have silently overridden
  // whatever order an admin set.
  const reversed = [...FALLBACK_COHORTS].reverse();
  const kept = chooseCohorts(reversed, FALLBACK_COHORTS);
  t("the caller's order is preserved, not re-sorted",
    kept.data.map((c) => c.slug).join() === reversed.map((c) => c.slug).join(),
    kept.data.map((c) => c.slug));
}

console.log("\n── HALF A CTA IS NO CTA ──");
{
  const base = { id: "a1", title: "Enrolment open", priority: 3, enabled: true, starts_at: null, ends_at: null };
  const both = announcementFromRow({ ...base, cta_label: "See cohorts", link_url: "/tuition" });
  t("label + url is a CTA", both.ok && both.value.ctaLabel === "See cohorts" && both.value.ctaUrl === "/tuition",
    both.ok ? both.value : both.reason);
  const labelOnly = announcementFromRow({ ...base, cta_label: "See cohorts", link_url: null });
  t("a label with no url renders no CTA", labelOnly.ok && labelOnly.value.ctaLabel === null,
    labelOnly.ok ? labelOnly.value.ctaLabel : labelOnly.reason);
  const urlOnly = announcementFromRow({ ...base, cta_label: null, link_url: "/tuition" });
  t("a url with no label renders no CTA", urlOnly.ok && urlOnly.value.ctaUrl === null,
    urlOnly.ok ? urlOnly.value.ctaUrl : urlOnly.reason);
  const titleless = announcementFromRow({ ...base, title: "  " });
  t("a titleless row is refused, not rendered as an empty strip", titleless.ok === false,
    titleless.ok ? titleless.value : titleless.reason);
}

console.log("\n── THE ADMIN FORM REFUSES WHAT THE DATABASE WOULD ──");
const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = {
    title: "Autumn cohort", category: "cohort", status: "live",
    priority: "5", tz_offset: "0",
  };
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== "") fd.set(k, v);
  return fd;
};
{
  t("a good form is accepted", readAnnouncementForm(form()).ok);
  t("a missing title is refused", readAnnouncementForm(form({ title: "" })).ok === false);
  t("an off-list category is refused", readAnnouncementForm(form({ category: "promo" })).ok === false);
  t("an off-list status is refused", readAnnouncementForm(form({ status: "published" })).ok === false);
  t("a non-integer priority is refused", readAnnouncementForm(form({ priority: "1.5" })).ok === false);
  t("a label with no link is refused",
    readAnnouncementForm(form({ cta_label: "Enrol" })).ok === false);
  t("a link with no label is refused",
    readAnnouncementForm(form({ link_url: "/tuition" })).ok === false);
  t("both together are accepted",
    readAnnouncementForm(form({ cta_label: "Enrol", link_url: "/tuition" })).ok);

  const backwards = readAnnouncementForm(form({
    starts_at: "2026-09-10T09:00", ends_at: "2026-09-01T09:00",
  }));
  t("a backwards window is refused", backwards.ok === false,
    backwards.ok ? backwards.fields : backwards.error);
  t("…and forwards is accepted", readAnnouncementForm(form({
    starts_at: "2026-09-01T09:00", ends_at: "2026-09-10T09:00",
  })).ok);

  // ⚠ THE RULE THE DATABASE DOES NOT HAVE. 0039's public policy gates on
  // `enabled` and the window and never looks at `status`, so an enabled draft is
  // visible to every visitor. This is the only thing stopping that.
  const enabledDraft = readAnnouncementForm(form({ status: "draft", enabled: "on" }));
  t("an ENABLED DRAFT is refused — the public bar does not check status",
    enabledDraft.ok === false, enabledDraft.ok ? enabledDraft.fields : enabledDraft.error);
  t("…and the message says why", !enabledDraft.ok && /status/i.test(enabledDraft.error),
    enabledDraft.ok ? "" : enabledDraft.error);
  t("a disabled draft is fine", readAnnouncementForm(form({ status: "draft" })).ok);
  t("an enabled LIVE row is fine", readAnnouncementForm(form({ status: "live", enabled: "on" })).ok);
  t("an enabled ARCHIVED row is refused",
    readAnnouncementForm(form({ status: "archived", enabled: "on" })).ok === false);

  // Every listed value is actually accepted — otherwise the dropdown offers
  // options the validator rejects.
  for (const c of CATEGORIES) t(`category ${c} is accepted`, readAnnouncementForm(form({ category: c })).ok);
  for (const st of STATUSES) t(`status ${st} is accepted when disabled`, readAnnouncementForm(form({ status: st })).ok);
}

console.log("\n── body IS NEVER NULL, BECAUSE THE COLUMN IS NOT NULL ──");
{
  // ⚠ REGRESSION GUARD FOR A REAL PRODUCTION FAULT. announcements.body is NOT
  // NULL in production — 0022 on disk said otherwise until the live sabotage run
  // of 2026-08-19 proved it with a 23502. A blank box must become "", not null,
  // or writing a title-only banner hands the admin a raw constraint error.
  const blank = readAnnouncementForm(form());
  t("a blank body becomes an empty string, not null",
    blank.ok && blank.fields.body === "", blank.ok ? blank.fields.body : blank.error);
  t("…and reaches the row as a string", blank.ok && toRow(blank.fields).body === "",
    blank.ok ? toRow(blank.fields).body : null);
  const written = readAnnouncementForm(form({ body: "Autumn enrolment is open." }));
  t("a written body survives", written.ok && written.fields.body === "Autumn enrolment is open.",
    written.ok ? written.fields.body : written.error);
  // The read side still nulls an empty body, so the bar renders no paragraph.
  const back = announcementFromRow({ id: "x", title: "T", body: "", priority: 0, enabled: true,
    starts_at: null, ends_at: null, cta_label: null, link_url: null });
  t("…and an empty body reads back as null, so the bar renders no paragraph",
    back.ok && back.value.body === null, back.ok ? back.value.body : back.reason);
}

console.log("\n── A LOCAL TIME IS RESOLVED WITH ITS OFFSET ──");
{
  // getTimezoneOffset() is minutes to ADD to local to reach UTC.
  t("UTC is itself", toInstant("2026-09-01T19:00", 0) === "2026-09-01T19:00:00.000Z", toInstant("2026-09-01T19:00", 0));
  t("Doha (UTC+3) 19:00 is 16:00Z", toInstant("2026-09-01T19:00", -180) === "2026-09-01T16:00:00.000Z",
    toInstant("2026-09-01T19:00", -180));
  t("London BST (UTC+1) 19:00 is 18:00Z", toInstant("2026-09-01T19:00", -60) === "2026-09-01T18:00:00.000Z",
    toInstant("2026-09-01T19:00", -60));
  t("New York EST (UTC-5) 19:00 crosses midnight",
    toInstant("2026-09-01T19:00", 300) === "2026-09-02T00:00:00.000Z", toInstant("2026-09-01T19:00", 300));
  t("an empty value is null", toInstant(null, -180) === null);
  t("junk is null rather than Invalid Date", toInstant("not-a-time", 0) === null, toInstant("not-a-time", 0));
}

console.log("\n── published_at IS SET ONCE, NOT ON EVERY SAVE ──");
{
  const live = readAnnouncementForm(form({ status: "live" }));
  if (!live.ok) throw new Error("fixture broke: " + live.error);
  const first = toRow(live.fields, null);
  t("going live stamps published_at", typeof first.published_at === "string", first.published_at);

  const kept = toRow(live.fields, "2026-01-01T00:00:00.000Z");
  t("re-saving keeps the original stamp", kept.published_at === "2026-01-01T00:00:00.000Z", kept.published_at);

  const draft = readAnnouncementForm(form({ status: "draft" }));
  if (!draft.ok) throw new Error("fixture broke");
  t("a draft does not invent one", toRow(draft.fields, null).published_at === null,
    toRow(draft.fields, null).published_at);
}

console.log("\n── \"ON THE SITE NOW\" IS COMPUTED THE SAME WAY THE BAR COMPUTES IT ──");
{
  const now = new Date("2026-09-05T12:00:00Z");
  const w = (enabled: boolean, s: string | null, e: string | null) =>
    isLiveNow({ enabled, startsAt: s, endsAt: e }, now);
  t("off is never live", w(false, null, null) === false);
  t("on with no window is live", w(true, null, null) === true);
  t("on but not yet started is not live", w(true, "2026-09-06T00:00:00Z", null) === false);
  t("on and started is live", w(true, "2026-09-01T00:00:00Z", null) === true);
  t("on but expired is not live", w(true, null, "2026-09-04T00:00:00Z") === false);
  t("the end is exclusive", w(true, null, "2026-09-05T12:00:00Z") === false);
  t("inside the window is live", w(true, "2026-09-01T00:00:00Z", "2026-09-09T00:00:00Z") === true);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
