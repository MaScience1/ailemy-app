/**
 * What a valid announcement is — decided once, without a database.
 *
 * ⚠ PURE ON PURPOSE. Every rule below is also a database constraint (0022's
 * category/status CHECKs, 0039's announcements_window_ordered) or a rendering
 * rule (half a CTA is no CTA). Expressing them here means the admin sees a
 * sentence instead of a constraint-violation string, and a test can prove each
 * one without credentials.
 *
 * ⚠ THIS FILE IS NOT THE ENFORCEMENT. The database is. If these ever disagree,
 * the database wins and the admin gets an ugly error — which is the correct
 * failure direction, and why none of these checks is a reason to drop a
 * constraint from the SQL.
 */

export const CATEGORIES = ["update", "papers", "content", "cohort"] as const;
export const STATUSES = ["draft", "live", "archived"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];

export type AnnouncementFields = {
  title: string;
  /**
   * ⚠ NEVER NULL. announcements.body is NOT NULL in production — discovered by
   * the live sabotage run on 2026-08-19, and corrected in 0022 the same day.
   * A blank box becomes "", which satisfies the column and reads back as "no
   * body" (the reader nulls empty strings, and the bar renders no paragraph).
   * Leaving it null here would hand an admin a raw 23502 for the entirely
   * reasonable act of writing a title-only banner.
   */
  body: string;
  category: Category;
  status: Status;
  ctaLabel: string | null;
  ctaUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  enabled: boolean;
};

export type Validated =
  | { ok: true; fields: AnnouncementFields }
  | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

/**
 * ⚠ A datetime-local INPUT HAS NO TIMEZONE, AND A WINDOW WITHOUT ONE IS A GUESS.
 * The browser sends "2026-09-01T19:00". Handing that to Postgres as timestamptz
 * makes it depend on the server's zone — so the form also submits the browser's
 * offset in minutes and we resolve to a real instant here. Absent offset means
 * we refuse to guess and treat the value as UTC, which is at least stated.
 */
export function toInstant(local: string | null, offsetMinutes: number | null): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // getTimezoneOffset() is minutes to ADD to local to reach UTC.
  const ms = asUtc + (offsetMinutes ?? 0) * 60_000;
  return new Date(ms).toISOString();
}

export function readAnnouncementForm(fd: FormData): Validated {
  const title = clean(fd.get("title"));
  if (!title) return { ok: false, error: "Title is required." };

  const categoryRaw = String(fd.get("category") ?? "").trim();
  if (!(CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return { ok: false, error: `Category must be one of ${CATEGORIES.join(", ")}.` };
  }
  const statusRaw = String(fd.get("status") ?? "").trim();
  if (!(STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: `Status must be one of ${STATUSES.join(", ")}.` };
  }

  const offsetRaw = String(fd.get("tz_offset") ?? "").trim();
  const offset = offsetRaw !== "" && Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : null;
  const startsAt = toInstant(clean(fd.get("starts_at")), offset);
  const endsAt = toInstant(clean(fd.get("ends_at")), offset);

  // Mirrors 0039's announcements_window_ordered. A backwards window is never
  // active, which on screen reads as "the banner is broken" rather than a typo.
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, error: "The end of the window must be after its start." };
  }

  const ctaLabel = clean(fd.get("cta_label"));
  const ctaUrl = clean(fd.get("link_url"));
  // ⚠ HALF A CTA IS NO CTA — refused rather than silently dropped, because an
  // admin who typed a label and forgot the link must be told, not ignored.
  if (ctaLabel && !ctaUrl) return { ok: false, error: "A CTA label needs a link. Add the URL or clear the label." };
  if (ctaUrl && !ctaLabel) return { ok: false, error: "A link needs CTA words. Add the label or clear the URL." };

  const priorityRaw = String(fd.get("priority") ?? "0").trim();
  const priority = priorityRaw === "" ? 0 : Number(priorityRaw);
  if (!Number.isInteger(priority)) return { ok: false, error: "Priority must be a whole number." };

  const enabled = Boolean(fd.get("enabled"));

  // ⚠ THE ONE RULE THE DATABASE DOES NOT ENFORCE, AND THE REASON IT IS HERE.
  // 0039's announcements_read_public_bar gates the public bar on `enabled` and
  // the window ONLY — it never looks at `status`. So an enabled draft is
  // publicly visible, which is the opposite of what "draft" means to the person
  // typing it. Refused here. A CHECK (NOT enabled OR status = 'live') belongs
  // in a future migration; until then this is the only thing standing between a
  // half-written draft and the top of every page.
  if (enabled && statusRaw !== "live") {
    return {
      ok: false,
      error:
        "An announcement can only be switched on when its status is Live. " +
        "The public bar does not check status, so an enabled draft would be visible to everyone.",
    };
  }

  return {
    ok: true,
    fields: {
      title,
      body: clean(fd.get("body")) ?? "",
      category: categoryRaw as Category,
      status: statusRaw as Status,
      ctaLabel,
      ctaUrl,
      startsAt,
      endsAt,
      priority,
      enabled,
    },
  };
}

/**
 * Column names as 0022 + 0039 have them.
 *
 * `existingPublishedAt` is passed on edit so a re-save does not restamp it.
 * published_at is when this was FIRST published — resetting it on every typo
 * fix would silently reorder the signed-in students' feed, which sorts on it.
 */
export function toRow(
  f: AnnouncementFields,
  existingPublishedAt: string | null = null,
): Record<string, unknown> {
  return {
    title: f.title,
    body: f.body,
    category: f.category,
    status: f.status,
    cta_label: f.ctaLabel,
    link_url: f.ctaUrl,
    starts_at: f.startsAt,
    ends_at: f.endsAt,
    priority: f.priority,
    enabled: f.enabled,
    // 0022's student-facing policy needs published_at; a live announcement with
    // a NULL one is invisible to signed-in students while visible on the public
    // bar, which is two surfaces disagreeing about the same row.
    published_at:
      f.status === "live" ? existingPublishedAt ?? new Date().toISOString() : existingPublishedAt,
    updated_at: new Date().toISOString(),
  };
}

/** Whether the public bar would currently show this row. Used to label the list. */
export function isLiveNow(
  f: { enabled: boolean; startsAt: string | null; endsAt: string | null },
  now: Date,
): boolean {
  if (!f.enabled) return false;
  if (f.startsAt && new Date(f.startsAt) > now) return false;
  if (f.endsAt && new Date(f.endsAt) <= now) return false;
  return true;
}
