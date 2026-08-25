import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SmartLink as Link } from "@/components/i18n/SmartLink";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { CHECKOUT_BUILT, stripeConfig } from "@/lib/booking/config";
import { loadOpenSlots } from "@/lib/booking/readers";
import { loadMyTuition } from "@/lib/booking/student";
import { canRedeem } from "@/lib/booking/cancellation";
import { BookWithCredit } from "./_book";
import { CANONICAL_TZ, dualTime, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * 1-to-1 Chemistry tuition (§20–§22).
 *
 * ============================================================================
 * ⚠ BUYING AND REDEEMING ARE TWO CAPABILITIES, NOT ONE
 * ============================================================================
 *   no times published                  "no 1-to-1 times yet" + register interest
 *   times, no way to act on them        "booking opens soon" + register interest
 *   times + Stripe keys                 Book (checkout)
 *   times + a credit already held       Use a credit  ← works with NO Stripe
 *
 * A Book button that cannot take money is the dead CTA the standing rails
 * forbid, and it is worse here than anywhere else on the site: the student has
 * decided to spend money and is being sent into a wall.
 *
 * ⚠ BUT THE KEYLESS GATE USED TO COVER BOTH, AND THAT WAS WRONG. A credit is
 * money ALREADY TAKEN — charged when the package was bought, with the credit as
 * the receipt. Refusing to let somebody spend one because this deployment
 * cannot take a NEW payment strands a customer who has already paid us. The
 * rule is no payable CTA; redeeming is not a payment.
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
  const t = await getTranslations("tuition");

  const [{ slots, packages, hasAvailability }, me] = await Promise.all([
    loadOpenSlots({ from: iso(0), to: iso(WEEKS * 7), now: new Date() }),
    loadMyTuition(),
  ]);

  // ⚠ BUYING NEEDS KEYS, SOMETHING TO SELL, AND SOMEWHERE TO GO. The third was
  // missing: the Book link pointed at /tuition/one-to-one/book, which has never
  // existed. Keyless Stripe was the only thing keeping it off the page.
  const sellable = packages.filter((p) => p.stripePriceId !== null);
  const canBuy = CHECKOUT_BUILT && stripe.configured && sellable.length > 0;

  // ⚠ REDEEMING NEEDS NEITHER. canRedeem never consults Stripe — see its
  // header, and the assertion in booking-lifecycle.test.ts that proves the
  // absence, since no test of a return value could.
  const redeem = canRedeem({ signedIn: me.signedIn, creditBalance: me.creditBalance });

  // Times are shown only when at least one of them can actually be acted on.
  // Forty times with no button is the same dead end in a different shape.
  const showTimes = hasAvailability && slots.length > 0 && (canBuy || redeem.ok);

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        {/* ⚠ ONE NAME FOR ONE THING. This page called the product "Private
            tuition" in the eyebrow, "1-to-1 Chemistry tuition" in the H1 one
            line below it, and "Private tuition" again in the empty state — three
            labels on one screen for a single offer. "1-to-1" is the form the
            rest of the site uses (nav, /calendar, the hero legend, DayPanel),
            so it is the one that survives here. */}
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/50">
          {t("oneToOneEyebrow")}
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
          {t("oneToOneHeading")}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          {t("oneToOneIntro")}
        </p>

        {/* ⚠ GROUP STAYS THE HEADLINE OFFER (§20). 1-to-1 is premium support
            alongside it, not a replacement, and the page says so rather than
            competing with the cohorts. */}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/60">
          {t("oneToOneGroupFirstLead")}{" "}
          <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
            {t("seeLiveGroupTuition")}
          </Link>
          {t("oneToOneGroupFirstTrail")}
        </p>

        <section className="mt-12">
          <h2 className="font-display text-xl font-medium">{t("whatASessionCovers")}</h2>
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
          <h2 className="font-display text-xl font-medium">{t("chooseALessonTime")}</h2>

          {redeem.ok && (
            <p className="mt-3 rounded border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
              You have <strong>{me.creditBalance}</strong> lesson credit{me.creditBalance === 1 ? "" : "s"}.
              Pick a time below and it is booked straight away — nothing to pay.
            </p>
          )}

          {showTimes ? (
            <>
              {/* ⚠ THE HOLD-WHILE-YOU-PAY SENTENCE DESCRIBED A MECHANISM THAT
                  CANNOT ENGAGE. booking_holds exists and readers.ts does count
                  a live hold as busy — but nothing in src/ ever INSERTS one. A
                  hold is created by checkout, checkout is gated on
                  CHECKOUT_BUILT, and that is false, so canBuy above is false in
                  every deployment. The only way to reach this list is
                  redeem.ok: a student spending a credit, with nothing to pay
                  and so nothing to hold a slot against.

                  It also described the wrong risk. The real one is staleness —
                  see _book.tsx: the slot key is re-resolved server-side because
                  this list was already out of date when it rendered. That is
                  the sentence a student can act on. */}
              <p className="mt-3 text-sm text-ink/60">
                Times in {CANONICAL_TZ === "Asia/Qatar" ? "Doha" : CANONICAL_TZ}
                {viewerTz && viewerTz !== CANONICAL_TZ ? ", with your own beside them" : ""}.
                Availability is re-checked the moment you book, so a time can be taken while
                this list is open.
              </p>
              <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {slots.slice(0, 40).map((s) => {
                  const start = dualTime(s.startsAt, viewerTz);
                  const end = dualTime(s.endsAt, viewerTz);
                  return (
                    <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                      <span dir="ltr" className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                        {formatDay(s.startsAt, CANONICAL_TZ)}
                      </span>
                      <span dir="ltr" className="flex-1 text-sm">
                        {start.canonical}–{end.canonical}{" "}
                        <span className="font-mono text-[11px] text-ink/50">{start.canonicalLabel}</span>
                        {start.viewer && (
                          <span className="ms-2 font-mono text-[11px] text-ink/50">
                            {start.viewer}–{end.viewer} {start.viewerLabel}
                          </span>
                        )}
                      </span>
                      {/* ⚠ REDEEM IS OFFERED FIRST WHEN BOTH ARE POSSIBLE. A
                          student holding credits should spend one rather than
                          be sold another lesson they have already paid for. */}
                      {/* ⚠ REDEEM IS THE ONLY ACTION THAT EXISTS. The Buy
                          branch linked to /tuition/one-to-one/book, which has
                          never been a route — see DayPanel for the full note.
                          Times only render when redeem.ok or canBuy, and
                          canBuy now requires CHECKOUT_BUILT, so this list is
                          unreachable without a credit until checkout exists. */}
                      <BookWithCredit
                        slotKey={s.key}
                        label={t("slotDayAtTime", {
                          day: formatDay(s.startsAt, CANONICAL_TZ),
                          time: start.canonical,
                        })}
                      />
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
                {t("oneToOneBookingOpensSoon")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                {!hasAvailability || slots.length === 0
                  ? t("noOneToOneTimesPublished")
                  : me.signedIn
                    ? t("paymentOffNoCredits")
                    : t("paymentNotSwitchedOn")}{" "}
                {t("registerInterestWeWillContact")}
              </p>
              <Link
                href="/tuition/interest?subject=chemistry&mode=one-to-one"
                className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90"
              >
                {t("registerInterestInOneToOne")}
              </Link>
            </div>
          )}
        </section>

        {sellable.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-medium">{t("lessonsAndBundles")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {sellable.map((p) => (
                <div key={p.id} className="rounded-lg border border-ink/10 bg-snow p-5">
                  <p className="font-display text-lg font-medium">{p.name}</p>
                  <p className="mt-1 font-display text-xl">
                    {p.currency === "GBP" ? "£" : `${p.currency} `}
                    {Math.round(p.priceMinor / 100)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink/55">
                    {t("creditsTimesMinutes", { credits: p.credits, minutes: p.slotMinutes })}
                    {p.validityMonths ? t("validForMonths", { months: p.validityMonths }) : ""}
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
