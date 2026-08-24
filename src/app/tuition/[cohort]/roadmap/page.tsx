import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { loadCohorts } from "@/lib/public/readers";
import { loadCapacity } from "@/lib/public/capacity";
import { currentCurrency } from "@/lib/public/currency-server";
import { calendarDate, CANONICAL_TZ } from "@/lib/schedule/timezone";
import { loadCourseRoadmap } from "@/lib/roadmap/reader";
import { daysUntil } from "@/lib/roadmap/model";
import { RoadmapPhases } from "@/components/roadmap/RoadmapPhases";
import { loadPricing } from "@/lib/tuition/tuition-pricing";
import { courseForQualification } from "@/lib/tuition/tuition-types";
import { availabilityFor } from "@/lib/tuition/availability";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * A course's roadmap: what is taught, when, in the order it happens.
 *
 * ============================================================================
 * ⚠ THIS PAGE AUTHORS NOTHING. IT ARRANGES ROWS.
 * ============================================================================
 * Phase names are unit names, session titles are lesson titles, dates are real
 * scheduled occurrences, the price comes from the pricing service and the CTA
 * label from availabilityFor. The brief listed thirty-six lesson titles; none
 * of them is in this codebase's roadmap layer, because they are already in
 * `lessons` and a second copy would drift within a month.
 *
 * ⚠ IT LIVES UNDER /tuition, NOT /online-tuition. The brief suggested a new
 * top-level segment; the nav, the footer, every existing CTA and every shared
 * link already say /tuition, and moving them would owe redirects for a naming
 * preference. Static siblings (/tuition/one-to-one, /tuition/interest) sort
 * above this dynamic segment in Next's router, so nothing existing is shadowed.
 */

type Params = Promise<{ cohort: string }>;

async function findCohort(slug: string) {
  const { data } = await loadCohorts();
  return data.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { cohort: slug } = await params;
  const cohort = await findCohort(slug);
  if (!cohort) return { title: "Not found · Ailemy" };
  return {
    title: `${cohort.title} — course roadmap · Ailemy`,
    description:
      `The teaching plan for ${cohort.title}: weekly topics, the order they are taught in, ` +
      `and the schedule they run to. Online small-group tuition from Ailemy.`,
  };
}

export default async function RoadmapPage({ params }: { params: Params }) {
  const [session, { cohort: slug }] = await Promise.all([getNavSession(), params]);
  const cohort = await findCohort(slug);
  if (!cohort) notFound();

  const todayISO = calendarDate(new Date(), CANONICAL_TZ);
  const [roadmap, capacity, { currency }] = await Promise.all([
    loadCourseRoadmap(cohort),
    loadCapacity(cohort.slug, cohort.seatCap),
    currentCurrency(),
  ]);

  /**
   * ⚠ THE MONTHLY PRICE COMES FROM STRIPE, resolved server-side from the same
   * active Price the tuition card renders and Checkout charges. The course is
   * derived from the cohort's `qualification` column — never its slug, which
   * carries an intake date and would unmap the next cohort.
   */
  const course = courseForQualification(cohort.qualification);
  const groupPricing = course ? await loadPricing(course, "group") : null;
  if (groupPricing?.failures.length) {
    console.error("[roadmap] group price resolution failed", cohort.slug, groupPricing.failures);
  }
  const monthlyPrice = groupPricing?.views.monthly?.formatted?.[currency === "QAR" ? "qar" : "gbp"] ?? null;

  const colour = subjectColour(cohort.subject);
  // §21/§5 — price from the service, label from availability. Never typed.
  const availability = availabilityFor(cohort.subject, [cohort]);
  const canReserve = availability.state === "enrolling";
  const ctaLabel = canReserve ? "Reserve your place" : "Register interest";
  const ctaHref = canReserve && cohort.enrolmentUrl
    ? cohort.enrolmentUrl
    : `/tuition/interest?cohort=${cohort.slug}`;

  const startsIn = cohort.firstClassOn ? daysUntil(todayISO, cohort.firstClassOn) : null;

  return (
    <div style={subjectVars(colour)} className="bg-parchment text-ink">
      <SiteNav session={session} />
      <main
        className="mx-auto max-w-5xl px-6 py-12 sm:py-16"
        data-roadmap-source={roadmap.error ? "error" : roadmap.phases.length > 0 ? "database" : "empty"}
      >
        {/* ── §3 hero ──────────────────────────────────────────────────── */}
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          <Link href="/tuition" className="underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Online Tuition
          </Link>
          <span aria-hidden> / </span>
          <span className="text-ink/70">Course roadmap</span>
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
          {cohort.title}.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          What is taught, in the order it is taught, on the dates it runs.
        </p>

        {/* §3/§15 — only chips whose data exists. */}
        <ul className="font-mono mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.16em] text-ink/45">
          {cohort.scheduleSummary && <li>{cohort.scheduleSummary}</li>}
          <li>{cohort.hoursPerWeek} teaching hours a week</li>
          {cohort.firstClassOn && cohort.lastClassOn && (
            <li>{cohort.firstClassOn} → {cohort.lastClassOn}</li>
          )}
          {/* §22 — real seats or the cap alone. Never invented scarcity. */}
          <li>
            {capacity.known
              ? `${capacity.taken} of ${cohort.seatCap} places taken`
              : `Maximum ${cohort.seatCap} students`}
          </li>
          {roadmap.courseName && <li>{roadmap.courseName}</li>}
        </ul>

        {/* §10 — a real countdown, or nothing. */}
        {startsIn !== null && startsIn > 0 && (
          <p className="mt-4 text-sm text-ink/65">Teaching begins in {startsIn} days.</p>
        )}

        {/* ⚠ A FAILED READ IS SAID, NEVER RENDERED AS AN EMPTY ROADMAP. */}
        {roadmap.error && (
          <p role="alert" className="mt-8 rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
            The roadmap could not be loaded — {roadmap.error}
          </p>
        )}

        {/* ── §6 the roadmap ───────────────────────────────────────────── */}
        {roadmap.phases.length > 0 ? (
          <section className="mt-12" aria-labelledby="roadmap-heading">
            <h2 id="roadmap-heading" className="sr-only">Weekly teaching plan</h2>
            <RoadmapPhases roadmap={roadmap} todayISO={todayISO} />
          </section>
        ) : !roadmap.error ? (
          /**
           * ⚠ §39 — WHAT EXISTS, AND WHAT DOES NOT, IN PLAIN WORDS.
           * Y11 and Y10 have windows and prices but no published timetable, so
           * there are no dates to arrange lessons against. This says so and
           * offers the two things that are real, rather than a guessed Tuesday
           * or a column of "TBC".
           */
          <div className="mt-10 rounded-xl border border-dashed border-ink/15 bg-ink/[0.015] px-5 py-5">
            <h2 className="font-display text-xl font-medium tracking-tight">
              The weekly plan is not published yet.
            </h2>
            {roadmap.gap && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">{roadmap.gap}</p>}
            {roadmap.lessonCount > 0 && (
              <p className="mt-2 text-sm text-ink/65">
                The course itself is mapped — {roadmap.lessonCount} lessons are written for it.
              </p>
            )}
            <p className="mt-4 flex flex-wrap gap-3 text-sm">
              {roadmap.courseSlug && (
                <Link href={`/resources/${cohort.subject}/${roadmap.courseSlug}`} className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                  See what the course covers →
                </Link>
              )}
              <Link href="/calendar" className="text-ink/70 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                Open the timetable →
              </Link>
            </p>
          </div>
        ) : null}

        {/* §39 — a partial roadmap says where it stops. */}
        {roadmap.phases.length > 0 && roadmap.gap && (
          <p className="mt-6 text-xs leading-relaxed text-ink/50">{roadmap.gap}</p>
        )}

        {/* ── §21 conversion, priced from the service ──────────────────── */}
        <section className="mt-14 border-t border-ink/10 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl font-medium tracking-tight">
                {monthlyPrice ?? <span className="text-base font-normal text-ink/50">Pricing unavailable</span>}{" "}
                <span className="text-sm font-normal text-ink/60">a month</span>
              </p>
                {/* ⚠ THE "charged as £X" LINE IS GONE (§6). The figure above is
                    now the Stripe amount in the selected currency — the same
                    Price the tuition card shows and Checkout charges — so a
                    second, differently-converted number under it would be a
                    contradiction, not reassurance. */}
            </div>
            <Link
              href={ctaHref}
              data-cta="course_roadmap_register_clicked"
              className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {ctaLabel}
              <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
