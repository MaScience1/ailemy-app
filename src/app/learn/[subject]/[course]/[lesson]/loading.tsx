export default function LessonLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-16">
        <div className="h-3 w-96 max-w-full animate-pulse rounded bg-ink/10" />
        <div className="mt-8 max-w-4xl space-y-5">
          <div className="h-3 w-28 animate-pulse rounded bg-ink/10" />
          <div className="h-14 w-3/4 animate-pulse rounded bg-ink/10 md:h-20" />
          <div className="flex gap-2">
            <div className="h-4 w-12 animate-pulse rounded bg-ink/10" />
            <div className="h-4 w-12 animate-pulse rounded bg-ink/10" />
          </div>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <div>
            <div className="aspect-video w-full animate-pulse rounded-lg bg-ink/90" />
            <div className="mt-10 space-y-3">
              <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-full animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-3 w-40 animate-pulse rounded bg-ink/10" />
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-ink/10 bg-snow"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
