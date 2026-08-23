import Link from "next/link";

import {
  WEEK_KIND_LABEL, cohortProgress, currentWeekNumber,
  type CourseRoadmap, type RoadmapWeek,
} from "@/lib/roadmap/model";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * The roadmap itself: phases, weeks, and the sessions inside them.
 *
 * ============================================================================
 * ⚠ EVERY TITLE ON THIS PAGE CAME OUT OF A ROW
 * ============================================================================
 * Phase names are unit names. Session titles are lesson titles. Dates are real
 * scheduled occurrences. This component types none of them and the guard fails
 * if it starts to — which is the difference between a roadmap and a brochure
 * that will disagree with the platform within a month.
 *
 * ⚠ ACCORDIONS ARE <details>, NOT useState. Thirty-six weeks of client state
 * to open a panel is JavaScript a phone has to download and run for something
 * the browser does natively — with keyboard support, screen-reader semantics
 * and find-in-page all working for free (§37, §38). It also means the whole
 * roadmap is in the HTML for a crawler (§36) and prints correctly (§20).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function range(startISO: string, endISO: string): string {
  const d = (iso: string) => Number(iso.slice(8, 10));
  const m = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
  return m(startISO) === m(endISO)
    ? `${d(startISO)}–${d(endISO)} ${m(endISO)}`
    : `${d(startISO)} ${m(startISO)} – ${d(endISO)} ${m(endISO)}`;
}

function Week({ week, isNow, accent }: { week: RoadmapWeek; isNow: boolean; accent: string }) {
  const titled = week.sessions.filter((s) => s.lessonTitle);
  return (
    <details
      className={`group/w rounded-xl border bg-snow transition-colors duration-200 ${
        isNow ? "border-[var(--subject-accent)]" : "border-ink/10 hover:border-ink/25"
      }`}
    >
      {/* ⚠ THE EVENT RIDES ON THE SUMMARY, so a native <details> still reports.
          Analytics.tsx listens for clicks on [data-cta], and opening an
          accordion IS a click — no client component, no state, no hydration. */}
      <summary data-cta="course_roadmap_week_expanded" className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <span className="font-mono w-14 shrink-0 text-[10px] uppercase tracking-[0.16em] text-ink/45">
          Wk {String(week.weekNumber).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            {titled[0]?.lessonTitle ?? "Scheduled teaching"}
          </span>
          <span className="font-mono mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {range(week.startISO, week.endISO)} · {WEEK_KIND_LABEL[week.kind]}
          </span>
        </span>
        {/* §10 — announced, not drawn only. */}
        {isNow && (
          <span className="font-mono shrink-0 rounded-full bg-[var(--subject-tint)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--subject-text)]">
            This week
          </span>
        )}
        <span aria-hidden className="shrink-0 text-ink/40 transition-transform duration-200 group-open/w:rotate-90">
          ›
        </span>
      </summary>

      <ul className="grid gap-2 border-t border-ink/10 px-4 py-3">
        {week.sessions.map((s) => (
          <li key={s.dayISO + (s.lessonId ?? "")} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-mono w-24 shrink-0 text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>
              {s.weekday}
            </span>
            {s.time && <span className="font-mono text-[11px] tabular-nums text-ink/55">{s.time}</span>}
            {/* ⚠ THE TITLE IS THE ROW'S. A date with no lesson says so. */}
            {s.lessonTitle ? (
              s.lessonHref ? (
                <Link
                  href={s.lessonHref}
                  data-cta="course_roadmap_resource_clicked"
                  className="min-w-0 flex-1 text-sm text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {s.lessonTitle}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 text-sm text-ink">{s.lessonTitle}</span>
              )
            ) : (
              <span className="min-w-0 flex-1 text-sm text-ink/45">Lesson to be confirmed</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function RoadmapPhases({ roadmap, todayISO }: { roadmap: CourseRoadmap; todayISO: string }) {
  const colour = subjectColour(roadmap.subject);
  const allWeeks = roadmap.phases.flatMap((p) => p.weeks);
  const now = currentWeekNumber(allWeeks, todayISO);
  const progress = cohortProgress(allWeeks, todayISO);

  if (allWeeks.length === 0) return null;

  return (
    <div style={subjectVars(colour)} className="grid gap-10">
      {/* ── §4 journey rail ─────────────────────────────────────────────── */}
      <nav aria-label="Course phases" className="-mx-1 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-2 px-1">
          {roadmap.phases.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-ink/25">→</span>}
              <a
                href={`#phase-${p.id}`}
                className="inline-flex min-h-[44px] items-center rounded-full border border-ink/15 px-3.5 py-2 text-[13px] transition-colors hover:border-[var(--subject-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {p.code ? <span className="font-mono mr-1.5 text-[10px] text-ink/45">{p.code}</span> : null}
                {p.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ── §12 cohort position, never a personal one ───────────────────── */}
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Where the class is
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
            {progress.taught} of {progress.total} weeks taught
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Weeks taught so far"
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        >
          <div className="h-full rounded-full bg-[var(--subject-accent)]" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      {roadmap.phases.map((p) => (
        <section key={p.id} id={`phase-${p.id}`} aria-labelledby={`h-${p.id}`} className="scroll-mt-24">
          <h3 id={`h-${p.id}`} className="font-display text-xl font-medium tracking-tight">
            {p.code ? <span className="font-mono mr-2 text-xs text-[var(--subject-text)]">{p.code}</span> : null}
            {p.title}
          </h3>
          <p className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-ink/45">
            {p.weeks.length} week{p.weeks.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 grid gap-2">
            {p.weeks.map((w) => (
              <Week key={w.weekNumber} week={w} isNow={w.weekNumber === now} accent={colour?.accent ?? "currentColor"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
