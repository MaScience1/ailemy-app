import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { loadCohorts } from "@/lib/public/readers";
import { availabilityFor, availabilityLabel } from "@/lib/tuition/availability";
import { TuitionModes, isTuitionMode, type TuitionMode } from "@/components/tuition/TuitionModes";
import { DISCOUNTS, type Commitment } from "@/lib/tuition/pricing";

/** Pure so the suite can check it: an unknown commitment falls back, never throws. */
function isCommitment(v: string | undefined): v is Commitment {
  return !!v && Object.prototype.hasOwnProperty.call(DISCOUNTS, v);
}
import { offersCurrencyChoice } from "@/lib/public/currency";
import { currentCurrency } from "@/lib/public/currency-server";
import { CohortPrice } from "@/components/public/CohortPrice";
import { CurrencyToggle } from "@/components/public/CurrencyToggle";
import { Calendar } from "@/components/calendar/Calendar";
import { parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { loadCalendarEvents } from "@/lib/calendar/readers";
import { loadCapacity } from "@/lib/public/capacity";
import { nextSession } from "@/lib/calendar/next-session";
import { dayKeyOf } from "@/lib/calendar/grid";
import { nextAvailableSlot } from "@/lib/booking/next-available";
import { nextOf } from "@/lib/calendar/upcoming";
import type { Capacity } from "@/lib/public/capacity-rules";
import { TimezoneSync } from "@/components/public/TimezoneSync";

import { viewerTimeZone } from "@/lib/schedule/viewer-tz";
import { CANONICAL_TZ, calendarDate } from "@/lib/schedule/timezone";

/**
 * The tuition destination (§23).
 *
 * ⚠ IT EXISTS BECAUSE THE HOMEPAGE LINKS TO IT. Shipping a "Join live tuition"
 * button that 404s is the dead CTA §32 forbids, and a route that exists only in
 * a later stage is a dead CTA today.
 *
 * Cohort data comes from the catalogue layer — one source of truth, so a price
 * cannot differ between this page and the homepage.
 */
export const metadata: Metadata = {
  title: "Live tuition — Ailemy",
  description:
    "Small-group science tuition built around the exact specification and exam requirements. " +
    "Edexcel IAL Chemistry AS, and GCSE / International GCSE Chemistry.",
};

type Search = Promise<{
  view?: string; date?: string; subject?: string; level?: string; type?: string; day?: string;
  mode?: string; commitment?: string;
}>;

export default async function TuitionPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const session = await getNavSession();
  /**
   * ⚠ source AND reason ARE KEPT, NOT DISCARDED — THAT DISCARD COST A DAY.
   * This line read `const { data: cohorts } = await loadCohorts()`, throwing
   * away the only record of whether the page had read the database or fallen
   * back to the in-code catalogue. When Year 11 and Year 10 rendered "the
   * academic programme dates for this cohort are not published yet", nothing
   * on the page, in the HTML or in any header could say which path produced
   * it — so the same symptom had two possible causes and no way to separate
   * them.
   */
  const { data: cohorts, source: cohortSource, reason: cohortReason, refusals: cohortRefusals }
    = await loadCohorts();
  const { currency } = await currentCurrency();
  const viewerTz = await viewerTimeZone();

  /**
   * ⚠ THE SAME CALENDAR AS /calendar, NOT A SECOND ONE (§2, §85). This page
   * used a flat SessionList over its own 56-day window; it now reads the URL
   * and renders the shared component, so a schedule change lands here and on
   * /calendar in the same breath rather than in two places that can drift.
   */
  const todayISO = calendarDate(new Date(), CANONICAL_TZ);
  const state = readState(params, todayISO, "upcoming");
  const openDay = params.day && parseDate(params.day) ? params.day : null;
  const range = rangeFor(state.view, state.date);
  /**
   * ⚠ §34 — THE PRODUCT CHOSEN AT THE TOP DRIVES THE CALENDAR BELOW IT.
   * A visitor who picked 1-to-1 should not have to scan group lessons to find
   * a time, and vice versa. The mode maps onto the calendar's EXISTING type
   * filter — the same one /calendar's chips set — so this is one calendar
   * being asked a narrower question, not a second instance (§9, §27).
   *
   * ⚠ AND IT IS AN INITIAL VALUE, NOT A LOCK. An explicit ?type= in the URL
   * still wins, so the student can widen the filter from inside the calendar
   * exactly as §34 asks.
   */
  const mode: TuitionMode = isTuitionMode(params.mode) ? params.mode : "group";
  const commitment: Commitment = isCommitment(params.commitment) ? params.commitment : "monthly";
  const calendarType = params.type
    ? state.type
    : mode === "one-to-one" ? "private" as const : "group" as const;

  /**
   * ⚠ §25/§10 — CAPACITY COMES FROM cohort_seats_taken AND NOWHERE ELSE.
   * loadCapacity calls the SECURITY DEFINER RPC (0063); cohort_enrolments is
   * PII that no client may SELECT, so a row count here would need a grant that
   * must not exist. When the RPC is absent it returns known:false and the card
   * shows the seat cap alone — silence rather than an invented number.
   */
  const capacityBySlug = new Map<string, Capacity>();
  await Promise.all(
    cohorts.map(async (c) => {
      capacityBySlug.set(c.slug, await loadCapacity(c.slug, c.seatCap));
    }),
  );

  /**
   * Every link on this page keeps the reader where they are. Mode, commitment,
   * currency and the calendar's own filters all live in the query string, so a
   * control that dropped the others would silently reset the page around it.
   */
  const qs = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) {
      if (typeof v === "string" && v) q.set(k, v);
    }
    const str = q.toString();
    return str ? `/tuition?${str}` : "/tuition";
  };

  const { events } = await loadCalendarEvents({
    from: range.from, to: range.to, mode: "public",
    subject: state.subject, level: state.level, type: calendarType,
    availableOnly: state.availableOnly,
  });

  /**
   * ⚠ §9 OF THE HEADER — THE §50 EMPTY-MONTH PANEL MUST SURVIVE HERE TOO.
   * /calendar and the homepage modal both feed the calendar a real next
   * lesson so an empty month can name it and offer a jump. This page did not,
   * so switching to Month in August would have shown the panel with no way
   * forward — the third door disagreeing with the other two.
   *
   * ⚠ ONLY WHEN THE WINDOW IS EMPTY, so a populated period costs nothing.
   */
  const { events: aheadEvents } = events.length === 0
    ? await loadCalendarEvents({
        from: todayISO,
        to: calendarDate(new Date(Date.now() + 120 * 86_400_000), CANONICAL_TZ),
        mode: "public", subject: state.subject, level: state.level, type: calendarType,
      })
    : { events: [] as typeof events };
  const ahead = nextSession(aheadEvents, new Date(), dayKeyOf, todayISO);

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />
      {/*
        ⚠ A DATA ATTRIBUTE, RENDERED IN PRODUCTION — AND THAT IS THE POINT.
        /calendar has the same diagnostic but gates it on NODE_ENV !==
        "production", so it is dark in the one environment where this question
        actually got asked. A visitor must never be shown internal plumbing,
        but "invisible to a reader" and "absent from the response" are not the
        same thing: an attribute is silent on screen and one grep away for an
        operator.

          curl -s https://…/tuition | grep -o 'data-cohort-source="[a-z]*"'

        ⚠ IT CARRIES NO DETAIL A VISITOR COULD NOT ALREADY SEE. The reason
        string is a class of failure — "supabase env vars absent", a PostgREST
        code — never a credential, a row or a person.
      */}
      <main
        className="mx-auto max-w-6xl px-6 py-14 sm:py-20"
        data-cohort-source={cohortSource}
        data-cohort-reason={cohortReason ?? undefined}
        data-cohort-refusals={cohortRefusals.length > 0 ? String(cohortRefusals.length) : undefined}
      >
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Learn live with Ailemy
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          Small-group science tuition built around the exact specification and exam
          requirements — with the Ailemy platform, marked practice and progress tracking
          included.
        </p>

        {offersCurrencyChoice(cohorts) && (
          <div className="mt-8"><CurrencyToggle current={currency} /></div>
        )}

        {/* ── §1/§37 — ONE PRODUCT AT A TIME ──────────────────────────────
            The three cohort cards that used to open this page are now inside
            Group mode, priced by commitment. Nothing was removed: every cohort
            still renders, with the same schedule, hours and capacity. */}
        <div className="mt-8">
          <TuitionModes
            mode={mode}
            commitment={commitment}
            currency={currency}
            cohorts={cohorts}
            capacityBySlug={capacityBySlug}
            hrefForMode={(m) => qs({ mode: m })}
            hrefForCommitment={(c) => qs({ mode, commitment: c })}
          />
        </div>

        {/* ⚠ THE THREE COHORT CARDS THAT USED TO SIT HERE ARE NOW INSIDE
            GROUP MODE ABOVE (§1, §22, §37). Nothing was dropped: every cohort
            still renders with its schedule, hours and capacity — but priced by
            the commitment the reader chose, instead of three cards each
            repeating a monthly figure with no way to compare terms. */}

        <section className="mt-14 border-t border-ink/10 pt-10">
          {/* §27/§34 — the heading follows the chosen product, and the
              calendar below it is already filtered to match. */}
          <h2 className="font-display text-xl font-medium">
            {mode === "one-to-one" ? "Choose your time" : "See upcoming lessons"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            {mode === "one-to-one"
              ? "Published 1-to-1 availability. Times in Doha, and in your own timezone where we know it."
              : "Every scheduled session across the live cohorts. Times in Doha, and in your own timezone where we know it."}
          </p>
          <div className="mt-6">
            <Calendar
              events={events}
              state={state}
              todayISO={todayISO}
              viewerTz={viewerTz}
              mode="public"
              basePath="/tuition"
              openDay={openDay}
              /* §59 — the 1-to-1 empty state says what is absent, and offers
                 the interest route rather than an empty grid with no note.
                 §66: there are no rows in teacher_availability, so this is
                 what a visitor in 1-to-1 mode sees today. */
              emptyMessage={mode === "one-to-one"
                ? "No 1-to-1 times are published for this period yet. Register for the next available slot and we will contact you with times."
                : "No timetable has been published for this period. The programmes above show what is opening; register interest and we will tell you the dates as soon as they are set."}
              nextGroupAhead={ahead.kind === "session" ? { event: ahead.event, dateISO: ahead.dateISO } : null}
              nextPrivateAhead={nextAvailableSlot(aheadEvents.length > 0 ? aheadEvents : events, { now: new Date() })}
            />
          </div>
          <Link href="/calendar" className="mt-6 inline-block text-sm underline underline-offset-2 hover:text-ink">
            Full calendar →
          </Link>
        </section>

        {/* ⚠ INTENSIVE LIVES HERE NOW (§4). It was a top-level nav entry — a
            single campaign holding a slot next to three whole sciences. The
            ROUTE is untouched and still reachable; only its prominence changed,
            because demoting a nav entry and breaking a shared link are
            different acts. */}
        <section className="mt-14 border-t border-ink/10 pt-10">
          <h2 className="font-display text-xl font-medium">Intensive programmes</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            Short, high-intensity courses run ahead of an exam series, separately from the
            termly cohorts above.{" "}
            <Link href="/intensive" className="underline underline-offset-2">
              See the current intensive →
            </Link>
          </p>
        </section>

        {/* ── §30 — TUITION BY SUBJECT, DERIVED ─────────────────────────
            ⚠ NOTHING HERE IS TYPED. Each row asks availabilityFor() against
            the cohorts this page already loaded, so a subject's line changes
            when the data changes and not when someone remembers to edit it.
            Today that yields "Register interest" for Chemistry — three real,
            dated cohorts with no payment link yet — and "Not running yet" for
            Biology and Physics, which have no cohort at all. */}
        <section className="mt-14 border-t border-ink/10 pt-10" aria-labelledby="by-subject">
          <h2 id="by-subject" className="font-display text-xl font-medium">
            Tuition by subject
          </h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {["chemistry", "biology", "physics"].map((slug) => {
              const a = availabilityFor(slug, cohorts);
              return (
                <li
                  key={slug}
                  className="rounded-lg border border-ink/10 bg-snow px-4 py-3.5"
                >
                  <p className="text-sm font-medium capitalize text-ink">{slug}</p>
                  <p className="mt-1 text-xs text-ink/65">{availabilityLabel(a)}</p>
                  <p className="font-mono mt-1.5 text-[10px] uppercase tracking-[0.14em] text-ink/40">
                    {a.cohorts > 0
                      ? `${a.cohorts} cohort${a.cohorts === 1 ? "" : "s"} listed`
                      : "no cohort listed"}
                  </p>
                  {a.state !== "enrolling" && (
                    <p className="mt-2 text-xs">
                      <Link href="/tuition/interest" className="underline underline-offset-2">
                        Register interest →
                      </Link>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ⚠ OFF-MENU, AND BELOW THE COHORTS (§24) — present, but not priced
            alongside the group offer where it would undercut it. */}
        <section className="mt-14 border-t border-ink/10 pt-10">
          <h2 className="font-display text-xl font-medium">Looking for something else?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            One-to-one Chemistry is available in limited monthly blocks. Availability is
            deliberately small so group teaching stays the focus.{" "}
            {/* ⚠ POINTS AT THE PAGE NOW, NOT STRAIGHT AT THE FORM. The page
                itself decides whether booking is open or whether to offer the
                interest form — one place makes that call, not every link. */}
            <Link href="/tuition/one-to-one" className="underline underline-offset-2">
              Ask about availability →
            </Link>
          </p>
        </section>
        {/* The human-readable version, for whoever is looking at the page
            rather than at the response. Same rule as /calendar: a visitor is
            never told which source a page used. */}
        {process.env.NODE_ENV !== "production"
          && (cohortSource !== "database" || cohortRefusals.length > 0) && (
          <p className="mt-10 font-mono text-[11px] text-ink/40">
            {cohortSource !== "database" && (
              <>cohort source: {cohortSource}{cohortReason ? ` (${cohortReason})` : ""}. </>
            )}
            {cohortRefusals.length > 0 && (
              <>{cohortRefusals.length} row(s) refused: {cohortRefusals.slice(0, 2).join("; ")}</>
            )}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
