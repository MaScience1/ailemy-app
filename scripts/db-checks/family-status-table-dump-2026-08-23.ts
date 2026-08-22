/** READ-ONLY: full contents of lesson_family_status, right now. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await svc
  .from("lesson_family_status")
  .select("family_key, status, updated_at")
  .order("updated_at", { ascending: false });
if (error) { console.error("read failed:", error.code, error.message); process.exit(1); }
console.log(`lesson_family_status: ${data?.length ?? 0} row(s)`);
for (const r of data ?? []) console.log(`  ${r.family_key} · ${r.status} · ${r.updated_at}`);
