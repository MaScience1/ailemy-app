export default function Home() {
  return (
    <main className="hero-lines relative flex min-h-screen w-full items-center justify-center bg-ink px-6 text-snow sm:px-10">
      <div className="animate-fade-in mx-auto w-full max-w-[900px]">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-signal">
          AI-NATIVE · IB · IGCSE · A-LEVEL
        </p>

        <h1 className="font-display mt-10 max-w-[900px] text-4xl font-medium leading-[1.05] tracking-tight sm:mt-12 sm:text-6xl">
          Where reaction meets revelation.
        </h1>

        <p className="mt-8 max-w-[650px] text-lg leading-relaxed text-parchment/70 sm:mt-10">
          Exam preparation built on the spec, not around it.
        </p>

        <div className="mt-12 sm:mt-14">
          <a
            href="#"
            className="inline-flex items-center rounded-md bg-flask px-6 py-3 font-medium text-snow transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-flask/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          >
            Get early access →
          </a>
        </div>

        <p className="mt-10 font-mono text-xs tracking-wide text-parchment/50 sm:mt-12">
          Founder · Muhammed · Chemistry teacher · Doha
        </p>
      </div>
    </main>
  );
}
