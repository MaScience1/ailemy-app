"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";
import {
  PastPaperForm,
  type PaperInitial,
} from "@/app/admin/past-papers/_form";
import { deletePastPaper } from "@/app/admin/past-papers/actions";

type CourseOption = { id: string; label: string };
type UnitOption = { id: string; label: string; parentId: string };

/**
 * Admin affordances for the past-paper browser.
 *
 * Everything here REUSES the existing admin building blocks — PastPaperForm,
 * DeleteConfirm, and the assertAdmin()-guarded create/update/delete actions.
 * No write path is defined in this file; it only opens the existing form and
 * calls the existing actions.
 *
 * Rendered only by a server component that has already confirmed the viewer is
 * the admin, so students never receive this markup.
 */

function SlideOver({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9998] flex justify-end"
    >
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}

/** "+ Add past paper" — opens the existing admin form in create mode. */
export function AddPaperButton({
  courses,
  units,
}: {
  courses: CourseOption[];
  units: UnitOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-medium text-parchment transition hover:bg-ink/90"
      >
        + Add past paper
      </button>
      {open && (
        <SlideOver title="New past paper" onClose={() => setOpen(false)}>
          <PastPaperForm
            mode="create"
            initial={null}
            courses={courses}
            units={units}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
            redirectAfterCreate={false}
            showCancel={false}
          />
        </SlideOver>
      )}
    </>
  );
}

/** Per-row Edit + Delete. Both terminate in the existing admin actions. */
export function PaperRowControls({
  paper,
  courses,
  units,
}: {
  paper: PaperInitial;
  courses: CourseOption[];
  units: UnitOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Edit ${paper.paper_name}`}
        className="rounded border border-ink/20 bg-snow px-2 py-1 text-xs font-medium text-ink transition hover:bg-parchment"
      >
        ✎ Edit
      </button>
      <DeleteConfirm
        small
        entityLabel="past paper"
        confirmText={paper.paper_name}
        action={deletePastPaper.bind(null, paper.id)}
      />
      {open && (
        <SlideOver
          title={`Edit ${paper.paper_name}`}
          onClose={() => setOpen(false)}
        >
          <PastPaperForm
            mode="edit"
            initial={paper}
            courses={courses}
            units={units}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
            redirectAfterCreate={false}
            showCancel={false}
          />
        </SlideOver>
      )}
    </div>
  );
}
