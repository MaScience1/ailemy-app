import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { listSubjects } from "@/lib/catalogue/queries";
import {
  deriveStatus,
  getStatusBadge,
  getStatusCta,
  type EntityStatus,
} from "@/lib/catalogue/status";
import { getSubjectCopy } from "@/lib/catalogue/subject-descriptions";
import { getSubjectTheme } from "@/lib/catalogue/subject-theme";
import type { Subject, EntityCounts } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Choose your subject · Ailemy",
  description:
    "Spec-led science learning for IB, IGCSE and A-Level students. Start with Chemistry.",
};

export default async function LearnPage() {
  const subjects = await listSubjects();

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <Breadcrumb crumbs={[{ label: "Learn" }]} />

        <header className="mt-10 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            Catalogue
          </p>
          <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Choose your subject.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            Spec-led courses for IB, IGCSE and A-Level students. We&apos;re
            starting with Chemistry — Physics and Biology will follow.
          </p>
        </header>

        <section className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </section>
      </div>
    </main>
  );
}

/**
 * Subject card. Three states:
 *   available   — clickable, signal-green badge + "Explore courses →" CTA
 *   preview     — clickable, parchment badge + "Browse curriculum →" CTA
 *   coming_soon — disabled, muted badge + "NOT YET OPEN" CTA
 *
 * Card itself is bg-ink (dark). The coming_soon badge from the helper is
 * tuned for light cards, so we override to the dark-card variant
 * (bg-snow/10 text-parchment/70) here. Other states use helper defaults
 * which contrast fine on ink.
 */
function SubjectCard({ subject }: { subject: Subject & EntityCounts }) {
  const copy = getSubjectCopy(subject.slug);
  const status = deriveStatus(subject);
  const href = `/learn/${subject.slug}`;
  const theme = getSubjectTheme(subject);

  const badge = getStatusBadge(status);
  const cta = getStatusCta(status, "Explore courses →");

  const isClickable = !cta.isDisabled;

  const cardClass = cn(
    "group/card relative flex h-full flex-col justify-between gap-10 rounded-xl border border-ink/15 bg-ink p-8 text-parchment transition-all duration-300 ease-out sm:p-10",
    isClickable && "hover:-translate-y-1 hover:border-ink/40 hover:bg-ink",
    status === "preview" && "text-parchment/85",
    status === "coming_soon" && "cursor-not-allowed opacity-60",
  );

  // On a dark card, the helper's default coming_soon badge (bg-ink/10) is
  // invisible. Swap it for the snow-on-dark variant we used before this
  // refactor. Available and preview badges look fine against ink as-is.
  const badgeClassName =
    status === "coming_soon"
      ? "bg-snow/10 text-parchment/70"
      : badge.className;

  // Subject-coloured stripe along the top of every card. Hover intensifies to
  // the darker variant via group-hover, no JS state needed.
  const stripeStyle = {
    "--stripe": theme.primary,
    "--stripe-hover": theme.secondary,
  } as React.CSSProperties;

  const Content = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[var(--stripe)] transition-colors duration-300 group-hover/card:bg-[var(--stripe-hover)]"
      />

      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/55">
            Subject
          </p>
          <span
            className={cn(
              "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              badgeClassName,
            )}
          >
            {badge.label}
          </span>
        </div>

        <h2 className="font-display mt-8 text-3xl font-medium tracking-tight md:text-4xl">
          {subject.name}
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-parchment/70">
          {copy.description}
        </p>

        {status === "coming_soon" && copy.comingSoonNote && (
          <p className="mt-3 text-xs text-parchment/45">{copy.comingSoonNote}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {status === "available" && (
          <span className="inline-flex items-center gap-2 text-signal transition-transform duration-300 group-hover/card:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        {status === "preview" && (
          <span className="inline-flex items-center gap-2 text-parchment transition-transform duration-300 group-hover/card:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        {status === "coming_soon" && (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-parchment/45">
            {cta.label}
          </span>
        )}
      </div>
    </>
  );

  if (!isClickable) {
    return (
      <div
        aria-disabled="true"
        className={cardClass}
        style={stripeStyle}
        title={`${subject.name} — ${describeStatus(status)}`}
      >
        {Content}
      </div>
    );
  }

  return (
    <Link href={href} className={cardClass} style={stripeStyle}>
      {Content}
    </Link>
  );
}

function describeStatus(status: EntityStatus): string {
  switch (status) {
    case "available":
      return "available";
    case "preview":
      return "preview — curriculum browseable, lessons coming";
    case "coming_soon":
      return "coming soon";
  }
}
