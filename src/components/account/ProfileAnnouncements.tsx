import Link from "next/link";

import type { AnnouncementsLoad } from "@/lib/account/profile-reader";

/**
 * General news (§17).
 *
 * ============================================================================
 * ⚠ PLACED BELOW SCHEDULE UPDATES, DELIBERATELY
 * ============================================================================
 * §17 requires operational schedule changes to stay MORE PROMINENT than general
 * announcements. That distinction cannot be made inside this section: the
 * announcements table has no audience, severity or is_operational column —
 * category is a four-value topic vocabulary and priority is a global ordering
 * with no class semantics. So prominence is expressed by POSITION and by
 * heading, with Schedule Updates (the 0053 notification ledger) sitting above.
 *
 * ⚠ AN ERROR IS NOT AN EMPTY STATE. "Nothing new" asserts that the founder has
 * published nothing; a failed read asserts only that we could not look. They
 * look identical on screen and mean opposite things, so the refusal is rendered
 * as itself.
 */
export function ProfileAnnouncements({ load }: { load: AnnouncementsLoad }) {
  if (!load.available) {
    return (
      <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {load.reason}
      </p>
    );
  }
  if (load.items.length === 0) {
    return <p className="mt-3 text-sm leading-relaxed text-ink/60">Nothing new right now.</p>;
  }
  return (
    <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
      {load.items.map((a) => (
        <li key={a.id} className="py-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-sm font-medium">{a.title}</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
              {a.category}
            </span>
            {/* ⚠ DATE ONLY, NO TIME. published_at is an editorial stamp, not an
                event time, and a to-the-minute rendering invites it to be read
                as one. */}
            {a.publishedAt && (
              <span className="ml-auto font-mono text-[10px] text-ink/40">
                {a.publishedAt.slice(0, 10)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">{a.body}</p>
          {a.linkUrl && (
            <Link
              href={a.linkUrl}
              className="mt-1.5 inline-block text-sm underline underline-offset-2 hover:text-ink"
            >
              Read more →
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
