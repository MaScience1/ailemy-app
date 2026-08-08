import { createClient } from "@/lib/supabase/server";
import type { Pathway } from "./pathways";

import type {
  CourseWithCounts,
  CourseWithRelations,
  EntityCounts,
  LessonForCatalogue,
  LessonForPage,
  LessonNeighbour,
  PastPaper,
  Subject,
  Unit,
} from "./types";

/**
 * A catalogue read that failed.
 *
 * ============================================================================
 * ⚠ WHY THESE THROW INSTEAD OF RETURNING null
 * ============================================================================
 * Every function in this file used to catch its error, log it, and return the
 * same value it returns when a row genuinely is not there — `null`, or `[]`.
 * Callers cannot distinguish those, and they do not try: the pattern
 * throughout the app is
 *
 *   const paper = await getPastPaperByCourseAndSlug(...);
 *   if (!paper) notFound();
 *
 * so a database outage rendered as "this paper does not exist". That is a
 * claim about the catalogue made on the strength of a failed query, and it is
 * the same lie one layer up from the exam-feature swallows fixed alongside
 * this: an error must never be presented as a fact about the data.
 *
 * Throwing is the whole fix, and it needs no caller changes. Every route under
 * /learn already has an error.tsx boundary — at the segment, subject, pathway,
 * course, lesson and lessons levels — and they already render the honest
 * thing: "Something went wrong. We couldn't load this. Try again." A thrown
 * error reaches that; a `null` never could.
 *
 * ⚠ AND NOW `null` MEANS EXACTLY ONE THING. After this, a null return is
 * "no such row", with no second meaning hiding inside it. Do not reintroduce
 * a catch that returns null or [] on error — that is the defect, not the
 * safety net it looks like.
 *
 * NOT for "not found". A missing row is not an error and must keep returning
 * null so the caller can render its own 404.
 */
export class CatalogueUnavailableError extends Error {
  constructor(operation: string, cause: { code?: string; message: string }) {
    super(`[catalogue] ${operation}: ${cause.code ?? "?"}: ${cause.message}`);
    this.name = "CatalogueUnavailableError";
  }
}

/** Columns to always select for a course row. Keeps queries in sync. */
const COURSE_SELECT = `
  id, curriculum_id, subject_id, slug, name, level, description, status,
  estimated_launch, sort_order, pathway,
  curriculum:curricula(id, slug, name, short_name, region),
  subject:subjects(id, slug, name)
`;

/**
 * Tally a flat array of lesson rows (just `{ status }`) into total + live
 * counts. Used by every entity-level query to feed the three-tier status
 * helper in src/lib/catalogue/status.ts.
 */
function tallyLessons(
  lessons: { status: string | null }[] | null | undefined,
): EntityCounts {
  const list = lessons ?? [];
  let live = 0;
  for (const lesson of list) {
    if (lesson.status === "live") live += 1;
  }
  return { totalLessons: list.length, liveLessons: live };
}

/**
 * Catalogue data access. All functions run on the server using the standard
 * @supabase/ssr server client — public RLS policies (catalogue_public_read_*)
 * permit anonymous reads, so this layer is safe to call from any /learn route
 * regardless of auth state. Login gating is intentionally not applied to
 * /learn (the brief calls this a sales surface).
 */

/**
 * Subject row + aggregate lesson counts across all courses under the subject.
 * Feeds the three-tier status (available/preview/coming_soon) on /learn.
 */
export type SubjectWithCounts = Subject & EntityCounts;

export async function listSubjects(): Promise<SubjectWithCounts[]> {
  const supabase = await createClient();
  // Nested join: subjects → courses → lessons. We only need lesson.status
  // for the count, so the payload stays light even with hundreds of seeded
  // lessons under Biology.
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, slug, name, color_as, color_a2, sort_order, courses(lessons(status))",
    )
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("listSubjects", error);

  type CoursesShape = {
    lessons: { status: string | null }[] | null;
  }[];

  return (data ?? []).map((row) => {
    const courses = (row as { courses?: CoursesShape }).courses ?? [];
    const allLessons = courses.flatMap((c) => c.lessons ?? []);
    const counts = tallyLessons(allLessons);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      color_as: row.color_as,
      color_a2: row.color_a2,
      sort_order: row.sort_order,
      ...counts,
    };
  });
}

/** /learn/[subject] — single subject by slug, or null if not found. */
export async function getSubjectBySlug(slug: string): Promise<Subject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name, color_as, color_a2, sort_order")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new CatalogueUnavailableError("getSubjectBySlug", error);
  return data;
}

/** All courses for a subject (any pathway), curriculum joined. */
export async function listCoursesForSubject(
  subjectId: string,
): Promise<CourseWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("subject_id", subjectId)
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("listCoursesForSubject", error);
  return (data ?? []) as unknown as CourseWithRelations[];
}

/**
 * Courses for a subject filtered to a single pathway. Powers
 * /learn/[subject]/[pathway] — the page listing every Edexcel / OCR / AQA
 * etc. course under that pathway+subject pair.
 */
export async function listCoursesForSubjectAndPathway(
  subjectId: string,
  pathway: Pathway,
): Promise<CourseWithCounts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(`${COURSE_SELECT}, lessons(status)`)
    .eq("subject_id", subjectId)
    .eq("pathway", pathway)
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("listCoursesForSubjectAndPathway", error);

  type Row = CourseWithRelations & {
    lessons: { status: string | null }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const { lessons, ...courseRow } = row;
    return { ...courseRow, ...tallyLessons(lessons) };
  });
}

/**
 * Aggregate lesson counts per pathway for a given subject. Used by
 * /learn/[subject] to drive both the course count badge AND the three-tier
 * status (available / preview / coming_soon) on each of the six pathway cards.
 *
 * Returns a complete record keyed by every pathway slug — pathways with no
 * courses come back as zeroed counts so consumers don't have to defend
 * against missing keys.
 */
export type PathwayStatus = EntityCounts & {
  courseCount: number;
};

export async function getPathwayStatusForSubject(
  subjectId: string,
): Promise<Record<Pathway, PathwayStatus>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("pathway, lessons(status)")
    .eq("subject_id", subjectId);

  // Initialise every pathway so consumers don't have to handle "key missing".
  const empty = (): PathwayStatus => ({
    totalLessons: 0,
    liveLessons: 0,
    courseCount: 0,
  });
  const counts: Record<Pathway, PathwayStatus> = {
    "uk-a-level": empty(),
    "international-a-level": empty(),
    ib: empty(),
    ap: empty(),
    "uk-gcse": empty(),
    igcse: empty(),
  };

  if (error) throw new CatalogueUnavailableError("getPathwayStatusForSubject", error);

  type Row = {
    pathway: Pathway | null;
    lessons: { status: string | null }[] | null;
  };
  for (const row of (data ?? []) as Row[]) {
    if (!row.pathway || !(row.pathway in counts)) continue;
    const bucket = counts[row.pathway];
    bucket.courseCount += 1;
    const tally = tallyLessons(row.lessons);
    bucket.totalLessons += tally.totalLessons;
    bucket.liveLessons += tally.liveLessons;
  }
  return counts;
}

/**
 * Single course resolved by subject + pathway + course slug. Defence in
 * depth: a course slug ought to be globally unique, but routing through
 * the (subject, pathway, course) triple means a stale or mismatched URL
 * doesn't accidentally render a different course's data.
 */
export async function getCourseBySubjectPathwayAndSlug(
  subjectSlug: string,
  pathway: Pathway,
  courseSlug: string,
): Promise<CourseWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("slug", courseSlug)
    .eq("pathway", pathway)
    .eq("subject.slug", subjectSlug)
    .maybeSingle();

  if (error) throw new CatalogueUnavailableError("getCourseBySubjectPathwayAndSlug", error);
  return data as unknown as CourseWithRelations | null;
}

/**
 * Legacy lookup — kept for callers that don't have pathway context yet
 * (e.g. metadata generation in routes that haven't been migrated). New
 * code should prefer getCourseBySubjectPathwayAndSlug.
 */
export async function getCourseBySlug(
  slug: string,
): Promise<CourseWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new CatalogueUnavailableError("getCourseBySlug", error);
  return data as unknown as CourseWithRelations | null;
}

/** Units belonging to a course, ordered. */
export async function listUnitsForCourse(courseId: string): Promise<Unit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, course_id, slug, code, name, description, status, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("listUnitsForCourse", error);
  return data ?? [];
}

/**
 * Lessons for a course, ordered by lesson_number. Each lesson includes
 * `spec_point_codes` — a flat array of spec point codes (e.g. ["1.1","1.2"])
 * used to render tag pills on the lesson card.
 */
export async function listLessonsForCourse(
  courseId: string,
): Promise<LessonForCatalogue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id, course_id, unit_id, slug, title, description, lesson_number,
      is_core_practical, status, sort_order, estimated_duration_minutes, summary_md,
      voice_video_mux_id,
      lesson_spec_points(spec_points(code))
      `,
    )
    .eq("course_id", courseId)
    .order("lesson_number", { ascending: true, nullsFirst: false });

  if (error) throw new CatalogueUnavailableError("listLessonsForCourse", error);

  type Row = {
    id: string;
    course_id: string | null;
    unit_id: string | null;
    slug: string;
    title: string;
    description: string | null;
    lesson_number: number | null;
    is_core_practical: boolean;
    status: LessonForCatalogue["status"];
    sort_order: number;
    estimated_duration_minutes: number | null;
    summary_md: string | null;
    voice_video_mux_id: string | null;
    lesson_spec_points: { spec_points: { code: string } | null }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const codes = (row.lesson_spec_points ?? [])
      .map((link) => link.spec_points?.code)
      .filter((c): c is string => Boolean(c))
      .sort(specCodeCompare);
    return {
      id: row.id,
      course_id: row.course_id,
      unit_id: row.unit_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      lesson_number: row.lesson_number,
      is_core_practical: row.is_core_practical,
      status: row.status,
      sort_order: row.sort_order,
      estimated_duration_minutes: row.estimated_duration_minutes,
      summary_md: row.summary_md,
      voice_video_mux_id: row.voice_video_mux_id,
      spec_point_codes: codes,
    };
  });
}

/**
 * Single lesson resolved by course slug + lesson slug, with full spec point
 * detail. We resolve via course slug (not id) so the URL is the source of
 * truth — and we don't return a lesson if the slug pair doesn't match.
 */
export async function getLessonByCourseAndSlug(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonForPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id, course_id, unit_id, slug, title, description, lesson_number,
      is_core_practical, status, sort_order, estimated_duration_minutes, summary_md,
      voice_video_mux_id,
      course:courses!inner(slug),
      lesson_spec_points(spec_points(id, topic_id, code, title, description, command_terms, status, sort_order))
      `,
    )
    .eq("slug", lessonSlug)
    .eq("course.slug", courseSlug)
    .maybeSingle();

  if (error) throw new CatalogueUnavailableError("getLessonByCourseAndSlug", error);
  if (!data) return null;

  type SpecPointRow = {
    id: string;
    topic_id: string;
    code: string;
    title: string;
    description: string;
    command_terms: string[] | null;
    status: LessonForPage["status"];
    sort_order: number;
  };
  type Row = {
    id: string;
    course_id: string | null;
    unit_id: string | null;
    slug: string;
    title: string;
    description: string | null;
    lesson_number: number | null;
    is_core_practical: boolean;
    status: LessonForPage["status"];
    sort_order: number;
    estimated_duration_minutes: number | null;
    summary_md: string | null;
    voice_video_mux_id: string | null;
    lesson_spec_points: { spec_points: SpecPointRow | null }[] | null;
  };

  const row = data as unknown as Row;
  const specPoints = (row.lesson_spec_points ?? [])
    .map((link) => link.spec_points)
    .filter((sp): sp is SpecPointRow => Boolean(sp))
    .sort((a, b) => specCodeCompare(a.code, b.code));

  return {
    id: row.id,
    course_id: row.course_id,
    unit_id: row.unit_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    lesson_number: row.lesson_number,
    is_core_practical: row.is_core_practical,
    status: row.status,
    sort_order: row.sort_order,
    estimated_duration_minutes: row.estimated_duration_minutes,
    summary_md: row.summary_md,
    voice_video_mux_id: row.voice_video_mux_id,
    spec_points: specPoints,
  };
}

/**
 * Previous and next lessons by lesson_number within the same course.
 * Returned values are minimal — just slug, title, lesson_number.
 */
export async function getLessonNeighbours(
  courseId: string,
  lessonNumber: number,
): Promise<{ prev: LessonNeighbour | null; next: LessonNeighbour | null }> {
  const supabase = await createClient();

  const [{ data: prev }, { data: next }] = await Promise.all([
    supabase
      .from("lessons")
      .select("slug, title, lesson_number")
      .eq("course_id", courseId)
      .lt("lesson_number", lessonNumber)
      .order("lesson_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("slug, title, lesson_number")
      .eq("course_id", courseId)
      .gt("lesson_number", lessonNumber)
      .order("lesson_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return { prev: prev ?? null, next: next ?? null };
}

// ---------------------------------------------------------------------------
// COURSE CHOICE HUB
// ---------------------------------------------------------------------------

/**
 * Aggregate counts the course choice hub needs to render its two cards
 * (Lessons / Exam Papers) and the meta line beneath the title.
 */
export type CourseChoiceData = {
  course: CourseWithRelations;
  lessonStats: {
    totalLessons: number;
    liveLessons: number;
    unitCount: number;
  };
  paperStats: {
    totalPapers: number;
    livePapers: number;
  };
};

/**
 * One-shot fetch for the choice hub. Resolves the course (1 round-trip),
 * then fans out three parallel count-only queries for lessons / units /
 * past papers. Total: 4 round-trips, the last three concurrent.
 *
 * We deliberately don't reuse listLessonsForCourse here — that one pulls
 * spec-point joins for every lesson card on the grid (~80 KB for Biology's
 * 205 lessons). The choice hub only needs status counts, so we fetch
 * lesson.status alone.
 */
export async function getCourseChoiceData(
  subjectSlug: string,
  pathway: Pathway,
  courseSlug: string,
): Promise<CourseChoiceData | null> {
  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathway,
    courseSlug,
  );
  if (!course) return null;

  const supabase = await createClient();

  const [lessonsRes, unitsRes, papersRes] = await Promise.all([
    supabase.from("lessons").select("status").eq("course_id", course.id),
    supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("course_id", course.id),
    supabase.from("past_papers").select("status").eq("course_id", course.id),
  ]);

  // These three logged and continued, so every count below fell through to
  // zero and the hub told the student the course had no lessons, no units and
  // no papers. Three separate claims about the catalogue, all made because a
  // query failed.
  //
  // ⚠ The papers branch carried "past_papers may not exist yet in a
  // freshly-migrated DB — degrade gracefully to zero papers rather than crash
  // the page". That reasoning is exactly the trap: a missing table returns
  // PGRST205 and an ordinary outage returns something else, and the branch
  // could not tell them apart — so it treated every failure as "the table
  // isn't there yet". past_papers has existed since well before 0028, which
  // depends on it, and it is seeded. A rebuild that genuinely lacks it should
  // fail loudly on the first page that reads it, not quietly report an empty
  // catalogue for as long as nobody notices.
  if (lessonsRes.error) throw new CatalogueUnavailableError("getCourseChoiceData lessons", lessonsRes.error);
  if (unitsRes.error) throw new CatalogueUnavailableError("getCourseChoiceData units", unitsRes.error);
  if (papersRes.error) throw new CatalogueUnavailableError("getCourseChoiceData papers", papersRes.error);

  type StatusRow = { status: string | null };
  const lessons = (lessonsRes.data ?? []) as StatusRow[];
  const papers = (papersRes.data ?? []) as StatusRow[];

  const liveLessons = lessons.filter((row) => row.status === "live").length;
  const livePapers = papers.filter((row) => row.status === "live").length;

  return {
    course,
    lessonStats: {
      totalLessons: lessons.length,
      liveLessons,
      unitCount: unitsRes.count ?? 0,
    },
    paperStats: {
      totalPapers: papers.length,
      livePapers,
    },
  };
}

// ---------------------------------------------------------------------------
// PAST PAPERS HUB (/past-papers)
// ---------------------------------------------------------------------------

/** Lightly-projected course row for the /past-papers hub. */
export type HubCourseEntry = {
  id: string;
  slug: string;
  name: string;
  level: string;
  pathway: Pathway;
  subjectSlug: string;
  curriculumId: string;
  boardName: string; // e.g. "Edexcel IAL" — pulled from curricula.short_name
  /** courses.sort_order — used as the within-board tiebreaker on the hub
   *  (so AS comes before A2 even though "A2" < "AS" lexicographically). */
  sortOrder: number;
  paperCount: number;
};

/** Subject heading row with aggregated stats and its course entries. */
export type HubSubjectSection = {
  id: string;
  slug: string;
  name: string;
  colorAs: string | null;
  colorA2: string | null;
  sortOrder: number;
  courseCount: number;
  totalPapers: number;
  courses: HubCourseEntry[];
};

export type PastPapersHubData = {
  subjects: HubSubjectSection[];
  /** Sum of live papers across every subject. */
  totalPapers: number;
  /** Distinct curricula (exam boards) that have at least one live paper. */
  curriculaWithPapers: number;
};

/**
 * One-shot fetch for the /past-papers landing hub.
 *
 * Nested PostgREST: subjects → courses → past_papers (live rows only, via
 * RLS). We deliberately keep the past_papers projection to just `id` since
 * we only need the count per course; live courses with 30+ papers stay
 * cheap to serialise.
 *
 * Sorting:
 *   - Subjects: by subjects.sort_order (DB-driven).
 *   - Courses: returned unsorted within each subject. The /past-papers page
 *     groups them by pathway and applies its own pedagogical pathway order
 *     + (board, sort_order) tiebreaker, so sorting here would just be undone.
 */
export async function getPastPapersHubData(): Promise<PastPapersHubData> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(
      `
      id, slug, name, color_as, color_a2, sort_order,
      courses(
        id, slug, name, level, pathway, curriculum_id, subject_id, sort_order,
        curriculum:curricula(id, short_name),
        past_papers(id)
      )
      `,
    )
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("getPastPapersHubData", error);

  type RawCurriculum = { id: string; short_name: string | null };
  type RawCourse = {
    id: string;
    slug: string;
    name: string;
    level: string;
    pathway: Pathway | null;
    curriculum_id: string;
    subject_id: string;
    sort_order: number;
    curriculum: RawCurriculum | null;
    past_papers: { id: string }[] | null;
  };
  type RawSubject = {
    id: string;
    slug: string;
    name: string;
    color_as: string | null;
    color_a2: string | null;
    sort_order: number;
    courses: RawCourse[] | null;
  };

  const subjects: HubSubjectSection[] = (
    (data ?? []) as unknown as RawSubject[]
  ).map((row) => {
      const rawCourses = row.courses ?? [];

      const courses: HubCourseEntry[] = rawCourses
        // Skip any course missing a pathway — defence against pre-migration
        // rows (the column is NOT NULL post-0005 but be safe).
        .filter((c): c is RawCourse & { pathway: Pathway } => Boolean(c.pathway))
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          level: c.level,
          pathway: c.pathway,
          subjectSlug: row.slug,
          curriculumId: c.curriculum_id,
          boardName: c.curriculum?.short_name ?? "—",
          sortOrder: c.sort_order,
          paperCount: (c.past_papers ?? []).length,
        }));

      // No sort here — the /past-papers view groups by pathway and applies
      // its own pedagogical pathway order + (board, sortOrder) tiebreaker.

      const totalPapers = courses.reduce(
        (sum, c) => sum + c.paperCount,
        0,
      );

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        colorAs: row.color_as,
        colorA2: row.color_a2,
        sortOrder: row.sort_order,
        courseCount: courses.length,
        totalPapers,
        courses,
      };
    },
  );

  const totalPapers = subjects.reduce((sum, s) => sum + s.totalPapers, 0);

  // Distinct curricula offering at least one live paper.
  const curriculaWithPapers = new Set<string>();
  for (const subject of subjects) {
    for (const course of subject.courses) {
      if (course.paperCount > 0) curriculaWithPapers.add(course.curriculumId);
    }
  }

  return {
    subjects,
    totalPapers,
    curriculaWithPapers: curriculaWithPapers.size,
  };
}

// ---------------------------------------------------------------------------
// PAST PAPERS
// ---------------------------------------------------------------------------

// examiner_report_pdf_path arrived in migration 0012. Naming it here makes
// these three queries HARD-REQUIRE that migration: PostgREST answers 42703 for
// the whole request when a selected column is missing, so an un-migrated
// database would lose the paper pages entirely rather than just the new row.
// That is the same bargain the admin write path already accepted (see the note
// in admin/past-papers/actions.ts) and 0012 is applied on every environment
// this ships to. The independent-fallback machinery in past-paper-filters.ts
// exists because /past-papers must survive a partly-migrated database; these
// /learn queries never had it and are not gaining it here.
const PAST_PAPER_SELECT = `
  id, course_id, unit_id, slug, year, session, paper_code, paper_name,
  duration_minutes, total_marks,
  paper_pdf_path, markscheme_pdf_path, examiner_report_pdf_path,
  walkthrough_mux_playback_id, walkthrough_duration_minutes, status, sort_order
`;

/** All live past papers for a course, ordered by sort_order. */
export async function listPastPapersForCourse(
  courseId: string,
): Promise<PastPaper[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("past_papers")
    .select(PAST_PAPER_SELECT)
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (error) throw new CatalogueUnavailableError("listPastPapersForCourse", error);
  return (data ?? []) as unknown as PastPaper[];
}

/**
 * Single past paper resolved by (course_id, slug). Defence in depth — slugs
 * are only required to be unique within a course (UNIQUE(course_id, slug)),
 * so resolving from a URL with both segments avoids cross-course collisions.
 */
export async function getPastPaperByCourseAndSlug(
  courseId: string,
  slug: string,
): Promise<PastPaper | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("past_papers")
    .select(PAST_PAPER_SELECT)
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new CatalogueUnavailableError("getPastPaperByCourseAndSlug", error);
  return data as unknown as PastPaper | null;
}


/**
 * Compare two spec point codes like "1.1", "1.10", "2.3". Lexicographic
 * comparison gets "1.10" wrong (places it before "1.2"). We split on '.' and
 * compare segments numerically where possible.
 */
function specCodeCompare(a: string, b: string): number {
  const aParts = a.split(".");
  const bParts = b.split(".");
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }
    if (aPart !== bPart) return aPart < bPart ? -1 : 1;
  }
  return 0;
}
