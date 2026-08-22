"use client";

/**
 * "This lesson covers → jump to slides" (§24, §76).
 *
 * The deck's own spec chips mark where each code is taught; the server hands
 * this component the FIRST slide per code, and clicking dispatches the same
 * goto event the practice review uses — one navigation mechanism, not two.
 * Rendered only when a mapping exists (§24: real mapping data, never invented).
 */
export function SpecJump({ targets }: { targets: { code: string; slideN: number }[] }) {
  if (targets.length === 0) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-ink/60">
      <span className="uppercase tracking-[0.16em] text-ink/45">Jump to</span>
      {targets.map((t) => (
        <button
          key={t.code}
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("ailemy:lesson-goto-slide", { detail: { slideN: t.slideN } }),
            )
          }
          className="rounded bg-ink/[0.06] px-2 py-0.5 font-medium text-ink/75 transition-colors hover:bg-ink/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Spec {t.code} → slide {t.slideN}
        </button>
      ))}
    </p>
  );
}
