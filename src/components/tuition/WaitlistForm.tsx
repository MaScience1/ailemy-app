"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { joinWaitlist, type WaitlistState } from "@/lib/public/waitlist";

/**
 * "Join the waiting list" for a full cohort (§65).
 *
 * ⚠ IT DOES NOT PROMISE A PLACE. §65 says so explicitly, and the confirmation
 * says "we will email you if a place opens" rather than "you are next in line"
 * — there is no queue position in the data, and inventing one would be a
 * promise nobody can keep.
 *
 * ⚠ EMAIL ONLY. The table holds email, course_id and source; asking for a name
 * would collect something with nowhere to go, which is the friction §22 rules
 * out and the data minimisation the privacy policy commits to.
 */
export function WaitlistForm({ cohortSlug }: { cohortSlug: string }) {
  const t = useTranslations("tuition");
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    { status: "idle" },
  );

  if (state.status === "ok") {
    return (
      <p className="mt-3 rounded border border-ink/15 bg-parchment-2/50 px-3 py-2.5 text-base md:text-sm leading-relaxed text-ink/75">
        {t("waitlistConfirmation")}
      </p>
    );
  }

  return (
    <form action={action} className="relative mt-3">
      <input type="hidden" name="cohort" value={cohortSlug} />
      {/* ⚠ THE TRAP. Hidden from people, visible to a naive bot. */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0"
      />
      <label htmlFor={`wl-${cohortSlug}`} className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
        {t("waitlistLabel")}
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id={`wl-${cohortSlug}`}
          name="email"
          type="email"
          required
          dir="ltr"
          placeholder={t("waitlistEmailPlaceholder")}
          className="h-10 min-w-0 flex-1 rounded-md border border-ink/15 bg-snow px-3 text-base md:text-base md:text-sm placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
        />
        <button
          type="submit"
          disabled={pending}
          data-cta="chemistry_course"
          className="shrink-0 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium transition-colors hover:border-ink/40 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {pending ? t("waitlistAdding") : t("waitlistJoin")}
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" dir="auto" className="mt-2 text-sm text-amber-800">{state.error}</p>
      )}
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink/45">
        {t("waitlistPrivacyNote")}
      </p>
    </form>
  );
}
