import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementBar } from "@/components/public/AnnouncementBar";
import { SessionList } from "@/components/public/SessionList";
import { TimezoneSync } from "@/components/public/TimezoneSync";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { SUBJECTS } from "@/lib/public/catalogue";
import { loadCalendar } from "@/lib/schedule/readers";
import { CANONICAL_TZ, CANONICAL_LABEL } from "@/lib/schedule/timezone";
import { viewerTimeZone } from "@/lib/schedule/viewer-tz";

/**
 * The Ailemy calendar (§16, §17).
 *
 * ⚠ RANGE-BOUNDED, ALWAYS (§67). Twelve weeks by default. A calendar that
 * fetches "everything" is fine with one cohort and unusable with twenty, and
 * the fix is much harder to retrofit than to start with.
 *
 * ⚠ FILTERS ARE LINKS, NOT STATE. Server-rendered, shareable, and they work
 * with JavaScript off. A client-side filter over a server-fetched list would
 * also mean fetching everything and hiding most of it.
 *
 * ⚠ THE 1-TO-1 TAB TELLS THE TRUTH. Private availability is Phase 6 and does
 * not exist yet, so that filter says so rather than showing an empty grid that
 * reads as "the teacher has no time free".
 */
export const metadata: Metadata = {
  title: "Calendar — Ailemy",
  description:
    "Upcoming Ailemy tuition. Group lessons by subject and qualification, with times in Doha and your own timezone.",
};

const WEEKS = 12;
const TYPES = [
  { key: "all", label: "All" },
  { key: "group", label: "Group tuition" },
  { key: "private", label: "1-to-1" },
] as const;

function isoPlusDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; type?: string }>;
}) {
  const session = await getNavSession();
  const { subject, type } = await searchParams;
  const viewerTz = await viewerTimeZone();

  const activeSubject = SUBJECTS.find((s) => s.slug === subject)?.slug;
  const activeType = TYPES.find((t) => t.key === type)?.key ?? "all";

  // ⚠ CANCELLED LESSONS ARE INCLUDED. A visitor who sees "Cancelled · Winter
  // break" has their question answered; one who sees a gap sends an email.
  const { sessions, source, reason } = await loadCalendar({
    from: isoPlusDays(0),
    to: isoPlusDays(WEEKS * 7),
    subject: activeSubject,
    includeCancelled: true,
  });

  const showGroup = activeType !== "private";

  return (
    <div className="bg-parchment text-ink">
      <AnnouncementBar />
      <SiteNav session={session} />
      <TimezoneSync known={viewerTz !== null} />

      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Calendar</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
          Every published Ailemy lesson for the next {WEEKS} weeks. Times are shown in{" "}
          {CANONICAL_LABEL} time
          {viewerTz && viewerTz !== CANONICAL_TZ ? ", with your own beside them" : ""}.
        </p>

        <div className="mt-8 space-y-3">
          <Filters
            legend="Subject"
            options={[{ key: "", label: "All subjects" }, ...SUBJECTS.map((s) => ({ key: s.slug, label: s.name }))]}
            active={activeSubject ?? ""}
            hrefFor={(k) => hrefWith({ subject: k, type: activeType })}
          />
          <Filters
            legend="Type"
            options={TYPES.map((t) => ({ key: t.key, label: t.label }))}
            active={activeType}
            hrefFor={(k) => hrefWith({ subject: activeSubject ?? "", type: k })}
          />
        </div>

        <div className="mt-10">
          {showGroup ? (
            <SessionList
              sessions={sessions}
              viewerTz={viewerTz}
              emptyMessage={
                activeSubject
                  ? `No ${SUBJECTS.find((s) => s.slug === activeSubject)?.name ?? ""} lessons are scheduled in the next ${WEEKS} weeks. Register interest and we will tell you when a cohort opens.`
                  : `No lessons are scheduled in the next ${WEEKS} weeks.`
              }
            />
          ) : (
            /* ⚠ HONEST, NOT EMPTY. "No slots" would read as the teacher having
               none free. Private booking is not built yet, and this says so. */
            <p className="text-sm leading-relaxed text-ink/60">
              1-to-1 booking is not open yet. Group lessons are listed under{" "}
              <Link href={hrefWith({ subject: activeSubject ?? "", type: "group" })} className="underline underline-offset-2 hover:text-ink">
                Group tuition
              </Link>
              , and you can{" "}
              <Link href="/tuition/interest?mode=one-to-one" className="underline underline-offset-2 hover:text-ink">
                register interest in 1-to-1
              </Link>{" "}
              in the meantime.
            </p>
          )}
        </div>

        {showGroup && sessions.length === 0 && activeSubject && (
          <Link
            href={`/tuition/interest?subject=${activeSubject}`}
            className="mt-6 inline-block rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium hover:border-ink/40"
          >
            Register interest →
          </Link>
        )}

        {source === "fallback" && reason && process.env.NODE_ENV !== "production" && (
          <p className="mt-10 font-mono text-[11px] text-ink/40">schedule source: fallback ({reason})</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function hrefWith({ subject, type }: { subject: string; type: string }): string {
  const p = new URLSearchParams();
  if (subject) p.set("subject", subject);
  if (type && type !== "all") p.set("type", type);
  const q = p.toString();
  return q ? `/calendar?${q}` : "/calendar";
}

function Filters({
  legend, options, active, hrefFor,
}: {
  legend: string;
  options: { key: string; label: string }[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        {legend}
      </span>
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Link
            key={o.key || "all"}
            href={hrefFor(o.key)}
            aria-current={on ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              on ? "border-ink bg-ink text-parchment" : "border-ink/20 text-ink/70 hover:border-ink/40"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
