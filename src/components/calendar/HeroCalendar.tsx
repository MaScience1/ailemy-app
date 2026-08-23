import Link from "next/link";

import type { CalendarEvent } from "@/lib/calendar/types";
import type { CalendarState } from "@/lib/calendar/grid";

import { Calendar } from "./Calendar";
import { CalendarOverlay } from "./CalendarOverlay";

/**
 * The calendar in the hero: a live card that opens into the real thing.
 *
 * ============================================================================
 * ⚠ OPEN/CLOSED IS A URL, NOT A useState
 * ============================================================================
 * `?calendar=open` renders the overlay on the server. The card is a link, the
 * scrim is a link, the close control is a link — so the whole interaction
 * works with JavaScript disabled, is shareable, and survives a reload. This is
 * the shape DayPanel already uses for `?day=`, and it is why the only client
 * code here is Escape and a focus trap.
 *
 * ⚠ THE CARD IS A LIVE RENDER, NOT A PICTURE. Same reader, same events, same
 * month maths, same two glyphs as the full grid. It shows dots because 62px of
 * cell cannot hold a chip honestly — see Calendar's `variant` note.
 *
 * ⚠ AND THE CARD IS EXACTLY ONE TAB STOP. The compact variant renders no
 * links, so wrapping it does not nest interactive elements and a keyboard user
 * gets one target with a real description rather than 42 dead cells.
 */

export function HeroCalendarCard({
  events, state, todayISO, viewerTz, openHref, eventCount, next, jumpHref,
}: {
  events: readonly CalendarEvent[];
  state: CalendarState;
  todayISO: string;
  viewerTz: string | null;
  openHref: string;
  eventCount: number;
  /** The next real group lesson, from anywhere in the schedule (§63). */
  next?: { title: string; dayLabel: string; timeLabel: string; distance: string } | null;
  /** Where "jump to it" goes — the month that lesson falls in (§41). */
  jumpHref?: string;
}) {
  return (
    <div className="w-full max-w-[520px]">
      <Link
        href={openHref}
        scroll={false}
        aria-haspopup="dialog"
        /**
         * ⚠ THE ACCESSIBLE NAME SAYS WHAT IS IN IT AND WHAT HAPPENS NEXT. "Live
         * timetable" alone would not tell a screen-reader user that activating
         * this opens a dialog rather than navigating away.
         */
        aria-label={
          eventCount > 0
            ? `Open the Ailemy calendar. ${eventCount} ${eventCount === 1 ? "lesson" : "lessons"} in view this month.`
            : "Open the Ailemy calendar."
        }
        className="group block rounded-xl border border-ink/12 bg-snow p-4 shadow-[0_1px_3px_rgba(15,20,25,0.06)]
          transition-[transform,box-shadow] duration-150 ease-out
          hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-12px_rgba(15,20,25,0.28)]
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
          motion-reduce:transform-none motion-reduce:transition-none"
      >
        <Calendar
          variant="compact"
          events={events}
          state={state}
          todayISO={todayISO}
          viewerTz={viewerTz}
          mode="public"
          basePath="/"
        />
        {/* ── §63: the component must not look empty ────────────────────
            ⚠ THE MONTH IN VIEW AND THE NEXT LESSON ARE DIFFERENT QUESTIONS,
            and answering only the first is what made August look like nothing
            is happening. The grid still shows the current month; this line
            answers "when does teaching actually start", which is the question
            a visitor in the summer is really asking.

            ⚠ IT IS SUPPRESSED WHEN THE LESSON IS ALREADY ON SCREEN. If the
            month in view contains events, repeating one of them under the grid
            is noise — the grid already said it. */}
        {next && eventCount === 0 && (
          <span className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md bg-parchment-2/70 px-3 py-2">
            {/* ⚠ "SESSION", NOT "LESSON". 0044's session kinds are teaching,
                onboarding, revision, mock and clinic — and the first thing in
                the seeded AS timetable is onboarding on Sun 13 Sept, not a
                lesson. Labelling a mock or a clinic "next live lesson" would be
                wrong about the one fact this line exists to state. */}
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
              Next live session
            </span>
            <span className="text-[13px] font-medium">{next.dayLabel}</span>
            <span className="text-[13px] text-ink/70">{next.title}</span>
            <span className="font-mono text-[10px] text-ink/50">{next.timeLabel}</span>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
              {next.distance}
            </span>
          </span>
        )}

        <span className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2.5">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
              <span aria-hidden className="h-2 w-1 shrink-0 rounded-full bg-ink/70" />
              Group
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-ink/60" />
              1-to-1
            </span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45 group-hover:text-ink/70">
            Tap to explore →
          </span>
        </span>
      </Link>

      {/* ── §11: the caption is a headline, not a description ───────────
          ⚠ THE OLD LINE DESCRIBED THE COMPONENT. "Live timetable — every group
          lesson and 1-to-1 slot" tells a visitor what they are looking at,
          which they can already see. §11 asks for something functional: a
          headline that says what they can DO, more prominent than the
          supporting sentence, and the whole block clickable.

          ⚠ AND IT IS A SEPARATE LINK FROM THE CARD, not a second one nested
          inside it. Nesting anchors is invalid and makes the inner one
          keyboard-unreachable; two siblings pointing at the same href give a
          keyboard user two stops, which is the correct cost of two visible
          affordances. */}
      <Link
        href={openHref}
        scroll={false}
        aria-haspopup="dialog"
        data-cta="hero_calendar_clicked"
        className="group/cap mt-4 block rounded-lg px-1 py-1 transition-colors duration-200 hover:bg-parchment-2/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {/* §11 — "happening" describes weather; "available" describes an
            offer the reader can act on. */}
        <span className="font-display block text-lg font-medium tracking-tight">
          See what&rsquo;s available this week.
        </span>
        {/* ⚠ THIS LINE PROMISED A BOOKING THE CALENDAR CANNOT TAKE. It said
            "book tuition directly from the Ailemy calendar". There is no
            booking control anywhere in this component or in DayPanel — the
            private-slot branch there says "Booking opens soon" and links to
            register interest, because CHECKOUT_BUILT is false and nothing in
            src/ ever inserts a booking_holds row. Describing the one thing the
            surface cannot do, in the sentence that sells the surface, is the
            dead CTA rule broken in prose instead of in a button.

            What it CAN do is stated instead, and it matches DayPanel exactly so
            the caption and the thing it opens cannot disagree.

            ⚠ AND THE CLAIM IS ABOUT THIS SURFACE, NOT ABOUT THE PRODUCT. A flat
            "Booking is not open yet" was untrue twice over. HomeFaq — rendered
            further down THIS SAME PAGE — answers "Can I book 1-to-1 tuition?"
            with "Booking is arranged directly at the moment", and a signed-in
            student holding a lesson credit really can book, instantly, through
            BookWithCredit on /tuition/one-to-one; canRedeem never consults
            Stripe. Telling the customer who has already paid us that booking is
            shut is the same class of falsehood as the sentence this replaced,
            pointed the other way. What is true for every reader is that the
            CALENDAR takes no bookings, so that is what it says. */}
        {/* ⚠ §11 ASKED FOR THIS TO BE SHORTER, NOT FOR THE CAVEAT TO GO.
            "Avoid long explanatory paragraphs beneath the calendar" — so the
            sentence is tightened. What it must keep is the fact that this
            surface takes no booking, which is the one thing a reader could
            otherwise get wrong from a heading that says "available". */}
        <span className="mt-1 block text-sm leading-snug text-ink/60">
          Browse group lessons and real 1-to-1 availability. Open a day to register interest
          in a time — the calendar does not take bookings yet.
        </span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium">
          <span className="underline decoration-transparent underline-offset-4 transition-colors duration-200 group-hover/cap:decoration-current">
            Open full timetable
          </span>
          <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover/cap:translate-x-1">→</span>
        </span>
      </Link>
    </div>
  );
}

/**
 * The expanded state: the complete /calendar experience, in a dialog.
 *
 * ⚠ FULL-SCREEN ON A PHONE, CENTRED ON A DESKTOP. A month grid inside a
 * shrunken modal on a 375px screen is the worst of both; the sheet pattern the
 * day panel already uses is the one a phone expects.
 */
export function HeroCalendarOverlay({
  children, closeHref,
}: {
  children: React.ReactNode;
  closeHref: string;
}) {
  return (
    <CalendarOverlay closeHref={closeHref}>
      {/* ⚠ THE SCRIM IS A LINK, so dismissing works with no JavaScript. */}
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close the calendar"
        tabIndex={-1}
        className="fixed inset-0 z-40 bg-ink/30 motion-safe:transition-opacity motion-safe:duration-150"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="The Ailemy calendar"
        /* ⚠ 150ms, AND THE KEYFRAME IS INSIDE A prefers-reduced-motion: no-preference
           BLOCK — so for a reader who asked for less motion it does not run at
           all, rather than running faster. See globals.css. */
        className="ailemy-calendar-expand fixed inset-0 z-50 flex flex-col overflow-y-auto border-ink/15 bg-parchment
          sm:inset-x-6 sm:inset-y-8 sm:mx-auto sm:max-w-5xl sm:rounded-2xl sm:border sm:shadow-[0_24px_64px_-24px_rgba(15,20,25,0.45)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink/10 bg-parchment/95 px-5 py-3.5 backdrop-blur-sm sm:px-6">
          <h2 className="font-display text-lg font-medium tracking-tight">The Ailemy Calendar</h2>
          <div className="flex items-center gap-4">
            {/* ⚠ THE SHAREABLE URL LIVES HERE. A dialog cannot be sent to
                somebody; /calendar can. */}
            <Link
              href="/calendar"
              className="text-xs underline underline-offset-2 text-ink/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Open full calendar →
            </Link>
            <Link
              href={closeHref}
              scroll={false}
              aria-label="Close the calendar"
              className="rounded-full border border-ink/20 px-2.5 py-1 font-mono text-xs leading-none text-ink/70 hover:border-ink/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              ✕<span className="sr-only"> Close</span>
            </Link>
          </div>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </CalendarOverlay>
  );
}
