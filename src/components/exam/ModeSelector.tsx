"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Hourglass,
  Lock,
  PenLine,
  Presentation,
  Timer,
  Wand2,
} from "lucide-react";

import type { PaperExamMeta } from "@/lib/exam/paper-exam-meta";

/**
 * The two things a person can do with a paper: stand in front of it, or sit it.
 *
 * "Teach" routes to the EXISTING practice viewer — the tldraw whiteboard beside
 * the PDF — because that is already the teacher-annotation surface and nothing
 * about it needed replacing. This screen is a layer in front of the old entry
 * point, not a replacement for it.
 *
 * "Sit" expands in place rather than navigating, because Exam vs Practice is a
 * refinement of a choice already made, not a new one. A page transition would
 * lose that relationship, and on a phone — where most students will meet this —
 * it costs a load for a decision that should feel instant.
 *
 * Everything here is presentational. Whether the paper is sittable at all is
 * decided by getPaperExamMeta on the server and arrives as `meta`; this
 * component never asks the database anything.
 */
export function ModeSelector({
  meta,
  teachHref,
  sitExamHref,
  sitPracticeHref,
}: {
  meta: PaperExamMeta;
  teachHref: string;
  sitExamHref: string;
  sitPracticeHref: string;
}) {
  const [sitOpen, setSitOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      {/* ── TEACH ─────────────────────────────────────────────────────────── */}
      {/* No h-full. The grid is items-start, so each card takes its own height:
          collapsed they are near-identical, and when the sit panel opens this
          one stays put instead of stretching into 260px of dead space. */}
      <Link
        href={teachHref}
        className="group/teach flex flex-col gap-8 rounded-lg border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--subject-accent)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--subject-accent)] sm:p-8"
      >
        <div>
          <span
            className="flex h-11 w-11 items-center justify-center rounded-md"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-accent) 12%, transparent)",
              color: "var(--subject-accent)",
            }}
          >
            <Presentation className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-mono mt-6 text-[10px] uppercase tracking-[0.25em] text-ink/50">
            For teaching
          </p>
          <h3 className="font-display mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
            Teach this paper
          </h3>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/65">
            Open the paper beside a whiteboard and work through it with a class.
            Annotate as you go — your board is saved per paper.
          </p>
        </div>

        <span className="font-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors group-hover/teach:text-ink">
          Open the whiteboard
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover/teach:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </Link>

      {/* ── SIT ───────────────────────────────────────────────────────────── */}
      {meta.hasQuestions ? (
        /* overflow-hidden lets the container own the radius, so the sub-cards
           need no corner classes and cannot disagree with it when they stack
           into a single column on mobile. */
        <div className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-signal transition-all duration-300 ease-out hover:shadow-md">
          <button
            type="button"
            onClick={() => setSitOpen((open) => !open)}
            aria-expanded={sitOpen}
            aria-controls={panelId}
            // Without this the button's accessible name is its entire visible
            // contents — heading, blurb, mark tally and all — which a screen
            // reader reads out in full before saying "button, collapsed". The
            // label names the action; the text stays on screen for everyone.
            aria-label="Sit this paper — choose exam or practice mode"
            className="group/sit flex cursor-pointer flex-col gap-8 rounded-lg p-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:p-8"
          >
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-ink/10 text-ink">
                <PenLine className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-mono mt-6 text-[10px] uppercase tracking-[0.25em] text-ink/60">
                For students
              </p>
              <h3 className="font-display mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
                Sit this paper
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/70">
                Answer the questions yourself and have Ailemy mark them against
                the real examiner mark scheme.
              </p>

              {/* The honest disclosure. A student sitting 25 of 80 marks must
                  know before they start, not discover it at question eleven. */}
              <p className="font-mono mt-5 text-[11px] uppercase tracking-[0.18em] text-ink/60">
                {meta.answerableCount} question
                {meta.answerableCount === 1 ? "" : "s"} · {meta.seededMarks} mark
                {meta.seededMarks === 1 ? "" : "s"}
                {meta.isPartial && meta.paperTotalMarks !== null && (
                  <span className="text-ink/45">
                    {" "}
                    of {meta.paperTotalMarks}
                  </span>
                )}
              </p>
            </div>

            <span className="font-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink/70">
              {sitOpen ? "Choose a mode below" : "Choose how"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-300 ${sitOpen ? "rotate-180" : "group-hover/sit:translate-y-0.5"}`}
                aria-hidden="true"
              />
            </span>
          </button>

          {/* Sub-choice. Rendered only when open — a collapsed panel that is
              still in the tab order is a trap for keyboard and screen-reader
              users, and there is nothing here worth pre-rendering. */}
          {sitOpen && (
            <div
              id={panelId}
              className="grid gap-px border-t border-ink/15 bg-ink/15 sm:grid-cols-2"
            >
              <SitMode
                href={sitExamHref}
                icon={<Timer className="h-4 w-4" aria-hidden="true" />}
                name="Exam mode"
                detail="Answer every question and submit. No timer or marking yet."
                ready
              />
              <SitMode
                href={sitPracticeHref}
                icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
                name="Practice mode"
                detail="Untimed. Check each answer as you go, with the mark scheme behind it."
              />
            </div>
          )}
        </div>
      ) : (
        <NotSittableYet />
      )}
    </div>
  );
}

/**
 * One of the two sit modes. Both are step-3 destinations, so both currently
 * land on a page that says so — see the "coming next" placeholder route. They
 * are real links rather than dead buttons because the routing skeleton is the
 * point of this step, and because a link that goes nowhere and a link that
 * goes somewhere honest are very different things to click.
 */
function SitMode({
  href,
  icon,
  name,
  detail,
  ready = false,
}: {
  href: string;
  icon: React.ReactNode;
  name: string;
  detail: string;
  /** True once the mode actually opens something. Exam mode does; practice does not. */
  ready?: boolean;
}) {
  return (
    <Link
      href={href}
      className={"group/mode flex flex-col gap-2 bg-signal p-6 transition-colors duration-300 hover:bg-ink hover:text-snow focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="font-display text-base font-medium tracking-tight">
          {name}
        </span>
      </span>
      <span className="text-xs leading-relaxed text-ink/65 transition-colors group-hover/mode:text-snow/70">
        {detail}
      </span>
      <span className="font-mono mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ink/45 transition-colors group-hover/mode:text-snow/55">
        {ready ? (
          <>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            Start
          </>
        ) : (
          <>
            <Hourglass className="h-3 w-3" aria-hidden="true" />
            Coming next
          </>
        )}
      </span>
    </Link>
  );
}

/**
 * Shown when a paper has no seeded questions — which is every paper but
 * WCH11/01 today.
 *
 * Deliberately NOT a disabled-looking version of the real card: it does not
 * imitate a button, carries no arrow, and says plainly what is missing and
 * what still works. A greyed-out control invites clicking and then fails
 * silently; this explains itself instead.
 */
function NotSittableYet() {
  return (
    <div className="flex flex-col gap-8 rounded-lg border border-dashed border-ink/20 bg-snow/50 p-6 sm:p-8">
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-ink/[0.06] text-ink/35">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="font-mono mt-6 text-[10px] uppercase tracking-[0.25em] text-ink/40">
          For students
        </p>
        <h3 className="font-display mt-2 text-2xl font-medium tracking-tight text-ink/60 sm:text-3xl">
          Sit this paper
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/50">
          This paper hasn&apos;t been broken into questions yet, so there is
          nothing for Ailemy to mark. Download it above, or open the whiteboard
          and work through it by hand.
        </p>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
        Not yet available
      </p>
    </div>
  );
}
