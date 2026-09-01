import Link from "next/link";

import type { CourseMastery } from "@/lib/specification/types";
import { MasteryGlyph, STATE_META } from "./mastery-meta";

/**
 * The course mastery summary — counts and marks, never a blended score.
 *
 * ============================================================================
 * ⚠ THERE IS NO "OVERALL MASTERY 67%" HERE, ON PURPOSE
 * ============================================================================
 * academic.ts §21/§22: a single number that blends completion, performance and
 * evidence quantity is a claim nobody can check, rendered with the authority
 * of arithmetic. What a student gets instead is what the record supports:
 * how many specification points sit in each state, and the marks those states
 * rest on. The segmented strip below is those COUNTS drawn to width — every
 * segment is a number printed right beside it.
 */
export function MasterySummary({ mastery }: { mastery: CourseMastery }) {
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

  return (
    <section aria-labelledby="mastery-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="mastery-heading" className="font-display text-lg font-medium tracking-tight">
        Your mastery
      </h2>

      <p className="mt-2 text-sm text-ink/70">
        {practised} of {s.pointsTotal} specification point{s.pointsTotal === 1 ? "" : "s"} practised
        · {s.awarded} of {s.outOf} marks earned
      </p>

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
          {mastery.ignoredRows} practice answer{mastery.ignoredRows === 1 ? "" : "s"} couldn&apos;t
          be matched to this specification and {mastery.ignoredRows === 1 ? "is" : "are"} not
          counted above.
        </p>
      )}
    </section>
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
