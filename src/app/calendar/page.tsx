import { loadCapacity, type Capacity } from "@/lib/public/capacity";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Calendar } from "@/components/calendar/Calendar";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { dayKeyOf, parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { loadCalendarEvents } from "@/lib/calendar/readers";
import { CalendarShortcuts } from "@/components/calendar/CalendarShortcuts";
import { levelLabel } from "@/lib/calendar/types";
import { nextSession } from "@/lib/calendar/next-session";
import { SUBJECTS } from "@/lib/public/catalogue";
import { CANONICAL_TZ, calendarDate, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * The Ailemy calendar (§5, §9, §10).
 *
 * ⚠ THIS PAGE HOLDS NO SCHEDULE LOGIC OF ITS OWN. It reads the URL, asks for a
 * bounded range, and hands the result to the shared component. Every other
 * calendar surface does the same, which is what stops six pages drifting apart
 * (§2).
 *
 * ⚠ THE RANGE COMES FROM THE VIEW, NOT FROM A CONSTANT (§60). Month fetches the
 * visible grid including its leading and trailing days; week fetches seven
 * days; upcoming fetches its rolling window. The page never asks for a year.
 *
 * ⚠ "TODAY" IS A DOHA TODAY. Deriving it from the server's clock in the
 * server's zone would put the Today marker on the wrong square for part of
 * every day. calendarDate() resolves it in the canonical zone, matching the
 * rule the grid buckets by.
 */
export const metadata: Metadata = {
  title: "Calendar — Ailemy",
  description:
    "Every published Ailemy lesson: live group tuition by subject and qualification, and genuine 1-to-1 availability. Times in Doha and your own timezone.",
};

export const dynamic = "force-dynamic";

type Search = Promise<{
  view?: string; date?: string; subject?: string; level?: string; type?: string; day?: string;
}>;

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const session = await getNavSession();
  const params = await searchParams;
  const viewerTz = await viewerTimeZone();

  const todayISO = calendarDate(new Date(), CANONICAL_TZ);

  /**
   * ⚠ §58 WANTS UPCOMING BY DEFAULT ON A PHONE, AND THE SERVER CANNOT MEASURE A
   * VIEWPORT. The two alternatives were worse: a client component would flash
   * the wrong view before hydrating, and rendering both behind CSS breakpoints
   * would double the DOM and undo §60's range fetching.
   *
   * A coarse user-agent test decides a DEFAULT only. It is overridable with one
   * tap, it is reflected in the URL, and being wrong costs a student one click —
   * which is the right price for not shipping a hydration flash on the most
   * time-sensitive content on the site.
   */
  const ua = (await headers()).get("user-agent") ?? "";
  const handheld = /Android|iPhone|iPod|Windows Phone|\bMobi\b/i.test(ua) && !/iPad|Tablet/i.test(ua);

  const state = readState(params, todayISO, handheld ? "upcoming" : "month");
  const openDay = params.day && parseDate(params.day) ? params.day : null;

  const range = rangeFor(state.view, state.date);
  const { events, fromDatabase, reason, refusals } = await loadCalendarEvents({
    from: range.from, to: range.to,
    mode: "public",
    subject: state.subject,
    level: state.level,
    type: state.type,
    availableOnly: state.availableOnly,
  });

  const subjectName = SUBJECTS.find((s) => s.slug === state.subject)?.name ?? null;
  const level = levelLabel(state.level);

  /**
   * ⚠ ONE RPC PER COHORT VISIBLE IN THE WINDOW, NOT PER EVENT. A month of
   * twice-weekly lessons is eight or nine events for ONE cohort; keying the
   * lookup by slug first means one call, not nine.
   *
   * ⚠ AND ONLY FOR COHORTS THAT ARE ACTUALLY ON SCREEN. Fetching capacity for
   * the whole catalogue would be work whose result nothing renders.
   */
  /**
   * ⚠ §40/§41 — WHERE "jump to the first teaching week" GOES. Resolved from
   * real sessions in a bounded forward window, exactly like the homepage
   * banner: 120 days reaches the next teaching block without downloading a
   * year, and nothing found means no link rather than a link to nowhere.
   *
   * ⚠ ONLY FETCHED WHEN THE CURRENT WINDOW IS EMPTY. A populated month has no
   * empty state to put the link in, so the round trip would be discarded.
   */
  const AHEAD_DAYS = 120;
  const { events: aheadEvents } = events.length === 0
    ? await loadCalendarEvents({
        from: todayISO,
        to: calendarDate(new Date(Date.now() + AHEAD_DAYS * 86_400_000), CANONICAL_TZ),
        mode: "public", subject: state.subject, level: state.level, type: state.type,
      })
    : { events: [] as typeof events };
  const jump = nextSession(aheadEvents, new Date(), dayKeyOf, todayISO);
  const jumpLabel = jump.kind === "session"
    ? formatDay(jump.event.startsAt, CANONICAL_TZ)
    : "";

  const visibleCohorts = new Map<string, number>();
  for (const ev of events) {
    if (ev.type !== "group" || !ev.cohortSlug || !ev.cohort) continue;
    visibleCohorts.set(ev.cohortSlug, ev.cohort.seatCap);
  }
  const capacityBySlug = new Map<string, Capacity>();
  await Promise.all(
    [...visibleCohorts].map(async ([slug, cap]) => {
      capacityBySlug.set(slug, await loadCapacity(slug, cap));
    }),
  );


  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mb-8">
          {/* ⚠ §47 — CALENDAR IS PART OF ONLINE TUITION, AND NOW SAYS SO. It
              lost its permanent header slot because it is a tuition feature,
              not a fifth product; without a way back it would read as
              orphaned instead of relocated. The route itself is unchanged —
              bookmarks, deep links and every existing CTA still land here. */}
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
            <Link
              href="/tuition"
              className="underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Online Tuition
            </Link>
            <span aria-hidden> / </span>
            <span className="text-ink/70">Calendar</span>
          </p>
          {/* ⚠ §7 — THE HEADING NAMES THE TASK, NOT THE ARTEFACT. "Calendar"
              describes the widget; a student arrives wanting a lesson, and the
              breadcrumb above already carries the word Calendar for anyone
              orienting themselves. The route, the bookmark and the nav label
              are all unchanged (§41, §59) — only the on-page heading moves
              from naming the tool to naming what it is for. */}
          <h1 className="font-display mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            Find a lesson.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
            See upcoming group tuition, or choose an available 1-to-1 time.
          </p>
          {/* ⚠ "genuinely bookable" WAS THE WRONG WORD FOR A TRUE FACT. The
              1-to-1 times here are genuinely OPEN — loadOpenSlots subtracts
              blocks, group lessons, confirmed bookings and live holds, so the
              claim this page really makes is a strong one and worth keeping.
              What it cannot claim is that they can be booked: there is no
              booking control on this page, DayPanel's private branch says
              "Booking opens soon", and CHECKOUT_BUILT is false. One adjective
              turned an honest availability claim into a broken promise.

              ⚠ THE SECOND SENTENCE IS UNTOUCHED AND STILL TRUE — it is the
              whole point of the page, and the third now says what to do about
              it rather than leaving a visitor to hunt for the button.

              ⚠ AND THE THIRD SENTENCE IS SCOPED TO THIS PAGE. It first read
              "Booking is not open yet", which overcorrects into a second
              untruth: a signed-in student holding a lesson credit can book a
              1-to-1 time today — canRedeem() never consults Stripe, and
              bookWithCredit() re-resolves the slot and writes a confirmed
              private_booking with no payment at all. The homepage FAQ already
              says so ("Booking is arranged directly at the moment"), so the
              flat claim also put two surfaces at odds. Telling the customer who
              has ALREADY paid that booking is shut is the more expensive
              falsehood of the two. What holds for every reader is that this
              calendar has no booking control on it. */}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
            Every published lesson, and every 1-to-1 time that is genuinely open. Nothing here
            is scheduled that is not really happening. You cannot book from the calendar yet —
            open a day to register your interest in a time.
          </p>
        </header>

        {/* ── §12/§13 — WHAT IS NEAREST, BEFORE THE GRID ───────────────────
            A student asking "when can I go to something?" should not have to
            read a month to find out. These two answer it in one line each,
            from the events this page has already loaded — no extra query, and
            nothing they can say that the grid below could contradict. */}
        <div className="mt-8">
          <CalendarShortcuts
            /* ⚠ THE SHORTCUTS LOOK PAST THE VISIBLE WINDOW, AND THE FIRST
               VERSION DID NOT. Fed `events`, "Next group lesson" rendered
               nothing all through August — August's month grid holds no
               sessions, teaching starts on 13 September, and a shortcut scoped
               to the window can only repeat what the window already shows. A
               shortcut that disappears exactly when a student needs it is not
               a shortcut. Caught on production, not by a test: every local
               check happened to run on a month that had sessions.

               `aheadEvents` is the 120-day forward read this page already
               performs when the window is empty, so this costs no extra
               query. */
            events={events.length > 0 ? events : aheadEvents}
            viewerTz={viewerTz}
            now={new Date()}
            groupHref={(dayISO) => `/calendar?date=${dayISO}&day=${dayISO}`}
            oneToOneHref="/tuition/one-to-one"
          />
        </div>

        <Calendar
          events={events}
          state={state}
          todayISO={todayISO}
          viewerTz={viewerTz}
          mode="public"
          basePath="/calendar"
          openDay={openDay}
          emptyMessage={emptyFor(subjectName, level)}
          capacityBySlug={capacityBySlug}
          jumpToISO={jump.kind === "session" ? jump.dateISO : null}
          jumpToLabel={jump.kind === "session" ? `Jump to ${jumpLabel}` : null}
        />

        {/* ⚠ THE EMPTY STATE OFFERS THE ONE HONEST NEXT STEP (§12, §57) — never
            an invented session, never "coming soon" implying a date exists. */}
        {events.length === 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {state.subject && (
              <Link
                href={`/tuition/interest?subject=${state.subject}`}
                className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-ink/40"
              >
                Register interest →
              </Link>
            )}
            <Link
              href="/tuition"
              className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-ink/40"
            >
              See live tuition →
            </Link>
          </div>
        )}

        {/* Dev-only diagnostics. A visitor is never told which source a page
            used; an operator debugging one needs to know. */}
        {process.env.NODE_ENV !== "production" && (!fromDatabase || refusals.length > 0) && (
          <p className="mt-10 font-mono text-[11px] text-ink/40">
            {!fromDatabase && <>schedule source: fallback{reason ? ` (${reason})` : ""}. </>}
            {refusals.length > 0 && <>{refusals.length} row(s) refused: {refusals.slice(0, 2).join("; ")}</>}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Says what is actually empty, rather than a generic "no events". */
function emptyFor(subject: string | null, level: string | null): string {
  const what = [level, subject].filter(Boolean).join(" ");
  if (what) {
    return `No ${what} lessons are scheduled in this period. The timetable for this group has not been published yet.`;
  }
  return "No lessons are scheduled in this period. Try another month, or see what is opening.";
}
