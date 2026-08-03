"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Save one piece of page copy.
 *
 * assertAdmin() is the FIRST statement — this action is directly invocable by
 * anyone who can discover its id, so the edit-mode cookie and the server-side
 * render gate are irrelevant to authorisation. This check is the only thing
 * standing between a visitor and the site's copy.
 */
export async function saveCopy(
  key: string,
  value: string,
): Promise<{ error?: string }> {
  try {
    await assertAdmin();

    const cleanKey = key.trim();
    if (!cleanKey) return { error: "Missing copy key" };
    // Guard against a runaway contentEditable paste.
    if (value.length > 5000) return { error: "Copy is too long (max 5000 chars)" };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("site_copy")
      .upsert({ key: cleanKey, value }, { onConflict: "key" });

    if (error) {
      // Most likely cause: migration 0010 has not been applied yet.
      return { error: error.message };
    }

    // Copy can appear on any route, so bust the whole tree.
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/**
 * Revert a key to its hardcoded JSX default by deleting the override row.
 */
export async function resetCopy(key: string): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase.from("site_copy").delete().eq("key", key);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
