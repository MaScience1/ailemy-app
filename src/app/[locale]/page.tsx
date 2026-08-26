import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { SmartLink as Link } from "@/components/i18n/SmartLink";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { ExplorePanel } from "@/components/home/ExplorePanel";
import { nextClass } from "@/lib/home/next-class";
import { LIVE_CHIPS, SOON_CHIPS } from "@/lib/home/hero-chips";
import { loadSubjectHoldings, holdingsLabel } from "@/lib/qualifications/tree";
import { HeroAvailability, isHeroMode, type HeroMode } from "@/components/home/HeroAvailability";
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
import { nextAvailableSlot } from "@/lib/booking/next-available";
import { nextOf } from "@/lib/calendar/upcoming";
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
import { CANONICAL_TZ, calendarDate, dualTime, formatDay, formatTime } from "@/lib/schedule/timezone";
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
  view?: string; date?: string; subject?: string; level?: string; type?: string; tuition?: string;
  day?: string; calendar?: string;
}>;

/** One shape for a subject we could not count. */
const EMPTY_HOLDINGS = { liveLessons: 0, pastPapers: 0, error: null };

export default async function Home({ searchParams }: { searchParams: Search }) {
  const session = await getNavSession();
  const t = await getTranslations();
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

  /**
   * §9 — which side of the hero's availability card is showing. A link, not
   * client state, so it is shareable and the prices stay server-rendered (§59).
   */
  const heroMode: HeroMode = isHeroMode(params.tuition) ? params.tuition : "group";

  /** §11 — real seats for the cohort whose lesson the card names, or nothing. */
  /**
   * §35 — what each subject actually holds, counted. /resources already draws
   * its cards this way; the homepage said "Register interest" for two subjects
   * carrying ~90 and ~72 past papers.
   */
  const holdings = await loadSubjectHoldings(SUBJECTS.map((x) => x.slug));

  const heroCohort = cohorts[0];
  const heroCapacity = heroCohort
    ? await loadCapacity(heroCohort.slug, heroCohort.seatCap)
    : null;
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
  /**
   * ⚠ THE NEXT CLASS, NOT THE NEXT EVENT. See src/lib/home/next-class.ts —
   * onboarding is a real session and a wrong answer to "when is your first
   * lesson". Reads the 120-day window so it still resolves before term.
   */
  const upcomingClass = nextClass(
    aheadEvents.length > 0 ? aheadEvents : calendarEvents,
    new Date(),
  );
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

      {/* ══════════════════════════════════════════════════════════════════
          ⚠ SECTION ORDER IS §3's, AND IT IS A HIERARCHY, NOT A LIST
          ══════════════════════════════════════════════════════════════════
          The page was a stack of similarly weighted bands: subjects and the
          audience selector arrived before a visitor had seen the product work,
          tuition sat two thirds down, and marking, past papers and progress
          were three separate explanations of one idea.

          The order now runs: understand → experience → understand the loop →
          buy → see the proof → choose a science → find yourself → trust →
          questions → decide.

          ⚠ NOTHING WAS DELETED TO ACHIEVE THIS. Every section below is the one
          that was already here, in a different position. The two that WERE
          removed were duplicates and are recorded above. */}

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
      <header className="mx-auto max-w-6xl px-6 pt-7 pb-8 sm:pt-16 sm:pb-12">
        {/* ⚠ ONE COLUMN NOW, AT EVERY WIDTH. This was a two-column grid whose
            second column was the 480px calendar; with the calendar moved out
            (§5) a grid would leave half the hero empty on desktop. The copy is
            the better tenant of that space anyway — the removed comment below
            recorded it running 419px against the calendar's 735px. */}
        <div className="flex flex-col gap-6 lg:gap-10">
        <div>
        {/* ⚠ ONE LINE AT 375, BY SIZE AND TRACKING — NEVER BY TRUNCATION.
            Four qualification names in 44 characters do not fit at the old
            text-[11px]/tracking-[0.25em]. Truncating would hide the very thing
            it exists to say, so the size and letter-spacing step down on small
            screens and back up from sm:. whitespace-nowrap makes a wrap a
            visible overflow rather than a silent second line, and
            home-mobile-hero.test.ts fails if the rendered width exceeds 375. */}
        <p dir="auto" className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] text-ink/50 sm:text-[11px] sm:tracking-[0.25em]">
          {t("home.qualificationLine")}
        </p>
        {/* ⚠ THE HEADLINE IS THE PRODUCT, NOT A SLOGAN (§1). "Master science.
            Ace the exam." is an outcome anyone could promise; the four verbs
            below are what Ailemy actually does, in the order a student does
            them — and the third one is the differentiator, because everybody
            else stops at "practise". */}
        {/* ⚠ TIGHTER RHYTHM ABOVE THE FOLD. mt-5 → mt-3 at phone width: the
            qualification line and the headline are one thought, and every
            millimetre spent between them is a millimetre the CTAs do not get. */}
        <h1 className="font-display mt-3 max-w-3xl text-[2rem] font-medium leading-[1.08] tracking-tight sm:mt-5 sm:text-6xl sm:leading-[1.05]">
          {t("home.heroHeadline")}
        </h1>

        {/* ⚠ FOUR BENEFIT LINES, AND EVERY ONE IS TRUE TODAY. The paragraph
            they replace promised "intelligent marking" and "progress
            tracking": marking works for exactly one paper, and progress reads
            student_courses, which has zero writers anywhere in the codebase.
            A dense claim nobody can check is worse on a phone than four short
            ones that hold. */}
        <p className="mt-3 text-[15px] leading-snug text-ink/70 sm:mt-5 sm:text-base">
          {t("home.heroLeadIn")}
        </p>

        {/* ⚠ TWO OF THESE FOUR WERE REWRITTEN BECAUSE THE OLD ONES WERE NOT
            TRUE. "Build your own exams & practise by topic" names Exam Builder,
            which renders "This is not built yet." — and topic practice refuses
            without spec points, which 76 of 81 lessons do not have. "Instant
            marking, feedback & progress tracking" is the exact claim removed
            from this hero once already: the progress panel reads a table with
            no writer. What replaced them is narrower and checkable.

            ⚠ AND EDEXCEL IS GONE FROM THE HERO. Every live cohort is Edexcel,
            so it was the sharpest specificity here — but it also reads as a
            door closing to a visitor on any other board, on the one screen
            that decides whether they keep scrolling. It stays on the tuition
            and course surfaces where it is a fact about a product, not a
            filter on the audience. */}
        <ul className="mt-2.5 flex flex-col gap-1.5 text-[15px] leading-snug text-ink/75 sm:mt-4 sm:gap-2.5 sm:text-base">
          {[
            "home.benefitTuition",
            "home.benefitLessonsV2",
            "home.benefitQuestions",
            "home.benefitMarkScheme",
          ].map((key) => (
            <li key={key} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-flask" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        {/* ⚠ CHIPS ARE LABELS, NOT BUTTONS (§A). Six things you get, readable
            in one glance. They are links because a label you cannot follow is
            a tease — but they carry no button chrome, so they never compete
            with the two real CTAs below them.

            ⚠ EVERY DESTINATION WAS VERIFIED AS NOT-A-STUB. See HERO_CHIPS for
            the four routes deliberately excluded and the copy each one shows. */}
        {/* ── ROW 1 · LIVE ────────────────────────────────────────────────
            Four labels, four distinct destinations, every one fetched and read
            by the guard. A 200 on an empty shell fails it. */}
        <ul aria-label={t("home.chipsLiveLabel")} className="mt-4 grid grid-cols-2 gap-x-2.5 gap-y-1.5 sm:mt-6 sm:flex sm:flex-wrap">
          {LIVE_CHIPS.map((chip) => (
            <li key={chip.labelKey}>
              <Link
                href={chip.href}
                data-cta={chip.cta}
                className="group inline-flex w-full items-center gap-1.5 rounded-full border border-ink/12 bg-snow/70 ps-2.5 pe-3 py-1.5 text-[12px] leading-none text-ink/80 transition-colors duration-200 hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:w-auto sm:text-[13px]"
              >
                <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-flask" />
                {t(chip.labelKey)}
              </Link>
            </li>
          ))}
        </ul>

        {/* ── ROW 2 · COMING SOON ──────────────────────────────────────────
            ⚠ NO href, NO tabIndex, aria-disabled. These are <span>s inside
            list items, not links with a muted colour: a muted link is still a
            focus stop, still announced as a link, and still tappable by
            somebody who does not read colour. The guard asserts the ABSENCE of
            an href, because a class is a look and an href is a promise. */}
        <ul aria-label={t("home.chipsSoonLabel")} className="mt-1.5 grid grid-cols-2 gap-x-2.5 gap-y-1.5 sm:flex sm:flex-wrap">
          {SOON_CHIPS.map((chip) => (
            <li key={chip.labelKey}>
              <span
                aria-disabled="true"
                data-cta={chip.cta}
                className="inline-flex w-full items-center gap-1.5 rounded-full border border-dashed border-ink/12 ps-2.5 pe-3 py-1.5 text-[12px] leading-none text-ink/40 sm:w-auto sm:text-[13px]"
              >
                <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-ink/20" />
                {t(chip.labelKey)}
                <span className="sr-only"> — {t("home.chipsSoonLabel")}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* ⚠ THE HONEST VERSION OF "COMPREHENSIVE". The library is genuinely
            thin — 1 of 82 lessons published — so this says growing rather than
            complete. It is the sentence that lets the six chips above be read
            as a direction of travel instead of a claim about today. */}
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink/55 sm:mt-5 sm:text-sm">
          {t("home.heroReassuranceV2")}
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
        <div className="mt-4 flex flex-wrap gap-3 sm:mt-8">
          <Link
            href={session ? "/profile" : "/past-papers"}
            data-cta="hero_start_free_clicked"
            className="group rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {session ? t("home.continueStudying") : t("home.startPractisingFree")}{" "}
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

        {/* ⚠ THE CALENDAR COLUMN IS NO LONGER IN THE HERO (§5). It stacked
            BELOW the CTAs on a phone, so a month grid a stranger had to
            interpret sat between the hero and everything else — measured, it
            pushed the compact tuition block to y=2416. It now lives with the
            detailed tuition section below Subjects, which is the reader who
            actually wants to browse dates rather than decide. */}

        {/* ── THE RELOCATED CAPABILITIES (§1, §13, §14) ───────────────────
            ⚠ THE EXPLICIT GRID PLACEMENT IS GONE WITH THE GRID. This carried
            lg:col-start-1 lg:row-start-2 to sit under the copy and beside the
            calendar; with the hero a single column at every width, the same
            position now comes from DOM order alone. Keeping the placement
            classes against a non-grid parent would be dead code that reads as
            intent. */}
        <div className="lg:pt-10">
          <ExplorePanel signedIn={session !== null} />
        </div>
        </div>
      </header>

      {/* ══ §4 · COMPACT TUITION ACCESS — IMMEDIATELY AFTER THE HERO ═══════
          ⚠ THE TWO THINGS A PARENT CAME FOR, BEFORE ANY GRID OR TIMETABLE.
          Ailemy is both a platform and a place to book a teacher, and the
          second was previously buried under a month calendar the visitor had
          to interpret. This states the choice in two words each and gets out
          of the way; the full calendar lives further down for the reader who
          wants to browse rather than decide. */}
      <section aria-labelledby="live-tuition-heading" className="ai-band">
        <div className="mx-auto max-w-6xl px-6 py-9 sm:py-12">
          <h2 id="live-tuition-heading" className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            {t("home.liveTuitionTitle")}
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink/70 sm:text-base">
            {t("home.liveTuitionBodyV2")}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/tuition?mode=one-to-one"
              data-cta="home_tuition_one_to_one"
              className="group inline-flex min-h-[44px] items-center rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {t("home.liveTuitionOneToOne")}
            </Link>
            <Link
              href="/tuition?mode=group"
              data-cta="home_tuition_group"
              className="group inline-flex min-h-[44px] items-center rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {t("home.liveTuitionGroup")}
            </Link>
          </div>

          {/* ⚠ DERIVED, AND ABSENT WHEN NOTHING RESOLVES (governing §3).
              nextClass filters on tuition_sessions.kind, so the AS cohort's
              "Onboarding & diagnostics" on Sun 13 Sep is excluded and the first
              CLASS — Tue 15 Sep — is what shows. Matching the title instead
              would break the first time a session is renamed and would start
              showing the wrong date silently rather than failing.

              If nothing resolves this renders NOTHING. A placeholder date on a
              page a parent is deciding from is worse than an absent one, and
              this product has shipped a fabricated-slot incident once already. */}
          {upcomingClass ? (
            <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-ink/60">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                {t("home.nextLessonLabel")}
              </span>
              <span className="text-ink/80">
                {formatDay(upcomingClass.startsAt, CANONICAL_TZ)}
                {" · "}
                {formatTime(upcomingClass.startsAt, CANONICAL_TZ)}
              </span>
              <span dir="auto" className="text-ink/55">{upcomingClass.title}</span>
            </p>
          ) : null}

          <p className="mt-5">
            <Link
              href="/calendar"
              data-cta="home_tuition_timetable"
              className="group inline-flex items-center gap-1.5 text-sm text-ink/70 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {t("home.liveTuitionTimetable")}
              <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
            </Link>
          </p>
        </div>
      </section>

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
      <Section id="products" title={t("home.productsTitle")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/resources", cta: "pillar_resources_clicked", label: t("nav.resources"),
              eyebrow: t("home.pillarResourcesEyebrow"),
              body: t("home.pillarResourcesBody"),
              action: t("home.pillarResourcesAction"),
            },
            {
              href: "/past-papers", cta: "pillar_past_papers_clicked", label: t("nav.pastPapers"),
              eyebrow: t("home.pillarPastPapersEyebrow"),
              body: t("home.pillarPastPapersBody"),
              action: t("home.pillarPastPapersAction"),
            },
            {
              href: "/exam-builder", cta: "pillar_exam_builder_clicked", label: t("nav.examBuilder"),
              eyebrow: t("home.pillarExamBuilderEyebrow"),
              body: t("home.pillarExamBuilderBody"),
              /* ⚠ NOT "Build an Exam →" (§16). The engine does not exist; the
                 page it opens says so in its first sentence. A pillar promising
                 the verb would be the fake product /exam-builder was written to
                 avoid, three sections higher up the same page. */
              action: t("home.pillarExamBuilderAction"),
            },
            {
              href: "/tuition", cta: "pillar_online_tuition_clicked", label: t("nav.onlineTuition"),
              eyebrow: t("home.pillarTuitionEyebrow"),
              /* ⚠ §2 — "or book available 1-to-1 tuition" was the requested
                 copy; booking is not live, so the sentence tracks the offer. */
              body: tuition.bookable
                ? t("home.pillarTuitionBodyBookable")
                : t("home.pillarTuitionBody"),
              action: t("home.pillarTuitionAction"),
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
        title={t("home.tryTitle")}
        lede={t("home.tryLede")}
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
        title={t("home.howTitle")}
        lede={t("home.howLede")}
      >
        {/* ⚠ NUMBERED BECAUSE IT IS GENUINELY A SEQUENCE. A student does these
            in this order and each depends on the last — which is the only thing
            that justifies 01/02/03 markers. Numbering a set of unordered
            features would be decoration pretending to be structure. */}
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [t("home.stepLearn"), t("home.stepLearnBody")],
            [t("home.stepPractise"), t("home.stepPractiseBody")],
            [t("home.stepSubmit"), t("home.stepSubmitBody")],
            [t("home.stepGetMarked"), t("home.stepGetMarkedBody")],
            [t("home.stepImprove"), t("home.stepImproveBody")],
            [t("home.stepMaster"), t("home.stepMasterBody")],
          ].map(([step, body], i) => (
            <li key={step} className="rounded-lg border border-ink/10 bg-snow p-6">
              <span className="font-mono text-[11px] text-ink/40">0{i + 1}</span>
              <h3 className="font-display mt-3 text-xl font-medium">{step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ⚠ THE LIVE-TUITION SECTION USED TO SIT HERE, AND IT NOW SITS BELOW
          SUBJECTS (§5). A reader met three priced cohort cards before the page
          had said which sciences Ailemy teaches — so a parent looking for
          Biology was asked to consider a Chemistry price before learning
          Biology is demand-triggered. The compact tuition block after the hero
          answers "can I book?" early; this answers "what exactly, and how
          much?" after the subject question is settled. */}

      {/* ── PROOF: ONE SECTION WHERE THERE WERE THREE (§28, §30) ─────────
          ============================================================
          ⚠ MARKING, PROGRESS AND PAST PAPERS WERE THREE EXPLANATIONS OF ONE
          IDEA, AND THE PAGE MADE A READER SCROLL THROUGH ALL THREE
          ============================================================
          "Understand the mark scheme", "Know exactly what you know" and
          "Don't just download a past paper" each opened with a heading, a
          lede and a bordered panel — 1,439px of page at 1440 and 1,690px on a
          phone to say: sit a paper, see where the marks went, know what to do
          next. That is one argument in three acts, and §30 is explicit that it
          should not occupy three sections.

          ⚠ THE PROGRESS BAR CHART IS GONE, DELIBERATELY, AND THAT IS §29.
          It rendered "Atomic Structure 100% · Bonding 82% · Energetics 56% ·
          Kinetics 31%" under an "Example view" label. Nobody has progress: the
          completion tables are parked and unapplied, so those four numbers
          were invented and the label was the only thing standing between them
          and a claim. A dashboard captioned "sample data" is weaker than no
          dashboard — it asks the reader to trust a picture of something that
          does not exist yet. What progress DOES is said in words instead, and
          the picture arrives when there is one to draw.

          ⚠ NOTHING ELSE WAS DROPPED. Both past-paper routes, all four marking
          steps and the progress claim are all still here, in a third of the
          height. */}
      <Section
        /* The one anchor of the three most likely to have been shared. */
        id="progress"
        title={t("home.progressTitle")}
        lede={t("home.progressLede")}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── 1. sit the paper ─────────────────────────────────────── */}
          <div className="rounded-lg border border-ink/10 bg-snow p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              {t("home.proofSitEyebrow")}
            </p>
            <h3 className="font-display mt-2 text-lg font-medium tracking-tight">
              {t("home.proofSitTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              {t("home.proofSitBody")}
            </p>
            <p className="mt-3 text-sm font-medium">
              <Link
                href="/past-papers"
                data-cta="proof_past_papers"
                /* ⚠ py-3.5 IS A TOUCH TARGET, NOT SPACING. Measured at 375px
                   these rendered 17px tall; 17 + 14 + 14 = 45, and the
                   cancelling negative margin means the type and the layout are
                   unchanged. Same fix as the calendar's selection trail. */
                className="-my-3.5 inline-block py-3.5 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {t("home.browsePastPapers")} →
              </Link>
            </p>
          </div>

          {/* ── 2. where the marks went ──────────────────────────────── */}
          <div className="rounded-lg border border-ink/10 bg-snow p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              {t("home.proofMarksEyebrow")}
            </p>
            <h3 className="font-display mt-2 text-lg font-medium tracking-tight">
              {t("home.proofMarksTitle")}
            </h3>
            {/* All four steps kept — this is the substance of the claim. */}
            <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink/70">
              <li><span className="font-mono text-[10px] text-ink/40">01</span>&nbsp; Your answer, as you wrote it.</li>
              <li><span className="font-mono text-[10px] text-ink/40">02</span>&nbsp; The phrase that earned the mark, highlighted.</li>
              <li><span className="font-mono text-[10px] text-ink/40">03</span>&nbsp; The criterion it satisfied — or did not.</li>
              <li><span className="font-mono text-[10px] text-ink/40">04</span>&nbsp; What would have earned the mark you missed.</li>
            </ol>
            <p className="mt-3 text-sm font-medium">
              <Link
                href="/#try"
                data-cta="proof_try_marking"
                /* ⚠ py-3.5 IS A TOUCH TARGET, NOT SPACING. Measured at 375px
                   these rendered 17px tall; 17 + 14 + 14 = 45, and the
                   cancelling negative margin means the type and the layout are
                   unchanged. Same fix as the calendar's selection trail. */
                className="-my-3.5 inline-block py-3.5 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {t("home.seeItMarkAnAnswer")} →
              </Link>
            </p>
          </div>

          {/* ── 3. what to do next ───────────────────────────────────── */}
          <div className="rounded-lg border border-ink/10 bg-snow p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              {t("home.proofNextEyebrow")}
            </p>
            <h3 className="font-display mt-2 text-lg font-medium tracking-tight">
              {t("home.proofNextTitle")}
            </h3>
            {/* ⚠ WORDS, NOT A CHART. See the header — nobody has progress yet,
                so a bar chart here would be four invented percentages behind a
                caption. This describes what the feature does, which is true. */}
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              {t("home.proofNextBody")}
            </p>
            <p className="mt-3 text-sm font-medium">
              <Link
                href="/resources"
                data-cta="proof_resources"
                /* ⚠ py-3.5 IS A TOUCH TARGET, NOT SPACING. Measured at 375px
                   these rendered 17px tall; 17 + 14 + 14 = 45, and the
                   cancelling negative margin means the type and the layout are
                   unchanged. Same fix as the calendar's selection trail. */
                className="-my-3.5 inline-block py-3.5 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {t("home.findSomethingToStudy")} →
              </Link>
            </p>
          </div>
        </div>
      </Section>

      {/* ⚠ TWO SECTIONS STOOD HERE AND BOTH WERE DUPLICATES (§34, §43).
          ============================================================
          "Everything for your course" listed nine capability chips —
          Lessons, Revision notes, Topic questions, Past papers, Mark schemes,
          Examiner reports, Interactive papers, plus two marked "coming soon".
          The same inventory is already the four product cards and the hero's
          Explore panel, so the page stated its contents three times and the
          third carried the build-state language §63 asks to keep off the front
          door.

          "Looking for another science?" offered Biology and Physics as
          register-interest cards, duplicating "Three sciences, one platform"
          two screens above AND framing both subjects as tuition-only — when
          they hold roughly 90 and 72 past papers today. §35 is explicit that
          resources and tuition are different facts; the subject cards now say
          what each subject actually holds.

          ⚠ NO ROUTE WAS REMOVED. /chemistry, /biology, /physics and
          /tuition/interest all still resolve, and the guard checks them. */}

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
      <Section id="subjects" title={t("home.subjectsTitle")}>
        <div className="grid gap-4 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <SubjectCard
              key={s.slug}
              subject={{
                slug: s.slug, name: s.name, qualifications: s.qualifications,
                blurb: s.blurb, status: s.status, exploreHref: s.exploreHref,
              }}
              /* ⚠ §35 — WHAT THE SUBJECT HOLDS, NOT WHETHER A COHORT IS OPEN.
                 The default eyebrow is the TUITION status, so Biology and
                 Physics read "Register interest" while holding roughly 90 and
                 72 past papers between them. Resources and tuition are
                 different facts; stating the shelves is the honest one, and it
                 is the same counted label /resources already uses. */
              eyebrow={holdingsLabel(holdings[s.slug] ?? EMPTY_HOLDINGS)}
              dataCta="subject_selected"
            />
          ))}
        </div>
      </Section>

      {/* ── 6. live tuition, AND THE CALENDAR THAT USED TO BE IN THE HERO ──
          §5 puts this after Subjects: "what exactly, and how much?" is the
          question a reader has AFTER "do you teach my subject?", not before
          it. The compact block under the hero already answered "can I book?" */}
      <Section
        id="tuition"
        title={t("home.tuitionSectionTitle")}
        lede={t("home.tuitionSectionLede")}
      >
        {/* ── §67 — VALUE BEFORE PRICE ──────────────────────────────────
            ⚠ ABOVE THE CARDS, NOT INSIDE THEM. A parent reading £169 needs to
            already know it is not four Zoom hours. Repeating this list in each
            card would be three copies of the same sentence competing with the
            details that differ between programmes. */}
        <div className="mb-6 rounded-lg border border-ink/10 bg-parchment-2/40 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            {t("home.everyProgrammeIncludes")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/70">
            {[
              t("home.includesLiveTeaching"), t("home.includesPlatformAccess"), t("home.includesHomework"),
              t("home.includesExamPractice"), t("home.includesMarkingFeedback"), t("home.includesProgressTracking"),
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
          {t("home.lookingForSomethingElse")}{" "}
          <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
            {t("home.oneToOneChemistryLimitedBlocks")}
          </Link>
          .
        </p>

        {/* ⚠ THE ID TRAVELS WITH THE ELEMENT, NOT WITH THE HERO. qs() appends
            #hero-calendar to the mode links, so the anchor must stay attached
            to this div wherever it lives — renaming it would break a fragment
            that is already generated in two places. */}
        <div id="hero-calendar" className="mt-8">
          {/* ── §9/§12 — WHAT YOU CAN BOOK, THEN THE CALENDAR ───────────────
              The month grid used to lead this column, which asked a stranger
              to interpret an empty August before seeing anything bookable.
              The availability card states the next real session and what to do
              about it; the grid stays underneath as supporting detail, reading
              the same events. */}
          <HeroAvailability
            mode={heroMode}
            /* ⚠ FORWARD-LOOKING, NOT THE VISIBLE MONTH — the same defect the
               calendar shortcuts had. Fed the month window, this said "no
               group lessons are scheduled" for the whole of August, because
               teaching starts on 13 September. aheadEvents is the 120-day read
               this page already performs, so it costs no extra query. */
            events={calendarEvents.length > 0 ? calendarEvents : aheadEvents}
            viewerTz={viewerTz}
            now={new Date()}
            capacity={heroCapacity}
            group={group}
            oneToOne={oneToOne}
            /* ⚠ qs() ALREADY APPENDS #hero-calendar — adding it again produced
               /?tuition=group#hero-calendar#hero-calendar, which is not a
               valid fragment and would have scrolled nowhere. */
            hrefFor={(m) => qs({ tuition: m })}
          />

          <div className="mt-4">
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
      <section aria-labelledby="audience-heading" className="ai-band">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
          <h2 id="audience-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            {t("home.audienceHeading")}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                who: t("home.audienceStudent"),
                cta: "audience_student_clicked",
                href: "/resources",
                body: t("home.audienceStudentBody"),
                action: t("home.startLearningFree"),
              },
              {
                who: t("home.audienceParent"),
                cta: "audience_parent_clicked",
                href: "/tuition",
                body: t("home.audienceParentBody"),
                action: t("home.audienceParentAction"),
              },
              {
                who: t("home.audienceTeacher"),
                cta: "audience_teacher_clicked",
                href: "/resources",
                /* ⚠ NO CLASS LISTS, NO ASSIGNMENTS, NO ANALYTICS — none exist. */
                body: t("home.audienceTeacherBody"),
                action: t("home.audienceTeacherAction"),
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

      {/* ⚠ THE "WHAT YOU CAN DO ON AILEMY" BAND STOOD HERE, AND ITS SEVEN
          PILLS NOW SIT IN THE HERO (§13). Only the presentation went: the
          seven destinations are unchanged and still come from
          capabilitiesFor(), which ExplorePanel imports rather than copies.
          CapabilityStrip itself is retained — it had exactly one caller, this
          band, but it carries the focus-ring and scroll-clearance arithmetic
          that took real measurement to get right, and deleting a component
          because its only caller moved is how that work gets redone later.

          ⚠ THE FOUR PRODUCT PILLARS ARE A DIFFERENT SECTION AND ARE UNTOUCHED.
          They are `id="products"`, "Four ways to use Ailemy", added by the
          homepage-conversion build and still directly below the hero. */}

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
      <section aria-label={t("home.trustStripLabel")} className="ai-band">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-10">
            {[
              t("home.trustSpecificationMapped"),
              t("home.trustMarkSchemeInformed"),
              t("home.trustEveryAnswerMarked"),
              t("home.trustProgressTracked"),
              t("home.trustBuiltBySpecialists"),
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
      <Section id="teachers" title={t("home.teachersTitle")}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [t("home.teacherCardMarkSchemesTitle"), t("home.teacherCardMarkSchemesBody")],
            [t("home.teacherCardReviewedTitle"), t("home.teacherCardReviewedBody")],
            [t("home.teacherCardDesignedTitle"), t("home.teacherCardDesignedBody")],
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
          {t("home.examBoardDisclaimer")}
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
          { label: t("home.proofPapersCompleted"), value: null, unit: t("home.proofUnitPapers") },
          { label: t("home.proofAnswersMarked"), value: null, unit: t("home.proofUnitAnswers") },
        ]}
      />

      {/* ── 12b. FAQ (§30, §27 position 13) ─────────────────────────────
          ⚠ IMMEDIATELY BEFORE THE FINAL CTA, WHICH IS THE POINT. These are
          conversion objections — is it free, do I need tuition, is my board
          supported — and answering them anywhere else means the visitor meets
          the last ask still carrying the doubt. */}
      <Section id="faq" title={t("home.faqTitle")}>
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
      <Section id="start" title={t("home.finalCtaTitle")}>
        <div className="flex flex-wrap gap-3">
          <Link
            href={session ? "/profile" : "/signup"}
            data-cta="final_cta"
            className="group rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {session ? t("home.continueStudying") : t("home.startLearningFree")}{" "}
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
            /* ⚠ §50 — THE MODAL HAD NO JUMP CONTROL AT ALL. It passed an
               emptyMessage and nothing else, so the two doors into the same
               calendar disagreed about what an empty month offers: /calendar
               had a way forward, the homepage overlay had a blank grid and a
               sentence. `upcomingLesson` is the forward read this page already
               performs for the hero card, so it costs no extra query. */
            nextGroupAhead={upcomingLesson.kind === "session"
              ? { event: upcomingLesson.event, dateISO: upcomingLesson.dateISO }
              : null}
            /* §66 — real slots only; there are none today. */
            nextPrivateAhead={nextAvailableSlot(aheadEvents, { now: new Date() })}
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
    <section id={id} className="ai-band py-10 sm:py-18">
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
      <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-5 sm:p-7">
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
      className="p-5 sm:p-7"
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
