import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStatus } from "@/lib/admin/auth";
import { getPaperPublicUrl } from "@/lib/storage/papers";

/**
 * Query layer for the filtered /past-papers browser.
 *
 * Deliberately a NEW module rather than an addition to catalogue/queries.ts:
 * every function in that file feeds /learn, and this work must not perturb
 * those code paths.
 *
 * SCHEMA NOTE (worth knowing before reading the filters): `past_papers` has no
 * board / subject / level / doc_type columns. Board, subject and level are
 * reached relationally through courses → curricula / subjects, and "document
 * type" is not a stored value at all — a row is one PAPER carrying up to two
 * PDF slots (paper_pdf_path, markscheme_pdf_path). So filtering by document
 * type means "papers that have this document", not "rows of this type".
 */

export type DocType = "qp" | "ms";

export const DOC_TYPES: { value: DocType; label: string; column: string }[] = [
  { value: "qp", label: "Question paper", column: "paper_pdf_path" },
  { value: "ms", label: "Mark scheme", column: "markscheme_pdf_path" },
];

export type PaperFilters = {
  subject?: string; // subjects.slug
  board?: string; // curricula.id
  course?: string; // courses.id
  year?: string; // year as string from the URL
  doc?: string; // DocType
};

export type FilterOptions = {
  subjects: { value: string; label: string }[];
  boards: { value: string; label: string }[];
  courses: { value: string; label: string }[];
  years: { value: string; label: string }[];
  docTypes: { value: string; label: string }[];
};

export type PaperResult = {
  id: string;
  slug: string;
  paperName: string;
  paperCode: string | null;
  session: string;
  year: number;
  status: string;
  subjectName: string;
  subjectSlug: string;
  boardName: string;
  courseName: string;
  courseSlug: string;
  courseLevel: string;
  pathway: string | null;
  questionPaperUrl: string | null;
  markSchemeUrl: string | null;
  walkthroughPlaybackId: string | null;
  walkthroughMinutes: number | null;
  /** Link to the in-app paper page (walkthrough + practice whiteboard). */
  detailHref: string | null;
};

/**
 * Row shape returned by the nested select below. PostgREST types embedded
 * relations loosely, so this is asserted rather than inferred.
 */
type RawPaperRow = {
  id: string;
  slug: string;
  paper_name: string;
  paper_code: string | null;
  session: string;
  year: number;
  status: string;
  sort_order: number | null;
  paper_pdf_path: string | null;
  markscheme_pdf_path: string | null;
  walkthrough_mux_playback_id: string | null;
  walkthrough_duration_minutes: number | null;
  course: {
    id: string;
    slug: string;
    name: string;
    level: string;
    pathway: string | null;
    curriculum: { id: string; short_name: string | null; name: string } | null;
    subject: { id: string; slug: string; name: string } | null;
  } | null;
};

const PAPER_SELECT = `
  id, slug, paper_name, paper_code, session, year, status, sort_order,
  paper_pdf_path, markscheme_pdf_path,
  walkthrough_mux_playback_id, walkthrough_duration_minutes,
  course:courses!inner(
    id, slug, name, level, pathway,
    curriculum:curricula!inner(id, short_name, name),
    subject:subjects!inner(id, slug, name)
  )
`;
// The !inner on subject/curriculum is REQUIRED, not cosmetic. With a plain
// (left-join) embed, PostgREST silently IGNORES a filter on the embedded
// resource: measured against this database, `course.subject.slug=eq.<anything>`
// — including a nonsense value — returned all 375 rows instead of filtering.
// With !inner the same filter partitions correctly (170 chemistry + 205
// biology + 0 physics = 375). Both FKs are NOT NULL on courses, so the inner
// join cannot drop a legitimate row.

/**
 * Admins read through the service-role client so their own drafts are visible
 * (and therefore editable) inline; everyone else goes through the anon client,
 * where the past_papers_public_read_live RLS policy restricts results to
 * status = 'live'.
 */
async function getReader() {
  const { ok: isAdmin } = await getAdminStatus().catch(() => ({ ok: false }));
  if (isAdmin) return { db: createAdminClient(), isAdmin: true as const };
  return { db: await createClient(), isAdmin: false as const };
}

/**
 * Build every dropdown's options FROM THE DATABASE — nothing is hardcoded.
 *
 * Subjects, boards and courses come from the catalogue tables, so a board with
 * zero papers is still selectable (it just yields no results), exactly as
 * specified. Years come from the distinct values actually present in
 * past_papers, because a year with no papers is meaningless as a filter and
 * there is no catalogue table of years to draw on.
 */
export async function getPastPaperFilterOptions(): Promise<FilterOptions> {
  const { db } = await getReader();

  const [subjectsRes, curriculaRes, coursesRes, yearsRes] = await Promise.all([
    db.from("subjects").select("id, slug, name").order("sort_order"),
    db.from("curricula").select("id, short_name, name").order("sort_order"),
    db
      .from("courses")
      .select("id, name, level, subject_id, curriculum_id")
      .order("sort_order"),
    // Distinct years present in past_papers. PostgREST has no DISTINCT, so we
    // pull the column and dedupe here — one small integer column, cheap.
    db.from("past_papers").select("year"),
  ]);

  const years = Array.from(
    new Set(((yearsRes.data ?? []) as { year: number }[]).map((r) => r.year)),
  )
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);

  return {
    subjects: ((subjectsRes.data ?? []) as { slug: string; name: string }[]).map(
      (s) => ({ value: s.slug, label: s.name }),
    ),
    boards: (
      (curriculaRes.data ?? []) as {
        id: string;
        short_name: string | null;
        name: string;
      }[]
    ).map((c) => ({ value: c.id, label: c.short_name || c.name })),
    courses: (
      (coursesRes.data ?? []) as { id: string; name: string; level: string }[]
    ).map((c) => ({ value: c.id, label: `${c.name} (${c.level})` })),
    years: years.map((y) => ({ value: String(y), label: String(y) })),
    docTypes: DOC_TYPES.map((d) => ({ value: d.value, label: d.label })),
  };
}

/** Apply the filters and return matching papers, newest first. */
export async function listFilteredPastPapers(
  filters: PaperFilters,
): Promise<PaperResult[]> {
  const { db } = await getReader();

  let query = db.from("past_papers").select(PAPER_SELECT);

  // Filters on past_papers' own columns.
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    query = query.eq("year", Number(filters.year));
  }
  // Document-type filter = "this paper actually has that document attached".
  if (filters.doc === "qp") query = query.not("paper_pdf_path", "is", null);
  if (filters.doc === "ms") query = query.not("markscheme_pdf_path", "is", null);

  // Filters that live on the embedded course row. `courses!inner` in the
  // select makes these behave as real inner-join constraints.
  if (filters.course) query = query.eq("course.id", filters.course);
  if (filters.board) query = query.eq("course.curriculum_id", filters.board);
  if (filters.subject) query = query.eq("course.subject.slug", filters.subject);

  const { data, error } = await query
    .order("year", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[past-paper-filters] query failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawPaperRow[];

  return rows
    // `!inner` should exclude course-less rows, but a null embed would break
    // the mapping below, so drop defensively rather than throw at render time.
    .filter((r) => r.course)
    .map((r) => {
      const c = r.course!;
      const detailHref =
        c.subject?.slug && c.pathway && c.slug
          ? `/learn/${c.subject.slug}/${c.pathway}/${c.slug}/papers/${r.slug}`
          : null;
      return {
        id: r.id,
        slug: r.slug,
        paperName: r.paper_name,
        paperCode: r.paper_code,
        session: r.session,
        year: r.year,
        status: r.status,
        subjectName: c.subject?.name ?? "—",
        subjectSlug: c.subject?.slug ?? "",
        boardName: c.curriculum?.short_name || c.curriculum?.name || "—",
        courseName: c.name,
        courseSlug: c.slug,
        courseLevel: c.level,
        pathway: c.pathway,
        questionPaperUrl: getPaperPublicUrl(r.paper_pdf_path),
        markSchemeUrl: getPaperPublicUrl(r.markscheme_pdf_path),
        walkthroughPlaybackId: r.walkthrough_mux_playback_id,
        walkthroughMinutes: r.walkthrough_duration_minutes,
        detailHref,
      };
    });
}

/** True when at least one filter is active — drives the empty-state copy. */
export function hasActiveFilters(f: PaperFilters): boolean {
  return Boolean(f.subject || f.board || f.course || f.year || f.doc);
}
