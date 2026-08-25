
import { useTranslations } from "next-intl";

import { SmartLink as Link } from "@/components/i18n/SmartLink";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * "Your next step" — lightweight personalisation (§31).
 *
 * ============================================================================
 * ⚠ IT RENDERS ONLY FOR SOMEBODY WE ACTUALLY KNOW SOMETHING ABOUT
 * ============================================================================
 * §31 says "where feasible". Feasible here means: signed in, and enrolled on at
 * least one course. An anonymous visitor gets nothing — the hero already asks
 * them to start, and a second personalised-looking panel addressed to nobody is
 * worse than none.
 *
 * ⚠ NO FINGERPRINTING, NO LOCAL PREFERENCE STATE. §31 permits temporary local
 * state for anonymous visitors and explicitly forbids invasive fingerprinting.
 * Rather than walk that line, this reads the enrolment the student already
 * declared — the only signal that is both truthful and theirs.
 *
 * ⚠ AND EVERY DESTINATION IS REAL. The three actions go to routes that exist
 * and do something today. There is no "continue where you left off", because
 * public.progress has no writer and nothing knows where anyone left off.
 */
export function NextStep({
  courseName,
  subject,
  courseSlug,
}: {
  courseName: string;
  subject: string | null;
  courseSlug: string;
}) {
  const t = useTranslations();
  const colour = subjectColour(subject ?? courseName);

  return (
    <div
      style={subjectVars(colour)}
      className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-7"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
        {t("home.nextStepEyebrow")}
      </p>
      <h3 className="font-display mt-2 text-xl font-medium tracking-tight">
        You&rsquo;re studying{" "}
        <span style={colour ? { color: "var(--subject-text)" } : undefined}>{courseName}</span>
      </h3>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {[
          { label: "Continue learning", href: `/learn` },
          { label: "Try an exam question", href: "/past-papers" },
          { label: "See your progress", href: "/profile" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group text-sm font-medium underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            style={colour ? { color: "var(--subject-text)" } : undefined}
          >
            {a.label}{" "}
            <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
          </Link>
        ))}
      </div>
      {/* courseSlug is carried so a later revision can deep-link without
          re-deriving it from the name — never rendered. */}
      <span className="sr-only" lang="en" dir="ltr">{courseSlug}</span>
    </div>
  );
}
