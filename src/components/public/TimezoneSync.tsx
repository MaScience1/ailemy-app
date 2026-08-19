"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { rememberTimeZone } from "@/app/_actions/timezone";

/**
 * Tell the server where the visitor is, once (§45).
 *
 * ⚠ IT RENDERS NOTHING AND CAUSES NO LAYOUT SHIFT. The page already arrived
 * with correct Doha times; this only adds a second line on the NEXT render, and
 * only if we did not already know. There is no skeleton, no placeholder, and no
 * flash of a wrong time — the first paint is already honest.
 *
 * ⚠ IT RUNS ONCE PER VISITOR, NOT PER PAGE. `known` is passed from the server:
 * when the cookie is already set this component does nothing at all, so a
 * router.refresh() cannot loop.
 */
export function TimezoneSync({ known }: { known: boolean }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (known || done.current) return;
    done.current = true;
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return; // Older browser. Doha time alone is still correct.
    }
    if (!tz) return;
    void rememberTimeZone(tz).then(() => router.refresh());
  }, [known, router]);

  return null;
}
