export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink">
      <nav className="border-b border-ink/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
          <a href="/" className="font-display text-xl font-medium tracking-tight text-ink">
            Ailemy<span className="text-flask">.</span>
          </a>

          <ul className="hidden items-center gap-10 text-sm font-medium text-ink/70 md:flex">
            <li>
              <a href="#subjects" className="transition-colors duration-200 hover:text-ink">
                Subjects
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="transition-colors duration-200 hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#for-schools" className="transition-colors duration-200 hover:text-ink">
                For schools
              </a>
            </li>
            <li>
              <a href="#about" className="transition-colors duration-200 hover:text-ink">
                About
              </a>
            </li>
          </ul>

          <a
            href="#"
            className="inline-flex items-center rounded-md bg-flask px-4 py-2 text-sm font-medium text-snow transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-flask/95 sm:px-5 sm:py-2.5"
          >
            Start your journey →
          </a>
        </div>
      </nav>

      <section className="flex flex-1 items-center">
        <div className="animate-fade-in mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            AI-NATIVE <span className="text-signal/70">·</span> IB{" "}
            <span className="text-signal/70">·</span> IGCSE{" "}
            <span className="text-signal/70">·</span> A-LEVEL
          </p>

          <h1 className="font-display mt-10 max-w-[760px] text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            Your complete science learning journey.
          </h1>

          <p className="mt-8 max-w-[620px] text-lg leading-relaxed text-ink/70">
            Exam preparation from A to Z, built on the spec.
          </p>

          <div className="mt-12">
            <a
              href="#"
              className="inline-flex items-center rounded-md bg-flask px-6 py-3 font-medium text-snow transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-flask/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              Start your journey →
            </a>
          </div>

          <p className="mt-8 font-mono text-xs tracking-wide text-ink/50">
            Founder · Muhammed · Chemistry teacher · Doha
          </p>
        </div>
      </section>

      <footer className="border-t border-ink/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Ailemy · AI-native exam preparation for IB, IGCSE and A-Level students.</p>
          <p className="font-mono uppercase tracking-wider">Doha, Qatar</p>
        </div>
      </footer>
    </div>
  );
}
