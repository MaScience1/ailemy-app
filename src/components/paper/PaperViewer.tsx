"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from "lucide-react";
// TYPE-ONLY import: erased at compile time, so it pulls nothing into the
// bundle. The runtime import stays inside the effect below.
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";

import { cn } from "@/lib/utils";

/**
 * The single paper viewer. One implementation, configured by mode — student and
 * classroom must not diverge into two viewers (spec §9).
 *
 * WHY pdf.js AND NOT AN <iframe>: the iframe this replaces could not report a
 * page count, could not be asked which page the reader was on, offered no zoom
 * or pan, silently showed only page one on iOS Safari, and — decisively — gives
 * nowhere to put an annotation layer, since its contents are a separate
 * browsing context. Classroom annotation in Phase 3 needs a canvas whose
 * coordinate space we own. Building page navigation on the iframe would have
 * meant rebuilding it later.
 *
 * BUNDLE: pdfjs-dist is imported inside an effect, never at module scope, so it
 * lands in a lazily-fetched chunk rather than the initial JS for every visitor.
 * The results-card preview additionally keeps this component behind a
 * disclosure, so a visitor who never presses "Preview paper" never downloads
 * pdf.js at all.
 *
 * MARK SCHEME SAFETY (spec §8/§15.8): this component takes exactly ONE `url`.
 * There is no second document prop, so student mode has no channel through
 * which mark-scheme content could reach it, accidentally or otherwise.
 *
 * PHASE 1 SCOPE: render, page-level navigation, load/empty/error states. Zoom,
 * pan and the annotation layer are Phase 3 and are deliberately absent.
 */

export type PaperViewerMode = "preview" | "student" | "classroom";

/** Per-mode chrome. Deliberately data, not branching logic scattered inline. */
const MODE_CONFIG: Record<
  PaperViewerMode,
  { frame: string; showPageNav: boolean; label: string }
> = {
  preview: {
    frame: "h-[65vh] max-h-[800px] md:h-[720px]",
    showPageNav: true,
    label: "Paper preview",
  },
  student: {
    frame: "h-[70vh] lg:h-full",
    showPageNav: true,
    label: "Question paper",
  },
  classroom: {
    frame: "h-[70vh] lg:h-full",
    showPageNav: true,
    label: "Question paper",
  },
};

export function PaperViewer({
  url,
  title,
  mode = "preview",
  className = "",
}: {
  url: string | null;
  title: string;
  mode?: PaperViewerMode;
  className?: string;
}) {
  const config = MODE_CONFIG[mode];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  // A ref, correctly: the in-flight render is not a render input, it is
  // something to cancel. Contrast the document below.
  const renderTaskRef = useRef<RenderTask | null>(null);

  /**
   * ⚠ STATE, NOT A REF, AND THAT IS THE WHOLE POINT.
   *
   * This was a ref, so the render effect below could not depend on it. The
   * effect keyed on [page, width, status] and read `docRef.current`, which
   * meant nothing re-ran when the document actually ARRIVED — and under
   * React's double-invoked effects the first run could set `status` to
   * "ready", its cleanup then null the ref, and the second run's
   * `setStatus("ready")` be a no-op because the value had not changed. The
   * effect never re-ran, `docRef.current` stayed null, and every render bailed
   * on the early return.
   *
   * The result was a canvas correctly sized and NEVER PAINTED: a student saw a
   * blank white exam paper under a working "Page 1 of 24" counter, with no
   * error anywhere, because from the component's point of view the document
   * had loaded. Verified by sampling the canvas pixels — 0 ink — not by
   * looking at it.
   *
   * As state, it is a dependency. When the document arrives the effect re-runs
   * because the value changed, which is the guarantee a ref cannot give.
   */
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    url ? "loading" : "idle",
  );
  const [width, setWidth] = useState(0);

  /**
   * Has the CURRENT page's render task resolved?
   *
   * ⚠ NOT the same as `status === "ready"`, and conflating them is what this
   * exists to stop. `status` becomes "ready" when the DOCUMENT loads, which is
   * why the page counter could read "Page 1 of 24" over a canvas with no ink
   * on it — chrome asserting a state the canvas had not reached. The document
   * being loaded says nothing about whether this page has been painted.
   *
   * Reset to false the moment a render starts, set to true only when
   * task.promise resolves. Everything that claims a page is on screen is
   * gated on this, not on `status`.
   */
  const [painted, setPainted] = useState(false);

  // --- Track the available width so pages render fit-to-width and stay sharp.
  //
  // ⚠ MEASURED SYNCHRONOUSLY ON MOUNT, then observed for CHANGES ONLY.
  //
  // This used to rely on ResizeObserver's initial observation to produce the
  // first width. The spec says observe() delivers one, but that is a promise
  // about a callback on some future frame, and it is not honoured everywhere:
  // in the browser the admin region mapper was verified in, a fresh observer
  // on an already-laid-out 896px element never fired at all.
  //
  // The consequence here is worse than in an admin tool. `width` stays 0, the
  // render effect below bails on `width <= 0`, and the canvas keeps its
  // `hidden` class — so a student gets a silent, permanently blank exam paper.
  // No error state, no spinner, nothing to report: `status` is "ready",
  // because the DOCUMENT loaded fine. It is only the measurement that never
  // happened, and there is no code path that could notice.
  //
  // Reading the box on mount makes first paint immediate and demotes the
  // observer from a dependency to an optimisation for later resizes.
  //
  // The ref is on a padding-free wrapper inside the padded scroll container,
  // so getBoundingClientRect and contentRect measure the SAME box. Mixing them
  // would resize the page by the padding the first time a resize did fire.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = (w: number) => {
      // Never write a 0: a transiently-unlaid-out element must not blank a
      // page that is already rendering correctly.
      if (w > 0) setWidth(Math.floor(w));
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Load the document once per URL.
  //
  // ⚠ THE LOADING TASK IS A LOCAL, NOT A REF. It used to live in a ref that
  // every run shared, so run A's cleanup destroyed whatever task was in it —
  // which, after a re-run, was run B's. B then resolved against a destroyed
  // task or never resolved at all. Each run now owns and tears down exactly
  // the task it created.
  useEffect(() => {
    if (!url) {
      setStatus("idle");
      setDoc(null);
      return;
    }
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    setStatus("loading");
    setDoc(null);
    setPainted(false);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Turbopack emits the worker as an asset from this URL form.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        task = pdfjs.getDocument({ url });
        const loaded = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        setNumPages(loaded.numPages);
        setPage((p) => Math.min(Math.max(1, p), loaded.numPages));
        setDoc(loaded);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // Missing file, 404, CORS, offline — all land here. The user gets a
        // recovery path, never a stack trace (spec §11).
        console.error("[PaperViewer] failed to load PDF", e);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      void task?.destroy();
    };
  }, [url]);

  // --- Render the current page whenever it, or the available width, changes.
  //
  // ⚠ VERIFYING THIS IN AN AUTOMATED BROWSER: pdf.js drives its chunked render
  // off requestAnimationFrame, and a tab whose document.visibilityState is
  // "hidden" never fires one. The render task is created and its promise
  // simply never settles, so the canvas stays a single flat colour with the
  // page counter showing — identical to a real rendering bug, and it survives
  // a reload. Check `document.visibilityState` and whether a bare
  // requestAnimationFrame callback runs BEFORE concluding anything about this
  // component; forcing a composite (a screenshot) completes the render.
  // An hour was spent bisecting a bug that was the harness.
  useEffect(() => {
    const canvas = canvasRef.current;
    // `doc` is in the dependency list below, so this runs the moment the
    // document arrives. No status check: holding a document IS being ready.
    if (!doc || !canvas || width <= 0) return;

    let cancelled = false;
    // The canvas is about to be resized, which CLEARS it. From here until the
    // task resolves there is genuinely nothing on screen, and the UI says so.
    setPainted(false);
    (async () => {
      try {
        // Cancel any in-flight render before starting another, or two rapid
        // page changes race and paint the wrong page.
        renderTaskRef.current?.cancel();

        const pdfPage = await doc.getPage(page);
        if (cancelled) return;

        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = width / unscaled.width;
        const viewport = pdfPage.getViewport({ scale });
        // Render at device resolution so text is not soft on retina displays,
        // then scale back down with CSS.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = pdfPage.render({ canvasContext: ctx, canvas, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) {
          renderTaskRef.current = null;
          // The one place this is set. A page is "shown" when pdf.js says it
          // finished drawing it, not when the document loaded.
          setPainted(true);
        }
      } catch (e) {
        // A cancelled render throws; that is expected and not an error state.
        if (!cancelled && (e as { name?: string })?.name !== "RenderingCancelledException") {
          console.error("[PaperViewer] page render failed", e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, page, width]);

  const go = useCallback(
    (delta: number) =>
      setPage((p) => Math.min(Math.max(1, p + delta), numPages || 1)),
    [numPages],
  );

  const frame = cn(
    config.frame,
    "flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-snow",
    className,
  );

  if (!url) {
    return (
      <div className={cn(frame, "items-center justify-center p-6")}>
        <Notice
          heading="Question paper not yet uploaded."
          body="The PDF will appear here as soon as it is added."
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      <div
        className="min-h-0 flex-1 overflow-auto bg-parchment-2 p-3 sm:p-4"
        aria-label={config.label}
      >
        {/* The measured box. Padding-free and always rendered, so the width
            read on mount is the same box the observer reports later, and the
            ref is never null on a state the effect cannot re-run for. */}
        <div ref={shellRef} className="w-full">
        {status === "error" ? (
          <div className="flex h-full items-center justify-center p-6">
            <Notice
              heading="This paper could not be loaded."
              body="The file may be missing or your connection dropped. Try again, or download the PDF instead."
            />
          </div>
        ) : (
          <div className="flex justify-center">
            {/* Shown until pdf.js says the page is DRAWN, not until the
                document loads. Those are different moments, and the gap
                between them is where a blank canvas used to sit under
                confident chrome. */}
            {!painted && (
              <p
                className="font-mono flex items-center gap-2 py-16 text-xs uppercase tracking-[0.2em] text-ink/55"
                aria-live="polite"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {status === "loading" ? "Loading paper…" : `Rendering page ${page}…`}
              </p>
            )}
            <canvas
              ref={canvasRef}
              aria-label={`${title} — page ${page}${numPages ? ` of ${numPages}` : ""}`}
              role="img"
              className={cn(
                "max-w-full rounded shadow-sm",
                // `painted`, NOT `status`. A sized-but-unpainted canvas is a
                // blank white rectangle, and showing it is the same lie as a
                // page counter over nothing.
                painted ? "block" : "hidden",
              )}
            />
          </div>
        )}
        </div>
      </div>

      {/* `painted` gates this too: "Page 1 of 24" is a claim that page 1 is
          in front of you. Until the render resolves, it is not. */}
      {config.showPageNav && painted && numPages > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink/10 bg-snow px-3 py-2">
          <PageButton onClick={() => go(-1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </PageButton>

          <p
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60"
            aria-live="polite"
          >
            Page {page} of {numPages}
          </p>

          <PageButton onClick={() => go(1)} disabled={page >= numPages} label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-parchment px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/35 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Notice({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="max-w-sm text-center">
      <FileWarning className="mx-auto h-8 w-8 text-ink/40" aria-hidden="true" />
      <p className="font-display mt-4 text-lg font-medium tracking-tight">
        {heading}
      </p>
      <p className="mt-2 text-sm text-ink/60">{body}</p>
    </div>
  );
}
