import Link from "next/link";

type SubjectCardProps = {
  title: string;
  lines: string[];
  accentClass: string;
};

function SubjectCard({ title, lines, accentClass }: SubjectCardProps) {
  return (
    <div className="group flex flex-col rounded-lg border border-ink/10 bg-snow p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-ink/25 sm:p-10">
      <div
        className={`h-0.5 w-10 ${accentClass} transition-all duration-300 ease-out group-hover:w-16`}
        aria-hidden="true"
      />
      <h3 className="font-display mt-6 text-2xl font-medium tracking-tight">
        {title}
      </h3>
      <div className="mt-5 space-y-1 text-sm leading-relaxed text-ink/70">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink">
      <nav className="border-b border-ink/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
          <a
            href="/"
            className="font-display text-xl font-medium tracking-tight text-ink"
          >
            Ailemy<span className="text-flask">.</span>
          </a>

          <ul className="hidden items-center gap-10 text-sm font-medium text-ink/70 md:flex">
            <li>
              <a
                href="#subjects"
                className="transition-colors duration-200 hover:text-ink"
              >
                Subjects
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="transition-colors duration-200 hover:text-ink"
              >
                How it works
              </a>
            </li>
            <li>
              <a
                href="#for-schools"
                className="transition-colors duration-200 hover:text-ink"
              >
                For schools
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="transition-colors duration-200 hover:text-ink"
              >
                About
              </a>
            </li>
          </ul>

          <Link
            href="/signup"
            className="inline-flex items-center rounded-md bg-flask px-4 py-2 text-sm font-medium text-snow transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-flask/95 hover:shadow-sm sm:px-5 sm:py-2.5"
          >
            Start your journey →
          </Link>
        </div>
      </nav>

      <section className="flex min-h-[80vh] items-center">
        <div className="animate-fade-in mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            IB <span className="text-signal/70">·</span> IGCSE{" "}
            <span className="text-signal/70">·</span> A-LEVEL
          </p>

          <h1 className="font-display mt-10 max-w-[760px] text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            Your all-in-one science learning pathway.
          </h1>

          <p className="mt-8 max-w-[620px] text-lg leading-[1.65] text-ink/70">
            From first lesson to final exam — built on the spec, grounded in real
            mark schemes.
          </p>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-flask px-6 py-3 font-medium text-snow transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-flask/95 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              Start your journey →
            </Link>
            <a
              href="#subjects"
              className="inline-flex items-center justify-center rounded-md border border-ink/15 bg-transparent px-6 py-3 font-medium text-ink transition-all duration-200 ease-out hover:border-ink/40 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              Explore subjects
            </a>
          </div>

          <p className="mt-8 max-w-[520px] text-sm leading-relaxed text-ink/55">
            Built for IB, IGCSE and A-Level students. Powered by real mark
            schemes and real exam papers.
          </p>
        </div>
      </section>

      <section id="subjects" className="border-t border-ink/10">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <SubjectCard
              title="Chemistry"
              lines={[
                "Real exam walkthroughs.",
                "Spec-point lessons.",
                "AI tutoring.",
              ]}
              accentClass="bg-subject-chem-as"
            />
            <SubjectCard
              title="Physics"
              lines={[
                "Visual explanations.",
                "Vector intuition.",
                "Problem solving.",
              ]}
              accentClass="bg-subject-physics-as"
            />
            <SubjectCard
              title="Biology"
              lines={[
                "Processes made visible.",
                "Memory + understanding.",
                "Exam mastery.",
              ]}
              accentClass="bg-subject-bio-as"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Ailemy · Science learning for IB, IGCSE and A-Level students.</p>
          <p className="font-mono uppercase tracking-wider">Doha, Qatar</p>
        </div>
      </footer>
    </div>
  );
}
