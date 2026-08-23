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
              <Editable id="learn.subject.pathway_prompt" default="Choose your pathway" />
            </p>
          </header>

          {/* ⚠ TWO COLUMNS, NOT THREE. Six cards filled a 3-wide grid exactly;
              four leave a 3-wide grid with a single orphan on the second row,
              which reads as a card that failed to load. A 2×2 also gives each
              remaining card enough width that "International A-Level" stops
              wrapping to three lines at the xl breakpoint. */}
          <section className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-6">
            {VISIBLE_PATHWAYS.map((pathway) => (
              <PathwayCard
                key={pathway}
                pathway={pathway}
                pathwayStatus={pathwayStatuses[pathway]}
                subject={subject}
              />
            ))}
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
