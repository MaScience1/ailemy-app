export default function LearnLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
        <div className="mt-10 max-w-3xl space-y-5">
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
          <div className="h-14 w-full animate-pulse rounded bg-ink/10 md:h-20" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-ink/10" />
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl border border-ink/15 bg-ink/95"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
