"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { FilterOptions } from "@/lib/catalogue/past-paper-filters";

/**
 * Filter bar for /past-papers.
 *
 * Filter state lives entirely in the URL query string, so a filtered view is
 * shareable and the back button steps through filter changes. There is no
 * client state library and no local mirror of the selections — each <select>
 * reads its current value straight from useSearchParams(), and changing one
 * pushes a new URL. The server component re-runs the query for that URL.
 *
 * Wrapped in a real <form method="GET"> so the control still works with
 * JavaScript disabled (the browser submits the same query string); the
 * onChange handler just upgrades it to a no-reload router navigation.
 */
export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = (key: string) => params.get(key) ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/past-papers?${qs}` : "/past-papers", { scroll: false });
    });
  }

  const activeCount = ["subject", "board", "course", "year", "doc"].filter((k) =>
    params.get(k),
  ).length;

  return (
    <form
      method="GET"
      action="/past-papers"
      className="rounded-lg border border-ink/10 bg-snow p-4 sm:p-5"
      aria-label="Filter past papers"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          name="subject"
          label="Subject"
          value={current("subject")}
          options={options.subjects}
          onChange={(v) => update("subject", v)}
        />
        <Select
          name="board"
          label="Exam board"
          value={current("board")}
          options={options.boards}
          onChange={(v) => update("board", v)}
        />
        <Select
          name="course"
          label="Level / course"
          value={current("course")}
          options={options.courses}
          onChange={(v) => update("course", v)}
        />
        <Select
          name="year"
          label="Year"
          value={current("year")}
          options={options.years}
          onChange={(v) => update("year", v)}
        />
        <Select
          name="doc"
          label="Document type"
          value={current("doc")}
          options={options.docTypes}
          onChange={(v) => update("doc", v)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {isPending
            ? "Updating…"
            : activeCount === 0
              ? "Showing all papers"
              : `${activeCount} filter${activeCount === 1 ? "" : "s"} active`}
        </p>
        <div className="flex items-center gap-2">
          {/* Real submit button: the no-JS fallback path. */}
          <noscript>
            <button
              type="submit"
              className="rounded-md border border-ink/20 bg-snow px-3 py-1.5 text-sm text-ink"
            >
              Apply filters
            </button>
          </noscript>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  router.push("/past-papers", { scroll: false }),
                )
              }
              className="rounded-md border border-ink/20 bg-snow px-3 py-1.5 text-sm text-ink transition hover:bg-parchment"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono block text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-ink/15 bg-parchment px-3 py-2 text-sm text-ink focus:border-flask focus:outline-none focus:ring-2 focus:ring-flask/20"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
