import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, Sparkles, X } from "lucide-react";

import type { MarkedQuestion, MarkingSummary } from "@/lib/exam/marking";

/**
 * "Learn how the marks are awarded" — the payoff.
 *
 * ============================================================================
 * TWO TOTALS, NEVER ONE
 * ============================================================================
 * Deterministic marks and AI marks are never added together into a single
 * score. A combined number would inherit the authority of the confirmed half
 * and the reliability of the provisional half, and a student would read it as
 * a grade. So the confirmed total is stated large and plainly, and provisional
 * marks are shown beside it, labelled, in a visually distinct treatment that
 * never resolves into a grade.
 *
 * ============================================================================
 * WHAT THIS COMPONENT IS NOT GIVEN
 * ============================================================================
 * Its props carry awarded counts and per-point evidence written for the
 * student. No criterion, no accept/reject rule, no guidance, no expected
 * answer for a question the student got wrong. The mark scheme is read
 * server-side in marking.ts and dies there — this is a Server Component and
 * there is nothing in its props a browser could pull the scheme out of.
 */
export function ResultsView({
  summary,
  paperTitle,
  paperCode,
  paperHref,
  submittedAt,
}: {
  summary: MarkingSummary;
  paperTitle: string;
  paperCode: string | null;
  paperHref: string;
  submittedAt: string;
}) {
  const hasProvisional = summary.provisionalAvailable > 0;

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10 sm:py-16">
        <Link
          href={paperHref}
          className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Back to the paper
        </Link>

        <header className="mt-8">
          {paperCode && (
            <p
              className="font-mono text-xs uppercase tracking-[0.25em]"
              style={{ color: "var(--subject-accent)" }}
            >
              {paperCode}
            </p>
          )}
          <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            How your marks were awarded
          </h1>
          <p className="mt-4 text-base text-ink/65">{paperTitle}</p>
          <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.2em] text-ink/45">
            Submitted {new Date(submittedAt).toLocaleString("en-GB")}
          </p>
        </header>

        {/* ── SCORE ───────────────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-ink/10 bg-signal p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
              Confirmed
            </p>
            <p className="font-display mt-3 text-5xl font-medium tracking-tight">
              {summary.confirmedAwarded}
              <span className="text-ink/45">/{summary.confirmedAvailable}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              Marked by exact comparison against the examiner&apos;s mark scheme.
              These marks are final.
            </p>
          </div>

          {hasProvisional ? (
            <div className="rounded-lg border border-dashed border-ink/25 bg-snow/60 p-6 sm:p-8">
              <p className="font-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-ink/50">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Provisional
              </p>
              <p className="font-display mt-3 text-5xl font-medium tracking-tight text-ink/60">
                {summary.provisionalAwarded}
                <span className="text-ink/35">/{summary.provisionalAvailable}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                Ailemy&apos;s provisional marking — pending review. Written
                answers are judged by a model whose accuracy isn&apos;t proven
                yet, so treat this as a guide, not a grade.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink/20 bg-snow/50 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/45">
                Written answers
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/55">
                Not marked. Ailemy&apos;s provisional marking for written
                answers isn&apos;t switched on yet.
              </p>
            </div>
          )}
        </section>

        {/* Deliberately NOT summed with the above. */}
        {summary.unmarkedAvailable > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-ink/55">
            A further <strong className="text-ink/75">{summary.unmarkedAvailable} marks</strong>{" "}
            couldn&apos;t be marked — those questions need a diagram, a graph or
            an equation editor that isn&apos;t built yet. They are not counted
            against you.
          </p>
        )}

        {/* ── PER QUESTION ────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Question by question
          </h2>
          <ol className="mt-5 space-y-3">
            {summary.questions.map((q) => (
              <QuestionResult key={q.questionAttemptId} question={q} />
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

function QuestionResult({ question: q }: { question: MarkedQuestion }) {
  const provisional = q.confidence === "requires_review";
  const unmarked = q.awardedMarks === null;

  return (
    <li
      className={`rounded-lg border p-5 sm:p-6 ${
        unmarked
          ? "border-dashed border-ink/20 bg-snow/50"
          : provisional
            ? "border-dashed border-ink/25 bg-snow/70"
            : "border-ink/10 bg-snow"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="font-display text-xl font-medium tracking-tight">
          {q.questionNumber}
        </h3>
        <div className="flex items-center gap-3">
          {provisional && (
            <span className="font-mono inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-parchment px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-ink/60">
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              Provisional
            </span>
          )}
          <span
            className={`font-mono text-sm ${unmarked ? "text-ink/35" : provisional ? "text-ink/55" : "text-ink"}`}
          >
            {unmarked ? "—" : q.awardedMarks}
            <span className="text-ink/40">/{q.maxMarks}</span>
          </span>
        </div>
      </div>

      {q.note && <p className="mt-3 text-sm leading-relaxed text-ink/55">{q.note}</p>}

      {q.points.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-t border-ink/10 pt-4">
          {q.points.map((p) => (
            <li key={p.pointCode} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  p.awarded ? "bg-ink text-snow" : "border border-ink/20 text-ink/40"
                }`}
                aria-hidden="true"
              >
                {p.awarded ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
              </span>
              <p className="text-sm leading-relaxed text-ink/70">
                <span className="font-mono mr-2 text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  {p.pointCode}
                </span>
                {p.evidence}
              </p>
            </li>
          ))}
        </ul>
      )}

      {provisional && (
        <p className="mt-4 flex items-start gap-2 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/50">
          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Marked by Ailemy, not by an examiner. If you think this is wrong, it
          may well be — check it against the mark scheme yourself.
        </p>
      )}
    </li>
  );
}
