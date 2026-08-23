import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

/**
 * Editorial breadcrumb — JetBrains Mono, low-contrast separators. The final
 * crumb is rendered as plain text (current page) without a link.
 *
 * ⚠ THE CRUMB LINK CARRIES A HIT AREA AND A FOCUS RING, AND HAD NEITHER.
 * At text-xs it rendered a 16px-tall tap target on a phone, and it was the
 * only interactive element on these pages with no visible focus state — so a
 * keyboard user tabbing through could not see where they were. Both are fixed
 * here rather than at the fifteen call sites, which is the point of the
 * component. py-3.5 makes 16 + 14 + 14 = 44; -my-3.5 cancels it in layout, so
 * every existing page renders identically.
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
                  className="-my-3.5 py-3.5 uppercase tracking-[0.18em] transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
