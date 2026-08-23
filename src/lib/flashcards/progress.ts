/**
 * Deck resume and saved cards (§13, §23, §65).
 *
 * ============================================================================
 * ⚠ BROWSER-LOCAL TODAY, AND THE UI SAYS SO — IT NEVER CLAIMS OTHERWISE
 * ============================================================================
 * The durable tables are a parked _PROPOSED_ migration. Until they land,
 * resume and saved cards live in this browser, and every surface that shows
 * them says "on this device". §13 asks for durable cross-device progress
 * *where existing architecture supports it*; it does not yet, and announcing
 * it early would be the same false claim the practice history footer once
 * made.
 *
 * ⚠ AND IT IS NOT A PARALLEL USER-PROGRESS SYSTEM (§13). Nothing here writes
 * to lesson completion, lesson_view_state or the academic record. It stores
 * where a student is inside a deck — a bookmark, not evidence — which is why
 * a failed write is survivable.
 *
 * ⚠ A FAILED SAVE MUST NEVER BLOCK STUDY (§65). Every function swallows its
 * own storage error and returns a usable value: a student in private browsing,
 * or with a full quota, keeps flicking through cards and simply does not get
 * a resume offer next time.
 *
 * NAMED WIRING POINT: when the table lands, loadDeckProgress/saveDeckProgress
 * gain a server round-trip behind the same signatures and the engine does not
 * change. The device copy stays as the anonymous and offline fallback.
 */

export type DeckProgress = {
  deckId: string;
  lastCard: number;
  cardsViewed: number;
  total: number;
  updatedAt: string;
};

const PROGRESS_KEY = "ailemy:cards:progress";
const SAVED_KEY = "ailemy:cards:saved";

function readMap(): Record<string, DeckProgress> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DeckProgress>) : {};
  } catch {
    return {};
  }
}

export function loadDeckProgress(deckId: string): DeckProgress | null {
  const p = readMap()[deckId];
  // ⚠ VALIDATED, NOT TRUSTED. localStorage is user-writable, and a lastCard of
  // 900 would open a deck on a card that does not exist.
  if (!p || typeof p.lastCard !== "number" || p.lastCard < 0) return null;
  if (typeof p.total === "number" && p.total > 0 && p.lastCard >= p.total) return null;
  return p;
}

export function saveDeckProgress(
  deckId: string,
  input: { lastCard: number; cardsViewed: number; total: number },
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = readMap();
    const prev = all[deckId];
    all[deckId] = {
      deckId,
      lastCard: input.lastCard,
      // Furthest reached, never fewer — going back to card 2 does not mean
      // the student has seen only two.
      cardsViewed: Math.max(prev?.cardsViewed ?? 0, input.cardsViewed),
      total: input.total,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    /* §65 — storage refused; studying continues */
  }
}

export function loadSavedCards(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * ⚠ RETURNS THE NEW SET EVEN IF THE WRITE FAILED. The star must respond to
 * the click it was given; whether it survives the session is a storage
 * question, and losing the star silently is better than a control that
 * appears dead.
 */
export function toggleSavedCard(cardId: string): string[] {
  const current = loadSavedCards();
  const next = current.includes(cardId)
    ? current.filter((c) => c !== cardId)
    : [...current, cardId];
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    /* §65 */
  }
  return next;
}
