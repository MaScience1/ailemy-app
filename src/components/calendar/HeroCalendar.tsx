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
  events, state, todayISO, viewerTz, openHref, eventCount,
}: {
  events: readonly CalendarEvent[];
  state: CalendarState;
  todayISO: string;
  viewerTz: string | null;
  openHref: string;
  eventCount: number;
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

      {/* ⚠ ONE LINE, AND IT HAS TO WORK COLD. A parent who has never heard of
          Ailemy sees a small grid of dots; this is the sentence that turns it
          into a timetable they can act on. */}
      <p className="mt-3 text-sm leading-snug text-ink/60">
        Live timetable — every group lesson and 1-to-1 slot, in Doha time and yours. Tap to explore.
      </p>
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
