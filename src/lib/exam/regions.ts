import "server-only";

import { getStaffStatus } from "@/lib/admin/staff";
import { getPaperPublicUrl } from "@/lib/storage/papers";
import { createClient } from "@/lib/supabase/server";

import type { Rotation } from "./region-geometry";

/**
 * What the region mapper needs to render, and nothing else.
 *
 * ============================================================================
 * ⚠ THE CALLER'S OWN SESSION. NEVER THE SERVICE ROLE.
 * ============================================================================
 * Every read here uses the SSR client, so 0028's policies decide what comes
 * back: `question_regions_read` admits staff (and anyone, for a live paper),
 * and `paper_questions_read` admits staff plus live papers. Escalating to the
 * service role would make the page render identically for a caller the
 * database would refuse — the page and the write path must agree on who is
 * allowed, or the gate is decoration.
 *
 * getPaperExamMeta in this directory does use the service role, for a public
 * count on a public page. That precedent does not extend here.
 *
 * ============================================================================
 * ⚠ NO SWALLOWED ERRORS. A FAILED READ IS NOT AN EMPTY PAPER.
 * ============================================================================
 * A paper with no questions and a paper whose questions failed to load look
 * identical if an error is folded into `[]` — and the failure mode is
 * specifically bad here, because "no regions" is ALSO the normal starting
 * state of this tool. An empty overlay would be indistinguishable from a
 * working tool on an unmapped paper, which is exactly the screen someone would
 * then spend an hour drawing boxes onto without realising nothing had loaded.
 */

export type MappableQuestion = {
  id: string;
  questionNumber: string;
  /** The paper's own sequence. The only correct order to list these in. */
  displayOrder: number;
  marks: number | null;
  answerType: string;
  /** Trimmed for the picker; the full text lives on the question row. */
  questionTextPreview: string | null;
  /** Regions already stored for this question, in viewport points. */
  regions: StoredRegion[];
};

export type StoredRegion = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** An assertion, never applied on read. See region-geometry.ts. */
  rotationApplied: Rotation;
  confidence: number | null;
  /** Null means PROPOSED, not accepted. 0028 is explicit about this. */
  approvedAt: string | null;
};

export type PaperMapping = {
  paperId: string;
  paperSlug: string;
  paperName: string;
  paperCode: string | null;
  /** Null when the paper has no PDF uploaded — the tool cannot run without it. */
  pdfUrl: string | null;
  questions: MappableQuestion[];
  /** Roles the caller actually holds, for the read-only vs writable banner. */
  roles: string[];
  canWrite: boolean;
};

export type MappingResult =
  | { ok: true; data: PaperMapping }
  | { ok: false; reason: "not_staff" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "unavailable"; detail: string };

export async function getPaperMapping(paperSlug: string): Promise<MappingResult> {
  const staff = await getStaffStatus();
  if (!staff.ok) {
    return staff.reason === "unavailable"
      ? { ok: false, reason: "unavailable", detail: staff.detail }
      : { ok: false, reason: "not_staff" };
  }

  const db = await createClient();

  // ⚠ ACCEPTS A SLUG **OR** A PAPER ID.
  //
  // It took only the slug, and the id is what anyone actually has to hand —
  // it is what the seed fixture holds, what the storage path contains, and
  // what every diagnostic in this repo prints. Passing one produced
  // `.eq("slug", "<uuid>")`, zero rows, and a bare Next 404 that looked
  // exactly like a route that had been deleted.
  //
  // The id is also the BETTER key: a slug is unique only within a course, and
  // "unit-1-may-june-2025" matches three papers today. The slug form has to
  // guess (see below); the id form cannot be wrong.
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    paperSlug,
  );
  const query = db
    .from("past_papers")
    .select("id, slug, paper_name, paper_code, paper_pdf_path");
  const { data: papers, error: paperError } = await (looksLikeId
    ? query.eq("id", paperSlug)
    : query.eq("slug", paperSlug));
  if (paperError) {
    console.error(`[regions] past_papers: ${paperError.code ?? "?"}: ${paperError.message}`);
    return {
      ok: false,
      reason: "unavailable",
      detail: `${paperError.code ?? "?"}: ${paperError.message}`,
    };
  }
  if (!papers || papers.length === 0) return { ok: false, reason: "not_found" };

  const candidates = papers as {
    id: string;
    slug: string;
    paper_name: string;
    paper_code: string | null;
    paper_pdf_path: string | null;
  }[];

  const { data: questionRows, error: questionError } = await db
    .from("paper_questions")
    .select("id, paper_id, question_number, display_order, marks, answer_type, question_text")
    .in("paper_id", candidates.map((p) => p.id))
    .order("display_order", { ascending: true });
  if (questionError) {
    console.error(`[regions] paper_questions: ${questionError.code ?? "?"}: ${questionError.message}`);
    return {
      ok: false,
      reason: "unavailable",
      detail: `${questionError.code ?? "?"}: ${questionError.message}`,
    };
  }

  const rows = (questionRows ?? []) as {
    id: string;
    paper_id: string;
    question_number: string;
    display_order: number;
    marks: number | null;
    answer_type: string;
    question_text: string | null;
  }[];

  // The seeded one is the paper worth mapping. With none seeded anywhere, the
  // first is as good as any — and the page will say it has no questions.
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.paper_id, (counts.get(r.paper_id) ?? 0) + 1);
  // An id match is exactly one row and needs no guess. A SLUG match may be
  // several — "unit-1-may-june-2025" is three papers — so the seeded one is
  // picked, because an unseeded paper has nothing to attach a region to. That
  // is a guess, and the way to avoid it is to use the id.
  const paper =
    candidates.find((p) => (counts.get(p.id) ?? 0) > 0) ?? candidates[0];

  const mine = rows.filter((r) => r.paper_id === paper.id);

  const { data: regionRows, error: regionError } = await db
    .from("question_regions")
    .select("id, question_id, page_number, bbox_x, bbox_y, bbox_width, bbox_height, rotation_applied, confidence, approved_at")
    .in("question_id", mine.map((q) => q.id));
  // ⚠ NOT folded into "no regions yet". That is this tool's normal empty
  // state, so a swallowed error here would render as a working tool on an
  // unmapped paper and quietly discard every region already stored.
  if (regionError) {
    console.error(`[regions] question_regions: ${regionError.code ?? "?"}: ${regionError.message}`);
    return {
      ok: false,
      reason: "unavailable",
      detail: `${regionError.code ?? "?"}: ${regionError.message}`,
    };
  }

  const byQuestion = new Map<string, StoredRegion[]>();
  for (const r of (regionRows ?? []) as {
    id: string;
    question_id: string;
    page_number: number;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    rotation_applied: number;
    confidence: number | null;
    approved_at: string | null;
  }[]) {
    const list = byQuestion.get(r.question_id) ?? [];
    list.push({
      id: r.id,
      pageNumber: r.page_number,
      x: Number(r.bbox_x),
      y: Number(r.bbox_y),
      width: Number(r.bbox_width),
      height: Number(r.bbox_height),
      rotationApplied: (r.rotation_applied === 90 || r.rotation_applied === 180 || r.rotation_applied === 270
        ? r.rotation_applied
        : 0) as Rotation,
      confidence: r.confidence === null ? null : Number(r.confidence),
      approvedAt: r.approved_at,
    });
    byQuestion.set(r.question_id, list);
  }

  return {
    ok: true,
    data: {
      paperId: paper.id,
      paperSlug: paper.slug,
      paperName: paper.paper_name,
      paperCode: paper.paper_code,
      pdfUrl: getPaperPublicUrl(paper.paper_pdf_path),
      roles: staff.roles,
      canWrite: staff.roles.includes("marker") || staff.roles.includes("admin"),
      questions: mine.map((q) => ({
        id: q.id,
        questionNumber: q.question_number,
        displayOrder: q.display_order,
        marks: q.marks,
        answerType: q.answer_type,
        questionTextPreview: q.question_text
          ? q.question_text.replace(/\s+/g, " ").trim().slice(0, 120)
          : null,
        regions: byQuestion.get(q.id) ?? [],
      })),
    },
  };
}
