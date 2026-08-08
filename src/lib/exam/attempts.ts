import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { AnswerType } from "./question-set";

/**
 * Sitting a paper: create an attempt, save answers into it, submit it.
 *
 * ============================================================================
 * THIS IS THE SHARED DOMAIN LAYER, NOT A COMPONENT'S HELPER FILE
 * ============================================================================
 * The web player calls these through server actions; the mobile app will call
 * the same functions behind its own transport. Neither owns the rules. What
 * "an attempt" means — which questions are in it, what each is worth, when it
 * stops being editable — is decided here and in migration 0030, once.
 *
 * ============================================================================
 * ⚠ EVERY FUNCTION USES THE CALLER'S OWN SESSION. NEVER THE SERVICE ROLE.
 * ============================================================================
 * createClient() here is the SSR client from @/lib/supabase/server, which
 * carries the signed-in user's cookies and runs as the `authenticated` role.
 * That is not an implementation detail, it is the security model: 0028's RLS
 * policies are what stop one student reading or writing another's attempt, and
 * they only apply to that role.
 *
 * getPaperExamMeta in this same directory does use the service role, for a
 * public count on a public page. NOTHING HERE MAY FOLLOW THAT PRECEDENT. If a
 * function in this file is ever switched to createAdminClient, every ownership
 * guarantee in the exam system silently disappears — RLS would be bypassed and
 * an attempt id in a URL would be enough to read someone else's paper.
 *
 * ============================================================================
 * ⚠ NOTHING HERE READS THE MARK SCHEME
 * ============================================================================
 * No function in this file selects from mark_scheme_items, model_answers or
 * examiner_report_insights, and no type it returns has a field that could
 * carry one. A student's session must not be able to fetch the answers to the
 * paper it is sitting. 0028 already enforces this — those three tables have no
 * policy a student can satisfy — but a query written here would fail at
 * runtime in a way that is easy to "fix" with the service role, so the rule is
 * stated rather than left to be rediscovered.
 */

// ============================================================================
// SHAPES
// ============================================================================

/**
 * The payload stored in student_responses.response_payload.
 *
 * jsonb because the shape genuinely differs per answer type — see 0028. The
 * union is narrow on purpose: an editor that invents its own shape produces
 * responses the marker cannot read.
 */
export type ResponsePayload =
  | { kind: "mcq"; choice: string }
  | { kind: "text"; text: string }
  | { kind: "numeric"; value: string; unit?: string }
  | { kind: "unsupported" };

export type AttemptQuestion = {
  /** question_attempts.id — the handle saveAnswer needs. */
  questionAttemptId: string;
  questionId: string;
  /** As printed: "20(b)(iii)". */
  questionNumber: string;
  /** May be null where the question is purely a diagram. */
  questionText: string | null;
  answerType: AnswerType;
  commandWord: string | null;
  /** Snapshotted at creation. NEVER recomputed from paper_questions on read. */
  maxMarks: number;
  flagged: boolean;
  /** null when unanswered. */
  response: ResponsePayload | null;
  /**
   * Stems of every ancestor, outermost first. 20(b)(iii) cannot be answered
   * without Q20's "This question is about carbon dioxide" and 20(b)'s
   * "Dodecane C12H26, is found in kerosene…" — the container rows carry the
   * shared context and have no attempt row of their own.
   */
  context: { questionNumber: string; questionText: string }[];
};

export type PlayerAttempt = {
  id: string;
  paperId: string;
  mode: "exam" | "practice";
  startedAt: string;
  /** Non-null once submitted; the player becomes read-only. */
  submittedAt: string | null;
  totalAvailable: number | null;
  questions: AttemptQuestion[];
};

export type AttemptResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ============================================================================
// CREATE
// ============================================================================

/**
 * Start a sitting.
 *
 * Delegates the whole thing to public.create_exam_attempt (migration 0030),
 * which does it in ONE TRANSACTION and reads each question's marks from
 * paper_questions itself. The only things that cross from the browser are a
 * paper id and a mode — what a question is worth is never sent, and could not
 * be honoured if it were.
 *
 * Deliberately NOT idempotent: re-sitting a paper is a legitimate thing to do,
 * so a second call makes a second attempt. If "resume the one in progress" is
 * wanted, that is a lookup the caller does first — see findOpenAttempt.
 */
export async function createAttempt(
  paperId: string,
  mode: "exam" | "practice",
): Promise<AttemptResult<string>> {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in to sit a paper." };
  }

  const { data, error } = await db.rpc("create_exam_attempt", {
    p_paper_id: paperId,
    p_mode: mode,
  });

  if (error) {
    // The function raises with meaningful SQLSTATEs; map the ones a student
    // can actually cause, and never leak a raw Postgres string into the UI.
    if (error.code === "P0002") {
      return {
        ok: false,
        error: "This paper isn't ready to sit yet — it has no questions.",
      };
    }
    if (error.code === "28000") {
      return { ok: false, error: "You need to be signed in to sit a paper." };
    }
    console.error(`[createAttempt] ${error.code ?? "?"}: ${error.message}`);
    return { ok: false, error: "Could not start this paper. Please try again." };
  }

  return { ok: true, data: data as string };
}

/** The caller's most recent unsubmitted attempt at a paper, if any. */
export async function findOpenAttempt(
  paperId: string,
  mode: "exam" | "practice",
): Promise<string | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("exam_attempts")
    .select("id")
    .eq("paper_id", paperId)
    .eq("mode", mode)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  // RLS scopes this to the caller's own rows; no student_id filter is needed
  // and adding one would imply the policy might not be doing its job.
  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

// ============================================================================
// READ
// ============================================================================

type QuestionRow = {
  id: string;
  parent_question_id: string | null;
  question_number: string;
  question_text: string | null;
  answer_type: string;
  command_word: string | null;
  display_order: number;
};

/**
 * Everything the player needs to render, and nothing else.
 *
 * Note what is absent: no mark_scheme_items, no model_answers, no
 * examiner_report_insights, no awarded_marks. A student sitting a paper has no
 * business holding any of it, and the shape of this function is the first
 * place that would go wrong.
 *
 * Returns null when the attempt does not exist OR is not the caller's — RLS
 * makes those indistinguishable, which is the correct answer to give: a probe
 * for someone else's attempt id should look exactly like a typo.
 */
export async function getAttemptForPlayer(
  attemptId: string,
): Promise<PlayerAttempt | null> {
  const db = await createClient();

  const { data: attempt, error: attemptError } = await db
    .from("exam_attempts")
    .select("id, paper_id, mode, started_at, submitted_at, total_available")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError || !attempt) return null;
  const a = attempt as {
    id: string;
    paper_id: string;
    mode: string;
    started_at: string;
    submitted_at: string | null;
    total_available: number | null;
  };

  const { data: qaRows, error: qaError } = await db
    .from("question_attempts")
    .select("id, question_id, max_marks, flagged")
    .eq("exam_attempt_id", attemptId);
  if (qaError || !qaRows) return null;

  // EVERY question on the paper, containers included — the leaves need their
  // ancestors' stems for context, and those have no question_attempts row.
  const { data: allQuestions } = await db
    .from("paper_questions")
    .select(
      "id, parent_question_id, question_number, question_text, answer_type, command_word, display_order",
    )
    .eq("paper_id", a.paper_id);

  const byId = new Map<string, QuestionRow>(
    ((allQuestions ?? []) as QuestionRow[]).map((q) => [q.id, q]),
  );

  const { data: responses } = await db
    .from("student_responses")
    .select("question_attempt_id, response_payload")
    .in(
      "question_attempt_id",
      (qaRows as { id: string }[]).map((r) => r.id),
    );

  const responseByAttempt = new Map<string, ResponsePayload>(
    ((responses ?? []) as {
      question_attempt_id: string;
      response_payload: ResponsePayload;
    }[]).map((r) => [r.question_attempt_id, r.response_payload]),
  );

  const questions: AttemptQuestion[] = (
    qaRows as {
      id: string;
      question_id: string;
      max_marks: number;
      flagged: boolean;
    }[]
  )
    .map((qa) => {
      const q = byId.get(qa.question_id);

      // Walk up to the root collecting stems. Bounded by depth rather than
      // trusting the tree: a cycle in parent_question_id would hang the render
      // otherwise, and 0028 only forbids a row being its own parent.
      const context: { questionNumber: string; questionText: string }[] = [];
      let cursor = q?.parent_question_id ?? null;
      for (let depth = 0; cursor !== null && depth < 8; depth += 1) {
        const parent = byId.get(cursor);
        if (!parent) break;
        if (parent.question_text) {
          context.unshift({
            questionNumber: parent.question_number,
            questionText: parent.question_text,
          });
        }
        cursor = parent.parent_question_id;
      }

      const question: AttemptQuestion = {
        questionAttemptId: qa.id,
        questionId: qa.question_id,
        questionNumber: q?.question_number ?? "?",
        questionText: q?.question_text ?? null,
        answerType: (q?.answer_type ?? "other") as AnswerType,
        commandWord: q?.command_word ?? null,
        maxMarks: qa.max_marks,
        flagged: qa.flagged,
        response: responseByAttempt.get(qa.id) ?? null,
        context,
      };
      // question_attempts has no ordering of its own; display_order on
      // paper_questions is the paper's own sequence and the only correct one.
      return { question, order: q?.display_order ?? 0 };
    })
    .sort((x, y) => x.order - y.order)
    .map((entry) => entry.question);

  return {
    id: a.id,
    paperId: a.paper_id,
    mode: a.mode === "exam" ? "exam" : "practice",
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    totalAvailable: a.total_available,
    questions,
  };
}

// ============================================================================
// WRITE
// ============================================================================

/**
 * Persist one answer. Safe to call on every debounce tick.
 *
 * One upsert on the unique index 0030 added, so two saves racing — two tabs, or
 * a slow request overtaking a fast one — settle on one row instead of leaving
 * two "latest" answers with no way to tell which is real.
 *
 * The caller supplies no ownership proof and needs none: the RLS policy on
 * student_responses joins through question_attempts to exam_attempts and
 * requires student_id = auth.uid(), so a forged question_attempt_id writes
 * nothing. The trigger from 0030 refuses the write outright once the attempt
 * is submitted.
 */
export async function saveAnswer(
  questionAttemptId: string,
  responseType: AnswerType,
  payload: ResponsePayload,
): Promise<AttemptResult<null>> {
  const db = await createClient();

  const { error } = await db.from("student_responses").upsert(
    {
      question_attempt_id: questionAttemptId,
      response_type: responseType,
      response_payload: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "question_attempt_id" },
  );

  if (error) {
    // 25006 is the "attempt already submitted" trigger. It is a normal thing
    // to hit — a debounced save can land just after Submit — so it gets a
    // sentence a student can act on rather than a generic failure.
    if (error.code === "25006") {
      return {
        ok: false,
        error: "This attempt has been submitted, so answers can no longer change.",
      };
    }
    console.error(`[saveAnswer] ${error.code ?? "?"}: ${error.message}`);
    return { ok: false, error: "Could not save that answer." };
  }
  return { ok: true, data: null };
}

/** Flag or unflag a question for review. Same ownership story as saveAnswer. */
export async function setFlagged(
  questionAttemptId: string,
  flagged: boolean,
): Promise<AttemptResult<null>> {
  const db = await createClient();
  const { error } = await db
    .from("question_attempts")
    .update({ flagged, updated_at: new Date().toISOString() })
    .eq("id", questionAttemptId);

  if (error) {
    if (error.code === "25006") {
      return { ok: false, error: "This attempt has been submitted." };
    }
    console.error(`[setFlagged] ${error.code ?? "?"}: ${error.message}`);
    return { ok: false, error: "Could not update that flag." };
  }
  return { ok: true, data: null };
}

/**
 * Finish the sitting.
 *
 * `.is("submitted_at", null)` in the filter is what makes this safe to call
 * twice: the second call matches no row and changes nothing, rather than
 * moving the timestamp. The one-way trigger in 0030 is the backstop if this
 * filter is ever dropped.
 *
 * NO MARKING HAPPENS HERE. Submitting records that the student is done; what
 * their answers are worth is a later step, and deliberately not this one.
 */
export async function submitAttempt(
  attemptId: string,
): Promise<AttemptResult<{ submittedAt: string }>> {
  const db = await createClient();
  const submittedAt = new Date().toISOString();

  const { data, error } = await db
    .from("exam_attempts")
    .update({ submitted_at: submittedAt, updated_at: submittedAt })
    .eq("id", attemptId)
    .is("submitted_at", null)
    .select("submitted_at");

  if (error) {
    console.error(`[submitAttempt] ${error.code ?? "?"}: ${error.message}`);
    return { ok: false, error: "Could not submit this attempt." };
  }

  // No row updated means it was already submitted, or is not the caller's.
  // Both are reported the same way, for the same reason getAttemptForPlayer
  // returns null in both cases.
  if (!data || data.length === 0) {
    const existing = await getAttemptForPlayer(attemptId);
    if (existing?.submittedAt) {
      return { ok: true, data: { submittedAt: existing.submittedAt } };
    }
    return { ok: false, error: "That attempt could not be submitted." };
  }

  return { ok: true, data: { submittedAt } };
}
