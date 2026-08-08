"use client";

import { PenOff } from "lucide-react";

import type { ResponsePayload } from "@/lib/exam/attempts";
import type { AnswerType } from "@/lib/exam/question-set";

/**
 * The right input for the question in front of you.
 *
 * WHICH TYPES ARE ANSWERABLE TODAY is a deliberate, visible list rather than a
 * default case that renders a textarea. Handing a student a text box for a
 * question that asks them to DRAW a skeletal formula would collect an answer
 * nothing can mark and let them believe they had answered it. A blank,
 * labelled "not answerable yet" is the honest state and the one that will not
 * quietly produce junk in student_responses.
 *
 * Every editor is CONTROLLED and calls onChange on each keystroke. Debouncing
 * belongs to the player, which owns the network; an editor that debounced
 * internally would fight it and lose the last keystroke before a blur.
 */

export const ANSWERABLE_TYPES: readonly AnswerType[] = [
  "mcq",
  "short_text",
  "long_text",
  "numeric",
  "numeric_with_unit",
];

export function isAnswerable(type: AnswerType): boolean {
  return ANSWERABLE_TYPES.includes(type);
}

/** What each not-yet-supported type is actually waiting for. */
const PENDING_REASON: Partial<Record<AnswerType, string>> = {
  chemical_equation: "an equation editor that understands formulae and state symbols",
  structure: "a structure canvas for drawing skeletal formulae",
  graph: "a plotting grid you can place points on",
  mechanism: "a curly-arrow mechanism canvas",
  apparatus: "a diagram canvas for apparatus",
  freehand: "a freehand drawing surface",
  other: "an editor for this question type",
};

const FIELD =
  "w-full rounded-md border border-ink/15 bg-snow px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-ink/35 transition-colors focus:border-[var(--subject-accent)] " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--subject-accent)]/25 " +
  "disabled:cursor-not-allowed disabled:bg-ink/[0.03] disabled:text-ink/45";

export function AnswerEditor({
  answerType,
  value,
  onChange,
  disabled = false,
}: {
  answerType: AnswerType;
  value: ResponsePayload | null;
  onChange: (payload: ResponsePayload) => void;
  /** True once the attempt is submitted — everything becomes read-only. */
  disabled?: boolean;
}) {
  switch (answerType) {
    // ── MCQ ──────────────────────────────────────────────────────────────
    // The options themselves are printed in question_text, so this offers the
    // letters rather than restating them — restating would mean parsing prose
    // and getting it subtly wrong on the questions with tables.
    case "mcq": {
      const choice = value?.kind === "mcq" ? value.choice : null;
      return (
        <fieldset disabled={disabled} className="border-0 p-0">
          <legend className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Select one
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {["A", "B", "C", "D"].map((letter) => {
              const selected = choice === letter;
              return (
                <label
                  key={letter}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm transition-all ${
                    selected
                      ? "border-ink bg-signal font-medium text-ink"
                      : "border-ink/15 bg-snow text-ink/70 hover:border-ink/35"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="mcq-choice"
                    value={letter}
                    checked={selected}
                    onChange={() => onChange({ kind: "mcq", choice: letter })}
                    className="sr-only"
                  />
                  <span className="font-display text-base">{letter}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }

    // ── SHORT TEXT ───────────────────────────────────────────────────────
    case "short_text": {
      const text = value?.kind === "text" ? value.text : "";
      return (
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Your answer
          </span>
          <input
            type="text"
            value={text}
            disabled={disabled}
            onChange={(e) => onChange({ kind: "text", text: e.target.value })}
            placeholder="One line is enough"
            className={`${FIELD} mt-3`}
          />
        </label>
      );
    }

    // ── LONG TEXT ────────────────────────────────────────────────────────
    case "long_text": {
      const text = value?.kind === "text" ? value.text : "";
      return (
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
            Your answer
          </span>
          <textarea
            value={text}
            disabled={disabled}
            onChange={(e) => onChange({ kind: "text", text: e.target.value })}
            rows={8}
            placeholder="Write your explanation here"
            className={`${FIELD} mt-3 resize-y leading-relaxed`}
          />
        </label>
      );
    }

    // ── NUMERIC (± UNIT) ─────────────────────────────────────────────────
    // One payload shape for both, with unit simply absent for `numeric`. The
    // value stays a STRING all the way to the database: "0.0172" and "1.72e-2"
    // are the same number and different answers, and a student's significant
    // figures are part of what gets marked. Number() would destroy that.
    case "numeric":
    case "numeric_with_unit": {
      const wantsUnit = answerType === "numeric_with_unit";
      const current = value?.kind === "numeric" ? value : null;
      const emit = (next: { value?: string; unit?: string }) =>
        onChange({
          kind: "numeric",
          value: next.value ?? current?.value ?? "",
          ...(wantsUnit
            ? { unit: next.unit ?? current?.unit ?? "" }
            : {}),
        });

      return (
        <div className={`grid gap-3 ${wantsUnit ? "sm:grid-cols-[2fr_1fr]" : ""}`}>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              Value
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={current?.value ?? ""}
              disabled={disabled}
              onChange={(e) => emit({ value: e.target.value })}
              placeholder="e.g. 0.0172"
              className={`${FIELD} mt-3 font-mono`}
            />
          </label>
          {wantsUnit && (
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                Unit
              </span>
              <input
                type="text"
                value={current?.unit ?? ""}
                disabled={disabled}
                onChange={(e) => emit({ unit: e.target.value })}
                placeholder="e.g. mol"
                className={`${FIELD} mt-3 font-mono`}
              />
            </label>
          )}
        </div>
      );
    }

    // ── NOT YET ANSWERABLE ───────────────────────────────────────────────
    default:
      return <NotAnswerableYet answerType={answerType} />;
  }
}

function NotAnswerableYet({ answerType }: { answerType: AnswerType }) {
  const reason = PENDING_REASON[answerType] ?? "an editor for this question type";
  return (
    <div className="rounded-md border border-dashed border-ink/20 bg-ink/[0.02] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink/[0.06] text-ink/40">
          <PenOff className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-base font-medium tracking-tight text-ink/70">
            You can&apos;t answer this one here yet
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
            This question needs {reason}, which isn&apos;t built. Answer it on
            paper alongside — it won&apos;t be saved or marked, and it isn&apos;t
            counted as unanswered.
          </p>
          <p className="font-mono mt-3 text-[10px] uppercase tracking-[0.2em] text-ink/40">
            {answerType.replace(/_/g, " ")}
          </p>
        </div>
      </div>
    </div>
  );
}
