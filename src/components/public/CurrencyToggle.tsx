import { setCurrency } from "@/app/_actions/currency";
import type { Currency } from "@/lib/public/currency";

/**
 * GBP | QAR, as a form.
 *
 * ⚠ NO CLIENT JAVASCRIPT, DELIBERATELY. It is a server component wrapping a
 * server action: the pressed state is rendered from the resolved currency, the
 * submit re-renders the route, and the new prices arrive in the response. A
 * client toggle would have to render one currency, hydrate, then swap — which
 * is the layout shift the spec forbids, on the most sensitive number on the
 * page.
 *
 * ⚠ IT IS ONLY RENDERED WHERE IT DOES SOMETHING. Callers gate on
 * offersCurrencyChoice(); a toggle over cohorts that have no QAR price would
 * redisplay an identical page.
 */
export function CurrencyToggle({ current }: { current: Currency }) {
  return (
    <form action={setCurrency} className="flex items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
        Show prices in
      </span>
      <span className="inline-flex overflow-hidden rounded-full border border-ink/20">
        {(["GBP", "QAR"] as const).map((c) => {
          const on = current === c;
          return (
            <button
              key={c}
              type="submit"
              name="currency"
              value={c}
              aria-pressed={on}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                on ? "bg-ink text-parchment" : "bg-transparent text-ink/70 hover:bg-ink/[0.06]"
              }`}
            >
              {c}
            </button>
          );
        })}
      </span>
    </form>
  );
}
