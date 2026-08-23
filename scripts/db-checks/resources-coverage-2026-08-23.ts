/** READ-ONLY: what the Resources Hub can honestly show today. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = new Map<string,string>();
for (const line of readFileSync(".env.local","utf8").split("\n")) { const i=line.indexOf("="); if(i<0||line.trim().startsWith("#"))continue; env.set(line.slice(0,i).trim(), line.slice(i+1).trim().replace(/^"|"$/g,"")); }
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth:{persistSession:false,autoRefreshToken:false} });
const anon = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!, { auth:{persistSession:false} });

const { data: course } = await svc.from("courses").select("id, name").eq("slug","edexcel-ial-as-chemistry").single();
console.log(`course: ${course!.name}\n`);
for (const [t, col] of [["units","course_id"],["topics","course_id"],["lessons","course_id"],["past_papers","course_id"]] as const) {
  const { data, error } = await svc.from(t).select("id").eq(col, course!.id);
  console.log(`  ${t.padEnd(13)} ${error ? "ERR "+error.code : (data?.length ?? 0)}`);
}
const { data: sp } = await svc.from("spec_points").select("id").limit(2000);
console.log(`  spec_points   ${sp?.length ?? 0} (all courses)`);
const { data: lsp } = await svc.from("lesson_spec_points").select("lesson_id").limit(3000);
console.log(`  lesson_spec_points ${lsp?.length ?? 0}`);
// ⚠ THE ERROR IS CHECKED, AND THIS LINE IS WHY. The first version of this
// script selected a `topic_id` column that does not exist on `lessons`;
// PostgREST answered 42703, the destructure ignored it, and `(lessons ?? [])`
// turned a schema error into "0 live lessons, 0 mapped to topics" — a
// confident, wrong answer about production content. A failed read must never
// render as empty data, in a diagnostic least of all.
const { data: lessons, error: lessonErr } = await svc
  .from("lessons").select("id, unit_id, status").eq("course_id", course!.id);
if (lessonErr) throw new Error(`lessons read failed: ${lessonErr.code} ${lessonErr.message}`);
const withUnit = (lessons ?? []).filter(l => l.unit_id).length;
console.log(`  lessons with unit_id: ${withUnit} of ${lessons!.length} · live: ${lessons!.filter(l=>l.status==="live").length}`);
console.log(`  ⚠ lessons has NO topic_id column — topics attach via spec_points.topic_id`);
console.log("\n── what ANON can read (the only thing a public page may derive from) ──");
for (const t of ["units","topics","lessons","past_papers","spec_points","paper_questions","question_spec_points"]) {
  const { data, error } = await anon.from(t).select("id").limit(1);
  console.log(`  ${t.padEnd(20)} ${error ? "REFUSED "+error.code : "ok"}`);
}

console.log("\n── topics and units that exist ──");
const { data: units } = await svc.from("units").select("id, code, name, status, sort_order").eq("course_id", course!.id).order("sort_order");
for (const u of units ?? []) console.log(`  unit  ${String(u.code).padEnd(10)} ${u.name} [${u.status}]`);
const { data: topics } = await svc.from("topics").select("id, code, name, status, unit_id").eq("course_id", course!.id);
for (const t of topics ?? []) console.log(`  topic ${String(t.code ?? "-").padEnd(10)} ${t.name} [${t.status}] unit=${t.unit_id ? "yes" : "NULL"}`);
const { data: live, error: liveErr } = await svc.from("lessons").select("id, slug, status, unit_id").eq("course_id", course!.id).eq("status","live");
if (liveErr) throw new Error(`live lessons read failed: ${liveErr.code} ${liveErr.message}`);
console.log(`\n  LIVE lessons: ${live?.length ?? 0}`);
for (const l of live ?? []) console.log(`    ${l.slug} unit=${l.unit_id ?? "NULL"}`);
const { data: sp2 } = await svc.from("spec_points").select("id, code, title, topic_id");
console.log(`\n  spec_points (${sp2?.length}):`);
for (const s of (sp2 ?? []).slice(0,6)) console.log(`    ${String(s.code).padEnd(6)} ${String(s.title).slice(0,50)}`);
