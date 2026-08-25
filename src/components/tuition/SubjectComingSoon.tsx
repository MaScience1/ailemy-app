import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { TuitionSubject } from "@/lib/tuition/subjects";

/**
 * The coming-soon panel (§6, §32, §33, §34).
 *
 * ============================================================================
 * ⚠ IT SHOWS NO PRICE, NO SLOT, NO DATE, NO TEACHER, AND NO CHECKOUT.
 * ============================================================================
 * §6 lists those explicitly and §30 forbids a purchase path for a subject with
 * no Stripe product. There is no amount in this file, no calendar import, and
 * the only action is the interest funnel. A test asserts the absence rather
 * than trusting this comment.
 *
 * ⚠ THE SECONDARY CTA IS CONDITIONAL ON A REAL DESTINATION. §6 says do not link
 * to dead pages: /resources/<subject> exists for chemistry, biology and physics
 * and does not for maths or english, so the link renders only for the three
 * that have somewhere to go.
 */

/** Subjects with a real /resources destination today. Maths/English have none. */
const HAS_RESOURCES: readonly TuitionSubject[] = ["chemistry", "biology", "physics"];

export async function SubjectComingSoon({
  subject, mode, interestHref, canRegister,
}: {
  subject: TuitionSubject;
  mode: "one-to-one" | "group";
  interestHref: string;
  /**
   * ⚠ FALSE WHEN THE INTEREST STORE IS NOT AVAILABLE (planning override 5).
   * The submit path has nowhere to write until the proposed migration is
   * numbered and applied. When that is the case this renders an honest line
   * instead of a button that would fail — not a stubbed success, and not a
   * localStorage fallback.
   */
  canRegister: boolean;
}) {
  const t = await getTranslations("subjects");
  const name = t(subject);

  return (
    <section aria-labelledby="coming-soon-heading" className="mt-8 rounded-xl border border-line bg-snow p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">{t("comingSoonBadge")}</p>
      <h3 id="coming-soon-heading" className="font-display mt-2 text-2xl font-medium tracking-tight">
        {t("comingSoonTitle", { subject: name })}
      </h3>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
        {mode === "group" ? t("comingSoonBlurbGroup") : t("comingSoonBlurbOneToOne", { subject: name })}
      </p>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink/70">{t("helpUsDecide")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canRegister ? (
          <Link
            href={interestHref}
            data-cta="tuition_interest_started"
            className="tap-44 inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {t("registerYourInterest")}
          </Link>
        ) : (
          /* ⚠ AN HONEST STATE, NOT A DEAD BUTTON. See canRegister above. */
          <p className="text-sm text-ink/60">{t("interestUnavailable")}</p>
        )}
        {HAS_RESOURCES.includes(subject) && (
          <Link
            href={`/resources/${subject}`}
            className="tap-44 inline-flex items-center rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/75 transition-colors hover:border-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {t("exploreResources", { subject: name })}
          </Link>
        )}
      </div>
    </section>
  );
}
