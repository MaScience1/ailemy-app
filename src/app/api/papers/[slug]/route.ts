import { NextResponse, type NextRequest } from "next/server";

import { getPastPaperBySlugOnly } from "@/lib/catalogue/queries";
import { getPaperPublicUrl } from "@/lib/storage/papers";

/**
 * GET /api/papers/[slug]
 *
 * Returns paper metadata plus pre-built public URLs for the question paper
 * and mark scheme PDFs. Called from the client-side practice page (tldraw +
 * PDF iframe) which can't import the server-only queries module.
 *
 * Public via RLS (past_papers_public_read_live policy in migration 0007).
 * 404 if no paper matches or if the paper isn't 'live' (RLS filters it out).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const paper = await getPastPaperBySlugOnly(slug);
  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: paper.id,
    slug: paper.slug,
    course_id: paper.course_id,
    unit_id: paper.unit_id,
    year: paper.year,
    session: paper.session,
    paper_code: paper.paper_code,
    paper_name: paper.paper_name,
    paper_pdf_path: paper.paper_pdf_path,
    paper_pdf_url: getPaperPublicUrl(paper.paper_pdf_path),
    markscheme_pdf_path: paper.markscheme_pdf_path,
    markscheme_pdf_url: getPaperPublicUrl(paper.markscheme_pdf_path),
    walkthrough_mux_playback_id: paper.walkthrough_mux_playback_id,
    walkthrough_duration_minutes: paper.walkthrough_duration_minutes,
  });
}
