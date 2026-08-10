"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import type {
  LineKind,
  LineRuling,
  PointRuling,
  ProposedLine,
  QuestionRulings,
  ReviewItem,
} from "@/lib/exam/markscheme-proposals";
import type { ReviewData } from "@/lib/exam/markscheme-review";
import { saveQuestionRulingsAction } from "@/app/admin/papers/[paper]/markscheme/actions";

/**
 * Rule on extracted mark-scheme proposals against the published PDF.
 *
 * ============================================================================
 * THE BOTTLENECK THIS EXISTS FOR
 * ============================================================================
 * Extraction is solved: the extractor reads a paper in seconds and refuses to
 * classify the lines that carry an examiner ruling. 68 of those are sitting in
 * WCH11/01 with nowhere to make one. That, not extraction, is what stands
 * between this and every remaining paper.
 *
 * ============================================================================
 * ⚠ A RULING IS PRESENTED AS A CHOICE, NEVER AS A DEFAULT
 * ============================================================================
 * Every flagged line asks the actual question — is this a criterion, an accept,
 * a reject, or guidance — with NOTHING pre-selected. The person answering will
 * be tired and there will be 68 of them; a pre-selected radio is a decision
 * made by the layout rather than by the reviewer, and "Do not accept X" filed
 * as a concession is precisely the failure that shipped once already.
 *
 * The same reason the count of remaining rulings is on screen at all times: a
 * queue you cannot see the end of gets abandoned in the middle, and a
 * half-reviewed mark scheme looks exactly like a finished one.
 *
 * ============================================================================
 * ⚠ NOTHING IS CONCLUDED FROM AN UNPAINTED PAGE
 * ============================================================================
 * The region mapper refuses to accept a drawn box until the canvas has actually
 * painted, because a box drawn over blank white is a box in the wrong place. The
 * same rule applies here for the same reason: approving a question means "I
 * checked this against the page", and the page has to be ON THE SCREEN. Approve
 * is disabled until the source page for that question has painted, and says so.
 */

type Draft = { points: Record<string, PointRuling>; lines: Record<string, LineRuling> };

const LINE_CHOICES: { kind: LineKind; label: string; hint: string }[] = [
  { kind: "criterion", label: "Criterion", hint: "this line IS a marking point" },
  { kind: "accept", label: "Accept", hint: "still earns the mark" },
  { kind: "reject", label: "Reject", hint: "must NOT earn the mark" },
  { kind: "guidance", label: "Guidance", hint: "neither — examiner prose" },
  { kind: "discard", label: "Discard", hint: "carries nothing we should store" },
];

export function MarkSchemeReview({ data }: { data: ReviewData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [shellWidth, setShellWidth] = useState(0);
  const [pageHeightPt, setPageHeightPt] = useState(0);

  /**
   * ⚠ TRUE ONLY ONCE INK IS ON THE CANVAS. `status === "ready"` says the
   * document loaded, which is a different claim: the canvas is resized (and so
   * cleared) before every render, so between those two moments the page is
   * blank while the chrome would happily say it is showing page 12.
   */
  const [painted, setPainted] = useState(false);

  const [selected, setSelected] = useState<string>(data.items[0]?.question.questionNumber ?? "");
  const [highlightY, setHighlightY] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [onlyUnruled, setOnlyUnruled] = useState(false);

  // ── measure, synchronously on mount ──────────────────────────────────────
  // An observer alone never fires in a browser that reports a stable size, and
  // the pane then stays 0 wide with no error — a blank tool that looks broken.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    setShellWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setShellWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data.markSchemeUrl) {
      setStatus("error");
      setLoadError("This paper has no mark-scheme PDF, so there is nothing to check the proposals against.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url: data.markSchemeUrl! });
        loadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        console.error("[MarkSchemeReview] failed to load the mark scheme", e);
        setStatus("error");
        // ⚠ A FAILURE RENDERS AS A FAILURE. "No proposals selected" is this
        // tool's normal empty state, so a swallowed load error would look
        // identical to a working tool — and someone would rule on 68 lines
        // without ever seeing the page they were meant to be checking.
        setLoadError("The mark scheme could not be loaded, so no page is being shown. Nothing here can be approved until it is.");
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      docRef.current = null;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [data.markSchemeUrl]);

  // ── render the current page ──────────────────────────────────────────────
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !doc || !canvas || shellWidth <= 0) return;
    let cancelled = false;
    setPainted(false);
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        setPageHeightPt(base.height);
        const scale = shellWidth / base.width;
        const viewport = p.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        renderTaskRef.current?.cancel();
        const task = p.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
        setPainted(true);
      } catch (e) {
        if (cancelled) return;
        if ((e as { name?: string })?.name === "RenderingCancelledException") return;
        console.error("[MarkSchemeReview] render failed", e);
        setStatus("error");
        setLoadError("That page could not be drawn, so nothing is being shown for it.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, page, shellWidth]);

  const items = useMemo(
    () => (onlyUnruled ? data.items.filter((i) => i.unruled.length > 0) : data.items),
    [data.items, onlyUnruled],
  );
  const current = data.items.find((i) => i.question.questionNumber === selected) ?? data.items[0];

  const draftFor = useCallback(
    (qn: string): Draft => draft[qn] ?? { points: {}, lines: {} },
    [draft],
  );

  /** Jump the page and put the highlight on the line, the way the mapper does. */
  const goTo = useCallback((p: number, y: number | null) => {
    setPage((prev) => (prev === p ? prev : p));
    setHighlightY(y);
  }, []);

  const selectQuestion = useCallback(
    (item: ReviewItem) => {
      setSelected(item.question.questionNumber);
      goTo(item.question.page, item.question.marks?.y ?? null);
    },
    [goTo],
  );

  const ruleLine = (qn: string, line: ProposedLine, kind: LineKind) =>
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      return {
        ...d,
        [qn]: { ...cur, lines: { ...cur.lines, [line.sourceLine]: { ...cur.lines[line.sourceLine], kind } } },
      };
    });

  const editLine = (qn: string, line: ProposedLine, editedText: string) =>
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      const existing = cur.lines[line.sourceLine];
      if (!existing) return d; // editing before choosing a kind would imply one
      return {
        ...d,
        [qn]: { ...cur, lines: { ...cur.lines, [line.sourceLine]: { ...existing, editedText } } },
      };
    });

  const rulePoint = (qn: string, code: string, ruling: PointRuling) =>
    setDraft((d) => {
      const cur = d[qn] ?? { points: {}, lines: {} };
      return { ...d, [qn]: { ...cur, points: { ...cur.points, [code]: ruling } } };
    });

  const localUnruled = (item: ReviewItem) => {
    const d = draftFor(item.question.questionNumber);
    return item.question.requiresRuling.filter((l) => !d.lines[l.sourceLine]).length;
  };

  const totalRemaining =
    data.items.reduce((n, i) => n + localUnruled(i), 0);

  const save = async (item: ReviewItem, approve: boolean) => {
    const qn = item.question.questionNumber;
    const d = draftFor(qn);
    setSaving(qn);
    setNotice(null);
    const rulings: QuestionRulings = {
      points: d.points,
      lines: d.lines,
      ...(approve
        ? { approvedAt: new Date().toISOString(), approvedBy: "self" }
        : {}),
    };
    const res = await saveQuestionRulingsAction(data.paperSlug, qn, rulings);
    setSaving(null);
    setNotice(
      res.ok
        ? { kind: "ok", text: `${qn} saved${approve ? " and approved" : ""}.` }
        : { kind: "bad", text: res.error },
    );
  };

  const verified = new Set(data.verifiedQuestions);

  return (
    <div className="space-y-4">
      {/* ── the count, always visible ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Rulings remaining
        </span>
        <span className={`font-mono text-2xl ${totalRemaining === 0 ? "text-emerald-700" : "text-slate-900"}`}>
          {totalRemaining}
        </span>
        <span className="text-sm text-slate-600">
          {data.approved} of {data.total} question(s) approved
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyUnruled}
            onChange={(e) => setOnlyUnruled(e.target.checked)}
          />
          only questions needing a ruling
        </label>
      </div>

      {!data.canPersist && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This instance cannot save rulings — they are written to the repository
          working tree, which a deployed instance does not have. Run the tool
          locally. Nothing you do here will persist.
        </p>
      )}
      {!data.canWrite && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Read-only: saving needs a marker or admin role, and your session holds{" "}
          {data.roles.length ? data.roles.join(", ") : "none"}.
        </p>
      )}
      {notice && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── the published page ──────────────────────────────────────── */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || status !== "ready"}
              className="rounded border border-slate-300 bg-white p-1 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-slate-600">
              {status === "ready" ? `page ${page} of ${numPages}` : "…"}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={page >= numPages || status !== "ready"}
              className="rounded border border-slate-300 bg-white p-1 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {status === "ready" && !painted && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> drawing
              </span>
            )}
          </div>

          {status === "error" ? (
            <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {loadError}
            </div>
          ) : (
            <div ref={shellRef} className="relative w-full overflow-hidden">
              <canvas ref={canvasRef} className="block w-full" />
              {/* The highlight is a percentage band, so it stays on the same
                  ink at any width — the mapper's reasoning, same trick. */}
              {painted && highlightY !== null && pageHeightPt > 0 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 border-y-2 border-amber-500 bg-amber-300/25"
                  style={{
                    top: `${Math.max(0, (highlightY / pageHeightPt) * 100 - 1.2)}%`,
                    height: "2.6%",
                  }}
                />
              )}
              {status === "loading" && (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> loading the mark scheme…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── the proposals ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="max-h-[22rem] overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">
                Nothing left needing a ruling.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const qn = item.question.questionNumber;
                  const remaining = localUnruled(item);
                  return (
                    <li key={qn}>
                      <button
                        type="button"
                        onClick={() => selectQuestion(item)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          qn === selected ? "bg-slate-100" : ""
                        }`}
                      >
                        <span className="font-mono w-20 shrink-0">{qn}</span>
                        {verified.has(qn) && (
                          // ⚠ The five already transcribed by hand. Shown so a
                          // reviewer can watch the extractor agree with them on
                          // a known answer before trusting it on the other 42.
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-800">
                            verified
                          </span>
                        )}
                        <span className="text-slate-600">
                          {item.question.points.length} point(s)
                        </span>
                        {remaining > 0 ? (
                          <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-900">
                            {remaining} to rule
                          </span>
                        ) : item.approved ? (
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                            approved
                          </span>
                        ) : (
                          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-400">
                            ready
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.worstConfidence.toFixed(2)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {current && (
            <QuestionPanel
              item={current}
              draft={draftFor(current.question.questionNumber)}
              painted={painted}
              onSamePage={page === current.question.page}
              canWrite={data.canWrite && data.canPersist}
              saving={saving === current.question.questionNumber}
              onGoTo={goTo}
              onRuleLine={(l, k) => ruleLine(current.question.questionNumber, l, k)}
              onEditLine={(l, txt) => editLine(current.question.questionNumber, l, txt)}
              onRulePoint={(code, r) => rulePoint(current.question.questionNumber, code, r)}
              onSave={(approve) => save(current, approve)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionPanel({
  item, draft, painted, onSamePage, canWrite, saving,
  onGoTo, onRuleLine, onEditLine, onRulePoint, onSave,
}: {
  item: ReviewItem;
  draft: Draft;
  painted: boolean;
  onSamePage: boolean;
  canWrite: boolean;
  saving: boolean;
  onGoTo: (page: number, y: number | null) => void;
  onRuleLine: (line: ProposedLine, kind: LineKind) => void;
  onEditLine: (line: ProposedLine, text: string) => void;
  onRulePoint: (code: string, ruling: PointRuling) => void;
  onSave: (approve: boolean) => void;
}) {
  const q = item.question;
  const remaining = q.requiresRuling.filter((l) => !draft.lines[l.sourceLine]);
  // ⚠ BOTH CONDITIONS. "Approve" asserts the reviewer checked this against the
  // page, so the page must have painted AND be the right one.
  const pageIsShowing = painted && onSamePage;
  const canApprove = canWrite && remaining.length === 0 && pageIsShowing;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg font-medium">{q.questionNumber}</h2>
        <span className="font-mono text-xs text-slate-500">
          {q.marks ? `${q.marks.value} mark(s)` : "no tariff extracted"} · page {q.page}
        </span>
        <button
          type="button"
          onClick={() => onGoTo(q.page, q.marks?.y ?? null)}
          className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-500 underline"
        >
          show on page
        </button>
      </div>

      {q.markingRule && (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {q.markingRule}
        </p>
      )}

      {/* ── the proposed points ──────────────────────────────────────── */}
      <h3 className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        Proposed marking points
      </h3>
      <ul className="mt-2 space-y-2">
        {q.points.map((p) => {
          const r = draft.points[p.pointCode];
          return (
            <li key={p.pointCode} className="rounded border border-slate-200 p-2">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-slate-500">{p.pointCode}</span>
                {p.route > 1 && (
                  <span className="rounded bg-slate-100 px-1 font-mono text-[9px] text-slate-600">
                    route {p.route}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onGoTo(p.page, p.y)}
                  className="flex-1 text-left text-sm text-slate-800 hover:underline"
                >
                  {r?.verdict === "edit" ? r.criterion : p.criterion}
                </button>
                <span className="font-mono text-[10px] text-slate-400">{p.confidence.toFixed(2)}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                p{p.page} · {p.derivedFrom}
              </p>
              <p className="mt-1 border-l-2 border-slate-200 pl-2 font-mono text-[10px] text-slate-500">
                {p.sourceLine}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Choice on={r?.verdict === "accept"} onClick={() => onRulePoint(p.pointCode, { verdict: "accept" })}>
                  Accept as-is
                </Choice>
                <Choice
                  on={r?.verdict === "edit"}
                  onClick={() => onRulePoint(p.pointCode, { verdict: "edit", criterion: p.criterion })}
                >
                  Edit
                </Choice>
                <Choice
                  on={r?.verdict === "reject"}
                  onClick={() => onRulePoint(p.pointCode, { verdict: "reject", why: "rejected in review" })}
                >
                  Reject
                </Choice>
              </div>
              {r?.verdict === "edit" && (
                <textarea
                  value={r.criterion}
                  onChange={(e) => onRulePoint(p.pointCode, { verdict: "edit", criterion: e.target.value })}
                  rows={2}
                  className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* ── the rulings ──────────────────────────────────────────────── */}
      {q.requiresRuling.length > 0 && (
        <>
          <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-700">
            Needs your ruling — {remaining.length} of {q.requiresRuling.length} left
          </h3>
          <ul className="mt-2 space-y-3">
            {q.requiresRuling.map((line) => {
              const chosen = draft.lines[line.sourceLine];
              return (
                <li
                  key={line.sourceLine}
                  className={`rounded border p-3 ${
                    chosen ? "border-slate-200" : "border-amber-300 bg-amber-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onGoTo(line.page, line.y)}
                    className="text-left text-sm font-medium text-slate-900 hover:underline"
                  >
                    “{line.text}”
                  </button>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    p{line.page} · confidence {line.confidence.toFixed(2)}
                  </p>
                  {(line.requiresRuling ?? []).map((why) => (
                    <p key={why} className="mt-1 text-xs text-amber-800">
                      ⚠ {why}
                    </p>
                  ))}
                  {/* ⚠ NOTHING PRE-SELECTED. See the header. */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LINE_CHOICES.map((c) => (
                      <Choice
                        key={c.kind}
                        on={chosen?.kind === c.kind}
                        title={c.hint}
                        onClick={() => onRuleLine(line, c.kind)}
                      >
                        {c.label}
                      </Choice>
                    ))}
                  </div>
                  {chosen && chosen.kind !== "discard" && (
                    <input
                      value={chosen.editedText ?? line.text}
                      onChange={(e) => onEditLine(line, e.target.value)}
                      className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ── save / approve ───────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={!canWrite || saving}
          onClick={() => onSave(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {saving ? "saving…" : "Save progress"}
        </button>
        <button
          type="button"
          disabled={!canApprove || saving}
          onClick={() => onSave(true)}
          className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" /> Approve {q.questionNumber}
        </button>
        {!canApprove && (
          <span className="text-xs text-slate-600">
            {remaining.length > 0
              ? `${remaining.length} line(s) still need a ruling.`
              : !pageIsShowing
                ? `Showing page ${q.page} is part of approving it — the page has to be on screen before you can say you checked it.`
                : "Read-only."}
          </span>
        )}
      </div>
    </div>
  );
}

function Choice({
  on, onClick, children, title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded border px-2 py-1 font-mono text-[11px] ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
