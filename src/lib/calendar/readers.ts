import "server-only";

import { loadCalendar } from "@/lib/schedule/readers";
import { loadOpenSlots } from "@/lib/booking/readers";
import { stripeConfig } from "@/lib/booking/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { CANONICAL_TZ } from "@/lib/schedule/timezone";

import { matchesFilters, type CalendarEvent, type CalendarQuery, levelForYearGroup } from "./types.ts";

/**
 * The one reader every calendar surface calls (§2).
 *
 * ============================================================================
 * ⚠ IT COMPOSES THE EXISTING READERS RATHER THAN REPLACING THEM
 * ============================================================================
 * loadCalendar() already serves seven callers and is the schedule source of
 * truth; loadOpenSlots() already computes bookable 1-to-1 times against group
 * lessons, blocks, bookings and holds. This adds no third source — it
 * normalises both into ONE event shape so the calendar component never asks
 * where an event came from.
 *
 * That is what makes §2 enforceable: a new surface cannot invent its own event
 * type, because there is only one and only this function produces it.
 *
 * ⚠ PUBLIC MODE NEVER RECEIVES ANOTHER STUDENT'S BOOKING. Not filtered out at
 * the end — never fetched. A taken slot reaches the public calendar as an
 * ABSENCE (loadOpenSlots subtracts it), which is §22's "simply not appear"
 * option and the one that cannot leak a name by accident (§72).
 */

const MIN = 60_000;

export type CalendarLoad = {
  events: CalendarEvent[];
  /** True once the database has real schedule rows; false means code fallback. */
  fromDatabase: boolean;
  /** Why we fell back, for a dev banner. Never shown to a visitor. */
  reason?: string;
  /** Rows the mappers refused, travelling with the result rather than logged away. */
  refusals: string[];
  /** False when Stripe is keyless — no slot may render a payable CTA (§80). */
  payable: boolean;
};

export async function loadCalendarEvents(q: CalendarQuery): Promise<CalendarLoad> {
  const wantGroup = q.type !== "private";
  const wantPrivate = q.type !== "group";
  const payable = stripeConfig().configured;

  const events: CalendarEvent[] = [];
  const refusals: string[] = [];
  let fromDatabase = false;
  let reason: string | undefined;

  // ── group lessons ─────────────────────────────────────────────────────────
  if (wantGroup) {
    const cal = await loadCalendar({
      from: q.from, to: q.to,
      subject: q.subject ?? undefined,
      // ⚠ CANCELLED LESSONS ARE INCLUDED, DELIBERATELY (§48). A lesson that
      // silently vanishes reads as a bug and generates an email; "Cancelled —
      // Winter break" answers the question before it is asked. The homepage
      // preview is the one surface that asks for live-only.
      includeCancelled: true,
    });
    fromDatabase = cal.source === "database";
    reason = cal.reason;
    refusals.push(...cal.refusals);

    for (const s of cal.sessions) {
      events.push({
        key: `g:${s.key}`,
        type: "group",
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: s.title ?? s.cohort.title,
        subject: s.cohort.subject,
        // ⚠ STRUCTURED, NOT PARSED OUT OF THE TITLE (§73). Both are real
        // columns now — 0054 added cohorts.year_group, and this comment used to
        // say it did not exist. It stayed null here for so long that the Year 10
        // and Year 11 entries in the level filter matched nothing: matchesFilters
        // checks `ev.yearGroup !== f.level`, against a value hardcoded to null,
        // so two of the four levels were silently dead options.
        qualification: s.cohort.qualification,
        yearGroup: levelForYearGroup(s.cohort.yearGroup),
        cohortSlug: s.cohort.slug,
        teacherName: null,
        cancelledReason: s.cancelledReason,
        kind: s.kind,
        cohort: s.cohort,
      });
    }
  }

  // ── bookable 1-to-1 slots ─────────────────────────────────────────────────
  if (wantPrivate) {
    const open = await loadOpenSlots({
      from: q.from, to: q.to,
      now: new Date(),
      subject: q.subject ?? undefined,
    });
    if (open.reason) refusals.push(`slots: ${open.reason}`);

    /**
     * ⚠ A SLOT IS ONLY "BOOKABLE" IF SOMEONE COULD ACTUALLY PAY FOR IT.
     * Three conditions, all required: Stripe has keys, a package exists with a
     * real Stripe price, and the slot is open. Missing any one and the chip
     * renders "Booking opens soon" instead of Book — never a disabled button,
     * which reads as "full" rather than "not open yet" (§64, §98).
     */
    const sellable = open.packages.filter((p) => p.stripePriceId !== null);
    const cheapest = sellable.length > 0
      ? sellable.reduce((a, b) => (a.priceMinor / a.credits <= b.priceMinor / b.credits ? a : b))
      : null;
    const bookable = payable && cheapest !== null;

    for (const slot of open.slots) {
      events.push({
        key: `p:${slot.key}`,
        type: "private_open",
        status: "scheduled",
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        title: slot.subject ? `1-to-1 ${cap(slot.subject)}` : "1-to-1 tuition",
        subject: slot.subject,
        qualification: null,
        yearGroup: null,
        cohortSlug: null,
        teacherName: null,
        cancelledReason: null,
        /** Not a cohort session — no session kind applies. */
        kind: null,
        priceMinor: cheapest ? Math.round(cheapest.priceMinor / cheapest.credits) : null,
        currency: cheapest?.currency ?? null,
        bookable,
      });
    }
  }

  // ── unavailability, as rows ───────────────────────────────────────────────
  /**
   * ⚠ BLOCKS ARE READ, NEVER DERIVED. §3 asks for prayer times to be CALCULATED
   * from a location and a date. This does not do that, and the standing guard
   * is that it must not: a computed prayer time is a claim the database cannot
   * check, it drifts through the year, and on the days it is wrong it paints
   * "unavailable" over a real bookable hour. Every block here — prayer,
   * holiday, anything — is an availability_blocks row somebody entered.
   *
   * ⚠ AND `reason` IS NOT SELECTED IN PUBLIC MODE. 0045 grants anon SELECT on
   * (id, teacher_id, starts_at, ends_at) only. Reading `reason` with the
   * service role and rendering it publicly would route around a column grant
   * that exists so a teacher's private business stays private. A public block
   * says "Unavailable" and nothing else.
   */
  if (wantPrivate) {
    /**
     * ⚠ withReason IS FALSE ON EVERY PATH THROUGH THIS READER, and that is not
     * an oversight. CalendarMode is "public" | "personal" — there is no staff
     * mode here — and 0045 withholds `reason` from anon and authenticated by
     * column grant. So no viewer this reader serves is entitled to it. The
     * parameter stays because the boundary is worth naming at the call site;
     * a staff surface that grows one later passes true and reads it legitimately.
     */
    const blocks = await loadBlocks({ from: q.from, to: q.to, withReason: false });
    if (blocks.reason) refusals.push(`blocks: ${blocks.reason}`);
    for (const b of blocks.rows) {
      events.push({
        key: `b:${b.id}`,
        type: "blocked",
        status: "scheduled",
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        title: b.reason ?? "Unavailable",
        subject: null, qualification: null, yearGroup: null,
        cohortSlug: null, teacherName: null, cancelledReason: null, kind: null,
      });
    }
  }

  // ⚠ FILTERED ONCE, AT THE END, BY A PURE FUNCTION. Level cannot be pushed
  // into loadCalendar (it has no level parameter) so doing it here keeps ONE
  // filter implementation rather than two that can disagree.
  const filtered = events.filter((e) => matchesFilters(e, q));
  filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.key.localeCompare(b.key));

  return { events: filtered, fromDatabase, reason, refusals, payable };
}

/**
 * availability_blocks in a window.
 *
 * ⚠ THE SELECT LIST IS THE PRIVACY BOUNDARY. withReason is true only for staff
 * surfaces; everywhere else the column is not even requested, so there is no
 * value in memory to leak into a payload by accident.
 */
async function loadBlocks(args: { from: string; to: string; withReason: boolean }): Promise<{
  rows: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
  reason?: string;
}> {
  /**
   * ⚠ createAdminClient() THROWS on missing env vars rather than returning
   * null, so a `if (!db)` guard would never fire and an unconfigured
   * environment would take the whole calendar down instead of degrading. The
   * failure has to become a `reason` the page can surface — the same channel
   * every other refusal on this reader uses.
   */
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (err) {
    return { rows: [], reason: err instanceof Error ? err.message : "admin client unavailable" };
  }
  const cols = args.withReason ? "id,starts_at,ends_at,reason" : "id,starts_at,ends_at";
  const res = await db
    .from("availability_blocks").select(cols)
    .lt("starts_at", `${args.to}T23:59:59Z`)
    .gt("ends_at", `${args.from}T00:00:00Z`);
  if (res.error) return { rows: [], reason: `${res.error.code}: ${res.error.message}` };
  const rows: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[] = [];
  for (const r of (res.data ?? []) as unknown as Record<string, unknown>[]) {
    const id = r.id == null ? null : String(r.id);
    const st = r.starts_at == null ? null : String(r.starts_at);
    const en = r.ends_at == null ? null : String(r.ends_at);
    // ⚠ A ROW WE CANNOT READ IS DROPPED, NEVER DEFAULTED — a block with a
    // guessed time paints "unavailable" over a real, bookable hour.
    if (!id || !st || !en) continue;
    rows.push({
      id, startsAt: new Date(st), endsAt: new Date(en),
      reason: args.withReason && r.reason != null ? String(r.reason) : null,
    });
  }
  return { rows };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The next N live events, for a compact preview (§4, §18).
 *
 * ⚠ CANCELLED LESSONS ARE NEVER "NEXT". A preview that shows a cancelled class
 * as the next lesson is worse than showing nothing, and this is the one place
 * the include-cancelled default is deliberately reversed.
 */
export function nextLive(events: readonly CalendarEvent[], now: Date, limit: number): CalendarEvent[] {
  return events
    .filter((e) => e.status === "scheduled" && e.endsAt.getTime() > now.getTime())
    .slice(0, limit);
}

/** Canonical zone, re-exported so surfaces do not re-import the schedule layer. */
export { CANONICAL_TZ };


// ============================================================================
// PERSONAL MODE
// ============================================================================

import { loadMyTuition } from "@/lib/booking/student";

/**
 * What THIS student is attending (§33, §34, §70).
 *
 * ⚠ PUBLIC AND PERSONAL ARE DIFFERENT QUESTIONS, NOT DIFFERENT CALENDARS. The
 * public reader answers "what does Ailemy offer"; this one answers "what am I
 * attending". Same event shape, same component, same day rules — so a student
 * browsing /calendar and then /profile is not learning two interfaces.
 *
 * ⚠ IT READS AS THE STUDENT, THROUGH loadMyTuition. Every row comes back via
 * the session client, so 0046's private_bookings_read_own and 0047's
 * lesson_credit_transactions_read_own are what decide visibility. A
 * service-role read filtered by user_id in application code would work
 * identically right up until the filter was wrong, and then it would hand one
 * student another's lessons. The policy is the boundary; this is not.
 */
export async function loadPersonalCalendar(range: { from: string; to: string }): Promise<{
  events: CalendarEvent[];
  signedIn: boolean;
  creditBalance: number;
  enrolledCohortSlugs: string[];
  notes: string[];
}> {
  const me = await loadMyTuition();
  if (!me.signedIn) {
    return { events: [], signedIn: false, creditBalance: 0, enrolledCohortSlugs: [], notes: me.notes };
  }

  const events: CalendarEvent[] = [];

  // ⚠ ENROLLED GROUP LESSONS ONLY. loadMyTuition resolves them from
  // cohort_enrolments, so a student who merely visited a cohort page never
  // sees its lessons here (§31).
  for (const s of me.groupSessions) {
    if (s.startsAt.toISOString().slice(0, 10) < range.from) continue;
    if (s.startsAt.toISOString().slice(0, 10) > range.to) continue;
    events.push({
      key: `g:${s.key}`,
      type: "group",
      status: s.status,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      title: s.title ?? s.cohort.title,
      subject: s.cohort.subject,
      qualification: s.cohort.qualification,
      yearGroup: null,
      cohortSlug: s.cohort.slug,
      teacherName: null,
      cancelledReason: s.cancelledReason,
      kind: s.kind,
      cohort: s.cohort,
    });
  }

  // ⚠ THE VIEWER'S OWN BOOKINGS, AND ONLY THOSE. type private_booked exists
  // solely in this mode; the public reader never produces one, so a public
  // surface cannot render another person's lesson even by mistake.
  for (const b of [...me.upcomingPrivate, ...me.pastPrivate]) {
    const day = b.startsAt.toISOString().slice(0, 10);
    if (day < range.from || day > range.to) continue;
    events.push({
      key: `b:${b.id}`,
      type: "private_booked",
      status: b.status === "cancelled" ? "cancelled" : "scheduled",
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      title: b.subject ? `1-to-1 ${b.subject}` : "1-to-1 lesson",
      subject: b.subject,
      qualification: null,
      yearGroup: null,
      cohortSlug: null,
      teacherName: null,
      cancelledReason: null,
      kind: null,
      // ⚠ 0051 IS APPLIED, so this is a real AIL- reference now. Still nullable
      // in the type: a reader that assumes it exists would break the page for
      // any row written before the backfill, and `null` renders as an omitted
      // line rather than an invented code support cannot look up.
      bookingRef: b.bookingRef,
      bookingId: b.id,
    });
  }

  events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.key.localeCompare(b.key));

  return {
    events,
    signedIn: true,
    creditBalance: me.creditBalance,
    enrolledCohortSlugs: me.enrolledCohortSlugs,
    notes: me.notes,
  };
}
