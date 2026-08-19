import type { ReactNode } from "react";

import { DISCLOSURE, LEGAL_LAST_UPDATED } from "@/lib/legal/company";

/**
 * Shared chrome for /privacy and /terms: title, visible last-updated date, the
 * company disclosure, and readable measure. Both pages carry the disclosure
 * because a visitor may land on either without passing the footer.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-parchment text-ink flex-1">
      <div className="mx-auto w-full max-w-[68ch] px-6 py-14 sm:px-10 md:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>

        <p className="text-ink/55 mt-3 font-mono text-xs tracking-wider uppercase">
          Last updated {LEGAL_LAST_UPDATED}
        </p>

        <p className="text-ink/75 mt-6 text-base leading-relaxed">{intro}</p>

        <div className="mt-10 space-y-8">{children}</div>

        <p className="border-ink/10 text-ink/55 mt-14 border-t pt-6 text-sm leading-relaxed">
          {DISCLOSURE}
        </p>
      </div>
    </main>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-medium tracking-tight">{heading}</h2>
      <div className="text-ink/75 mt-3 space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="marker:text-ink/30 list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
