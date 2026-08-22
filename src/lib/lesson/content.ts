import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lesson content that lives outside the deck: notes, worked examples, and the
 * lesson's exam-question mapping.
 *
 * ============================================================================
 * ⚠ ALL THREE TABLES ARE PARKED _PROPOSED_ MIGRATIONS — AND THIS MODULE SAYS SO
 * ============================================================================
 * Nothing here invents content. Every reader returns a discriminated result:
 * `available: true` with real rows, or `available: false` with the reason the
 * page shows the student. A PGRST205 — the table is not in the schema cache,
 * i.e. the migration has not been applied on this database — is the ONE error
 * that means "not built yet". Every other database error is thrown, because a
 * broken store that reads as "no notes for this lesson" is a fault disguised
 * as an editorial decision.
 *
 * ⚠ THE ADMIN CLIENT IS CORRECT HERE AND NOWHERE NEAR THE STUDENT'S OWN DATA.
 * These are PUBLISHED TEACHING MATERIALS, not per-student records: the same
 * bytes for every reader, gated by `status = 'published'` in the query itself.
 * Student state goes through the student's session client so RLS is the
 * boundary (src/lib/lesson/completion.ts) — the two must not be confused.
 */

const tableAbsent = (e: { code?: string } | null) => e?.code === "PGRST205";

const PARKED = (what: string) =>
  `${what} are not switched on yet — the schema for them is written and waiting to be applied`;

export type NotesResult =
  | { available: true; body: string; updatedAt: string | null }
  | { available: false; reason: string };

export type WorkedExample = {
  id: string;
  title: string;
  prompt: string;
  /** Ordered reveal steps — the classroom sequence, one click at a time. */
  steps: { label: string; body: string }[];
  answer: string;
  marks: number | null;
  specCode: string | null;
  reviewSlide: number | null;
};

export type WorkedExamplesResult =
  | { available: true; examples: WorkedExample[] }
  | { available: false; reason: string };

export type LessonExamQuestion = {
  questionId: string;
  paperId: string;
  paperLabel: string;
  questionRef: string;
  marks: number | null;
  specCode: string | null;
};

export type ExamQuestionsResult =
  | { available: true; questions: LessonExamQuestion[] }
  | { available: false; reason: string };

export async function loadLessonNotes(lessonId: string): Promise<NotesResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_notes")
    .select("body_md, status, updated_at")
    .eq("lesson_id", lessonId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    if (tableAbsent(error)) return { available: false, reason: PARKED("Lesson notes") };
    throw new Error(`lesson_notes read failed: ${error.message}`);
  }
  if (!data?.body_md) {
    return { available: false, reason: "No notes have been published for this lesson yet." };
  }
  return { available: true, body: data.body_md as string, updatedAt: (data.updated_at as string) ?? null };
}

export async function loadWorkedExamples(lessonId: string): Promise<WorkedExamplesResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_worked_examples")
    .select("id, title, prompt, steps, answer, marks, spec_code, review_slide, status, sort_order")
    .eq("lesson_id", lessonId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    if (tableAbsent(error)) return { available: false, reason: PARKED("Worked examples") };
    throw new Error(`lesson_worked_examples read failed: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return { available: false, reason: "No worked examples have been published for this lesson yet." };
  }

  const examples: WorkedExample[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    // ⚠ A MALFORMED STEPS PAYLOAD IS SKIPPED LOUDLY, NOT RENDERED HALF-WAY. A
    // worked example missing its middle step teaches the wrong method, which
    // is worse than one example fewer.
    const raw = Array.isArray(r.steps) ? r.steps : [];
    const steps = raw
      .filter((s): s is { label: string; body: string } =>
        Boolean(s) && typeof (s as { label?: unknown }).label === "string" &&
        typeof (s as { body?: unknown }).body === "string")
      .map((s) => ({ label: s.label, body: s.body }));
    if (steps.length !== raw.length) {
      console.warn(`[lesson] worked example ${String(r.id)} has malformed steps — skipped`);
      continue;
    }
    examples.push({
      id: String(r.id),
      title: String(r.title ?? ""),
      prompt: String(r.prompt ?? ""),
      steps,
      answer: String(r.answer ?? ""),
      marks: typeof r.marks === "number" ? r.marks : null,
      specCode: typeof r.spec_code === "string" ? r.spec_code : null,
      reviewSlide: typeof r.review_slide === "number" ? r.review_slide : null,
    });
  }
  if (examples.length === 0) {
    return { available: false, reason: "No worked examples have been published for this lesson yet." };
  }
  return { available: true, examples };
}

/**
 * The lesson's exam questions.
 *
 * ⚠ THIS IS A MAPPING, NOT A QUESTION STORE (§19). The questions themselves
 * stay in paper_questions where the reviewed marking path already reads them —
 * building a second question table is exactly the "second marking engine" the
 * brief forbids. What is missing is only the link from a lesson to the subset
 * of paper questions that assess it, which is what the parked table provides.
 */
export async function loadLessonExamQuestions(lessonId: string): Promise<ExamQuestionsResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_paper_questions")
    .select("question_id, sort_order, paper_questions(id, paper_id, question_ref, marks)")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (tableAbsent(error)) return { available: false, reason: PARKED("Lesson exam questions") };
    throw new Error(`lesson_paper_questions read failed: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return { available: false, reason: "No exam questions have been mapped to this lesson yet." };
  }

  const questions: LessonExamQuestion[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const q = r.paper_questions as Record<string, unknown> | null;
    if (!q) continue;
    questions.push({
      questionId: String(q.id),
      paperId: String(q.paper_id),
      paperLabel: "",
      questionRef: String(q.question_ref ?? ""),
      marks: typeof q.marks === "number" ? q.marks : null,
      specCode: null,
    });
  }
  return questions.length > 0
    ? { available: true, questions }
    : { available: false, reason: "No exam questions have been mapped to this lesson yet." };
}
