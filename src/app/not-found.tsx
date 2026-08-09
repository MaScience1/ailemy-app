import Link from "next/link";

/**
 * The 404 page.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * There wasn't one, so every notFound() in the app rendered Next's built-in
 * placeholder — an unstyled "404 | This page could not be found." — INSIDE the
 * root layout. The root layout mounts AdminOverlay, so a signed-in admin got
 * that bare placeholder with a floating "Edit mode ON" toggle over it, which
 * reads as a half-rendered application rather than as a missing page.
 *
 * That is a real cost, not a cosmetic one: it sent someone looking for a
 * broken route when the actual answer was a mistyped URL.
 *
 * ⚠ The overlay still renders here, and that is Next's model — a root layout
 * wraps 404s too. The fix is not to hide it but to make the page underneath
 * unambiguous: this is a designed page that says, plainly, that the address
 * does not exist. An admin toggle on top of THAT is obviously chrome.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6 text-ink">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/45">
          404
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight md:text-4xl">
          That page doesn&apos;t exist.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/65">
          The address may be mistyped, or the page may have moved. Nothing has
          gone wrong — this is the app telling you there is no such page.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/learn"
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-snow transition-colors hover:bg-ink/85"
          >
            Browse subjects
          </Link>
          <Link
            href="/past-papers"
            className="rounded-md border border-ink/15 px-5 py-2.5 font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.04]"
          >
            Past papers
          </Link>
        </div>
      </div>
    </main>
  );
}
