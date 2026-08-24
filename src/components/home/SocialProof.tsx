import type { ReactNode } from "react";

/**
 * Social-proof architecture, hidden until it has something true to say (§29).
 *
 * ============================================================================
 * ⚠ THE COMPONENT EXISTS. THE NUMBERS DO NOT. IT RENDERS NOTHING.
 * ============================================================================
 * §29 is explicit — do not invent metrics, do not invent reviews — and offers
 * two options: hide the metric until populated, or show only truthful
 * non-numeric trust signals. This does both: every metric is optional, any
 * metric whose value is null is dropped, and if nothing survives the whole
 * section returns null rather than rendering an empty shell.
 *
 * ⚠ SO THE HOMEPAGE HAS NO SOCIAL-PROOF SECTION TODAY, and that is the correct
 * output rather than a gap. Ailemy has one paper ruled end to end and no
 * students who have sat anything; a "students taught" counter would be a zero
 * or a lie, and both are worse than silence.
 *
 * ⚠ AND THERE IS NO PLACEHOLDER PROP. No `demo`, no `sampleData`, no default
 * of 1,200. A component that can render a fake number will eventually render
 * one — the safest architecture is one where the fake number has nowhere to live.
 *
 * WHEN IT LIGHTS UP: pass real figures from a reader. Suggested sources, all of
 * which are countable today and none of which is yet non-zero — exam_attempts
 * with submitted_at (papers completed), question_attempts (questions answered),
 * marking_results (answers marked). Testimonials need a store that does not
 * exist and are deliberately not modelled here.
 */

export type ProofMetric = {
  label: string;
  /** ⚠ null MEANS OMIT. There is no zero-fallback anywhere in this file. */
  value: number | null;
  /** "papers", "answers" — rendered after the number. */
  unit?: string;
};

export type ProofSignal = {
  /** A truthful non-numeric statement. No counts, no claims of scale. */
  text: ReactNode;
};

export function SocialProof({
  metrics = [],
  signals = [],
}: {
  metrics?: ProofMetric[];
  signals?: ProofSignal[];
}) {
  const shown = metrics.filter((m) => typeof m.value === "number" && m.value > 0);

  // ⚠ NOTHING TRUE TO SAY → NOTHING RENDERED. Not an empty band, not a
  // skeleton, not "coming soon".
  if (shown.length === 0 && signals.length === 0) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {shown.length > 0 && (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {shown.map((m) => (
            <div key={m.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                {m.label}
              </dt>
              <dd className="font-display mt-1 text-3xl font-medium tabular-nums">
                {m.value!.toLocaleString("en-GB")}
                {m.unit && <span className="ms-1.5 text-base text-ink/50">{m.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {signals.length > 0 && (
        <ul className="space-y-2 text-sm leading-relaxed text-ink/70">
          {signals.map((s, i) => <li key={i}>{s.text}</li>)}
        </ul>
      )}
    </div>
  );
}
