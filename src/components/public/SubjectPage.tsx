import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS, FALLBACK_COHORTS, ctaFor, priceLabel } from "@/lib/public/catalogue";

/**
 * One subject page, rendered for all three sciences.
 *
 * ============================================================================
 * ⚠ ONE COMPONENT, NOT THREE COPIES (§21)
 * ============================================================================
 * /chemistry, /biology and /physics are three-line route files that call this.
 * Triplicated JSX is how three pages drift: a fix lands on Chemistry, and
 * Biology keeps the bug for a year because nobody remembers it is a separate
 * file.
 *
 * ⚠ THE PARTIAL STATE IS A FIRST-CLASS RENDERING, NOT A DEGRADED ONE. Biology
 * and Physics have no resources. The page says so plainly and offers the thing
 * that IS real — registering interest — rather than showing empty shelves or
 * pretending the shelves are full.
 *
 * ⚠ QUALIFICATIONS ARE LISTED, NOT LINKED, until the routes behind them exist.
 * GCSE and International GCSE are shown as distinct entries (§22): they share
 * teaching, they are not the same qualification, and collapsing them in the UI
 * is how they end up collapsed in the data.
 */
export async function SubjectPage({ slug }: { slug: string }) {
  const session = await getNavSession();
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) return null;

  const cohorts = FALLBACK_COHORTS.filter((c) => c.subject === slug);
  const hasResources = subject.status === "available" && subject.exploreHref !== null;

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />

      <header className="mx-auto max-w-6xl px-6 pt-14 pb-10 sm:pt-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Pearson Edexcel
        </p>
        <h1 className="font-display mt-4 text-4xl font-medium tracking-tight sm:text-5xl">
          {subject.name}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">{subject.blurb}</p>
      </header>

      {/* ── qualifications ─────────────────────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Qualifications</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subject.qualifications.map((q) => (
              <li key={q} className="rounded-lg border border-ink/10 bg-snow p-5">
                <p className="font-display text-lg font-medium">{q}</p>
                <p className="mt-1 font-mono text-[11px] text-ink/50">
                  {hasResources ? "Resources available" : "Register interest"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── resources, or an honest absence ────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Resources</h2>
          {hasResources ? (
            <>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
                Lessons, topic questions, past papers, mark schemes and examiner reports,
                organised by specification.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={subject.exploreHref!}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90"
                >
                  Browse {subject.name} →
                </Link>
                <Link
                  href="/past-papers"
                  className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium hover:border-ink/40"
                >
                  Past papers →
                </Link>
              </div>
            </>
          ) : (
            /* ⚠ NO EMPTY GRID, NO "Start learning" BUTTON. Saying there is
               nothing yet costs one sentence; a button that opens an empty
               shelf costs the visitor's trust. */
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
              {subject.name} resources are not published yet. Chemistry is complete and the
              same structure is being built for {subject.name} — register interest and we
              will tell you when it lands.
            </p>
          )}
        </div>
      </section>

      {/* ── tuition ────────────────────────────────────────────────────── */}
      <section className="border-t border-ink/10 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-2xl font-medium tracking-tight">Live tuition</h2>
          {cohorts.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {cohorts.map((c) => {
                const cta = ctaFor(c);
                return (
                  <div key={c.slug} className="flex flex-col rounded-lg border border-ink/10 bg-snow p-6">
                    <h3 className="font-display text-lg font-medium">{c.title}</h3>
                    <p className="mt-2 font-display text-xl">{priceLabel(c)}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink/55">
                      {c.hoursPerWeek} hrs/week · cap {c.seatCap}
                    </p>
                    {c.scheduleSummary && (
                      <p className="mt-3 text-sm leading-relaxed text-ink/70">{c.scheduleSummary}</p>
                    )}
                    <Link
                      href={cta.href}
                      className="mt-auto pt-5 text-sm underline underline-offset-2 hover:text-ink"
                    >
                      {cta.label} →
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3">
              <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
                We open {subject.name} cohorts based on demand. Register and you will be first
                to hear when one is scheduled.
              </p>
              <Link
                href={`/tuition/interest?subject=${subject.slug}`}
                className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90"
              >
                Register interest →
              </Link>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Shared metadata builder, so three routes describe themselves consistently. */
export function subjectMetadata(slug: string) {
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) return {};
  return {
    title: `${subject.name} — Ailemy`,
    description: `${subject.blurb} Pearson Edexcel ${subject.qualifications.join(", ")}.`,
  };
}
