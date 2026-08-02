"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createLesson, updateLesson } from "./actions";

type Option = { id: string; label: string; parentId?: string | null };
type SpecPointRow = { id: string; code: string; title: string; topic_id: string };
type TopicRow = { id: string; name: string; code: string | null; course_id: string };

type LessonInitial = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  access: string;
  course_id: string | null;
  unit_id: string | null;
  lesson_number: number | null;
  sort_order: number | null;
  voice_video_mux_id: string | null;
  worksheet_video_mux_id: string | null;
  animated_video_mux_id: string | null;
  deck_path: string | null;
  thumbnail_path: string | null;
  spec_point_ids: string[];
};

export function LessonForm({
  mode,
  initial,
  courses,
  units,
  topics,
  specPoints,
}: {
  mode: "create" | "edit";
  initial: LessonInitial | null;
  courses: Option[];
  units: (Option & { parentId: string | null })[];
  topics: TopicRow[];
  specPoints: SpecPointRow[];
}) {
  const router = useRouter();

  // Cascading picker state
  const [courseId, setCourseId] = useState<string>(initial?.course_id ?? "");
  const [unitId, setUnitId] = useState<string>(initial?.unit_id ?? "");

  const boundAction =
    mode === "create"
      ? createLesson
      : (prev: unknown, fd: FormData) => updateLesson(initial!.id, prev as never, fd);

  const [state, formAction, isPending] = useActionState(
    boundAction as never,
    null,
  );

  // Refresh + navigate on success
  if (state && (state as { ok?: boolean }).ok) {
    if (mode === "create") {
      const created = state as { ok: true; data?: { id: string } };
      const id = created.data?.id;
      if (id) {
        router.push(`/admin/lessons/${id}`);
      }
    } else {
      router.refresh();
    }
  }

  const filteredUnits = units.filter((u) => !courseId || u.parentId === courseId);
  const filteredTopics = topics.filter((t) => !courseId || t.course_id === courseId);

  const specPointsByTopic = new Map<string, SpecPointRow[]>();
  for (const sp of specPoints) {
    if (!specPointsByTopic.has(sp.topic_id)) specPointsByTopic.set(sp.topic_id, []);
    specPointsByTopic.get(sp.topic_id)!.push(sp);
  }
  const initialSpecPointIds = new Set(initial?.spec_point_ids ?? []);
  const visibleTopics = filteredTopics.filter((t) => specPointsByTopic.has(t.id));

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {/* Title + slug */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required>
          <input
            name="title"
            defaultValue={initial?.title ?? ""}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Slug" hint="lowercase, hyphens only" required>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            required
            pattern="[a-z0-9-]+"
            className={INPUT}
          />
        </Field>
      </div>

      {/* Description */}
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
          className={INPUT + " min-h-[80px]"}
        />
      </Field>

      {/* Status + access + order */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status">
          <select
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className={INPUT}
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="in_progress">in_progress</option>
            <option value="coming_soon">coming_soon</option>
            <option value="archived">archived</option>
          </select>
        </Field>
        <Field label="Access">
          <select
            name="access"
            defaultValue={initial?.access ?? "paid"}
            className={INPUT}
          >
            <option value="paid">paid</option>
            <option value="free">free</option>
          </select>
        </Field>
        <Field label="Order index">
          <input
            name="sort_order"
            type="number"
            defaultValue={initial?.sort_order ?? 0}
            className={INPUT}
          />
        </Field>
      </div>

      {/* Course / unit / lesson number */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Course">
          <select
            name="course_id"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setUnitId("");
            }}
            className={INPUT}
          >
            <option value="">— none —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit">
          <select
            name="unit_id"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={!courseId}
            className={INPUT}
          >
            <option value="">— none —</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lesson number">
          <input
            name="lesson_number"
            type="number"
            defaultValue={initial?.lesson_number ?? ""}
            className={INPUT}
          />
        </Field>
      </div>

      {/* Mux */}
      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Mux playback IDs
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Voice/video">
            <input
              name="voice_video_mux_id"
              defaultValue={initial?.voice_video_mux_id ?? ""}
              className={INPUT}
            />
          </Field>
          <Field label="Worksheet video">
            <input
              name="worksheet_video_mux_id"
              defaultValue={initial?.worksheet_video_mux_id ?? ""}
              className={INPUT}
            />
          </Field>
          <Field label="Animated video">
            <input
              name="animated_video_mux_id"
              defaultValue={initial?.animated_video_mux_id ?? ""}
              className={INPUT}
            />
          </Field>
        </div>
      </fieldset>

      {/* File uploads */}
      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Assets (private bucket)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Deck (.pptx/.pdf)"
            hint={initial?.deck_path ? `current: ${initial.deck_path}` : "no file"}
          >
            <input name="deck_file" type="file" className="text-sm" />
          </Field>
          <Field
            label="Thumbnail (image)"
            hint={initial?.thumbnail_path ? `current: ${initial.thumbnail_path}` : "no file"}
          >
            <input
              name="thumbnail_file"
              type="file"
              accept="image/*"
              className="text-sm"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Leave empty to keep the existing file. Uploads go to the private
          <code className="mx-1 rounded bg-slate-100 px-1">assets</code>
          bucket and are served via signed URLs.
        </p>
      </fieldset>

      {/* Spec points */}
      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Spec points {courseId ? "" : "(pick a course first)"}
        </legend>
        {visibleTopics.length === 0 ? (
          <p className="text-sm text-slate-500">
            {courseId ? "No spec points found for this course." : "—"}
          </p>
        ) : (
          <div className="space-y-4">
            {visibleTopics.map((topic) => (
              <div key={topic.id}>
                <p className="text-sm font-medium text-slate-800">
                  {topic.code ? `${topic.code} · ` : ""}
                  {topic.name}
                </p>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {(specPointsByTopic.get(topic.id) ?? []).map((sp) => (
                    <label
                      key={sp.id}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        name="spec_point_ids"
                        value={sp.id}
                        defaultChecked={initialSpecPointIds.has(sp.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-mono text-xs text-slate-500">
                          {sp.code}
                        </span>{" "}
                        {sp.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Submit + error */}
      {state && !(state as { ok?: boolean }).ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {(state as { error?: string }).error ?? "Something went wrong"}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create lesson"
              : "Save changes"}
        </button>
        <Link
          href="/admin/lessons"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

const INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
