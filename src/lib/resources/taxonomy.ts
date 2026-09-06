import { createClient } from "@/lib/supabase/server";
import { groupTopicsByUnit, UNGROUPED_UNIT_ID } from "@/lib/specification/grouping";

/**
 * The resource graph — ONE taxonomy, reusing what already exists (§67).
 *
 * ============================================================================
 * ⚠ NO PARALLEL CONTENT GRAPH WAS CREATED, AND NONE WAS NEEDED
 * ============================================================================
 * The chain the brief describes — Subject → Level → Qualification → Board →
 * Specification → Unit → Topic → Spec point → Resource — is already in the
 * database and has been since 0001:
 *
 *   subjects → curricula (board+qualification) → courses (pathway)
 *            → units → topics → spec_points
 *   lessons  → units, and → spec_points via lesson_spec_points
 *   past_papers → courses
 *
 * So Resources reads that graph rather than adding a `resources` table with
 * its own copy of the same hierarchy. A second taxonomy is exactly the silo
 * §67 forbids, and it would drift from the first within a week.
 *
 * ⚠ ONE THING IS NOT WHERE YOU WOULD EXPECT IT: `lessons` has NO topic_id.
 * A lesson reaches its topic through lesson_spec_points → spec_points
 * → topic_id. Assuming the column existed cost this build a diagnostic that
 * confidently reported "0 live lessons" — PostgREST answered 42703, the code
 * ignored the error, and a schema mistake rendered as an editorial fact.
 *
 * ⚠ EVERY COUNT HERE COMES FROM A QUERY THE VIEWER COULD RUN THEMSELVES (§49,
 * §60). paper_questions and question_spec_points REFUSE anon with 42501 —
 * they are admin-gated so exam content cannot be scraped — so no public
 * surface counts questions. The qualification build learned this the
 * expensive way, by shipping a reader that returned an empty board list to
 * every logged-out student.
 */

export type ResourceKind =
  | "lesson" | "notes_deck" | "past_paper" | "worked_example" | "definition_set" | "formula_set";

export type UnitNode = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  lessonCount: number;
  liveLessonCount: number;
  topics: TopicNode[];
};

export type TopicNode = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  specPointCount: number;
  /** Lessons reaching this topic through their spec points. */
  lessonCount: number;
};

export type CourseResources = {
  courseId: string;
  courseName: string;
  courseSlug: string;
  curriculumName: string;
  subjectSlug: string;
  units: UnitNode[];
  counts: {
    lessons: number;
    liveLessons: number;
    pastPapers: number;
    specPoints: number;
  };
  /**
   * ⚠ NOT A COUNT, A REFUSAL. Questions exist and are numerous, but a public
   * page cannot read them, so it must not print a number it cannot stand
   * behind. The UI says where questions live instead of how many there are.
   */
  questionsCountable: false;
  error: string | null;
};

const EMPTY_COUNTS = { lessons: 0, liveLessons: 0, pastPapers: 0, specPoints: 0 };

export async function loadCourseResources(
  subjectSlug: string,
  courseSlug: string,
): Promise<CourseResources | null> {
  const db = await createClient();

  const { data: course, error: courseErr } = await db
    .from("courses")
    .select("id, slug, name, subject_id, curricula(name), subjects(slug)")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (courseErr) {
    throw new Error(`course read failed: ${courseErr.code} ${courseErr.message}`);
  }
  if (!course) return null;

  const subj = (course as unknown as { subjects: { slug: string } | null }).subjects;
  if (subj?.slug !== subjectSlug) return null;

  const base = {
    courseId: course.id as string,
    courseName: course.name as string,
    courseSlug: course.slug as string,
    curriculumName:
      (course as unknown as { curricula: { name: string } | null }).curricula?.name ?? "",
    subjectSlug,
    questionsCountable: false as const,
  };

  const [units, topics, lessons, papers] = await Promise.all([
    db.from("units").select("id, code, name, status, sort_order").eq("course_id", course.id).order("sort_order"),
    db.from("topics").select("id, code, name, status, unit_id, sort_order").eq("course_id", course.id).order("sort_order"),
    db.from("lessons").select("id, unit_id, status").eq("course_id", course.id).neq("status", "archived"),
    db.from("past_papers").select("id").eq("course_id", course.id),
  ]);

  // ⚠ SPEC POINTS AND LINKS ARE SCOPED TO THIS COURSE'S TOPICS, sequentially,
  // exactly as specification/queries.ts does — each read is filtered by the
  // previous read's ids. These two started life as unfiltered whole-table
  // reads, which was correct at one course but walks into PostgREST's
  // default 1000-row cap as courses accumulate (516 spec points across three
  // courses after 4BI1); past the cap the reads silently truncate and every
  // count on this page goes quietly wrong. Scoped, a course can never fetch
  // more than its own specification.
  const courseTopicIds = (topics.data ?? []).map((t) => t.id as string);
  const specPoints = courseTopicIds.length
    ? await db.from("spec_points").select("id, topic_id").in("topic_id", courseTopicIds)
    : { data: [], error: null };
  const specPointIds = (specPoints.data ?? []).map((s) => s.id as string);
  const lessonSpec = specPointIds.length
    ? await db.from("lesson_spec_points").select("lesson_id, spec_point_id").in("spec_point_id", specPointIds)
    : { data: [], error: null };

  // ⚠ A FAILED READ IS REPORTED, NEVER RENDERED AS ZERO. See the header: the
  // one bug this module exists to not repeat.
  for (const [label, res] of [
    ["units", units], ["topics", topics], ["lessons", lessons],
    ["past papers", papers], ["spec points", specPoints], ["lesson spec points", lessonSpec],
  ] as const) {
    if (res.error) {
      return { ...base, units: [], counts: EMPTY_COUNTS, error: `${label}: ${res.error.message}` };
    }
  }

  const lessonRows = lessons.data ?? [];
  const specRows = specPoints.data ?? [];
  const linkRows = lessonSpec.data ?? [];

  // topic → spec point ids, then spec point → lessons, giving topic → lessons
  // through the mapping that actually exists.
  const specToTopic = new Map<string, string>();
  for (const s of specRows) if (s.topic_id) specToTopic.set(s.id, s.topic_id);
  const lessonsByTopic = new Map<string, Set<string>>();
  for (const l of linkRows) {
    const topicId = specToTopic.get(l.spec_point_id);
    if (!topicId) continue;
    const set = lessonsByTopic.get(topicId) ?? new Set<string>();
    set.add(l.lesson_id);
    lessonsByTopic.set(topicId, set);
  }
  const specCountByTopic = new Map<string, number>();
  for (const s of specRows) {
    if (!s.topic_id) continue;
    specCountByTopic.set(s.topic_id, (specCountByTopic.get(s.topic_id) ?? 0) + 1);
  }

  const topicNodes = (topics.data ?? []).map((t) => ({
    id: t.id as string,
    code: (t.code as string) ?? null,
    name: t.name as string,
    status: t.status as string,
    unitId: (t.unit_id as string) ?? null,
    specPointCount: specCountByTopic.get(t.id as string) ?? 0,
    lessonCount: lessonsByTopic.get(t.id as string)?.size ?? 0,
  }));

  // ⚠ grouping.ts owns where a topic hangs — a unit-less course (IGCSE, UK
  // GCSE: topics with unit_id NULL and no units rows at all) renders its
  // topics under one UNGROUPED_UNIT_ID group instead of being dropped. The
  // group's lesson counts follow the same rule as its topics: lessons that
  // belong to no unit are counted there, not nowhere.
  const unitIds = new Set((units.data ?? []).map((u) => u.id as string));
  const unitNodes: UnitNode[] = groupTopicsByUnit(
    (units.data ?? []).map((u) => ({
      id: u.id as string,
      code: (u.code as string) ?? null,
      name: u.name as string,
      status: u.status as string,
    })),
    topicNodes,
  ).map(({ unit, topics: groupTopics }) => {
    const mine = unit
      ? lessonRows.filter((l) => l.unit_id === unit.id)
      : lessonRows.filter((l) => l.unit_id === null || !unitIds.has(l.unit_id as string));
    return {
      id: unit?.id ?? UNGROUPED_UNIT_ID,
      code: unit?.code ?? null,
      name: unit?.name ?? "Ungrouped",
      status: unit?.status ?? "live",
      lessonCount: mine.length,
      liveLessonCount: mine.filter((l) => l.status === "live").length,
      topics: groupTopics.map(({ unitId: _u, ...t }) => t),
    };
  });

  return {
    ...base,
    units: unitNodes,
    counts: {
      lessons: lessonRows.length,
      liveLessons: lessonRows.filter((l) => l.status === "live").length,
      pastPapers: (papers.data ?? []).length,
      // specRows is already scoped to exactly this course's topics above.
      specPoints: specRows.length,
    },
    error: null,
  };
}

/** Courses a subject has, for the subject step. */
export async function listCoursesForSubject(subjectSlug: string): Promise<
  { slug: string; name: string; curriculumName: string; pathway: string | null; liveLessons: number }[]
> {
  const db = await createClient();
  const { data: subject, error: sErr } = await db
    .from("subjects").select("id").eq("slug", subjectSlug).maybeSingle();
  if (sErr) throw new Error(`subject read failed: ${sErr.message}`);
  if (!subject) return [];

  const { data: courses, error: cErr } = await db
    .from("courses")
    .select("id, slug, name, pathway, curricula(name)")
    .eq("subject_id", subject.id);
  if (cErr) throw new Error(`courses read failed: ${cErr.message}`);

  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return [];
  const { data: lessons, error: lErr } = await db
    .from("lessons").select("course_id, status").in("course_id", ids).eq("status", "live");
  if (lErr) throw new Error(`lesson counts failed: ${lErr.message}`);

  const liveByCourse = new Map<string, number>();
  for (const l of lessons ?? []) liveByCourse.set(l.course_id, (liveByCourse.get(l.course_id) ?? 0) + 1);

  return (courses ?? []).map((c) => ({
    slug: c.slug as string,
    name: c.name as string,
    curriculumName: (c as unknown as { curricula: { name: string } | null }).curricula?.name ?? "",
    pathway: (c.pathway as string) ?? null,
    liveLessons: liveByCourse.get(c.id) ?? 0,
  }));
}
