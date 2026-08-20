import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { SessionList } from "@/components/public/SessionList";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { loadMyTuition } from "@/lib/booking/student";
import { CANONICAL_TZ, dualTime, formatDay } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * My Tuition (§35).
 *
 * ⚠ ITS OWN ROUTE, NOT A DASHBOARD REWRITE. feat/student-dashboard is a live
 * branch and rail 1 forbids touching it, so this is built against main and
 * links from here. Deep integration happens when that branch merges.
 *
 * ⚠ NO ADMIN AFFORDANCES (§35). Cancelling, rescheduling and refunding are
 * admin actions with their own authorisation; this page shows a student what
 * they have and where to go next, and nothing here can change a booking.
 *
 * ⚠ EVERY SECTION HAS AN HONEST EMPTY STATE. 0045–0047 are unapplied, so the
 * private-lesson sections render "none yet" rather than erroring — and the
 * group-lesson section works today for an enrolled student.
 */
export const metadata: Metadata = {
  title: "My tuition — Ailemy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyTuitionPage() {
  const session = await getNavSession();
  const viewerTz = await viewerTimeZone();
  const me = await loadMyTuition();

  if (!me.signedIn) redirect("/login?next=/my-tuition");

  const nextGroup = me.groupSessions.find(
    (s) => s.status === "scheduled" && s.endsAt.getTime() > Date.now(),
  );

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight">My tuition</h1>
        <p className="mt-3 text-sm text-ink/60">
          {me.email} · times in {CANONICAL_TZ === "Asia/Qatar" ? "Doha" : CANONICAL_TZ}
          {viewerTz && viewerTz !== CANONICAL_TZ ? " and your own timezone" : ""}
        </p>

        {me.notes.length > 0 && (
          /* ⚠ A SECTION THAT FAILED SAYS SO. An empty list and a failed read
             look identical, and they need opposite responses. */
          <ul className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {me.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}

        {/* ── group ─────────────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-medium">Group tuition</h2>
          {me.enrolledCohortSlugs.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              You are not enrolled on a cohort yet.{" "}
              <Link href="/tuition" className="underline underline-offset-2 hover:text-ink">
                See live group tuition
              </Link>
              .
            </p>
          ) : (
            <>
              {nextGroup && (
                <p className="mt-3 text-sm text-ink/75">
                  Next lesson: <strong>{formatDay(nextGroup.startsAt, CANONICAL_TZ)}</strong>{" "}
                  {dualTime(nextGroup.startsAt, viewerTz).canonical} {dualTime(nextGroup.startsAt, viewerTz).canonicalLabel}
                </p>
              )}
              <div className="mt-4">
                <SessionList
                  sessions={me.groupSessions.slice(0, 12)}
                  viewerTz={viewerTz}
                  emptyMessage="No lessons are scheduled for your cohort in the next eight weeks."
                />
              </div>
            </>
          )}
        </section>

        {/* ── private ───────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-display text-xl font-medium">Private lessons</h2>
          {me.upcomingPrivate.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              No private lessons booked.{" "}
              <Link href="/tuition/one-to-one" className="underline underline-offset-2 hover:text-ink">
                See 1-to-1 tuition
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
              {me.upcomingPrivate.map((b) => {
                const s = dualTime(b.startsAt, viewerTz);
                const e = dualTime(b.endsAt, viewerTz);
                return (
                  <li key={b.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                    <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
                      {formatDay(b.startsAt, CANONICAL_TZ)}
                    </span>
                    <span className="flex-1 text-sm">{b.subject ?? "1-to-1"}</span>
                    <span className="shrink-0 rounded-full border border-ink/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
                      1-to-1
                    </span>
                    <span className="shrink-0 text-sm text-ink/80">
                      {s.canonical}–{e.canonical}{" "}
                      <span className="font-mono text-[11px] text-ink/50">{s.canonicalLabel}</span>
                      {s.viewer && (
                        <span className="ml-2 font-mono text-[11px] text-ink/50">
                          {s.viewer}–{e.viewer} {s.viewerLabel}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── credits ───────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-display text-xl font-medium">Lesson credits</h2>
          {/* ⚠ THE BALANCE IS SUMMED FROM THE LEDGER, NOT READ FROM A COLUMN. */}
          <p className="mt-3 font-display text-2xl">
            {me.creditBalance} {me.creditBalance === 1 ? "lesson" : "lessons"} remaining
          </p>
          {me.ledger.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              You have not bought a lesson bundle yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10 font-mono text-[11px]">
              {me.ledger.slice(0, 12).map((tx) => (
                <li key={tx.id} className="flex items-baseline gap-4 py-2">
                  <span className={`w-8 shrink-0 ${tx.delta > 0 ? "text-emerald-700" : "text-ink/60"}`}>
                    {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                  </span>
                  <span className="flex-1 text-ink/70">{tx.reason.replace(/_/g, " ")}</span>
                  <span className="text-ink/45">{tx.createdAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── past ──────────────────────────────────────────────────────── */}
        {me.pastPrivate.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-medium">Past private lessons</h2>
            <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10 text-sm">
              {me.pastPrivate.slice(0, 10).map((b) => (
                <li key={b.id} className="flex items-baseline gap-4 py-2.5 text-ink/60">
                  <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em]">
                    {formatDay(b.startsAt, CANONICAL_TZ)}
                  </span>
                  <span className="flex-1">{b.subject ?? "1-to-1"}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{b.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-sm text-ink/60">
          <Link href="/calendar" className="underline underline-offset-2 hover:text-ink">
            Full Ailemy calendar →
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
