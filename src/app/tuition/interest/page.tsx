import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS } from "@/lib/public/catalogue";

import { InterestForm } from "./InterestForm";

/**
 * Register interest (§11).
 *
 * ⚠ THE FORM NOW WRITES A ROW. It used to open the visitor's email client,
 * because 0040 was unapplied and a submit button that silently lost a parent's
 * details would have been the worst possible dead CTA. The table exists in the
 * migration folder now and the action inserts into it under anon RLS.
 *
 * ⚠ THE EMAIL ROUTE IS STILL HERE, DELIBERATELY. It is the recovery path when
 * the insert fails — including the case where 0040 has not been run yet, which
 * the action detects and says so. A form is not allowed to be the only way in.
 */
export const metadata: Metadata = {
  title: "Register interest — Ailemy",
  description: "Tell us which science and qualification you need, and we will contact you when a cohort opens.",
};

export default async function InterestPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; cohort?: string; mode?: string }>;
}) {
  const session = await getNavSession();
  const { subject, cohort, mode } = await searchParams;
  const known = SUBJECTS.find((s) => s.slug === subject);

  const mailto =
    `mailto:hello@send.ailemy.com` +
    `?subject=${encodeURIComponent(`Register interest${known ? ` — ${known.name}` : ""}`)}` +
    `&body=${encodeURIComponent(
      [
        known ? `Subject: ${known.name}` : "Subject:",
        "Qualification (GCSE / International GCSE / IAL AS / IAL A2):",
        cohort ? `Cohort: ${cohort}` : null,
        mode === "one-to-one" ? "Enquiry: one-to-one availability" : null,
        "", "Student name:", "Parent/guardian name:", "Country / timezone:",
        "Current grade:", "Target grade:", "Preferred days / times:",
        "Ready to start soon (yes/no):",
      ].filter(Boolean).join("\n"),
    )}`;

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight">Register interest</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/70">
          We open new cohorts based on genuine demand. Tell us what you need and we will
          contact you when one opens{known ? ` for ${known.name}` : ""}. Nothing is charged
          and nothing is committed.
        </p>

        <InterestForm
          defaultSubject={known?.name ?? ""}
          cohort={cohort ?? null}
          mode={mode ?? null}
          mailto={mailto}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
