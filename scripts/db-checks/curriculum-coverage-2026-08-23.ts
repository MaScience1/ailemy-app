/**
 * READ-ONLY: what content each curriculum ACTUALLY has, per subject.
 *
 * ⚠ THIS IS THE HONESTY BASELINE FOR §41. A support status must be DERIVED
 * from these counts, never typed into a config by hand — a hand-typed
 * "Expanding" is exactly the fabricated completeness the brief forbids.
 */
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

const { data: curricula } = await svc.from("curricula").select("id, slug, name, short_name, region").order("sort_order");
const { data: subjects } = await svc.from("subjects").select("id, slug, name");
const { data: courses } = await svc.from("courses").select("id, slug, name, level, status, curriculum_id, subject_id, pathway");
const { data: lessons } = await svc.from("lessons").select("id, course_id, status");
const { data: papers } = await svc.from("past_papers").select("id, course_id").limit(2000);

const subjById = new Map((subjects ?? []).map((s) => [s.id, s]));
const lessonsByCourse = new Map<string, { total: number; live: number }>();
for (const l of lessons ?? []) {
  const e = lessonsByCourse.get(l.course_id) ?? { total: 0, live: 0 };
  e.total++; if (l.status === "live") e.live++;
  lessonsByCourse.set(l.course_id, e);
}
const papersByCourse = new Map<string, number>();
for (const p of papers ?? []) papersByCourse.set(p.course_id, (papersByCourse.get(p.course_id) ?? 0) + 1);

console.log(`curricula: ${curricula?.length} · subjects: ${subjects?.length} · courses: ${courses?.length} · lessons: ${lessons?.length} · past papers: ${papers?.length}\n`);
for (const c of curricula ?? []) {
  const mine = (courses ?? []).filter((x) => x.curriculum_id === c.id);
  const chem = mine.filter((x) => subjById.get(x.subject_id)?.slug === "chemistry");
  const live = chem.reduce((n, x) => n + (lessonsByCourse.get(x.id)?.live ?? 0), 0);
  const tot = chem.reduce((n, x) => n + (lessonsByCourse.get(x.id)?.total ?? 0), 0);
  const pp = chem.reduce((n, x) => n + (papersByCourse.get(x.id) ?? 0), 0);
  console.log(`${c.slug.padEnd(15)} chem courses=${String(chem.length).padStart(2)}  lessons=${String(tot).padStart(3)} (live ${String(live).padStart(3)})  papers=${pp}`);
  for (const x of chem) {
    const lc = lessonsByCourse.get(x.id) ?? { total: 0, live: 0 };
    console.log(`    ${x.slug.padEnd(34)} pathway=${String(x.pathway).padEnd(22)} status=${String(x.status).padEnd(12)} lessons=${lc.total}/${lc.live} live  papers=${papersByCourse.get(x.id) ?? 0}`);
  }
}
