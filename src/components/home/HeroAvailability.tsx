
import { SmartLink as Link } from "@/components/i18n/SmartLink";
import type { CalendarEvent } from "@/lib/calendar/types";
import { nextAvailableSlot } from "@/lib/booking/next-available";
import { nextOf } from "@/lib/calendar/upcoming";
import { levelLabel } from "@/lib/calendar/types";
import { ONE_TO_ONE, subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { dualTime, formatDay, CANONICAL_TZ } from "@/lib/schedule/timezone";
import type { Capacity } from "@/lib/public/capacity-rules";
import type { TuitionOffer } from "@/lib/tuition/availability";

/**
 * What a visitor can actually book, above the fold (§9–§12).
 *
 * ============================================================================
 * ⚠ THE MONTH GRID WAS THE FIRST THING THE HERO ASKED A STRANGER TO READ
 * ============================================================================
 * §9's complaint is fair: a calendar showing an empty August is a puzzle, not
 * an offer. This states the next real session and what to do about it, and the
 * grid moves below it as supporting detail (§12) rather than the lead.
 *
 * ⚠ IT IS NOT A SECOND CALENDAR (§5 of the header, §13). Every event here
 * comes from the same loadCalendarEvents the page already calls for the card
 * below; this component receives them as a prop and reads nothing of its own.
 * /calendar and Online Tuition keep the full Month/Week/Upcoming untouched.
 *
 * ⚠ EVERY LABEL IS DERIVED (§2 of the header). §11 asks for "Reserve your
 * place" and §8 for "Book tuition". Neither is true today — CHECKOUT_BUILT is
 * false, Stripe holds no keys, and every cohort is `interest` with a null
 * enrolment_url — so the offer functions decide the words and they flip on
 * their own the day a payment link lands. Hardcoding either turns the guard
 * red, and the sabotage run in the report proves it.
 *
 * ⚠ AND 1-TO-1 SHOWS NOTHING, BECAUSE THERE IS NOTHING (§10, §3 of the
 * header). teacher_availability has no rows. §10's own example — "Tue 15 Sep ·
 * 8:00–9:00 PM" — is exactly the fabrication §62 forbids, so the panel says
 * what is true and offers the route that does exist.
 */

export type HeroMode = "group" | "one-to-one";

export function isHeroMode(v: string | undefined): v is HeroMode {
  return v === "group" || v === "one-to-one";
}

function Toggle({ mode, hrefFor }: { mode: HeroMode; hrefFor: (m: HeroMode) => string }) {
  return (
    <nav aria-label="Kind of tuition" className="inline-flex rounded-full border border-ink/15 p-0.5">
      {(["one-to-one", "group"] as const).map((m) => {
        const on = m === mode;
        return (
          <Link
            key={m}
            href={hrefFor(m)}
            aria-current={on ? "true" : undefined}
            /* ⚠ THE TOGGLE IS A NEW CONTROL, SO IT GETS NEW NAMES — and deliberately
               unambiguous ones. "hero_group_tuition" would sit one underscore
               from the shipped "hero_group_tuition_clicked" and the two would
               be read as the same thing in a funnel. */
            data-cta={m === "one-to-one" ? "hero_availability_one_to_one" : "hero_availability_group"}
            className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-[13px] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              on ? "bg-ink text-parchment" : "text-ink/65 hover:text-ink"
            }`}
          >
            {m === "one-to-one" ? "1-to-1" : "Group"}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeroAvailability({
  mode, events, viewerTz, now, capacity, group, oneToOne, hrefFor,
}: {
  mode: HeroMode;
  /** The same events the calendar card below renders. */
  events: readonly CalendarEvent[];
  viewerTz: string | null;
  now: Date;
  capacity: Capacity | null;
  /** Derived offers — the labels come from these, never from this file. */
  group: TuitionOffer;
  oneToOne: TuitionOffer;
  hrefFor: (m: HeroMode) => string;
}) {
  const nextGroup = nextOf(events, "group", now);
  const nextPrivate = nextAvailableSlot(events, { now });

  const when = (e: CalendarEvent) => {
    const t = dualTime(e.startsAt, viewerTz);
    return t.viewer ? `${t.canonical} · ${t.viewer}` : t.canonical;
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-snow p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">
            Learn live with an expert.
          </h2>
          <p className="mt-1 text-sm leading-snug text-ink/65">
            Choose personalised 1-to-1 tuition, or join a structured group lesson.
          </p>
        </div>
        <Toggle mode={mode} hrefFor={hrefFor} />
      </div>

      <div className="mt-4 border-t border-ink/10 pt-4">
        {mode === "group" ? (
          nextGroup ? (
            <div style={subjectVars(subjectColour(nextGroup.subject))}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--subject-text)]">
                Next group lesson
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink">
                {formatDay(nextGroup.startsAt, CANONICAL_TZ)} · {when(nextGroup)}
              </p>
              <p className="mt-0.5 text-sm text-ink/70">{nextGroup.title}</p>
              {nextGroup.qualification && (
                <p className="font-mono mt-0.5 text-[10px] uppercase tracking-[0.14em] text-ink/45">
                  {levelLabel(nextGroup.qualification)}
                </p>
              )}
              {/* ⚠ §11 CAPACITY — cohort_seats_taken OR the cap, never a guess. */}
              {capacity && (
                <p className="font-mono mt-1.5 text-[10px] uppercase tracking-[0.14em] text-ink/45">
                  {capacity.known
                    ? `${capacity.taken} of ${capacity.cap} places taken`
                    : "Small group"}
                </p>
              )}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link
                  href={group.href}
                  /* ⚠ THE SHIPPED NAME, NOT A THIRD RENAME. §61 proposes
                     new names for controls §45 already named two days ago;
                     renaming a live event a third time destroys the funnel
                     it exists to measure. Same control, same name. */
                  data-cta="hero_group_tuition_clicked"
                  className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {/* ⚠ DERIVED, WITH NO TERNARY. groupOffer already decides
                      between "Reserve your place" and "See group tuition"; a
                      conditional here would be a second place that word could
                      be typed. */}
                  {group.label} →
                </Link>
                <Link
                  href="/calendar"
                  data-cta="hero_calendar_clicked"
                  className="text-ink/65 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  See group timetable →
                </Link>
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/65">No group lessons are scheduled in this period.</p>
          )
        ) : nextPrivate ? (
          <div style={subjectVars(ONE_TO_ONE)}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--subject-text)]">
              Next available
            </p>
            <p className="mt-1.5 text-sm font-medium text-ink">
              {formatDay(nextPrivate.startsAt, CANONICAL_TZ)} · {when(nextPrivate)}
            </p>
            <p className="mt-0.5 text-sm text-ink/70">{nextPrivate.title}</p>
            <p className="mt-3 text-sm">
              <Link
                href={oneToOne.href}
                data-cta="hero_book_one_to_one_clicked"
                className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {oneToOne.label} →
              </Link>
            </p>
          </div>
        ) : (
          /**
           * ⚠ THE HONEST EMPTY STATE. §10 supplies an example time; there are
           * no rows in teacher_availability, so printing one would put a slot
           * in front of a student that nobody will teach. This says what is
           * true and offers the page that takes an interest in a time.
           */
          <div style={subjectVars(ONE_TO_ONE)}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              1-to-1 availability
            </p>
            <p className="mt-1.5 text-sm text-ink/70">
              No 1-to-1 times are published yet.
            </p>
            <p className="mt-3 text-sm">
              <Link
                href={oneToOne.href}
                data-cta="hero_book_one_to_one_clicked"
                className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Ask about 1-to-1 times →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
