import "server-only";

/**
 * Minimal, escape-first Markdown renderer.
 *
 * Deliberately hand-rolled rather than pulling in a Markdown dependency:
 * the body is admin-authored and rendered with dangerouslySetInnerHTML, so
 * the security property that matters is that NOTHING reaches the output
 * without being HTML-escaped first. Every character is escaped up front, and
 * only the specific constructs below are then re-introduced as tags. Raw HTML
 * in the source is therefore inert rather than executed.
 *
 * Supported: # ## ###, **bold**, *italic*, `code`, [text](href), - lists,
 * 1. lists, > quotes, --- rules, and paragraphs.
 * Link hrefs are restricted to http(s), mailto and site-relative paths, so a
 * `javascript:` URL cannot be smuggled through.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:/i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return null; // javascript:, data:, protocol-relative → dropped
}

/** Inline formatting. Input MUST already be HTML-escaped. */
function inline(escaped: string): string {
  let out = escaped;
  // `code`
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-ink/[0.07] px-1 py-0.5 text-[0.9em]">$1</code>');
  // [text](href)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return text;
    const external = /^https?:\/\//i.test(safe);
    return `<a href="${safe}" class="underline underline-offset-2 hover:text-flask"${
      external ? ' target="_blank" rel="noopener noreferrer"' : ""
    }>${text}</a>`;
  });
  // **bold** then *italic*
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src ?? "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      html.push(`<p class="mt-4 leading-relaxed">${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const cls =
        list.type === "ul"
          ? "mt-4 list-disc space-y-1 pl-6"
          : "mt-4 list-decimal space-y-1 pl-6";
      html.push(
        `<${list.type} class="${cls}">${list.items
          .map((i) => `<li>${inline(i)}</li>`)
          .join("")}</${list.type}>`,
      );
      list = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      const level = h[1].length;
      const size =
        level === 1
          ? "font-display mt-10 text-3xl font-medium tracking-tight md:text-4xl"
          : level === 2
            ? "font-display mt-8 text-2xl font-medium tracking-tight"
            : "font-display mt-6 text-xl font-medium tracking-tight";
      html.push(`<h${level} class="${size}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      html.push('<hr class="mt-8 border-ink/15" />');
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      html.push(
        `<blockquote class="mt-4 border-l-2 border-flask/50 pl-4 italic text-ink/75">${inline(quote[1])}</blockquote>`,
      );
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushAll();
  return html.join("\n");
}
