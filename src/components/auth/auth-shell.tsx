import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Two-column auth layout. Left = ink panel with wordmark and editorial
 * tagline (desktop only). Right = parchment panel where the form lives.
 * Used by /signup and /login.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-parchment md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-ink p-10 text-snow md:flex lg:p-14">
        <Link
          href="/"
          className="font-display text-xl font-medium tracking-tight text-snow"
        >
          Ailemy<span className="text-flask">.</span>
        </Link>

        {/* ⚠ §55. This read "Built for the spec. / Trusted by students." The
            second line was a social-proof claim with nothing published behind
            it — no testimonials, no cohort has started, no student outcomes
            exist yet. Replaced with a second claim about the PRODUCT, which is
            true today and stays true whatever the enrolment number is. */}
        <p className="font-display max-w-md text-3xl font-medium leading-[1.15] tracking-tight lg:text-4xl">
          Built for the specification.
          <br />
          Built for the exam.
        </p>

        <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/40">
          Doha, Qatar
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
