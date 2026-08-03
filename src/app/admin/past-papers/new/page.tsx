import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { PastPaperForm } from "../_form";

export const metadata = { title: "New past paper · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function NewPastPaperPage() {
  const supabase = createAdminClient();
  const [
    { data: courses = [] },
    { data: units = [] },
    { data: subjects = [] },
    { data: curricula = [] },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, level, subject_id, curriculum_id")
      .order("sort_order"),
    supabase
      .from("units")
      .select("id, course_id, name, code")
      .order("sort_order"),
    supabase.from("subjects").select("id, name"),
    supabase.from("curricula").select("id, short_name, name"),
  ]);

  const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const currName = new Map(
    (curricula ?? []).map((c) => [c.id, c.short_name || c.name]),
  );

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/past-papers" className="text-slate-600 hover:underline">
          ← Past papers
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium">New past paper</h1>
      <div className="mt-6">
        <PastPaperForm
          mode="create"
          initial={null}
          courses={(courses ?? []).map((c) => ({
            id: c.id,
            label: `${currName.get(c.curriculum_id) ?? "?"} · ${subjectName.get(c.subject_id) ?? "?"} · ${c.name} (${c.level})`,
          }))}
          units={(units ?? []).map((u) => ({
            id: u.id,
            label: u.code ? `${u.code} · ${u.name}` : u.name,
            parentId: u.course_id,
          }))}
        />
      </div>
    </div>
  );
}
