/** Skeleton mirroring the real page's geometry: header, rail, tree rows. */
export default function SpecificationLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="h-3 w-56 animate-pulse rounded bg-ink/10" />
        <div className="mt-10 max-w-3xl space-y-5">
          <div className="h-3 w-40 animate-pulse rounded bg-ink/10" />
          <div className="h-12 w-full animate-pulse rounded bg-ink/10 md:h-14" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
        </div>
        <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
          <div className="grid gap-6 lg:order-2">
            <div className="h-48 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
            <div className="h-40 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
          </div>
          <div className="mt-8 space-y-3 lg:order-1 lg:mt-0">
            <div className="h-10 max-w-md animate-pulse rounded-lg bg-ink/10" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-ink/10" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg border border-ink/10 bg-ink/5" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
