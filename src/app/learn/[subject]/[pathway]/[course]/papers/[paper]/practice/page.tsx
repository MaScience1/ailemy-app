"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Eraser, FileWarning } from "lucide-react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";

import { cn } from "@/lib/utils";

/**
 * Interactive practice canvas — PDF question paper side-by-side with a
 * tldraw whiteboard. The student opens a real exam paper next to a blank
 * canvas, works through every question with the same tools they'd use on
 * an iPad, and tldraw persists everything to the browser's IndexedDB so
 * sessions survive reloads.
 *
 * V1 architecture:
 *   - Client component (tldraw needs DOM access; PDF rendering uses an
 *     <iframe>). params is wrapped in a Promise per Next 15+/16 conventions,
 *     unwrapped with React.use().
 *   - Paper data fetched from /api/papers/[slug] on mount. We hit the API
 *     rather than a server component because the page itself is "use client"
 *     and can't import the server-only Supabase queries.
 *   - tldraw saves to localStorage / IndexedDB via persistenceKey.
 *     persistenceKey = `paper-${slug}` means each paper has its own canvas.
 *   - "Clear canvas" deletes every shape on the current page after confirm.
 *     Per-paper isolation means clearing one paper's canvas leaves all the
 *     others intact.
 *
 * Not in V1: cloud sync, multi-user collab, per-question parsing of the PDF.
 */

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  paper: string;
}>;

type PaperData = {
  slug: string;
  paper_code: string | null;
  paper_name: string;
  paper_pdf_url: string | null;
  markscheme_pdf_url: string | null;
};

type MobileView = "both" | "pdf" | "canvas";

export default function PracticePage({ params }: { params: Params }) {
  const { subject, pathway, course, paper: paperSlug } = use(params);

  const backHref = `/learn/${subject}/${pathway}/${course}/papers/${paperSlug}`;

  const [paper, setPaper] = useState<PaperData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("both");
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/papers/${paperSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Paper not found (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPaper(data as PaperData);
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Unknown error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paperSlug]);

  function handleClear() {
    const editor = editorRef.current;
    if (!editor) return;
    const ok = window.confirm(
      "Clear all your work on this paper? This can't be undone.",
    );
    if (!ok) return;
    const ids = editor.getCurrentPageShapeIds();
    editor.deleteShapes([...ids]);
  }

  // --- Loading + error states ------------------------------------------------
  if (fetchError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment px-6 text-ink">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-flask">
            Couldn&apos;t load paper
          </p>
          <h1 className="font-display mt-4 text-2xl font-medium tracking-tight">
            {fetchError}
          </h1>
          <Link
            href={backHref}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to paper
          </Link>
        </div>
      </main>
    );
  }

  if (!paper) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment text-ink">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
          Loading paper…
        </p>
      </main>
    );
  }

  // --- Layout sizing ---------------------------------------------------------
  // Top bar is 60px (h-15). Below it, each panel fills the rest. On desktop
  // (md+) we ignore mobileView and always split 50/50. On mobile, mobileView
  // governs which panel(s) are visible and how tall.
  const pdfClasses = cn(
    "border-b border-ink/10 md:border-b-0 md:border-r md:border-ink/10",
    "md:h-full md:w-1/2",
    mobileView === "both" && "h-[60vh]",
    mobileView === "pdf" && "h-[calc(100vh-60px)]",
    mobileView === "canvas" && "hidden md:block",
  );
  const canvasClasses = cn(
    "md:h-full md:w-1/2",
    mobileView === "both" && "h-[calc(40vh-60px)]",
    mobileView === "canvas" && "h-[calc(100vh-60px)]",
    mobileView === "pdf" && "hidden md:block",
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-parchment text-ink">
      {/* Top bar */}
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-ink/15 bg-ink px-4 text-snow sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={backHref}
            className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-parchment/70 transition-colors hover:text-snow"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to paper
          </Link>
          <span className="hidden text-parchment/30 sm:inline">·</span>
          <p className="truncate text-sm">
            {paper.paper_code && (
              <span
                className="font-mono mr-2 text-[11px] uppercase tracking-[0.2em] text-signal"
              >
                {paper.paper_code}
              </span>
            )}
            <span className="font-display font-medium text-snow">
              {paper.paper_name}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Mobile view toggle */}
          <div
            role="group"
            aria-label="Panel view"
            className="flex items-center rounded-md border border-snow/15 md:hidden"
          >
            {(["both", "pdf", "canvas"] as MobileView[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMobileView(mode)}
                aria-pressed={mobileView === mode}
                className={cn(
                  "font-mono px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors",
                  mobileView === mode
                    ? "bg-snow/15 text-snow"
                    : "text-parchment/55 hover:text-snow",
                )}
              >
                {mode === "both" ? "Both" : mode === "pdf" ? "PDF" : "Canvas"}
              </button>
            ))}
          </div>

          {/* Persistence-model hint. Hidden on small screens where the top
              bar is already tight with the mobile view-toggle group. */}
          <p className="font-mono hidden text-xs text-parchment/60 md:inline">
            Saved locally to this browser
          </p>

          <button
            type="button"
            onClick={handleClear}
            className="font-mono inline-flex items-center gap-1.5 rounded-md border border-snow/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-parchment/80 transition-colors hover:border-snow/40 hover:text-snow"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Clear canvas</span>
            <span className="sm:hidden">Clear</span>
          </button>
        </div>
      </header>

      {/* Split workspace */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* PDF panel */}
        <div className={pdfClasses}>
          {paper.paper_pdf_url ? (
            <iframe
              src={paper.paper_pdf_url}
              title={`${paper.paper_name} question paper`}
              className="h-full w-full bg-ink"
            />
          ) : (
            <PdfMissingNotice />
          )}
        </div>

        {/* Tldraw canvas panel */}
        <div className={canvasClasses}>
          <Tldraw
            persistenceKey={`paper-${paper.slug}`}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>
    </main>
  );
}

function PdfMissingNotice() {
  return (
    <div className="flex h-full items-center justify-center bg-snow p-6 text-center">
      <div className="max-w-sm">
        <FileWarning
          className="mx-auto h-8 w-8 text-ink/40"
          aria-hidden="true"
        />
        <p className="font-display mt-4 text-lg font-medium tracking-tight">
          Question paper not yet uploaded.
        </p>
        <p className="mt-2 text-sm text-ink/60">
          The whiteboard is still available on the right — you can practise
          on a blank canvas while we add the PDF.
        </p>
      </div>
    </div>
  );
}
