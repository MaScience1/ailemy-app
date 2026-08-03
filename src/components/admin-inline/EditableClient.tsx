"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { saveCopy } from "./copy-actions";

/**
 * Click-to-edit inline text. Saves on blur.
 *
 * contentEditable rather than an <input>: this replaces text inside real
 * headings, so it has to inherit the surrounding typography exactly. An input
 * would need every font/size/colour re-declared per call site and would still
 * not wrap like the heading it replaces.
 *
 * React never re-renders the children after mount (the browser owns the text
 * while editing); after a successful save we router.refresh() so the server
 * value becomes the new source of truth.
 */
export function EditableClient({
  copyKey,
  value,
}: {
  copyKey: string;
  value: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function commit() {
    const next = (ref.current?.innerText ?? "").trim();
    if (next === value.trim()) {
      setState("idle");
      setMessage(null);
      return;
    }
    if (!next) {
      // Empty is almost always a mistake; restore rather than blank the page.
      if (ref.current) ref.current.innerText = value;
      return;
    }

    setState("saving");
    const res = await saveCopy(copyKey, next);
    if (res?.error) {
      setState("error");
      setMessage(res.error);
      return;
    }
    setState("idle");
    setMessage(null);
    router.refresh();
  }

  return (
    <span className="relative inline">
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-label={`Edit copy: ${copyKey}`}
        title={copyKey}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (ref.current) ref.current.innerText = value;
            ref.current?.blur();
          }
          // Enter commits for single-line copy; Shift+Enter inserts a break.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ref.current?.blur();
          }
        }}
        className={
          "rounded-sm outline-dashed outline-1 outline-offset-4 transition-colors focus:outline-solid focus:outline-2 " +
          (state === "error"
            ? "outline-red-500 bg-red-50/60"
            : state === "saving"
              ? "outline-amber-500 bg-amber-50/50"
              : "outline-flask/50 hover:bg-flask/5 focus:outline-flask")
        }
      >
        {value}
      </span>
      {message && (
        <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 align-middle text-[10px] font-medium text-white">
          {message}
        </span>
      )}
    </span>
  );
}
