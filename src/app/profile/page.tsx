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
import { CANONICAL_TZ, calendarDate, dualTime, formatDay } from "@/lib/schedule/timezone";
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
  const [me, personal] = await Promise.all([
    loadMyTuition(),
    loadPersonalCalendar(range),
  ]);

  // The proxy gates /profile too, but a layout-free route must not rely on it.
  if (!personal.signedIn) redirect("/login?next=/profile");

  const upcoming = nextLive(personal.events, new Date(), 6);
  const next = upcoming[0] ?? null;

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
          <p className="mt-2 text-sm text-ink/60">
            {me.email}
            {" · "}
            <span className="font-mono text-[11px]">
              {viewerTz ?? CANONICAL_TZ}
            </span>
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
                  {/* ⚠ CONTACT, NOT CANCEL (§38, §42). A student may not cancel
                      a group class at all, and self-service private cancellation
                      needs a policy cutoff and a credit-restore path that are
                      schema-blocked. An honest Contact beats a button that
                      cannot keep its promise. */}
                  <Link
                    href={`/tuition/interest?mode=contact&about=${encodeURIComponent(ev.title)}`}
                    className="shrink-0 text-xs underline underline-offset-2 text-ink/55 hover:text-ink"
                  >
                    Contact
                  </Link>
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
