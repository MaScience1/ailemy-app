import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { ctaFor } from "@/lib/public/catalogue";
import { loadCohorts } from "@/lib/public/readers";
import { availabilityFor, availabilityLabel } from "@/lib/tuition/availability";
import { offersCurrencyChoice } from "@/lib/public/currency";
import { currentCurrency } from "@/lib/public/currency-server";
import { CohortPrice } from "@/components/public/CohortPrice";
import { CurrencyToggle } from "@/components/public/CurrencyToggle";
import { Calendar } from "@/components/calendar/Calendar";
import { parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { loadCalendarEvents } from "@/lib/calendar/readers";
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
}>;

export default async function TuitionPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const session = await getNavSession();
  const { data: cohorts } = await loadCohorts();
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
  const { events } = await loadCalendarEvents({
    from: range.from, to: range.to, mode: "public",
    subject: state.subject, level: state.level, type: state.type,
  });
  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />
      <main className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
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

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {cohorts.map((c) => {
            const cta = ctaFor(c);
            return (
              <div key={c.slug} className="flex flex-col rounded-lg border border-ink/10 bg-snow p-7">
                <h2 className="font-display text-xl font-medium tracking-tight">{c.title}</h2>
                <CohortPrice cohort={c} currency={currency} />
                <p className="mt-1 font-mono text-[11px] text-ink/55">
                  {c.hoursPerWeek} live hrs/week · {c.sessionsPerWeek} sessions · cap {c.seatCap}
                </p>
                {c.scheduleSummary && (
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">{c.scheduleSummary}</p>
                )}
                <p className="mt-4 text-sm leading-relaxed text-ink/70">{c.summary}</p>
                <ul className="mt-4 flex-1 space-y-1 text-sm text-ink/65">
                  {c.features.map((f) => <li key={f}>· {f}</li>)}
                </ul>
                <Link
                  href={cta.href}
                  className="mt-6 rounded-full border border-ink/20 px-4 py-2 text-center text-sm hover:border-ink/40"
                >
                  {cta.label} →
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── the schedule (§19) ──────────────────────────────────────── */}
        <section className="mt-14 border-t border-ink/10 pt-10">
          <h2 className="font-display text-xl font-medium">Upcoming lessons</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            Every scheduled session across the live cohorts, for the next eight weeks. Times in
            Doha, and in your own timezone where we know it.
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
              emptyMessage="No timetable has been published for this period. The cards above show what is opening; register interest and we will tell you the dates as soon as they are set."
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
      </main>
      <SiteFooter />
    </div>
  );
}
