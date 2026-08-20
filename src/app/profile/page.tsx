import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Calendar } from "@/components/calendar/Calendar";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { loadPersonalCalendar, nextLive } from "@/lib/calendar/readers";
import { loadMyTuition } from "@/lib/booking/student";
import { planCancellation, explainCancellation } from "@/lib/booking/cancellation";
import { BookingActions, type CancelMode } from "@/components/booking/BookingActions";
import { ScheduleUpdates, type UpdateRow } from "@/components/booking/ScheduleUpdates";
import { loadInbox } from "@/lib/booking/inbox";
import { describeNotification } from "@/lib/booking/notify-copy";
import { CANONICAL_TZ, calendarDate, currentTimeIn, dualTime, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

import { EventChip } from "@/components/calendar/EventChip";

/**
 * The student profile (§29–§37, §77).
 *
 * ============================================================================
 * ⚠ MY CALENDAR IS THE SAME CALENDAR, IN PERSONAL MODE (§34)
 * ============================================================================
 * Not a cut-down student view — the identical component, with the identical
 * month/week/upcoming behaviour, day panel, timezone handling and visual
 * language. §34 is explicit that a separate Student Calendar would be the wrong
 * answer, and the difference between the two is one prop and one reader.
 *
 * ⚠ WHAT DIFFERS IS THE QUESTION, NOT THE INTERFACE (§70). The public calendar
 * answers "what does Ailemy offer"; this answers "what am I attending". A
 * signed-in student can still browse /calendar, and it still shows them the
 * school's schedule rather than their own.
 *
 * ⚠ NO ADMIN AFFORDANCES. Cancelling, rescheduling and refunding are admin acts
 * with their own authorisation. This page shows a student what they have and
 * where to go next; nothing on it can change a booking.
 */
export const metadata: Metadata = {
  title: "My profile — Ailemy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Search = Promise<{
  view?: string; date?: string; subject?: string; level?: string; type?: string; day?: string;
}>;

export default async function ProfilePage({ searchParams }: { searchParams: Search }) {
  const session = await getNavSession();
  const params = await searchParams;
  const viewerTz = await viewerTimeZone();

  const todayISO = calendarDate(new Date(), CANONICAL_TZ);
  const ua = (await headers()).get("user-agent") ?? "";
  const handheld = /Android|iPhone|iPod|Windows Phone|\bMobi\b/i.test(ua) && !/iPad|Tablet/i.test(ua);
  const state = readState(params, todayISO, handheld ? "upcoming" : "month");
  const openDay = params.day && parseDate(params.day) ? params.day : null;

  const range = rangeFor(state.view, state.date);
  const [me, personal, inbox] = await Promise.all([
    loadMyTuition(),
    loadPersonalCalendar(range),
    loadInbox(),
  ]);

  // The proxy gates /profile too, but a layout-free route must not rely on it.
  if (!personal.signedIn) redirect("/login?next=/profile");

  const now = new Date();
  const upcoming = nextLive(personal.events, now, 6);
  const next = upcoming[0] ?? null;

  /**
   * ⚠ ONE PLANNER CALL PER BOOKING, SERVER-SIDE, FROM THE ROW loadMyTuition
   * ALREADY READ. No extra query, and no second copy of the cutoff.
   *
   * ⚠ viewerId IS THE SESSION'S OWN ID. loadMyTuition read these rows through
   * 0046's own-row policy, so they are already this student's — passing the
   * same id back makes planCancellation's ownership branch a belt on top of a
   * brace rather than the only check.
   */
  const byId = new Map(
    [...me.upcomingPrivate, ...me.pastPrivate].map((b) => [b.id, b] as const),
  );
  const viewerId = me.userId;
  const cancelModeFor = (bookingId: string): CancelMode => {
    const b = byId.get(bookingId);
    if (!b || viewerId === null) {
      return { kind: "none", explanation: "Contact us about this lesson." };
    }
    const outcome = planCancellation({
      booking: {
        id: b.id, userId: viewerId, startsAt: b.startsAt,
        status: b.status, paidWith: b.paidWith,
      },
      viewerId, now,
    });
    if (outcome.ok) return { kind: "cancel" };
    if (outcome.action === "request") {
      return { kind: "request", explanation: explainCancellation(outcome) };
    }
    return { kind: "none", explanation: explainCancellation(outcome) };
  };

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        {/* ── identity (§30) ─────────────────────────────────────────────── */}
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">Your account</p>
          <h1 className="font-display mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {me.email ?? "My profile"}
          </h1>
          {/* ⚠ THE CLOCK BESIDE THE ZONE IS THE CHECK. A zone NAME cannot be
              verified by reading it — "Asia/Qatar" and "America/Anchorage" look
              equally plausible — but the time in it can be, at a glance, by the
              one person who knows what time it is where they are. Cross-client
              finding: ICU accepts bare abbreviations and resolves them
              elsewhere, so a wrong zone is otherwise completely silent. */}
          <p className="mt-2 text-sm text-ink/60">
            {me.email}
            {" · "}
            <span className="font-mono text-[11px]">
              {viewerTz ?? CANONICAL_TZ}
            </span>
            {(() => {
              const local = currentTimeIn(viewerTz ?? CANONICAL_TZ);
              return local ? (
                <span className="font-mono text-[11px] text-ink/45"> · {local} there now</span>
              ) : null;
            })()}
          </p>
          {/* ⚠ §21 — THE ZONE IS NAMED, AND CHANGEABLE. Silent conversion is how
              a student turns up an hour late. profiles.timezone exists (0017) and
              carries a column-level UPDATE grant (0018); the editor is the next
              slice, so for now the detected zone is shown and stated rather than
              implied. */}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
            All times shown in Doha and your local zone
          </p>
        </header>

        {me.notes.length > 0 && (
          <ul className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {me.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}

        {/* ── at a glance ────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Enrolled cohorts" value={String(personal.enrolledCohortSlugs.length)}
            hint={personal.enrolledCohortSlugs.length === 0 ? "Not enrolled yet" : undefined}
            href="/tuition" hrefLabel={personal.enrolledCohortSlugs.length === 0 ? "See tuition →" : undefined} />
          <Stat
            label="Lesson credits"
            value={String(personal.creditBalance)}
            hint={personal.creditBalance === 0 ? "No private lessons bought" : "private lessons remaining"}
            href="/tuition/one-to-one"
            hrefLabel={personal.creditBalance === 0 ? "See 1-to-1 →" : "Book a lesson →"}
          />
          <Stat
            label="Next lesson"
            value={next ? formatDay(next.startsAt, CANONICAL_TZ) : "—"}
            hint={next ? dualTime(next.startsAt, viewerTz).canonical + " Doha" : "Nothing scheduled"}
          />
        </div>

        {/* ── my calendar (§33, §34) ─────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight">My calendar</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
            Only your enrolled cohorts and your own confirmed bookings. Browse forward and back
            exactly as on the public calendar.
          </p>
          <div className="mt-6">
            <Calendar
              events={personal.events}
              state={state}
              todayISO={todayISO}
              viewerTz={viewerTz}
              mode="personal"
              basePath="/profile"
              openDay={openDay}
              emptyMessage={
                personal.enrolledCohortSlugs.length === 0
                  ? "You are not enrolled on a cohort and have no private bookings in this period."
                  : "No lessons in this period for your cohorts."
              }
            />
          </div>
        </section>

        {/* ── lesson credits (§33, §61) ───────────────────────────────────
            ⚠ PORTED FROM /my-tuition, WHICH NOW REDIRECTS HERE. The tile above
            shows the balance; this shows how it got there. A student querying a
            balance needs the lines, not a number to take on trust — and the
            balance is SUMMED from these rows, never read from a column, so the
            lines ARE the balance rather than a second record of it. */}
        {me.ledger.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-medium tracking-tight">Lesson credits</h2>
            <p className="mt-2 text-sm text-ink/65">
              {me.creditBalance} {me.creditBalance === 1 ? "lesson" : "lessons"} remaining, and every
              change that got you there.
            </p>
            <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10 font-mono text-[11px]">
              {me.ledger.slice(0, 12).map((tx) => (
                <li key={tx.id} className="flex items-baseline gap-4 py-2.5">
                  {/* ⚠ SIGN, NOT COLOUR ALONE — the +/- carries it in greyscale. */}
                  <span className={`w-8 shrink-0 tabular-nums ${tx.delta > 0 ? "text-emerald-700" : "text-ink/60"}`}>
                    {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                  </span>
                  <span className="flex-1 text-ink/70">{tx.reason.replace(/_/g, " ")}</span>
                  <span className="text-ink/45">{tx.createdAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
            {me.ledger.length > 12 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                showing 12 of {me.ledger.length}
              </p>
            )}
          </section>
        )}

        {/* ── schedule updates (§47) ──────────────────────────────────────
            ⚠ ABOVE the lesson lists on purpose. This is where "your Saturday
            moved" appears, and a student who scrolls past it to read a
            timetable has been told the change by the timetable instead — which
            is the moment the panel was supposed to prevent. */}
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">Schedule updates</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
              What we have told you
            </p>
          </div>
          <div className="mt-5">
            <ScheduleUpdates
              note={inbox.note}
              rows={inbox.items.map((i): UpdateRow => {
                // ⚠ RENDERED SERVER-SIDE, from stored FACTS. The wording lives
                // in one file, so fixing it re-renders every message already
                // sitting in somebody's panel.
                const copy = describeNotification(i.kind, i.payload, viewerTz);
                return {
                  id: i.deliveryId,
                  title: copy.title,
                  detail: copy.detail,
                  when: formatDay(i.createdAt, CANONICAL_TZ),
                  unread: i.readAt === null,
                };
              })}
            />
          </div>
        </section>

        {/* ── upcoming lessons (§36, §37) ────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight">Upcoming lessons</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Nothing scheduled.{" "}
              <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
                See live tuition
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
              {upcoming.map((ev) => (
                <li key={ev.key} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-3.5">
                  <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                    {formatDay(ev.startsAt, CANONICAL_TZ)}
                  </span>
                  <span className="min-w-0 flex-1"><EventChip event={ev} viewerTz={viewerTz} /></span>
                  {/* ⚠ A GROUP LESSON IS NOT CANCELLABLE AT ALL (§38). One seat
                      in a class of twenty is a withdrawal, and that is a
                      conversation — so a group chip keeps Contact and only a
                      private booking gets the lifecycle controls. */}
                  {ev.type === "private_booked" && ev.bookingId ? (
                    <BookingActions
                      bookingId={ev.bookingId ?? ""}
                      mode={cancelModeFor(ev.bookingId ?? "")}
                      label={`${ev.title} on ${formatDay(ev.startsAt, CANONICAL_TZ)}`}
                    />
                  ) : (
                    <Link
                      href={`/tuition/interest?mode=contact&about=${encodeURIComponent(ev.title)}`}
                      className="shrink-0 text-xs underline underline-offset-2 text-ink/55 hover:text-ink"
                    >
                      Contact
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── past lessons (§43) ─────────────────────────────────────────── */}
        {me.pastPrivate.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-medium tracking-tight">Past lessons</h2>
            <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10 text-sm">
              {me.pastPrivate.slice(0, 10).map((b) => (
                <li key={b.id} className="flex items-baseline gap-4 py-2.5 text-ink/60">
                  <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em]">
                    {formatDay(b.startsAt, CANONICAL_TZ)}
                  </span>
                  <span className="flex-1">{b.subject ?? "1-to-1"}</span>
                  {/* ⚠ THE REFERENCE IS SHOWN WHERE A SUPPORT CONVERSATION
                      STARTS. A past lesson is the one a family emails about,
                      and a code they can read aloud beats "the Tuesday one".
                      Omitted, not faked, when the row predates 0051. */}
                  {b.bookingRef && (
                    <span className="font-mono text-[10px] tracking-wider text-ink/45">{b.bookingRef}</span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider">{b.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-sm text-ink/60">
          <Link href="/calendar" className="underline underline-offset-2 hover:text-ink">
            Browse the full Ailemy calendar →
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({
  label, value, hint, href, hrefLabel,
}: {
  label: string; value: string; hint?: string; href?: string; hrefLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-snow p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">{label}</p>
      <p className="font-display mt-2 text-2xl">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      {href && hrefLabel && (
        <Link href={href} className="mt-3 inline-block text-sm underline underline-offset-2 hover:text-ink">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}
