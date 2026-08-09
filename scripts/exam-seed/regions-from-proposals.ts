/**
 * Turn machine proposals into the fixture the seeder consumes.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/regions-from-proposals.ts <proposals.json> <questions.json>
 *
 * ============================================================================
 * WHY THIS EXISTS RATHER THAN HAVING PYTHON PRINT THE FIXTURE
 * ============================================================================
 * The coordinate contract and the fixture format are owned by
 * region-geometry.ts and region-fixture.ts, which have 53 tests. A second
 * implementation in Python would be a second thing to keep correct, and the
 * two would drift the first time either changed — the same reason the seeder's
 * dry run and its writer share one payload builder.
 *
 * So Python locates boxes and this validates and formats them, through exactly
 * the code the admin mapper uses. A proposal that would not survive being
 * drawn by hand does not survive here either.
 */
import { readFileSync } from "node:fs";

import {
  clampToPage,
  normaliseRotation,
  roundForStorage,
  validateRegion,
} from "../../src/lib/exam/region-geometry.ts";
import { emitRegionFixture, type RegionDraft } from "../../src/lib/exam/region-fixture.ts";

type Proposal = {
  questionNumber: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationApplied: number;
  confidence: number;
  pageWidth: number;
  pageHeight: number;
};

const [, , proposalsPath, questionsPath] = process.argv;
if (!proposalsPath || !questionsPath) {
  console.error("usage: regions-from-proposals.ts <proposals.json> <questions.json>");
  process.exit(2);
}

const proposals = JSON.parse(readFileSync(proposalsPath, "utf8")) as {
  regions: Proposal[];
  unmapped: { questionNumber: string; reason: string }[];
  dropped: { questionNumber: string; reason: string }[];
};
const questions = JSON.parse(readFileSync(questionsPath, "utf8")) as {
  questionNumber: string;
  displayOrder: number;
}[];

const drafts: RegionDraft[] = [];
const rejected: string[] = [];

for (const p of proposals.regions) {
  const page = { width: p.pageWidth, height: p.pageHeight };
  // Clamp first, then validate — the same order the mapper uses on a drag, so
  // a proposal and a hand-drawn box go through identical arithmetic.
  const clamped = clampToPage({ x: p.x, y: p.y, width: p.width, height: p.height }, page);
  const verdict = validateRegion(clamped, page);
  if (!verdict.ok) {
    rejected.push(`${p.questionNumber}: ${verdict.problem}`);
    continue;
  }
  drafts.push({
    questionNumber: p.questionNumber,
    pageNumber: p.pageNumber,
    rect: roundForStorage(verdict.rect),
    rotationApplied: normaliseRotation(p.rotationApplied),
    // ⚠ SET, and set here. question-set.ts says to omit confidence for a
    // hand-authored region and fill it for a machine proposal; these are
    // machine proposals, so the column that exists to tell them apart is
    // populated. approved_by/approved_at stay NULL — approval is a human act
    // against a rendered overlay, not a side effect of extraction.
    confidence: p.confidence,
  });
}

const fixture = emitRegionFixture({
  paperSlug: "unit-1-may-june-2025",
  drafts,
  ordering: questions.map((q) => ({
    questionNumber: q.questionNumber,
    displayOrder: q.displayOrder,
  })),
  capturedAt: new Date().toISOString(),
});

console.log(fixture);

const notes: string[] = [];
for (const u of proposals.unmapped) notes.push(`${u.questionNumber}: ${u.reason}`);
for (const d of proposals.dropped) notes.push(`${d.questionNumber}: ${d.reason}`);
for (const r of rejected) notes.push(`${r} (rejected by validateRegion)`);
if (notes.length) {
  console.log(`// NOT PROPOSED, with reasons:`);
  for (const n of notes) console.log(`//   ${n}`);
}
console.error(
  `\n  ${drafts.length} region(s) validated and emitted, ${notes.length} not proposed`,
);
