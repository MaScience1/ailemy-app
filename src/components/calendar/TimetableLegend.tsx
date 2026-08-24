import Link from "next/link";

import { ZONES, type CalendarZone } from "@/lib/calendar/grid";

/**
 * What the colours mean (§7), and which clock you are reading (§8).
 *
 * ⚠ THE LEGEND IS NOT DECORATION — IT IS THE KEY TO A COLOUR-CODED INTERFACE,
 * so it has to survive the things colour does not: it names every lane in
 * words, and each swatch carries the same border weight as the lane it stands
 * for, so the two are matchable in greyscale.
 *
 * ⚠ IT COLLAPSES ON MOBILE RATHER THAN DISAPPEARING. Six rows of key above a
 * day's slots is most of a phone screen; <details> keeps it one tap away and,
 * unlike a JS disclosure, it is open to find-in-page and works before hydration.
 */

const LANES: { kind: string; label: string }[] = [
  { kind: "private_open", label: "Available to request" },
  { kind: "private_booked", label: "1-to-1 booked" },
  { kind: "group_y10", label: "Year 10 group" },
  { kind: "group_y11", label: "Year 11 group" },
  { kind: "group_as", label: "AS group" },
  { kind: "blocked", label: "Unavailable" },
];

export function TimetableLegend() {
  return (
    <details className="group rounded-lg border border-line bg-parchment/70 sm:open" open>
      <summary
        className="tap-44 flex cursor-pointer list-none items-center justify-between px-3 py-2
          font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
          sm:cursor-default"
      >
        Key
        <span aria-hidden className="text-ink/35 transition-transform group-open:rotate-180 sm:hidden">▾</span>
      </summary>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 px-3 pb-3">
        {LANES.map((l) => (
          <li key={l.kind} className="flex items-center gap-2">
            <span aria-hidden className={`lane lane-${l.kind} h-3.5 w-6 rounded-sm`} />
            <span className="text-xs text-ink/70">{l.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The zone control (§8).
 *
 * ⚠ LINKS, NOT A CLIENT TOGGLE. Every other piece of calendar state — view,
 * date, filters — lives in the URL, and a zone that lived in React state alone
 * would be the one thing a student could not share, bookmark or reload. The
 * grid is server-rendered in the chosen zone, so switching re-renders the
 * positions rather than nudging labels around.
 *
 * ⚠ AND IT NAMES ZONES, NOT OFFSETS. "UK time" resolves to Europe/London and
 * carries BST and GMT with it; "+3" or "GMT+3" would be right for part of the
 * year and quietly wrong for the rest.
 */
export function ZoneToggle({
  zone, hrefFor,
}: {
  zone: CalendarZone;
  hrefFor: (z: CalendarZone) => string;
}) {
  return (
    <div
      role="group"
      aria-label="Show times in"
      className="inline-flex overflow-hidden rounded-full border border-ink/15"
    >
      {ZONES.map((z) => {
        const active = z.id === zone;
        return (
          <Link
            key={z.id}
            href={hrefFor(z.id)}
            aria-current={active ? "true" : undefined}
            /* ⚠ NO data-cta. §25 (analytics) is out of this pass's scope, and
               cta-integrity.test.ts refuses any data-cta that Analytics.tsx does
               not declare — an undeclared one is silently discarded, which is a
               tracking hole that looks like tracking. Declaring the event is the
               analytics pass's job, not this one's. */
            className={`tap-44 flex items-center px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink
              ${active ? "bg-ink text-parchment" : "text-ink/60 hover:bg-ink/[0.05]"}`}
          >
            {z.label}
            {/* ⚠ THE STATE IS IN TEXT TOO, not only in the fill (§22). */}
            {active && <span className="sr-only"> (selected)</span>}
          </Link>
        );
      })}
    </div>
  );
}
