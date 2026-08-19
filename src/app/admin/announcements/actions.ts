"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { readAnnouncementForm, toRow } from "@/lib/admin/announcement-form";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Announcement editing (spec §5).
 *
 * ⚠ assertAdmin() IS THE FIRST LINE OF EVERY ACTION. The layout gates the page
 * and the proxy gates /admin/*, but a server action is a POST endpoint anything
 * that can guess it may call. A page-level gate is not a gate.
 *
 * ⚠ SERVICE ROLE, BECAUSE 0022 GRANTS CLIENTS NO WRITE. announcements is
 * editorial content written by staff; there is no INSERT/UPDATE grant to
 * authenticated at all, so a session-scoped client would fail on a grant check
 * before RLS ever ran. assertAdmin() above is what stands in for the policy.
 *
 * ⚠ EVERY PATH THE BAR APPEARS ON IS REVALIDATED. The bar is rendered by five
 * routes; revalidating only /admin would leave a switched-off announcement up
 * on the homepage until something else happened to invalidate it.
 */

type Result = { ok: true } | { ok: false; error: string };

// The public surfaces that render <AnnouncementBar />.
const BAR_PATHS = ["/", "/tuition", "/tuition/interest", "/resources", "/chemistry", "/biology", "/physics"];

function refresh() {
  revalidatePath("/admin/announcements");
  for (const p of BAR_PATHS) revalidatePath(p);
}

/** Turn a Postgres failure into something an admin can act on. */
function explain(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return "The announcements table is not reachable. Has migration 0022 been applied?";
  }
  if (error.code === "PGRST204" || error.code === "42703") {
    return `Migration 0039 has not been applied — this screen needs the scheduling columns. (${error.message})`;
  }
  if (error.code === "23514") {
    return `The database refused this: ${error.message}`;
  }
  return error.message ?? "Unknown database error.";
}

export async function createAnnouncement(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();

  const parsed = readAnnouncementForm(fd);
  if (!parsed.ok) return parsed;

  const db = createAdminClient();
  const { error } = await db.from("announcements").insert(toRow(parsed.fields));
  if (error) return { ok: false, error: explain(error) };

  refresh();
  return { ok: true };
}

export async function updateAnnouncement(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();

  const id = String(fd.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing announcement id." };

  const parsed = readAnnouncementForm(fd);
  if (!parsed.ok) return parsed;

  const db = createAdminClient();

  // Read the existing published_at first so a re-save does not restamp it.
  const { data: existing, error: readError } = await db
    .from("announcements")
    .select("id,published_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: explain(readError) };
  if (!existing) return { ok: false, error: "That announcement no longer exists." };

  const { error } = await db
    .from("announcements")
    .update(toRow(parsed.fields, (existing as { published_at: string | null }).published_at))
    .eq("id", id);
  if (error) return { ok: false, error: explain(error) };

  refresh();
  return { ok: true };
}

/**
 * The on/off switch, on its own.
 *
 * ⚠ IT CAN ONLY SWITCH THINGS OFF WITHOUT A FULL EDIT. Turning one ON requires
 * status='live' — the same rule the form enforces, repeated because this action
 * does not go through the form. 0039's public policy ignores status, so an
 * enabled draft is publicly visible; this is the second of the two places that
 * can happen, and it is closed here too.
 */
export async function setAnnouncementEnabled(id: string, enabled: boolean): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing announcement id." };

  const db = createAdminClient();

  if (enabled) {
    const { data, error } = await db
      .from("announcements")
      .select("id,status")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: explain(error) };
    if (!data) return { ok: false, error: "That announcement no longer exists." };
    if ((data as { status: string }).status !== "live") {
      return {
        ok: false,
        error:
          "Set the status to Live before switching this on. The public bar does not check " +
          "status, so an enabled draft would be visible to everyone.",
      };
    }
  }

  const { error } = await db
    .from("announcements")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: explain(error) };

  refresh();
  return { ok: true };
}

/**
 * ⚠ DELETES ONE ROW, BY ITS ID. Never a filtered sweep — an announcement is
 * cheap to recreate and impossible to un-delete, and a `.delete()` whose filter
 * is anything other than a primary key is one typo from emptying the table.
 */
export async function deleteAnnouncement(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing announcement id." };

  const db = createAdminClient();
  const { error } = await db.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: explain(error) };

  refresh();
  return { ok: true };
}
