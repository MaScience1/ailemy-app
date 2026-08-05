import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadPaperFormOptions as sharedLoadPaperFormOptions } from "./paper-form-options";
import { getEditContext } from "./edit-mode";
import type { LessonInitial } from "@/app/admin/lessons/_form";
import type { PaperInitial } from "@/app/admin/past-papers/_form";

/**
 * Server-side data loading for the inline editors.
 *
 * These are plain server functions, NOT server actions — they are not
 * remotely invocable, so the attack surface is the page that calls them.
 * Even so each one re-checks getEditContext() and returns empty data for a
 * non-admin, so a page that forgets its own guard leaks nothing.
 *
 * Everything here is only ever reached when the admin has edit mode ON, so
 * the query cost never lands on a student request.
 */

export type LessonFormOptions = {
  courses: { id: string; label: string }[];
  units: { id: string; label: string; parentId: string | null }[];
  topics: { id: string; name: string; code: string | null; course_id: string }[];
  specPoints: { id: string; code: string; title: string; topic_id: string }[];
};

export type PaperFormOptions = {
  courses: { id: string; label: string }[];
  units: { id: string; label: string; parentId: string }[];
  /** Set when the lists could not be loaded (e.g. missing service-role key). */
  error: string | null;
};

const EMPTY_LESSON_OPTIONS: LessonFormOptions = {
  courses: [],
  units: [],
  topics: [],
  specPoints: [],
};

/** Shared option lists for the lesson form. Cached per request. */
export const loadLessonFormOptions = cache(
  async (): Promise<LessonFormOptions> => {
    const { isAdmin } = await getEditContext();
    if (!isAdmin) return EMPTY_LESSON_OPTIONS;

    const supabase = createAdminClient();
    const [
      { data: courses },
      { data: units },
      { data: topics },
      { data: specPoints },
    ] = await Promise.all([
      supabase.from("courses").select("id, name, level").order("sort_order"),
      supabase.from("units").select("id, course_id, name, code").order("sort_order"),
      supabase
        .from("topics")
        .select("id, course_id, unit_id, name, code")
        .order("sort_order"),
      supabase
        .from("spec_points")
        .select("id, topic_id, code, title")
        .order("sort_order")
        .limit(2000),
    ]);

    return {
      courses: (courses ?? []).map((c) => ({
        id: c.id as string,
        label: `${c.name} (${c.level})`,
      })),
      units: (units ?? []).map((u) => ({
        id: u.id as string,
        label: (u.code ? `${u.code} · ${u.name}` : u.name) as string,
        parentId: (u.course_id as string) ?? null,
      })),
      topics: (topics ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        code: (t.code as string) ?? null,
        course_id: t.course_id as string,
      })),
      specPoints: (specPoints ?? []).map((s) => ({
        id: s.id as string,
        code: s.code as string,
        title: s.title as string,
        topic_id: s.topic_id as string,
      })),
    };
  },
);

/** Full lesson rows keyed by id, shaped for <LessonForm initial={...}>. */
export async function loadLessonRows(
  ids: string[],
): Promise<Record<string, LessonInitial>> {
  const { isAdmin } = await getEditContext();
  if (!isAdmin || ids.length === 0) return {};

  const supabase = createAdminClient();
  const [{ data: lessons }, { data: links }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, title, slug, description, status, access, course_id, unit_id, lesson_number, sort_order, voice_video_mux_id, worksheet_video_mux_id, animated_video_mux_id, deck_path, thumbnail_path",
      )
      .in("id", ids),
    supabase
      .from("lesson_spec_points")
      .select("lesson_id, spec_point_id")
      .in("lesson_id", ids),
  ]);

  const specByLesson = new Map<string, string[]>();
  for (const l of links ?? []) {
    const key = l.lesson_id as string;
    if (!specByLesson.has(key)) specByLesson.set(key, []);
    specByLesson.get(key)!.push(l.spec_point_id as string);
  }

  const out: Record<string, LessonInitial> = {};
  for (const l of lessons ?? []) {
    out[l.id as string] = {
      id: l.id as string,
      title: l.title as string,
      slug: l.slug as string,
      description: (l.description as string) ?? null,
      status: (l.status as string) ?? "draft",
      access: (l.access as string) ?? "paid",
      course_id: (l.course_id as string) ?? null,
      unit_id: (l.unit_id as string) ?? null,
      lesson_number: (l.lesson_number as number) ?? null,
      sort_order: (l.sort_order as number) ?? null,
      voice_video_mux_id: (l.voice_video_mux_id as string) ?? null,
      worksheet_video_mux_id: (l.worksheet_video_mux_id as string) ?? null,
      animated_video_mux_id: (l.animated_video_mux_id as string) ?? null,
      deck_path: (l.deck_path as string) ?? null,
      thumbnail_path: (l.thumbnail_path as string) ?? null,
      spec_point_ids: specByLesson.get(l.id as string) ?? [],
    };
  }
  return out;
}

/** Shared option lists for the past-paper form. Cached per request. */
export const loadPaperFormOptions = cache(async (): Promise<PaperFormOptions> => {
  const { isAdmin } = await getEditContext();
  if (!isAdmin) return { courses: [], units: [], error: null };
  // Delegates to the shared loader so every past-paper form surface reports a
  // credentials failure the same way instead of silently showing no courses.
  return sharedLoadPaperFormOptions();
});

/** Full past-paper rows keyed by id, shaped for <PastPaperForm initial={...}>. */
export async function loadPaperRows(
  ids: string[],
): Promise<Record<string, PaperInitial>> {
  const { isAdmin } = await getEditContext();
  if (!isAdmin || ids.length === 0) return {};

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("past_papers")
    .select(
      // examiner_report_pdf_path, duration_minutes and total_marks are NOT
        // optional here. The inline editor renders the same PastPaperForm as
        // /admin, and that form now submits every field it was given — so a
        // column missing from this projection arrives empty and is written
        // back as null, silently wiping it on save.
        "id, course_id, unit_id, slug, year, session, paper_code, paper_name, paper_pdf_path, markscheme_pdf_path, examiner_report_pdf_path, duration_minutes, total_marks, walkthrough_mux_playback_id, walkthrough_duration_minutes, sort_order, status",
    )
    .in("id", ids);

  const out: Record<string, PaperInitial> = {};
  for (const p of data ?? []) {
    out[p.id as string] = p as unknown as PaperInitial;
  }
  return out;
}

/** Blank lesson prefilled with the surrounding course/unit context. */
export function blankLesson(
  courseId: string | null,
  unitId: string | null,
): LessonInitial {
  return {
    id: "",
    title: "",
    slug: "",
    description: null,
    status: "draft",
    access: "paid",
    course_id: courseId,
    unit_id: unitId,
    lesson_number: null,
    sort_order: 0,
    voice_video_mux_id: null,
    worksheet_video_mux_id: null,
    animated_video_mux_id: null,
    deck_path: null,
    thumbnail_path: null,
    spec_point_ids: [],
  };
}

/** Blank past paper prefilled with the surrounding course/unit context. */
export function blankPaper(
  courseId: string,
  unitId: string | null,
): PaperInitial {
  return {
    id: "",
    course_id: courseId,
    unit_id: unitId,
    slug: "",
    year: new Date().getFullYear(),
    session: "",
    paper_code: null,
    paper_name: "",
    paper_pdf_path: null,
    markscheme_pdf_path: null,
    walkthrough_mux_playback_id: null,
    walkthrough_duration_minutes: null,
    sort_order: 0,
    status: "live",
  };
}
