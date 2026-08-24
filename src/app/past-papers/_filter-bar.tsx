"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  FILTER_LABELS,
  FILTER_ORDER,
  type FilterKey,
  type FilterOptions,
} from "@/lib/catalogue/past-paper-filter-types";

/**
 * Cascading filter bar for /past-papers.
 *
 * Filter state lives entirely in the URL query string, so a filtered view is
 * shareable and the back button steps through filter changes. There is no
 * client state library and no local mirror of the selections — each <select>
 * reads its value from useSearchParams(), and changing one pushes a new URL
 * for the server component to re-query.
 *
 * CASCADE: changing a filter clears every filter AFTER it in FILTER_ORDER,
 * because a downstream choice made under the old value may be impossible under
 * the new one (pick a different board and the previously chosen course usually
 * belongs to another board). Clearing here keeps the URL honest; the server
 * additionally re-validates, so a hand-edited URL cannot produce an impossible
 * combination either.
 *
 * Wrapped in a real <form method="GET"> so it still works with JavaScript
 * disabled; the onChange handler upgrades it to a no-reload navigation.
 */

export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const optionsFor: Record<FilterKey, { value: string; label: string }[]> = {
    subject: options.subjects,
    board: options.boards,
    course: options.courses,
    year: options.years,
    doc: options.docTypes,
  };

  function update(key: FilterKey, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);

    // Clear everything downstream of the filter that just changed.
    const idx = FILTER_ORDER.indexOf(key);
    for (const later of FILTER_ORDER.slice(idx + 1)) next.delete(later);

    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/past-papers?${qs}` : "/past-papers", { scroll: false });
    });
  }

  const activeCount = FILTER_ORDER.filter((k) => params.get(k)).length;

  return (
    <form
      method="GET"
      action="/past-papers"
      className="rounded-lg border border-ink/10 bg-snow p-4 sm:p-5"
      aria-label="Filter past papers"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FILTER_ORDER.map((key) => {
          const opts = optionsFor[key];
          // Year can legitimately be empty (no papers yet for this selection).
          // Showing a select whose only entry is "All" is misleading, so say so.
          const emptyNote = opts.length === 0;
          return (
            <label key={key} className="block">
              <span className="font-mono block text-[10px] uppercase tracking-[0.2em] text-ink/55">
                {FILTER_LABELS[key]}
              </span>
              <select
                name={key}
                value={params.get(key) ?? ""}
                onChange={(e) => update(key, e.target.value)}
                disabled={emptyNote}
                className="mt-1.5 w-full rounded-md border border-ink/15 bg-parchment px-3 py-2 text-base md:text-base md:text-sm text-ink transition focus:border-flask focus:outline-none focus:ring-2 focus:ring-flask/20 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <option value="">{emptyNote ? "None available" : "All"}</option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
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
          <noscript>
            <button
              type="submit"
              className="rounded-md border border-ink/20 bg-snow px-3 py-1.5 text-base md:text-sm text-ink"
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
              className="rounded-md border border-ink/20 bg-snow px-3 py-1.5 text-base md:text-sm text-ink transition hover:bg-parchment"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
