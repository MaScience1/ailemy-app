"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keyboard behaviour for the expanded calendar.
 *
 * ============================================================================
 * ⚠ THE OVERLAY ITSELF IS SERVER-RENDERED. THIS ONLY ADDS WHAT NEEDS A BROWSER.
 * ============================================================================
 * Whether the calendar is open lives in the URL, so the overlay renders on the
 * server, the scrim is a real link, and the whole thing opens and closes with
 * JavaScript disabled — the same shape DayPanel already uses. What a link
 * cannot do is Escape and a focus trap, and that is all this component is.
 *
 * If this file fails to load, the calendar still opens and still closes. That
 * is the point of building it this way round.
 */
export function CalendarOverlay({
  closeHref, children,
}: {
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /**
     * ⚠ FOCUS MOVES INTO THE DIALOG, OR A KEYBOARD USER IS STILL ON THE PAGE
     * BEHIND IT. Tabbing would walk the hero while a modal covers it, which is
     * the classic "where am I" failure.
     */
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(closeHref, { scroll: false });
        return;
      }
      if (e.key !== "Tab") return;

      // ⚠ THE TRAP. Wrap at both ends, and only when there is something to
      // wrap to — an empty dialog would otherwise swallow every Tab.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (active instanceof HTMLElement && !node.contains(active)) {
        // Focus escaped some other way — pull it back rather than leaving the
        // user typing into the page underneath.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    /**
     * ⚠ THE PAGE BEHIND MUST NOT SCROLL. On iOS especially, a fixed overlay
     * over a scrollable body scrolls the body under the finger and the reader
     * loses their place in the hero.
     */
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [closeHref, router]);

  return <div ref={ref}>{children}</div>;
}
