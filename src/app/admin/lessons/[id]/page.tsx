import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { LessonForm } from "../_form";

export const metadata = { title: "Edit lesson · Admin · Ailemy" };
export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [
    { data: lesson, error },
    { data: courses = [] },
    { data: units = [] },
    { data: topics = [] },
    { data: specPoints = [] },
    { data: links = [] },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, title, slug, description, status, access, course_id, unit_id, lesson_number, sort_order, voice_video_mux_id, worksheet_video_mux_id, animated_video_mux_id, deck_path, thumbnail_path",
      )
      .eq("id", id)
      .single(),
    supabase.from("courses").select("id, name, level, slug").order("sort_order"),
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
    supabase.from("lesson_spec_points").select("spec_point_id").eq("lesson_id", id),
  ]);

  if (error || !lesson) return notFound();

  const specPointIds = (links ?? []).map((l) => l.spec_point_id as string);

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/lessons" className="text-slate-600 hover:underline">
          ← Lessons
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium">
        Edit lesson{" "}
        <span className="font-mono text-sm text-slate-500">
          {lesson.id.slice(0, 8)}
        </span>
      </h1>
      <div className="mt-6">
        <LessonForm
          mode="edit"
          initial={{
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            description: lesson.description,
            status: lesson.status,
            access: lesson.access ?? "paid",
            course_id: lesson.course_id,
            unit_id: lesson.unit_id,
            lesson_number: lesson.lesson_number,
            sort_order: lesson.sort_order,
            voice_video_mux_id: lesson.voice_video_mux_id,
            worksheet_video_mux_id: lesson.worksheet_video_mux_id,
            animated_video_mux_id: lesson.animated_video_mux_id,
            deck_path: lesson.deck_path,
            thumbnail_path: lesson.thumbnail_path,
            spec_point_ids: specPointIds,
          }}
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
