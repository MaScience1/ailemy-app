"use client";

import { useState, useTransition } from "react";

import { markRead } from "@/lib/booking/inbox-actions";

/**
 * The Schedule updates panel (§47) — what we have told this student.
 *
 * ⚠ THE COPY IS RENDERED ON THE SERVER AND PASSED IN. describeNotification
 * needs the viewer's timezone and the stored facts, and doing it here would
 * mean a second copy of every sentence plus the browser's clock deciding what
 * "Tuesday" means.
 */
export type UpdateRow = {
  id: string;
  title: string;
  detail: string | null;
  when: string;
  unread: boolean;
};

export function ScheduleUpdates({ rows, note }: { rows: UpdateRow[]; note: string | null }) {
  const [readNow, setReadNow] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unread = rows.filter((r) => r.unread && !readNow.has(r.id)).length;

  if (note) {
    return (
      <p role="alert" className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {note}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink/60">
        {/* ⚠ "Nothing yet" — NOT "you have no notifications", which reads like a
            setting is off. Nothing has happened that we needed to tell them. */}
        Nothing yet. Changes to your lessons will appear here.
      </p>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
          {unread} unread
        </p>
      )}
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {rows.map((r) => {
          const isUnread = r.unread && !readNow.has(r.id);
          return (
            <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3.5">
              {/* ⚠ UNREAD IS A DOT *AND* A WEIGHT, NOT COLOUR ALONE — the same
                  rule the calendar chips follow. */}
              <span aria-hidden className="mt-1.5 w-2 shrink-0">
                {isUnread && <span className="block h-2 w-2 rounded-full bg-ink/70" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${isUnread ? "font-medium text-ink" : "text-ink/70"}`}>
                  {r.title}
                  {isUnread && <span className="sr-only"> (unread)</span>}
                </span>
                {r.detail && <span className="mt-0.5 block text-sm text-ink/60">{r.detail}</span>}
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  {r.when}
                </span>
              </span>
              {isUnread && (
                <button
                  type="button" disabled={pending}
                  onClick={() => start(async () => {
                    setError(null);
                    const res = await markRead(r.id);
                    if (res.ok) setReadNow((s) => new Set(s).add(r.id));
                    else setError(res.error);
                  })}
                  className="shrink-0 text-xs underline underline-offset-2 text-ink/55 hover:text-ink disabled:opacity-40"
                >
                  Mark read
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-3 text-xs text-red-800">{error}</p>}
    </div>
  );
}
