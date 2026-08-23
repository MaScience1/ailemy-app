"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

import type {
  SubjectTree, LevelNode, ScopeNode, BoardNode, CourseNode,
} from "@/lib/qualifications/tree";
import type { SupportStatus, Capability } from "@/lib/qualifications/support";
import { CAPABILITY_LABEL } from "@/lib/qualifications/support";
import { readPreference, writePreference } from "@/lib/qualifications/preference";

/**
 * Level → Qualification → Board → Course, one decision at a time (§3, §15).
 *
 * ============================================================================
 * ⚠ THIS REPLACES A FLAT GRID OF FOURTEEN CARDS, AND THE POINT IS THE ORDER
 * ============================================================================
 * The old page put "Edexcel IAL AS Chemistry", "AP Chemistry", "IB Chemistry
 * HL" and eleven others on one screen as equals. That asked a fifteen-year-old
 * to hold four independent dimensions in their head at once — academic level,
 * UK vs international, exam board, and course stage — and to know Ailemy's
 * catalogue well enough to find the intersection. The catalogue is allowed to
 * be complicated; the question put to the student is not.
 *
 * ⚠ NOTHING HERE KNOWS ANY COURSE NAME. The whole tree arrives as a prop from
 * loadSubjectTree(), which reads the real tables. This component decides what
 * to ASK, never what exists — so a fifteenth course appears without anyone
 * editing this file, and a course that is removed stops being offered.
 *
 * ⚠ IT IS SUBJECT-AGNOSTIC BY CONSTRUCTION (§28). There is no "chemistry"
 * anywhere in it: colour comes from the --subject-* CSS variables the page
 * sets, and structure comes from the tree. <CourseSelector> over Biology
 * renders Biology's real shape, including the case where that shape is much
 * smaller.
 *
 * ⚠ A STEP WITH ONE ANSWER IS NOT A STEP (§3, §15). Where a level has one
 * scope, or a scope has one board, the selector resolves it and moves on
 * rather than rendering a row containing a single button. This is why
 * International A-Level goes straight to AS/A2: Edexcel is the only board
 * there, so "which board?" has no information in it.
 *
 * ⚠ ONLY THE FINAL CHOICE NAVIGATES (§15, §31). Every intermediate step is
 * local state, so the page never reloads mid-decision; the last click goes to
 * the course's existing /resources/<subject>/<course> URL, unchanged (§37).
 */

const STATUS_LABEL: Record<SupportStatus, string> = {
  full_support: "Full support",
  supported: "Supported",
  expanding: "Expanding",
  coming_soon: "Coming soon",
};

/**
 * ⚠ STATUS IS NEVER COLOUR ALONE (§36). Each status renders its WORD; the
 * tint only reinforces it. A student who cannot distinguish the accent from
 * the neutral still reads "Coming soon".
 */
function StatusChip({ status }: { status: SupportStatus }) {
  const strong = status === "full_support" || status === "supported";
  return (
    <span
      className={[
        "font-mono shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
        strong
          ? "bg-[var(--subject-tint)] text-[var(--subject-text)]"
          : "bg-ink/[0.05] text-ink/50",
      ].join(" ")}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * §23 — only capabilities that genuinely exist for this route.
 *
 * ⚠ TUITION IS FILTERED OUT HERE, AND IT SHIPPED WRONG ONCE (§6, §40).
 * `capabilitiesFor` includes "tuition" wherever a cohort runs, which is
 * correct for the qualification pages — and wrong on every Resources surface,
 * where §40 forbids tuition of any kind. The first version of this component
 * rendered "Lessons · Practice · Past papers · Marking · Progress · Live
 * tuition" under Edexcel IAL AS: not a CTA, but tuition advertised inside the
 * study library all the same.
 *
 * It is filtered at the RENDER, not at the source, because the tree is shared
 * with surfaces where the chip is legitimate. Resources declines to show it.
 */
function Capabilities({ list }: { list: Capability[] }) {
  const shown = list.filter((c) => c !== "tuition");
  if (shown.length === 0) return null;
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-ink/55">
      {shown.map((c) => CAPABILITY_LABEL[c]).join(" · ")}
    </p>
  );
}

/**
 * One selectable option.
 *
 * ⚠ A <button>, NOT A DIV WITH onClick (§36). It is focusable, it responds to
 * Enter and Space for free, and `aria-pressed` announces the selection to a
 * screen reader — none of which a styled div gets without reimplementing it
 * badly.
 *
 * ⚠ SELECTED IS A TINT AND A BORDER, NOT A FILL (§20). A solid orange card
 * would fight the cream ground the rest of the product is built on, and at
 * four-across it would dominate the page it is meant to simplify.
 */
function Option({
  label, sublabel, status, selected, onClick, size = "normal", cta, capabilities, flagship,
}: {
  label: string;
  sublabel?: string | null;
  status?: SupportStatus;
  selected: boolean;
  onClick: () => void;
  /** Primary decisions read stronger than the ones after them (§16). */
  size?: "primary" | "normal" | "compact";
  cta: string;
  capabilities?: Capability[];
  flagship?: boolean;
}) {
  const pad =
    size === "primary" ? "px-5 py-4" : size === "compact" ? "px-4 py-2.5" : "px-4 py-3";
  const type =
    size === "primary"
      ? "font-display text-lg font-medium tracking-tight"
      : "text-sm font-medium";

  return (
    <button
      type="button"
      onClick={onClick}
      data-cta={cta}
      aria-pressed={selected}
      className={[
        // ⚠ NO w-full HERE, AND THAT IS DELIBERATE. Grid children stretch to their
        // cell already, so the level and board rows are unaffected; the
        // qualification row is a flex-wrap row, where w-full made each option a
        // full-width bar and turned "[ UK ] [ International ]" into a stack —
        // the vertical wizard §18 explicitly warns against.
        "group relative flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border text-left",
        pad,
        "transition-all duration-200 ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        selected
          ? "border-[var(--subject-accent)] bg-[var(--subject-tint)]"
          : "border-ink/10 bg-snow hover:border-[var(--subject-accent)] motion-safe:hover:-translate-y-0.5",
      ].join(" ")}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className={`${type} text-ink`}>{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {status && <StatusChip status={status} />}
          {selected && (
            <Check aria-hidden className="h-4 w-4 text-[var(--subject-accent)]" />
          )}
        </span>
      </span>
      {sublabel && <span className="text-xs leading-relaxed text-ink/60">{sublabel}</span>}
      {/* §10/§23 — understated, and only while it is true. */}
      {flagship && (
        <span className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
          Most complete
        </span>
      )}
      {capabilities && <Capabilities list={capabilities} />}
    </button>
  );
}

/** A step's heading. Progressively quieter as the decisions get smaller (§16). */
function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">{children}</h3>
  );
}

export function CourseSelector({
  subject,
  subjectName,
  tree,
}: {
  subject: string;
  subjectName: string;
  tree: SubjectTree;
}) {
  const [level, setLevel] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [board, setBoard] = useState<string | null>(null);
  /** §25 — a saved choice is offered, never imposed; this opens the selector. */
  const [changing, setChanging] = useState(false);
  const [saved, setSaved] = useState<ReturnType<typeof readPreference>>(null);

  // ⚠ READ AFTER MOUNT, NOT DURING RENDER. localStorage does not exist on the
  // server, and reading it in render would make the first client paint differ
  // from the server's HTML — a hydration mismatch that React resolves by
  // throwing the markup away.
  useEffect(() => { setSaved(readPreference(subject)); }, [subject]);

  const levelNode: LevelNode | null = useMemo(
    () => tree.levels.find((l) => l.level === level) ?? null, [tree.levels, level],
  );

  /**
   * ⚠ THE SKIP RULES LIVE HERE, AS DERIVATIONS, NOT AS SPECIAL CASES.
   * A single option is resolved rather than rendered — see the header.
   */
  const scopes = levelNode?.scopes ?? [];
  const autoScope = scopes.length === 1 ? scopes[0] : null;
  const scopeNode: ScopeNode | null =
    autoScope ?? scopes.find((s) => s.scope === scope) ?? null;

  const boards = scopeNode?.boards ?? [];
  const autoBoard = boards.length === 1 ? boards[0] : null;
  const boardNode: BoardNode | null =
    autoBoard ?? boards.find((b) => b.curriculumSlug === board) ?? null;

  const courses = boardNode?.courses ?? [];
  /** A board with one course has no stage to choose — go straight there. */
  const singleCourse = courses.length === 1 ? courses[0] : null;

  const href = (c: CourseNode) => `/resources/${subject}/${c.slug}`;

  const remember = (c: CourseNode) => {
    if (!levelNode || !scopeNode || !boardNode) return;
    writePreference({
      subject,
      level: levelNode.level,
      scope: scopeNode.scope,
      curriculum: boardNode.curriculumSlug,
      course: c.slug,
    });
  };

  // ── §17 breadcrumb: context, and a way back ───────────────────────────────
  const trail: { label: string; onClick: () => void }[] = [];
  if (levelNode) {
    trail.push({ label: levelNode.name, onClick: () => { setScope(null); setBoard(null); } });
    if (scopeNode && !autoScope) {
      trail.push({ label: scopeNode.name, onClick: () => setBoard(null) });
    }
    if (boardNode && !autoBoard) trail.push({ label: boardNode.boardName, onClick: () => {} });
  }

  // ── §25 returning student ─────────────────────────────────────────────────
  const savedCourse = useMemo(() => {
    if (!saved?.course) return null;
    for (const l of tree.levels)
      for (const s of l.scopes)
        for (const b of s.boards) {
          const c = b.courses.find((x) => x.slug === saved.course);
          if (c) return { course: c, board: b };
        }
    return null;
  }, [saved, tree.levels]);

  if (savedCourse && !changing) {
    return (
      <section aria-labelledby="your-course">
        <h2 id="your-course" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
          Your {subjectName}
        </h2>
        <div className="mt-3 max-w-xl rounded-xl border border-[var(--subject-accent)] bg-[var(--subject-tint)] p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-medium tracking-tight">
              {savedCourse.course.name}
            </h3>
            <StatusChip status={savedCourse.course.status} />
          </div>
          <Capabilities list={savedCourse.course.capabilities} />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href={href(savedCourse.course)}
              data-cta="resources_course_selected"
              className="text-sm font-medium text-ink underline underline-offset-4"
            >
              Continue studying →
            </Link>
            {/* §25 — quieter, and it opens the selector rather than wiping the
                saved choice. Clearing on click would lose the student's course
                the instant they got curious about the alternatives. */}
            <button
              type="button"
              onClick={() => setChanging(true)}
              data-cta="resources_course_changed"
              className="cursor-pointer text-sm text-ink/60 underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Change course
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-7">
      {/* ── §17 selection trail ─────────────────────────────────────────── */}
      {trail.length > 0 && (
        <nav aria-label="Your selection" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink/55">
          <span>{subjectName}</span>
          {trail.map((t, i) => (
            <span key={t.label} className="flex items-center gap-1.5">
              <ChevronRight aria-hidden className="h-3 w-3 text-ink/30" />
              {i === trail.length - 1 ? (
                <span className="text-ink/75">{t.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={t.onClick}
                  /* ⚠ py-2.5 IS A TOUCH TARGET, NOT SPACING (§36). The trail
                     is deliberately small type (§17 — "context, not the
                     primary interface"), which left a 16px-tall tappable
                     control on a phone. The padding grows the hit area while
                     the type stays exactly as quiet as it was. */
                  className="-my-2.5 cursor-pointer py-2.5 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {t.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── 1. LEVEL ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="step-level">
        <StepLabel>
          <span id="step-level">Choose your level</span>
        </StepLabel>
        {/* §19 — two levels sit side by side on a phone; they do not need a
            four-column grid, and forcing one would make both unreadable. */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:max-w-2xl">
          {tree.levels.map((l) => (
            <Option
              key={l.level}
              size="primary"
              label={l.name}
              sublabel={l.subtitle}
              status={l.status}
              selected={level === l.level}
              cta="resources_level_selected"
              onClick={() => {
                setLevel(l.level === level ? null : l.level);
                setScope(null); setBoard(null);
              }}
            />
          ))}
        </div>
      </section>

      {/* ── 2. QUALIFICATION — skipped when there is only one ─────────────── */}
      {levelNode && scopes.length > 1 && (
        <section aria-labelledby="step-scope">
          <StepLabel><span id="step-scope">Which qualification?</span></StepLabel>
          <div className="mt-3 flex flex-wrap gap-3">
            {scopes.map((s) => (
              <Option
                key={s.scope}
                label={s.name}
                status={s.boards.length ? undefined : "coming_soon"}
                selected={scope === s.scope}
                cta="resources_qualification_selected"
                onClick={() => { setScope(s.scope === scope ? null : s.scope); setBoard(null); }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 3. EXAM BOARD — skipped when there is only one ────────────────── */}
      {scopeNode && boards.length > 1 && (
        <section aria-labelledby="step-board">
          <StepLabel><span id="step-board">Choose your exam board</span></StepLabel>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <Option
                key={b.curriculumSlug}
                label={b.boardName}
                status={b.status}
                flagship={b.isFlagship}
                capabilities={b.isFlagship ? b.capabilities : undefined}
                selected={board === b.curriculumSlug}
                cta="resources_board_selected"
                onClick={() => setBoard(b.curriculumSlug === board ? null : b.curriculumSlug)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. COURSE ────────────────────────────────────────────────────── */}
      {boardNode && (
        <section aria-labelledby="step-course">
          <StepLabel>
            <span id="step-course">
              {singleCourse ? "Your course" : `${boardNode.boardName} — which stage?`}
            </span>
          </StepLabel>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:max-w-3xl">
            {courses.map((c) => (
              <Link
                key={c.slug}
                href={href(c)}
                onClick={() => remember(c)}
                data-cta="resources_course_selected"
                className="group flex flex-col gap-0.5 rounded-xl border border-ink/10 bg-snow px-4 py-3.5 transition-all duration-200 ease-out hover:border-[var(--subject-accent)] motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {/* §11/§30 — the stage is the decision; the full course
                        name is context, not the label a student scans. */}
                    {c.stage ?? c.name}
                  </span>
                  <StatusChip status={c.status} />
                </span>
                {c.stage && <span className="text-xs text-ink/60">{c.name}</span>}
                {c.unitSummary && (
                  <span className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    {c.unitSummary}
                  </span>
                )}
                <Capabilities list={c.capabilities} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── OTHER QUALIFICATIONS (§2 founder ruling) ──────────────────────── */}
      {tree.other.length > 0 && (
        <section aria-labelledby="step-other" className="border-t border-ink/10 pt-6">
          <StepLabel><span id="step-other">Other qualifications</span></StepLabel>
          {/* ⚠ QUIETER ON PURPOSE, AND STILL REAL. IB and AP are not GCSEs or
              A-Levels, so they are not offered as levels — but their courses
              exist and their routes work, and hiding them would strand every
              student who came for one. */}
          <div className="mt-3 flex flex-wrap gap-2.5">
            {tree.other.flatMap((o) =>
              o.courses.map((c) => (
                <Link
                  key={c.slug}
                  href={href(c)}
                  data-cta="resources_course_selected"
                  className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-ink/10 bg-snow px-3.5 py-2.5 text-sm transition-all duration-200 ease-out hover:border-[var(--subject-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="font-medium text-ink">{c.name}</span>
                  <StatusChip status={c.status} />
                </Link>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
