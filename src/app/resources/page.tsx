import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS } from "@/lib/public/catalogue";

/**
 * A subject chooser, and nothing more.
 *
 * ⚠ IT EXISTS BECAUSE THE URL DID, AND IT WAS BROKEN. /resources was returning
 * 500 — falling through to the (site)/[...slug] catch-all, which threw a
 * ReferenceError. A 500 is worse than a 404: it tells a visitor the site is
 * faulty rather than that the page moved. This route now answers for itself.
 *
 * ⚠ IT SENDS YOU BACK INTO A SUBJECT rather than listing material directly.
 * Resources are discovered THROUGH a subject; a second, flatter index of the
 * same material is how two navigation models end up half-maintained.
 */
export const metadata: Metadata = {
  title: "Resources — Ailemy",
  description: "Lessons, past papers, mark schemes and practice, organised by subject and specification.",
};

export default async function ResourcesPage() {
  const session = await getNavSession();
  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <main className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Resources</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          Lessons, past papers, mark schemes and practice live inside each subject, organised by
          specification. Choose a science to start.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/${s.slug}`}
                className="flex h-full flex-col rounded-lg border border-ink/10 bg-snow p-6 transition-colors hover:border-ink/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                  {s.status === "available" ? "Available" : "Register interest"}
                </span>
                <span className="font-display mt-3 text-2xl font-medium">{s.name}</span>
                <span className="mt-1 font-mono text-[11px] text-ink/50">
                  {s.qualifications.join(" · ")}
                </span>
                <span className="mt-4 flex-1 text-sm leading-relaxed text-ink/70">{s.blurb}</span>
                <span className="mt-5 text-sm underline underline-offset-2">Open {s.name} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
