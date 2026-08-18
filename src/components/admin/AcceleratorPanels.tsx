"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

import type { BatchCandidate, BatchPlan } from "@/lib/exam/precedent";
import { toViewerPage } from "@/lib/exam/question-nav";
import type { TariffRow } from "@/lib/exam/markscheme-proposals";

/**
 * The accelerator's confirmation screens.
 *
 * ============================================================================
 * ⚠ EVERY PANEL HERE IS A QUESTION, NOT A NOTIFICATION
 * ============================================================================
 * Each one shows work that has been COMPUTED and not yet DONE, and closing it
 * without confirming leaves the paper exactly as it was. Nothing in this file
 * writes; each panel hands a list back to its caller, which calls the same
 * server action manual ruling uses.
 *
 * ⚠ EVERYTHING STARTS TICKED, AND THAT IS A DELIBERATE ASYMMETRY WITH THE
 * RULING CARDS. A ruling card pre-selects nothing, because there the layout
 * would be making a decision the examiner should make. Here the decision has
 * already been made — by a precedent the founder wrote, or by byte equality —
 * and the screen exists so they can UNPICK the ones that are wrong. Making
 * them tick sixty boxes to accept sixty things they agree with is how a
 * reviewer learns to click without reading.
 */

const Shell = ({
  title, subtitle, onCancel, children, footer,
}: {
  title: string; subtitle: string; onCancel: () => void;
  children: React.ReactNode; footer: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
    <div className="w-full max-w-4xl rounded-lg border border-slate-300 bg-white shadow-xl">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-medium">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
        </div>
        <button
          type="button" onClick={onCancel} aria-label="Close without changing anything"
          className="ml-auto rounded border border-slate-300 p-1 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>
    </div>
  </div>
);

const Tick = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button" onClick={onClick} role="checkbox" aria-checked={on}
    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
      on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 bg-white"
    }`}
  >
    {on && <Check className="h-3 w-3" />}
  </button>
);

// ============================================================================
// FEATURE 1 — BATCH APPLY
// ============================================================================

export function BatchPanel({
  plan, busy, onCancel, onConfirm,
}: {
  plan: BatchPlan;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (chosen: BatchCandidate[]) => void;
}) {
  const keyOf = (c: BatchCandidate) => `${c.questionNumber}::${c.sourceLine}`;
  const [off, setOff] = useState<Record<string, true>>({});
  const chosen = plan.all.filter((c) => !off[keyOf(c)]);

  return (
    <Shell
      title="Apply precedents"
      subtitle={`${plan.all.length} unruled line(s) match a precedent you have written down. Nothing is saved until you confirm.`}
      onCancel={onCancel}
      footer={
        <>
          <button
            type="button" disabled={busy || chosen.length === 0}
            onClick={() => onConfirm(chosen)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Applying…" : `Rule ${chosen.length} line(s)`}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
          {chosen.length !== plan.all.length && (
            <span className="font-mono text-[11px] text-slate-500">
              {plan.all.length - chosen.length} unticked — those stay unruled
            </span>
          )}
        </>
      }
    >
      {plan.skipped.length > 0 && (
        // ⚠ SHOWN, NOT SWALLOWED. A batch that quietly skipped half the paper
        // and reported success is indistinguishable from one that worked.
        <p className="mb-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Skipped {plan.skipped.length}:{" "}
          {plan.skipped.slice(0, 4).map((s) => `${s.questionNumber} (${s.reason})`).join(", ")}
          {plan.skipped.length > 4 ? " …" : ""}
        </p>
      )}

      {plan.groups.length === 0 && (
        <p className="text-sm text-slate-600">
          Nothing matches. Every unruled line needs your own reading.
        </p>
      )}

      {plan.groups.map((g) => (
        <section key={g.precedentId} className="mb-5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {g.precedentId} · {g.title} → {g.verdict.replace(/_/g, " ")}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {g.candidates.map((c) => {
              const k = keyOf(c);
              const on = !off[k];
              return (
                <li key={k} className={`flex gap-2 rounded border p-2 ${on ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                  <Tick on={on} onClick={() => setOff((s) => (on ? { ...s, [k]: true } : Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)) as Record<string, true>))} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">“{c.text}”</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {c.questionNumber} · p{toViewerPage(c.page)} · {c.suggestion.reason}
                      {c.suggestion.option ? ` · option ${c.suggestion.option}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Shell>
  );
}

// ============================================================================
// FEATURE 2 — EXACT-MATCH VERIFY
// ============================================================================

export type VerifyCandidate = {
  questionNumber: string;
  pointCode: string;
  criterion: string;
  page: number;
  y: number;
};

export function VerifyPanel({
  eligible, excluded, busy, onCancel, onConfirm,
}: {
  eligible: VerifyCandidate[];
  excluded: { questionNumber: string; pointCode: string; criterion: string; reason: string }[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (chosen: VerifyCandidate[]) => void;
}) {
  const keyOf = (c: { questionNumber: string; pointCode: string }) => `${c.questionNumber}::${c.pointCode}`;
  const [off, setOff] = useState<Record<string, true>>({});
  const chosen = eligible.filter((c) => !off[keyOf(c)]);

  return (
    <Shell
      title="Verify exact matches"
      subtitle="Marking points whose text is byte-identical to the printed line, with nothing the PDF text layer could have flattened."
      onCancel={onCancel}
      footer={
        <>
          <button
            type="button" disabled={busy || chosen.length === 0}
            onClick={() => onConfirm(chosen)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Verifying…" : `Verify ${chosen.length} point(s)`}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {eligible.map((c) => {
          const k = keyOf(c);
          const on = !off[k];
          return (
            <li key={k} className={`flex gap-2 rounded border p-2 ${on ? "border-slate-200" : "bg-slate-50 opacity-60 border-slate-200"}`}>
              <Tick on={on} onClick={() => setOff((s) => (on ? { ...s, [k]: true } : Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)) as Record<string, true>))} />
              <div className="min-w-0">
                <p className="text-sm text-slate-900">{c.criterion}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {c.questionNumber} · {c.pointCode} · p{toViewerPage(c.page)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {excluded.length > 0 && (
        // ⚠ THE EXCLUSIONS ARE THE IMPORTANT HALF OF THIS SCREEN. "1.672 × 10²¹"
        // reaches the text layer as "1.672 × 1021" — the proposal and the
        // source then agree perfectly and are both wrong. These go to you.
        <section className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            {excluded.length} excluded — you must read these yourself
          </h3>
          <ul className="mt-2 space-y-1">
            {excluded.map((c) => (
              <li key={`${c.questionNumber}::${c.pointCode}`} className="rounded border border-amber-300 bg-amber-50 p-2">
                <p className="text-sm text-amber-950">{c.criterion}</p>
                <p className="mt-0.5 font-mono text-[10px] text-amber-800">
                  {c.questionNumber} · {c.pointCode} · {c.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

// ============================================================================
// FEATURE 4 — BULK APPROVE
// ============================================================================

export function BulkApprovePanel({
  candidates, busy, onCancel, onConfirm,
}: {
  candidates: { questionNumber: string; marks: number; points: number; lines: number }[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (chosen: string[]) => void;
}) {
  const [off, setOff] = useState<Record<string, true>>({});
  const chosen = candidates.filter((c) => !off[c.questionNumber]).map((c) => c.questionNumber);

  return (
    <Shell
      title="Approve fully-resolved questions"
      subtitle="Every yellow line ruled and every marking point ruled on. Approving is your signature — Emit gating is unchanged."
      onCancel={onCancel}
      footer={
        <>
          <button
            type="button" disabled={busy || chosen.length === 0}
            onClick={() => onConfirm(chosen)}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Approving…" : `Approve ${chosen.length} question(s)`}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-600">
          Nothing is fully resolved yet. A question qualifies once every yellow line is ruled
          and every marking point has been ruled on.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {candidates.map((c) => {
            const on = !off[c.questionNumber];
            return (
              <li key={c.questionNumber} className={`flex items-center gap-2 rounded border p-2 ${on ? "border-slate-200" : "bg-slate-50 opacity-60 border-slate-200"}`}>
                <Tick on={on} onClick={() => setOff((s) => (on ? { ...s, [c.questionNumber]: true } : Object.fromEntries(Object.entries(s).filter(([x]) => x !== c.questionNumber)) as Record<string, true>))} />
                <span className="font-mono text-sm">{c.questionNumber}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {c.marks} mark(s) · {c.points} point(s) · {c.lines} line(s) ruled
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

// ============================================================================
// UTILITY — MANUAL BLOCK ENTRY
// ============================================================================

export function ManualBlockPanel({
  shortfalls, busy, onCancel, onSubmit,
}: {
  shortfalls: TariffRow[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    questionNumber: string; page: number; marks: number;
    points: { pointCode: string; criterion: string }[]; guidance: string[];
  }) => void;
}) {
  const [questionNumber, setQ] = useState("");
  const [page, setPage] = useState("");
  const [marks, setMarks] = useState("");
  const [criteria, setCriteria] = useState("");
  const [guidance, setGuidance] = useState("");

  const points = criteria.split("\n").map((s) => s.trim()).filter(Boolean)
    .map((criterion, i) => ({ pointCode: `M${i + 1}`, criterion }));
  const marksNum = Number(marks);
  const pageNum = Number(page);
  const ready =
    questionNumber.trim().length > 0 &&
    Number.isInteger(marksNum) && marksNum > 0 &&
    Number.isInteger(pageNum) && pageNum >= 0 &&
    points.length > 0;

  const F = "mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <Shell
      title="Add a missing block"
      subtitle="For a block the extractor reported but could not propose. It is recorded as hand-transcribed and then goes through the normal flow."
      onCancel={onCancel}
      footer={
        <>
          <button
            type="button" disabled={busy || !ready}
            onClick={() => onSubmit({
              questionNumber: questionNumber.trim(),
              page: pageNum,
              marks: marksNum,
              points,
              guidance: guidance.split("\n").map((s) => s.trim()).filter(Boolean),
            })}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add block"}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
          {!ready && (
            <span className="font-mono text-[11px] text-slate-500">
              needs a question number, a page, a positive tariff and at least one point
            </span>
          )}
        </>
      }
    >
      {shortfalls.length > 0 && (
        // ⚠ THE ARITHMETIC IS THE REASON THIS SCREEN EXISTS. The blocks all
        // look fine individually; only the sum knows one is missing.
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">The paper does not add up:</p>
          <ul className="mt-1 font-mono text-xs">
            {shortfalls.map((r) => (
              <li key={r.question}>
                Q{r.question}: printed {r.printed}, blocks total {r.extracted} —{" "}
                {r.shortfall > 0 ? `${r.shortfall} missing` : `${-r.shortfall} too many`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-700">
          Question path
          <input value={questionNumber} onChange={(e) => setQ(e.target.value)} placeholder="21(b)(i)" className={F} />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Mark-scheme page (as the pager shows it)
          <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="19" inputMode="numeric" className={F} />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Tariff
          <input value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="2" inputMode="numeric" className={F} />
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-700">
        Marking points — one per line, in order (M1, M2, …)
        <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={4} className={F} />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-700">
        Guidance lines — one per line, optional
        <textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={3} className={F} />
      </label>

      {points.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-slate-500">
          will add {points.length} point(s): {points.map((p) => p.pointCode).join(", ")}
        </p>
      )}
    </Shell>
  );
}

// ============================================================================
// ADD A MISSING LINE TO AN EXISTING BLOCK
// ============================================================================

export function ManualLinePanel({
  questionNumber, isApproved, busy, onCancel, onSubmit,
}: {
  questionNumber: string;
  isApproved: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { questionNumber: string; as: "point" | "line"; text: string }) => void;
}) {
  const [text, setText] = useState("");
  const [as, setAs] = useState<"point" | "line">("line");

  return (
    <Shell
      title={`Add a missing line to ${questionNumber}`}
      subtitle="For a line that is in the published mark scheme but never reached this block. Recorded as hand-transcribed."
      onCancel={onCancel}
      footer={
        <>
          <button
            type="button" disabled={busy || !text.trim()}
            onClick={() => onSubmit({ questionNumber, as, text: text.trim() })}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add line"}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
        </>
      }
    >
      {isApproved && (
        // ⚠ SAID BEFORE THEY PRESS IT, NOT AFTER. Withdrawing an approval is
        // the right behaviour and a surprising one; a founder who discovers it
        // afterwards learns to distrust the button.
        <div className="mb-4 flex gap-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{questionNumber} is approved.</strong> Adding a line withdraws that approval and
            returns the question to needs-ruling. Your existing rulings are kept — only the signature
            is removed, because an approval has to refer to the content that was on screen when you
            gave it.
          </p>
        </div>
      )}

      <fieldset className="mb-3">
        <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          what kind of line is it?
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAs("line")}
            className={`rounded border px-2 py-1 text-sm ${as === "line" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>
            Needs a ruling
          </button>
          <button type="button" onClick={() => setAs("point")}
            className={`rounded border px-2 py-1 text-sm ${as === "point" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>
            A marking point
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-600">
          {as === "line"
            ? "It joins the yellow cards and you classify it like any other — Accept, Reject, Guidance, and so on."
            : "It joins the white cards as a marking point, which you then rule on."}
        </p>
      </fieldset>

      <label className="block text-xs font-medium text-slate-700">
        The line, exactly as the mark scheme prints it
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <p className="mt-2 font-mono text-[11px] text-slate-500">
        Type it verbatim — the text is the key its ruling is stored under.
      </p>
    </Shell>
  );
}
