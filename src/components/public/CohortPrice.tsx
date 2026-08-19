import { priceDisplay, type Currency } from "@/lib/public/currency";
import type { Cohort } from "@/lib/public/catalogue";

/**
 * A cohort's price, in whichever currency the visitor is seeing.
 *
 * ⚠ THE STERLING LINE IS NOT OPTIONAL, WHICH IS WHY IT IS NOT A PROP. Three
 * surfaces render a price; if each decided for itself whether to show "Billed
 * in GBP", one of them would eventually stop. priceDisplay() returns the pair
 * and this component renders whatever it returns — a QAR headline can only
 * reach a page with its GBP line attached.
 *
 * ⚠ AND A COHORT WITH NO price_qar RENDERS GBP HERE TOO, whatever `currency`
 * says. That rule is enforced inside priceDisplay(), not by any caller.
 */
export function CohortPrice({
  cohort, currency, size = "lg",
}: {
  cohort: Cohort;
  currency: Currency;
  size?: "lg" | "md";
}) {
  const p = priceDisplay(cohort, currency);
  return (
    <>
      <p className={`mt-2 font-display ${size === "lg" ? "text-2xl" : "text-xl"}`}>{p.primary}</p>
      {p.billedIn && (
        <p className="mt-0.5 font-mono text-[11px] text-ink/55">{p.billedIn}</p>
      )}
    </>
  );
}
