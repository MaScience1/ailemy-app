"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Trash2, ZoomIn, ZoomOut } from "lucide-react";

import type { MappableQuestion, PaperMapping } from "@/lib/exam/regions";
import {
  assertRotationMatches,
  clampToPage,
  normaliseDrag,
  normaliseRotation,
  pixelToViewport,
  roundForStorage,
  toPercent,
  validateRegion,
  type PageBox,
  type Rotation,
  type ViewportRect,
} from "@/lib/exam/region-geometry";
import {
  emitRegionFixture,
  emitRegionJson,
  type RegionDraft,
} from "@/lib/exam/region-fixture";

/**
 * Drag a box round a question, attach it to a paper_questions row.
 *
 * ============================================================================
 * ALIGNMENT ACROSS ZOOM, RESIZE AND VIEWPORT CHANGES
 * ============================================================================
 * Overlays are positioned in PERCENTAGES of the page, never in pixels. The
 * canvas is sized to `viewport.width/height` in CSS pixels and the overlay is
 * the same box; a region at `left: 12.4%` therefore lands on the same ink at
 * any width, any zoom, on any device — recomputed by the browser on every
 * layout, in the same frame as the canvas it sits over.
 *
 * The alternative — store pixels, multiply by the current scale, re-render on
 * resize — is a correctness problem disguised as an implementation detail:
 * every consumer must recompute at exactly the right moment, and a single
 * cached or stale scale silently shifts the boxes. Percentages contain no
 * scale, so there is no scale to get wrong.
 *
 * `scale` still exists here, in exactly ONE place: converting a drag in CSS
 * pixels into the viewport points that get stored. It never touches rendering.
 *
 * ============================================================================
 * ⚠ ROTATION IS ASSERTED, NEVER APPLIED
 * ============================================================================
 * `getViewport({ scale: 1 })` has already applied the page's /Rotate, so a
 * stored bbox is in rotated space and needs no correction. On every page this
 * checks the live /Rotate against what each stored region recorded, and a
 * mismatch means the box is NOT DRAWN and is listed as needing a re-map. A
 * missing overlay sends someone to fix it; a confidently misplaced one does
 * not.
 *
 * ============================================================================
 * ⚠ A FAILED LOAD RENDERS AS A FAILURE, NEVER AS AN EMPTY OVERLAY
 * ============================================================================
 * "No regions yet" is this tool's normal starting state, so a swallowed error
 * would be indistinguishable from a working tool on an unmapped paper — and
 * someone would draw boxes for an hour on top of regions that had failed to
 * load. Every failure path below sets an explicit error state.
 */

type Draft = RegionDraft & { localId: string };

const DRAFT_STORAGE_PREFIX = "ailemy:region-drafts:";

export function RegionMapper({ mapping }: { mapping: PaperMapping }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [shellWidth, setShellWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  /** Unscaled page box + live /Rotate for the CURRENT page. */
  const [pageBox, setPageBox] = useState<PageBox | null>(null);
  const [pageRotation, setPageRotation] = useState<Rotation>(0);
  /**
   * Has THIS page's render task resolved? Not the same as `status`, which only
   * says the document loaded. Drawing boxes onto an unpainted canvas would
   * capture coordinates against a page nobody can see — the overlay would look
   * exactly as it does now, and be positioned against nothing.
   */
  const [painted, setPainted] = useState(false);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<string | null>(
    mapping.questions[0]?.questionNumber ?? null,
  );
  const [drag, setDrag] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  /**
   * Drawing is OFF until explicitly armed.
   *
   * Selection used to be enough: pick a question, and any drag on the page
   * became a box. Reviewing a paper means selecting questions constantly and
   * dragging to scroll or to select text, so review silently produced drafts —
   * two of them, in one pass, before anyone noticed. Selecting a question is
   * navigation; drawing a box is an edit, and they should not be the same
   * gesture.
   *
   * Disarms itself after one box, so a single arming cannot produce two.
   */
  const [armed, setArmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState<"none" | "ts" | "json">("none");

  const storageKey = `${DRAFT_STORAGE_PREFIX}${mapping.paperId}`;

  // --- drafts survive a refresh -------------------------------------------
  // Deliberately localStorage and not the database: a draft is not a region.
  // Writing unapproved boxes into question_regions would put proposals in the
  // same table Teacher Mode reads, and 0028 has no "draft" state to hold them
  // apart. The export is the commit.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDrafts(JSON.parse(raw) as Draft[]);
    } catch (e) {
      console.error("[RegionMapper] could not restore drafts", e);
      setNotice("Saved drafts could not be restored — starting empty.");
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drafts));
    } catch (e) {
      console.error("[RegionMapper] could not save drafts", e);
      setNotice("Drafts are not being saved locally — export before you close this tab.");
    }
  }, [drafts, storageKey]);

  // --- available width ----------------------------------------------------
  //
  // ⚠ MEASURED SYNCHRONOUSLY FIRST, then observed for CHANGES.
  //
  // Observing alone is not enough. The spec says observe() delivers an initial
  // observation, but that is a promise about a callback on a future frame, and
  // it is not honoured everywhere — in the browser this tool was verified in,
  // a fresh ResizeObserver on an already-laid-out 896px element never fired at
  // all. The page then sat at width 0 forever: no canvas, no error, an
  // indefinitely blank tool. Reading the box on mount makes first paint
  // immediate and makes the observer an optimisation rather than a dependency.
  //
  // The ref is on a padding-free wrapper on purpose, so getBoundingClientRect
  // and contentRect measure the SAME box. Mixing them would jump the page by
  // the padding the first time a resize fired.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setShellWidth(Math.floor(w));
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- load the document --------------------------------------------------
  useEffect(() => {
    if (!mapping.pdfUrl) {
      setStatus("error");
      setLoadError("This paper has no PDF uploaded, so there is nothing to map against.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setLoadError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url: mapping.pdfUrl! });
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
        console.error("[RegionMapper] failed to load PDF", e);
        setStatus("error");
        setLoadError("The paper PDF could not be loaded, so no page is being shown.");
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
  }, [mapping.pdfUrl]);

  // --- render the current page -------------------------------------------
  const renderWidth = Math.max(0, Math.floor(shellWidth * zoom));

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !doc || !canvas || renderWidth <= 0) return;

    let cancelled = false;
    // Resizing the canvas below clears it; nothing is on screen until the
    // task resolves, and the UI says so rather than showing an empty overlay.
    setPainted(false);
    (async () => {
      try {
        renderTaskRef.current?.cancel();
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;

        const unscaled = pdfPage.getViewport({ scale: 1 });
        // /Rotate is already baked into `unscaled`. Recorded, not applied.
        setPageBox({ width: unscaled.width, height: unscaled.height });
        setPageRotation(normaliseRotation(pdfPage.rotate ?? 0));

        const scale = renderWidth / unscaled.width;
        const viewport = pdfPage.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        // CSS size is the layout box the overlay matches. The dpr backing
        // store above does NOT affect it, which is why overlay maths never
        // mentions devicePixelRatio.
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setStatus("error");
          setLoadError("This browser refused a 2D canvas, so the page cannot be drawn.");
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const task = pdfPage.render({ canvasContext: ctx, canvas, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) {
          renderTaskRef.current = null;
          setPainted(true);
        }
      } catch (e) {
        if (cancelled) return;
        if ((e as { name?: string })?.name === "RenderingCancelledException") return;
        console.error("[RegionMapper] page render failed", e);
        setStatus("error");
        setLoadError(`Page ${page} could not be rendered.`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, renderWidth, status]);

  /** The ONE use of scale: CSS pixels in, viewport points out. */
  const scale = pageBox && renderWidth > 0 ? renderWidth / pageBox.width : 0;

  const questionByNumber = useMemo(() => {
    const m = new Map<string, MappableQuestion>();
    for (const q of mapping.questions) m.set(q.questionNumber, q);
    return m;
  }, [mapping.questions]);

  // --- drawing ------------------------------------------------------------
  const pointerPos = (e: React.PointerEvent) => {
    const el = overlayRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!armed || !mapping.canWrite || !selected || !pageBox || scale <= 0 || !painted) return;
    const p = pointerPos(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setNotice(null);
    setDrag({ x: p.x, y: p.y, cx: p.x, cy: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointerPos(e);
    if (!p) return;
    setDrag({ ...drag, cx: p.x, cy: p.y });
  };

  const onPointerUp = () => {
    if (!drag || !pageBox || !selected || scale <= 0) {
      setDrag(null);
      return;
    }
    const px = normaliseDrag({ x: drag.x, y: drag.y }, { x: drag.cx, y: drag.cy });
    const raw = pixelToViewport(px, scale);
    const clamped = clampToPage(raw, pageBox);
    const verdict = validateRegion(clamped, pageBox);
    setDrag(null);
    if (!verdict.ok) {
      setNotice(verdict.problem);
      return;
    }
    // One arming, one box.
    setArmed(false);
    setDrafts((prev) => [
      ...prev,
      {
        localId: `${Date.now()}-${prev.length}`,
        questionNumber: selected,
        pageNumber: page,
        rect: roundForStorage(verdict.rect),
        rotationApplied: pageRotation,
        // confidence deliberately omitted — a hand-drawn box is authored, not
        // proposed. See RegionDraft.
      },
    ]);
  };

  /**
   * Selecting a question is NAVIGATION: it jumps the page to where that
   * question actually is. Hunting through 24 pages by hand was the slow part
   * of mapping, and the page number is already known for anything with a
   * stored region.
   *
   * It also disarms. Changing question mid-draw would otherwise attach the
   * next box to a question you merely clicked past.
   */
  const selectQuestion = useCallback(
    (q: MappableQuestion) => {
      setSelected(q.questionNumber);
      setArmed(false);
      setNotice(null);
      const target = q.regions[0]?.pageNumber ?? drafts.find((d) => d.questionNumber === q.questionNumber)?.pageNumber;
      if (target && target !== page) setPage(target);
    },
    [drafts, page],
  );

  const removeDraft = useCallback((localId: string) => {
    setDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }, []);

  // Escape is the universal "stop what you are doing"; without it the only way
  // out of an armed state is to draw a box you did not want.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmed(false);
        setDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  // --- what to draw on this page -----------------------------------------
  const storedOnPage = useMemo(() => {
    const out: { q: MappableQuestion; rect: ViewportRect; approved: boolean; id: string }[] = [];
    const rotationProblems: string[] = [];
    for (const q of mapping.questions) {
      for (const r of q.regions) {
        if (r.pageNumber !== page) continue;
        const check = assertRotationMatches(r.rotationApplied, pageRotation);
        if (!check.ok) {
          rotationProblems.push(`${q.questionNumber}: ${check.problem}`);
          continue; // NOT drawn. Never drawn sideways.
        }
        out.push({
          q,
          id: r.id,
          approved: r.approvedAt !== null,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        });
      }
    }
    return { out, rotationProblems };
  }, [mapping.questions, page, pageRotation]);

  const draftsOnPage = drafts.filter((d) => d.pageNumber === page);
  const mappedNumbers = new Set([
    ...drafts.map((d) => d.questionNumber),
    ...mapping.questions.filter((q) => q.regions.length > 0).map((q) => q.questionNumber),
  ]);

  const output =
    showOutput === "ts"
      ? emitRegionFixture({
          paperSlug: mapping.paperSlug,
          drafts,
          ordering: mapping.questions.map((q) => ({
            questionNumber: q.questionNumber,
            displayOrder: q.displayOrder,
          })),
          capturedAt: new Date().toISOString(),
        })
      : showOutput === "json"
        ? emitRegionJson({
            paperSlug: mapping.paperSlug,
            drafts,
            capturedAt: new Date().toISOString(),
          })
        : "";

  // --- failure states, before anything that could look like an empty tool --
  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6">
        <p className="flex items-center gap-2 font-medium text-red-900">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          The mapper can&apos;t run
        </p>
        <p className="mt-2 text-sm text-red-800">{loadError}</p>
        <p className="mt-3 text-sm text-red-700">
          Nothing has been changed. This is deliberately not an empty page —
          an empty overlay is how a failed load would otherwise look identical
          to a paper nobody has mapped yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* ── PAGE ─────────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:opacity-40">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Prev
          </button>
          <span className="font-mono text-xs text-slate-600">
            Page {page}{numPages ? ` of ${numPages}` : ""}
          </span>
          <button type="button" onClick={() => setPage((p) => Math.min(numPages || 1, p + 1))}
            disabled={numPages > 0 && page >= numPages}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:opacity-40">
            Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <span className="mx-2 h-4 w-px bg-slate-300" />

          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="rounded-md border border-slate-300 bg-white p-1.5" aria-label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {/* Zoom exists as much to PROVE alignment as to be useful: the
              overlays are percentages, so they must track the page exactly. */}
          <span className="font-mono text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="rounded-md border border-slate-300 bg-white p-1.5" aria-label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {pageBox && (
            <span className="font-mono ml-auto text-[10px] text-slate-500">
              viewport {Math.round(pageBox.width)}×{Math.round(pageBox.height)}pt · /Rotate {pageRotation}
            </span>
          )}
        </div>

        {storedOnPage.rotationProblems.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {storedOnPage.rotationProblems.length} stored region(s) not drawn
            </p>
            <ul className="mt-1.5 list-disc pl-5">
              {storedOnPage.rotationProblems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}

        {notice && (
          <p className="mb-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {notice}
          </p>
        )}

        <div className="overflow-auto rounded-lg border border-slate-300 bg-slate-100 p-3">
          <div ref={shellRef} className="w-full">
          {!painted && (
            <p className="flex items-center gap-2 py-16 text-sm text-slate-600" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {status === "loading" ? "Loading the paper…" : `Rendering page ${page}…`}
            </p>
          )}
          <div className={`relative inline-block ${painted ? "" : "hidden"}`}>
            <canvas ref={canvasRef} className="block" aria-label={`${mapping.paperName} page ${page}`} />
            {/* The overlay is exactly the canvas box. Both come from the same
                viewport, so a percentage inside it is a percentage of the page. */}
            <div
              ref={overlayRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              className={`absolute inset-0 ${armed ? "cursor-crosshair" : "cursor-default"}`}
            >
              {pageBox && storedOnPage.out.map((s) => {
                const p = toPercent(s.rect, pageBox);
                return (
                  <div key={s.id} style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }}
                    className={`absolute border-2 ${s.approved ? "border-emerald-600 bg-emerald-400/15" : "border-sky-600 bg-sky-400/15"}`}>
                    <span className="font-mono absolute -top-5 left-0 whitespace-nowrap rounded bg-slate-900 px-1 text-[10px] text-white">
                      {s.q.questionNumber}{s.approved ? " ✓" : " (stored)"}
                    </span>
                  </div>
                );
              })}
              {pageBox && draftsOnPage.map((d) => {
                const p = toPercent(d.rect, pageBox);
                return (
                  <div key={d.localId} style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }}
                    className="absolute border-2 border-fuchsia-600 bg-fuchsia-400/20">
                    <span className="font-mono absolute -top-5 left-0 whitespace-nowrap rounded bg-fuchsia-700 px-1 text-[10px] text-white">
                      {d.questionNumber} (draft)
                    </span>
                  </div>
                );
              })}
              {drag && (
                <div
                  style={{
                    left: Math.min(drag.x, drag.cx),
                    top: Math.min(drag.y, drag.cy),
                    width: Math.abs(drag.cx - drag.x),
                    height: Math.abs(drag.cy - drag.y),
                  }}
                  className="pointer-events-none absolute border-2 border-dashed border-fuchsia-700 bg-fuchsia-400/10"
                />
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUESTIONS ────────────────────────────────────────────────────── */}
      <div className="w-full shrink-0 lg:w-80">
        {!mapping.canWrite && (
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Read-only: your roles ({mapping.roles.join(", ") || "none"}) don&apos;t include
            marker or admin, which is what 0028 requires to write regions.
          </p>
        )}
        {/* The arm control. Deliberately a separate, explicit act from
            selecting a question — see `armed`. */}
        {mapping.canWrite && selected && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setArmed((a) => !a)}
              disabled={!painted}
              aria-pressed={armed}
              className={`w-full rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                armed
                  ? "bg-fuchsia-700 text-white hover:bg-fuchsia-800"
                  : "border border-slate-300 bg-white text-slate-800 hover:border-slate-500"
              }`}
            >
              {armed ? `Drawing ${selected} — drag on the page` : `Draw a box for ${selected}`}
            </button>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {armed
                ? "Escape to cancel. Drawing switches off after one box."
                : "Selecting a question only navigates. Dragging does nothing until you press this."}
            </p>
          </div>
        )}

        <p className="font-mono mb-2 text-[10px] uppercase tracking-widest text-slate-500">
          Questions · {mappedNumbers.size}/{mapping.questions.length} mapped
        </p>
        <ul className="max-h-[60vh] space-y-1 overflow-auto pr-1">
          {mapping.questions.map((q) => {
            const isSel = q.questionNumber === selected;
            const done = mappedNumbers.has(q.questionNumber);
            return (
              <li key={q.id}>
                <button type="button" onClick={() => selectQuestion(q)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    isSel ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"
                  }`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{q.questionNumber}</span>
                    <span className={`font-mono text-[10px] ${isSel ? "text-white/70" : "text-slate-500"}`}>
                      {/* The page is what makes clicking a question feel like
                          navigation rather than a jump to somewhere unknown. */}
                      {q.regions[0] ? `p${q.regions[0].pageNumber} · mapped` : done ? "mapped" : `${q.marks ?? 0}m`}
                    </span>
                  </span>
                  {q.questionTextPreview && (
                    <span className={`mt-0.5 block truncate text-xs ${isSel ? "text-white/70" : "text-slate-500"}`}>
                      {q.questionTextPreview}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {drafts.length > 0 && (
          <div className="mt-4">
            <p className="font-mono mb-2 text-[10px] uppercase tracking-widest text-slate-500">
              Drafts · {drafts.length}
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto pr-1 text-xs">
              {drafts.map((d) => (
                <li key={d.localId} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1">
                  <span className="font-mono truncate">
                    {d.questionNumber} · p{d.pageNumber} · {Math.round(d.rect.width)}×{Math.round(d.rect.height)}pt
                  </span>
                  <button type="button" onClick={() => removeDraft(d.localId)} aria-label={`Remove ${d.questionNumber} draft`}
                    className="shrink-0 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowOutput(showOutput === "ts" ? "none" : "ts")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={drafts.length === 0}>
            {showOutput === "ts" ? "Hide" : "Fixture"}
          </button>
          <button type="button" onClick={() => setShowOutput(showOutput === "json" ? "none" : "json")}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
            disabled={drafts.length === 0}>
            JSON
          </button>
          <button type="button" onClick={() => { setDrafts([]); setShowOutput("none"); }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-red-700 disabled:opacity-40"
            disabled={drafts.length === 0}>
            Clear drafts
          </button>
        </div>

        {showOutput !== "none" && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-600">
              Paste into the fixture, then dry-run the seeder before <code>--commit</code>.
            </p>
            <textarea readOnly value={output} onFocus={(e) => e.currentTarget.select()}
              className="font-mono h-64 w-full rounded-md border border-slate-300 bg-slate-50 p-2 text-[11px]" />
          </div>
        )}
      </div>
    </div>
  );
}
