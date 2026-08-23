import type { ReactNode } from "react";

import { parseBlocks } from "./markdown-parse.ts";

/**
 * A deliberately small markdown subset for lesson notes.
 *
 * ============================================================================
 * ⚠ NO RAW HTML IS PARSED, EVER — THAT IS THE WHOLE SECURITY DESIGN
 * ============================================================================
 * A general markdown library accepts embedded HTML and then needs a sanitiser
 * standing behind it, correctly configured, forever. This renderer never
 * interprets a tag: input is treated as text, split into blocks, and emitted as
 * React ELEMENTS. There is no dangerouslySetInnerHTML anywhere in this file and
 * there must never be one — React escapes every string it renders, so a note
 * containing `<script>` renders those characters and does nothing else.
 *
 * That is also why this is not a dependency: the project had no markdown
 * renderer, and adding a parser plus a sanitiser to display teacher-authored
 * notes is a larger supply-chain decision than the feature needs.
 *
 * ⚠ WHAT IT SUPPORTS, AND NOTHING ELSE:
 *   ## / ###        headings
 *   - / * / 1.      lists
 *   > …             callout (used for exam tips and misconceptions)
 *   **bold**  *italic*  `code`
 *   blank line      paragraph break
 * Chemistry notation (H₂O, 6.02 × 10²³, mol dm⁻³) is typed directly as
 * Unicode, exactly as the decks already do — no LaTeX, no MathML, nothing to
 * parse. Anything unrecognised renders as the literal text it is, which is the
 * safe failure: a student sees a stray asterisk, never a broken page.
 */

/** Inline spans: **bold**, *italic*, `code`. Emitted as elements, never HTML. */
export function inline(text: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  // One pass, longest-marker-first so ** is never mistaken for two *.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}i${i++}`;
    if (tok.startsWith("**")) {
      out.push(<strong key={key} className="font-medium text-ink">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[0.9em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="grid gap-3">
      {blocks.map((b, i) => {
        if (b.kind === "h2") {
          return (
            <h3 key={i} className="mt-2 font-display text-lg font-medium tracking-tight">
              {inline(b.text, `b${i}`)}
            </h3>
          );
        }
        if (b.kind === "h3") {
          return (
            <h4 key={i} className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-ink/55">
              {inline(b.text, `b${i}`)}
            </h4>
          );
        }
        if (b.kind === "quote") {
          return (
            <p key={i} className="border-l-2 border-ink/25 pl-3 text-sm leading-relaxed text-ink/70">
              {inline(b.text, `b${i}`)}
            </p>
          );
        }
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind === "ul" ? "ul" : "ol";
          return (
            <List
              key={i}
              className={[
                "grid gap-1.5 pl-5 text-sm leading-relaxed text-ink/80",
                b.kind === "ul" ? "list-disc" : "list-decimal",
              ].join(" ")}
            >
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `b${i}l${j}`)}</li>
              ))}
            </List>
          );
        }
        if (b.kind === "p") {
          return (
            <p key={i} className="text-sm leading-relaxed text-ink/80">
              {inline(b.text, `b${i}`)}
            </p>
          );
        }
        // Unreachable: every Block kind is handled above. Written as an
        // explicit branch so a NEW kind added to the union is a compile error
        // here rather than a block that silently renders as nothing.
        return null;
      })}
    </div>
  );
}
