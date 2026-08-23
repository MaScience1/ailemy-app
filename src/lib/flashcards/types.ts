/**
 * The flashcard content model.
 *
 * ============================================================================
 * ⚠ NOTES FIRST, QUIZ SECOND — AND THE TYPES ENFORCE IT (§44)
 * ============================================================================
 * `back` is OPTIONAL on every card. A deck of pure reading cards is a
 * first-class deck, not a degenerate quiz; a card only becomes active recall
 * when somebody deliberately authors a back for it. If the model had required
 * front/back, every note would have had to pretend to be a question, which is
 * exactly the Anki-shaped product this is not.
 *
 * ⚠ STRUCTURED BLOCKS, NEVER A BAG OF STRINGS (§18). Content is a list of
 * typed blocks, so a card can carry a definition, a diagram, a formula with
 * its symbol table and an exam-wording note without any of them being
 * smuggled through markdown conventions the renderer has to guess at. Adding
 * a block type later is additive; it does not reinterpret existing content.
 *
 * ⚠ SERIALISABLE AND SELF-CONTAINED (§38). Every type here is plain JSON —
 * no functions, no class instances, no React. A deck can be fetched, cached,
 * embedded in a payload or written to disk unchanged, which is what makes
 * offline support later a storage decision rather than a rewrite. Media is
 * referenced by path, never inlined.
 */

export const SUBJECTS = ["chemistry", "biology", "physics"] as const;
export type CardSubject = (typeof SUBJECTS)[number];

export const CARD_TYPES = [
  "definition",
  "key_facts",
  "diagram",
  "formula",
  "worked_example",
  "exam_tip",
  "comparison",
  "image_annotation",
  "summary",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

// ── content blocks ──────────────────────────────────────────────────────────

/**
 * Inline text with restrained emphasis.
 *
 * ⚠ THE SAME RESTRICTED MARKDOWN SUBSET THE NOTES RENDERER ALREADY USES —
 * **bold**, *italic*, `code` — parsed into elements, never into HTML. Chemical
 * and mathematical notation is typed as Unicode (H₂O, 6.02 × 10²³, mol dm⁻³),
 * exactly as the decks and lesson notes already do. There is no LaTeX in this
 * project and this is not the place to introduce one.
 */
export type RichText = string;

export type MediaRef = {
  /** Path within the existing asset route — never an external URL. */
  path: string;
  /** Required. A diagram with no alt text is not publishable (§49). */
  alt: string;
  caption?: string;
  /** Intrinsic ratio, so the card reserves space and never shifts (§50). */
  aspect?: "16/9" | "4/3" | "1/1" | "3/4";
};

export type Block =
  | { kind: "text"; body: RichText }
  | { kind: "bullets"; items: RichText[] }
  | { kind: "steps"; items: RichText[] }
  /** The thing being defined — rendered as the card's centrepiece. */
  | { kind: "definition"; term: string; body: RichText }
  /** A formula with the symbols spelled out; units are part of the meaning. */
  | { kind: "formula"; expression: string; where?: { symbol: string; meaning: string }[]; units?: string }
  | { kind: "media"; media: MediaRef }
  | { kind: "table"; headers: string[]; rows: string[][] }
  /** Two things held side by side — the comparison card's spine. */
  | { kind: "compare"; left: { label: string; points: RichText[] }; right: { label: string; points: RichText[] } }
  /**
   * A callout. `tone` carries the meaning and is never colour alone (§49):
   * each renders its own label, so greyscale and screen readers agree.
   */
  | { kind: "callout"; tone: "remember" | "exam" | "mistake"; body: RichText };

// ── cards and decks ─────────────────────────────────────────────────────────

export type Card = {
  id: string;
  type: CardType;
  title: string;
  subtitle?: string;
  front: Block[];
  /** Present only for active recall (§15). Absent = a reading card. */
  back?: Block[];
  /** The prompt shown on a two-sided card before it is turned. */
  reveal?: string;
  /** Specification points this card teaches (§27) — codes, shared across boards. */
  specCodes?: string[];
  tags?: string[];
};

export type Deck = {
  id: string;
  subject: CardSubject;
  title: string;
  /** Where it belongs — absent on the standalone preview decks. */
  lessonSlug?: string;
  topic?: string;
  description?: string;
  specCodes?: string[];
  cards: Card[];
};

// ── derived facts, computed rather than authored ────────────────────────────

/**
 * ⚠ READING TIME IS DERIVED, NOT TYPED (§25). An authored "~6 min" is a number
 * that is right on the day it is written and silently wrong after the first
 * edit. This counts the words actually on the cards at a deliberately
 * unhurried 90 wpm — these are dense revision cards, not prose — and rounds up
 * to a whole minute so a three-card deck never advertises "0 min".
 */
export function estimatedMinutes(deck: Deck): number {
  const words = deck.cards.reduce((n, c) => n + countWords(c), 0);
  return Math.max(1, Math.round(words / 90));
}

function countWords(card: Card): number {
  const fromBlocks = (blocks: Block[] | undefined): number =>
    (blocks ?? []).reduce((n, b) => n + blockWords(b), 0);
  return card.title.split(/\s+/).length + fromBlocks(card.front) + fromBlocks(card.back);
}

function blockWords(b: Block): number {
  const w = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  switch (b.kind) {
    case "text": return w(b.body);
    case "bullets": case "steps": return b.items.reduce((n, i) => n + w(i), 0);
    case "definition": return w(b.term) + w(b.body);
    case "formula": return w(b.expression) + (b.where ?? []).reduce((n, x) => n + w(x.meaning), 0);
    case "media": return b.media.caption ? w(b.media.caption) : 0;
    case "table": return b.rows.reduce((n, r) => n + r.reduce((m, c) => m + w(c), 0), 0);
    case "compare": return [...b.left.points, ...b.right.points].reduce((n, p) => n + w(p), 0);
    case "callout": return w(b.body);
  }
}

/**
 * ⚠ THE DENSITY WARNING §48 ASKS FOR. A card that cannot fit its own shell has
 * to be authored down, not silently clipped and not shrunk to unreadable type.
 * This reports; the dev preview surfaces it. Nothing is truncated at runtime.
 */
export const DENSITY_LIMIT = 110;

export function overfullCards(deck: Deck): { id: string; words: number }[] {
  return deck.cards
    .map((c) => ({ id: c.id, words: countWords(c) }))
    .filter((c) => c.words > DENSITY_LIMIT);
}

export const isCardSubject = (v: unknown): v is CardSubject =>
  typeof v === "string" && (SUBJECTS as readonly string[]).includes(v);
