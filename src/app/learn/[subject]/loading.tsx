export default function SubjectLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="h-3 w-40 animate-pulse rounded bg-ink/10" />
        <div className="mt-10 max-w-3xl space-y-5">
          <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
          <div className="h-14 w-2/3 animate-pulse rounded bg-ink/10 md:h-20" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-ink/10" />
        </div>
        <div className="mt-16 space-y-16">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="border-b border-ink/10 pb-4">
                <div className="h-6 w-64 animate-pulse rounded bg-ink/10" />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    className="h-52 animate-pulse rounded-xl border border-ink/10 bg-snow"
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
