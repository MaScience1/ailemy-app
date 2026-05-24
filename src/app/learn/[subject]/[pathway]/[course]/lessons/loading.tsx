export default function LessonsLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="h-3 w-80 animate-pulse rounded bg-ink/10" />
        <div className="mt-10 max-w-3xl space-y-5">
          <div className="h-3 w-44 animate-pulse rounded bg-ink/10" />
          <div className="h-14 w-3/4 animate-pulse rounded bg-ink/10 md:h-20" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-44 animate-pulse rounded bg-ink/10" />
        </div>
        <div className="mt-12 space-y-20">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="border-b border-ink/10 pb-5">
                <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
                <div className="mt-3 h-9 w-72 animate-pulse rounded bg-ink/10" />
                <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded bg-ink/10" />
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {[0, 1, 2, 3, 4, 5].map((j) => (
                  <div
                    key={j}
                    className="h-44 animate-pulse rounded-lg border border-ink/10 bg-snow"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
