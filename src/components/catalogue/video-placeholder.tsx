import { Play } from "lucide-react";

/**
 * 16:9 placeholder used on the lesson page until Mux is wired in. Reads as
 * intentional ("Video coming soon") rather than broken. Subtle play glyph
 * keeps it from feeling like a blank rectangle.
 */
export function VideoPlaceholder() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink text-snow">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 96px)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-snow/15 bg-snow/[0.04]">
          <Play
            className="h-5 w-5 translate-x-[1px] fill-snow/70 text-snow/70"
            aria-hidden="true"
          />
        </span>
        <div className="space-y-2">
          <p className="font-display text-xl font-medium tracking-tight">
            Video coming soon
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/45">
            Mux integration in progress
          </p>
        </div>
      </div>
    </div>
  );
}
