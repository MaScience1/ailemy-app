import Link from "next/link";
import {
  BookOpen,
  FileText,
  FlaskConical,
  Layers,
  Sigma,
  SquareStack,
} from "lucide-react";

import type { ResourceKind } from "@/lib/resources/taxonomy";

/**
 * Resource category groups and rows (§7, §21, §22, §50).
 *
 * ============================================================================
 * ⚠ RESOURCE TYPES ARE RECOGNISABLE WITHOUT BEING NOISY (§22)
 * ============================================================================
 * Each type gets a small icon AND a written label. The icon is decorative —
 * `aria-hidden` — because an icon alone is not a type name to a screen reader,
 * and because §57 forbids meaning carried only by a glyph. The editorial
 * restraint is deliberate: nine loud coloured tiles would read as a toolbar,
 * not a library.
 *
 * ⚠ AN UNAVAILABLE ROW STILL SAYS SOMETHING USEFUL (§50). It is never a blank
 * panel and never a bare "coming soon": it explains WHY it is not there and,
 * where one exists, points at the thing that is. A row with nothing helpful to
 * say would be better hidden, and the caller can simply not render it.
 */

const ICON: Record<ResourceKind, typeof BookOpen> = {
  lesson: BookOpen,
  notes_deck: SquareStack,
  past_paper: FileText,
  worked_example: FlaskConical,
  definition_set: Layers,
  formula_set: Sigma,
};

export function ResourceCategory({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  const id = `cat-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={id} className="font-display text-2xl font-medium tracking-tight">
          {title}
        </h2>
        {lede && <p className="text-sm text-ink/60">{lede}</p>}
      </div>
      <ul className="mt-4 grid gap-2">{children}</ul>
    </section>
  );
}

export function ResourceRow({
  kind,
  title,
  count,
  href,
  available,
  unavailableNote,
  provenance,
}: {
  kind: ResourceKind;
  title: string;
  /** A derived figure or a plain description — never an invented number. */
  count: string;
  href: string | null;
  available: boolean;
  unavailableNote: string;
  /** §52 — the exam board a resource came from, never stripped. */
  provenance?: string;
}) {
  const Icon = ICON[kind];

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--subject-accent)]" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink/60">
            {available ? count : unavailableNote}
          </span>
          {provenance && (
            <span className="font-mono mt-1 block text-[10px] uppercase tracking-[0.14em] text-ink/40">
              Source: {provenance}
            </span>
          )}
        </span>
      </span>
      {available && href && (
        <span aria-hidden className="shrink-0 text-sm text-ink/70">
          →
        </span>
      )}
    </>
  );

  const shell =
    "flex items-start justify-between gap-4 rounded-lg border border-ink/10 bg-snow px-4 py-3.5";

  if (!available || !href) {
    return (
      <li>
        <div className={`${shell} opacity-75`}>{body}</div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className={`${shell} transition-colors hover:border-[var(--subject-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
      >
        {body}
      </Link>
    </li>
  );
}
