"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import {
  ClipboardCheck,
  Flag,
  Highlighter,
  Play,
  Presentation,
  Save,
  Send,
  Timer,
  X,
} from "lucide-react";

/**
 * Mode-selection modal (spec §2). "Start Test" does not open the exam — it asks
 * how the paper is going to be used.
 *
 * These are USAGE MODES, NOT ACCOUNT ROLES. Nothing here checks or records
 * whether the person is a teacher, by design: a student may legitimately want
 * the presentation view and a teacher may want to sit the paper.
 *
 * Built on @base-ui/react/dialog, already a dependency and previously unused.
 * It supplies the focus trap, Escape-to-close, backdrop, scroll lock and
 * aria-modal wiring that §2 asks for. The four hand-rolled modals elsewhere in
 * this codebase implement only some of that; this does not copy them.
 */

export function StartTestModal({
  slug,
  courseSlug,
  paperLabel,
}: {
  slug: string;
  /**
   * Required: a paper slug is unique only within a course. Both modes below
   * carry it so /test and /classroom can resolve by (course, slug) rather than
   * by slug alone, which would serve whichever subject happened to sort first.
   */
  courseSlug: string;
  paperLabel: string;
}) {
  const q = `?course=${encodeURIComponent(courseSlug)}`;
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-signal px-6 py-3 text-sm font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        Start Test
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[9998] bg-ink/50 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[9999] max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ink/10 bg-parchment p-6 shadow-2xl transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
                How would you like to use this paper?
              </Dialog.Title>
              <Dialog.Description className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">
                Take the paper independently under exam conditions, or present
                and work through it with a class.
              </Dialog.Description>
              <p className="font-mono mt-3 text-[11px] uppercase tracking-[0.2em] text-ink/45">
                {paperLabel}
              </p>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="shrink-0 rounded-md border border-ink/15 p-2 text-ink/70 transition hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-6">
            <ModeCard
              href={`/past-papers/${slug}/test${q}`}
              icon={<Timer className="h-5 w-5" aria-hidden="true" />}
              heading="Take the test"
              description="Complete the paper independently with a timer, question navigation and saved answers."
              features={[
                { icon: <Timer className="h-3.5 w-3.5" aria-hidden="true" />, label: "Timed exam environment" },
                { icon: <Save className="h-3.5 w-3.5" aria-hidden="true" />, label: "Type and save answers" },
                { icon: <Flag className="h-3.5 w-3.5" aria-hidden="true" />, label: "Flag questions to revisit" },
                { icon: <Send className="h-3.5 w-3.5" aria-hidden="true" />, label: "Submit when finished" },
              ]}
              cta="Enter Student Mode"
              primary
            />

            <ModeCard
              href={`/past-papers/${slug}/classroom${q}`}
              icon={<Presentation className="h-5 w-5" aria-hidden="true" />}
              heading="Teach this paper"
              description="Present the paper to a class and work through each question using classroom annotation tools."
              features={[
                { icon: <Presentation className="h-3.5 w-3.5" aria-hidden="true" />, label: "Full-screen presentation" },
                { icon: <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />, label: "Draw, write and highlight" },
                { icon: <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />, label: "Reveal mark-scheme guidance" },
                { icon: <Save className="h-3.5 w-3.5" aria-hidden="true" />, label: "Save classroom annotations" },
              ]}
              cta="Enter Classroom Mode"
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModeCard({
  href,
  icon,
  heading,
  description,
  features,
  cta,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  heading: string;
  description: string;
  features: { icon: React.ReactNode; label: string }[];
  cta: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-ink/[0.06] text-ink/70">
        {icon}
      </span>
      <h3 className="font-display mt-5 text-xl font-medium tracking-tight text-ink">
        {heading}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/65">{description}</p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f.label} className="flex items-center gap-2.5 text-sm text-ink/70">
            <span className="text-ink/40">{f.icon}</span>
            {f.label}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={
          primary
            ? "mt-6 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-signal px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            : "mt-6 inline-flex w-full items-center justify-center rounded-md border border-ink/20 bg-transparent px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/40 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        }
      >
        {cta}
      </Link>
    </div>
  );
}
