import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { compareSpecCodes } from "./codes.ts";
import type {
  PracticeEvidenceRow,
  SpecificationTree,
  SpecPointNode,
  SpecTopicNode,
  SpecUnitNode,
} from "./types.ts";

/**
 * Server loaders for the Specification Explorer.
 *
 * ============================================================================
 * ⚠ TWO LOADERS, TWO TRUST LEVELS, ONE DOCTRINE
 * ============================================================================
 * The TREE is public catalogue data — the same tables the Resources page reads
 * anonymously (units, topics, spec_points, lessons, lesson_spec_points). No
 * key, no gate, RLS as the anon role sees it.
 *
 * EVIDENCE is one student's own academic record. It is read with the student's
 * OWN session client, and student_id is ALSO filtered explicitly — the
 * exam_attempts SELECT policy carries an `OR is_staff()` arm, so "RLS will
 * scope it" is not a habit this codebase allows itself (profile-reader.ts
 * doctrine). No service key appears anywhere in this feature.
 *
 * The error doctrine is queries.ts/taxonomy.ts's: null means "no such course";
 * a partial read failure is REPORTED on the shape, never rendered as an empty
 * specification; a broken course read throws to the route error boundary.
 */

/**
 * cache()-wrapped: generateMetadata and the page both need the tree, and the
 * route streams (loading.tsx), so the status-deciding read must not run twice.
 */
export const loadSpecificationTree = cache(async function loadSpecificationTree(
  subjectSlug: string,
  courseSlug: string,
): Promise<SpecificationTree | null> {
  const db = await createClient();

  const { data: course, error: courseErr } = await db
    .from("courses")
    .select("id, slug, name, pathway, curricula(name), subjects(slug, name)")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (courseErr) {
    throw new Error(`course read failed: ${courseErr.code} ${courseErr.message}`);
  }
  if (!course) return null;

  const subj = (course as unknown as { subjects: { slug: string; name: string } | null }).subjects;
  if (subj?.slug !== subjectSlug) return null;

  const base = {
    courseId: course.id as string,
    courseSlug: course.slug as string,
    courseName: course.name as string,
    coursePathway: (course.pathway as string) ?? null,
    curriculumName:
      (course as unknown as { curricula: { name: string } | null }).curricula?.name ?? "",
    subjectSlug,
    subjectName: subj.name,
  };

  const [units, topics, lessons] = await Promise.all([
    db.from("units")
      .select("id, code, name, sort_order")
      .eq("course_id", course.id)
      .order("sort_order"),
    db.from("topics")
      .select("id, code, name, unit_id, sort_order")
      .eq("course_id", course.id)
      .neq("status", "archived")
      .order("sort_order"),
    db.from("lessons")
      .select("id, slug, title, status")
      .eq("course_id", course.id)
      .neq("status", "archived"),
  ]);
  for (const [label, res] of [
    ["units", units],
    ["topics", topics],
    ["lessons", lessons],
  ] as const) {
    if (res.error) {
      return { ...base, units: [], error: `${label}: ${res.error.message}` };
    }
  }

  const topicRows = topics.data ?? [];
  const topicIds = topicRows.map((t) => t.id as string);

  // Spec points scoped to this course's topics; links scoped to those points.
  // Sequential because each is filtered by the previous read's ids.
  // ⚠ ARCHIVED ROWS ARE LIFECYCLE, NOT CONTENT. content_status's 'archived'
  // is the catalogue's own soft-delete (a retired point keeps its row so
  // nothing referencing it breaks); a specification map must not show it.
  const points = topicIds.length
    ? await db
        .from("spec_points")
        .select("id, topic_id, code, title, description, command_terms, sort_order")
        .in("topic_id", topicIds)
        .neq("status", "archived")
    : { data: [], error: null };
  if (points.error) {
    return { ...base, units: [], error: `spec points: ${points.error.message}` };
  }
  const pointRows = points.data ?? [];

  const links = pointRows.length
    ? await db
        .from("lesson_spec_points")
        .select("lesson_id, spec_point_id")
        .in("spec_point_id", pointRows.map((p) => p.id as string))
    : { data: [], error: null };
  if (links.error) {
    return { ...base, units: [], error: `lesson links: ${links.error.message}` };
  }

  const lessonById = new Map(
    (lessons.data ?? []).map((l) => [
      l.id as string,
      { slug: l.slug as string, title: l.title as string, live: l.status === "live" },
    ]),
  );
  const lessonsByPoint = new Map<string, SpecPointNode["lessons"]>();
  for (const link of links.data ?? []) {
    const lesson = lessonById.get(link.lesson_id as string);
    if (!lesson) continue; // a link into another course's lesson is not ours to show
    const arr = lessonsByPoint.get(link.spec_point_id as string) ?? [];
    arr.push(lesson);
    lessonsByPoint.set(link.spec_point_id as string, arr);
  }

  const pointsByTopic = new Map<string, SpecPointNode[]>();
  for (const p of pointRows) {
    const node: SpecPointNode = {
      id: p.id as string,
      code: p.code as string,
      title: (p.title as string) ?? null,
      description: (p.description as string) ?? "",
      commandTerms: (p.command_terms as string[]) ?? [],
      lessons: (lessonsByPoint.get(p.id as string) ?? []).sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    };
    const arr = pointsByTopic.get(p.topic_id as string) ?? [];
    arr.push(node);
    pointsByTopic.set(p.topic_id as string, arr);
  }
  for (const arr of pointsByTopic.values()) {
    arr.sort((a, b) => compareSpecCodes(a.code, b.code));
  }

  const topicNodes = topicRows.map((t) => ({
    id: t.id as string,
    code: (t.code as string) ?? null,
    name: t.name as string,
    unitId: (t.unit_id as string) ?? null,
    points: pointsByTopic.get(t.id as string) ?? [],
  }));

  const unitNodes: SpecUnitNode[] = (units.data ?? []).map((u) => ({
    id: u.id as string,
    code: (u.code as string) ?? null,
    name: u.name as string,
    topics: topicNodes
      .filter((t) => t.unitId === u.id)
      .map(({ unitId: _unitId, ...t }): SpecTopicNode => t),
  }));

  return { ...base, units: unitNodes, error: null };
});

/** Lesson ids of the course, for scoping evidence — derived from the tree load
 *  would be wrong: the tree only carries lessons LINKED to spec points, and a
 *  practice attempt belongs to the course through its lesson whether or not
 *  that lesson is mapped yet. */
export async function listCourseLessonIds(courseId: string): Promise<string[]> {
  const db = await createClient();
  const { data, error } = await db.from("lessons").select("id").eq("course_id", courseId);
  if (error) throw new Error(`lesson ids read failed: ${error.message}`);
  return (data ?? []).map((l) => l.id as string);
}

export type EvidenceResult =
  | { ok: true; rows: PracticeEvidenceRow[] }
  | { ok: false; error: string };

/**
 * The student's own practice evidence for one course.
 *
 * ⚠ A FAILED READ RETURNS AN ERROR, NEVER AN EMPTY LIST. "No evidence yet" is
 * an empty mastery map a student should trust; "the read failed" is not, and
 * conflating them is the exact confusion this codebase has shipped before.
 */
export async function loadPracticeEvidence(
  studentId: string,
  courseLessonIds: string[],
): Promise<EvidenceResult> {
  if (courseLessonIds.length === 0) return { ok: true, rows: [] };
  const db = await createClient();

  const { data: attempts, error: aErr } = await db
    .from("lesson_practice_attempts")
    .select("id")
    .eq("student_id", studentId)
    .in("lesson_id", courseLessonIds);
  if (aErr) return { ok: false, error: `practice attempts: ${aErr.message}` };
  const attemptIds = (attempts ?? []).map((a) => a.id as string);
  if (attemptIds.length === 0) return { ok: true, rows: [] };

  const { data: answers, error: ansErr } = await db
    .from("lesson_practice_answers")
    .select("attempt_id, q_index, spec_code, mark_awarded, mark_available, attempted_at")
    .in("attempt_id", attemptIds);
  if (ansErr) return { ok: false, error: `practice answers: ${ansErr.message}` };

  return {
    ok: true,
    rows: (answers ?? []).map((r) => ({
      attemptId: r.attempt_id as string,
      qIndex: r.q_index as number,
      specCode: r.spec_code as string,
      markAwarded: r.mark_awarded as number,
      markAvailable: r.mark_available as number,
      attemptedAt: (r.attempted_at as string) ?? null,
    })),
  };
}
