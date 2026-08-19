import type { CalendarSession } from "@/lib/schedule/readers";
import { CANONICAL_TZ, dualTime, formatDay } from "@/lib/schedule/timezone";

/**
 * How a lesson looks, everywhere (§17, §41).
 *
 * ⚠ ONE COMPONENT, FIVE SURFACES. The homepage preview, /calendar, /tuition and
 * the three subject pages all render this. A second implementation is how one
 * of them ends up showing a cancelled lesson as live, or dropping the Doha
 * label, six months from now.
 *
 * ⚠ THE TYPE BADGE IS NOT DECORATION (§41). A student must never mistake a
 * group class for something they can book privately. Group sessions say GROUP;
 * when 1-to-1 availability exists (Phase 6) it renders with its own badge and
 * its own affordance. Nothing here implies a session is bookable.
 *
 * ⚠ CANCELLED LESSONS ARE SHOWN, STRUCK THROUGH, WITH THE REASON. A lesson that
 * silently vanishes from a timetable reads as a bug and generates an email; one
 * marked "Cancelled — Winter break" answers the question before it is asked.
 * Callers that genuinely want live-only pass includeCancelled:false to the
 * reader, which is a data decision, not a rendering one.
 */
export function SessionList({
  sessions,
  viewerTz,
  emptyMessage,
}: {
  sessions: readonly CalendarSession[];
  viewerTz: string | null;
  emptyMessage: string;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm leading-relaxed text-ink/60">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {sessions.map((s) => {
        const start = dualTime(s.startsAt, viewerTz);
        const end = dualTime(s.endsAt, viewerTz);
        const cancelled = s.status === "cancelled";
        return (
          <li key={s.key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
            <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
              {formatDay(s.startsAt, CANONICAL_TZ)}
            </span>

            <span className={`min-w-0 flex-1 text-sm ${cancelled ? "text-ink/40 line-through" : "text-ink"}`}>
              {s.title ?? s.cohort.title}
            </span>

            <span className="shrink-0 rounded-full border border-ink/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
              Group
            </span>

            <span className={`shrink-0 text-sm ${cancelled ? "text-ink/40" : "text-ink/80"}`}>
              {/* Doha is always first and always named — the school runs on it. */}
              <span className={cancelled ? "line-through" : undefined}>
                {start.canonical}–{end.canonical}
              </span>{" "}
              <span className="font-mono text-[11px] text-ink/50">{start.canonicalLabel}</span>
              {start.viewer && (
                <span className="ml-2 font-mono text-[11px] text-ink/50">
                  {start.viewer}–{end.viewer} {start.viewerLabel}
                </span>
              )}
            </span>

            {cancelled && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Cancelled{s.cancelledReason ? ` · ${s.cancelledReason}` : ""}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
