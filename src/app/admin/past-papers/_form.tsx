"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createPastPaper, updatePastPaper } from "./actions";

type CourseOption = { id: string; label: string };
type UnitOption = { id: string; label: string; parentId: string };

export type PaperInitial = {
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
  /** Optional: absent until migration 0012 is applied. */
  examiner_report_pdf_path?: string | null;
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
  onDone,
  redirectAfterCreate = true,
  showCancel = true,
  optionsError = null,
}: {
  mode: "create" | "edit";
  initial: PaperInitial | null;
  courses: CourseOption[];
  units: UnitOption[];
  /** Called after a successful save — lets a slide-over close itself. */
  onDone?: () => void;
  /** /admin/past-papers/new navigates after create; a slide-over does not. */
  redirectAfterCreate?: boolean;
  /** The slide-over provides its own close affordance. */
  showCancel?: boolean;
  /**
   * Set when the course/unit option lists could not be loaded. Rendered as a
   * banner and blocks submission — an empty Course dropdown otherwise looks
   * like "no courses exist" rather than "the admin client is misconfigured".
   */
  optionsError?: string | null;
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

  // Post-save navigation belongs in an effect, not the render body: calling
  // router.push()/refresh() while rendering re-enters React's render phase and
  // loops when this form is mounted inside a long-lived slide-over.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!state || !(state as { ok?: boolean }).ok) return;
    if (mode === "create" && redirectAfterCreate) {
      const id = (state as { ok: true; data?: { id: string } }).data?.id;
      if (id) {
        router.push(`/admin/past-papers/${id}`);
        return;
      }
    }
    router.refresh();
    onDoneRef.current?.();
  }, [state, mode, redirectAfterCreate, router]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {optionsError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-semibold">{optionsError}</p>
          <p className="mt-1 text-red-800">
            The catalogue itself is fine, so this is a credentials problem, not
            missing data. Saving is disabled until the courses list loads.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" required>
          <select
            name="course_id"
            defaultValue={initial?.course_id ?? ""}
            required
            className={INPUT}
          >
            <option value="">
              {optionsError ? "— unavailable —" : "— select course —"}
            </option>
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
        <div className="grid gap-3 sm:grid-cols-3">
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
          <Field
            label="Examiner report PDF"
            hint={
              initial?.examiner_report_pdf_path
                ? `current: ${initial.examiner_report_pdf_path}`
                : "no file"
            }
          >
            <input
              name="examiner_report_file"
              type="file"
              accept="application/pdf"
              className="text-sm"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Leave a field empty to keep the current file. All three slots live in the
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
          disabled={isPending || Boolean(optionsError)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create past paper"
              : "Save changes"}
        </button>
        {showCancel && (
          <Link
            href="/admin/past-papers"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        )}
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
