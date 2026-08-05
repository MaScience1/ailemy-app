import { FileWarning } from "lucide-react";

/**
 * Embedded PDF viewer for a past paper.
 *
 * NO PDF LIBRARY. This extracts the technique already in use on the practice
 * canvas (src/app/learn/[subject]/[pathway]/[course]/papers/[paper]/practice/
 * page.tsx) — a plain <iframe> pointed at the public Storage URL, letting the
 * browser's built-in PDF plugin do the rendering and the scrolling. That page
 * inlines its iframe; this is the same approach lifted into something reusable,
 * so adopting a real PDF library later means changing one file rather than two.
 *
 * Deliberately a SERVER component: it renders no interactivity, so keeping it
 * off the client boundary means the viewer costs a visitor zero JavaScript.
 *
 * Scrolling is INTERNAL — the wrapper has a fixed height and clips, and the PDF
 * plugin scrolls within it, so a long paper never stretches the page.
 *
 * KNOWN LIMITATION: iOS Safari renders only the first page of a PDF in an
 * iframe and offers no in-frame scrolling. The "Download as PDF" control beside
 * this viewer is the working path on those browsers, not merely a convenience.
 */
export function PaperPdfViewer({
  url,
  title,
  className = "",
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  // h-[65vh] on mobile keeps the viewer meaningfully tall without swallowing
  // the whole screen; md:h-[800px] is the fixed desktop height.
  const frame = `h-[65vh] max-h-[800px] md:h-[800px] overflow-hidden rounded-lg border border-ink/10 bg-snow ${className}`;

  if (!url) {
    return (
      <div className={`${frame} flex items-center justify-center p-6`}>
        <div className="max-w-sm text-center">
          <FileWarning className="mx-auto h-8 w-8 text-ink/40" aria-hidden="true" />
          <p className="font-display mt-4 text-lg font-medium tracking-tight">
            Question paper not yet uploaded.
          </p>
          <p className="mt-2 text-sm text-ink/60">
            The PDF will appear here as soon as it is added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      <iframe src={url} title={title} className="h-full w-full border-0" />
    </div>
  );
}
