import Link from "next/link";

import { evidenceConfidenceFor, masteryPercent } from "@/lib/account/academic";
import type { CourseMastery, SeriesPoint } from "@/lib/specification/types";
import { CONFIDENCE_META, MasteryGlyph, STATE_META } from "./mastery-meta";

/**
 * The course mastery summary — counts, marks, and (since the §22 amendment)
 * the assessed-marks percentage, shown honestly.
 *
 * ============================================================================
 * ⚠ THE PERCENTAGE IS OF ASSESSED MARKS, NEVER OF THE SYLLABUS
 * ============================================================================
 * academic.ts §21/§22 as amended 2026-09-03: the figure below is
 * masteryPercent(awarded, outOf) over the marks actually assessed — it says
 * "of the work you've been marked on, this share was earned", with the
 * coverage caveat printed in the same breath ("across N of M points"). It
 * still never blends completion, performance and evidence quantity into one
 * number, and it comes from the ONE domain function — this component divides
 * nothing. The segmented strip below is COUNTS drawn to width — every segment
 * is a number printed right beside it.
 */
export function MasterySummary({
  mastery,
  examUnmapped = 0,
  series = [],
}: {
  mastery: CourseMastery;
  /** Marked exam questions with no spec-point tag yet — counted by the exam
   *  evidence loader so this panel can say what is missing. */
  examUnmapped?: number;
  /** history.ts's weekly cumulative series — rendered as a plain arrow line
   *  ("42% → 51% → 63%"): accessible, honest, and no chart library. */
  series?: SeriesPoint[];
}) {
  const s = mastery.summary;
  const practised = s.pointsTotal - s.unstarted;

  if (practised === 0) {
    return (
      <section aria-labelledby="mastery-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
        <h2 id="mastery-heading" className="font-display text-lg font-medium tracking-tight">
          Your mastery
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Nothing recorded yet. Answer the practice questions on any published
          lesson and this map starts filling in — every specification point you
          practise gets a state you can check.
        </p>
      </section>
    );
  }

  const bands = (["secure", "developing", "emerging", "insufficient", "unstarted"] as const).map(
    (state) => ({ state, count: s[state] }),
  );

  // The one percentage function (§22 as amended) — null below the floor, and
  // then this panel shows counts and marks alone, exactly as it always did.
  const percent = masteryPercent(s.awarded, s.outOf);
  const confidence = s.outOf > 0 ? evidenceConfidenceFor(s.outOf) : null;
  const examMarks = mastery.bySource.exam.outOf;

  return (
    <section aria-labelledby="mastery-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="mastery-heading" className="font-display text-lg font-medium tracking-tight">
        Your mastery
      </h2>

      {percent !== null && confidence !== null && (
        <p className="mt-2">
          <span className="font-display text-3xl font-medium tracking-tight">{percent}%</span>
          <span className="ms-2 text-xs text-ink/55">
            of assessed marks · {CONFIDENCE_META[confidence]}
          </span>
        </p>
      )}

      <p className="mt-2 text-sm text-ink/70">
        {practised} of {s.pointsTotal} specification point{s.pointsTotal === 1 ? "" : "s"} practised
        · {s.awarded} of {s.outOf} marks earned
        {examMarks > 0 &&
          ` · includes ${examMarks} mark${examMarks === 1 ? "" : "s"} from marked exam papers`}
      </p>

      <TrendLine series={series} />

      {/* Counts drawn to width. Decorative — the legend carries every number.
          Unstarted points are the unpainted track itself: what has not begun
          should recede, not dominate the strip in grey. */}
      <div aria-hidden className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-ink/5">
        {bands
          .filter((b) => b.count > 0 && b.state !== "unstarted")
          .map((b) => (
            <div
              key={b.state}
              style={{
                width: `${(b.count / s.pointsTotal) * 100}%`,
                background: STATE_META[b.state].tone,
              }}
            />
          ))}
      </div>

      <ul className="mt-4 grid gap-1.5">
        {bands.map((b) => (
          <li key={b.state} className="flex items-center gap-2 text-sm text-ink/75">
            <MasteryGlyph state={b.state} />
            <span className="flex-1">{STATE_META[b.state].label}</span>
            <span className="font-mono text-xs text-ink/55">{b.count}</span>
          </li>
        ))}
      </ul>

      {mastery.ignoredRows > 0 && (
        <p className="mt-3 text-xs text-ink/50">
          {mastery.ignoredRows} answer{mastery.ignoredRows === 1 ? "" : "s"} couldn&apos;t
          be matched to this specification and {mastery.ignoredRows === 1 ? "is" : "are"} not
          counted above.
        </p>
      )}

      {examUnmapped > 0 && (
        <p className="mt-3 text-xs text-ink/50">
          {examUnmapped} marked exam question{examUnmapped === 1 ? "" : "s"} aren&apos;t tagged to
          specification points yet, so they aren&apos;t counted above.
        </p>
      )}
    </section>
  );
}

/**
 * "Am I improving?" as a sentence: the last few weekly figures, oldest to
 * newest, joined by arrows. Rendered only when at least two points carry a
 * percent (the floor refused the rest) — one number is not a trend, and a
 * line invented around null points would be. The dates anchor the claim.
 */
function TrendLine({ series }: { series: SeriesPoint[] }) {
  const rated = series.filter((p) => p.percent !== null);
  if (rated.length < 2) return null;
  const shown = rated.slice(-4);
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <p className="mt-3 text-sm text-ink/75">
      <span className="font-mono">
        {shown.map((p) => `${p.percent}%`).join(" → ")}
      </span>
      <span className="ms-2 text-xs text-ink/50">
        {day(shown[0].atIso)} – {day(shown[shown.length - 1].atIso)}, weekly
      </span>
    </p>
  );
}

/** The signed-out substitute: the same panel, saying honestly why it is empty. */
export function SignedOutMastery({ signInHref }: { signInHref: string }) {
  return (
    <section aria-labelledby="mastery-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="mastery-heading" className="font-display text-lg font-medium tracking-tight">
        Your mastery
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">
        Sign in and your practice builds a mastery state for every specification
        point you work on.
      </p>
      <p className="mt-3 text-sm">
        <Link
          href={signInHref}
          className="underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sign in →
        </Link>
      </p>
    </section>
  );
}
