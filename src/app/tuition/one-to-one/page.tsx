import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { stripeConfig } from "@/lib/booking/config";
import { loadOpenSlots } from "@/lib/booking/readers";
import { CANONICAL_TZ, dualTime, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * 1-to-1 Chemistry tuition (§20–§22).
 *
 * ============================================================================
 * ⚠ THREE STATES, AND ONLY ONE OF THEM SHOWS A BOOK BUTTON
 * ============================================================================
 *   no Stripe keys        an honest "booking opens soon" with register interest
 *   keys but no slots     "no times published yet" with register interest
 *   keys and slots        real times, each bookable
 *
 * A Book button that cannot take money is the dead CTA the standing rails
 * forbid, and it is worse here than anywhere else on the site: the student has
 * decided to spend money and is being sent into a wall.
 *
 * ⚠ NO PRICES ARE HARDCODED. §21 mentions 350–400 QAR/hour as the founder's
 * working figure; that is a number they will configure, not one this page
 * asserts. Packages come from tuition_packages, and until one exists with a
 * Stripe price the page quotes nothing rather than quoting something stale.
 */
export const metadata: Metadata = {
  title: "1-to-1 Chemistry tuition — Ailemy",
  description:
    "Personalised Chemistry support built around your specification, your weak areas and the exam you are sitting.",
};

export const dynamic = "force-dynamic";

const WEEKS = 6;
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

export default async function OneToOnePage() {
  const session = await getNavSession();
  const viewerTz = await viewerTimeZone();
  const stripe = stripeConfig();

  const { slots, packages, hasAvailability } = await loadOpenSlots({
    from: iso(0), to: iso(WEEKS * 7), now: new Date(),
  });

  // ⚠ BOOKABLE MEANS: KEYS PRESENT, TIMES PUBLISHED, AND SOMETHING TO SELL.
  // All three, or no Book button anywhere on this page.
  const sellable = packages.filter((p) => p.stripePriceId !== null);
  const bookable = stripe.configured && hasAvailability && slots.length > 0 && sellable.length > 0;

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          Private tuition
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
          1-to-1 Chemistry tuition
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          Personalised support built around one student: their specification, their weakest
          topics, the questions they keep losing marks on, and the exam they are actually sitting.
        </p>

        {/* ⚠ GROUP STAYS THE HEADLINE OFFER (§20). 1-to-1 is premium support
            alongside it, not a replacement, and the page says so rather than
            competing with the cohorts. */}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/60">
          Most students are best served by a group cohort — it is the scalable core of what
          Ailemy does, and it costs far less per hour.{" "}
          <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
            See live group tuition
          </Link>
          . 1-to-1 is for targeted work on top of that.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-xl font-medium">What a session covers</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-relaxed text-ink/70 sm:grid-cols-2">
            {[
              "Your exact specification, unit by unit",
              "The topics you are actually losing marks on",
              "Exam-question technique and structure",
              "Calculations worked properly, not memorised",
              "Past papers, walked through together",
              "Mark-scheme-informed feedback on your writing",
            ].map((x) => <li key={x}>· {x}</li>)}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-medium">Choose a lesson time</h2>

          {bookable ? (
            <>
              <p className="mt-3 text-sm text-ink/60">
                Times in {CANONICAL_TZ === "Asia/Qatar" ? "Doha" : CANONICAL_TZ}
                {viewerTz && viewerTz !== CANONICAL_TZ ? ", with your own beside them" : ""}. A slot
                is held for you while you pay, and is only confirmed once payment succeeds.
              </p>
              <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {slots.slice(0, 40).map((s) => {
                  const start = dualTime(s.startsAt, viewerTz);
                  const end = dualTime(s.endsAt, viewerTz);
                  return (
                    <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                      <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                        {formatDay(s.startsAt, CANONICAL_TZ)}
                      </span>
                      <span className="flex-1 text-sm">
                        {start.canonical}–{end.canonical}{" "}
                        <span className="font-mono text-[11px] text-ink/50">{start.canonicalLabel}</span>
                        {start.viewer && (
                          <span className="ml-2 font-mono text-[11px] text-ink/50">
                            {start.viewer}–{end.viewer} {start.viewerLabel}
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/tuition/one-to-one/book?slot=${encodeURIComponent(s.key)}`}
                        className="shrink-0 rounded-full border border-ink/20 px-4 py-1.5 text-sm hover:border-ink/40"
                      >
                        Book
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            /* ⚠ THE HONEST STATE. No grid of greyed-out times, no disabled
               button — those read as "the teacher is fully booked", which is a
               different and untrue claim. */
            <div className="mt-4 rounded-lg border border-ink/15 bg-snow p-6">
              <p className="font-display text-lg font-medium">
                Private tuition booking opens soon
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                {!hasAvailability
                  ? "No 1-to-1 times have been published yet."
                  : "Online booking is not switched on yet."}{" "}
                Register your interest and we will contact you with times directly — you will be
                first to know when self-service booking opens.
              </p>
              <Link
                href="/tuition/interest?subject=chemistry&mode=one-to-one"
                className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90"
              >
                Register interest in 1-to-1 →
              </Link>
            </div>
          )}
        </section>

        {sellable.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-medium">Lessons and bundles</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {sellable.map((p) => (
                <div key={p.id} className="rounded-lg border border-ink/10 bg-snow p-5">
                  <p className="font-display text-lg font-medium">{p.name}</p>
                  <p className="mt-1 font-display text-xl">
                    {p.currency === "GBP" ? "£" : `${p.currency} `}
                    {Math.round(p.priceMinor / 100)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink/55">
                    {p.credits} × {p.slotMinutes} minutes
                    {p.validityMonths ? ` · valid ${p.validityMonths} months` : ""}
                  </p>
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed text-ink/70">{p.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
