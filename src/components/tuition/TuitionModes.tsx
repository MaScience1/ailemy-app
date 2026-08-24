import Link from "next/link";

import {
  COMMITMENT_LABEL, ONE_TO_ONE_LEVEL_LABEL, monthsFor,
  type Commitment, type OneToOneLevel,
} from "@/lib/tuition/pricing";
import { savingAgainst, cheapestFor } from "@/lib/tuition/pricing-math";
import { ONE_TO_ONE, subjectColour, subjectVars } from "@/lib/design/subject-colours";
import type { Currency } from "@/lib/public/currency";
import type { Cohort } from "@/lib/public/catalogue";
import type { Capacity } from "@/lib/public/capacity-rules";

/**
 * Online Tuition's two products, and the price of each (§1, §14–§23, §35–§37).
 *
 * ============================================================================
 * ⚠ ONE PRODUCT AT A TIME (§37)
 * ============================================================================
 * The page used to open with three cohort cards and a schedule dump, which
 * asks a visitor to understand Ailemy's catalogue before it tells them what is
 * on offer. There are two things to buy — a personal lesson or a place in a
 * group — and §37 is explicit that showing both in full at once is the density
 * problem. So the mode is a link-driven segmented control and the page below
 * it belongs entirely to the chosen product.
 *
 * ⚠ LINKS, NOT CLIENT STATE (§3 of the tuition brief). `?type=one-to-one` has
 * to be shareable, has to let the homepage's "See 1-to-1 availability" land in
 * the right mode, and has to survive a reload — all of which a useState toggle
 * loses. It also keeps this a server component, so the prices are in the HTML
 * for a crawler rather than appearing after hydration.
 *
 * ⚠ NO PRICE ARITHMETIC IN THIS FILE (§44). Every figure comes from quote() or
 * oneToOneQuote(). There is no `* 0.9` here and the guard fails if one appears.
 */

export type TuitionMode = "one-to-one" | "group";

export function isTuitionMode(v: string | undefined): v is TuitionMode {
  return v === "one-to-one" || v === "group";
}

function Segmented({ mode, hrefFor }: { mode: TuitionMode; hrefFor: (m: TuitionMode) => string }) {
  return (
    <nav aria-label="Choose a kind of tuition" className="flex flex-col gap-2 sm:flex-row">
      {(["one-to-one", "group"] as const).map((m) => {
        const on = m === mode;
        const label = m === "one-to-one" ? "1-to-1 Tuition" : "Group Tuition";
        const sub = m === "one-to-one"
          ? "Personal lessons, booked around published times."
          : "Structured weekly teaching, with the platform included.";
        return (
          <Link
            key={m}
            href={hrefFor(m)}
            aria-current={on ? "page" : undefined}
            data-cta={m === "one-to-one" ? "tuition_one_to_one_selected" : "tuition_group_selected"}
            className={[
              "flex min-h-[44px] flex-1 flex-col gap-1 rounded-xl border px-5 py-4",
              "transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              on
                ? "border-ink bg-ink text-parchment"
                : "border-ink/15 bg-snow hover:border-ink/35 motion-safe:hover:-translate-y-0.5",
            ].join(" ")}
          >
            <span className="font-display text-lg font-medium tracking-tight">{label}</span>
            <span className={`text-sm leading-snug ${on ? "text-parchment/75" : "text-ink/65"}`}>{sub}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * §5, §6, §8 — level × package, priced from Stripe.
 *
 * ⚠ THE FIGURES ARE NO LONGER COMPUTED HERE OR ANYWHERE ELSE IN THIS REPO.
 * This rendered oneToOneQuote(), which multiplied a hardcoded QAR table by
 * QAR_PER_GBP = 4.7 to produce a sterling figure Stripe would never charge —
 * so the page and the checkout could disagree by construction. Both amounts
 * now come off the SAME active Stripe Price that Checkout uses.
 *
 * ⚠ AND AN ABSENT PRICE RENDERS AN HONEST LINE, NOT A ZERO (§19). "0 QAR"
 * against a real product is worse than saying the price could not be loaded.
 */
function OneToOnePricing({ currency, pricing }: { currency: Currency; pricing: OneToOnePricingProps }) {
  const cur: "qar" | "gbp" = currency === "QAR" ? "qar" : "gbp";
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {(Object.keys(ONE_TO_ONE_LEVEL_LABEL) as OneToOneLevel[]).map((level) => {
        const forLevel = pricing[level];
        const single = forLevel?.single?.formatted?.[cur] ?? null;
        const pack = forLevel?.five_hour?.formatted?.[cur] ?? null;
        const singleMinor = forLevel?.single?.amounts?.[cur] ?? null;
        const packMinor = forLevel?.five_hour?.amounts?.[cur] ?? null;
        /**
         * ⚠ DERIVED FROM THE TWO STRIPE AMOUNTS, IN ONE CURRENCY. Five single
         * lessons minus the package price — arithmetic within a currency, which
         * is comparison, never across one, which would be FX. If either amount
         * is missing, neither line is claimed.
         */
        const perHour = packMinor !== null ? fmtMoney(Math.round(packMinor / 5), cur) : null;
        const saveMinor = singleMinor !== null && packMinor !== null ? singleMinor * 5 - packMinor : null;
        const save = saveMinor !== null && saveMinor > 0 ? fmtMoney(saveMinor, cur) : null;
        return (
          <section key={level} style={subjectVars(ONE_TO_ONE)} aria-labelledby={`lvl-${level}`}>
            <h3 id={`lvl-${level}`} className="font-display text-lg font-medium tracking-tight">
              {ONE_TO_ONE_LEVEL_LABEL[level]}
            </h3>
            <ul className="mt-3 grid gap-2">
              <li className="rounded-xl border border-ink/10 bg-snow px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink/70">Single lesson</span>
                  <span className="font-display text-lg font-medium">
                    {single ?? <span className="text-sm font-normal text-ink/45">Pricing unavailable</span>}
                  </span>
                </div>
                <p className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-ink/45">
                  One hour
                </p>
              </li>
              <li className="rounded-xl border border-[var(--subject-accent)] bg-[var(--subject-tint)] px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink/70">5-hour package</span>
                  <span className="font-display text-lg font-medium">
                    {pack ?? <span className="text-sm font-normal text-ink/45">Pricing unavailable</span>}
                  </span>
                </div>
                {perHour && (
                  <p className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
                    {perHour} per hour{save ? ` · save ${save}` : ""}
                  </p>
                )}
              </li>
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * §15–§23 — one programme, three commitments, one price panel.
 *
 * ⚠ THE CTA IS DERIVED, NEVER TYPED (§5 of the header, §26). §26 asks for
 * "Reserve your place →". That is true only when a cohort is enrolling AND has
 * somewhere to enrol — the same AND the homepage and nav builds established,
 * and the reason is unchanged: a cohort marked enrolling with a null payment
 * link cannot be reserved, and a button saying otherwise leads nowhere. It
 * flips on its own the moment the link lands.
 */
function GroupProgramme({
  cohort, commitment, currency, capacity, pricing, hrefFor,
}: {
  cohort: Cohort;
  commitment: Commitment;
  currency: Currency;
  capacity: Capacity | null;
  pricing: Partial<Record<Commitment, PriceCell | undefined>>;
  hrefFor: (c: Commitment) => string;
}) {
  // ⚠ THE COHORT'S OWN DATES, NOT A LOOKUP. See pricing.ts: the slug→window
  // map was a second copy of `cohorts.ends_on` and it had one entry, so two
  // live programmes said their dates were unpublished when the row held them.
  const window = { firstClassOn: cohort.firstClassOn, lastClassOn: cohort.lastClassOn };
  /**
   * ⚠ THE MONTHS ARE THE COHORT'S OWN, THE MONEY IS STRIPE'S.
   * monthsFor() reads the teaching window off the row — that is a fact about
   * this programme and stays. quote() is gone: it applied a local DISCOUNTS
   * table to a sterling column and converted at a fixed 4.7, which is three
   * commercial decisions this repo does not own.
   */
  const months = monthsFor("academic_year", window);
  const cur: "qar" | "gbp" = currency === "QAR" ? "qar" : "gbp";
  const amount = (c: Commitment) => pricing[c]?.amounts?.[cur] ?? null;
  const shown = (c: Commitment) => pricing[c]?.formatted?.[cur] ?? null;

  const monthlyMinor = amount("monthly");
  const selectedMinor = amount(commitment);
  const selectedText = shown(commitment);

  /**
   * ⚠ THE SAVING IS DERIVED FROM TWO STRIPE AMOUNTS IN ONE CURRENCY, and is
   * null when the arithmetic does not support one. The old card rendered a
   * hardcoded −5% / −10% chip beside every tab whether or not the prices
   * agreed with it.
   */
  const normalMinor = monthlyMinor !== null && commitment !== "monthly"
    ? monthlyMinor * (commitment === "three_month" ? 3 : months)
    : null;
  const saving = normalMinor !== null && selectedMinor !== null
    ? savingAgainst(normalMinor, selectedMinor) : null;

  /**
   * ⚠ THE BADGE MUST EARN ITSELF (§8 of the guards). On this catalogue three
   * 3-month AS packages cover nine months for 6,900 QAR against 7,000 for the
   * academic year — so at nine months the academic year is NOT best value and
   * gets no badge. cheapestFor() decides; nothing here assumes.
   */
  const best = cheapestFor(months, {
    monthly: monthlyMinor ?? undefined,
    three_month: amount("three_month") ?? undefined,
    academic_year: amount("academic_year") ?? undefined,
  });

  /**
   * ⚠ COMPUTED PER TAB, FROM THE RETRIEVED AMOUNTS. Returns null — no chip —
   * whenever the arithmetic does not support a claim.
   */
  const tabHint = (c: Commitment): string | null => {
    if (best === c) return "Best value";
    if (c === "monthly" || monthlyMinor === null) return null;
    const pay = amount(c);
    if (pay === null) return null;
    const normal = monthlyMinor * (c === "three_month" ? 3 : months);
    const sv = savingAgainst(normal, pay);
    return sv ? `~${Math.round(sv.pct)}% saving` : null;
  };

  const perMonthMinor = commitment === "monthly" ? monthlyMinor
    : selectedMinor !== null
      ? Math.round(selectedMinor / (commitment === "three_month" ? 3 : Math.max(1, months)))
      : null;
  const canReserve = cohort.status === "enrolling" && !!cohort.enrolmentUrl;
  const colour = subjectColour(cohort.subject);

  return (
    <article style={subjectVars(colour)} className="rounded-xl border border-ink/10 bg-snow p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-xl font-medium tracking-tight">{cohort.title}</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
          Group tuition
        </span>
      </div>

      {/* §22 — schedule, hours, capacity: the decision facts, once. */}
      <ul className="font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {cohort.scheduleSummary && <li>{cohort.scheduleSummary}</li>}
        <li>{cohort.hoursPerWeek} teaching hours a week</li>
        {/* ⚠ §25 — CAPACITY COMES FROM cohort_seats_taken OR IS NOT SHOWN.
            `capacity.known` is false when the RPC is absent; the honest render
            of "we could not count" is the cap alone, never an invented number. */}
        <li>
          {capacity?.known
            ? `${capacity.taken} of ${cohort.seatCap} places taken`
            : `Maximum ${cohort.seatCap} students`}
        </li>
      </ul>

      {/* ── §15/§40 — one segmented selector, one price panel ─────────────── */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {/* ⚠ THE TABS COME FROM COMMITMENT_LABEL, NOT FROM DISCOUNTS. The tab
            list was keyed on the discount table, so the set of things you could
            buy was defined by a local percentage map — remove a discount and a
            purchase option silently disappeared. */}
        {(Object.keys(COMMITMENT_LABEL) as Commitment[]).map((c) => {
          const on = c === commitment;
          return (
            <Link
              key={c}
              href={hrefFor(c)}
              aria-current={on ? "true" : undefined}
              data-cta={
                c === "monthly" ? "tuition_group_one_month_selected"
                : c === "three_month" ? "tuition_group_three_month_selected"
                : "tuition_group_academic_selected"
              }
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on ? "border-ink bg-ink text-parchment" : "border-ink/15 text-ink/70 hover:border-ink/35"
              }`}
            >
              {COMMITMENT_LABEL[c]}
              {/**
                * ⚠ THE HINT IS DERIVED, AND OFTEN THERE ISN'T ONE.
                * This rendered −{DISCOUNTS[c] * 100}% from a local table, so the
                * chip kept claiming a percentage after the Stripe amount moved.
                * The saving is now computed from the two retrieved amounts, and
                * "Best value" appears only on whichever option cheapestFor()
                * actually finds cheapest over this cohort's own teaching window.
                */}
              {(() => {
                const hint = tabHint(c);
                if (!hint) return null;
                return (
                  <span className={`font-mono text-[10px] ${on ? "text-parchment/70" : "text-ink/45"}`}>
                    {hint}
                  </span>
                );
              })()}
            </Link>
          );
        })}
      </div>

      {selectedText ? (
        <div className="mt-4">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl font-medium tracking-tight">
              {selectedText}
            </span>
            {saving && normalMinor !== null && (
              <>
                <span className="text-sm text-ink/45 line-through">
                  {fmtMoney(normalMinor, cur)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
                  Save {fmtMoney(saving.saveMinor, cur)}
                </span>
              </>
            )}
          </p>
          {/* ⚠ THE "charged as £64" LINE IS GONE (§6). It existed because the
              QAR figure was a CONVERSION of a sterling price, so the sterling
              line was the only honest number on the card. Both currencies now
              come off the same Stripe Price, so the selected currency simply IS
              the price — and a second, different-looking amount underneath it
              reads as a contradiction rather than as reassurance. */}
          <p className="mt-1 text-sm text-ink/65">
            {commitment === "monthly"
              ? "per month"
              : perMonthMinor !== null
                ? `${fmtMoney(perMonthMinor, cur)} a month · ${commitment === "three_month" ? 3 : months} months`
                : `${commitment === "three_month" ? 3 : months} months upfront`}
          </p>
          {best === commitment && (
            <p className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
              Best value over {months} months
            </p>
          )}
          {/* §18/§47 — the real dates, never "12 months". */}
          {commitment === "academic_year" && window.firstClassOn && window.lastClassOn && (
            <p className="mt-1 text-xs text-ink/55">
              Covers teaching from {fmt(window.firstClassOn)} to {fmt(window.lastClassOn)}.
            </p>
          )}
        </div>
      ) : (
        /**
         * ⚠ TWO DIFFERENT SILENCES, SAID DIFFERENTLY (§19). "Dates not
         * published" is a fact about the cohort row; "pricing unavailable" is a
         * fact about a failed Stripe read. Collapsing them sends somebody to
         * check the wrong thing — and neither branch ever renders a 0.
         */
        !window.firstClassOn || !window.lastClassOn ? (
          <p className="mt-4 text-sm text-ink/65">
            The academic programme dates for this cohort are not published yet.
          </p>
        ) : (
          <p className="mt-4 text-sm text-ink/65">
            Pricing temporarily unavailable — please try again shortly.
          </p>
        )
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Link
          href={canReserve ? cohort.enrolmentUrl! : `/tuition/interest?cohort=${cohort.slug}`}
          data-cta="tuition_group_programme_selected"
          className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {canReserve ? "Reserve your place" : "Register interest"}
          <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
        </Link>

        {/* ⚠ §1 — SECONDARY, AND IT MUST STAY SECONDARY. The gold is a tinted
            border and warm text on the cream ground, not a filled button: a
            second solid pill beside the dark one would give a reader two equal
            primary actions and slow the decision the card exists to speed up.
            ONE_TO_ONE is the platform gold already in use for 1-to-1
            availability, reused rather than a second warm hue (§31, §47). */}
        <Link
          href={`/tuition/${cohort.slug}/roadmap`}
          data-cta="course_roadmap_opened"
          style={subjectVars(ONE_TO_ONE)}
          className="group/r inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--subject-accent)] bg-[var(--subject-tint)] px-4 py-2 text-sm font-medium text-[var(--subject-text)] transition-all duration-200 ease-out hover:border-ink/40 motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          See course roadmap
          <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover/r:translate-x-0.5">→</span>
        </Link>
      </div>
    </article>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

function fmt(iso: string): string {
  const d = Number(iso.slice(8, 10)), m = Number(iso.slice(5, 7)), y = iso.slice(0, 4);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** One package's amounts, as the server resolved them from Stripe. */
export type PriceCell = {
  formatted: Partial<Record<"qar" | "gbp", string>>;
  amounts: Partial<Record<"qar" | "gbp", number>>;
};

/** Keyed by cohort slug — the card looks up its own prices and no one else's. */
export type GroupPricingProps = Record<string, Partial<Record<Commitment, PriceCell | undefined>>>;

export type OneToOnePricingProps = Partial<Record<OneToOneLevel, {
  single?: { formatted: Partial<Record<"qar" | "gbp", string>>; amounts: Partial<Record<"qar" | "gbp", number>> };
  five_hour?: { formatted: Partial<Record<"qar" | "gbp", string>>; amounts: Partial<Record<"qar" | "gbp", number>> };
}>>;

/** ⚠ Intl, and no rate — the same rule pricing-math.ts states, client-side. */
function fmtMoney(minor: number, cur: "qar" | "gbp"): string {
  if (cur === "qar") {
    const whole = minor / 100;
    return `${new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: Number.isInteger(whole) ? 0 : 2,
    }).format(whole)} QAR`;
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

export function TuitionModes({
  mode, commitment, currency, cohorts, capacityBySlug, hrefForMode, hrefForCommitment,
  oneToOnePricing = {},
  groupPricing = {},
}: {
  mode: TuitionMode;
  commitment: Commitment;
  currency: Currency;
  cohorts: readonly Cohort[];
  capacityBySlug: Map<string, Capacity>;
  hrefForMode: (m: TuitionMode) => string;
  hrefForCommitment: (c: Commitment) => string;
  oneToOnePricing?: OneToOnePricingProps;
  groupPricing?: GroupPricingProps;
}) {
  return (
    <div className="grid gap-8">
      <Segmented mode={mode} hrefFor={hrefForMode} />

      {mode === "one-to-one" ? (
        <section aria-labelledby="oto-heading">
          <h2 id="oto-heading" className="font-display text-2xl font-medium tracking-tight">
            Personal lessons, on your course.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Teaching built around one student&rsquo;s specification, their gaps and the exam they
            are sitting — with the same resources, marking and practice the platform provides.
          </p>
          <div className="mt-6">
            <OneToOnePricing currency={currency} pricing={oneToOnePricing} />
          </div>
        </section>
      ) : (
        <section aria-labelledby="grp-heading">
          <h2 id="grp-heading" className="font-display text-2xl font-medium tracking-tight">
            Structured weekly teaching, in a small group.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            A whole programme to the specification, with the Ailemy platform, marked practice and
            progress tracking included.
          </p>
          <div className="mt-6 grid gap-4">
            {cohorts.map((c) => (
              <GroupProgramme
                key={c.slug}
                cohort={c}
                commitment={commitment}
                currency={currency}
                capacity={capacityBySlug.get(c.slug) ?? null}
                pricing={groupPricing[c.slug] ?? {}}
                hrefFor={hrefForCommitment}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
