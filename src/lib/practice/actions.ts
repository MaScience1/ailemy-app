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
  | { ok: true; marked: MarkedAttempt }
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
  await recordPracticeEvidence(marked, user?.id ?? null, lesson.id);
  return { ok: true, marked };
}

/**
 * §57 WIRING POINT — the academic record write.
 *
 * ⚠ DELIBERATELY A NO-OP TODAY, AND LOUD ABOUT IT IN CODE RATHER THAN QUIET.
 * The parked _PROPOSED_ schema defines lesson_practice_attempts and
 * lesson_practice_answers as the lesson-practice arm of the ONE academic
 * record (same student key, spec codes, marks awarded/available, attempted_at
 * as exam_attempts' criterion rows). When planning numbers the batch, this
 * function gains two inserts and nothing else in this file moves. Until then
 * attempt history is device-local and the UI says so — an honest limitation
 * beats a silent one (the /welcome rule).
 */
async function recordPracticeEvidence(
  _marked: MarkedAttempt,
  _studentId: string | null,
  _lessonId: string,
): Promise<void> {
  // no-op until the practice schema is applied — see the header above.
}
