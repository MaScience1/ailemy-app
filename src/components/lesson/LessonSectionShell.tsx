import { SectionComplete } from "./LessonProgress";
import { SECTION_META, type LessonSectionKey } from "@/lib/lesson/sections.ts";

/**
 * One lesson section: anchor, heading, body, completion control.
 *
 * ============================================================================
 * ⚠ EVERY SECTION STANDS ON ITS OWN (§89, §R4)
 * ============================================================================
 * Sections used to be nested inside the deck section, so a lesson with no
 * published deck — or a deck whose manifest failed to load — rendered NO
 * practice, NO video and no placeholder either: one missing file silently
 * removed three unrelated parts of the page. Each section is now mounted
 * independently by the page and does its own presence check, so a missing
 * video cannot hide the notes and a broken deck cannot hide the practice.
 *
 * ⚠ AN ABSENT SECTION IS COMPACT, NEVER A 500px HOLE (§90). Unavailable
 * content gets one honest line and, where there is one, a pointer to what the
 * student can do instead. It never gets a hero-sized "Coming soon" that
 * dominates the lesson.
 */

export function LessonSection({
  section,
  title,
  lede,
  meta,
  children,
  completable = true,
}: {
  section: LessonSectionKey;
  /** Overrides the default section label where the page wants a fuller title. */
  title?: string;
  lede?: React.ReactNode;
  /** Small mono line under the heading — counts, spec codes, sources. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  /** False for a section with nothing in it — there is nothing to complete. */
  completable?: boolean;
}) {
  const m = SECTION_META[section];
  return (
    <section
      id={m.anchor}
      aria-labelledby={`${m.anchor}-heading`}
      className="scroll-mt-24 outline-none"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/40">{m.stage}</p>
          <h2
            id={`${m.anchor}-heading`}
            className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-[1.75rem]"
          >
            {title ?? m.label}
          </h2>
        </div>
        {meta && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">{meta}</p>
        )}
      </div>

      {lede && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">{lede}</p>}

      <div className="mt-5">{children}</div>

      {completable && (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <SectionComplete section={section} />
        </div>
      )}
    </section>
  );
}

/**
 * The compact unavailable state (§90) — one line, honest, never a dead end.
 *
 * ⚠ `next` IS NOT DECORATION. A student who arrives at an empty section should
 * leave it knowing what to do instead; an empty box that says only "coming
 * soon" spends their attention and returns nothing.
 */
export function SectionUnavailable({ what, next }: { what: string; next?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-3">
      <p className="text-sm text-ink/60">{what}</p>
      {next && <p className="mt-1 text-sm text-ink/70">{next}</p>}
    </div>
  );
}
