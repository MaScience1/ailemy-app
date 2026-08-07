import { NextResponse, type NextRequest } from "next/server";

import {
  getCourseBySlug,
  getPastPaperByCourseAndSlug,
} from "@/lib/catalogue/queries";
import { getPaperPublicUrl } from "@/lib/storage/papers";

/**
 * GET /api/papers/[slug]?course=<course-slug>
 *
 * Returns paper metadata plus pre-built public URLs for the question paper
 * and mark scheme PDFs. Called from the client-side practice page (tldraw +
 * PDF iframe) which can't import the server-only queries module.
 *
 * `course` IS REQUIRED. past_papers is unique on (course_id, slug), not on
 * slug alone: Chemistry and Biology each have a "unit-1-january-2019". This
 * used to call a slug-only lookup whose .maybeSingle() returned PGRST116
 * ("multiple (or no) rows returned") the moment a second subject was imported,
 * turning every colliding paper into a 404. Scoping by course makes the pair
 * unique, so .maybeSingle() cannot see two rows by construction.
 *
 * Public via RLS (past_papers_public_read_live policy in migration 0007).
 * 400 if course is missing, 404 if nothing matches or the paper isn't 'live'.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const courseSlug = request.nextUrl.searchParams.get("course");

  if (!courseSlug) {
    return NextResponse.json(
      {
        error:
          "The 'course' query parameter is required — a paper slug is unique only within a course.",
      },
      { status: 400 },
    );
  }

  const course = await getCourseBySlug(courseSlug);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const paper = await getPastPaperByCourseAndSlug(course.id, slug);
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
