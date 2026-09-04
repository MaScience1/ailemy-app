"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics/posthog";
import { startPractice, submitPractice } from "@/lib/practice/actions";
import type { MarkedAttempt, ServedQuestion } from "@/lib/practice/engine";
import { useLessonProgress } from "./LessonProgress";

/**
 * Check Your Understanding — the 10-MCQ practice surface (§31, §46–§56, §80).
 *
 * ============================================================================
 * ⚠ ANSWERS NEVER LIVE IN THIS COMPONENT'S PROPS OR STATE BEFORE SUBMISSION
 * ============================================================================
 * The server sends questions with no correct index (§103); this component
 * holds selections and sends them back; marking returns the full review. A
 * student reading the page source or the network tab before submitting finds
 * their own answers and nothing else.
 *
 * ⚠ AUTOSAVE IS sessionStorage KEYED BY SEED (§47). Refresh mid-attempt →
 * the page re-requests the same seed's questions (identical by construction,
 * §45) and restores selections. Closing the tab abandons the attempt, which
 * is the right cost for an unlimited-attempts surface — nothing of record is
 * lost, because nothing was submitted.
 *
 * ⚠ HISTORY IS DEVICE-LOCAL AND SAYS SO (§56 + the /welcome rule: an honest
 * limitation, stated, beats a false capability). The §57 schema moves it to
 * the academic record; the localStorage shape mirrors the proposed table so
 * the migration is a copy.
 *
 * ⚠ RESULTS ARE NEVER COLOUR-ONLY (§96): ✓/✕ glyphs and words carry the
 * verdict; colour reinforces.
 */

type Phase =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "active"; seed: number; fingerprint: string; startedAt: string; questions: ServedQuestion[]; avoid: string[]; focus: string[]; shortfall?: { requested: number; served: number; reason: string } }
  | { name: "marked"; marked: MarkedAttempt; avoid: string[]; recorded: "saved" | "replay" | "device-only"; shortfall?: { requested: number; served: number; reason: string } }
  | { name: "error"; reason: string };

type HistoryEntry = { seed: number; score: number; outOf: number; percent: number; at: string; families: string[] };

const historyKey = (slug: string) => `ailemy:practice:${slug}`;
const draftKey = (slug: string, seed: number) => `ailemy:practice-draft:${slug}:${seed}`;

function loadHistory(slug: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(historyKey(slug));
    const parsed = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LessonPractice({ lessonSlug }: { lessonSlug: string }) {
  const { mark: markComplete } = useLessonProgress();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [selections, setSelections] = useState<(number | null)[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => setHistory(loadHistory(lessonSlug)), [lessonSlug]);

  const begin = useCallback(
    async (opts: { avoid?: string[]; focus?: string[]; regenerated?: boolean; retried?: boolean }) => {
      setPhase({ name: "loading" });
      setConfirmSubmit(false);
      const res = await startPractice({
        lessonSlug,
        avoidFamilies: opts.avoid,
        focusFamilies: opts.focus,
      });
      if (!res.ok) {
        setPhase({ name: "error", reason: res.reason });
        return;
      }
      setSelections(new Array(res.questions.length).fill(null));
      setQIndex(0);
      setPhase({
        name: "active",
        seed: res.seed,
        fingerprint: res.fingerprint,
        startedAt: res.startedAt,
        questions: res.questions,
        avoid: opts.avoid ?? [],
        focus: opts.focus ?? [],
        shortfall: res.shortfall,
      });
      track(opts.retried ? "lesson_mistakes_retried" : opts.regenerated ? "lesson_practice_regenerated" : "lesson_practice_started", { lesson: lessonSlug });
    },
    [lessonSlug],
  );

  // ── autosave (§47): selections keyed by seed, restored on remount ─────────
  useEffect(() => {
    if (phase.name !== "active") return;
    try {
      sessionStorage.setItem(draftKey(lessonSlug, phase.seed), JSON.stringify(selections));
    } catch { /* quota — autosave degrades, answering does not */ }
  }, [selections, phase, lessonSlug]);
  useEffect(() => {
    if (phase.name !== "active") return;
    try {
      const raw = sessionStorage.getItem(draftKey(lessonSlug, phase.seed));
      if (raw) {
        const saved = JSON.parse(raw) as (number | null)[];
        if (Array.isArray(saved) && saved.length === phase.questions.length) setSelections(saved);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per attempt
  }, [phase.name === "active" ? phase.seed : null]);

  const submit = useCallback(async () => {
    if (phase.name !== "active") return;
    const unanswered = selections.filter((s) => s === null).length;
    if (unanswered > 0 && !confirmSubmit) {
      // §48 — tell them once; a second press is the deliberate submit.
      setConfirmSubmit(true);
      return;
    }
    setPhase({ name: "loading" });
    const res = await submitPractice({
      lessonSlug,
      seed: phase.seed,
      fingerprint: phase.fingerprint,
      startedAt: phase.startedAt,
      avoidFamilies: phase.avoid,
      focusFamilies: phase.focus,
      selections,
    });
    if (!res.ok) {
      setPhase({ name: "error", reason: res.reason });
      return;
    }
    const m = res.marked;
    const entry: HistoryEntry = {
      seed: m.seed, score: m.score, outOf: m.outOf, percent: m.percent,
      at: new Date().toISOString(),
      families: m.questions.map((q) => q.familyKey),
    };
    const next = [...loadHistory(lessonSlug), entry].slice(-50);
    try { localStorage.setItem(historyKey(lessonSlug), JSON.stringify(next)); } catch { /* full */ }
    try { sessionStorage.removeItem(draftKey(lessonSlug, phase.seed)); } catch { /* ignore */ }
    setHistory(next);
    setPhase({
      name: "marked",
      marked: m,
      avoid: entry.families,
      // ⚠ CARRIED, NOT DROPPED. This discriminator was computed by the server
      // and thrown away here, while the history footer told every student
      // "every submitted attempt is saved to your record" — including the ones
      // that were not. The marked view now states which of the three happened.
      recorded: res.recorded,
      shortfall: phase.shortfall,
    });
    // §18 — ATTEMPTED, not passed. A submitted attempt completes the section
    // whatever the score; performance is a separate fact, kept separately.
    markComplete("practice", "auto", { score: m.score, out_of: m.outOf });
    track("lesson_practice_submitted", { lesson: lessonSlug, score: m.score, outOf: m.outOf });
  }, [phase, selections, confirmSubmit, lessonSlug, markComplete]);

  const best = useMemo(() => (history.length ? Math.max(...history.map((h) => h.percent)) : null), [history]);

  const gotoSlide = (n: number) => {
    track("lesson_review_slide_clicked", { lesson: lessonSlug, slide: n });
    window.dispatchEvent(new CustomEvent("ailemy:lesson-goto-slide", { detail: { slideN: n } }));
  };

  // ────────────────────────────────────────────────────────────────────────
  if (phase.name === "idle" || phase.name === "error") {
    return (
      <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
          Up to 10 questions based only on this lesson and its specification points. Complete
          the lesson first for the best result — but you can start whenever you like.
        </p>
        {phase.name === "error" && (
          <p role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {phase.reason}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => begin({ avoid: history.at(-1)?.families })}
            data-cta="lesson_practice_start"
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Start practice →
          </button>
          {best !== null && (
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink/50">
              Best so far: {best}%
            </span>
          )}
        </div>
        <AttemptHistory history={history} />
      </div>
    );
  }

  if (phase.name === "loading") {
    return (
      <div className="rounded-lg border border-ink/10 bg-snow p-8">
        <p aria-live="polite" className="font-mono text-xs uppercase tracking-[0.16em] text-ink/50">
          Preparing questions…
        </p>
      </div>
    );
  }

  if (phase.name === "active") {
    const q = phase.questions[qIndex];
    const answered = selections.filter((s) => s !== null).length;
    return (
      <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink/55" aria-live="polite">
            Question {qIndex + 1} of {phase.questions.length} · {answered} answered
          </p>
        </div>

        {/* ⚠ A SHORT SET SAYS IT IS SHORT (§62). The approved pool could not
            fill ten distinct questions; padding with repeats or still calling
            it "10 questions" would both be inventions. */}
        {phase.shortfall && (
          <p className="mt-3 rounded border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs leading-relaxed text-ink/70">
            This set has {phase.shortfall.served} questions, not {phase.shortfall.requested} — that is
            every distinct question the approved families for this lesson can currently ask.
          </p>
        )}

        {/* navigator (§46) — answered state is glyph + fill, not colour alone */}
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Question navigator">
          {phase.questions.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setQIndex(i)}
                aria-label={`Question ${i + 1}${selections[i] !== null ? ", answered" : ", not answered"}`}
                aria-current={i === qIndex ? "step" : undefined}
                className={[
                  "h-8 w-8 rounded-full border font-mono text-xs transition-colors",
                  i === qIndex ? "border-ink bg-ink text-parchment" :
                  selections[i] !== null ? "border-ink/30 bg-ink/[0.07] text-ink" : "border-ink/15 text-ink/50",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                ].join(" ")}
              >
                {selections[i] !== null ? "•" : i + 1}
              </button>
            </li>
          ))}
        </ol>

        <fieldset className="mt-6">
          <legend className="max-w-3xl text-base font-medium leading-relaxed">{q.stem}</legend>
          <div className="mt-4 grid gap-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed transition-colors",
                  selections[qIndex] === oi ? "border-ink bg-ink/[0.05]" : "border-ink/15 hover:border-ink/35",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`q-${phase.seed}-${qIndex}`}
                  checked={selections[qIndex] === oi}
                  onChange={() =>
                    setSelections((s) => s.map((v, i) => (i === qIndex ? oi : v)))
                  }
                  className="mt-0.5 accent-[#0F1419]"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {confirmSubmit && (
          <p role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {selections.filter((s) => s === null).length} question(s) unanswered — press Submit
            again to submit anyway, or use the navigator to review them.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={qIndex === 0}
            onClick={() => setQIndex((i) => i - 1)}
            className="rounded-full border border-ink/20 px-4 py-2 text-sm disabled:opacity-40 hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ← Previous
          </button>
          {qIndex < phase.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setQIndex((i) => i + 1)}
              className="rounded-full border border-ink/20 px-4 py-2 text-sm hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Next →
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            data-cta="lesson_practice_submit"
            className="ml-auto rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Submit answers
          </button>
        </div>
      </div>
    );
  }

  // ── marked (§49–§53, §80) ─────────────────────────────────────────────────
  const { marked } = phase;
  const missedFamilies = marked.questions.filter((q) => !q.correct).map((q) => q.familyKey);
  const priorBest = history.slice(0, -1).length
    ? Math.max(...history.slice(0, -1).map((h) => h.percent))
    : null;

  return (
    <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
      <p className="font-display text-2xl font-medium tracking-tight">
        {marked.score} / {marked.outOf}
        <span className="ml-3 text-ink/60">{marked.percent}%</span>
      </p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-ink/50">
        Correct: {marked.score} · Incorrect: {marked.outOf - marked.score}
        {priorBest !== null && ` · Previous best: ${priorBest}%`}
        {priorBest !== null && marked.percent > priorBest && " · New best"}
      </p>

      {/* ⚠ A SHORT SET STAYS SHORT AFTER MARKING. The notice used to render
          only while answering, so a 7/7 was displayed — and filed in the
          history as "best" — beside a 9/10, with nothing saying the two were
          not the same test. */}
      {phase.shortfall && (
        <p className="mt-3 rounded border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs leading-relaxed text-ink/70">
          This set had {phase.shortfall.served} questions rather than {phase.shortfall.requested} —
          every distinct question this lesson&rsquo;s approved families can currently ask. Compare it
          with other {phase.shortfall.served}-question sets, not with full ones.
        </p>
      )}

      {/* ⚠ WHERE THIS ATTEMPT WENT — the server's own answer, not an assumption. */}
      <p className="mt-2 text-xs text-ink/55">
        {phase.recorded === "saved"
          ? "Saved to your academic record."
          : phase.recorded === "replay"
            ? "Already in your record — this seed was submitted before, so it was not recorded twice."
            : "Kept on this device only — sign in to save attempts to your academic record."}
      </p>

      <ol className="mt-6 grid gap-4">
        {marked.questions.map((q) => (
          <li key={q.qIndex} className={`rounded-md border p-4 ${q.correct ? "border-ink/10" : "border-amber-300"}`}>
            <p className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium leading-relaxed">{q.stem}</span>
              <span className={`shrink-0 font-mono text-xs ${q.correct ? "text-[#255730]" : "text-[#9A3D09]"}`}>
                {q.correct ? "✓ Correct" : "✕ Incorrect"}
              </span>
            </p>
            <div className="mt-2 grid gap-1 text-sm text-ink/75">
              <p>
                Your answer:{" "}
                {q.selectedIndex === null ? <em>none given</em> : q.options[q.selectedIndex]}
              </p>
              {!q.correct && <p>Correct answer: {q.options[q.correctIndex]}</p>}
              {!q.correct &&
                q.selectedIndex !== null &&
                q.wrongWhy[q.selectedIndex] && (
                  <p className="text-ink/65">{q.wrongWhy[q.selectedIndex]}</p>
                )}
              <p className="text-ink/65">{q.explanation}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
                Spec {q.specCode}
              </span>
              {q.reviewSlide !== null && (
                <button
                  type="button"
                  onClick={() => gotoSlide(q.reviewSlide!)}
                  className="text-sm underline underline-offset-2 hover:text-ink/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Review slide {q.reviewSlide} →
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => begin({ avoid: phase.avoid, regenerated: true })}
          data-cta="lesson_practice_regenerate"
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Generate another 10 →
        </button>
        {missedFamilies.length > 0 && (
          <button
            type="button"
            onClick={() => begin({ focus: missedFamilies, retried: true })}
            data-cta="lesson_practice_retry_mistakes"
            className="rounded-full border border-ink/20 px-6 py-3 text-sm font-medium hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Retry my mistakes
          </button>
        )}
      </div>

      <AttemptHistory history={history} />
    </div>
  );
}

function AttemptHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  const best = Math.max(...history.map((h) => h.percent));
  return (
    <div className="mt-8 border-t border-ink/10 pt-5">
      <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Your attempts</h3>
      <ol className="mt-3 grid gap-1">
        {history.slice(-8).map((h, i, arr) => (
          <li key={h.at} className="flex items-center gap-4 font-mono text-xs text-ink/70">
            <span className="text-ink/45">Attempt {history.length - arr.length + i + 1}</span>
            <span>{h.score} / {h.outOf} · {h.percent}%</span>
            {h.percent === best && <span className="text-[#6B4F2A]">best</span>}
          </li>
        ))}
      </ol>
      {/* ⚠ THIS SENTENCE USED TO BE UNCONDITIONAL, AND THAT MADE IT A CLAIM
          THE PAGE COULD NOT BACK. It said "every submitted attempt is saved to
          your record" to everyone — including signed-out students, replays,
          and attempts whose server write was refused. It now describes only
          what this list IS; whether a given attempt reached the record is
          stated on that attempt, by the marked view, from the server's own
          answer. */}
      <p className="mt-3 text-xs text-ink/45">
        This list is this device&rsquo;s own record of your attempts.
      </p>
    </div>
  );
}
