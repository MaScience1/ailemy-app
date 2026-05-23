import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

/**
 * Editorial breadcrumb — JetBrains Mono, low-contrast separators. The final
 * crumb is rendered as plain text (current page) without a link.
 */
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-xs text-ink/55">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="uppercase tracking-[0.18em] transition-colors hover:text-ink"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="uppercase tracking-[0.18em] text-ink/80"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
