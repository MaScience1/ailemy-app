"use server";

import { createClient } from "@/lib/supabase/server";
import { loadPublishedDeck } from "@/lib/lesson-deck/store.ts";
import {
  attemptFingerprint,
  buildAttempt,
  buildSourcePack,
  markAttempt,
  toServed,
  type MarkedAttempt,
  type ServedQuestion,
} from "./engine.ts";
import { familiesForLesson, loadStatuses } from "./registry.ts";

/**
 * The practice server actions (§46–§55, §103).
 *
 * ============================================================================
 * ⚠ STATELESS BY SEED — AND WHAT THAT BUYS AND COSTS
 * ============================================================================
 * startPractice generates ten questions from a random seed and returns them
 * WITHOUT answers; submitPractice REGENERATES the same ten from the same seed
 * and marks server-side. The browser never holds a correct index before
 * submission (§103), a refresh reproduces the identical attempt from the
 * stored seed (§45), and no server storage is needed before the practice
 * schema lands.
 *
 * The cost: if the founder changes a family's status BETWEEN start and
 * submit, regeneration would produce different questions than the student
 * answered — so the client returns the fingerprint it was given at start, and
 * a mismatch REFUSES the marking with a plain reason instead of silently
 * marking the wrong questions. Starting fresh costs the student one click;
 * marking answers against questions they never saw would cost them trust.
 *
 * ⚠ recordPracticeEvidence IS THE §57 WIRING POINT. Today it is a no-op with
 * a name: the parked _PROPOSED_ practice schema gives it tables to insert
 * into (attempt row + one row per answer, spec-coded, marks-carrying), and
 * Progress v2 reads the same rows. Nothing else in this file changes when
 * that lands — which is the definition of the wiring being small.
 *
 * ⚠ ACCESS MIRRORS THE ASSET ROUTE (§68): the lesson's own access column
 * decides — 'paid' requires a session, 'free' serves anon. One rule, two
 * enforcers, no drift: both read the same lessons row.
 */

type StartResult =
  | {
      ok: true;
      seed: number;
      fingerprint: string;
      questions: ServedQuestion[];
    }
  | { ok: false; reason: string };

type SubmitResult =
  | {
      ok: true;
      marked: MarkedAttempt;
      /** Whether the attempt reached the academic record — "saved" | "replay"
       *  (already recorded, not duplicated) | "device-only" (no session or a
       *  write refusal; the marking is still real, the UI says where history
       *  lives). Honesty over silence — the /welcome rule. */
      recorded: "saved" | "replay" | "device-only";
    }
  | { ok: false; reason: string };

/** The row shape PostgREST actually returns for the nested select — supabase-js
 *  cannot infer to-one relations without generated types, so the cast follows
 *  the same pattern as src/lib/catalogue/queries.ts. */
type PracticeLessonRow = {
  id: string;
  slug: string;
  access: "free" | "paid";
  status: string;
  deck_path: string | null;
  lesson_spec_points: { spec_points: { code: string } | null }[] | null;
};

async function lessonForPractice(lessonSlug: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .select("id, slug, access, status, deck_path, lesson_spec_points(spec_points(code))")
    .eq("slug", lessonSlug)
    .maybeSingle();
  if (error || !data) return { lesson: null, user: null, reason: "lesson not found" };
  const lesson = data as unknown as PracticeLessonRow;

  const {
    data: { user },
  } = await db.auth.getUser();
  if (lesson.access === "paid" && !user) {
    return { lesson: null, user: null, reason: "sign in to practise this lesson" };
  }
  return { lesson, user, reason: null };
}

async function packForLesson(lesson: {
  deck_path: string | null;
  lesson_spec_points: { spec_points: { code: string } | null }[] | null;
}) {
  const deck = await loadPublishedDeck(lesson.deck_path);
  if (!deck.available) return { pack: null, reason: `no published deck: ${deck.reason}` };
  const taught = (lesson.lesson_spec_points ?? [])
    .map((l) => l.spec_points?.code)
    .filter((c): c is string => Boolean(c));
  if (taught.length === 0) {
    // ⚠ NO CATALOGUE MAPPING → NO PRACTICE. Falling back to deck-detected
    // codes here would let a closing-slide pointer widen the boundary (§100).
    return { pack: null, reason: "this lesson has no spec points mapped in the catalogue yet" };
  }
  return { pack: buildSourcePack(deck.manifest, taught), reason: null };
}

export async function startPractice(input: {
  lessonSlug: string;
  avoidFamilies?: string[];
  focusFamilies?: string[];
}): Promise<StartResult> {
  const { lesson, reason } = await lessonForPractice(input.lessonSlug);
  if (!lesson) return { ok: false, reason: reason ?? "unavailable" };

  const { pack, reason: packReason } = await packForLesson(lesson);
  if (!pack) return { ok: false, reason: packReason ?? "unavailable" };

  const families = familiesForLesson(input.lessonSlug);
  const statuses = await loadStatuses();

  // A crypto-strength seed is unnecessary; an unpredictable-enough one that
  // fits uint32 is the contract (§45 stores it, marking re-derives from it).
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;

  try {
    const spec = buildAttempt({
      families,
      statuses,
      pack,
      seed,
      avoidFamilies: input.avoidFamilies?.slice(0, 40),
      focusFamilies: input.focusFamilies?.slice(0, 40),
    });
    return { ok: true, seed, fingerprint: attemptFingerprint(spec), questions: toServed(spec) };
  } catch (e) {
    // "nothing approved yet" is the expected state before the founder's
    // admin approval pass — say so rather than erroring opaquely (§67).
    return { ok: false, reason: e instanceof Error ? e.message : "could not build a practice set" };
  }
}

export async function submitPractice(input: {
  lessonSlug: string;
  seed: number;
  fingerprint: string;
  avoidFamilies?: string[];
  focusFamilies?: string[];
  selections: (number | null)[];
}): Promise<SubmitResult> {
  const { lesson, user, reason } = await lessonForPractice(input.lessonSlug);
  if (!lesson) return { ok: false, reason: reason ?? "unavailable" };

  const { pack, reason: packReason } = await packForLesson(lesson);
  if (!pack) return { ok: false, reason: packReason ?? "unavailable" };

  const families = familiesForLesson(input.lessonSlug);
  const statuses = await loadStatuses();

  let spec;
  try {
    spec = buildAttempt({
      families,
      statuses,
      pack,
      seed: input.seed >>> 0,
      avoidFamilies: input.avoidFamilies?.slice(0, 40),
      focusFamilies: input.focusFamilies?.slice(0, 40),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "could not rebuild the attempt" };
  }

  if (attemptFingerprint(spec) !== input.fingerprint) {
    return {
      ok: false,
      reason:
        "This practice set changed while you were answering (a question family was updated). Nothing was marked — please start a fresh set.",
    };
  }

  const marked = markAttempt(spec, input.selections);
  const recorded = await recordPracticeEvidence(marked, user?.id ?? null, lesson.id);
  return { ok: true, marked, recorded };
}

/**
 * §57 — THE ACADEMIC RECORD WRITE, live since 0064/0065 applied (2026-08-22).
 *
 * ⚠ WRITTEN WITH THE STUDENT'S OWN SESSION CLIENT, NOT THE SERVICE KEY. The
 * 0065 policies exist for exactly this shape — lpa_insert_own / lpans_insert_own
 * WITH CHECK student_id = auth.uid() — so RLS is the boundary and a bug here
 * cannot write another student's record. Anonymous practice on a free lesson
 * marks fine and records nothing ("device-only"): there is no student to
 * attribute it to, and inventing one would poison the record.
 *
 * ⚠ REPLAY-SAFE AT THE ATTEMPT LEVEL. Refresh-and-resubmit sends the same
 * (student, lesson, seed); one row set is enough and 0065's append-only
 * triggers forbid repair-by-overwrite, so the existing attempt WINS and the
 * duplicate is not inserted ("replay"). The seed is a uint32 drawn per start —
 * a same-seed collision across genuinely different attempts is a ~1/4bn event
 * paid with one missing history row, never a wrong mark.
 *
 * ⚠ A WRITE FAILURE NEVER EATS THE MARKING. The student's review renders from
 * the marked object regardless; `recorded` says plainly where history went.
 */
async function recordPracticeEvidence(
  marked: MarkedAttempt,
  studentId: string | null,
  lessonId: string,
): Promise<"saved" | "replay" | "device-only"> {
  if (!studentId) return "device-only";
  const db = await createClient();

  const { data: existing, error: exErr } = await db
    .from("lesson_practice_attempts")
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .eq("seed", marked.seed)
    .maybeSingle();
  if (exErr) {
    console.error("[practice] evidence lookup failed:", exErr.message);
    return "device-only";
  }
  if (existing) return "replay";

  const { data: attempt, error: aErr } = await db
    .from("lesson_practice_attempts")
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      seed: marked.seed,
      question_count: marked.outOf,
      score: marked.score,
      percent: marked.percent,
      // §88 immutability: the marked questions as served, reconstructable
      // after families change.
      snapshot: marked.questions,
    })
    .select("id")
    .single();
  if (aErr || !attempt) {
    console.error("[practice] attempt write failed:", aErr?.message);
    return "device-only";
  }

  const { error: ansErr } = await db.from("lesson_practice_answers").insert(
    marked.questions.map((q) => ({
      attempt_id: attempt.id,
      q_index: q.qIndex,
      family_key: q.familyKey,
      spec_code: q.specCode,
      kind: q.kind,
      selected_index: q.selectedIndex,
      correct_index: q.correctIndex,
      correct: q.correct,
      mark_awarded: q.correct ? 1 : 0,
      mark_available: 1,
    })),
  );
  if (ansErr) {
    // The attempt row stands (append-only forbids removing it) and carries the
    // full snapshot — the per-question rows are the aggregation surface, and a
    // partial write is logged loudly rather than papered over.
    console.error("[practice] answer rows write failed:", ansErr.message);
  }
  return "saved";
}
