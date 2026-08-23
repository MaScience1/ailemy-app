import type { Card, CardSubject } from "@/lib/flashcards/types.ts";
import { Blocks } from "./Blocks";

/**
 * One physical card face — the shell every card type shares (§17, §46).
 *
 * ============================================================================
 * ⚠ ONE SHELL, NINE LAYOUTS — NOT NINE CARDS
 * ============================================================================
 * Every type gets the same paper, the same edge, the same type scale and the
 * same accent treatment; what differs is which blocks the author put in it and
 * the small type label at the top. That is why a tenth card type costs a label
 * and nothing else, and why the deck cannot drift into looking like nine
 * different products.
 *
 * ⚠ THE ACCENT IS AN EDGE, NOT A FILL (§3). Subject colour appears as the top
 * rule, the card number, the list markers and the exam callout tint. The card
 * surface stays near-white so the text is the thing being read — a card
 * flooded with saturated orange is a poster, not a revision card.
 *
 * ⚠ AND SUBJECT IS NEVER COLOUR ALONE (§49). The subject is written on the
 * card, in words, beside the accent.
 */

const TYPE_LABEL: Record<Card["type"], string> = {
  definition: "Definition",
  key_facts: "Key facts",
  diagram: "Diagram",
  formula: "Formula",
  worked_example: "Worked example",
  exam_tip: "Exam tip",
  comparison: "Comparison",
  image_annotation: "Diagram",
  summary: "Summary",
};

const SUBJECT_LABEL: Record<CardSubject, string> = {
  chemistry: "Chemistry",
  biology: "Biology",
  physics: "Physics",
};

export function CardFace({
  card,
  subject,
  index,
  total,
  side = "front",
  showSubject = true,
}: {
  card: Card;
  subject: CardSubject;
  index: number;
  total: number;
  side?: "front" | "back";
  showSubject?: boolean;
}) {
  const raw = side === "back" && card.back ? card.back : card.front;

  /**
   * ⚠ A DEFINITION CARD NAMED AFTER ITS TERM MUST NOT PRINT THE TERM TWICE.
   * "Atom" as the card title above "Atom" as the definition heading is the
   * most natural way to author a definition card and it looked like a bug.
   * Dropping the duplicate here means an author can title the card whatever
   * reads best without having to know this rule — which is the point of a
   * shell that authors do not have to think about.
   */
  const blocks = raw.map((b) =>
    b.kind === "definition" && b.term.trim().toLowerCase() === card.title.trim().toLowerCase()
      ? ({ kind: "text", body: b.body } as const)
      : b,
  );

  return (
    <article
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-ink/12 bg-[#FFFDF9] shadow-[0_1px_2px_rgba(15,20,25,0.05),0_10px_28px_-16px_rgba(15,20,25,0.28)]"
      aria-label={`Card ${index + 1} of ${total}: ${card.title}`}
    >
      {/* the top rule — the accent's most restrained job */}
      <div aria-hidden className="h-[3px] w-full shrink-0 bg-[var(--subject-accent)] opacity-80" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              {showSubject && <>{SUBJECT_LABEL[subject]} · </>}
              {TYPE_LABEL[card.type]}
              {side === "back" && " · Answer"}
            </p>
            <h3 className="font-display mt-2 text-[1.35rem] font-medium leading-[1.2] tracking-tight sm:text-2xl">
              {card.title}
            </h3>
            {card.subtitle && (
              <p className="mt-1 text-sm text-ink/60">{card.subtitle}</p>
            )}
          </div>
          {/* the numbered card marker (§3) */}
          <span
            aria-hidden
            className="font-mono shrink-0 rounded-full border border-[var(--subject-border)] bg-[var(--subject-tint)] px-2 py-0.5 text-[10px] tracking-[0.1em] text-[var(--subject-text)]"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </header>

        <div className="min-w-0 flex-1">
          <Blocks blocks={blocks} />
        </div>

        {card.specCodes && card.specCodes.length > 0 && (
          <footer className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {card.specCodes.map((c) => (
              <span
                key={c}
                className="font-mono rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-ink/50"
              >
                Spec {c}
              </span>
            ))}
          </footer>
        )}
      </div>
    </article>
  );
}
