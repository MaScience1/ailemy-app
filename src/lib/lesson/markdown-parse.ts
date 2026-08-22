/**
 * The notes markdown PARSER — pure, no React, no JSX.
 *
 * ============================================================================
 * ⚠ SPLIT FROM THE RENDERER SO THE SUITE CAN ACTUALLY LOAD IT
 * ============================================================================
 * The test suites are plain Node programs and Node strips types but does not
 * compile JSX, so a .tsx module cannot be imported by a test at all. Keeping
 * the parsing here — where the security-relevant behaviour lives — means the
 * "no raw HTML is ever parsed" claim is provable by sabotage rather than
 * asserted in a comment. markdown.tsx renders what this returns.
 */

export type Block =
  | { kind: "h2" | "h3" | "p" | "quote"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    const h3 = /^###\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);

    if (h3) {
      flushPara(); flushList();
      blocks.push({ kind: "h3", text: h3[1] });
    } else if (h2) {
      flushPara(); flushList();
      blocks.push({ kind: "h2", text: h2[1] });
    } else if (ul) {
      flushPara();
      if (list?.kind !== "ul") { flushList(); list = { kind: "ul", items: [] }; }
      list.items.push(ul[1]);
    } else if (ol) {
      flushPara();
      if (list?.kind !== "ol") { flushList(); list = { kind: "ol", items: [] }; }
      list.items.push(ol[1]);
    } else if (quote) {
      flushPara(); flushList();
      blocks.push({ kind: "quote", text: quote[1] });
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}

