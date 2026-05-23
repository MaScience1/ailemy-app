"use client";

import MuxPlayer, { type MuxCSSProperties } from "@mux/mux-player-react";

type MuxLessonPlayerProps = {
  /** Mux playback ID (UUID format, stored on lessons.voice_video_mux_id). */
  playbackId: string;
  /** Lesson title, surfaced to Mux Data analytics via metadata.video_title. */
  title: string;
  /** Seconds into the video to use for the poster frame. Default: 1s. */
  posterTime?: number;
};

/**
 * Brand-themed Mux Player for lesson video.
 *
 * Theming is done via Mux Player CSS custom properties — `accentColor` sets
 * the timeline/scrubber/control accent, and a couple of additional
 * `--media-*` properties pull the chrome into the Ailemy ink+parchment+signal
 * palette. No autoplay, no fullscreen pop, no analytics dashboards — just
 * playback. Mux Data still records views in the Mux UI on its own.
 *
 * The container provides the 16:9 aspect ratio and the editorial border; the
 * <MuxPlayer> fills it (style.height: 100%). Mux Player otherwise picks its
 * own intrinsic sizing which doesn't match the lesson page layout.
 */
export function MuxLessonPlayer({
  playbackId,
  title,
  posterTime = 1,
}: MuxLessonPlayerProps) {
  // MuxCSSProperties extends React.CSSProperties with an index signature for
  // `--*` custom properties so the brand-theming variables type-check cleanly.
  const themeStyle: MuxCSSProperties = {
    height: "100%",
    width: "100%",
    "--media-background-color": "#0F1419",
    "--media-control-background": "rgba(15, 20, 25, 0.85)",
    "--media-primary-color": "#F5EFE6",
    "--media-secondary-color": "#B8FF3D",
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-parchment/10 bg-ink">
      <MuxPlayer
        playbackId={playbackId}
        accentColor="#B8FF3D"
        autoPlay={false}
        poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=${posterTime}`}
        metadata={{
          video_id: playbackId,
          video_title: title,
        }}
        style={themeStyle}
        streamType="on-demand"
      />
    </div>
  );
}

export default MuxLessonPlayer;
