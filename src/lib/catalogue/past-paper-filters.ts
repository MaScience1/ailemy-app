import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStatus } from "@/lib/admin/auth";
import { getPaperPublicUrl } from "@/lib/storage/papers";
import {
  DOC_TYPES as DOC_TYPE_LIST,
  FILTER_ORDER as ORDER,
  type FilterOptions as Options,
  type PaperFilters as Filters,
} from "./past-paper-filter-types";

/**
 * Query + cascade layer for the filtered /past-papers browser.
 *
 * Deliberately separate from catalogue/queries.ts: everything in that file
 * feeds /learn and must not be perturbed by this page.
 *
 * SCHEMA NOTE: `past_papers` has no board / subject / level / doc_type columns.
 * Board, subject and level are reached relationally through
 * courses → curricula / subjects, and "document type" is not stored at all — a
 * row is one PAPER carrying up to two PDF slots. So the document filter means
 * "papers that have this document attached".
 *
 * CASCADE MODEL: the single source of truth is `combos` — one entry per course,
 * carrying that course's subject and board. Because every valid
 * Subject→Board→Course triple is, by construction, exactly one row of the
 * catalogue, no combination of dropdowns can produce a pairing that does not
 * exist. Options are computed by narrowing that list, never by hardcoding.
 */

// Shapes/constants shared with the client FilterBar live in a separate,
// client-safe module (see its header for why). Re-exported here so server
// callers still have one import site.
export {
  DOC_TYPES,
  FILTER_ORDER,
  FILTER_LABELS,
} from "./past-paper-filter-types";
export type {
  DocType,
  FilterKey,
  FilterOptions,
  PaperFilters,
} from "./past-paper-filter-types";

/** One course, with the subject and board it belongs to. The cascade atom. */
export type CourseCombo = {
  courseId: string;
  courseName: string;
  level: string;
  subjectSlug: string;
  subjectName: string;
  subjectSort: number;
  boardId: string;
  boardName: string;
  boardSort: number;
};

export type CascadeData = {
  combos: CourseCombo[];
  /** (course_id, year) for every paper visible to this viewer. */
  paperYears: { courseId: string; year: number }[];
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
  detailHref: string | null;
};

type RawPaperRow = {
  id: string;
  slug: string;
  paper_name: string;
  paper_code: string | null;
  session: string;
  year: number;
  status: string;
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
// With !inner the same filter partitions correctly. Both FKs are NOT NULL on
// courses, so the inner join cannot drop a legitimate row.

/**
 * Admins read through the service-role client so their own drafts are visible
 * (and editable) inline; everyone else uses the anon client, where the
 * past_papers_public_read_live policy restricts results to status = 'live'.
 */
async function getReader() {
  const { ok: isAdmin } = await getAdminStatus().catch(() => ({ ok: false }));
  if (isAdmin) return createAdminClient();
  return await createClient();
}

/**
 * Load the cascade source of truth: every course with its subject and board,
 * plus the (course, year) pairs that actually have papers.
 *
 * Subjects/boards/courses come from the CATALOGUE, so a board with zero papers
 * is still offered — it just yields no results. Years come from past_papers,
 * because a year with no papers is not a meaningful thing to filter by and
 * there is no catalogue table of years.
 */
export async function getCascadeData(): Promise<CascadeData> {
  const db = await getReader();

  const [coursesRes, papersRes] = await Promise.all([
    db
      .from("courses")
      .select(
        `id, name, level, sort_order,
         curriculum:curricula!inner(id, short_name, name, sort_order),
         subject:subjects!inner(id, slug, name, sort_order)`,
      )
      .order("sort_order"),
    db.from("past_papers").select("course_id, year"),
  ]);

  if (coursesRes.error) {
    console.error("[past-paper-filters] cascade load failed", coursesRes.error);
    return { combos: [], paperYears: [] };
  }

  type RawCourse = {
    id: string;
    name: string;
    level: string;
    curriculum: {
      id: string;
      short_name: string | null;
      name: string;
      sort_order: number | null;
    } | null;
    subject: {
      id: string;
      slug: string;
      name: string;
      sort_order: number | null;
    } | null;
  };

  const combos: CourseCombo[] = ((coursesRes.data ?? []) as unknown as RawCourse[])
    .filter((c) => c.curriculum && c.subject)
    .map((c) => ({
      courseId: c.id,
      // courses.name is already fully qualified ("Edexcel IAL AS Chemistry"),
      // so it carries the level and needs no "(AS)" suffix appended.
      courseName: c.name,
      level: c.level,
      subjectSlug: c.subject!.slug,
      subjectName: c.subject!.name,
      subjectSort: c.subject!.sort_order ?? 0,
      boardId: c.curriculum!.id,
      boardName: c.curriculum!.short_name || c.curriculum!.name,
      boardSort: c.curriculum!.sort_order ?? 0,
    }));

  const paperYears = (
    (papersRes.data ?? []) as { course_id: string; year: number }[]
  ).map((p) => ({ courseId: p.course_id, year: p.year }));

  return { combos, paperYears };
}

/** Narrow the combo list by whichever of subject/board/course are set. */
function narrow(
  combos: CourseCombo[],
  f: { subject?: string; board?: string; course?: string },
): CourseCombo[] {
  return combos.filter(
    (c) =>
      (!f.subject || c.subjectSlug === f.subject) &&
      (!f.board || c.boardId === f.board) &&
      (!f.course || c.courseId === f.course),
  );
}

function uniqueBy<T, K>(items: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

/**
 * Build every dropdown's options for the CURRENT selection.
 *
 * Each dropdown is derived from the combos still reachable given the filters
 * BEFORE it in FILTER_ORDER, which is what makes impossible options disappear
 * rather than appear greyed out:
 *   Subject → all subjects
 *   Board   → boards that have a course in the chosen subject
 *   Course  → courses in the chosen subject AND board
 *   Year    → years of papers whose course survives the above
 */
export function buildFilterOptions(
  data: CascadeData,
  filters: Filters,
): Options {
  const { combos } = data;

  const forSubjects = combos;
  const forBoards = narrow(combos, { subject: filters.subject });
  const forCourses = narrow(combos, {
    subject: filters.subject,
    board: filters.board,
  });
  const forYears = narrow(combos, {
    subject: filters.subject,
    board: filters.board,
    course: filters.course,
  });

  const allowedCourseIds = new Set(forYears.map((c) => c.courseId));
  const years = Array.from(
    new Set(
      data.paperYears
        .filter((p) => allowedCourseIds.has(p.courseId))
        .map((p) => p.year),
    ),
  ).sort((a, b) => b - a);

  return {
    subjects: uniqueBy(forSubjects, (c) => c.subjectSlug)
      .sort((a, b) => a.subjectSort - b.subjectSort || a.subjectName.localeCompare(b.subjectName))
      .map((c) => ({ value: c.subjectSlug, label: c.subjectName })),
    boards: uniqueBy(forBoards, (c) => c.boardId)
      .sort((a, b) => a.boardSort - b.boardSort || a.boardName.localeCompare(b.boardName))
      .map((c) => ({ value: c.boardId, label: c.boardName })),
    courses: uniqueBy(forCourses, (c) => c.courseId)
      .sort((a, b) => a.courseName.localeCompare(b.courseName))
      .map((c) => ({ value: c.courseId, label: c.courseName })),
    years: years.map((y) => ({ value: String(y), label: String(y) })),
    docTypes: DOC_TYPE_LIST.map((d) => ({ value: d.value, label: d.label })),
  };
}

/**
 * Drop any selection that is impossible given the ones before it.
 *
 * Runs in cascade order, rebuilding the option list at each step, so a stale or
 * hand-typed value (?board=X&course=Y where Y is not in X) is discarded rather
 * than silently producing an empty result set. The client also clears
 * downstream params on change; this is the server-side backstop that makes any
 * URL — including one someone edited or shared from an older catalogue — resolve
 * to a coherent state.
 */
export function sanitiseFilters(
  data: CascadeData,
  raw: Filters,
): Filters {
  const out: Filters = {};

  const subjects = new Set(
    buildFilterOptions(data, out).subjects.map((o) => o.value),
  );
  if (raw.subject && subjects.has(raw.subject)) out.subject = raw.subject;

  const boards = new Set(buildFilterOptions(data, out).boards.map((o) => o.value));
  if (raw.board && boards.has(raw.board)) out.board = raw.board;

  const courses = new Set(
    buildFilterOptions(data, out).courses.map((o) => o.value),
  );
  if (raw.course && courses.has(raw.course)) out.course = raw.course;

  const years = new Set(buildFilterOptions(data, out).years.map((o) => o.value));
  if (raw.year && years.has(raw.year)) out.year = raw.year;

  if (raw.doc && DOC_TYPE_LIST.some((d) => d.value === raw.doc)) out.doc = raw.doc;

  return out;
}

/** Canonical query string for a filter set, in cascade order. */
export function filtersToQueryString(f: Filters): string {
  const p = new URLSearchParams();
  for (const key of ORDER) {
    const v = f[key];
    if (v) p.set(key, v);
  }
  return p.toString();
}

/** Apply the filters and return matching papers, newest first. */
export async function listFilteredPastPapers(
  filters: Filters,
): Promise<PaperResult[]> {
  const db = await getReader();

  let query = db.from("past_papers").select(PAPER_SELECT);

  if (filters.year && /^\d{4}$/.test(filters.year)) {
    query = query.eq("year", Number(filters.year));
  }
  if (filters.doc === "qp") query = query.not("paper_pdf_path", "is", null);
  if (filters.doc === "ms") query = query.not("markscheme_pdf_path", "is", null);

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

  return ((data ?? []) as unknown as RawPaperRow[])
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
export function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.subject || f.board || f.course || f.year || f.doc);
}
