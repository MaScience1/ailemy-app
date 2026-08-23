"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { track } from "@/lib/analytics/posthog";

/**
 * The Resources search field (§17, §19).
 *
 * ⚠ DEBOUNCED, AND IT NAVIGATES RATHER THAN STREAMING RESULTS. §19 warns
 * against a server call per keystroke; this waits 400ms after typing stops and
 * then pushes a URL. That also makes every result page shareable, bookmarkable
 * and crawlable, which a client-side result list would not be (§46).
 *
 * ⚠ THE TERM IS TRACKED, THE PERSON IS NOT (§56). Knowing students keep
 * searching "electrolysis" is content intelligence; knowing which student did
 * is surveillance, and nothing here carries an identifier.
 */
export function ResourceSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      if (q.length >= 2) {
        track("resource_search", {});
        router.push(`/resources?q=${encodeURIComponent(q)}`);
      } else if (q.length === 0) {
        router.push("/resources");
      }
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, router]);

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); if (value.trim().length >= 2) router.push(`/resources?q=${encodeURIComponent(value.trim())}`); }}
      className="relative"
    >
      <label htmlFor="resource-search" className="sr-only">Search resources</label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
      <input
        id="resource-search"
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Search "enthalpy", "moles", "past paper"…'
        className="w-full rounded-full border border-ink/15 bg-snow py-3.5 pl-11 pr-4 text-base text-ink placeholder:text-ink/40 focus:border-ink/30 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />
    </form>
  );
}
