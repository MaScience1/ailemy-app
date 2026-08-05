"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Eye, Loader2 } from "lucide-react";

/**
 * "Preview paper" disclosure for the results card (spec §1).
 *
 * The card must NOT show the whole PDF by default — this supersedes the
 * inline-by-default viewer added in 6e916b3.
 *
 * BUNDLE: PaperViewer pulls in pdfjs-dist, which is far too large to ship to
 * every visitor of /past-papers. next/dynamic with ssr:false puts it in a
 * chunk fetched only when the disclosure is first opened, and `mounted` keeps
 * it unmounted until then — a plain `hidden` class would still download and
 * instantiate it. Measured: no pdf chunk is requested until the button is
 * pressed.
 *
 * Once opened it stays mounted, so collapsing and re-expanding does not
 * re-download the PDF or lose the reader's page.
 */
const PaperViewer = dynamic(
  () => import("@/components/paper/PaperViewer").then((m) => m.PaperViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-ink/10 bg-snow">
        <p className="font-mono flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink/55">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading viewer…
        </p>
      </div>
    ),
  },
);

export function PaperPreview({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  function toggle() {
    if (!mounted) setMounted(true);
    setOpen((v) => !v);
  }

  return (
    <div className="mt-6 border-t border-ink/10 pt-5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="paper-preview-region"
        className="font-mono inline-flex items-center gap-2 rounded-md text-[11px] uppercase tracking-[0.2em] text-ink/60 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        {open ? "Hide preview" : "Preview paper"}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div id="paper-preview-region" hidden={!open} className="mt-4">
        {mounted && (
          <PaperViewer url={url} title={title} mode="preview" />
        )}
      </div>
    </div>
  );
}
