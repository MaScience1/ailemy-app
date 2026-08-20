"use server";

import { revalidatePath } from "next/cache";

import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Marking an in-app message read (§47).
 *
 * ============================================================================
 * ⚠ THROUGH THE SESSION CLIENT, DELIBERATELY — 0053's TWO LAYERS ARE THE POINT
 * ============================================================================
 * This is one of the few writes a student is allowed to make directly, and it
 * is allowed by exactly two things: the policy admits the ROW (their own, and
 * only channel='in_app'), and the column grant admits the COLUMN (read_at, and
 * nothing else). Using the admin client here would bypass both and make the
 * grant that was verified on 2026-08-20 decorative.
 *
 * Observed live: read_at on an in_app row updates 1 row; `status` on the SAME
 * row is refused 42501 by the column grant; read_at on an email row touches 0
 * rows because the policy does not admit it. Two layers, two failure shapes.
 *
 * ⚠ AND IT IS EXPLICIT, NOT AUTOMATIC ON RENDER. Marking everything read
 * because a page loaded takes the unread marker off things nobody read — which
 * is how a student misses the one message that mattered.
 */

type Result = { ok: true } | { ok: false; error: string };

export async function markRead(deliveryId: string): Promise<Result> {
  if (!deliveryId) return { ok: false, error: "Missing message id." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage your updates." };

  const { data, error } = await supabase
    .from("notification_deliveries")
    .update({ read_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .select("id");

  if (error) {
    // ⚠ 42501 HERE WOULD MEAN THE COLUMN GRANT IS WRONG, not that the student
    // did something wrong, so it does not get a "you cannot do that" message.
    return { ok: false, error: `Could not mark that read (${error.code}).` };
  }
  // 0 rows is the policy refusing the row — not their message, or not in_app.
  if ((data ?? []).length === 0) return { ok: false, error: "That update is not on your account." };

  revalidatePath("/profile");
  return { ok: true };
}
