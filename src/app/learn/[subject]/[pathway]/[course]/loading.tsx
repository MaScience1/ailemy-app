export default function CourseHubLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="h-3 w-72 animate-pulse rounded bg-ink/10" />
        <div className="mt-10 max-w-3xl space-y-5">
          <div className="h-3 w-40 animate-pulse rounded bg-ink/10" />
          <div className="h-14 w-3/4 animate-pulse rounded bg-ink/10 md:h-20" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-56 animate-pulse rounded bg-ink/10" />
        </div>
        <div className="mt-14 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-2xl border border-ink/10 bg-snow"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
