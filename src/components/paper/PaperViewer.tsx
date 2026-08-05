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
  // Held in refs, not state: these are pdf.js handles, not render inputs.
  // In pdf.js v6 teardown lives on the LOADING TASK, not on the document —
  // PDFDocumentProxy has cleanup() but no destroy() — so both are kept.
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    url ? "loading" : "idle",
  );
  const [width, setWidth] = useState(0);

  // --- Track the available width so pages render fit-to-width and stay sharp.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Load the document once per URL.
  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Turbopack emits the worker as an asset from this URL form.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({ url });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage((p) => Math.min(Math.max(1, p), doc.numPages));
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
      docRef.current = null;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [url]);

  // --- Render the current page whenever it, or the available width, changes.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (status !== "ready" || !doc || !canvas || width <= 0) return;

    let cancelled = false;
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
        if (!cancelled) renderTaskRef.current = null;
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
  }, [page, width, status]);

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
        ref={shellRef}
        className="min-h-0 flex-1 overflow-auto bg-parchment-2 p-3 sm:p-4"
        aria-label={config.label}
      >
        {status === "error" ? (
          <div className="flex h-full items-center justify-center p-6">
            <Notice
              heading="This paper could not be loaded."
              body="The file may be missing or your connection dropped. Try again, or download the PDF instead."
            />
          </div>
        ) : (
          <div className="flex justify-center">
            {status === "loading" && (
              <p className="font-mono flex items-center gap-2 py-16 text-xs uppercase tracking-[0.2em] text-ink/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Loading paper…
              </p>
            )}
            <canvas
              ref={canvasRef}
              aria-label={`${title} — page ${page}${numPages ? ` of ${numPages}` : ""}`}
              role="img"
              className={cn(
                "max-w-full rounded shadow-sm",
                status === "ready" ? "block" : "hidden",
              )}
            />
          </div>
        )}
      </div>

      {config.showPageNav && status === "ready" && numPages > 0 && (
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
