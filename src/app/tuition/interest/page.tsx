import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS } from "@/lib/public/catalogue";

/**
 * Register interest (§11).
 *
 * ⚠ THE FORM IS PRESENT AND HONEST ABOUT WHERE IT SENDS THINGS. 0040 is
 * unapplied, so there is no interest_registrations table to insert into. Rather
 * than a submit button that silently loses a parent's details — the worst
 * possible version of a dead CTA — the form states plainly that it opens an
 * email, and does that.
 *
 * When 0040 is applied this becomes a server action writing the row, and the
 * fields below are already the columns it will write.
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

  const lines = [
    known ? `Subject: ${known.name}` : "Subject:",
    "Qualification (GCSE / International GCSE / IAL AS / IAL A2):",
    cohort ? `Cohort: ${cohort}` : null,
    mode === "one-to-one" ? "Enquiry: one-to-one availability" : null,
    "", "Student name:", "Parent/guardian name:", "Country / timezone:",
    "Current grade:", "Target grade:", "Preferred days / times:",
    "Ready to start soon (yes/no):",
  ].filter(Boolean) as string[];

  const mailto =
    `mailto:hello@send.ailemy.com` +
    `?subject=${encodeURIComponent(`Register interest${known ? ` — ${known.name}` : ""}`)}` +
    `&body=${encodeURIComponent(lines.join("\n"))}`;

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight">Register interest</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/70">
          We open new cohorts based on genuine demand. Tell us what you need and we will
          contact you when one opens{known ? ` for ${known.name}` : ""}.
        </p>

        {/* ⚠ SAID OUT LOUD. A form that pretended to store this while no table
            exists would be the fake functionality §32 forbids — and the thing
            lost would be a parent's contact details. */}
        <p className="mt-8 rounded-lg border border-ink/15 bg-snow p-5 text-sm leading-relaxed text-ink/75">
          Registrations are handled by email while the demand list is being set up. The button
          below opens your email client with the details we need already filled in — nothing is
          stored on this page.
        </p>

        <a
          href={mailto}
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Open email to register →
        </a>

        <h2 className="font-display mt-12 text-lg font-medium">What we will ask</h2>
        <ul className="mt-3 space-y-1 text-sm text-ink/70">
          {lines.filter((l) => l).map((l) => <li key={l}>· {l.replace(/:$/, "")}</li>)}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
