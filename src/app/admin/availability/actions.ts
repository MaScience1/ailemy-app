"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { readAvailabilityForm, readBlockForm } from "@/lib/admin/availability-form";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 1-to-1 availability editing (§23, §24, §46).
 *
 * ⚠ assertAdmin() FIRST, EVERY TIME. A server action is a POST endpoint.
 *
 * ⚠ SERVICE ROLE, BECAUSE 0045 GRANTS CLIENTS SELECT AND NOTHING ELSE. Both
 * tables are publicly readable — availability is when a teacher offers to work,
 * the same category of fact as a group timetable — and writable by nobody
 * through PostgREST. That is deliberate: it means the only way a window can be
 * published is through this file, past assertAdmin().
 *
 * ⚠ AND EVERY EDIT REVALIDATES THE PUBLIC SLOT SURFACES. Availability feeds
 * loadOpenSlots(), which feeds /calendar, /tuition/one-to-one and the subject
 * pages. Revalidating only this screen would leave a withdrawn Tuesday still
 * bookable everywhere a student actually looks.
 */

type Result = { ok: true } | { ok: false; error: string };

const SLOT_PATHS = [
  "/", "/calendar", "/tuition", "/tuition/one-to-one",
  "/chemistry", "/biology", "/physics", "/admin/availability",
];

function refresh() {
  for (const p of SLOT_PATHS) revalidatePath(p);
}

/**
 * ⚠ EVERY CODE HERE IS ONE 0045 CAN ACTUALLY RAISE, and each says what to do.
 * "An error occurred" is the failure this project keeps re-learning: the admin
 * cannot tell a missing migration from a bad number from a lost row.
 */
function explain(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return "Migration 0045 has not been applied — the availability tables do not exist yet.";
  }
  if (error.code === "PGRST204" || error.code === "42703") {
    return `Migration 0045 has not been applied in full. (${error.message})`;
  }
  if (error.code === "23514") return `The database refused this: ${error.message}`;
  if (error.code === "23503") {
    return "That teacher account no longer exists.";
  }
  if (error.code === "22P02") {
    return "One of the values is not the type the column expects — usually a malformed id.";
  }
  return error.message ?? "Unknown database error.";
}

function missing(what: string): Result {
  return { ok: false, error: `That ${what} no longer exists — reload the page.` };
}

// ── availability windows ────────────────────────────────────────────────────

export async function createAvailability(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readAvailabilityForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { error } = await createAdminClient().from("teacher_availability").insert({
    teacher_id: v.teacherId, subject: v.subject,
    weekday: v.weekday, specific_date: v.specificDate,
    start_time: v.startTime, end_time: v.endTime, timezone: v.timezone,
    slot_minutes: v.slotMinutes, buffer_minutes: v.bufferMinutes,
    valid_from: v.validFrom, valid_until: v.validUntil,
    booking_horizon_days: v.bookingHorizonDays,
    booking_cutoff_hours: v.bookingCutoffHours,
    is_active: v.isActive,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

/**
 * ⚠ EDITING A WINDOW DOES NOT MOVE A BOOKING THAT WAS MADE INSIDE IT. 0046's
 * private_bookings rows hold their own start and end; they are not derived from
 * this table at read time. Narrowing Tuesday to 17:00–18:00 therefore stops
 * NEW bookings at 18:00 and leaves an existing 18:00 lesson standing — which is
 * right, because that lesson was agreed, and it is worth saying on screen so an
 * admin does not assume the diary tidied itself.
 */
export async function updateAvailability(id: string, _prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing availability id." };
  const parsed = readAvailabilityForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { data, error } = await createAdminClient()
    .from("teacher_availability")
    .update({
      teacher_id: v.teacherId, subject: v.subject,
      weekday: v.weekday, specific_date: v.specificDate,
      start_time: v.startTime, end_time: v.endTime, timezone: v.timezone,
      slot_minutes: v.slotMinutes, buffer_minutes: v.bufferMinutes,
      valid_from: v.validFrom, valid_until: v.validUntil,
      booking_horizon_days: v.bookingHorizonDays,
      booking_cutoff_hours: v.bookingCutoffHours,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing("availability window");
  refresh();
  return { ok: true };
}

export async function setAvailabilityActive(id: string, isActive: boolean): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing availability id." };
  const { data, error } = await createAdminClient()
    .from("teacher_availability")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing("availability window");
  refresh();
  return { ok: true };
}

/**
 * ⚠ PAUSING IS ALMOST ALWAYS THE RIGHT ACTION, AND THE UI OFFERS IT FIRST.
 * 0045's public policy is `USING (is_active IS TRUE)`, so pausing removes the
 * window from every public surface immediately and keeps its buffers, horizon
 * and cutoff for when it comes back. Deleting is for a window created by
 * mistake.
 */
export async function deleteAvailability(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing availability id." };
  const { data, error } = await createAdminClient()
    .from("teacher_availability").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing("availability window");
  refresh();
  return { ok: true };
}

// ── blocks ──────────────────────────────────────────────────────────────────

export async function createBlock(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readBlockForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { error } = await createAdminClient().from("availability_blocks").insert({
    teacher_id: v.teacherId, starts_at: v.startsAtISO, ends_at: v.endsAtISO, reason: v.reason,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing block id." };
  const { data, error } = await createAdminClient()
    .from("availability_blocks").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing("block");
  refresh();
  return { ok: true };
}
