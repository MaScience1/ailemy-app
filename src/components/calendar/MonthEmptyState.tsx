import Link from "next/link";

import type { CalendarEvent } from "@/lib/calendar/types";
import { ONE_TO_ONE, subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { dualTime } from "@/lib/schedule/timezone";

/**
 * What a month with no sessions says for itself (§50).
 *
 * ============================================================================
 * ⚠ THE MESSAGE EXISTED. IT WAS BELOW A SIX-ROW BLANK GRID.
 * ============================================================================
 * /calendar already rendered "No lessons are scheduled in this period" and a
 * "Jump to Sun 13 Sept" link — underneath the month grid. On a 900px laptop
 * the August grid fills the viewport, so the explanation sat off-screen and
 * the page read exactly as §50 describes: a blank grid expecting the student
 * to navigate manually. A true sentence nobody can see is not an empty state.
 *
 * So this renders ABOVE the grid, carries the next real lesson's date AND
 * time, and offers the jump as a control rather than a footnote. The grid
 * stays below it, because paging is still how a student explores.
 *
 * ⚠ ONE COMPONENT, BOTH SURFACES. /calendar and the homepage modal render the
 * same thing; the modal previously passed an emptyMessage and no jump at all,
 * so the two doors into the calendar disagreed about what an empty month even
 * says. §2's "one calendar system" is not only about data.
 *
 * ⚠ §66 — THE 1-TO-1 LINE APPEARS ONLY IF A REAL SLOT EXISTS. There are no
 * rows in teacher_availability, so today it renders nothing rather than a
 * "Find next 1-to-1" that would lead to an empty page. The caller passes the
 * slot it actually found; null means silence, never a placeholder.
 */

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "September" from an ISO day, read as a UTC calendar date. */
export function monthNameOf(dayISO: string): string {
  const m = Number(dayISO.slice(5, 7));
  return MONTH_LONG[m - 1] ?? "";
}

export function MonthEmptyState({
  nextGroup, nextPrivate, viewerTz, jumpHref, upcomingHref, oneToOneHref, note,
}: {
  /** The next real group lesson, from the forward read. Null if none. */
  nextGroup: { event: CalendarEvent; dateISO: string } | null;
  /** §66 — a real open slot, or null. Never a stand-in. */
  nextPrivate: CalendarEvent | null;
  viewerTz: string | null;
  /** Where "Jump to September" goes — built by the caller from dateISO. */
  jumpHref: (dateISO: string) => string;
  upcomingHref: string;
  oneToOneHref: string;
  /**
   * The caller's own sentence about WHY the month is empty — before term, a
   * filter that matched nothing. Derived by the page, never guessed here.
   */
  note?: string;
}) {
  const when = (e: CalendarEvent) => {
    const t = dualTime(e.startsAt, viewerTz);
    return t.canonical + (t.viewer ? ` · ${t.viewer}` : "");
  };

  return (
    <div className="rounded-xl border border-ink/15 bg-snow px-5 py-5">
      <h3 className="font-display text-xl font-medium tracking-tight">No tuition this month.</h3>
      {note && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">{note}</p>}

      {nextGroup && (
        <div
          style={subjectVars(subjectColour(nextGroup.event.subject))}
          className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-[var(--subject-accent)] pl-3"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--subject-text)]">
            Next group lesson
          </span>
          {/* §50 asks for the date AND the time — a date alone does not tell a
              student whether they can be there. */}
          <span className="text-sm font-medium text-ink">
            {nextGroup.event.startsAt.getUTCDate()} {monthNameOf(nextGroup.dateISO)}
          </span>
          <span className="font-mono text-xs tabular-nums text-ink/70">{when(nextGroup.event)}</span>
          <span className="text-sm text-ink/70">{nextGroup.event.title}</span>
        </div>
      )}

      {/* ⚠ §66 — RENDERED ONLY WHEN A REAL SLOT EXISTS. */}
      {nextPrivate && (
        <div
          style={subjectVars(ONE_TO_ONE)}
          className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-[var(--subject-accent)] pl-3"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--subject-text)]">
            Next 1-to-1
          </span>
          <span className="font-mono text-xs tabular-nums text-ink/70">{when(nextPrivate)}</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {nextGroup && (
          <Link
            href={jumpHref(nextGroup.dateISO)}
            data-cta="calendar_jump_to_month"
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Jump to {monthNameOf(nextGroup.dateISO)}
            <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        )}
        <Link
          href={upcomingHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          See everything coming up <span aria-hidden>→</span>
        </Link>
        {/* ⚠ NOT "Find next 1-to-1" (§50). There is none to find; this is the
            page that takes an interest in a time, and it says so. */}
        <Link
          href={oneToOneHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {nextPrivate ? "Find next 1-to-1" : "Ask about 1-to-1 times"} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
