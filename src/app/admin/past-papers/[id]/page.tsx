import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { PastPaperForm } from "../_form";

export const metadata = { title: "Edit past paper · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function EditPastPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [
    { data: paper, error },
    { data: courses = [] },
    { data: units = [] },
    { data: subjects = [] },
    { data: curricula = [] },
  ] = await Promise.all([
    supabase
      .from("past_papers")
      // select("*") rather than an explicit column list: this row feeds PastPaperForm,
      // and "*" keeps working whether or not migration 0012 has been applied.
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("courses")
      .select("id, name, level, subject_id, curriculum_id")
      .order("sort_order"),
    supabase.from("units").select("id, course_id, name, code").order("sort_order"),
    supabase.from("subjects").select("id, name"),
    supabase.from("curricula").select("id, short_name, name"),
  ]);

  if (error || !paper) return notFound();

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
      <h1 className="mt-2 font-display text-3xl font-medium">
        Edit past paper{" "}
        <span className="font-mono text-sm text-slate-500">
          {paper.id.slice(0, 8)}
        </span>
      </h1>
      <div className="mt-6">
        <PastPaperForm
          mode="edit"
          initial={paper}
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
