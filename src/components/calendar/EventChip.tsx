import { dualTime } from "@/lib/schedule/timezone";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * One lesson, as it appears inside a day cell or a list row.
 *
 * ============================================================================
 * ⚠ TYPE IS NEVER CONVEYED BY COLOUR ALONE (§55, §59)
 * ============================================================================
 * Every chip carries a text label — GROUP or 1-TO-1 — and a shape marker. The
 * subject tint is decoration on top of that, never the signal itself. A student
 * with deuteranopia, a printed timetable, or a parent squinting at a phone in
 * sunlight all get the same information.
 *
 * ⚠ AND A CANCELLED LESSON IS SHOWN, STRUCK THROUGH, WITH ITS REASON. A lesson
 * that silently disappears from a calendar reads as a bug and generates an
 * email. "Cancelled — Winter break" answers the question before it is asked.
 */

const TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  group: "Group",
  private_open: "1-to-1",
  private_booked: "1-to-1",
};

/**
 * ⚠ A SHAPE, NOT JUST A HUE. The leading marker differs in FORM between group
 * and private — a filled bar versus a hollow ring — so the two are separable in
 * greyscale.
 */
export function TypeMarker({ type }: { type: CalendarEvent["type"] }) {
  if (type === "group") {
    return <span aria-hidden className="mt-[3px] h-2.5 w-1 shrink-0 rounded-full bg-ink/70" />;
  }
  return (
    <span
      aria-hidden
      className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-ink/60 bg-transparent"
    />
  );
}

export function EventChip({
  event, viewerTz, dense = false,
}: {
  event: CalendarEvent;
  viewerTz: string | null;
  dense?: boolean;
}) {
  const cancelled = event.status === "cancelled";
  const t = dualTime(event.startsAt, viewerTz);

  /**
   * ⚠ SUBJECT COLOUR ON GROUP EVENTS ONLY (§3, §6). A bookable 1-to-1 slot gets
   * the neutral outlined treatment §6 asks for, because it is a different KIND
   * of thing — an offer rather than a scheduled lesson — and painting it
   * chemistry orange would make it read as a fourth Chemistry class.
   *
   * ⚠ AND A CANCELLED LESSON LOSES ITS COLOUR. An orange bar beside struck-out
   * text says "this is happening, in Chemistry"; the strike-through and the
   * grey have to agree with each other.
   */
  const colour = event.type === "group" && !cancelled ? subjectColour(event.subject) : null;

  return (
    <span
      style={subjectVars(colour)}
      className={`flex items-start gap-1.5 ${dense ? "text-[11px] leading-tight" : "text-xs"} ${
        cancelled ? "text-ink/40" : "text-ink/85"
      }`}
    >
      {/* ⚠ A 2px RULE, NOT A FILLED CHIP. §3 says these are accents and the site
          must not become coloured blocks; in a 112px month cell a filled chip
          would also drown the text it is meant to label. */}
      {colour && (
        <span
          aria-hidden
          className="mt-[3px] h-[9px] w-[2px] shrink-0 rounded-full"
          style={{ background: "var(--subject-accent)" }}
        />
      )}
      <TypeMarker type={event.type} />
      <span className="min-w-0 flex-1">
        <span className={`font-mono tabular-nums ${cancelled ? "line-through" : ""}`}>{t.canonical}</span>{" "}
        <span className={`${cancelled ? "line-through" : ""}`}>{event.title}</span>
        {dense ? null : (
          <>
            <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
              {TYPE_LABEL[event.type]}
            </span>
            {/*
              ⚠ §20 — BOTH CLOCKS WHEREVER A TIME APPEARS AND THERE IS ROOM.
              This was Doha-only, so week and upcoming views quietly dropped the
              local time the toolbar promised. A dense month cell is the one
              exception: two clocks in a 112px square is unreadable, so the cell
              carries Doha, its aria-label carries both, and the toolbar says
              which is which rather than implying more than the cell shows.
            */}
            {t.viewer && (
              <span className="ml-1.5 font-mono text-[10px] text-ink/45">
                {t.viewer} {t.viewerLabel}
              </span>
            )}
          </>
        )}
      </span>
    </span>
  );
}

/**
 * The accessible description of one event, for a day cell's aria-label.
 *
 * ⚠ THIS IS WHAT A SCREEN READER ACTUALLY HEARS, so it says the type in words,
 * gives both clocks when they differ, and states cancellation first — a user
 * who hears "Chemistry, seven PM" and only later "cancelled" has been misled
 * for the length of the sentence.
 */
export function describeEvent(event: CalendarEvent, viewerTz: string | null): string {
  const s = dualTime(event.startsAt, viewerTz);
  const e = dualTime(event.endsAt, viewerTz);
  const when = s.viewer
    ? `${s.canonical} to ${e.canonical} ${s.canonicalLabel}, ${s.viewer} to ${e.viewer} ${s.viewerLabel}`
    : `${s.canonical} to ${e.canonical} ${s.canonicalLabel}`;
  const kind = event.type === "group" ? "group lesson" : "one to one";
  const head = event.status === "cancelled" ? "Cancelled: " : "";
  const reason = event.status === "cancelled" && event.cancelledReason ? `, ${event.cancelledReason}` : "";
  return `${head}${event.title}, ${kind}, ${when}${reason}`;
}
