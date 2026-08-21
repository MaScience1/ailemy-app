"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { initAnalytics, track } from "@/lib/analytics/posthog";
import { CTA_SOURCES, type CtaSource } from "@/lib/analytics/events";

/**
 * The single analytics mount point (§37, §38).
 *
 * ============================================================================
 * ⚠ ONE DELEGATED LISTENER, NOT A CLIENT COMPONENT PER BUTTON
 * ============================================================================
 * §38 wants CTA sources distinguished. The obvious way — an onClick on each
 * button — would turn every CTA into a client component and break the
 * homepage's server-rendered property, which §35 protects and page.tsx
 * documents in its own header.
 *
 * So the buttons stay server-rendered carrying a `data-cta` attribute, and one
 * capture-phase listener here reads it. The attribute IS the event property, so
 * markup and analytics cannot drift apart.
 *
 * ⚠ THE NAME IS VALIDATED AGAINST THE ALLOWED LIST BEFORE SENDING. A stray
 * data-cta added by hand would otherwise create a new funnel source silently,
 * which is the same split §37's naming rule exists to prevent.
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => { initAnalytics(); }, []);

  // ⚠ ONE pageview PER PATH CHANGE, sent by us rather than by autocapture.
  useEffect(() => {
    if (pathname === "/") track("homepage_viewed");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-cta]");
      if (!el) return;
      const cta = el.getAttribute("data-cta");
      if (!cta || !(CTA_SOURCES as readonly string[]).includes(cta)) return;
      track("cta_clicked", { cta: cta as CtaSource });
    };
    // Capture phase: a CTA inside a card that stops propagation still reports.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
