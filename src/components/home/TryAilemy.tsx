"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SmartLink as Link } from "@/components/i18n/SmartLink";
import { SAMPLE, markSample, type SampleResult } from "@/lib/home/try-sample";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * "Try Ailemy" — the product demonstration (§25).
 *
 * ============================================================================
 * ⚠ IT SAYS WHAT IT IS, IN THE UI, NOT ONLY IN A COMMENT
 * ============================================================================
 * This marks against a fixed mark scheme by keyword — the controlled fallback
 * §25 offers and the governance header requires, because live AI marking is
 * audit-gated (200-response, ≥90%, human-countersigned) and none of that has
 * happened for an anonymous visitor.
 *
 * A demo that let a student believe an unaudited engine had just marked them
 * would be a claim the product cannot yet support. So the panel is labelled
 * "sample marking" where the result appears — not buried in a footnote — and
 * the account CTA is the honest path into the real system, which is exactly
 * what §25 asks for.
 *
 * ⚠ NO NETWORK, NO KEYS, NO RATE LIMIT NEEDED. The marking is a pure function
 * running in the browser. There is no endpoint to abuse and no secret to leak,
 * which is the other half of why the fallback is the right shape here.
 *
 * ⚠ AND IT MARKS ON SUBMIT, NOT AS YOU TYPE. Live marking would flicker a
 * verdict at every keystroke and effectively tell the student which words to
 * add — which teaches keyword-stuffing rather than chemistry.
 */
export function TryAilemy() {
  const t = useTranslations();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<SampleResult | null>(null);
  const colour = subjectColour(SAMPLE.subject);

  return (
    <div style={subjectVars(colour)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* ── the question ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-ink/10 bg-snow p-6">
        <div className="flex flex-wrap items-center gap-2">
          {colour && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.12em]"
              style={{ background: "var(--subject-tint)", color: "var(--subject-text)" }}
            >
              {colour.code}
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {SAMPLE.topic} · {SAMPLE.commandWord}
          </span>
        </div>

        <p className="mt-4 text-base leading-relaxed">
          {SAMPLE.prompt}{" "}
          <span className="font-mono text-sm text-ink/50">[{SAMPLE.marks}]</span>
        </p>

        <label htmlFor="try-answer" className="mt-5 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          {t("tryAilemy.yourAnswerLabel")}
        </label>
        <textarea
          id="try-answer"
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); if (result) setResult(null); }}
          rows={4}
          placeholder={t("tryAilemy.answerPlaceholder")}
          className="mt-2 w-full rounded-md border border-ink/15 bg-parchment px-3 py-2.5 text-sm leading-relaxed placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setResult(markSample(answer))}
            data-cta="try_mark_answer"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Mark my answer →
          </button>
          {result && (
            <button
              type="button"
              onClick={() => { setAnswer(""); setResult(null); }}
              className="text-sm text-ink/55 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {t("common.tryAgain")}
            </button>
          )}
        </div>
      </div>

      {/* ── the marking ──────────────────────────────────────────────── */}
      <div
        /**
         * ⚠ aria-live, SO THE RESULT IS ANNOUNCED. A sighted user sees the
         * panel change; without this a screen-reader user presses "Mark my
         * answer" and nothing happens as far as they can tell.
         */
        aria-live="polite"
        className="rounded-lg border border-ink/10 bg-parchment-2/40 p-6"
      >
        {!result ? (
          /**
           * ⚠ THE EMPTY STATE SAYS WHAT IS ABOUT TO HAPPEN, NOT WHAT THE
           * PRODUCT IS (§6). It used to read "Ailemy marks against the points a
           * real mark scheme awards — not a percentage guess…" — 28 words
           * restating the section lede 40px above it, which in turn restated
           * step 03 of #how further up. Three statements of one claim on one
           * page. The demo below is the claim; this box only has to tell you
           * where the result will land.
           *
           * resultPending* replaces howAilemyMarks*, which are left in the
           * catalogue as named orphans rather than swept mid-pass.
           */
          <div className="text-sm leading-relaxed text-ink/55">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              {t("tryAilemy.resultPending")}
            </p>
            <p className="mt-3">{t("tryAilemy.resultPendingBody")}</p>
          </div>
        ) : result.tooShort ? (
          /* ⚠ NOT "0 / 2". A blank box scored zero reads as a judgement of the
             student; this is the truth about the input. */
          <p className="text-sm leading-relaxed text-ink/70">
            {t("tryAilemy.answerTooShort")}
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-medium tabular-nums">{result.awarded}</span>
              <span className="font-display text-xl text-ink/40">/ {result.outOf}</span>
            </div>

            <ul className="mt-5 space-y-4">
              {result.points.map((p) => (
                <li key={p.code}>
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 font-mono text-sm"
                      style={{ color: p.awarded ? "var(--subject-text)" : undefined }}
                    >
                      {p.awarded ? "✓" : "△"}
                    </span>
                    <div className="min-w-0">
                      {/* ⚠ THE SCREEN READER GETS THE VERDICT AS A WORD, not as
                          a tick glyph that may or may not be announced. */}
                      <p className="text-sm leading-snug">
                        <span className="sr-only">{p.awarded ? t("tryAilemy.srAwarded") : t("tryAilemy.srNotAwarded")}</span>
                        {p.requirement}
                      </p>
                      {p.awarded ? (
                        /* ⚠ THE EVIDENCE, ALWAYS. A mark with no stated reason is
                           the invented feedback this project forbids — and an
                           unjustified mark is invisible without it. */
                        <p className="mt-1 font-mono text-[10px] text-ink/45">
                          matched “{p.evidence}”
                        </p>
                      ) : (
                        <p className="mt-1 text-[13px] leading-relaxed text-ink/60">{p.improve}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* ⚠ THE HONEST LABEL, WHERE THE RESULT IS — not in a footnote. */}
            <p className="mt-5 border-t border-ink/10 pt-3 font-mono text-[10px] leading-relaxed tracking-wide text-ink/40">
              {t("tryAilemy.sampleMarkingDisclaimer")}
            </p>

            <Link
              href="/signup"
              data-cta="try_create_account"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
              style={colour ? { color: "var(--subject-text)" } : undefined}
            >
              <span className="underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current">
                {t("tryAilemy.createFreeAccount")}
              </span>
              <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-1">→</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
