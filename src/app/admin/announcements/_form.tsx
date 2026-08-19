"use client";

import { useActionState, useEffect, useRef } from "react";

import { CATEGORIES, STATUSES } from "@/lib/admin/announcement-form";

import { createAnnouncement, updateAnnouncement } from "./actions";

/**
 * One announcement, editable.
 *
 * ⚠ TIMES ARE ENTERED LOCALLY AND STORED AS INSTANTS. A `datetime-local` input
 * carries no timezone, so the form also submits the browser's offset and the
 * server resolves the two into a real moment. Without that, "switch this on at
 * 7pm" means 7pm wherever the server happens to be running.
 */

export type EditableAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  status: string;
  cta_label: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  enabled: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export function AnnouncementForm({ existing }: { existing?: EditableAnnouncement }) {
  const action = existing ? updateAnnouncement : createAnnouncement;
  const [state, submit, pending] = useActionState<Result | null, FormData>(action, null);
  const offset = useRef<HTMLInputElement>(null);
  const startsAt = useRef<HTMLInputElement>(null);
  const endsAt = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (offset.current) offset.current.value = String(new Date().getTimezoneOffset());
    const fill = (el: HTMLInputElement | null, iso: string | null | undefined) => {
      if (!el || !iso) return;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return;
      const p = (n: number) => String(n).padStart(2, "0");
      el.value =
        `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
        `T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    fill(startsAt.current, existing?.starts_at);
    fill(endsAt.current, existing?.ends_at);
  }, [existing?.starts_at, existing?.ends_at]);

  return (
    <form action={submit} className="space-y-4">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input ref={offset} type="hidden" name="tz_offset" defaultValue="0" />

      {state && !state.ok && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Saved.
        </p>
      )}

      <label className="block text-sm">
        <span className="text-slate-700">Title *</span>
        <input name="title" required defaultValue={existing?.title ?? ""} className={input} />
      </label>

      <label className="block text-sm">
        <span className="text-slate-700">Body</span>
        <textarea name="body" rows={2} defaultValue={existing?.body ?? ""} className={input} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-700">Category *</span>
          <select name="category" required defaultValue={existing?.category ?? "update"} className={input}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Status *</span>
          <select name="status" required defaultValue={existing?.status ?? "draft"} className={input}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">CTA label</span>
          <input name="cta_label" defaultValue={existing?.cta_label ?? ""} placeholder="Register interest" className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">CTA link</span>
          <input name="link_url" defaultValue={existing?.link_url ?? ""} placeholder="/tuition" className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Show from</span>
          <input ref={startsAt} name="starts_at" type="datetime-local" className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Show until</span>
          <input ref={endsAt} name="ends_at" type="datetime-local" className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Priority</span>
          <input name="priority" type="number" step={1} defaultValue={existing?.priority ?? 0} className={input} />
          <span className="mt-1 block text-[11px] text-slate-500">Higher wins. The bar shows exactly one.</span>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="enabled" defaultChecked={existing?.enabled ?? false} className="mt-1 h-4 w-4" />
        <span>
          Switched on
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Only allowed when status is Live. The public bar checks this box and the window — never the status.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : existing ? "Save changes" : "Create announcement"}
      </button>
    </form>
  );
}

const input =
  "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:border-slate-500 focus:outline-none";
