"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";

import { createPage, deletePage, updatePage } from "./page-actions";

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  status: string;
};

/**
 * Slide-over editor for a dynamic page. Plain inputs + a textarea for the
 * markdown body — no WYSIWYG, per spec.
 */
export function PageEditor({
  mode,
  initial,
  onClose,
}: {
  mode: "create" | "edit";
  initial: PageRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const boundAction =
    mode === "create"
      ? createPage
      : (prev: unknown, fd: FormData) => updatePage(initial!.id, prev as never, fd);
  const [state, formAction, isPending] = useActionState(boundAction as never, null);

  useEffect(() => {
    if (!state || !(state as { ok?: boolean }).ok) return;
    const slug = (state as { ok: true; slug?: string }).slug;
    onClose();
    if (mode === "create" && slug) router.push(`/${slug}`);
    else router.refresh();
  }, [state, mode, onClose, router]);

  const err = state && !(state as { ok?: boolean }).ok
    ? (state as { error?: string }).error
    : null;

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="text-xs font-medium text-slate-700">Title *</span>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-700">Slug *</span>
        <input
          name="slug"
          required
          defaultValue={initial?.slug ?? ""}
          placeholder="about  or  pricing/schools"
          className={INPUT}
        />
        <span className="mt-1 block text-[11px] text-slate-500">
          Path after the domain, no leading slash. Cannot start with a reserved
          route (learn, admin, past-papers…).
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-700">Body (Markdown)</span>
        <textarea
          name="body_md"
          rows={16}
          defaultValue={initial?.body_md ?? ""}
          className={INPUT + " font-mono text-xs"}
          placeholder={"# Heading\n\nSome **bold** text and a [link](/learn)."}
        />
        <span className="mt-1 block text-[11px] text-slate-500">
          Supports # headings, **bold**, *italic*, `code`, links, - and 1.
          lists, &gt; quotes, --- rules.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-700">Status</span>
        <select
          name="status"
          defaultValue={initial?.status ?? "draft"}
          className={INPUT}
        >
          <option value="draft">draft (only you can see it)</option>
          <option value="published">published (public)</option>
        </select>
      </label>

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Saving…" : mode === "create" ? "Create page" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        {mode === "edit" && initial && (
          <DeleteConfirm
            entityLabel="page"
            confirmText={initial.title}
            action={deletePage.bind(null, initial.id)}
          />
        )}
      </div>
    </form>
  );
}

const INPUT =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

/** Slide-over host: "New page" button, or edit controls for an existing page. */
export function PageEditorLauncher({
  mode,
  initial,
  label,
}: {
  mode: "create" | "edit";
  initial?: PageRow | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-snow/70 px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink/50 hover:bg-snow"
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={mode === "create" ? "New page" : "Edit page"}
          className="fixed inset-0 z-[9998] flex justify-end"
        >
          <button
            type="button"
            aria-label="Close editor"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === "create" ? "New page" : "Edit page"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <PageEditor
                mode={mode}
                initial={initial ?? null}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
