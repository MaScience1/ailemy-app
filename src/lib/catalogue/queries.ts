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

  if (error) {
    console.error("[catalogue] listSubjects failed", error);
    return [];
  }

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

  if (error) {
    console.error("[catalogue] getSubjectBySlug failed", error);
    return null;
  }
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

  if (error) {
    console.error("[catalogue] listCoursesForSubject failed", error);
    return [];
  }
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

  if (error) {
    console.error("[catalogue] listCoursesForSubjectAndPathway failed", error);
    return [];
  }

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

  if (error) {
    console.error("[catalogue] getPathwayStatusForSubject failed", error);
    return counts;
  }

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

  if (error) {
    console.error(
      "[catalogue] getCourseBySubjectPathwayAndSlug failed",
      error,
    );
    return null;
  }
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

  if (error) {
    console.error("[catalogue] getCourseBySlug failed", error);
    return null;
  }
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

  if (error) {
    console.error("[catalogue] listUnitsForCourse failed", error);
    return [];
  }
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

  if (error) {
    console.error("[catalogue] listLessonsForCourse failed", error);
    return [];
  }

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

  if (error) {
    console.error("[catalogue] getLessonByCourseAndSlug failed", error);
    return null;
  }
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

  if (lessonsRes.error) {
    console.error("[catalogue] choice-hub lessons fetch failed", lessonsRes.error);
  }
  if (unitsRes.error) {
    console.error("[catalogue] choice-hub units fetch failed", unitsRes.error);
  }
  if (papersRes.error) {
    // past_papers may not exist yet in a freshly-migrated DB — degrade
    // gracefully to zero papers rather than crash the page.
    console.error("[catalogue] choice-hub papers fetch failed", papersRes.error);
  }

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
 *   - Courses within a subject: AVAILABLE (paperCount > 0) bucket first,
 *     then COMING SOON bucket. Within each bucket, by board name then level.
 *     This puts the courses with real papers at the top of every section.
 */
export async function getPastPapersHubData(): Promise<PastPapersHubData> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(
      `
      id, slug, name, color_as, color_a2, sort_order,
      courses(
        id, slug, name, level, pathway, curriculum_id, subject_id,
        curriculum:curricula(id, short_name),
        past_papers(id)
      )
      `,
    )
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalogue] getPastPapersHubData failed", error);
    return { subjects: [], totalPapers: 0, curriculaWithPapers: 0 };
  }

  type RawCurriculum = { id: string; short_name: string | null };
  type RawCourse = {
    id: string;
    slug: string;
    name: string;
    level: string;
    pathway: Pathway | null;
    curriculum_id: string;
    subject_id: string;
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
          paperCount: (c.past_papers ?? []).length,
        }));

      // Within-subject sort: AVAILABLE first, then COMING SOON; tie-break
      // alphabetically by board name then level.
      courses.sort((a, b) => {
        const aAvail = a.paperCount > 0 ? 0 : 1;
        const bAvail = b.paperCount > 0 ? 0 : 1;
        if (aAvail !== bAvail) return aAvail - bAvail;
        const boardCmp = a.boardName.localeCompare(b.boardName);
        if (boardCmp !== 0) return boardCmp;
        return a.level.localeCompare(b.level);
      });

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

const PAST_PAPER_SELECT = `
  id, course_id, unit_id, slug, year, session, paper_code, paper_name,
  paper_pdf_path, markscheme_pdf_path, walkthrough_mux_playback_id,
  walkthrough_duration_minutes, status, sort_order
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

  if (error) {
    console.error("[catalogue] listPastPapersForCourse failed", error);
    return [];
  }
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

  if (error) {
    console.error("[catalogue] getPastPaperByCourseAndSlug failed", error);
    return null;
  }
  return data as unknown as PastPaper | null;
}

/**
 * Global lookup by slug only. Used by the /api/papers/[slug] route handler
 * called from the client-side practice page. Assumes paper slugs are de-facto
 * globally unique in practice (paper codes are descriptive: 'wch11-january-2024').
 * If a future collision surfaces we'll move the API route to a 2-segment path.
 */
export async function getPastPaperBySlugOnly(
  slug: string,
): Promise<PastPaper | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("past_papers")
    .select(PAST_PAPER_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[catalogue] getPastPaperBySlugOnly failed", error);
    return null;
  }
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
