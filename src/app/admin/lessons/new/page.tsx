import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { LessonForm } from "../_form";

export const metadata = { title: "New lesson · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function NewLessonPage() {
  const supabase = createAdminClient();
  const [
    { data: courses = [] },
    { data: units = [] },
    { data: topics = [] },
    { data: specPoints = [] },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, level, slug")
      .order("sort_order"),
    supabase
      .from("units")
      .select("id, course_id, name, code, slug")
      .order("sort_order"),
    supabase
      .from("topics")
      .select("id, course_id, unit_id, name, code, slug")
      .order("sort_order"),
    supabase
      .from("spec_points")
      .select("id, topic_id, code, title")
      .order("sort_order")
      .limit(2000),
  ]);

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/lessons" className="text-slate-600 hover:underline">
          ← Lessons
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium">New lesson</h1>
      <div className="mt-6">
        <LessonForm
          mode="create"
          initial={null}
          courses={(courses ?? []).map((c) => ({
            id: c.id,
            label: `${c.name} (${c.level})`,
          }))}
          units={(units ?? []).map((u) => ({
            id: u.id,
            label: u.code ? `${u.code} · ${u.name}` : u.name,
            parentId: u.course_id,
          }))}
          topics={(topics ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code ?? null,
            course_id: t.course_id,
          }))}
          specPoints={(specPoints ?? []).map((s) => ({
            id: s.id,
            code: s.code,
            title: s.title,
            topic_id: s.topic_id,
          }))}
        />
      </div>
    </div>
  );
}
