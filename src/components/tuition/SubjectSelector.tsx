import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { subjectStates, SUBJECT_ACCENT, type TuitionSubject } from "@/lib/tuition/subjects";
import { subjectVars, subjectColour } from "@/lib/design/subject-colours";
import type { CohortFacts } from "@/lib/tuition/availability";

/**
 * The subject selector (§3, §23, §24, §25).
 *
 * ⚠ STATUS IS NOT PRESENTATIONAL. Each card's badge comes from subjectState(),
 * which reads real cohort rows — so a subject becomes ACTIVE by the catalogue
 * gaining cohorts, not by an edit here (§18, §19).
 *
 * ⚠ AND STATUS IS NEVER COLOUR ALONE (§25). Every card carries the word
 * "Active" or "Coming soon" in text, plus an aria-label that says it, because a
 * badge distinguished only by hue is invisible in greyscale and to a screen
 * reader.
 *
 * ⚠ LINKS, NOT BUTTONS. The selection lives in the URL (§4) so it is
 * shareable and survives an auth round trip; these are next-intl Links so the
 * Arabic page stays Arabic when you change subject.
 */
export async function SubjectSelector({
  mode, selected, cohorts, hrefFor,
}: {
  mode: "one-to-one" | "group";
  selected: TuitionSubject;
  cohorts: readonly CohortFacts[];
  hrefFor: (s: TuitionSubject) => string;
}) {
  const t = await getTranslations("subjects");
  const states = subjectStates(cohorts);

  return (
    <section aria-labelledby="subject-heading" className="mt-6">
      <h3 id="subject-heading" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
        {t("chooseSubject")}
      </h3>
      {/**
        * ⚠ A SNAP STRIP ON A PHONE, A GRID FROM sm UP (§24). Five cards squeezed
        * into 375px would be 70px each — unreadable and under the 44px tap
        * guidance once padding is counted. Below sm they scroll horizontally
        * with snap points; the strip carries its own edge affordance because
        * iOS hides scrollbars.
        */}
      <ul className="snap-strip mt-3 gap-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5 [&.snap-strip]:sm:[mask-image:none]">
        {states.map((s) => {
          const on = s.subject === selected;
          const accent = SUBJECT_ACCENT[s.subject];
          const statusLabel = s.status === "active" ? t("statusActive") : t("statusComingSoon");
          return (
            <li key={s.subject} className="min-w-[9.5rem] sm:min-w-0">
              <Link
                href={hrefFor(s.subject)}
                aria-current={on ? "true" : undefined}
                data-cta="tuition_subject_selected"
                /* ⚠ LOGICAL PADDING ONLY — the suite fails on ps-/pe- violations. */
                style={accent ? subjectVars(subjectColour(accent)) : undefined}
                className={`tap-44 flex h-full flex-col justify-between gap-2 rounded-xl border p-3 transition-colors duration-200
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
                  ${on
                    ? "border-ink bg-ink text-parchment"
                    : "border-ink/12 bg-snow hover:border-ink/30"}`}
                aria-label={`${t(s.subject)} — ${statusLabel}`}
              >
                <span className="flex items-center gap-2">
                  {accent && (
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-parchment/70" : "bg-[var(--subject-accent)]"}`}
                    />
                  )}
                  <span className="font-display text-base font-medium tracking-tight">{t(s.subject)}</span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${
                    on ? "text-parchment/70" : s.status === "active" ? "text-ink/70" : "text-ink/40"
                  }`}>
                    {statusLabel}
                  </span>
                  <span className={`text-[11px] leading-snug ${on ? "text-parchment/65" : "text-ink/55"}`}>
                    {s.status === "active" ? t("liveTuitionAvailable") : t("registerInterest")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
