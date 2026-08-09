/**
 * Per-page text lines with viewport coordinates, for the seed-time region gate.
 *
 * ============================================================================
 * WHY pdf.js AND NOT THE PYTHON EXTRACTOR
 * ============================================================================
 * The proposals come from PyMuPDF, and PyMuPDF already runs this same gate. But
 * a region can reach question_regions WITHOUT going near that script — anything
 * drawn by hand in the admin mapper, or edited into the fixture. The gate has
 * to sit on the WRITE path, and the write path is a TypeScript seeder, so the
 * seeder needs its own way to read the page.
 *
 * pdf.js is the right one to use: it is already a dependency, and it is the
 * library the app itself renders with, so what this sees is what a student
 * sees.
 *
 * ============================================================================
 * ⚠ THE COORDINATE CONVERSION, AND HOW IT WAS CHECKED
 * ============================================================================
 * A text item's transform is in PDF USER SPACE — bottom-left origin, y UP —
 * and question_regions are in VIEWPORT space — top-left origin, y DOWN. The
 * conversion is `y_viewport = pageHeight - y_pdf`, which is the exact flip
 * region-geometry.ts warns must never be applied to a bbox that is already in
 * viewport space. Here it IS needed, because the source really is user space.
 *
 * Verified rather than assumed, against a landmark measured independently with
 * PyMuPDF: "(Total for Question 1 = 1 mark)" on page 2.
 *
 *   pdf.js    pageHeight - f  =  365.5 pt
 *   PyMuPDF   glyph box       =  496-509 px at 100 dpi  =  357-366 pt
 *
 * They agree. (The two numbers look unrelated until the units are matched —
 * 100 dpi against 72 pt/inch is a factor of 1.389, and that near-miss is
 * exactly the sort of thing that gets waved through.)
 */
import { readFile } from "node:fs/promises";

export type PageLines = {
  pageNumber: number;
  width: number;
  height: number;
  /** Whitespace-normalised, in viewport space: y is DOWN from the top. */
  lines: { text: string; x0: number; y: number; x1: number }[];
};

/** Items on the same baseline, within this many points, are one line. */
const LINE_TOLERANCE = 2.5;

export async function extractPageLines(source: Uint8Array | string): Promise<PageLines[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data =
    typeof source === "string" ? new Uint8Array(await readFile(source)) : source;

  // No DOM and no network font fetches — this runs in a seed script. The
  // standard-font warning pdf.js emits here is expected and harmless: the gate
  // reads text, it does not render glyphs.
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: false });
  const doc = await loadingTask.promise;

  const pages: PageLines[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Group items onto baselines. A line like "(2)" is usually one item, but
    // the gate matches WHOLE LINES, so an item-per-word page would defeat it.
    const rows = new Map<number, { text: string; x0: number; x1: number; y: number }[]>();
    for (const item of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const yUp = item.transform[5];
      const y = viewport.height - yUp; // user space -> viewport space
      const key = Math.round(y / LINE_TOLERANCE) * LINE_TOLERANCE;
      const row = rows.get(key) ?? [];
      row.push({ text: item.str, x0: x, x1: x + (item.width ?? 0), y });
      rows.set(key, row);
    }

    const lines = [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, items]) => {
        items.sort((a, b) => a.x0 - b.x0);
        return {
          text: items.map((i) => i.text).join("").replace(/\s+/g, " ").trim(),
          x0: Math.min(...items.map((i) => i.x0)),
          x1: Math.max(...items.map((i) => i.x1)),
          y: items[0].y,
        };
      })
      .filter((l) => l.text);

    pages.push({ pageNumber: n, width: viewport.width, height: viewport.height, lines });
  }

  // In pdf.js v6 teardown lives on the LOADING TASK, not the document —
  // PDFDocumentProxy has cleanup() but no destroy(). Same note as PaperViewer.
  await loadingTask.destroy();
  return pages;
}

/**
 * The lines whose baseline falls inside a region.
 *
 * Baseline rather than glyph box: pdf.js gives an origin and a width, not a
 * height, so the baseline is the only vertical position it reports honestly.
 * A small tolerance above catches a line whose baseline sits a hair below the
 * box's top edge while its glyphs are inside.
 */
export function linesInside(
  page: PageLines,
  region: { x: number; y: number; width: number; height: number },
): string[] {
  const top = region.y - 2;
  const bottom = region.y + region.height;
  const left = region.x - 2;
  const right = region.x + region.width + 2;
  return page.lines
    .filter((l) => l.y > top && l.y <= bottom && l.x1 > left && l.x0 < right)
    .map((l) => l.text);
}
