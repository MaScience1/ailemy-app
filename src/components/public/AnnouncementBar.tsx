import Link from "next/link";

import { loadAnnouncement } from "@/lib/public/readers";

/**
 * The site-wide bar, above the navigation.
 *
 * ⚠ IT RENDERS NOTHING UNLESS AN ANNOUNCEMENT IS ENABLED AND IN ITS WINDOW.
 * The reader is database-first (0039); when the table has no announcements —
 * or the migration has not been applied — the answer is null and the bar is
 * absent. There is no hardcoded banner, because a hardcoded banner is exactly
 * the thing the founder asked to be able to switch off without a deploy.
 *
 * ⚠ NO LAYOUT SHIFT. Absent means absent — no reserved strip that collapses
 * after hydration. This is a server component; there is no hydration step.
 */
export async function AnnouncementBar() {
  const { data: live } = await loadAnnouncement();
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
