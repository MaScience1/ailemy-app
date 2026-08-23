import Link from "next/link";

import { levelLabel, type CalendarEvent } from "@/lib/calendar/types";
import { nextOf } from "@/lib/calendar/upcoming";
import { ONE_TO_ONE, subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { dualTime } from "@/lib/schedule/timezone";

/**
 * The two shortcuts and the legend that sit above every calendar (§6, §12, §13).
 *
 * ============================================================================
 * ⚠ "NEXT AVAILABLE 1-TO-1" RENDERS NOTHING TODAY, AND THAT IS THE POINT
 * ============================================================================
 * §66 is the hard rule of this build: there is no stored 1-to-1 availability.
 * `teacher_availability` exists and `loadOpenSlots` reads it correctly — it
 * simply has no rows, so `nextOf(events, "private_open")` returns null and
 * this component says so.
 *
 * The temptation here is enormous and every version of it is a lie: a greyed
 * "Tue 15 Sep · 8:00 PM" example, a "Coming soon" chip shaped exactly like a
 * bookable slot, a seeded row "just so the design can be reviewed". Each one
 * puts a time in front of a student that nobody will teach. So the empty
 * branch states the true situation and offers the thing that IS real — the
 * next group lesson — rather than dressing absence up as availability.
 *
 * The whole gold layer above it is built and wired. The day a row lands in
 * `teacher_availability`, this fills in with no code change; the guard in
 * calendar-booking.test.ts fails if a literal time or date ever appears here.
 *
 * ⚠ CTA WORDING IS DERIVED, NEVER TYPED (§3 of the header). A slot's `bookable`
 * is already the reader's AND of Stripe keys, a real price and an open time —
 * so the label asks it rather than assuming, exactly as the homepage build
 * derives every other tuition word.
 */

function Shortcut({
  eyebrow, title, meta, sub, href, cta, tokens, action,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  sub?: string | null;
  href: string;
  cta: string;
  tokens: React.CSSProperties;
  action: string;
}) {
  return (
    <Link
      href={href}
      data-cta={cta}
      style={tokens}
      className="group flex min-h-[44px] flex-1 flex-col gap-1 rounded-xl border border-ink/10 bg-snow p-4 transition-all duration-200 ease-out hover:border-[var(--subject-accent)] motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex items-center gap-2">
        {/* Decorative — the eyebrow beside it carries the meaning (§38, §53). */}
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--subject-accent)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--subject-text)]">
          {eyebrow}
        </span>
      </span>
      <span className="text-sm font-medium text-ink">{meta}</span>
      <span className="text-sm text-ink/70">{title}</span>
      {sub && <span className="text-xs text-ink/55">{sub}</span>}
      <span className="mt-1 text-sm font-medium text-ink">
        {action}{" "}
        <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

export function CalendarShortcuts({
  events, viewerTz, now, groupHref, oneToOneHref,
}: {
  events: readonly CalendarEvent[];
  viewerTz: string | null;
  now: Date;
  /** Where "view" goes for a group lesson — the day it falls on. */
  groupHref: (dayISO: string) => string;
  oneToOneHref: string;
}) {
  const nextGroup = nextOf(events, "group", now);
  const nextPrivate = nextOf(events, "private_open", now);

  const when = (e: CalendarEvent) => {
    const t = dualTime(e.startsAt, viewerTz);
    return t.canonical + (t.viewer ? ` · ${t.viewer}` : "");
  };
  const dayOf = (e: CalendarEvent) => e.startsAt.toISOString().slice(0, 10);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* ── §13 next group lesson ─────────────────────────────────────── */}
        {nextGroup ? (
          <Shortcut
            eyebrow="Next group lesson"
            meta={when(nextGroup)}
            title={nextGroup.title}
            /* ⚠ §60 — levelLabel, NOT THE RAW SLUG. This rendered "ial-as"
               under the session title: a database value shown to a student. */
            sub={levelLabel(nextGroup.qualification)}
            href={groupHref(dayOf(nextGroup))}
            cta="next_group_lesson_clicked"
            tokens={subjectVars(subjectColour(nextGroup.subject))}
            action="View"
          />
        ) : null}

        {/* ── §12 next available 1-to-1 ─────────────────────────────────── */}
        {nextPrivate ? (
          <Shortcut
            eyebrow="Next available 1-to-1"
            meta={when(nextPrivate)}
            title={nextPrivate.title}
            sub={null}
            href={oneToOneHref}
            cta="next_one_to_one_clicked"
            tokens={subjectVars(ONE_TO_ONE)}
            /* ⚠ DERIVED. `bookable` already folds in Stripe, price and
               openness; a hardcoded "Book" here would be the dead CTA the
               whole codebase has been removing. */
            action={nextPrivate.bookable ? "Book this slot" : "See details"}
          />
        ) : (
          /**
           * ⚠ THE HONEST EMPTY STATE (§66, §49). It does not pretend, and it
           * does not dead-end: it names the real situation and points at the
           * page that handles interest in a time.
           */
          <div
            style={subjectVars(ONE_TO_ONE)}
            className="flex flex-1 flex-col gap-1 rounded-xl border border-dashed border-ink/15 bg-ink/[0.015] p-4"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-[var(--subject-accent)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                Next available 1-to-1
              </span>
            </span>
            <span className="text-sm text-ink/70">
              No 1-to-1 times are published yet.
            </span>
            <span className="mt-1 text-sm">
              <Link
                href={oneToOneHref}
                data-cta="next_one_to_one_clicked"
                className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Register interest in a time →
              </Link>
            </span>
          </div>
        )}
      </div>

      {/* ── §6 legend ──────────────────────────────────────────────────────
          ⚠ WORDS BESIDE EVERY SWATCH. §5, §38 and §53 all say the same thing:
          colour is never the only carrier. A student who cannot separate the
          orange from the gold still reads "Chemistry" and "1-to-1 available". */}
      <ul aria-label="What the colours mean" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {[
          { label: "Chemistry", tokens: subjectVars(subjectColour("chemistry")) },
          { label: "Biology", tokens: subjectVars(subjectColour("biology")) },
          { label: "Physics", tokens: subjectVars(subjectColour("physics")) },
          { label: "1-to-1 available", tokens: subjectVars(ONE_TO_ONE) },
        ].map((l) => (
          <li key={l.label} style={l.tokens} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-[var(--subject-accent)] bg-[var(--subject-tint)]"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
              {l.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
