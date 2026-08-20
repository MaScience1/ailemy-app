import Link from "next/link";

import { MONTH_LONG, parseDate, WEEKDAY_SHORT } from "@/lib/calendar/grid";
import type { CalendarEvent, CalendarMode } from "@/lib/calendar/types";
import { CANONICAL_TZ, dualTime } from "@/lib/schedule/timezone";
import { ctaFor, priceLabel } from "@/lib/public/catalogue";

/**
 * Everything happening on one day (§8, §86).
 *
 * ============================================================================
 * ⚠ A SIDE SHEET ON DESKTOP, A BOTTOM SHEET ON MOBILE — AND NO JAVASCRIPT
 * ============================================================================
 * The open day is a URL parameter, so this panel is server-rendered. It is
 * therefore shareable (§9), survives a refresh, works with JS off, and needs no
 * focus-trap library — the close control is a real link and the browser's own
 * back button closes it.
 *
 * The two shapes are one element at two breakpoints: full-width sheet pinned to
 * the bottom under `sm`, a right-hand column above it.
 *
 * ============================================================================
 * ⚠ NO CTA HERE IS EVER DEAD (§13, §64, §98)
 * ============================================================================
 * A group lesson shows Enrol ONLY when the cohort is enrolling AND has a real
 * enrolment URL — ctaFor() is the single place that decides, shared with the
 * cohort cards, so the calendar cannot disagree with the pricing page. A 1-to-1
 * slot shows Book only when it is genuinely bookable; keyless, it says booking
 * opens soon rather than offering a checkout that cannot take money.
 *
 * ⚠ AND NO STUDENT IDENTITY, EVER (§8, §72). A booked private slot appears in
 * PUBLIC mode as an absence — it simply is not in the list — never as
 * "unavailable: Sarah". The reader does not send one; this component could not
 * render one if it tried.
 */

export function DayPanel({
  dayISO, events, viewerTz, mode, closeHref,
}: {
  dayISO: string;
  events: readonly CalendarEvent[];
  viewerTz: string | null;
  mode: CalendarMode;
  closeHref: string;
}) {
  const d = parseDate(dayISO);
  const heading = d
    ? `${WEEKDAY_SHORT[((d.getUTCDay() === 0 ? 7 : d.getUTCDay()) as 1)]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : dayISO;

  const group = events.filter((e) => e.type === "group");
  const priv = events.filter((e) => e.type !== "group");

  return (
    <>
      {/* Scrim. A link, so dismissing works without JS and reads as navigation. */}
      <Link
        href={closeHref}
        aria-label="Close day"
        tabIndex={-1}
        className="fixed inset-0 z-40 bg-ink/25 motion-safe:transition-opacity"
      />

      <aside
        aria-label={`Lessons on ${heading}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-ink/15 bg-parchment p-5 shadow-[0_-8px_32px_-12px_rgba(15,20,25,0.35)]
          sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-t-none sm:rounded-l-2xl sm:border-l sm:border-t-0
          sm:shadow-[-8px_0_32px_-12px_rgba(15,20,25,0.35)]"
      >
        {/* A grab handle on mobile only — an affordance, not a control. */}
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 sm:hidden" />

        <div className="flex items-start gap-3">
          <h3 className="font-display flex-1 text-xl font-medium tracking-tight">{heading}</h3>
          <Link
            href={closeHref}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/60 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span aria-hidden>×</span>
          </Link>
        </div>

        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          Doha time{viewerTz && viewerTz !== CANONICAL_TZ ? " · and yours" : ""}
        </p>

        {events.length === 0 && (
          /* ⚠ AN EMPTY DAY IS NOT A BROKEN DAY (§57). It says so plainly and
             offers the one honest next step, rather than an invented event. */
          <div className="mt-8">
            <p className="text-sm leading-relaxed text-ink/65">No lessons scheduled.</p>
            <Link
              href="/tuition"
              className="mt-4 inline-block text-sm underline underline-offset-2 hover:text-ink"
            >
              See live tuition →
            </Link>
          </div>
        )}

        {group.length > 0 && (
          <Section title="Group lessons">
            {group.map((ev) => <GroupRow key={ev.key} event={ev} viewerTz={viewerTz} mode={mode} />)}
          </Section>
        )}

        {priv.length > 0 && (
          <Section title={mode === "personal" ? "Your 1-to-1 lessons" : "1-to-1 availability"}>
            {priv.map((ev) => <PrivateRow key={ev.key} event={ev} viewerTz={viewerTz} mode={mode} />)}
          </Section>
        )}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">{title}</h4>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Times({ event, viewerTz }: { event: CalendarEvent; viewerTz: string | null }) {
  const s = dualTime(event.startsAt, viewerTz);
  const e = dualTime(event.endsAt, viewerTz);
  return (
    <p className="mt-1 text-sm text-ink/80">
      <span className={event.status === "cancelled" ? "line-through" : ""}>
        {s.canonical}–{e.canonical}
      </span>{" "}
      <span className="font-mono text-[11px] text-ink/50">{s.canonicalLabel}</span>
      {s.viewer && (
        <>
          <br />
          <span className="font-mono text-[11px] text-ink/50">
            {s.viewer}–{e.viewer} {s.viewerLabel}
          </span>
        </>
      )}
    </p>
  );
}

function Meta({ event }: { event: CalendarEvent }) {
  const bits = [event.qualification, event.yearGroup, event.teacherName].filter(Boolean);
  if (bits.length === 0) return null;
  return <p className="mt-1 font-mono text-[11px] text-ink/50">{bits.join(" · ")}</p>;
}

function GroupRow({
  event, viewerTz, mode,
}: {
  event: CalendarEvent; viewerTz: string | null; mode: CalendarMode;
}) {
  const cancelled = event.status === "cancelled";
  const cohort = event.cohort;
  // ⚠ ONE DECISION POINT, SHARED WITH THE COHORT CARDS. ctaFor() will not
  // produce "Enrol" without a real URL, so the calendar cannot promise
  // something /tuition refuses.
  const cta = cohort ? ctaFor(cohort) : null;

  return (
    <article className="rounded-lg border border-ink/10 bg-snow p-4">
      <span className="inline-block rounded-full border border-ink/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
        Group
      </span>
      <h5 className={`font-display mt-2 text-base font-medium ${cancelled ? "text-ink/45 line-through" : ""}`}>
        {event.title}
      </h5>
      <Times event={event} viewerTz={viewerTz} />
      <Meta event={event} />

      {cancelled ? (
        <p className="mt-3 rounded border border-ink/15 bg-parchment px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Cancelled{event.cancelledReason ? ` · ${event.cancelledReason}` : ""}
        </p>
      ) : (
        <>
          {cohort && (
            <p className="mt-2 text-sm text-ink/70">
              {priceLabel(cohort)} · cap {cohort.seatCap}
            </p>
          )}
          {/* ⚠ A STUDENT CANNOT CANCEL A GROUP CLASS (§42) — there is no such
              control here, in either mode. */}
          {mode === "personal" ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              You&apos;re enrolled
            </p>
          ) : cta ? (
            <Link
              href={cta.href}
              className="mt-3 inline-block rounded-full border border-ink/20 px-4 py-1.5 text-sm transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {cta.label} →
            </Link>
          ) : null}
        </>
      )}
    </article>
  );
}

function PrivateRow({
  event, viewerTz, mode,
}: {
  event: CalendarEvent; viewerTz: string | null; mode: CalendarMode;
}) {
  const mine = event.type === "private_booked";
  return (
    <article className="rounded-lg border border-ink/10 bg-snow p-4">
      <span className="inline-block rounded-full border border-ink/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
        1-to-1
      </span>
      <h5 className="font-display mt-2 text-base font-medium">{event.title}</h5>
      <Times event={event} viewerTz={viewerTz} />
      <Meta event={event} />

      {mine ? (
        <>
          {event.bookingRef && (
            <p className="mt-2 font-mono text-[11px] text-ink/55">Ref {event.bookingRef}</p>
          )}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Confirmed</p>
        </>
      ) : event.bookable ? (
        <Link
          href={`/tuition/one-to-one/book?slot=${encodeURIComponent(event.key)}`}
          className="mt-3 inline-block rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Book →
        </Link>
      ) : (
        /* ⚠ KEYLESS, THERE IS NO BOOK BUTTON — not a disabled one, which reads
           as "full". §7 of the standing rules and §80. */
        <p className="mt-3 text-sm text-ink/60">
          Booking opens soon.{" "}
          <Link href="/tuition/interest?mode=one-to-one" className="underline underline-offset-2 hover:text-ink">
            Register interest
          </Link>
        </p>
      )}
    </article>
  );
}
