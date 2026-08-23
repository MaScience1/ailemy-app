import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import {
  PATHWAY_COPY,
  PATHWAY_DISPLAY_ORDER,
  type Pathway,
} from "@/lib/catalogue/pathways";
import {
  getPathwayStatusForSubject,
  getSubjectBySlug,
  type PathwayStatus,
} from "@/lib/catalogue/queries";
import {
  deriveStatus,
  getStatusBadge,
  getStatusCta,
} from "@/lib/catalogue/status";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { getSubjectCopy } from "@/lib/catalogue/subject-descriptions";
import type { Subject } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils";
import { Editable } from "@/components/admin-inline/Editable";
import { ChoiceCard } from "@/components/qualifications/ChoiceCard";
import { SavedQualification } from "@/components/qualifications/SavedQualification";
import { SupportBadge } from "@/components/qualifications/SupportBadge";
import { LEVELS, LEVEL_COPY, LEVEL_PATHWAYS } from "@/lib/qualifications/model.ts";

type Params = Promise<{ subject: string }>;

/**
 * Pathways this page does not offer.
 *
 * ============================================================================
 * ⚠ HIDDEN HERE, NOT DELETED (founder's call, 2026-08-23)
 * ============================================================================
 * The six pathway cards are NOT database rows. They come from
 * PATHWAY_DISPLAY_ORDER, a hardcoded constant in lib/catalogue/pathways.ts —
 * getPathwayStatusForSubject() only supplies the counts, and it seeds a
 * complete record from those same hardcoded keys, so IB and AP render as
 * "Coming soon" whether or not a single `courses` row exists for them. There is
 * therefore no row to delete and no migration to write.
 *
 * They are filtered out because Ailemy teaches no IB or AP content and none is
 * being built. "Coming soon" on a pathway nobody is working on is a promise the
 * catalogue cannot keep, and it is the same untruth whether it comes from a
 * table or from a constant.
 *
 * ⚠ THE SLUGS, THE pathway_type ENUM AND ANY courses ROWS ARE UNTOUCHED.
 * /learn/[subject]/ib and /learn/[subject]/ap still resolve for anyone holding
 * a URL — the demote-don't-delete stance the archived-lesson listing already
 * uses. Editing PATHWAY_DISPLAY_ORDER instead would ALSO strip the IB and AP
 * headings from /past-papers, which is a different surface with real papers
 * under it and a decision nobody has made.
 *
 * ⚠ AND NOTHING TAKES THEIR PLACE. No placeholder card, no "more pathways
 * coming" tile — the grid is simply four.
 */
const HIDDEN_PATHWAYS: readonly Pathway[] = ["ib", "ap"];

const VISIBLE_PATHWAYS = PATHWAY_DISPLAY_ORDER.filter(
  (pathway) => !HIDDEN_PATHWAYS.includes(pathway),
);

/**
 * The level card's badge, translated from the catalogue's own three-state
 * status so this page keeps ONE derivation and not two.
 *
 * ⚠ "available" BECOMES "Supported", NOT "Full support". Full support is a
 * claim about one exam board having the whole apparatus — lessons, papers,
 * marking — and a level spans several boards of very different depth. The
 * per-board step is where that finer claim is made, from that board's own
 * counts.
 */
const LEVEL_BADGE = {
  available: "supported",
  preview: "expanding",
  coming_soon: "coming_soon",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { subject: subjectSlug } = await params;
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    return { title: "Subject not found · Ailemy" };
  }
  return {
    title: `${subject.name} pathways · Ailemy`,
    description: getSubjectCopy(subject.slug).description,
  };
}

export default async function SubjectPage({ params }: { params: Params }) {
  const { subject: subjectSlug } = await params;
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const pathwayStatuses = await getPathwayStatusForSubject(subject.id);
  const copy = getSubjectCopy(subject.slug);

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              <Editable id="learn.subject.eyebrow" default="Subject" />
            </p>
            <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {subject.name}.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              <Editable
                id={`learn.subject.${subject.slug}.description`}
                default={copy.description}
              />
            </p>
            <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
              <Editable id="learn.subject.pathway_prompt" default="Choose your level" />
            </p>
          </header>

          {/* ⚠ TWO CARDS, NOT FOUR — THE FIRST CHOICE IS A LEVEL (§CORE).
              Asking a student to pick between "UK GCSE", "International GCSE",
              "UK A-Level" and "International A-Level" makes them answer two
              questions at once, and the one they can always answer instantly
              is the level. UK-vs-international is the next screen, where it is
              the only thing being asked.

              ⚠ THE FOUR PATHWAY ROUTES STILL EXIST AND STILL WORK. Nothing was
              deleted: /learn/chemistry/international-a-level and its siblings
              resolve exactly as before, and the board step links straight to
              them. This page changed which door it opens, not which doors
              exist. */}
          {/* §17 — if they have chosen before, offer the way back in first. */}
          <SavedQualification subjectSlug={subject.slug} subjectName={subject.name} />

          <section className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-6">
            {LEVELS.map((level) => {
              const copy = LEVEL_COPY[level];
              const counts = LEVEL_PATHWAYS[level].reduce(
                (acc, p) => {
                  const st = pathwayStatuses[p];
                  return {
                    total: acc.total + st.totalLessons,
                    live: acc.live + st.liveLessons,
                    courses: acc.courses + st.courseCount,
                  };
                },
                { total: 0, live: 0, courses: 0 },
              );
              const status = deriveStatus({
                totalLessons: counts.total,
                liveLessons: counts.live,
              });
              return (
                <ChoiceCard
                  key={level}
                  href={`/learn/${subject.slug}/${level}`}
                  eyebrow={copy.ageRange}
                  title={`${copy.name} ${subject.name}`}
                  subtitle={copy.subtitle}
                  description={copy.description}
                  badge={<SupportBadge status={LEVEL_BADGE[status]} />}
                  footnote={
                    counts.courses > 0 ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                        {counts.courses} {counts.courses === 1 ? "course" : "courses"}
                        {counts.total > 0 && ` · ${counts.live} of ${counts.total} lessons published`}
                      </span>
                    ) : null
                  }
                  ctaLabel={`Explore ${copy.name} →`}
                />
              );
            })}
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * Pathway card. Same three-tier derived status model as subject cards:
 *   available   — at least one lesson under this pathway+subject is live
 *   preview     — lessons seeded but none live yet (curriculum browseable)
 *   coming_soon — no lessons under any course in this pathway
 */
function PathwayCard({
  pathway,
  pathwayStatus,
  subject,
}: {
  pathway: Pathway;
  pathwayStatus: PathwayStatus;
  subject: Subject;
}) {
  const copy = PATHWAY_COPY[pathway];
  const status = deriveStatus(pathwayStatus);
  const href = `/learn/${subject.slug}/${pathway}`;

  const badge = getStatusBadge(status);
  const cta = getStatusCta(status, `Explore ${copy.shortName} →`);

  const isClickable = !cta.isDisabled;

  const cardClass = cn(
    "group/path flex h-full flex-col justify-between gap-8 rounded-xl border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out sm:p-7",
    isClickable && "hover:-translate-y-1 hover:border-[var(--subject-accent)]",
    status === "preview" && "text-ink/85",
    status === "coming_soon" && "cursor-not-allowed opacity-70",
  );

  const Body = (
    <>
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            {copy.ageRange}
          </p>
          <span
            className={cn(
              "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>

        <h2 className="font-display mt-6 text-2xl font-medium tracking-tight md:text-3xl">
          {copy.name}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">
          {copy.description}
        </p>
        {status !== "coming_soon" && pathwayStatus.courseCount > 0 && (
          <p className="font-mono mt-3 text-[10px] uppercase tracking-[0.2em] text-ink/45">
            {pathwayStatus.courseCount}{" "}
            {pathwayStatus.courseCount === 1 ? "course" : "courses"}
          </p>
        )}
      </div>

      <div className="text-sm font-medium">
        {status === "available" && (
          <span className="inline-flex items-center gap-2 text-ink transition-transform duration-300 group-hover/path:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight
              className="h-4 w-4 text-[var(--subject-accent)]"
              aria-hidden="true"
            />
          </span>
        )}
        {status === "preview" && (
          <span className="inline-flex items-center gap-2 text-ink/80 transition-transform duration-300 group-hover/path:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight
              className="h-4 w-4 text-[var(--subject-accent)]"
              aria-hidden="true"
            />
          </span>
        )}
        {status === "coming_soon" && (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            {cta.label}
          </span>
        )}
      </div>
    </>
  );

  if (!isClickable) {
    return (
      <div className={cardClass} aria-disabled="true">
        {Body}
      </div>
    );
  }

  return (
    <Link href={href} className={cardClass}>
      {Body}
    </Link>
  );
}
