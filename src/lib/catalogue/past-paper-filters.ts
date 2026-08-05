import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditContext } from "@/lib/admin/edit-mode";
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
  unitName: string | null;
  unitCode: string | null;
  /** Length of the EXAM. Null until recorded — never the walkthrough length. */
  durationMinutes: number | null;
  totalMarks: number | null;
  questionPaperUrl: string | null;
  markSchemeUrl: string | null;
  examinerReportUrl: string | null;
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
  examiner_report_pdf_path?: string | null;
  duration_minutes?: number | null;
  total_marks?: number | null;
  walkthrough_mux_playback_id: string | null;
  walkthrough_duration_minutes: number | null;
  // Left join — past_papers.unit_id is nullable, so NO !inner here. Adding one
  // would silently drop every paper that has not been mapped to a unit.
  unit: { id: string; name: string; code: string | null } | null;
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

const PAPER_COLUMNS_BASE = `
  id, slug, paper_name, paper_code, session, year, status, sort_order,
  paper_pdf_path, markscheme_pdf_path,
  walkthrough_mux_playback_id, walkthrough_duration_minutes,
  unit:units(id, name, code),
  course:courses!inner(
    id, slug, name, level, pathway,
    curriculum:curricula!inner(id, short_name, name),
    subject:subjects!inner(id, slug, name)
  )
`;

/**
 * Columns that exist only after a hand-applied migration.
 *
 * Migrations here are applied by hand and main auto-deploys, so this code can
 * legitimately run against a database where a migration has not landed yet.
 * Asking PostgREST for a column that does not exist fails the WHOLE request
 * (42703), which would take /past-papers down entirely rather than degrade one
 * field. So each group is probed independently and dropped from the projection
 * permanently (for the process) once proven absent.
 *
 * INDEPENDENT, not ordered: 0012 is applied on this database and 0015 may not
 * be. A single "compatibility level" would wrongly disable the examiner report
 * in order to cope with a missing duration column.
 */
const OPTIONAL_COLUMN_GROUPS = {
  examinerReport: {
    columns: "examiner_report_pdf_path",
    migration: "0012",
  },
  durationAndMarks: {
    columns: "duration_minutes, total_marks",
    migration: "0015",
  },
} as const;

type OptionalGroup = keyof typeof OPTIONAL_COLUMN_GROUPS;

/** null = not yet probed; true/false = whether that migration has been applied. */
const optionalGroupExists: Record<OptionalGroup, boolean | null> = {
  examinerReport: null,
  durationAndMarks: null,
};

const ALL_GROUPS = Object.keys(OPTIONAL_COLUMN_GROUPS) as OptionalGroup[];

/** Projection including every optional group not yet proven absent. */
function buildPaperSelect(): string {
  const extra = ALL_GROUPS.filter((g) => optionalGroupExists[g] !== false)
    .map((g) => OPTIONAL_COLUMN_GROUPS[g].columns)
    .join(", ");
  return PAPER_COLUMNS_BASE.replace(
    "paper_pdf_path, markscheme_pdf_path,",
    extra
      ? `paper_pdf_path, markscheme_pdf_path, ${extra},`
      : "paper_pdf_path, markscheme_pdf_path,",
  );
}

/** Which optional group does this 42703 name, if any? */
function missingGroup(
  error: { code?: string; message?: string } | null,
): OptionalGroup | null {
  const msg = error?.message ?? "";
  if (error?.code !== "42703" && !/does not exist/.test(msg)) return null;
  for (const g of ALL_GROUPS) {
    for (const col of OPTIONAL_COLUMN_GROUPS[g].columns.split(",")) {
      if (msg.includes(col.trim())) return g;
    }
  }
  return null;
}

/**
 * Run a query with the widest projection still believed valid, stepping down
 * one optional group at a time on 42703. Bounded by the number of groups, so it
 * cannot loop.
 */
async function withOptionalColumns<T>(
  run: (
    select: string,
  ) => PromiseLike<{
    data: T | null;
    error: { code?: string; message?: string } | null;
  }>,
) {
  for (let attempt = 0; attempt <= ALL_GROUPS.length; attempt++) {
    const res = await run(buildPaperSelect());

    if (!res.error) {
      // Success proves every column in that projection exists.
      for (const g of ALL_GROUPS) {
        if (optionalGroupExists[g] === null) optionalGroupExists[g] = true;
      }
      return res;
    }

    const missing = missingGroup(res.error);
    if (!missing) return res;

    optionalGroupExists[missing] = false;
    console.warn(
      `[past-paper-filters] ${OPTIONAL_COLUMN_GROUPS[missing].columns} missing (apply migration ${OPTIONAL_COLUMN_GROUPS[missing].migration}); continuing without it`,
    );
  }
  return run(buildPaperSelect());
}

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
  // Keyed on editMode, not merely on being the admin: with the toggle off this
  // page must render exactly what a student sees, drafts included — otherwise
  // "edit mode off == student view" would be false for past papers.
  const { editMode } = await getEditContext().catch(() => ({ editMode: false }));
  if (editMode) return createAdminClient();
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

/** Shape one raw PostgREST row into the view model. */
function mapPaperRow(r: RawPaperRow): PaperResult {
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
    unitName: r.unit?.name ?? null,
    unitCode: r.unit?.code ?? null,
    // `?? null` rather than a default: absent (migration not applied) and
    // "not recorded yet" must both read as null so the card omits the row
    // instead of inventing a duration.
    durationMinutes: r.duration_minutes ?? null,
    totalMarks: r.total_marks ?? null,
    questionPaperUrl: getPaperPublicUrl(r.paper_pdf_path),
    markSchemeUrl: getPaperPublicUrl(r.markscheme_pdf_path),
    examinerReportUrl: getPaperPublicUrl(r.examiner_report_pdf_path),
    walkthroughPlaybackId: r.walkthrough_mux_playback_id,
    walkthroughMinutes: r.walkthrough_duration_minutes,
    detailHref,
  };
}

/**
 * One paper by slug, for /past-papers/[paper]/test.
 *
 * AMBIGUITY: past_papers declares UNIQUE (course_id, slug), NOT a global unique
 * — two courses may legitimately share a slug. We therefore ask for two rows
 * rather than using .maybeSingle(), which ERRORS on a second match and would
 * turn a data condition into a 500. If more than one comes back we log it and
 * take the newest, so the page still renders while the collision is visible in
 * the logs.
 */
export async function getPaperBySlug(slug: string): Promise<PaperResult | null> {
  const db = await getReader();

  const { data, error } = await withOptionalColumns<RawPaperRow[]>((select) =>
    db
      .from("past_papers")
      .select(select)
      .eq("slug", slug)
      .order("year", { ascending: false })
      .limit(2) as unknown as PromiseLike<{
      data: RawPaperRow[] | null;
      error: { code?: string; message?: string } | null;
    }>,
  );

  if (error) {
    console.error("[past-paper-filters] getPaperBySlug failed", error);
    return null;
  }

  const rows = (data ?? []).filter((r) => r.course);
  if (rows.length > 1) {
    console.warn(
      `[past-paper-filters] slug "${slug}" matches ${rows.length} papers across courses; using the newest. past_papers is unique on (course_id, slug), not slug alone.`,
    );
  }
  return rows[0] ? mapPaperRow(rows[0]) : null;
}

/** Apply the filters and return matching papers, newest first. */
export async function listFilteredPastPapers(
  filters: Filters,
): Promise<PaperResult[]> {
  const db = await getReader();

  const run = async (select: string) => {
    let q = db.from("past_papers").select(select);

    if (filters.year && /^\d{4}$/.test(filters.year)) {
      q = q.eq("year", Number(filters.year));
    }
    if (filters.doc === "qp") q = q.not("paper_pdf_path", "is", null);
    if (filters.doc === "ms") q = q.not("markscheme_pdf_path", "is", null);
    // Only filter on the examiner-report column when it is still believed to
    // exist; otherwise the request would 400 rather than simply matching
    // nothing. `!== false` (not `=== true`) so the first, unprobed request
    // still tries it.
    if (filters.doc === "er" && optionalGroupExists.examinerReport !== false) {
      q = q.not("examiner_report_pdf_path", "is", null);
    }

    if (filters.course) q = q.eq("course.id", filters.course);
    if (filters.board) q = q.eq("course.curriculum_id", filters.board);
    if (filters.subject) q = q.eq("course.subject.slug", filters.subject);

    return q
      .order("year", { ascending: false })
      .order("sort_order", { ascending: true });
  };

  const { data, error } = await withOptionalColumns(run);

  if (error) {
    console.error("[past-paper-filters] query failed", error);
    return [];
  }

  // Asked for examiner reports on a database that cannot store them yet:
  // the honest answer is "none", not "here is everything".
  if (filters.doc === "er" && optionalGroupExists.examinerReport === false) {
    return [];
  }

  return ((data ?? []) as unknown as RawPaperRow[])
    .filter((r) => r.course)
    .map(mapPaperRow);
}

/** True when at least one filter is active — drives the empty-state copy. */
export function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.subject || f.board || f.course || f.year || f.doc);
}
