/**
 * Deletes ONE lesson_family_status row by the EXPLICIT key passed as argv —
 * verification-probe cleanup only (no default target, ever). Prints the row
 * before deleting so what was removed is on the record.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const key = process.argv[2];
if (!key || !/^[a-z0-9-]{3,80}$/.test(key)) {
  console.error("usage: family-status-row-delete <family_key> — explicit key required");
  process.exit(1);
}
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: row } = await svc.from("lesson_family_status").select("family_key, status").eq("family_key", key).maybeSingle();
if (!row) { console.log(`no row for ${key} — nothing to delete`); process.exit(0); }
console.log(`deleting: ${row.family_key} · ${row.status}`);
const { error } = await svc.from("lesson_family_status").delete().eq("family_key", key);
console.log(error ? `⚠ delete failed: ${error.message}` : "deleted");
