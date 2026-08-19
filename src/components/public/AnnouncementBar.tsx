import Link from "next/link";
import { activeAnnouncement, type Announcement } from "@/lib/public/catalogue";

/**
 * The site-wide bar, above the navigation.
 *
 * ⚠ IT RENDERS NOTHING UNTIL A REAL ANNOUNCEMENT EXISTS. 0039 is unapplied, so
 * the reader below has no table to query and the fallback is an EMPTY list —
 * deliberately, because a hardcoded banner is exactly the thing the founder
 * asked to be able to switch off without a deploy, and it would be
 * un-switch-off-able until the migration runs.
 *
 * ⚠ NO LAYOUT SHIFT. Absent means absent — no reserved strip that collapses
 * after hydration. This is a server component; there is no hydration step.
 */
export async function AnnouncementBar() {
  const rows: (Announcement & { enabled: boolean; startsAt: string | null; endsAt: string | null })[] = [];
  const live = activeAnnouncement(rows, new Date());
  if (!live) return null;

  return (
    <div className="border-b border-ink/10 bg-ink text-parchment">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2.5 text-sm">
        <p className="font-medium">{live.title}</p>
        {live.body && <p className="text-parchment/70">{live.body}</p>}
        {live.ctaLabel && live.ctaUrl && (
          <Link
            href={live.ctaUrl}
            className="ml-auto shrink-0 rounded-full bg-lime px-3 py-1 text-xs font-medium text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            {live.ctaLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}
