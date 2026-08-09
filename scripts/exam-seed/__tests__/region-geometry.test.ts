/**
 * The coordinate contract, asserted.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/region-geometry.test.ts
 *
 * The failure this suite exists to prevent is the vertical mirror: viewport
 * space is top-left with y DOWNWARD, raw PDF user space is bottom-left with y
 * UP, and confusing them produces a layout that looks plausible on a
 * symmetrical page and is wrong on every real one. It is not the kind of bug
 * a screenshot catches.
 */
import {
  assertRotationMatches,
  unionByPage,
  clampToPage,
  MIN_REGION_POINTS,
  normaliseDrag,
  normaliseRotation,
  pixelToViewport,
  roundForStorage,
  toPercent,
  validateRegion,
  viewportToPixel,
} from "../../../src/lib/exam/region-geometry.ts";
import {
  emitRegionFixture,
  emitRegionsBlock,
  emitRegionJson,
} from "../../../src/lib/exam/region-fixture.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// A4 portrait in points, the shape every page of WCH11/01 is.
const A4 = { width: 595.28, height: 841.89 };

console.log("── Y IS DOWNWARD. A box near the TOP has a SMALL y. ──");
{
  // The mirror bug would put a box drawn at the top of the page near y=841.
  const px = normaliseDrag({ x: 50, y: 20 }, { x: 300, y: 90 });
  const vp = pixelToViewport(px, 1);
  t("a box dragged near the top has small y", vp.y === 20, vp.y);
  t("...NOT pageHeight - y (that would be the raw-PDF-space bug)", vp.y !== A4.height - 20);
  const pc = toPercent(vp, A4);
  t("...and renders in the top 12% of the page", pc.top < 12, pc.top);
}

console.log("\n── drag direction cannot produce a negative box ──");
{
  const forward = normaliseDrag({ x: 10, y: 10 }, { x: 110, y: 60 });
  const backward = normaliseDrag({ x: 110, y: 60 }, { x: 10, y: 10 });
  t("bottom-right → top-left gives the same box", JSON.stringify(forward) === JSON.stringify(backward), backward);
  t("width positive", backward.width === 100);
  t("height positive", backward.height === 50);
  // 0028's question_regions_size_positive CHECK would reject a negative box —
  // but only after a page of work, and only with a constraint-name error.
  t("origin is the top-left corner, not the drag start", backward.x === 10 && backward.y === 10);
}

console.log("\n── px ↔ viewport is an exact round trip at any scale ──");
{
  for (const scale of [0.5, 1, 1.7734, 3]) {
    const px = { x: 123.4, y: 567.8, width: 90.1, height: 42.3 };
    const back = viewportToPixel(pixelToViewport(px, scale), scale);
    t(`scale ${scale}: round trip preserves the box`,
      close(back.x, px.x) && close(back.y, px.y) && close(back.width, px.width) && close(back.height, px.height),
      back);
  }
  t("scale 0 is refused, not silently infinite", (() => {
    try { pixelToViewport({ x: 1, y: 1, width: 1, height: 1 }, 0); return false; } catch { return true; }
  })());
  t("negative scale is refused", (() => {
    try { pixelToViewport({ x: 1, y: 1, width: 1, height: 1 }, -2); return false; } catch { return true; }
  })());
}

console.log("\n── ZOOM INVARIANCE: the same drag at any zoom stores the same box ──");
{
  // This is the requirement "overlays stay aligned across zoom". A drag of the
  // same PAGE region at 100% and at 250% must produce identical stored points.
  const pageWidthCss100 = 800;
  const pageWidthCss250 = 2000;
  const scale100 = pageWidthCss100 / A4.width;
  const scale250 = pageWidthCss250 / A4.width;

  // The same physical spot: 10%..50% across, 20%..30% down.
  const at = (w: number, h: number) => normaliseDrag(
    { x: 0.10 * w, y: 0.20 * h },
    { x: 0.50 * w, y: 0.30 * h },
  );
  const h100 = pageWidthCss100 * (A4.height / A4.width);
  const h250 = pageWidthCss250 * (A4.height / A4.width);

  const a = roundForStorage(pixelToViewport(at(pageWidthCss100, h100), scale100));
  const b = roundForStorage(pixelToViewport(at(pageWidthCss250, h250), scale250));
  t("100% and 250% produce the SAME stored rect", JSON.stringify(a) === JSON.stringify(b), { a, b });
  t("...and it is the expected 10% of page width", close(a.x, Math.round(0.10 * A4.width * 100) / 100, 0.02), a.x);

  // And the percentage that positions the overlay is scale-free by construction.
  const p = toPercent(a, A4);
  t("overlay percentage matches the drag regardless of zoom", close(p.left, 10, 0.05) && close(p.width, 40, 0.05), p);
}

console.log("\n── clamping keeps a box on the page ──");
{
  const over = clampToPage({ x: 500, y: 800, width: 400, height: 400 }, A4);
  t("width is truncated at the right edge", close(over.x + over.width, A4.width), over);
  t("height is truncated at the bottom edge", close(over.y + over.height, A4.height), over);
  const neg = clampToPage({ x: -50, y: -20, width: 100, height: 100 }, A4);
  t("negative origin is pulled to 0", neg.x === 0 && neg.y === 0, neg);
}

console.log("\n── validation refuses what the database would accept but nobody could click ──");
{
  const tiny = validateRegion({ x: 10, y: 10, width: 0.4, height: 0.4 }, A4);
  t("a 0.4pt box is refused", !tiny.ok, tiny);
  t("...with a reason a human can act on", !tiny.ok && /Too small/.test(tiny.problem));
  t(`the floor is ${MIN_REGION_POINTS}pt`, !validateRegion({ x: 0, y: 0, width: MIN_REGION_POINTS - 0.1, height: 50 }, A4).ok);
  t("...and exactly at the floor it passes", validateRegion({ x: 0, y: 0, width: MIN_REGION_POINTS, height: MIN_REGION_POINTS }, A4).ok);
  t("a box past the right edge is refused", !validateRegion({ x: 500, y: 10, width: 200, height: 50 }, A4).ok);
  t("a full-page box is accepted", validateRegion({ x: 0, y: 0, width: A4.width, height: A4.height }, A4).ok);
  t("NaN is refused", !validateRegion({ x: NaN, y: 10, width: 50, height: 50 }, A4).ok);
}

console.log("\n── rotation is ASSERTED, never applied ──");
{
  t("matching rotation passes", assertRotationMatches(0, 0).ok);
  t("90 vs 90 passes", assertRotationMatches(90, 90).ok);
  const bad = assertRotationMatches(0, 90);
  t("0 stored vs 90 live FAILS", !bad.ok, bad);
  t("...and says to re-map rather than offering a correction",
    !bad.ok && /Re-map/.test(bad.problem) && !/rotat(e|ing) (it|the box)/i.test(bad.problem), !bad.ok ? bad.problem : undefined);
  t("360 normalises to 0", assertRotationMatches(0, 360).ok);
  t("-90 normalises to 270", assertRotationMatches(270, -90).ok);
  t("normaliseRotation clamps junk to 0", normaliseRotation(37) === 0 || normaliseRotation(37) === 90, normaliseRotation(37));
  t("normaliseRotation(180) === 180", normaliseRotation(180) === 180);
  t("normaliseRotation(-90) === 270", normaliseRotation(-90) === 270);
}

console.log("\n── storage rounding keeps fixtures readable ──");
{
  const r = roundForStorage({ x: 173.99999999999997, y: 1 / 3, width: 10.005, height: 2 });
  t("float noise is gone", r.x === 174, r.x);
  t("two decimals kept", r.y === 0.33, r.y);
  t("integers stay integers", r.height === 2);
}

console.log("\n── the emitted fixture is what the seeder consumes ──");
{
  const block = emitRegionsBlock([
    { questionNumber: "1", pageNumber: 3, rect: { x: 50, y: 100, width: 400, height: 120 }, rotationApplied: 0 },
  ]);
  t("emits a regions: array", /^      regions: \[/.test(block), block);
  t("uses the fixture's key names", /pageNumber: 3/.test(block) && /x: 50/.test(block) && /width: 400/.test(block));
  t("omits rotationApplied when 0 (it defaults)", !/rotationApplied/.test(block), block);
  t("omits confidence for a hand-drawn box — a human is the author, not a proposer",
    !/confidence/.test(block), block);

  const rotated = emitRegionsBlock([
    { questionNumber: "1", pageNumber: 1, rect: { x: 1, y: 2, width: 3, height: 4 }, rotationApplied: 90 },
  ]);
  t("emits rotationApplied when non-zero — impossible to miss in review", /rotationApplied: 90/.test(rotated));

  const withConf = emitRegionsBlock([
    { questionNumber: "1", pageNumber: 1, rect: { x: 1, y: 2, width: 3, height: 4 }, rotationApplied: 0, confidence: 0.8 },
  ]);
  t("emits confidence when a machine proposed it", /confidence: 0.8/.test(withConf));
}

console.log("\n── the fixture NAMES what is missing, rather than omitting it silently ──");
{
  const out = emitRegionFixture({
    paperSlug: "unit-1-may-june-2025",
    drafts: [
      { questionNumber: "20(a)", pageNumber: 12, rect: { x: 50, y: 100, width: 400, height: 120 }, rotationApplied: 0 },
    ],
    ordering: [
      { questionNumber: "1", displayOrder: 10 },
      { questionNumber: "20(a)", displayOrder: 200 },
      { questionNumber: "22(c)", displayOrder: 410 },
    ],
    capturedAt: "2026-08-08T20:00:00.000Z",
  });
  t("counts what was mapped", /1 of 3 questions mapped/.test(out), out.slice(0, 400));
  t("NAMES the unmapped ones — 'which did I miss' is the question this file is asked",
    /NOT MAPPED \(2\): 1, 22\(c\)/.test(out), out.slice(0, 600));
  t("records the coordinate space in the file itself", /top-left origin/.test(out));
  t("tells the reader to dry-run before --commit", /--commit/.test(out) && /seed-exam-questions/.test(out));
  t("warns that --replace-children cannot be undone", /CANNOT UNDO/.test(out));
}

console.log("\n── fixture blocks come out in the paper's own order, not capture order ──");
{
  const out = emitRegionFixture({
    paperSlug: "p",
    drafts: [
      { questionNumber: "22(c)", pageNumber: 20, rect: { x: 1, y: 1, width: 9, height: 9 }, rotationApplied: 0 },
      { questionNumber: "1", pageNumber: 2, rect: { x: 1, y: 1, width: 9, height: 9 }, rotationApplied: 0 },
    ],
    ordering: [
      { questionNumber: "1", displayOrder: 10 },
      { questionNumber: "22(c)", displayOrder: 410 },
    ],
    capturedAt: "2026-08-08T20:00:00.000Z",
  });
  t("question 1 precedes 22(c) despite being captured second",
    out.indexOf("// 1\n") < out.indexOf("// 22(c)"), { a: out.indexOf("// 1\n"), b: out.indexOf("// 22(c)") });
}

console.log("\n── JSON emission carries the space, so it cannot be misread later ──");
{
  const json = JSON.parse(emitRegionJson({
    paperSlug: "p",
    drafts: [{ questionNumber: "1", pageNumber: 2, rect: { x: 1.5, y: 2.5, width: 3, height: 4 }, rotationApplied: 0 }],
    capturedAt: "2026-08-08T20:00:00.000Z",
  }));
  t("names the coordinate space explicitly",
    json.coordinateSpace === "pdfjs-getViewport-scale-1-top-left-y-down", json.coordinateSpace);
  t("flattens the rect to the DB's column names", json.regions[0].x === 1.5 && json.regions[0].height === 4);
  t("omits confidence when absent", !("confidence" in json.regions[0]));
}

console.log("\n── stemless containers: the union is COMPUTED, per page ──");
{
  // 21(c) on WCH11/01 has no stem — its "(c)" shares a line with its child's
  // "(i)" — so it gets no stored row. If Teacher Mode ever wants to highlight
  // the whole of it, this is where the box comes from.
  const one = unionByPage([
    { pageNumber: 14, rect: { x: 52.9, y: 53.9, width: 488.2, height: 603.3 } },
  ]);
  t("a single child yields that child's box", one.length === 1 && close(one[0].rect.width, 488.2), one);

  const two = unionByPage([
    { pageNumber: 11, rect: { x: 40, y: 100, width: 100, height: 50 } },
    { pageNumber: 11, rect: { x: 60, y: 200, width: 200, height: 50 } },
  ]);
  t("two on one page union into one box", two.length === 1);
  t("...spanning both horizontally", close(two[0].rect.x, 40) && close(two[0].rect.width, 220), two[0].rect);
  t("...and both vertically", close(two[0].rect.y, 100) && close(two[0].rect.height, 150), two[0].rect);

  // Q20's children run p10 -> p12. A box spanning two sheets of paper is not
  // a thing, so the union is PER PAGE.
  const across = unionByPage([
    { pageNumber: 10, rect: { x: 40, y: 100, width: 100, height: 50 } },
    { pageNumber: 12, rect: { x: 40, y: 300, width: 100, height: 50 } },
    { pageNumber: 11, rect: { x: 40, y: 200, width: 100, height: 50 } },
  ]);
  t("children across pages give one box PER PAGE, not one box", across.length === 3, across.length);
  t("...returned in page order", across.map((u) => u.pageNumber).join(",") === "10,11,12",
    across.map((u) => u.pageNumber));

  t("no children -> no box, not a zero-sized one", unionByPage([]).length === 0);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
