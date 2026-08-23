import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { CapabilityStrip, CAPABILITY_COUNT } from "@/components/home/CapabilityStrip";
import { SubjectCard } from "@/components/home/SubjectCard";
import { StickyCta } from "@/components/home/StickyCta";
import { TryAilemy } from "@/components/home/TryAilemy";
import { HomeFaq } from "@/components/home/Faq";
import { WaitlistForm } from "@/components/tuition/WaitlistForm";
import { InteractiveCard } from "@/components/ui/InteractiveCard";
import { loadCapacity, type Capacity } from "@/lib/public/capacity";
import { NextStep } from "@/components/home/NextStep";
import { SocialProof } from "@/components/home/SocialProof";
import { loadIdentity } from "@/lib/account/identity";
import { loadProfileCourses } from "@/lib/account/profile-reader";
import { nextSession, distanceLabel } from "@/lib/calendar/next-session";
import { dayKeyOf } from "@/lib/calendar/grid";
import { getNavSession } from "@/lib/auth/nav-session";
import {
  SUBJECTS, ctaFor,
  type Cohort, type Subject,
} from "@/lib/public/catalogue";
import { loadCohorts } from "@/lib/public/readers";
import { groupOffer, oneToOneOffer, heroTuitionOffer } from "@/lib/tuition/availability";
import { CHECKOUT_BUILT, stripeConfig } from "@/lib/booking/config";
import { offersCurrencyChoice, type Currency } from "@/lib/public/currency";
import { currentCurrency } from "@/lib/public/currency-server";
import { CohortPrice } from "@/components/public/CohortPrice";
import { CurrencyToggle } from "@/components/public/CurrencyToggle";
import { HeroCalendarCard, HeroCalendarOverlay } from "@/components/calendar/HeroCalendar";
import { Calendar } from "@/components/calendar/Calendar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { loadCalendarEvents } from "@/lib/calendar/readers";
import { parseDate, rangeFor, readState } from "@/lib/calendar/grid";
import { emptyCalendarMessage } from "@/lib/calendar/types";
import { CANONICAL_TZ, calendarDate, dualTime, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * The Ailemy front door.
 *
 * ============================================================================
 * ⚠ THIS PAGE SELLS AILEMY, NOT ONE QUALIFICATION
 * ============================================================================
 * It used to open on "Edexcel IAL Chemistry AS" — true, and far too narrow: a
 * parent looking for Biology tuition and a student looking for past papers both
 * bounced off a page that appeared to be about somebody else's course. The
 * hierarchy below is the product, in the order a visitor needs it.
 *
 * ⚠ EVERY FIGURE COMES FROM THE CATALOGUE LAYER, NOT FROM JSX. Prices, hours,
 * dates and CTAs live in one place so the founder can move them without a
 * developer — and so a price cannot drift between two sections of one page.
 *
 * ⚠ SERVER-RENDERED THROUGHOUT. No client components and no animation library.
 * Cohorts are read from the database (0041) with the static catalogue as the
 * fallback, so the page renders the founder's real offer whether or not the
 * migration has been applied — and never a blank catalogue.
 */
export const metadata: Metadata = {
  title: "Ailemy — online science school and exam practice",
  description:
    "Live small-group science tuition, specification-mapped learning, past-paper practice with " +
    "mark-scheme-informed marking, and progress tracking. Pearson Edexcel GCSE, International GCSE and IAL.",
};

type Search = Promise<{
  view?: string; date?: string; subject?: string; level?: string; type?: string;
  day?: string; calendar?: string;
}>;

export default async function Home({ searchParams }: { searchParams: Search }) {
  const session = await getNavSession();
  const params = await searchParams;
  const { data: cohorts } = await loadCohorts();

  /**
   * ⚠ §2 — EVERY TUITION WORD ON THIS PAGE IS DERIVED, NOT TYPED.
   * The brief asked for "Book tuition" and "Book 1-to-1". Neither is true
   * today: CHECKOUT_BUILT is false, Stripe holds no keys, and every cohort is
   * `interest` with no payment link. These three calls decide the wording, so
   * the day a link lands the homepage changes with no code edit — and so the
   * hero cannot contradict the calendar component, which already says out loud
   * that it takes no bookings.
   *
   * ⚠ sellableTimes IS 0 HERE ON PURPOSE, NOT AS A GUESS. Loading the 1-to-1
   * package list into the hero to compute a label would put a query on the
   * critical path (§47) to answer a question `canBuy` already gates on
   * CHECKOUT_BUILT — false — so the product of the AND is 0 either way. If
   * checkout ever ships, this is the named place that has to start counting.
   */
  const group = groupOffer(cohorts);
  const oneToOne = oneToOneOffer({
    checkoutBuilt: CHECKOUT_BUILT,
    stripeConfigured: stripeConfig().configured,
    sellableTimes: 0,
    // The homepage does not read a credit balance; a student who holds one
    // sees the true offer on /tuition/one-to-one, which does.
    viewerCanRedeem: false,
  });
  const tuition = heroTuitionOffer(group, oneToOne);
  const chemistryCohorts = cohorts.filter((c) => c.subject === "chemistry");
  const { currency } = await currentCurrency();
  const showToggle = offersCurrencyChoice(chemistryCohorts);

  /**
   * ⚠ §31 — ONLY FOR SOMEBODY WE ACTUALLY KNOW SOMETHING ABOUT. Signed in AND
   * enrolled. An anonymous visitor gets nothing rather than a personalised-
   * looking panel addressed to no one, and a signed-in student with no
   * enrolments gets nothing rather than an empty "your next step".
   *
   * ⚠ AND IT COSTS NOTHING WHEN SIGNED OUT — neither read is issued.
   */
  const identity = session ? await loadIdentity() : null;
  const myCourses = identity ? await loadProfileCourses(identity.account.userId) : null;
  const firstCourse =
    myCourses?.available === true && myCourses.courses.length > 0 ? myCourses.courses[0] : null;

  /**
   * ⚠ ONE RPC PER CHEMISTRY COHORT SHOWN, and only those. The homepage renders
   * three; a helper that fetched the whole catalogue would do work nothing
   * displays. Absent or unread means the card shows no capacity line at all —
   * silence, never a number derived from a failed call.
   */
  const cohortCapacity = new Map<string, Capacity>();
  await Promise.all(
    chemistryCohorts.map(async (c) => {
      cohortCapacity.set(c.slug, await loadCapacity(c.slug, c.seatCap));
    }),
  );

  /**
   * ============================================================================
   * ⚠ THE CALENDAR IS A HOMEPAGE FEATURE NOW. THIS SUPERSEDES §4 AND §18.
   * ============================================================================
   * Those sections said the homepage must not carry an embedded month grid, and
   * this file used to carry a list preview because of them. Founder direction
   * on 2026-08-20 reversed it: the calendar is the thing a parent needs in
   * order to decide, so it is a section rather than a link to one.
   *
   * The weight concern behind §18 is answered rather than ignored — a phone
   * gets the Upcoming list, not a 7-column grid. Same component, same data,
   * one range query.
   *
   * ⚠ AND THE OLD "Upcoming lessons" SECTION IS GONE, DELIBERATELY. It listed
   * the next three sessions higher up the page. Keeping it would have shown the
   * same lessons twice on one page — and on a phone, where this section
   * degrades to that exact list, the two would have been indistinguishable.
   *
   * ⚠ ONE RANGE QUERY, FOR THE VISIBLE WINDOW ONLY (§60). rangeFor() returns
   * exactly what the chosen view shows: for a month that is the grid INCLUDING
   * its leading and trailing days, so the cells that belong to the neighbouring
   * months are populated rather than mysteriously empty. Never a year.
   */
  const viewerTz = await viewerTimeZone();
  const todayISO = calendarDate(new Date(), CANONICAL_TZ);

  /**
   * ⚠ §58's PATTERN, AND ITS TRADE-OFF, UNCHANGED. The server cannot measure a
   * viewport. A client component would flash the wrong view before hydrating,
   * and rendering both behind CSS breakpoints would double the DOM on the
   * heaviest page on the site. A coarse user-agent test decides a DEFAULT that
   * the URL can still override.
   */
  const ua = (await headers()).get("user-agent") ?? "";
  const handheld = /Android|iPhone|iPod|Windows Phone|\bMobi\b/i.test(ua) && !/iPad|Tablet/i.test(ua);

  const calendarState = readState(params, todayISO, handheld ? "upcoming" : "month");
  const openDay = params.day && parseDate(params.day) ? params.day : null;

  /**
   * ⚠ THE EXPANDED CALENDAR IS A URL STATE, NOT A useState. It renders on the
   * server, the card is a link and the scrim is a link, so it opens and closes
   * with JavaScript disabled and survives a reload. Escape and the focus trap
   * are the only parts that need a browser, and they are layered on top.
   *
   * ⚠ CLOSING PRESERVES EVERYTHING ELSE. A reader who paged to November and
   * opened a day should come back to November, not to today — so the close
   * link drops only `calendar`, and keeps view, date and filters.
   */
  const calendarOpen = params.calendar === "open";
  const qs = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      view: params.view, date: params.date, subject: params.subject,
      level: params.level, type: params.type, day: params.day, calendar: params.calendar,
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) {
      if (v) q.set(k, String(v));
    }
    const str = q.toString();
    return str ? `/?${str}#hero-calendar` : "/#hero-calendar";
  };
  const openCalendarHref = qs({ calendar: "open" });
  const closeCalendarHref = qs({ calendar: null, day: null });
  const calendarRange = rangeFor(calendarState.view, calendarState.date);

  const { events: calendarEvents } = await loadCalendarEvents({
    from: calendarRange.from, to: calendarRange.to,
    mode: "public",
    subject: calendarState.subject,
    level: calendarState.level,
    type: calendarState.type,
  });

  /**
   * ⚠ §63 — THE CARD MUST NOT LOOK EMPTY, AND THE MONTH IN VIEW CANNOT ANSWER
   * THAT. Teaching begins 15 September, so for the whole summer the grid is a
   * blank August and the visitor concludes nothing is happening. This asks the
   * different question — when is the next actual lesson — and it needs a window
   * the current view does not cover.
   *
   * ⚠ BOUNDED AT 120 DAYS, NOT A YEAR (§35). The performance rule is that the
   * calendar never downloads an enormous range. A term is about sixteen weeks;
   * 120 days reaches the next teaching block from anywhere in the summer without
   * pulling a year of sessions to render one line. If nothing falls inside it
   * the card simply omits the banner, which is honest.
   *
   * ⚠ AND IT IS SKIPPED ENTIRELY WHEN THE VIEW ALREADY HAS EVENTS. The banner
   * only renders when eventCount is 0, so fetching for a populated month would
   * be a round-trip whose result is discarded.
   */
  const AHEAD_DAYS = 120;
  const lookahead = new Date(Date.now() + AHEAD_DAYS * 86_400_000);
  const { events: aheadEvents } = calendarEvents.length === 0
    ? await loadCalendarEvents({
        from: todayISO,
        to: calendarDate(lookahead, CANONICAL_TZ),
        mode: "public",
        subject: calendarState.subject,
        level: calendarState.level,
        type: calendarState.type,
      })
    : { events: [] as typeof calendarEvents };

  const upcomingLesson = nextSession(aheadEvents, new Date(), dayKeyOf, todayISO);
  const nextLesson = upcomingLesson.kind === "session"
    ? {
        title: upcomingLesson.event.title,
        dayLabel: formatDay(upcomingLesson.event.startsAt, CANONICAL_TZ),
        // ⚠ DOHA, LABELLED. An unlabelled time on a site taught from Doha to
        // students anywhere is the silent-wrong-hour failure feat/tz-validation
        // exists for; the expanded calendar shows the viewer's zone alongside.
        timeLabel: `${dualTime(upcomingLesson.event.startsAt, viewerTz).canonical} Doha`,
        distance: distanceLabel(upcomingLesson.daysAway),
      }
    : null;

  return (
    <div className="bg-parchment text-ink">
      {/* 1 */} <AnnouncementBar />
      <TimezoneSync known={viewerTz !== null} />
      {/* 2 */} <SiteNav session={session} />

      {/* ── 3. hero ─────────────────────────────────────────────────────
          ⚠ TWO COLUMNS FROM 1024px (Tailwind `lg`), STACKED BELOW IT.
          The container caps at max-w-6xl (1152px) less 48px of padding, so the
          widest the row ever gets is 1104px. A 480px card plus a 40px gap
          leaves 584px for the copy, which holds the 60px h1 on two lines. At
          1024px it leaves 504px, which is the tightest this layout is allowed
          to get — below that the columns stack rather than squeezing the
          headline, because requirement 7 is that the copy must not reflow
          awkwardly and a third line of 60px type is exactly that.

          ⚠ items-START, NOT items-center, AND THAT CHANGED IN THIS BUILD.
          Centring was right while the right column was the shorter one — the
          card hung level with the middle of the copy. §7 then added the
          "Learn live with an expert" heading and two actions ABOVE the card,
          making the right column the taller one, and centring answered by
          pushing the headline 84px DOWN the page. That is the opposite of §2,
          which exists to move the hero up, and it opened exactly the empty
          top-left corner §2 was written to close.

          Aligned to the top, the headline and the tuition heading start on the
          same line, which is also the balance §12 asks for. */}
      {/* ⚠ §2 — 24px OFF THE PHONE, 32px OFF THE DESKTOP. pt-16/sm:pt-24 left the
          headline sitting low enough that the first screen read as mostly empty
          above it. pt-10/sm:pt-16 is inside the brief's 20–35px range at both
          breakpoints and still clears the header by a full step of the spacing
          scale — the hero is moved up, not jammed against the nav. */}
      <header className="mx-auto max-w-6xl px-6 pt-10 pb-10 sm:pt-16 sm:pb-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start lg:gap-10">
        <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Pearson Edexcel · GCSE · International GCSE · IAL
        </p>
        {/* ⚠ THE HEADLINE IS THE PRODUCT, NOT A SLOGAN (§1). "Master science.
            Ace the exam." is an outcome anyone could promise; the four verbs
            below are what Ailemy actually does, in the order a student does
            them — and the third one is the differentiator, because everybody
            else stops at "practise". */}
        <h1 className="font-display mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
          Learn it. Practise it.<br className="hidden sm:block" /> Get it marked. Master the exam.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg">
          Specification-mapped lessons, revision resources, past papers, exam practice,
          intelligent marking, progress tracking and expert live tuition — all in one
          science platform.
        </p>
        {/* ⚠ THE PRIMARY AND SECONDARY HAVE SWAPPED, AND THAT IS THE POINT OF
            §1. Tuition was the filled button, which told every visitor the
            product is a tutoring service. Practice is free, needs no account to
            start, and is what most visitors can act on today — so it takes the
            filled treatment and tuition takes the outline.

            ⚠ WORDING TRACKS THE SESSION (§53). "Start practising free" to a
            stranger; "Continue studying" to somebody signed in, who has already
            started and would read an invitation to start as the site forgetting
            them. */}
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href={session ? "/profile" : "/past-papers"}
            data-cta="hero_start_free_clicked"
            className="group rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {session ? "Continue studying" : "Start practising free"}{" "}
            <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
          </Link>
          {/* ⚠ §5 — THE LABEL COMES FROM heroTuitionOffer, NOT FROM THE BRIEF.
              §5 prefers "Book tuition →" "if the booking experience is
              sufficiently functional". It is not, so this reads what is true
              and becomes "Book tuition" by itself the day that changes. */}
          <Link
            href={tuition.href}
            data-cta="hero_book_tuition_clicked"
            className="group rounded-full border border-ink/20 px-6 py-3 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {tuition.label}{" "}
            <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        </div>

        {/* ⚠ SECOND COLUMN ON DESKTOP, BELOW THE CTAs ON A PHONE. The order in
            the DOM is copy → CTAs → card, which is the reading order a phone
            gets for free and the one a screen reader gets everywhere. */}
        <div id="hero-calendar" className="lg:justify-self-end">
          {/* ── §7/§38 — WHAT THE CALENDAR IS FOR, SAID BEFORE IT ────────────
              ⚠ THIS LIVES HERE, NOT INSIDE HeroCalendar. §14 forbids a second
              calendar, and the surest way to grow one is to start editing the
              shared component for one caller's needs. The card keeps rendering
              the same schedule /calendar and /tuition render; the homepage adds
              its own framing above it.

              ⚠ BOTH LABELS ARE DERIVED (§2). "Book a 1-to-1 session or reserve
              your place" was the requested copy; reserving a place is not
              something this product can do today, so the sentence says what the
              two links actually lead to and the links name their own state. */}
          <div className="mb-4">
            <h2 className="font-display text-xl font-medium tracking-tight">
              Learn live with an expert.
            </h2>
            <p className="mt-1.5 text-sm leading-snug text-ink/65">
              {tuition.bookable
                ? "Book a 1-to-1 session, or take a place in an upcoming group lesson."
                : "See real 1-to-1 availability and the group lessons running now."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={oneToOne.href}
                data-cta="hero_book_one_to_one_clicked"
                className="group/o inline-flex items-center gap-1 rounded-full border border-ink/20 px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {oneToOne.label}
                <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover/o:translate-x-0.5">→</span>
              </Link>
              <Link
                href={group.href}
                data-cta="hero_group_tuition_clicked"
                className="group/g inline-flex items-center gap-1 rounded-full border border-ink/20 px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {group.label}
                <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover/g:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>
          <HeroCalendarCard
            events={calendarEvents}
            state={calendarState}
            todayISO={todayISO}
            viewerTz={viewerTz}
            openHref={openCalendarHref}
            eventCount={calendarEvents.length}
            next={nextLesson}
          />
        </div>
        </div>
      </header>

      {/* ── 4a. the four products (§16, §17) ─────────────────────────────
          ============================================================
          ⚠ MOVED DIRECTLY BELOW THE HERO, AHEAD OF THE SUBJECT CARDS
          ============================================================
          §16 asks for the product explanation immediately after the hero, and
          §18's five-second test is why: a visitor who has just read "Learn it.
          Practise it. Get it marked." needs to know WHAT those four things are
          before they are asked which science they study. The subject cards did
          that job when subjects were the first question; they are now the
          second, and they still sit directly underneath.

          These four are the same four as the nav, in the same order, so the
          homepage and the header cannot tell different stories.

          ⚠ NEUTRAL, NOT COLOURED (§17). Subject colours mean subjects. Giving
          Resources a hue of its own would make four products look like four
          more subjects.

          ⚠ EXAM BUILDER SAYS "IN DEVELOPMENT" HERE FOR THE SAME REASON ITS
          PAGE DOES. A pillar that reads like the other three would be the
          fourth working product this site does not have. */}
      <Section id="products" title="Four ways to use Ailemy">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/resources", cta: "pillar_resources_clicked", label: "Resources",
              eyebrow: "Learn and revise",
              body: "Lessons, revision notes, flashcards, definitions, formulae and worked examples.",
              action: "Explore Resources",
            },
            {
              href: "/past-papers", cta: "pillar_past_papers_clicked", label: "Past Papers",
              eyebrow: "Prepare with real exams",
              body: "Work through real papers, practise exam technique, and have your answers marked against the mark scheme.",
              action: "Explore Past Papers",
            },
            {
              href: "/exam-builder", cta: "pillar_exam_builder_clicked", label: "Exam Builder",
              eyebrow: "Practise exactly what you need",
              body: "Choose topics, difficulty, question styles, maths demand and paper length.",
              /* ⚠ NOT "Build an Exam →" (§16). The engine does not exist; the
                 page it opens says so in its first sentence. A pillar promising
                 the verb would be the fake product /exam-builder was written to
                 avoid, three sections higher up the same page. */
              action: "In development",
            },
            {
              href: "/tuition", cta: "pillar_online_tuition_clicked", label: "Online Tuition",
              eyebrow: "Learn live",
              /* ⚠ §2 — "or book available 1-to-1 tuition" was the requested
                 copy; booking is not live, so the sentence tracks the offer. */
              body: tuition.bookable
                ? "Join a group lesson or book available 1-to-1 tuition."
                : "Small-group lessons and 1-to-1 teaching, with real times you can see before you commit.",
              action: "View Online Tuition",
            },
          ].map((p) => (
            <Link
              key={p.href}
              href={p.href}
              data-cta={p.cta}
              className="flex h-full flex-col justify-between gap-4 rounded-xl border border-ink/10 bg-snow p-5 transition-all duration-300 hover:border-ink/30 motion-safe:hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                  {p.eyebrow}
                </p>
                <h3 className="font-display mt-2 text-xl font-medium tracking-tight">{p.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{p.body}</p>
              </div>
              <p className="text-sm font-medium text-ink">
                {p.action} <span aria-hidden>{"\u2192"}</span>
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── 4a-ii. trust strip (§29) ──────────────────────────────────────
          ============================================================
          ⚠ FIVE CLAIMS, EVERY ONE OF THEM CHECKABLE TODAY
          ============================================================
          §29 lists what is NOT allowed here — student counts, pass rates,
          grade improvements, testimonials — and this codebase has no data for
          any of them. What is left is what Ailemy actually is, and each line
          below can be pointed at something in the repository:

            · specification-mapped — courses carry units, topics and spec
              points, and the Resources pages count them
            · mark-scheme-informed — marking runs against the real scheme; the
              reconcile suite exists to keep it honest
            · every answer marked — the demo two sections down does it live
            · progress tracked — attempts and marks persist per student
            · built by subject specialists — the teachers section below

          ⚠ IT IS A ROW OF WORDS, NOT A ROW OF BADGES. Parents read this strip;
          a line of award-shaped graphics with nothing behind them is exactly
          the advertising clutter §29 warns against. */}
      <section aria-label="What Ailemy is" className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-10">
            {[
              "Specification-mapped",
              "Mark-scheme-informed",
              "Every answer marked",
              "Progress tracked",
              "Built by subject specialists",
            ].map((claim) => (
              <li
                key={claim}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45"
              >
                {claim}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 4. subject selector ──────────────────────────────────────────
          ============================================================
          ⚠ THE SCIENCES COME FIRST NOW. THIS SUPERSEDES §2 AND §27.
          ============================================================
          §2 put the capability strip immediately under the hero; §27 put the
          marking demonstration third, above the sciences. Both were arguing
          about which FEATURE deserved to lead, and neither answered the
          question a visitor actually arrives with, which is not "what can this
          do" but "do you teach my subject?"

          A parent looking for Biology met a feature list first and had to
          scroll to find out that Biology is demand-triggered. Answering the
          subject question at the top costs the feature list one screen and
          costs a visitor in the wrong place nothing at all.

          ⚠ NOTHING WAS DELETED TO DO THIS. The strip and the demonstration are
          both still here, in the two bands directly below, in the order the
          sequence 4 → 4b → 4c spells out. */}
      <Section id="subjects" title="Three sciences, one platform">
        <div className="grid gap-4 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <SubjectCard
              key={s.slug}
              subject={{
                slug: s.slug, name: s.name, qualifications: s.qualifications,
                blurb: s.blurb, status: s.status, exploreHref: s.exploreHref,
              }}
            />
          ))}
        </div>
      </Section>

      {/* ── 4d. audience pathways (§20, §21, §22, §23) ────────────────────
          ============================================================
          ⚠ BELOW THE SUBJECTS, NOT BESIDE THE HERO — AND THAT IS §20
          ============================================================
          §20 puts this after the product pillars and says it "should not
          compete with the main hero"; §24 forbids stacking audience cards into
          the first viewport. So it sits here, after a visitor has seen what
          Ailemy does and which sciences it covers, at the point a parent or a
          teacher is deciding whether this is for them (§19, §37).

          ⚠ THE TEACHER CARD PROMISES NO TEACHER TOOLS, BECAUSE THERE ARE NONE.
          §23 offers "Explore teacher tools →" — conditionally, "if such
          functionality exists". There is no teacher dashboard, no class list,
          no assignment flow and no analytics surface in this codebase. What a
          teacher CAN use today is exactly what a student uses: the
          specification-mapped resources and the real papers. That is what it
          says, and it is why the link goes to /resources rather than to a
          page that would have to be invented to receive it. */}
      <section aria-labelledby="audience-heading" className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
          <h2 id="audience-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Using Ailemy as a…
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                who: "Student",
                cta: "audience_student_clicked",
                href: "/resources",
                body: "Learn a topic, revise it with notes and flashcards, practise it, and get every answer marked.",
                action: "Start learning free",
              },
              {
                who: "Parent",
                cta: "audience_parent_clicked",
                href: "/tuition",
                body: "Qualified teaching to a published timetable, with the specification, the marking and the progress all visible.",
                action: "See how tuition works",
              },
              {
                who: "Teacher",
                cta: "audience_teacher_clicked",
                href: "/resources",
                /* ⚠ NO CLASS LISTS, NO ASSIGNMENTS, NO ANALYTICS — none exist. */
                body: "Specification-mapped lessons, real past papers and mark-scheme-informed marking you can point a class at. Teacher tools are not built yet.",
                action: "Browse the resources",
              },
            ].map((a) => (
              <li key={a.who}>
                <Link
                  href={a.href}
                  data-cta={a.cta}
                  className="group flex h-full flex-col justify-between gap-4 rounded-xl border border-ink/10 bg-snow p-5 transition-all duration-200 ease-out hover:border-ink/30 motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <div>
                    <h3 className="font-display text-lg font-medium tracking-tight">{a.who}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">{a.body}</p>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {a.action} <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">{"\u2192"}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 4b. capability strip (§2, restated) ──────────────────────────
          ⚠ IT HAS A HEADING NOW, AND THAT IS THE HALF OF §2 THAT WAS MISSING.
          The strip was an unlabelled row of chips between the hero and the
          first band: nothing on the page said what it was, so it read as
          metadata and got scanned past. An h2 turns the same seven items into
          the answer to a question the reader can see being asked.

          ⚠ THE HEADING id IS WIRED TO THE nav's aria-labelledby, so the
          landmark and the visible title cannot drift apart. Section derives
          `${id}-title` for every band; this is the one that consumes it.

          ⚠ AND THE STRIP KNOWS WHETHER ANYONE IS SIGNED IN, for exactly one
          item. "Progress tracking" points at /profile for a student and at the
          sign-in route for a stranger — see the note in CapabilityStrip.

          ⚠ THE LEDE COUNTS THE PILLS, SO THE COUNT COMES FROM THE PILLS. It
          read "Seven things Ailemy does" as a typed word, which was true on the
          day it was written and is exactly the shape that goes quietly wrong:
          CapabilityStrip's own header invites an eighth capability, and adding
          one would have left this sentence claiming a number the page no longer
          shows, with nothing failing. CAPABILITY_COUNT is derived from the list
          itself. */}
      <Section
        id="capabilities"
        title="What you can do on Ailemy"
        lede={`${CAPABILITY_COUNT} things Ailemy does, in the order a student uses them — and every one of them is a link, not a label.`}
      >
        <CapabilityStrip signedIn={session !== null} labelledBy="capabilities-title" />
      </Section>

      {/* ── 4c. product demonstration (§25) ──────────────────────────────
          ⚠ IT FOLLOWS THE STRIP RATHER THAN PRECEDING THE SCIENCES, AND THE
          FUNNEL ARGUMENT SURVIVES THE MOVE INTACT. §27's point was that a
          visitor told Ailemy marks answers should see it happen rather than
          read about it two screens later. "Online marking" in the strip
          directly above links to #try — this section — so the demonstration is
          now one click AND one scroll from the claim, instead of sitting above
          the claim it illustrates. */}
      <Section
        id="try"
        title="Try it. Write an answer and see it marked."
        lede="This is how Ailemy marks — against the points a real mark scheme awards, with the reason for each one."
      >
        <TryAilemy />
      </Section>

      {/* ── 4d. your next step (§31) ─────────────────────────────────────
          ⚠ ABSENT ENTIRELY FOR A STRANGER. A header with nothing under it is
          worse than nothing at all.

          ⚠ STILL DIRECTLY BELOW THE DEMONSTRATION, which is where it has always
          been. The reorder above moved the sciences and the strip past it; it
          did not move this. A signed-in student meets the same panel at the
          same point in the page. */}
      {firstCourse && (
        <div className="mx-auto max-w-6xl px-6 pb-10 sm:pb-14">
          <NextStep
            courseName={[firstCourse.curriculum, firstCourse.subject, firstCourse.level]
              .filter(Boolean).join(" ") || firstCourse.courseName}
            subject={firstCourse.subject}
            courseSlug={firstCourse.courseSlug}
          />
        </div>
      )}

      {/* ── 5. the learning system ────────────────────────────────────── */}
      <Section
        id="how"
        title="Everything between learning the topic and sitting the exam."
        lede="Ailemy knows what you have studied, what you attempted, where you lost marks and what to do next."
      >
        {/* ⚠ NUMBERED BECAUSE IT IS GENUINELY A SEQUENCE. A student does these
            in this order and each depends on the last — which is the only thing
            that justifies 01/02/03 markers. Numbering a set of unordered
            features would be decoration pretending to be structure. */}
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Learn", "Specification-mapped lessons and expert live teaching."],
            ["Practise", "Topic questions, worksheets and full past papers."],
            ["Submit", "Answer inside Ailemy — no scanning, no uploading, no waiting."],
            ["Get marked", "Marked against the points a real mark scheme awards, with the reason for each."],
            ["Improve", "See exactly what cost you marks, not just what you scored."],
            ["Master", "Track a topic until the evidence says you are exam-ready."],
          ].map(([step, body], i) => (
            <li key={step} className="rounded-lg border border-ink/10 bg-snow p-6">
              <span className="font-mono text-[11px] text-ink/40">0{i + 1}</span>
              <h3 className="font-display mt-3 text-xl font-medium">{step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── 6. live tuition ───────────────────────────────────────────── */}
      <Section
        id="tuition"
        title="Learn live with Ailemy"
        lede="Small-group science tuition built around the exact specification and exam requirements."
      >
        {/* ── §67 — VALUE BEFORE PRICE ──────────────────────────────────
            ⚠ ABOVE THE CARDS, NOT INSIDE THEM. A parent reading £169 needs to
            already know it is not four Zoom hours. Repeating this list in each
            card would be three copies of the same sentence competing with the
            details that differ between programmes. */}
        <div className="mb-6 rounded-lg border border-ink/10 bg-parchment-2/40 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            Every programme includes
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/70">
            {[
              "Live teaching", "Ailemy platform access", "Homework",
              "Exam practice", "Marking and feedback", "Progress tracking",
            ].map((v) => (
              <li key={v} className="flex items-center gap-1.5">
                <span aria-hidden className="h-1 w-1 rounded-full bg-lime" />
                {v}
              </li>
            ))}
          </ul>
        </div>
        {showToggle && <div className="mb-6"><CurrencyToggle current={currency} /></div>}
        <div className="grid gap-4 lg:grid-cols-3">
          {chemistryCohorts.map((c) => (
            <CohortCard key={c.slug} cohort={c} currency={currency} capacity={cohortCapacity.get(c.slug) ?? null} />
          ))}
        </div>
        {/* ⚠ 1-TO-1 IS OFF-MENU (§24) — mentioned, deliberately not priced
            beside the group cohorts, where it would undercut the offer. */}
        <p className="mt-6 text-sm text-ink/60">
          Looking for something else?{" "}
          <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
            One-to-one Chemistry is available in limited blocks
          </Link>
          .
        </p>
      </Section>

      {/* ── 7. interactive past papers ────────────────────────────────── */}
      <Section
        id="papers"
        title="Don't just download a past paper. Do it."
        lede="Choose a subject, qualification, unit and series — then sit it question by question."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InteractiveCard
            href="/past-papers"
            ariaLabel="Browse past papers — sit a paper interactively, question by question"
            cta="Browse past papers"
          >
            <h3 className="font-display text-xl font-medium">Sit it interactively</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
              Answer question by question. Your responses are captured, marked against the
              mark scheme, and turned into topic performance you can act on.
            </p>
          </InteractiveCard>
          <InteractiveCard
            href="/past-papers"
            ariaLabel="View papers — question paper, mark scheme and examiner report as PDFs"
            cta="View papers"
          >
            <h3 className="font-display text-xl font-medium">Or read the PDFs</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
              Question paper, mark scheme and examiner report remain one click away. Being
              better than a download repository does not mean removing the downloads.
            </p>
          </InteractiveCard>
        </div>
      </Section>

      {/* ── 8. the mark scheme ────────────────────────────────────────── */}
      <Section
        id="marks"
        title="Understand the mark scheme, not just the topic."
        lede="Submit an answer. See where the marks were won and lost."
      >
        <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
          <ol className="space-y-3 text-sm leading-relaxed text-ink/75">
            <li><span className="font-mono text-[11px] text-ink/40">01</span>  Your answer, as you wrote it.</li>
            <li><span className="font-mono text-[11px] text-ink/40">02</span>  The phrase that earned the mark, highlighted.</li>
            <li><span className="font-mono text-[11px] text-ink/40">03</span>  The mark-scheme criterion it satisfied — or did not.</li>
            <li><span className="font-mono text-[11px] text-ink/40">04</span>  What would have earned the mark you missed.</li>
          </ol>
        </div>
      </Section>

      {/* ── 9. progress ───────────────────────────────────────────────── */}
      <Section
        id="progress"
        title="Know exactly what you know — and what still needs work."
        lede="Specification-level progress, built from the questions you have actually attempted."
      >
        {/* ⚠ CLEARLY LABELLED AS AN EXAMPLE. These are not anyone's results. */}
        <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
            Example view · IAL Chemistry AS
          </p>
          <ul className="mt-5 space-y-3">
            {[["Atomic Structure", 100], ["Bonding", 82], ["Energetics", 56], ["Kinetics", 31]].map(
              ([topic, pct]) => (
                <li key={topic as string} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 text-sm">{topic}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-ink/10">
                    <span className="block h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-ink/60">{pct}%</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </Section>

      {/* ── 10. resource library ──────────────────────────────────────── */}
      <Section id="resources" title="Everything for your course" lede="Structured by specification, not by folder.">
        <ul className="flex flex-wrap gap-2">
          {[
            ["Lessons", true], ["Revision notes", true], ["Topic questions", true],
            ["Past papers", true], ["Mark schemes", true], ["Examiner reports", true],
            ["Interactive papers", true], ["Worksheets", false], ["Videos", false],
          ].map(([label, ready]) => (
            <li
              key={label as string}
              className={`rounded-full border px-4 py-2 text-sm ${
                ready ? "border-ink/15 bg-snow" : "border-ink/10 bg-transparent text-ink/45"
              }`}
            >
              {label}{ready ? "" : " · coming soon"}
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 11. Biology / Physics interest ────────────────────────────── */}
      <Section
        id="other-sciences"
        title="Looking for another science?"
        lede="We open new Biology and Physics cohorts based on student demand. Register for priority access."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SUBJECTS.filter((s) => s.status === "interest").map((s) => (
            <div key={s.slug} className="rounded-lg border border-ink/10 bg-snow p-6">
              <h3 className="font-display text-xl font-medium">{s.name}</h3>
              <p className="mt-1 font-mono text-[11px] text-ink/50">{s.qualifications.join(" · ")}</p>
              <Link
                href={`/tuition/interest?subject=${s.slug}`}
                className="mt-4 inline-block rounded-full border border-ink/20 px-4 py-2 text-sm hover:border-ink/40"
              >
                Register interest →
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 12. teacher credibility ───────────────────────────────────── */}
      {/* ⚠ NO TESTIMONIALS, RATINGS OR STUDENT COUNTS. None exist in the data,
          and an empty section is better than invented credibility (§17). The
          claim below is about mark-scheme expertise, NOT examiner employment.

          ⚠ §53 — THIS USED TO CLAIM "every marking point on EVERY PAPER read,
          ruled on and recorded". That was false. One paper has been ruled end
          to end (WCH11/01 May–June 2025, 48/48); every other paper in the
          archive has no mark-scheme items at all. The sentence described an
          ambition as a finished state, on the page that asks people to trust
          the marking. It now describes the METHOD, which is true of every
          paper the moment it is ruled and stays true as the archive grows. */}
      {/* ⚠ THE SAME THREE CLAIMS, SPLIT — NOT THREE NEW ONES. §28 asks for the
          paragraph to become scannable, and every sentence below is already in
          the paragraph it replaces. Turning a trust section into bullet points
          is an invitation to add a fourth, stronger-sounding one; there isn't
          a fourth true one, so there are three. */}
      <Section id="teachers" title="Built by teachers who understand the exam.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Built from real mark schemes",
             "Ailemy's marking rules are derived from published examination mark schemes — not from a general model's opinion of your answer."],
            ["Reviewed by subject specialists",
             "Automated marking rules are human-reviewed before they are used to mark anyone's work."],
            ["Designed around the exam",
             "Lessons, questions and feedback follow the specification students are actually assessed on."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-ink/10 bg-snow p-6">
              <h3 className="font-display text-lg font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
            </div>
          ))}
        </div>
        {/* ⚠ NOT AN AFFILIATION CLAIM (§46). "Prepared from the published
            Edexcel mark schemes" is a statement about a source document, which
            is lawful and true. "Edexcel-approved" would be neither. */}
        <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-ink/55">
          Chemistry teaching and mark-scheme rulings are prepared by a specialist chemistry
          teacher working from the published Edexcel mark schemes. Ailemy is not affiliated with
          or endorsed by any examination board.
        </p>
      </Section>

      {/* ── 12a. social proof (§29, §27 position 12) ─────────────────────
          ⚠ RENDERS NOTHING TODAY, AND THAT IS THE CORRECT OUTPUT. Every metric
          is null because none is non-zero: one paper is ruled end to end and no
          student has sat anything. The component drops null metrics and returns
          null when nothing survives, so there is no empty band and no
          placeholder. It lights up when a reader supplies real figures — papers
          completed, questions answered and answers marked are all countable the
          day students start attempting work. */}
      <SocialProof
        metrics={[
          { label: "Papers completed", value: null, unit: "papers" },
          { label: "Answers marked", value: null, unit: "answers" },
        ]}
      />

      {/* ── 12b. FAQ (§30, §27 position 13) ─────────────────────────────
          ⚠ IMMEDIATELY BEFORE THE FINAL CTA, WHICH IS THE POINT. These are
          conversion objections — is it free, do I need tuition, is my board
          supported — and answering them anywhere else means the visitor meets
          the last ask still carrying the doubt. */}
      <Section id="faq" title="Questions people ask before they start.">
        <HomeFaq />
      </Section>

      {/* ── 13. final CTA ───────────────────────────────────────────────
          ⚠ THE TWO PATHS SWAPPED, AND §33 IS WHY. Tuition held the filled
          button while the free platform took the outline — the reverse of the
          hero, on the same page, and the reverse of what the funnel wants: the
          platform is free, needs no card, and is what most readers who got
          this far can act on tonight. The hero made this argument already; the
          last ask was still arguing the other way.

          ⚠ NEITHER BUTTON WAS TRACKED. Both were plain <Link>s with no
          data-cta, so the final ask on the page — the one whose whole job is
          conversion — reported nothing. That is the same defect as the four
          lesson CTAs that emitted no clicks for weeks, at the bottom of the
          funnel rather than the middle.

          ⚠ AND "Join live tuition" IS NOT A THING A READER CAN DO (§2). It
          reads as a booking; there is none. The label is derived, like every
          other tuition word on this page. */}
      <Section id="start" title="Ready to improve your grade?">
        <div className="flex flex-wrap gap-3">
          <Link
            href={session ? "/profile" : "/signup"}
            data-cta="final_cta"
            className="group rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {session ? "Continue studying" : "Start learning free"}{" "}
            <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href={tuition.href}
            data-cta="hero_book_tuition_clicked"
            className="group rounded-full border border-ink/20 px-6 py-3 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {tuition.label}{" "}
            <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </Section>

      {/* ── the expanded calendar ────────────────────────────────────────
          ⚠ RENDERED LAST IN THE DOM, ON PURPOSE. It is fixed-position, so
          where it sits in the flow does not affect the layout — but it does
          affect tab order, and a dialog that appears before the page content
          would put a keyboard user inside it before they had read anything.
          The focus trap moves them in when it opens. */}
      {calendarOpen && (
        <HeroCalendarOverlay closeHref={closeCalendarHref}>
          {/* ⚠ THE COMPLETE EXPERIENCE — the same component /calendar renders,
              with filters, the view toggle and day panels all on. Same data,
              same range, one query for the whole page. */}
          <Calendar
            events={calendarEvents}
            state={calendarState}
            todayISO={todayISO}
            viewerTz={viewerTz}
            mode="public"
            /* ⚠ THE BASE CARRIES calendar=open, so paging to next month or
               opening a day KEEPS THE OVERLAY OPEN. Without it every control
               inside the dialog would quietly dismiss it. */
            basePath="/?calendar=open"
            anchor="#hero-calendar"
            openDay={openDay}
            emptyMessage={emptyCalendarMessage(
              cohorts, todayISO, (iso) => formatDay(new Date(`${iso}T12:00:00Z`), CANONICAL_TZ),
            )}
          />
        </HeroCalendarOverlay>
      )}

      {/* ── persistent conversion CTA (§19, §20) ────────────────────────
          ⚠ AFTER the footer in the DOM, so it is the last thing a screen
          reader meets rather than an interruption between sections. It is
          position:fixed, so DOM order costs nothing visually. */}
      <StickyCta signedIn={session !== null} />

      {/* 14 */} <SiteFooter />
    </div>
  );
}

/**
 * One rhythm for every band, so the page reads as one document.
 *
 * ⚠ THE h2 CARRIES A DERIVED id SO A CHILD CAN POINT AT IT. `#capabilities`
 * wraps a <nav>, and a landmark needs an accessible name; naming it by
 * re-typing the heading in the other file is a copy waiting to disagree with
 * this one. `${id}-title` is stable, and deriving it for every band means the
 * next component that needs one does not have to change this signature.
 *
 * ⚠ DELIBERATELY NOT aria-labelledby ON THE <section> ITSELF. A named section
 * is exposed as a `region` landmark, and doing it here would add one for every
 * band on the longest page on the site — thirteen new landmarks to page past,
 * to solve a problem nobody has.
 */
function Section({
  id, title, lede, children,
}: { id: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-ink/10 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2
          id={`${id}-title`}
          className="font-display max-w-3xl text-2xl font-medium tracking-tight sm:text-3xl"
        >
          {title}
        </h2>
        {lede && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/65 sm:text-base">{lede}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}


/**
 * A programme card (§66, §67).
 *
 * ⚠ SCANNABLE ORDER, NOT NARRATIVE ORDER (§66). Programme, price, shape of the
 * week, dates, capacity, what is included, CTA — each on its own line so a
 * parent can find the number they came for without reading a paragraph. The
 * CTA anchors the bottom of every card at the same height, which is why the
 * feature list carries flex-1.
 *
 * ⚠ AND THE CTA STILL COMES FROM ctaFor(). Stripe is keyless, so it renders
 * "Register interest" and never a payable control — one decision point shared
 * with /tuition and the calendar, so no surface can promise what another
 * refuses.
 */
function CohortCard({
  cohort, currency, capacity,
}: {
  cohort: Cohort; currency: Currency; capacity?: Capacity | null;
}) {
  const cta = ctaFor(cohort);
  const full = capacity?.known === true && capacity.state === "full";

  /**
   * ⚠ A FULL COHORT CANNOT BE A CLICKABLE CARD, AND THIS IS NOT A STYLE CHOICE.
   * When it is full the card renders a WaitlistForm — a <form> with an <input>
   * and a submit <button>. Nesting interactive controls inside an anchor is
   * invalid HTML, and in practice the anchor swallows the click so the email
   * field cannot be focused and the form cannot be submitted. The whole-card
   * affordance would break the only action left on the card.
   *
   * So a full cohort stays a plain container. It loses the ribbon and the lift;
   * it keeps the thing a visitor came to do.
   */
  const body = (
    <>
      <h3 className="font-display text-xl font-medium tracking-tight">{cohort.title}</h3>
      <CohortPrice cohort={cohort} currency={currency} />
      <p className="mt-1 font-mono text-[11px] text-ink/55">
        {cohort.hoursPerWeek} live hrs/week · {cohort.sessionsPerWeek} sessions · cap {cohort.seatCap}
      </p>
      {/* ⚠ ONLY WHERE A TIMETABLE ACTUALLY EXISTS. Y10 and Y11 are
          demand-triggered and publish none; inventing days would be a promise
          nobody made. */}
      {cohort.scheduleSummary && (
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{cohort.scheduleSummary}</p>
      )}
      {cohort.onboardingOn && cohort.firstClassOn && (
        <p className="mt-2 font-mono text-[11px] text-ink/55">
          Onboarding {fmt(cohort.onboardingOn)} · first class {fmt(cohort.firstClassOn)}
        </p>
      )}
      {/* ⚠ CAPACITY ONLY WHERE PAID SEATS EXIST (§14). Silent at zero. */}
      {capacity?.known === true && capacity.label && (
        <p
          className={`mt-2 font-mono text-[11px] uppercase tracking-[0.14em] ${
            capacity.state === "few-left" || capacity.state === "full" ? "text-amber-800" : "text-ink/55"
          }`}
        >
          {capacity.label}
        </p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-ink/70">{cohort.summary}</p>
      <ul className="mt-4 flex-1 space-y-1 text-sm text-ink/65">
        {cohort.features.map((f) => <li key={f}>· {f}</li>)}
      </ul>
      {/* ⚠ §65 — A FULL COHORT OFFERS THE LIST INSTEAD OF A DEAD CTA. It does
          not promise a place, and it only appears when capacity is genuinely
          known to be full — never on an unread or empty figure. */}
    </>
  );

  if (full) {
    return (
      <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-7">
        {body}
        <WaitlistForm cohortSlug={cohort.slug} />
      </div>
    );
  }

  return (
    <InteractiveCard
      href={cta.href}
      dataCta="chemistry_course"
      ariaLabel={`${cta.label} — ${cohort.title}`}
      cta={cta.label}
      className="p-7"
    >
      {body}
    </InteractiveCard>
  );
}

/** "2026-09-13" → "Sun 13 Sep 2026", without pulling in a date library. */
function fmt(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
