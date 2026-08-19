import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { getNavSession } from "@/lib/auth/nav-session";
import { FALLBACK_COHORTS, ctaFor, priceLabel } from "@/lib/public/catalogue";

/**
 * The tuition destination (§23).
 *
 * ⚠ IT EXISTS BECAUSE THE HOMEPAGE LINKS TO IT. Shipping a "Join live tuition"
 * button that 404s is the dead CTA §32 forbids, and a route that exists only in
 * a later stage is a dead CTA today.
 *
 * Cohort data comes from the catalogue layer — one source of truth, so a price
 * cannot differ between this page and the homepage.
 */
export const metadata: Metadata = {
  title: "Live tuition — Ailemy",
  description:
    "Small-group science tuition built around the exact specification and exam requirements. " +
    "Edexcel IAL Chemistry AS, and GCSE / International GCSE Chemistry.",
};

export default async function TuitionPage() {
  const session = await getNavSession();
  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <main className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Learn live with Ailemy
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          Small-group science tuition built around the exact specification and exam
          requirements — with the Ailemy platform, marked practice and progress tracking
          included.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {FALLBACK_COHORTS.map((c) => {
            const cta = ctaFor(c);
            return (
              <div key={c.slug} className="flex flex-col rounded-lg border border-ink/10 bg-snow p-7">
                <h2 className="font-display text-xl font-medium tracking-tight">{c.title}</h2>
                <p className="mt-2 font-display text-2xl">{priceLabel(c)}</p>
                <p className="mt-1 font-mono text-[11px] text-ink/55">
                  {c.hoursPerWeek} live hrs/week · {c.sessionsPerWeek} sessions · cap {c.seatCap}
                </p>
                {c.scheduleSummary && (
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">{c.scheduleSummary}</p>
                )}
                <p className="mt-4 text-sm leading-relaxed text-ink/70">{c.summary}</p>
                <ul className="mt-4 flex-1 space-y-1 text-sm text-ink/65">
                  {c.features.map((f) => <li key={f}>· {f}</li>)}
                </ul>
                <Link
                  href={cta.href}
                  className="mt-6 rounded-full border border-ink/20 px-4 py-2 text-center text-sm hover:border-ink/40"
                >
                  {cta.label} →
                </Link>
              </div>
            );
          })}
        </div>

        {/* ⚠ INTENSIVE LIVES HERE NOW (§4). It was a top-level nav entry — a
            single campaign holding a slot next to three whole sciences. The
            ROUTE is untouched and still reachable; only its prominence changed,
            because demoting a nav entry and breaking a shared link are
            different acts. */}
        <section className="mt-14 border-t border-ink/10 pt-10">
          <h2 className="font-display text-xl font-medium">Intensive programmes</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            Short, high-intensity courses run ahead of an exam series, separately from the
            termly cohorts above.{" "}
            <Link href="/intensive" className="underline underline-offset-2">
              See the current intensive →
            </Link>
          </p>
        </section>

        {/* ⚠ OFF-MENU, AND BELOW THE COHORTS (§24) — present, but not priced
            alongside the group offer where it would undercut it. */}
        <section className="mt-14 border-t border-ink/10 pt-10">
          <h2 className="font-display text-xl font-medium">Looking for something else?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            One-to-one Chemistry is available in limited monthly blocks. Availability is
            deliberately small so group teaching stays the focus.{" "}
            <Link href="/tuition/interest?subject=chemistry&amp;mode=one-to-one" className="underline underline-offset-2">
              Ask about availability →
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
