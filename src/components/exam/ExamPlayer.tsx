"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Flag,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";

import { AnswerEditor, isAnswerable } from "@/components/exam/AnswerEditor";
import type {
  AttemptQuestion,
  PlayerAttempt,
  ResponsePayload,
} from "@/lib/exam/attempts";

/**
 * The exam workspace.
 *
 * ============================================================================
 * WHAT THIS DOES NOT DO
 * ============================================================================
 * No timer, no marking, no mark scheme, no score. Step 3 ends at "a student can
 * answer every seeded question, their work survives a refresh, and they can
 * submit". Nothing here reads or displays anything from mark_scheme_items —
 * the props it receives have no field that could carry one.
 *
 * ============================================================================
 * AUTOSAVE
 * ============================================================================
 * Local state updates on every keystroke so typing is never laggy; the network
 * write is debounced per question. Three details matter and are easy to get
 * wrong:
 *
 *   1. The debounce timer is PER QUESTION, not global. A single shared timer
 *      means moving to question 4 while question 3's save is pending cancels
 *      it, and question 3 silently loses its last edit.
 *   2. Moving away flushes immediately rather than waiting out the delay,
 *      because the most likely next action after answering is navigating.
 *   3. Saves carry a monotonic sequence number per question. A slow request
 *      that lands after a newer one must not overwrite it — without this,
 *      a laggy keystroke can resurrect deleted text.
 */

const DEBOUNCE_MS = 700;

type SaveState = "idle" | "saving" | "saved" | "error";

export function ExamPlayer({
  attempt,
  paperHref,
  paperTitle,
  paperCode,
  pdfUrl,
  onSave,
  onFlag,
  onSubmit,
}: {
  attempt: PlayerAttempt;
  paperHref: string;
  paperTitle: string;
  paperCode: string | null;
  pdfUrl: string | null;
  onSave: (
    questionAttemptId: string,
    answerType: string,
    payload: ResponsePayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onFlag: (
    questionAttemptId: string,
    flagged: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSubmit: (
    attemptId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const submitted = attempt.submittedAt !== null;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ResponsePayload | null>>(
    () =>
      Object.fromEntries(
        attempt.questions.map((q) => [q.questionAttemptId, q.response]),
      ),
  );
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      attempt.questions.map((q) => [q.questionAttemptId, q.flagged]),
    ),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, { type: string; payload: ResponsePayload }>>({});
  const seq = useRef<Record<string, number>>({});
  const acked = useRef<Record<string, number>>({});

  const question = attempt.questions[index];

  const flush = useCallback(
    async (questionAttemptId: string) => {
      const job = pending.current[questionAttemptId];
      if (!job) return;
      delete pending.current[questionAttemptId];

      const mySeq = (seq.current[questionAttemptId] ?? 0) + 1;
      seq.current[questionAttemptId] = mySeq;

      setSaveState("saving");
      const result = await onSave(questionAttemptId, job.type, job.payload);

      // A response that is older than one already acknowledged is discarded:
      // it would otherwise report a stale outcome for this question.
      if ((acked.current[questionAttemptId] ?? 0) > mySeq) return;
      acked.current[questionAttemptId] = mySeq;

      if (result.ok) {
        setSaveState("saved");
        setSaveError(null);
      } else {
        setSaveState("error");
        setSaveError(result.error);
      }
    },
    [onSave],
  );

  const queueSave = useCallback(
    (q: AttemptQuestion, payload: ResponsePayload) => {
      pending.current[q.questionAttemptId] = {
        type: q.answerType,
        payload,
      };
      clearTimeout(timers.current[q.questionAttemptId]);
      timers.current[q.questionAttemptId] = setTimeout(
        () => void flush(q.questionAttemptId),
        DEBOUNCE_MS,
      );
    },
    [flush],
  );

  const handleChange = useCallback(
    (payload: ResponsePayload) => {
      if (submitted || !question) return;
      setAnswers((prev) => ({ ...prev, [question.questionAttemptId]: payload }));
      queueSave(question, payload);
    },
    [question, queueSave, submitted],
  );

  /** Navigate, flushing whatever is pending for the question being left. */
  const goTo = useCallback(
    (next: number) => {
      const leaving = attempt.questions[index];
      if (leaving && pending.current[leaving.questionAttemptId]) {
        clearTimeout(timers.current[leaving.questionAttemptId]);
        void flush(leaving.questionAttemptId);
      }
      setIndex(Math.max(0, Math.min(attempt.questions.length - 1, next)));
    },
    [attempt.questions, flush, index],
  );

  // Closing the tab with an unsaved edit is the one case a debounce cannot
  // survive, so warn rather than lose it. Only while something is genuinely
  // pending — an unconditional handler makes every navigation prompt.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Flush on unmount so a client-side route change does not drop the last edit.
  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      for (const id of Object.keys(pending.current)) {
        clearTimeout(timersAtMount[id]);
        void flush(id);
      }
    };
  }, [flush]);

  const toggleFlag = useCallback(async () => {
    if (!question || submitted) return;
    const next = !flags[question.questionAttemptId];
    setFlags((prev) => ({ ...prev, [question.questionAttemptId]: next }));
    const result = await onFlag(question.questionAttemptId, next);
    if (!result.ok) {
      // Put it back rather than leave the UI asserting something untrue.
      setFlags((prev) => ({ ...prev, [question.questionAttemptId]: !next }));
      setSaveError(result.error);
    }
  }, [flags, onFlag, question, submitted]);

  const answeredCount = useMemo(
    () =>
      attempt.questions.filter(
        (q) => isAnswerable(q.answerType) && hasAnswer(answers[q.questionAttemptId]),
      ).length,
    [answers, attempt.questions],
  );
  const answerableCount = useMemo(
    () => attempt.questions.filter((q) => isAnswerable(q.answerType)).length,
    [attempt.questions],
  );

  const doSubmit = async () => {
    setSubmitting(true);
    // Flush everything outstanding first — submitting freezes the attempt, and
    // a pending write landing afterwards would be rejected by the trigger.
    for (const id of Object.keys(pending.current)) {
      clearTimeout(timers.current[id]);
      await flush(id);
    }
    const result = await onSubmit(attempt.id);
    setSubmitting(false);
    if (result.ok) {
      // Straight to the marked paper. A reload would land them back on a
      // read-only player with no indication that anything had been marked.
      window.location.assign(`${window.location.pathname.replace(/\/$/, "")}/results`);
    } else {
      setSaveError(result.error);
      setConfirmingSubmit(false);
    }
  };

  if (!question) {
    return (
      <p className="text-sm text-ink/60">This attempt has no questions in it.</p>
    );
  }

  return (
    <div className="min-h-screen bg-parchment text-ink">
      {/* ── BAR ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href={paperHref}
            className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Leave
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {paperCode && (
                <span
                  className="font-mono mr-2 text-xs"
                  style={{ color: "var(--subject-accent)" }}
                >
                  {paperCode}
                </span>
              )}
              {paperTitle}
            </p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            {answeredCount}/{answerableCount} answered
          </p>
          <SaveIndicator state={saveState} submitted={submitted} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {submitted && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-ink/15 bg-snow p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink/50" aria-hidden="true" />
            <div>
              <p className="font-display text-base font-medium tracking-tight">
                Submitted
              </p>
              <p className="mt-1 text-sm text-ink/60">
                Your answers are locked and can no longer be changed.
              </p>
              {/* This said "marking isn't built yet" until marking was built.
                  A student who submits and is told there is nothing to see has
                  no reason to look for the results screen that now exists. */}
              <Link
                href={`${paperHref}/interactive/attempt/${attempt.id}/results`}
                className="font-mono mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink transition-colors hover:text-ink/60"
              >
                See how your marks were awarded
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {saveError && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--color-danger,#B3261E)]/30 bg-[var(--color-danger,#B3261E)]/[0.06] p-4">
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger,#B3261E)]"
              aria-hidden="true"
            />
            <p className="text-sm text-ink/75">{saveError}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8">
          {/* ── QUESTION ────────────────────────────────────────────────── */}
          <main className="min-w-0">
            <article className="rounded-lg border border-ink/10 bg-snow p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                    {question.questionNumber}
                  </h1>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
                    {question.maxMarks} mark{question.maxMarks === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleFlag}
                  disabled={submitted}
                  aria-pressed={flags[question.questionAttemptId] === true}
                  className={`font-mono inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    flags[question.questionAttemptId]
                      ? "border-ink bg-signal text-ink"
                      : "border-ink/15 text-ink/55 hover:border-ink/35 hover:text-ink"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Flag className="h-3 w-3" aria-hidden="true" />
                  {flags[question.questionAttemptId] ? "Flagged" : "Flag"}
                </button>
              </div>

              {/* Ancestor stems. 20(b)(iii) is unanswerable without Q20's and
                  20(b)'s context, and those rows carry no question of their own. */}
              {question.context.length > 0 && (
                <div className="mt-6 space-y-3 border-l-2 border-ink/10 pl-4">
                  {question.context.map((c) => (
                    <div key={c.questionNumber}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                        {c.questionNumber}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/60">
                        {c.questionText}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {question.questionText ? (
                <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">
                  {question.questionText}
                </p>
              ) : (
                <p className="mt-6 text-sm italic text-ink/50">
                  This question is a diagram — read it in the PDF below.
                </p>
              )}

              <div className="mt-8 border-t border-ink/10 pt-8">
                <AnswerEditor
                  // Remount on question change so the editor cannot carry a
                  // stale uncontrolled value (a textarea's scroll position, an
                  // IME composition) into the next question.
                  key={question.questionAttemptId}
                  answerType={question.answerType}
                  maxMarks={question.maxMarks}
                  value={answers[question.questionAttemptId] ?? null}
                  onChange={handleChange}
                  disabled={submitted}
                />
              </div>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-ink/10 pt-6">
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Previous
                </button>
                <span className="font-mono text-[11px] text-ink/40">
                  {index + 1} / {attempt.questions.length}
                </span>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  disabled={index === attempt.questions.length - 1}
                  className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </article>

            {/* The whole paper, because question_regions is empty and there is
                no way yet to show only the question being answered. */}
            {pdfUrl && (
              <details className="mt-6 rounded-lg border border-ink/10 bg-snow">
                <summary className="flex cursor-pointer items-center gap-2 p-4 text-sm font-medium marker:content-['']">
                  <FileText className="h-4 w-4 text-ink/50" aria-hidden="true" />
                  Open the full question paper
                  <span className="font-mono ml-auto text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    PDF
                  </span>
                </summary>
                <div className="border-t border-ink/10 p-3">
                  <iframe
                    src={pdfUrl}
                    title="Question paper"
                    className="h-[70vh] w-full rounded-md border border-ink/10 bg-ink/5"
                  />
                </div>
              </details>
            )}
          </main>

          {/* ── NAVIGATOR ───────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Questions
            </h2>
            <ol className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-4">
              {attempt.questions.map((q, i) => {
                const answered =
                  isAnswerable(q.answerType) &&
                  hasAnswer(answers[q.questionAttemptId]);
                const current = i === index;
                return (
                  <li key={q.questionAttemptId}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={current ? "true" : undefined}
                      title={`${q.questionNumber} — ${answered ? "answered" : "not answered"}${flags[q.questionAttemptId] ? ", flagged" : ""}`}
                      className={`relative flex h-11 w-full items-center justify-center rounded-md border text-[11px] transition-all ${
                        current
                          ? "border-ink bg-ink text-snow"
                          : answered
                            ? "border-ink/20 bg-signal text-ink"
                            : "border-ink/15 bg-snow text-ink/55 hover:border-ink/35"
                      }`}
                    >
                      <span className="font-mono">{q.questionNumber}</span>
                      {flags[q.questionAttemptId] && (
                        <Flag
                          className="absolute right-1 top-1 h-2.5 w-2.5"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>

            <dl className="font-mono mt-4 space-y-1.5 text-[10px] uppercase tracking-[0.18em] text-ink/45">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-ink/20 bg-signal" />
                Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-ink/15 bg-snow" />
                Not answered
              </div>
            </dl>

            {!submitted && (
              <div className="mt-6 border-t border-ink/10 pt-5">
                {confirmingSubmit ? (
                  <div className="rounded-md border border-ink/15 bg-snow p-4">
                    <p className="font-display text-base font-medium tracking-tight">
                      Submit this paper?
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink/65">
                      {answeredCount === answerableCount ? (
                        <>You&apos;ve answered all {answerableCount}.</>
                      ) : (
                        <>
                          {answerableCount - answeredCount} of {answerableCount}{" "}
                          {answerableCount - answeredCount === 1
                            ? "question is"
                            : "questions are"}{" "}
                          still unanswered.
                        </>
                      )}{" "}
                      You won&apos;t be able to change your answers afterwards.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={doSubmit}
                        disabled={submitting}
                        className="font-mono inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] text-snow transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {submitting && (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        )}
                        Yes, submit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingSubmit(false)}
                        disabled={submitting}
                        className="font-mono rounded-md border border-ink/15 px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] text-ink/60 transition-colors hover:text-ink"
                      >
                        Keep working
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingSubmit(true)}
                    className="font-mono w-full rounded-md border border-ink/15 bg-signal px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-ink transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Submit paper
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** An answer exists when it has content — an empty string is not an answer. */
function hasAnswer(payload: ResponsePayload | null | undefined): boolean {
  if (!payload) return false;
  switch (payload.kind) {
    case "mcq":
      return payload.choice.length > 0;
    case "text":
      return payload.text.trim().length > 0;
    case "numeric":
      // ⚠ WORKING COUNTS. A student who runs out of time, types their method
      // and leaves the value blank IS marked — markNumeric routes exactly that
      // state to Tier 2 for the method marks. Counting only `value` told them
      // the question was unanswered, warned them about it on submit, and was
      // wrong about work that was about to be credited.
      return payload.value.trim().length > 0 || (payload.working ?? "").trim().length > 0;
    default:
      return false;
  }
}

function SaveIndicator({
  state,
  submitted,
}: {
  state: SaveState;
  submitted: boolean;
}) {
  if (submitted) {
    return (
      <span className="font-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ink/45">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Locked
      </span>
    );
  }
  const map: Record<SaveState, { text: string; icon: React.ReactNode }> = {
    idle: { text: "Autosaves", icon: null },
    saving: {
      text: "Saving",
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    },
    saved: { text: "Saved", icon: <Check className="h-3 w-3" aria-hidden="true" /> },
    error: {
      text: "Not saved",
      icon: <CircleAlert className="h-3 w-3" aria-hidden="true" />,
    },
  };
  const { text, icon } = map[state];
  return (
    <span
      aria-live="polite"
      className={`font-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] ${
        state === "error" ? "text-[var(--color-danger,#B3261E)]" : "text-ink/45"
      }`}
    >
      {icon}
      {text}
    </span>
  );
}
