/**
 * The coordinate contract, in one pure module.
 *
 * ============================================================================
 * THE SPACE. NON-NEGOTIABLE.
 * ============================================================================
 * question_regions.bbox_* are stored in pdf.js `getViewport({ scale: 1 })`
 * space: TOP-LEFT origin, y increasing DOWNWARD, /Rotate ALREADY APPLIED.
 *
 * NOT raw PDF user space, which is bottom-left origin with y upward. The two
 * differ by `y_viewport = pageHeight − y_pdf`, and conflating them mirrors
 * every overlay vertically — a failure that looks like a plausible layout
 * rather than an obvious bug, which is why it is worth a module of its own.
 *
 * `rotation_applied` is an ASSERTION, NEVER A TRANSFORM. The stored bbox is
 * already in rotated viewport space and needs no correction on read. The field
 * exists so a consumer can check the page still has the /Rotate it had at
 * capture time and REFUSE rather than draw sideways. `assertRotationMatches`
 * below is the only thing that may look at it.
 *
 * ============================================================================
 * WHY OVERLAYS ARE POSITIONED IN PERCENTAGES
 * ============================================================================
 * The requirement is that overlays stay aligned across zoom, resize and
 * viewport changes. The obvious implementation — multiply the bbox by the
 * current scale and set pixel offsets — satisfies that only as long as every
 * consumer recomputes on every change, and it drifts the moment one of them
 * caches a scale, rounds, or observes a resize a frame late.
 *
 * A percentage of the unscaled page is scale-free: it contains no pixels, so
 * there is no scale to get wrong. The browser recomputes it on every layout,
 * for free, exactly in step with the canvas it is positioned over. Alignment
 * stops being something the code maintains and becomes something the geometry
 * cannot break.
 *
 * PaperViewer sizes its canvas to `viewport.width/height` in CSS pixels (the
 * device-pixel-ratio backing store is separate and does NOT affect CSS
 * layout), so a percentage box in a container sized to that canvas lands on
 * the same ink at any zoom.
 *
 * Everything here is pure: no DOM, no pdf.js, no database. It is the part most
 * likely to be subtly wrong and the part least likely to be re-read, so it is
 * the part that is tested.
 */

/** A rectangle in CSS pixels, relative to the rendered page's top-left. */
export type PixelRect = { x: number; y: number; width: number; height: number };

/** A rectangle in pdf.js viewport points — the space that gets STORED. */
export type ViewportRect = { x: number; y: number; width: number; height: number };

/** The unscaled page box, from `getViewport({ scale: 1 })`. */
export type PageBox = { width: number; height: number };

export type Rotation = 0 | 90 | 180 | 270;

/**
 * Two drag endpoints into a positive-area rectangle.
 *
 * Dragging up or left produces a negative width or height, and 0028's
 * `question_regions_size_positive` CHECK rejects those at the database — but
 * far too late, and only after a page of work. Normalising at the source means
 * a box drawn bottom-right to top-left is the same box as top-left to
 * bottom-right, which is what the person dragging expects.
 */
export function normaliseDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PixelRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * CSS pixels → viewport points.
 *
 * `scale` is the number PaperViewer computes: renderedCssWidth / unscaledWidth.
 * Dividing by it is the whole conversion — there is no origin flip, because
 * both spaces are already top-left with y downward. If you ever find yourself
 * writing `pageHeight - y` here, you have confused viewport space with raw PDF
 * user space; read the header.
 */
export function pixelToViewport(rect: PixelRect, scale: number): ViewportRect {
  if (!(scale > 0) || !Number.isFinite(scale)) {
    throw new Error(`pixelToViewport: scale must be a positive finite number, got ${scale}`);
  }
  return {
    x: rect.x / scale,
    y: rect.y / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

/** Viewport points → CSS pixels. The exact inverse, for redrawing a stored box. */
export function viewportToPixel(rect: ViewportRect, scale: number): PixelRect {
  if (!(scale > 0) || !Number.isFinite(scale)) {
    throw new Error(`viewportToPixel: scale must be a positive finite number, got ${scale}`);
  }
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Keep a box inside the page.
 *
 * A drag that leaves the canvas would otherwise store coordinates off the
 * page — accepted by the database (the CHECK only requires positive size) and
 * invisible in every consumer, because the overlay renders outside the
 * clipping box. Clamped here, at the only place that knows the page size.
 */
export function clampToPage(rect: ViewportRect, page: PageBox): ViewportRect {
  const x = Math.max(0, Math.min(rect.x, page.width));
  const y = Math.max(0, Math.min(rect.y, page.height));
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, page.width - x)),
    height: Math.max(0, Math.min(rect.height, page.height - y)),
  };
}

/**
 * The smallest box worth storing, in viewport points.
 *
 * A stray click produces a 0×0 or 1×1 box. The database rejects exactly zero
 * and nothing else, so a 0.4pt box would be stored and then be unclickable
 * forever. ~8pt is a few millimetres of paper: too small to be a question,
 * large enough that no deliberate drag is refused.
 */
export const MIN_REGION_POINTS = 8;

export type RegionValidity =
  | { ok: true; rect: ViewportRect }
  | { ok: false; problem: string };

/**
 * Everything that must be true before a box may be stored, in one place.
 *
 * Returns a reason rather than throwing: this runs on every pointer-up, and a
 * too-small drag is an ordinary thing a person does, not an exception.
 */
export function validateRegion(rect: ViewportRect, page: PageBox): RegionValidity {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
    return { ok: false, problem: "That box has non-finite coordinates." };
  }
  if (rect.width < MIN_REGION_POINTS || rect.height < MIN_REGION_POINTS) {
    return {
      ok: false,
      problem: `Too small to be a question — drag a box at least ${MIN_REGION_POINTS}×${MIN_REGION_POINTS} points.`,
    };
  }
  if (rect.x < 0 || rect.y < 0) {
    return { ok: false, problem: "That box starts outside the page." };
  }
  if (rect.x + rect.width > page.width + 0.5 || rect.y + rect.height > page.height + 0.5) {
    // Half a point of slack absorbs the rounding in a fit-to-width scale
    // factor; anything beyond that is a genuine overrun.
    return { ok: false, problem: "That box extends past the edge of the page." };
  }
  return { ok: true, rect };
}

/** CSS percentages for an overlay. See the header: no pixels, so no drift. */
export type PercentRect = { left: number; top: number; width: number; height: number };

export function toPercent(rect: ViewportRect, page: PageBox): PercentRect {
  if (!(page.width > 0) || !(page.height > 0)) {
    throw new Error(
      `toPercent: page must have positive dimensions, got ${page.width}×${page.height}`,
    );
  }
  return {
    left: (rect.x / page.width) * 100,
    top: (rect.y / page.height) * 100,
    width: (rect.width / page.width) * 100,
    height: (rect.height / page.height) * 100,
  };
}

/**
 * ⚠ THE ONLY PLACE `rotation_applied` MAY BE READ.
 *
 * It is an assertion, not a transform. If the page's /Rotate today differs
 * from the one recorded at capture, the stored bbox describes a different
 * orientation of the page and drawing it would put the box confidently in the
 * wrong place. The consumer must REFUSE — a visibly missing overlay sends
 * someone to re-map the question; a silently rotated one does not.
 *
 * Never "correct" for the difference here. The bbox is already in rotated
 * viewport space; a second rotation would be applied on top of one already
 * baked in.
 */
export function assertRotationMatches(
  stored: number,
  livePageRotation: number,
): { ok: true } | { ok: false; problem: string } {
  const norm = (r: number) => ((Math.round(r / 90) * 90) % 360 + 360) % 360;
  if (norm(stored) === norm(livePageRotation)) return { ok: true };
  return {
    ok: false,
    problem:
      `This region was captured when the page had /Rotate ${norm(stored)}, but the page now reports ` +
      `${norm(livePageRotation)}. The stored box is in the old orientation, so it is not being drawn. Re-map this question.`,
  };
}

/** pdf.js reports /Rotate as any multiple of 90; 0028 stores only 0/90/180/270. */
export function normaliseRotation(raw: number): Rotation {
  const r = ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
  return (r === 90 || r === 180 || r === 270 ? r : 0) as Rotation;
}

/**
 * The smallest box containing all of them, per page.
 *
 * ============================================================================
 * ⚠ FOR STEMLESS CONTAINERS — AND IT IS COMPUTED, NEVER STORED
 * ============================================================================
 * Most containers own a stem: a printed line that belongs to them and to
 * nothing else, so a click on it means the container and a stored region is
 * exactly right. 21(c) on WCH11/01 is the other kind — its "(c)" shares a line
 * with its child's "(i)", so it has no page area of its own at all.
 *
 * It gets NO ROW in question_regions, and that is the correct representation
 * rather than a gap:
 *
 *   1. A region answers "what is at this point?". Every point inside a
 *      stemless container's union is also inside a CHILD, more specifically.
 *      Under any sane most-specific-match rule the union never wins, so the
 *      row would be unreachable by the query regions exist to serve.
 *   2. It would be the only region in the table that fully contains other
 *      regions, forcing every consumer to handle an overlap case that
 *      otherwise does not arise.
 *   3. It is derivable from its children, so storing it duplicates state that
 *      can go stale — re-draw one child and the stored union is silently
 *      wrong, with nothing to detect it.
 *
 * So if Teacher Mode wants to highlight "the whole of 21(c)" — a question →
 * highlight interaction, the reverse of point → question — it calls this. The
 * answer is always current because it is recomputed from the children.
 *
 * Per page on purpose: a container's children can span pages (Q20's run from
 * p10 to p12) and a box spanning two sheets of paper is not a thing. Returns
 * one entry per page that has any child region.
 */
export function unionByPage(
  regions: { pageNumber: number; rect: ViewportRect }[],
): { pageNumber: number; rect: ViewportRect }[] {
  const byPage = new Map<number, ViewportRect>();
  for (const r of regions) {
    const seen = byPage.get(r.pageNumber);
    if (!seen) {
      byPage.set(r.pageNumber, { ...r.rect });
      continue;
    }
    const x0 = Math.min(seen.x, r.rect.x);
    const y0 = Math.min(seen.y, r.rect.y);
    const x1 = Math.max(seen.x + seen.width, r.rect.x + r.rect.width);
    const y1 = Math.max(seen.y + seen.height, r.rect.y + r.rect.height);
    byPage.set(r.pageNumber, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, rect]) => ({ pageNumber, rect }));
}

/**
 * Round for storage.
 *
 * Two decimals is ~1/3600 inch — far finer than any hand-drawn box, and it
 * keeps the emitted fixture readable and diffable. A raw float from a division
 * would put `173.99999999999997` in a file a human is meant to review.
 */
export function roundForStorage(rect: ViewportRect): ViewportRect {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(rect.x), y: r(rect.y), width: r(rect.width), height: r(rect.height) };
}
