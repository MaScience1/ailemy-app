import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import {
  SUBJECTS, ctaFor, priceLabel,
  type Cohort, type Subject,
} from "@/lib/public/catalogue";
import { loadCohorts } from "@/lib/public/readers";

/**
 * The Ailemy front door.
 *
 * ============================================================================
 * ⚠ THIS PAGE SELLS AILEMY, NOT ONE QUALIFICATION
 * ============================================================================
 * It used to open on "Edexcel IAL Chemistry AS" — true, and far too narrow: a
 * parent looking for Biology tuition and a student looking for past papers both
 * bounced off a page that appeared to be about somebody else's course. The
 * hierarchy below is the product, in the order a visitor needs it.
 *
 * ⚠ EVERY FIGURE COMES FROM THE CATALOGUE LAYER, NOT FROM JSX. Prices, hours,
 * dates and CTAs live in one place so the founder can move them without a
 * developer — and so a price cannot drift between two sections of one page.
 *
 * ⚠ SERVER-RENDERED THROUGHOUT. No client components and no animation library.
 * Cohorts are read from the database (0041) with the static catalogue as the
 * fallback, so the page renders the founder's real offer whether or not the
 * migration has been applied — and never a blank catalogue.
 */
export const metadata: Metadata = {
  title: "Ailemy — online science school and exam practice",
  description:
    "Live small-group science tuition, specification-mapped learning, past-paper practice with " +
    "mark-scheme-informed marking, and progress tracking. Pearson Edexcel GCSE, International GCSE and IAL.",
};

export default async function Home() {
  const session = await getNavSession();
  const { data: cohorts } = await loadCohorts();
  const chemistryCohorts = cohorts.filter((c) => c.subject === "chemistry");

  return (
    <div className="bg-parchment text-ink">
      {/* 1 */} <AnnouncementBar />
      {/* 2 */} <SiteNav session={session} />

      {/* ── 3. hero ───────────────────────────────────────────────────── */}
      <header className="mx-auto max-w-6xl px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Pearson Edexcel · GCSE · International GCSE · IAL
        </p>
        <h1 className="font-display mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
          Master science. Ace the exam.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg">
          Expert live tuition, specification-mapped learning, past-paper practice, marked
          answers and personalised progress — in one place.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/tuition"
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Join live tuition →
          </Link>
          <Link
            href="/past-papers"
            className="rounded-full border border-ink/20 px-6 py-3 text-sm font-medium hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Start practising →
          </Link>
        </div>
      </header>

      {/* ── 4. subject selector ───────────────────────────────────────── */}
      <Section id="subjects" title="Three sciences, one platform">
        <div className="grid gap-4 sm:grid-cols-3">
          {SUBJECTS.map((s) => <SubjectCard key={s.slug} subject={s} />)}
        </div>
      </Section>

      {/* ── 5. the learning system ────────────────────────────────────── */}
      <Section
        id="how"
        title="Learn → Practise → Get marked → Improve"
        lede="Ailemy knows what you have studied, what you attempted, where you lost marks and what to do next."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Learn", "Specification-mapped lessons and expert live teaching."],
            ["Practise", "Topic questions, worksheets and full past papers."],
            ["Get marked", "Submit an answer and see it marked against the mark scheme, with feedback."],
            ["Improve", "Weak areas are identified and you are pointed at what to practise next."],
          ].map(([step, body], i) => (
            <li key={step} className="rounded-lg border border-ink/10 bg-snow p-6">
              <span className="font-mono text-[11px] text-ink/40">0{i + 1}</span>
              <h3 className="font-display mt-3 text-xl font-medium">{step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── 6. live tuition ───────────────────────────────────────────── */}
      <Section
        id="tuition"
        title="Learn live with Ailemy"
        lede="Small-group science tuition built around the exact specification and exam requirements."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {chemistryCohorts.map((c) => <CohortCard key={c.slug} cohort={c} />)}
        </div>
        {/* ⚠ 1-TO-1 IS OFF-MENU (§24) — mentioned, deliberately not priced
            beside the group cohorts, where it would undercut the offer. */}
        <p className="mt-6 text-sm text-ink/60">
          Looking for something else?{" "}
          <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
            One-to-one Chemistry is available in limited blocks
          </Link>
          .
        </p>
      </Section>

      {/* ── 7. interactive past papers ────────────────────────────────── */}
      <Section
        id="papers"
        title="Don't just download a past paper. Do it."
        lede="Choose a subject, qualification, unit and series — then sit it question by question."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-ink/10 bg-snow p-6">
            <h3 className="font-display text-xl font-medium">Sit it interactively</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Answer question by question. Your responses are captured, marked against the
              mark scheme, and turned into topic performance you can act on.
            </p>
            <Link href="/past-papers" className="mt-4 inline-block text-sm underline underline-offset-2">
              Browse past papers →
            </Link>
          </div>
          <div className="rounded-lg border border-ink/10 bg-snow p-6">
            <h3 className="font-display text-xl font-medium">Or read the PDFs</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Question paper, mark scheme and examiner report remain one click away. Being
              better than a download repository does not mean removing the downloads.
            </p>
            <Link href="/past-papers" className="mt-4 inline-block text-sm underline underline-offset-2">
              View papers →
            </Link>
          </div>
        </div>
      </Section>

      {/* ── 8. the mark scheme ────────────────────────────────────────── */}
      <Section
        id="marks"
        title="Understand the mark scheme, not just the topic."
        lede="Submit an answer. See where the marks were won and lost."
      >
        <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
          <ol className="space-y-3 text-sm leading-relaxed text-ink/75">
            <li><span className="font-mono text-[11px] text-ink/40">01</span>  Your answer, as you wrote it.</li>
            <li><span className="font-mono text-[11px] text-ink/40">02</span>  The phrase that earned the mark, highlighted.</li>
            <li><span className="font-mono text-[11px] text-ink/40">03</span>  The mark-scheme criterion it satisfied — or did not.</li>
            <li><span className="font-mono text-[11px] text-ink/40">04</span>  What would have earned the mark you missed.</li>
          </ol>
        </div>
      </Section>

      {/* ── 9. progress ───────────────────────────────────────────────── */}
      <Section
        id="progress"
        title="Know exactly what you know — and what still needs work."
        lede="Specification-level progress, built from the questions you have actually attempted."
      >
        {/* ⚠ CLEARLY LABELLED AS AN EXAMPLE. These are not anyone's results. */}
        <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
            Example view · IAL Chemistry AS
          </p>
          <ul className="mt-5 space-y-3">
            {[["Atomic Structure", 100], ["Bonding", 82], ["Energetics", 56], ["Kinetics", 31]].map(
              ([topic, pct]) => (
                <li key={topic as string} className="flex items-center gap-4">
                  <span className="w-40 shrink-0 text-sm">{topic}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-ink/10">
                    <span className="block h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-ink/60">{pct}%</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </Section>

      {/* ── 10. resource library ──────────────────────────────────────── */}
      <Section id="resources" title="Everything for your course" lede="Structured by specification, not by folder.">
        <ul className="flex flex-wrap gap-2">
          {[
            ["Lessons", true], ["Revision notes", true], ["Topic questions", true],
            ["Past papers", true], ["Mark schemes", true], ["Examiner reports", true],
            ["Interactive papers", true], ["Worksheets", false], ["Videos", false],
          ].map(([label, ready]) => (
            <li
              key={label as string}
              className={`rounded-full border px-4 py-2 text-sm ${
                ready ? "border-ink/15 bg-snow" : "border-ink/10 bg-transparent text-ink/45"
              }`}
            >
              {label}{ready ? "" : " · coming soon"}
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 11. Biology / Physics interest ────────────────────────────── */}
      <Section
        id="other-sciences"
        title="Looking for another science?"
        lede="We open new Biology and Physics cohorts based on student demand. Register for priority access."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SUBJECTS.filter((s) => s.status === "interest").map((s) => (
            <div key={s.slug} className="rounded-lg border border-ink/10 bg-snow p-6">
              <h3 className="font-display text-xl font-medium">{s.name}</h3>
              <p className="mt-1 font-mono text-[11px] text-ink/50">{s.qualifications.join(" · ")}</p>
              <Link
                href={`/tuition/interest?subject=${s.slug}`}
                className="mt-4 inline-block rounded-full border border-ink/20 px-4 py-2 text-sm hover:border-ink/40"
              >
                Register interest →
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 12. teacher credibility ───────────────────────────────────── */}
      {/* ⚠ NO TESTIMONIALS, RATINGS OR STUDENT COUNTS. None exist in the data,
          and an empty section is better than invented credibility (§17). The
          claim below is about mark-scheme expertise, NOT examiner employment. */}
      <Section id="teachers" title="Built by teachers who understand the exam.">
        <div className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8">
          <p className="max-w-3xl text-sm leading-relaxed text-ink/75">
            Ailemy's Chemistry teaching and mark schemes are prepared by a specialist chemistry
            teacher working directly from the published Edexcel mark schemes — every marking
            point on every paper read, ruled on and recorded before a single question is marked.
          </p>
        </div>
      </Section>

      {/* ── 13. final CTA ─────────────────────────────────────────────── */}
      <Section id="start" title="Ready to improve your grade?">
        <div className="flex flex-wrap gap-3">
          <Link href="/tuition" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90">
            Join live tuition →
          </Link>
          <Link href="/past-papers" className="rounded-full border border-ink/20 px-6 py-3 text-sm font-medium hover:border-ink/40">
            Explore free resources →
          </Link>
        </div>
      </Section>

      {/* 14 */} <SiteFooter />
    </div>
  );
}

/** One rhythm for every band, so the page reads as one document. */
function Section({
  id, title, lede, children,
}: { id: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-ink/10 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-display max-w-3xl text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
        {lede && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/65 sm:text-base">{lede}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function SubjectCard({ subject }: { subject: Subject }) {
  const LABEL: Record<Subject["status"], string> = {
    available: "Available",
    expanding: "Expanding",
    interest: "Register interest",
  };
  return (
    <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-7">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        {LABEL[subject.status]}
      </span>
      <h3 className="font-display mt-3 text-2xl font-medium tracking-tight">{subject.name}</h3>
      <p className="mt-1 font-mono text-[11px] text-ink/50">{subject.qualifications.join(" · ")}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/70">{subject.blurb}</p>
      {/* ⚠ NO "Explore" WHERE THERE IS NOTHING TO EXPLORE. exploreHref is null
          for Biology and Physics, and a link that goes nowhere is the fake
          functionality §32 forbids. */}
      <Link
        href={subject.exploreHref ?? `/tuition/interest?subject=${subject.slug}`}
        className="mt-6 text-sm underline underline-offset-2 hover:text-ink"
      >
        {subject.exploreHref ? `Explore ${subject.name} →` : "Register interest →"}
      </Link>
    </div>
  );
}

function CohortCard({ cohort }: { cohort: Cohort }) {
  const cta = ctaFor(cohort);
  return (
    <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-7">
      <h3 className="font-display text-xl font-medium tracking-tight">{cohort.title}</h3>
      <p className="mt-2 font-display text-2xl">{priceLabel(cohort)}</p>
      <p className="mt-1 font-mono text-[11px] text-ink/55">
        {cohort.hoursPerWeek} live hrs/week · {cohort.sessionsPerWeek} sessions · cap {cohort.seatCap}
      </p>
      {/* ⚠ ONLY WHERE A TIMETABLE ACTUALLY EXISTS. Y10 and Y11 are
          demand-triggered and publish none; inventing days would be a promise
          nobody made. */}
      {cohort.scheduleSummary && (
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{cohort.scheduleSummary}</p>
      )}
      {cohort.onboardingOn && cohort.firstClassOn && (
        <p className="mt-2 font-mono text-[11px] text-ink/55">
          Onboarding {fmt(cohort.onboardingOn)} · first class {fmt(cohort.firstClassOn)}
        </p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-ink/70">{cohort.summary}</p>
      <ul className="mt-4 flex-1 space-y-1 text-sm text-ink/65">
        {cohort.features.map((f) => <li key={f}>· {f}</li>)}
      </ul>
      <Link
        href={cta.href}
        className="mt-6 inline-block rounded-full border border-ink/20 px-4 py-2 text-center text-sm hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {cta.label} →
      </Link>
    </div>
  );
}

/** "2026-09-13" → "Sun 13 Sep 2026", without pulling in a date library. */
function fmt(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
