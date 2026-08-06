/**
 * The storage path scheme for past-paper PDFs, and the validator that guards it.
 *
 * ONE definition, shared by the route that mints signed upload URLs and the
 * server action that persists the resulting paths. The client now chooses when
 * to upload, so the server must be able to say exactly which paths it is
 * willing to write into a row — and that rule has to live in one place or the
 * two copies drift apart.
 *
 * No `server-only`: nothing here touches the request, cookies or the database,
 * and keeping it importable from both sides is the point.
 *
 * PATH PATTERN
 *     papers/<uuid>/<kind>-<epoch_ms>.pdf
 *
 * <uuid> is the past_papers row id when editing, or a freshly minted v4 UUID
 * when creating (which then becomes the row id, so the object never has to be
 * moved). <kind> is one of the three slots. Grouping by uuid means every file
 * for a paper sits in one prefix, which is what makes the orphan sweep in
 * migration 0016 tractable.
 */

export const PAPERS_BUCKET = "papers";

export const PAPER_FILE_KINDS = [
  "paper",
  "markscheme",
  "examiner-report",
] as const;

export type PaperFileKind = (typeof PAPER_FILE_KINDS)[number];

export function isPaperFileKind(value: string): value is PaperFileKind {
  return (PAPER_FILE_KINDS as readonly string[]).includes(value);
}

/** Canonical v4-shaped UUID check. Deliberately strict — this segment becomes a row id. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUploadGroupId(value: string): boolean {
  return UUID_RE.test(value);
}

/** Build the object key for one slot. The server owns this — never the client. */
export function buildPaperPath(
  groupId: string,
  kind: PaperFileKind,
  now = Date.now(),
): string {
  return `${PAPERS_BUCKET}/${groupId}/${kind}-${now}.pdf`;
}

/**
 * Accept only paths this application could itself have minted.
 *
 * THIS IS THE LOAD-BEARING CHECK. Before this change the server uploaded the
 * bytes and therefore chose the path; now the browser uploads and submits a
 * path back, so without this an admin could point a row at any object in the
 * bucket — or at a crafted key with traversal segments. Anything that does not
 * match the exact minted shape is refused.
 */
const PAPER_PATH_RE = new RegExp(
  `^${PAPERS_BUCKET}/` +
    `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/` +
    `(?:${PAPER_FILE_KINDS.join("|")})-\\d{10,}\\.pdf$`,
  "i",
);

export function isValidPaperPath(value: string): boolean {
  // Reject traversal outright rather than relying on the regex alone, so the
  // intent is legible and a future loosening of the pattern cannot reintroduce it.
  if (value.includes("..") || value.includes("//")) return false;
  return PAPER_PATH_RE.test(value);
}

/**
 * Normalise a submitted path field: empty string means "no file in this slot"
 * and becomes null; anything non-empty must validate.
 *
 * Returns { ok: false } rather than throwing so the caller can surface a
 * readable form error instead of a 500.
 */
export function readSubmittedPaperPath(
  raw: FormDataEntryValue | null,
): { ok: true; path: string | null } | { ok: false } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: true, path: null };
  if (!isValidPaperPath(value)) return { ok: false };
  return { ok: true, path: value };
}
