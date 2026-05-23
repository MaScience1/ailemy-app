import { createClient } from "@/lib/supabase/server";
import type {
  CourseWithRelations,
  LessonForCatalogue,
  LessonForPage,
  LessonNeighbour,
  Subject,
  Unit,
} from "./types";

/**
 * Catalogue data access. All functions run on the server using the standard
 * @supabase/ssr server client — public RLS policies (catalogue_public_read_*)
 * permit anonymous reads, so this layer is safe to call from any /learn route
 * regardless of auth state. Login gating is intentionally not applied to
 * /learn (the brief calls this a sales surface).
 */

/** /learn — all subjects + a derived "do any of this subject's courses have content yet?" flag. */
export type SubjectWithAvailability = Subject & {
  hasInProgressCourse: boolean;
};

export async function listSubjects(): Promise<SubjectWithAvailability[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, slug, name, color_as, color_a2, sort_order, courses(status)")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalogue] listSubjects failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const courses = (row as { courses?: { status: string }[] }).courses ?? [];
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      color_as: row.color_as,
      color_a2: row.color_a2,
      sort_order: row.sort_order,
      hasInProgressCourse: courses.some((c) => c.status === "in_progress"),
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

/** /learn/[subject] — courses for a subject, with curriculum joined. */
export async function listCoursesForSubject(
  subjectId: string,
): Promise<CourseWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      `
      id, curriculum_id, subject_id, slug, name, level, description, status,
      estimated_launch, sort_order,
      curriculum:curricula(id, slug, name, short_name, region),
      subject:subjects(id, slug, name)
      `,
    )
    .eq("subject_id", subjectId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalogue] listCoursesForSubject failed", error);
    return [];
  }
  return (data ?? []) as unknown as CourseWithRelations[];
}

/** /learn/[subject]/[course] — single course by slug, with relations. */
export async function getCourseBySlug(
  slug: string,
): Promise<CourseWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      `
      id, curriculum_id, subject_id, slug, name, level, description, status,
      estimated_launch, sort_order,
      curriculum:curricula(id, slug, name, short_name, region),
      subject:subjects(id, slug, name)
      `,
    )
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
