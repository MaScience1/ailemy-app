import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import {
  LEVEL_COPY,
  QUALIFICATION_SCOPES,
  SCOPE_COPY,
  SCOPE_PATHWAY,
  qualificationName,
  type Level,
  type QualificationScope,
} from "@/lib/qualifications/model.ts";
import { boardsForLevel, coverageForScope } from "@/lib/qualifications/reader.ts";
import { ChoiceCard } from "./ChoiceCard";
import { CapabilityChips, FlagshipMark, SupportBadge } from "./SupportBadge";
import { QualificationTracker } from "./QualificationTracker";

/**
 * Steps 3 and 4 of the flow (§23): "which qualification?" then "which board?".
 *
 * ============================================================================
 * ⚠ PROGRESSIVE DISCLOSURE, NOT A SETUP WIZARD (§23)
 * ============================================================================
 * Two choices per screen, each reversible by the breadcrumb above it. There
 * is no progress meter, no "step 3 of 5", and no state to lose — every step is
 * a plain URL a student can bookmark, share or back out of.
 *
 * ⚠ COUNTRY NEVER DECIDES ANY OF THIS (§12). Nothing here reads a locale, an
 * IP or a timezone. A student in Doha may sit Edexcel IAL, Cambridge or AQA
 * depending only on what their school entered them for, so the question is
 * asked and the answer is theirs.
 */

export async function QualificationStep({
  subjectSlug,
  level,
}: {
  subjectSlug: string;
  level: Level;
}) {
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const levelCopy = LEVEL_COPY[level];
  const { boards, error } = await boardsForLevel(subjectSlug, level);

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-16">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              { label: levelCopy.name },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              {subject.name}
            </p>
            <h1 className="font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {levelCopy.name} {subject.name}.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              {levelCopy.description}
            </p>
            <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
              Which qualification are you studying?
            </p>
          </header>

          <section className="mt-8 grid gap-5 md:grid-cols-2 lg:gap-6">
            {QUALIFICATION_SCOPES.map((scope) => (
              <ChoiceCard
                key={scope}
                href={`/learn/${subject.slug}/${level}/${scope}`}
                eyebrow={SCOPE_COPY[scope].name}
                title={qualificationName(level, scope)}
                description={SCOPE_COPY[scope].description}
                ctaLabel="Choose exam board →"
              />
            ))}
          </section>

          {/* §41 — the boards that exist under this level, with the truth
              about each. Rendered as text, not as a promise. */}
          {error ? (
            <p role="alert" className="mt-8 text-sm text-ink/70">
              Support levels could not be loaded just now — {error}
            </p>
          ) : boards.length > 0 ? (
            <section className="mt-10 border-t border-ink/10 pt-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
                Exam boards at this level
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {boards.map((b) => (
                  <li key={b.board} className="flex items-center gap-3 text-sm">
                    <SupportBadge status={b.status} />
                    <span className="text-ink/75">{b.boardName}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-xl text-xs leading-relaxed text-ink/50">
                Support differs by board and by qualification — choose yours above to see
                exactly what is available.
              </p>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/**
 * Step 4: the exam boards for one (level, scope), each with a DERIVED status.
 */
export async function BoardStep({
  subjectSlug,
  level,
  scope,
}: {
  subjectSlug: string;
  level: Level;
  scope: QualificationScope;
}) {
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const levelCopy = LEVEL_COPY[level];
  const pathway = SCOPE_PATHWAY[level][scope];
  const { boards, error } = await coverageForScope(subjectSlug, level, scope);

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-16">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              { label: levelCopy.name, href: `/learn/${subject.slug}/${level}` },
              { label: qualificationName(level, scope) },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              {levelCopy.name} · {subject.name}
            </p>
            <h1 className="font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {qualificationName(level, scope)}.
            </h1>
            <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
              Choose your exam board
            </p>
          </header>

          {error && (
            <p role="alert" className="mt-8 rounded border border-ink/15 bg-ink/[0.03] px-4 py-3 text-sm text-ink/75">
              Exam board support could not be loaded just now — {error}
            </p>
          )}

          {!error && boards.length === 0 && (
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink/65">
              No exam boards are mapped to {qualificationName(level, scope)} {subject.name} yet.
            </p>
          )}

          <section className="mt-8 grid gap-5 md:grid-cols-2 lg:gap-6">
            {boards.map((b) => {
              const usable = b.status !== "coming_soon";
              return (
                <ChoiceCard
                  key={b.board}
                  /* ⚠ THE DESTINATION IS THE EXISTING PATHWAY ROUTE, UNCHANGED.
                     No board-specific leaf page is invented: a page for a board
                     with no content would be exactly the thin doorway §26
                     forbids, and the pathway page already lists that board's
                     courses grouped by curriculum. */
                  href={usable ? `/learn/${subject.slug}/${pathway}` : null}
                  eyebrow={b.curriculumName}
                  title={b.boardName}
                  badge={<SupportBadge status={b.status} />}
                  meta={<CapabilityChips capabilities={b.capabilities} />}
                  footnote={
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {b.isFlagship && <FlagshipMark />}
                      {/* ⚠ THE REAL NUMBERS, BESIDE THE BADGE. "Full support"
                          describes which capabilities work, not how much is
                          written — so the count says how much is written. */}
                      {b.counts.lessons > 0 && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
                          {b.counts.liveLessons} of {b.counts.lessons} lessons published
                        </span>
                      )}
                    </div>
                  }
                  trackAs={b.curriculumSlug}
                  ctaLabel={b.status === "expanding" ? "Browse curriculum →" : "Continue →"}
                  disabled={!usable}
                  disabledLabel="Coming soon"
                />
              );
            })}
          </section>

          {/* §19 — "I'm not sure" never blocks anybody. */}
          <section className="mt-10 border-t border-ink/10 pt-6">
            <h2 className="font-display text-lg font-medium tracking-tight">
              Not sure which board you sit?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/65">
              Your exam board is on your school&rsquo;s course information, and usually printed
              on a past paper your teacher has given you. Until you know, the qualification
              page below shows everything available at this level — the teaching is the same
              far more often than it differs.
            </p>
            <a
              href={`/learn/${subject.slug}/${pathway}`}
              data-qualification-choice="unsure"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Show me everything at this level →
            </a>
          </section>

          <QualificationTracker
            subject={subject.slug}
            level={level}
            scope={scope}
            boards={boards.map((b) => b.board)}
          />
        </div>
      </main>
    </div>
  );
}
