import type { Metadata } from "next";

import { SubjectCard } from "@/components/home/SubjectCard";
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
        {/**
          * ⚠ THE HOMEPAGE'S SubjectCard, NOT A SECOND CARD THAT LOOKS LIKE IT.
          *
          * This markup used to be a hand-rolled copy: same border, same padding,
          * same layout — and none of the subject accent, none of the lift, and a
          * plain underline where the homepage has an animated CTA. Two cards
          * claiming to be the same thing while behaving differently is exactly
          * the drift that produced the difference in the first place.
          *
          * ⚠ THE DESTINATION IS THE OVERRIDE, AND ONLY THE DESTINATION. From a
          * resources index every subject goes to its own page — Biology and
          * Physics included, even though their `exploreHref` is null, because a
          * visitor who came here for past papers wants /biology and not an
          * interest form. The card's behaviour is unchanged; where it points is.
          *
          * ⚠ `flex` ON THE <li> IS WHAT KEEPS THE CARDS EQUAL HEIGHT. On the
          * homepage the card IS the grid item and stretches for free; here a
          * <li> sits between them (a <ul> owes its children), so the <li>
          * stretches and the card inside it would size to its own text. Biology
          * and Physics share a blurb and Chemistry's is shorter, so the
          * difference would be visible on exactly this page. A flex <li> passes
          * the stretch down; `w-full` on the card completes it.
          */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {SUBJECTS.map((s) => (
            <li key={s.slug} className="flex">
              <SubjectCard
                subject={{
                  slug: s.slug, name: s.name, qualifications: s.qualifications,
                  blurb: s.blurb, status: s.status, exploreHref: s.exploreHref,
                }}
                href={`/${s.slug}`}
                ctaLabel={`Open ${s.name}`}
              />
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
