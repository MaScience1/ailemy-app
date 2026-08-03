"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createPastPaper, updatePastPaper } from "./actions";

type CourseOption = { id: string; label: string };
type UnitOption = { id: string; label: string; parentId: string };

type PaperInitial = {
  id: string;
  course_id: string;
  unit_id: string | null;
  slug: string;
  year: number;
  session: string;
  paper_code: string | null;
  paper_name: string;
  paper_pdf_path: string | null;
  markscheme_pdf_path: string | null;
  walkthrough_mux_playback_id: string | null;
  walkthrough_duration_minutes: number | null;
  sort_order: number | null;
  status: string;
};

export function PastPaperForm({
  mode,
  initial,
  courses,
  units,
}: {
  mode: "create" | "edit";
  initial: PaperInitial | null;
  courses: CourseOption[];
  units: UnitOption[];
}) {
  const router = useRouter();

  const boundAction =
    mode === "create"
      ? createPastPaper
      : (prev: unknown, fd: FormData) =>
          updatePastPaper(initial!.id, prev as never, fd);

  const [state, formAction, isPending] = useActionState(
    boundAction as never,
    null,
  );

  if (state && (state as { ok?: boolean }).ok) {
    if (mode === "create") {
      const created = state as { ok: true; data?: { id: string } };
      const id = created.data?.id;
      if (id) router.push(`/admin/past-papers/${id}`);
    } else {
      router.refresh();
    }
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" required>
          <select
            name="course_id"
            defaultValue={initial?.course_id ?? ""}
            required
            className={INPUT}
          >
            <option value="">— select course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit" hint="optional">
          <select
            name="unit_id"
            defaultValue={initial?.unit_id ?? ""}
            className={INPUT}
          >
            <option value="">— none —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paper name" hint="displayed to students" required>
          <input
            name="paper_name"
            defaultValue={initial?.paper_name ?? ""}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Slug" hint="unique within course" required>
          <input
            name="slug"
            defaultValue={initial?.slug ?? ""}
            required
            pattern="[a-z0-9-]+"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Session" hint="January, May-June…" required>
          <input
            name="session"
            defaultValue={initial?.session ?? ""}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Year" required>
          <input
            name="year"
            type="number"
            min={1900}
            max={2200}
            defaultValue={initial?.year ?? new Date().getFullYear()}
            required
            className={INPUT}
          />
        </Field>
        <Field label="Paper code" hint="e.g. WCH11/01">
          <input
            name="paper_code"
            defaultValue={initial?.paper_code ?? ""}
            className={INPUT}
          />
        </Field>
      </div>

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          PDFs (public bucket)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Question paper PDF"
            hint={
              initial?.paper_pdf_path
                ? `current: ${initial.paper_pdf_path}`
                : "no file"
            }
          >
            <input
              name="paper_file"
              type="file"
              accept="application/pdf"
              className="text-sm"
            />
          </Field>
          <Field
            label="Mark scheme PDF"
            hint={
              initial?.markscheme_pdf_path
                ? `current: ${initial.markscheme_pdf_path}`
                : "no file"
            }
          >
            <input
              name="markscheme_file"
              type="file"
              accept="application/pdf"
              className="text-sm"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Leave a field empty to keep the current file. Both slots live in the
          public <code className="mx-1 rounded bg-slate-100 px-1">papers</code>
          bucket; URLs are constructed directly by the /past-papers pages.
        </p>
      </fieldset>

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Walkthrough
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mux playback ID">
            <input
              name="walkthrough_mux_playback_id"
              defaultValue={initial?.walkthrough_mux_playback_id ?? ""}
              className={INPUT}
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              name="walkthrough_duration_minutes"
              type="number"
              defaultValue={initial?.walkthrough_duration_minutes ?? ""}
              className={INPUT}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select
            name="status"
            defaultValue={initial?.status ?? "live"}
            className={INPUT}
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="in_progress">in_progress</option>
            <option value="coming_soon">coming_soon</option>
            <option value="archived">archived</option>
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
              ? "Create past paper"
              : "Save changes"}
        </button>
        <Link
          href="/admin/past-papers"
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
