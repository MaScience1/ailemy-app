import Link from "next/link";

export default function PathwayNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-6 text-ink">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
          404
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight md:text-4xl">
          Pathway not found.
        </h1>
        <p className="mt-4 text-sm text-ink/65">
          Pathways are: UK A-Level, International A-Level, IB, AP, UK GCSE,
          and International GCSE. Check the URL or pick a pathway from the
          subject page.
        </p>
        <Link
          href="/learn"
          className="mt-8 inline-flex items-center rounded-md border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.04]"
        >
          Browse subjects
        </Link>
      </div>
    </main>
  );
}
