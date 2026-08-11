import {
  lossCategoryLabel,
  type ResultsContext,
} from "@/lib/exam/results-insights";
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
  context,
  paperTitle,
  paperCode,
  paperHref,
  submittedAt,
}: {
  summary: MarkingSummary;
  /**
   * ⚠ OPTIONAL, AND ABSENT MEANS ABSENT. When it is not passed, none of the
   * sections render at all — they do not render empty. A section that appears
   * with nothing in it reads as "you have no weak topics", which is a claim.
   */
  context?: ResultsContext;
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

        {/* ── SAVE FAILURE ────────────────────────────────────────────────
            Loud, above the score, and never suppressed. The totals below are
            genuinely lower than what was computed, and a student comparing
            them against their own answers deserves to know why rather than
            concluding the marker is wrong. */}
        {summary.persistenceFailures > 0 && (
          <div className="mt-10 flex gap-3 rounded-lg border border-ink/25 bg-snow p-5 sm:p-6">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
                Some marks weren&apos;t saved
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                {summary.persistenceFailures} question
                {summary.persistenceFailures === 1 ? " was" : "s were"} marked,
                but the {summary.persistenceFailures === 1 ? "result" : "results"}{" "}
                couldn&apos;t be stored — so{" "}
                {summary.persistenceFailures === 1 ? "it isn't" : "they aren't"}{" "}
                shown below and{" "}
                {summary.persistenceFailures === 1 ? "isn't" : "aren't"} in the
                totals. Your answers are safe. Reloading this page will try
                again.
              </p>
            </div>
          </div>
        )}

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
              These marks are final. The denominator counts only what could be
              assessed — not the whole paper.
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

        {/* Deliberately NOT summed with either total above, and deliberately
            NOT in the denominator of the confirmed card. These marks were not
            lost — nothing could reach them. */}
        {summary.needsReviewAvailable > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-ink/55">
            A further{" "}
            <strong className="text-ink/75">
              {summary.needsReviewAvailable} mark
              {summary.needsReviewAvailable === 1 ? "" : "s"}
            </strong>{" "}
            couldn&apos;t be assessed{" "}
            {/*
              ⚠ THIS USED TO SAY "because your working isn't captured on screen"
              UNCONDITIONALLY. Since working capture that is false for exactly
              the students the feature is for — it printed directly above cards
              quoting the very working it claimed had never been captured, which
              is the same falsehood WORKING_UNDER_REVIEW was introduced to
              remove one layer down. It now describes what is actually left.
            */}
            {summary.provisionalAvailable > 0
              ? "— question types that need an editor Ailemy doesn't have yet, and any method marks left over."
              : "— mostly method marks, because no working was shown, plus question types that need an editor Ailemy doesn't have yet."}{" "}
            <strong className="text-ink/75">
              These are not counted against you
            </strong>{" "}
            and are not part of the totals above.
          </p>
        )}

        {context && <ResultsContextSections context={context} />}

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
  // ⚠ A QUESTION CAN BE BOTH, and the card has to say so. A numeric question
  // answered with working has an arithmetic mark AND method marks judged by a
  // model: its confidence is 'deterministic' because its awarded_marks are, so
  // keying the whole card off `provisional` would have shown the confirmed 1/1
  // and silently dropped five marks of judgement and evidence.
  const hasMethod = q.provisionalPoints.length > 0 && !provisional;

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
            {/* assessedOutOf, not maxMarks: a 2-of-6 question that was marked
                correctly reads 2/2, with the other 4 flagged below. */}
            <span className="text-ink/40">/{unmarked ? q.maxMarks : q.assessedOutOf}</span>
          </span>
        </div>
      </div>

      {q.note && <p className="mt-3 text-sm leading-relaxed text-ink/55">{q.note}</p>}

      {!unmarked && q.unassessedMarks > 0 && (
        <p className="font-mono mt-2 text-[10px] uppercase tracking-[0.18em] text-ink/45">
          + {q.unassessedMarks} mark{q.unassessedMarks === 1 ? "" : "s"} not assessed
        </p>
      )}

      {hasMethod && (
        <p className="font-mono mt-2 text-[10px] uppercase tracking-[0.18em] text-ink/45">
          + {q.provisionalMarks}/{q.provisionalOutOf} method mark
          {q.provisionalOutOf === 1 ? "" : "s"} provisional
        </p>
      )}

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

      {hasMethod && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="font-mono flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-ink/50">
            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
            Method marks, from your working — provisional
          </p>
          <ul className="mt-3 space-y-2.5">
            {q.provisionalPoints.map((p) => (
              <li key={p.pointCode} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    p.awarded ? "bg-ink/70 text-snow" : "border border-ink/20 text-ink/40"
                  }`}
                  aria-hidden="true"
                >
                  {p.awarded ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                </span>
                <p className="text-sm leading-relaxed text-ink/60">
                  <span className="font-mono mr-2 text-[10px] uppercase tracking-[0.15em] text-ink/40">
                    {p.pointCode}
                  </span>
                  {p.evidence}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink/50">
            <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            These were judged by Ailemy from your working, not by an examiner,
            and are not counted in the confirmed total above.
          </p>
        </div>
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


/**
 * The four sections 0035 unblocked — each of which may refuse.
 *
 * ⚠ A REFUSAL IS RENDERED, NOT HIDDEN. Hiding an unavailable section would let
 * a student assume it did not apply to them; showing it with the reason tells
 * them the truth, which is that nobody has mapped this paper yet. What is never
 * rendered is a section with no data in it and no explanation — that is the
 * shape that reads as a finding.
 */
function ResultsContextSections({ context }: { context: ResultsContext }) {
  const { grade, topics, insights, loss } = context;
  return (
    <section className="mt-8 space-y-4">
      {/* ── grade ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-ink/10 bg-snow p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">Grade</h3>
        {grade.available ? (
          <>
            <p className="font-display mt-2 text-3xl font-medium">{grade.grade}</p>
            <p className="mt-1 text-sm text-ink/60">
              {grade.rawMark} of {grade.outOf} ·{" "}
              {/* The label is the feature. An estimate presented as official is
                  a claim about a real examination that nobody has checked. */}
              <strong className={grade.basis === "official" ? "text-ink" : "text-ink/70"}>
                {grade.basis === "official" ? "official boundaries" : "estimated — not published boundaries"}
              </strong>
              {grade.sourceNote ? ` · ${grade.sourceNote}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink/60">{grade.reason}</p>
        )}
      </div>

      {/* ── where the marks went ──────────────────────────────────────── */}
      <div className="rounded-lg border border-ink/10 bg-snow p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Where your marks went
        </h3>
        {loss.available ? (
          <ul className="mt-3 space-y-2">
            {loss.rows.map((row) => (
              <li key={row.category} className="flex items-baseline gap-3 text-sm">
                <span className="font-mono w-8 shrink-0 text-right text-ink">{row.marks}</span>
                <span className="text-ink/70">{lossCategoryLabel(row.category)}</span>
                <span className="ml-auto font-mono text-[11px] text-ink/40">
                  {row.questions.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/60">{loss.reason}</p>
        )}
      </div>

      {/* ── topics ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-ink/10 bg-snow p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">By topic</h3>
        {topics.available ? (
          <ul className="mt-3 space-y-2">
            {topics.rows.map((row) => (
              <li key={row.topic} className="flex items-baseline gap-3 text-sm">
                <span className="font-mono w-12 shrink-0 text-right text-ink">
                  {row.awarded}/{row.outOf}
                </span>
                <span className="text-ink/70">{row.topic}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/60">{topics.reason}</p>
        )}
      </div>

      {/* ── examiner insights ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-ink/10 bg-snow p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          What examiners saw
        </h3>
        {insights.available ? (
          <ul className="mt-3 space-y-3">
            {insights.insights.map((i, n) => (
              <li key={`${i.questionNumber}-${n}`} className="text-sm">
                <span className="font-mono mr-2 text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  {i.questionNumber}
                </span>
                {/*
                  ⚠ TWO SENTENCES, AND THE DIFFERENCE IS NOT COSMETIC. `matched`
                  quotes the student's own answer back and may say "you".
                  `observed` may only report what the cohort did — they may have
                  left it blank or made a different error, and being told
                  confidently what they did wrong when they did something else
                  is worse than being told nothing.
                */}
                {i.strength === "matched" ? (
                  <span className="text-ink/80">
                    Your answer contains <code className="font-mono">{i.evidence}</code> — {i.insightText}
                  </span>
                ) : (
                  <span className="text-ink/65">
                    Examiners reported on this question: {i.insightText}{" "}
                    <em className="text-ink/45">(we can&apos;t tell from your answer whether this was your mistake)</em>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/60">{insights.reason}</p>
        )}
      </div>
    </section>
  );
}
