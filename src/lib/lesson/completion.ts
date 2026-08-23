"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isSectionKey,
  type CompletionSource,
  type LessonSectionKey,
  type SectionState,
  type SectionStatus,
} from "./sections.ts";

/**
 * Section completion — read and write, through the STUDENT'S OWN session.
 *
 * ============================================================================
 * ⚠ THE STUDENT'S CLIENT, NOT THE ADMIN CLIENT — RLS IS THE BOUNDARY (§94)
 * ============================================================================
 * Every call here goes through createClient() (the request's cookies), so the
 * database decides what this student may see and write. A service-role client
 * would bypass RLS entirely and make "student A cannot read student B" a
 * property of code we wrote once, instead of a property the database enforces
 * on every statement. The §107 cross-student test is only meaningful because
 * of this choice.
 *
 * ⚠ THIS MODULE WORKS BEFORE ITS TABLE EXISTS, AND SAYS SO (propose-don't-apply)
 * ============================================================================
 * lesson_section_state is a _PROPOSED_ migration: written, parked, unapplied.
 * Until the founder applies it, PostgREST answers PGRST205 ("table not in
 * schema cache"). That ONE code routes to a device-local fallback and the UI
 * is told, in `store`, which one answered — so a tick that only lives in this
 * browser can never be presented as the cross-device record §26 demands. Every
 * OTHER database error is surfaced, never swallowed: a broken store must not
 * read as "nothing completed", which is the shape that turns a fault into a
 * silent loss of a student's progress.
 *
 * ⚠ WRITE SHAPE IS UPDATE-THEN-INSERT, NEVER .upsert() — and the reason is not
 * style. PostgREST compiles .upsert() to ON CONFLICT DO UPDATE SET including
 * the key columns; the proposed grants deliberately exclude the key columns
 * from UPDATE (0064's discipline), so an upsert fails 42501 while an
 * UPDATE-then-INSERT succeeds. 0064's own header records this trap after it
 * bit once.
 */

/** Which store answered — the UI must never present "device" as "saved". */
export type CompletionStore = "server" | "device";

export type CompletionRead = {
  states: Partial<Record<LessonSectionKey, SectionState>>;
  store: CompletionStore;
  /** Present when the server store could not answer — shown, not hidden. */
  reason?: string;
};

export type CompletionWrite =
  | { ok: true; store: CompletionStore; state: SectionState }
  | { ok: false; reason: string };

/** PGRST205 = the table is not in the schema cache: the migration is parked. */
const tableAbsent = (e: { code?: string } | null) => e?.code === "PGRST205";

const PARKED_REASON =
  "lesson_section_state is not applied on this database yet — completion is being kept in this browser only";

type Row = {
  section_key: string;
  status: string;
  completed_at: string | null;
  source: string | null;
};

const toState = (r: Row): SectionState | null => {
  if (!isSectionKey(r.section_key)) return null;
  const status: SectionStatus =
    r.status === "complete" || r.status === "in_progress" ? r.status : "not_started";
  return {
    key: r.section_key,
    status,
    completedAt: r.completed_at,
    source: r.source === "auto" || r.source === "manual" ? r.source : null,
  };
};

export async function readCompletion(lessonId: string): Promise<CompletionRead> {
  if (!/^[0-9a-f-]{36}$/.test(lessonId)) return { states: {}, store: "device", reason: "bad lesson id" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ⚠ ANONYMOUS IS A REAL STATE, NOT AN ERROR. There is no row to read and no
  // row to write; the browser keeps the ticks and the UI says they are local.
  if (!user) return { states: {}, store: "device", reason: "not signed in" };

  const { data, error } = await supabase
    .from("lesson_section_state")
    .select("section_key, status, completed_at, source")
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id);

  if (error) {
    if (tableAbsent(error)) {
      console.warn("[lesson] lesson_section_state absent (migration parked) — device fallback");
      return { states: {}, store: "device", reason: PARKED_REASON };
    }
    // ⚠ NOT AN EMPTY MAP. Returning {} here would render every section as
    // "not started" — a database fault wearing the clothes of a real answer.
    throw new Error(`lesson_section_state read failed: ${error.message}`);
  }

  const states: Partial<Record<LessonSectionKey, SectionState>> = {};
  for (const row of (data ?? []) as Row[]) {
    const s = toState(row);
    if (s) states[s.key] = s;
  }
  return { states, store: "server" };
}

export async function setSectionState(input: {
  lessonId: string;
  section: LessonSectionKey;
  status: SectionStatus;
  source: CompletionSource;
  /** A POINTER to the evidence (attempt id, frames reached) — never the payload. */
  evidence?: Record<string, string | number> | null;
}): Promise<CompletionWrite> {
  const { lessonId, section, status, source } = input;
  if (!/^[0-9a-f-]{36}$/.test(lessonId)) return { ok: false, reason: "bad lesson id" };
  if (!isSectionKey(section)) return { ok: false, reason: `unknown section ${section}` };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "not signed in — this tick is kept in this browser only" };
  }

  const completedAt = status === "complete" ? new Date().toISOString() : null;
  const state: SectionState = { key: section, status, completedAt, source };

  // ⚠ UPDATE FIRST (see header). The UPDATE grant covers only the mutable
  // columns; the INSERT grant covers the key columns. Neither covers both,
  // which is exactly why .upsert() cannot work here.
  const { data: updated, error: upErr } = await supabase
    .from("lesson_section_state")
    .update({
      status,
      completed_at: completedAt,
      source,
      evidence_ref: input.evidence ?? null,
    })
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .eq("section_key", section)
    .select("section_key");

  if (upErr) {
    if (tableAbsent(upErr)) return { ok: true, store: "device", state };
    return { ok: false, reason: upErr.message };
  }
  if ((updated ?? []).length > 0) return { ok: true, store: "server", state };

  const { error: insErr } = await supabase.from("lesson_section_state").insert({
    user_id: user.id,
    lesson_id: lessonId,
    section_key: section,
    status,
    first_seen_at: new Date().toISOString(),
    completed_at: completedAt,
    evidence_ref: input.evidence ?? null,
    source,
  });

  if (insErr) {
    if (tableAbsent(insErr)) return { ok: true, store: "device", state };
    return { ok: false, reason: insErr.message };
  }
  return { ok: true, store: "server", state };
}
