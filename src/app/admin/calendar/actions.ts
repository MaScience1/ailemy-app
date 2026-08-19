"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { readPeriodForm, readRuleForm, readSessionForm } from "@/lib/admin/schedule-form";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Timetable editing (§7–§9).
 *
 * ⚠ assertAdmin() IS THE FIRST LINE OF EVERY ACTION. The layout gates the page
 * and the proxy gates /admin/*, but a server action is a POST endpoint anything
 * that can guess it may call.
 *
 * ⚠ SERVICE ROLE. 0044 grants clients SELECT and nothing else — every write is
 * server-side by design — so a session-scoped client would fail on the grant
 * before RLS ran. assertAdmin() above stands in for the policy.
 *
 * ⚠ EVERY SURFACE THAT SHOWS A TIMETABLE IS REVALIDATED. Six routes read the
 * schedule; revalidating only /admin/calendar would leave a cancelled lesson
 * showing on the homepage until something else happened to invalidate it —
 * which is the §5 promise broken in the one direction that matters.
 */

type Result = { ok: true } | { ok: false; error: string };

const SCHEDULE_PATHS = [
  "/", "/calendar", "/tuition", "/chemistry", "/biology", "/physics", "/admin/calendar",
];

function refresh() {
  for (const p of SCHEDULE_PATHS) revalidatePath(p);
}

function explain(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return "Migration 0044 has not been applied — the schedule tables do not exist yet.";
  }
  if (error.code === "PGRST204" || error.code === "42703") {
    return `Migration 0044 has not been applied in full. (${error.message})`;
  }
  if (error.code === "23514") return `The database refused this: ${error.message}`;
  if (error.code === "23505") {
    return "There is already an override for that lesson on that date. Edit or delete it instead.";
  }
  return error.message ?? "Unknown database error.";
}

// ── recurring rules ─────────────────────────────────────────────────────────

export async function createRule(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readRuleForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { error } = await createAdminClient().from("cohort_schedules").insert({
    cohort_id: v.cohortId, weekday: v.weekday,
    start_time: v.startTime, end_time: v.endTime, timezone: v.timezone,
    valid_from: v.validFrom, valid_until: v.validUntil,
    label: v.label, is_active: v.isActive,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

export async function setRuleActive(id: string, isActive: boolean): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing rule id." };
  const { error } = await createAdminClient()
    .from("cohort_schedules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

/**
 * ⚠ DELETING A RULE CASCADES TO ITS OVERRIDES (0044's FK). That is correct —
 * an override of a rule that no longer exists is an orphan the reader could
 * never place — but it means "delete Tuesday" also discards every individual
 * Tuesday edit. The UI asks twice and says so.
 */
export async function deleteRule(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing rule id." };
  const { error } = await createAdminClient().from("cohort_schedules").delete().eq("id", id);
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

// ── holidays and breaks ─────────────────────────────────────────────────────

export async function createPeriod(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readPeriodForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await createAdminClient().from("schedule_periods").insert({
    cohort_id: v.cohortId, starts_on: v.startsOn, ends_on: v.endsOn, reason: v.reason,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

export async function deletePeriod(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing period id." };
  const { error } = await createAdminClient().from("schedule_periods").delete().eq("id", id);
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

// ── overrides and one-offs ──────────────────────────────────────────────────

export async function createSession(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readSessionForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { error } = await createAdminClient().from("tuition_sessions").insert({
    cohort_id: v.cohortId, schedule_id: v.scheduleId, occurs_on: v.occursOn,
    status: v.status, kind: v.kind, title: v.title,
    starts_at: v.startsAtISO, ends_at: v.endsAtISO,
    timezone: v.timezone, note: v.note,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

/**
 * ⚠ DELETING AN OVERRIDE RESTORES THE RULE'S LESSON — it does not delete a
 * lesson. Removing a cancellation puts the class back on the timetable, which
 * is exactly what "undo this cancellation" should mean and is worth saying on
 * the button rather than leaving an admin to discover it.
 */
export async function deleteSession(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing session id." };
  const { error } = await createAdminClient().from("tuition_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}
