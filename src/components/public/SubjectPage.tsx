import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS, ctaFor } from "@/lib/public/catalogue";
import { loadCohorts } from "@/lib/public/readers";
import { offersCurrencyChoice } from "@/lib/public/currency";
import { currentCurrency } from "@/lib/public/currency-server";
import { CohortPrice } from "@/components/public/CohortPrice";
import { CurrencyToggle } from "@/components/public/CurrencyToggle";
import { Calendar } from "@/components/calendar/Calendar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { loadCalendarEvents } from "@/lib/calendar/readers";
import { CANONICAL_TZ, calendarDate } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * One subject page, rendered for all three sciences.
 *
 * ============================================================================
 * ⚠ ONE COMPONENT, NOT THREE COPIES (§21)
 * ============================================================================
 * /chemistry, /biology and /physics are three-line route files that call this.
 * Triplicated JSX is how three pages drift: a fix lands on Chemistry, and
 * Biology keeps the bug for a year because nobody remembers it is a separate
 * file.
 *
 * ⚠ THE PARTIAL STATE IS A FIRST-CLASS RENDERING, NOT A DEGRADED ONE. Biology
 * and Physics have no resources. The page says so plainly and offers the thing
 * that IS real — registering interest — rather than showing empty shelves or
 * pretending the shelves are full.
 *
 * ⚠ QUALIFICATIONS ARE LISTED, NOT LINKED, until the routes behind them exist.
 * GCSE and International GCSE are shown as distinct entries (§22): they share
 * teaching, they are not the same qualification, and collapsing them in the UI
 * is how they end up collapsed in the data.
 */
export type SubjectSearch = {
  view?: string; date?: string; level?: string; type?: string; day?: string;
};

export async function SubjectPage({ slug, params }: { slug: string; params?: SubjectSearch }) {
  const session = await getNavSession();
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) return null;

  const { data: allCohorts } = await loadCohorts();
  const cohorts = allCohorts.filter((c) => c.subject === slug);
  const { currency } = await currentCurrency();

  /**
   * ⚠ §15 — ONE IMPLEMENTATION, THREE SUBJECTS. This component renders
   * /chemistry, /biology and /physics, so the subject calendar is written once
   * and filtered by slug. Building it three times is how Biology ends up a
   * year behind Chemistry.
   */
  const viewerTz = await viewerTimeZone();

  /**
   * ⚠ ONE IMPLEMENTATION, THREE SUBJECTS (§11, §15). This component renders
   * /chemistry, /biology and /physics; the subject is a parameter, never three
   * copies of the same logic. When a Biology teacher publishes a timetable, this
   * page fills in with no code change.
   *
   * ⚠ THE SUBJECT IS LOCKED, NOT FILTERED. state.subject is forced to this
   * page's slug so a level filter cannot widen the Chemistry calendar into the
   * school calendar under the same URL.
   */
  const todayISO = calendarDate(new Date(), CANONICAL_TZ);
  const base = readState(params ?? {}, todayISO, "upcoming");
  const state = { ...base, subject: slug };
  const openDay = params?.day && parseDate(params.day) ? params.day : null;
  const range = rangeFor(state.view, state.date);
  const { events: subjectEvents } = await loadCalendarEvents({
    from: range.from, to: range.to, mode: "public",
    subject: slug, level: state.level, type: state.type,
  });
  const hasResources = subject.status === "available" && subject.exploreHref !== null;

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <header className="mx-auto max-w-6xl px-6 pt-14 pb-10 sm:pt-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Pearson Edexcel
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium tracking-tight sm:text-5xl">
          {subject.name}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">{subject.blurb}</p>

        {/* ⚠ §49 — THE CANONICAL HANDOFF, MADE EXPLICIT.
            /chemistry is the public subject hub; /learn/chemistry is the
            structured course catalogue. That split already existed and was
            only reachable through a "Lessons" card further down the page, so
            the primary journey — arrive at the subject, start learning — had
            no primary CTA. Past papers sit beside it because every subject has
            them today, including the two with no lessons yet.

            ⚠ THE LEARN CTA IS GATED ON exploreHref. Biology and Physics have
            no course catalogue, so they get Past papers and Register interest
            and NO "Start learning" — a button into an empty catalogue is the
            dead CTA §32 forbids. */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {subject.exploreHref && (
            <Link
              href={subject.exploreHref}
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Start learning →
            </Link>
          )}
          <Link
            href="/past-papers"
            className="rounded-full border border-ink/20 px-6 py-3 text-sm font-medium transition-colors hover:border-ink/40"
          >
            Past papers
          </Link>
          {!subject.exploreHref && (
            <Link
              href={`/tuition/interest?subject=${subject.slug}`}
              className="rounded-full border border-ink/20 px-6 py-3 text-sm font-medium transition-colors hover:border-ink/40"
            >
              Register interest
            </Link>
          )}
        </div>
      </header>

      {/* ── qualifications ─────────────────────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Qualifications</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subject.qualifications.map((q) => (
              <li key={q} className="rounded-lg border border-ink/10 bg-snow p-5">
                <p className="font-display text-lg font-medium">{q}</p>
                <p className="mt-1 font-mono text-[11px] text-ink/50">
                  {hasResources ? "Resources available" : "Register interest"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── resources, or an honest absence ────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Resources</h2>
          {hasResources ? (
            <>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
                Lessons, topic questions, past papers, mark schemes and examiner reports,
                organised by specification.
              </p>
              {/* ⚠ CATEGORIES, NOT ONE "BROWSE" BUTTON. This page is now the
                  canonical way into resources, so it has to actually route —
                  a single Browse link would just defer the choice by one
                  click. Every href below resolves today. */}
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Lessons", body: "Specification-mapped teaching, unit by unit.", href: subject.exploreHref! },
                  { label: "Past papers", body: "Question papers, mark schemes and examiner reports.", href: "/past-papers" },
                  { label: "Practice", body: "Topic questions and full papers, sat interactively.", href: "/past-papers" },
                ].map((r) => (
                  <li key={r.label}>
                    <Link
                      href={r.href}
                      className="flex h-full flex-col rounded-lg border border-ink/10 bg-snow p-5 transition-colors hover:border-ink/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <span className="font-display text-lg font-medium">{r.label}</span>
                      <span className="mt-1 flex-1 text-sm leading-relaxed text-ink/70">{r.body}</span>
                      <span className="mt-4 text-sm underline underline-offset-2">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            /* ⚠ NO EMPTY GRID, NO "Start learning" BUTTON. Saying there is
               nothing yet costs one sentence; a button that opens an empty
               shelf costs the visitor's trust. */
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
              {subject.name} resources are not published yet. Chemistry is complete and the
              same structure is being built for {subject.name} — register interest and we
              will tell you when it lands.
            </p>
          )}
        </div>
      </section>

      {/* ── subject calendar (§13–§15) ─────────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Upcoming {subject.name} lessons
          </h2>
          <div className="mt-6">
            {/* ⚠ THE EMPTY STATE IS THE HONEST ONE (§14). No invented sessions,
                and no "coming soon" implying a date exists. It says the
                timetable is not published and offers the only real next step. */}
            <Calendar
              events={subjectEvents}
              state={state}
              todayISO={todayISO}
              viewerTz={viewerTz}
              mode="public"
              basePath={`/${slug}`}
              openDay={openDay}
              lockedSubject={slug}
              emptyMessage={`No ${subject.name} timetable has been published yet. Register interest and we will tell you the moment a cohort opens.`}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/calendar?subject=${subject.slug}`}
              className="text-sm underline underline-offset-2 hover:text-ink"
            >
              Full {subject.name} calendar →
            </Link>
            {subjectEvents.length === 0 && (
              <Link
                href={`/tuition/interest?subject=${subject.slug}`}
                className="text-sm underline underline-offset-2 hover:text-ink"
              >
                Register interest →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── tuition ────────────────────────────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Live tuition</h2>
          {offersCurrencyChoice(cohorts) && (
            <div className="mt-4"><CurrencyToggle current={currency} /></div>
          )}
          {cohorts.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {cohorts.map((c) => {
                const cta = ctaFor(c);
                return (
                  <div key={c.slug} className="flex flex-col rounded-lg border border-ink/10 bg-snow p-6">
                    <h3 className="font-display text-lg font-medium">{c.title}</h3>
                    <CohortPrice cohort={c} currency={currency} size="md" />
                    <p className="mt-1 font-mono text-[11px] text-ink/55">
                      {c.hoursPerWeek} hrs/week · cap {c.seatCap}
                    </p>
                    {c.scheduleSummary && (
                      <p className="mt-3 text-sm leading-relaxed text-ink/70">{c.scheduleSummary}</p>
                    )}
                    <Link
                      href={cta.href}
                      className="mt-auto pt-5 text-sm underline underline-offset-2 hover:text-ink"
                    >
                      {cta.label} →
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3">
              <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
                We open {subject.name} cohorts based on demand. Register and you will be first
                to hear when one is scheduled.
              </p>
              <Link
                href={`/tuition/interest?subject=${subject.slug}`}
                className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90"
              >
                Register interest →
              </Link>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Shared metadata builder, so three routes describe themselves consistently. */
export function subjectMetadata(slug: string) {
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) return {};
  return {
    title: `${subject.name} — Ailemy`,
    description: `${subject.blurb} Pearson Edexcel ${subject.qualifications.join(", ")}.`,
  };
}
