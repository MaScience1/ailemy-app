/** READ-ONLY: what "Lesson N of M" is counting, and whether M is honest. */
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

const { data: course } = await svc
  .from("courses").select("id, name, slug").eq("slug", "edexcel-ial-as-chemistry").single();
if (!course) { console.error("course not found"); process.exit(1); }

const { data: all } = await svc
  .from("lessons").select("slug, status, lesson_number").eq("course_id", course.id)
  .order("lesson_number", { ascending: true });

const rows = all ?? [];
const byStatus = new Map<string, number>();
for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);

console.log(`${course.name} (${course.slug})`);
console.log(`  rows total:      ${rows.length}`);
for (const [s, n] of [...byStatus].sort()) console.log(`    ${s.padEnd(12)} ${n}`);
console.log(`  non-archived:    ${rows.filter((r) => r.status !== "archived").length}  ← what "of M" shows`);
console.log(`  live only:       ${rows.filter((r) => r.status === "live").length}`);
