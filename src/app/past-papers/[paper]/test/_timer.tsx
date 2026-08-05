"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Countdown timer for the test workspace.
 *
 * Deadline-based, not tick-based: pressing start records `Date.now() + remaining`
 * and every tick recomputes from that deadline. A setInterval that subtracted
 * 1000ms per fire would drift, and would lose real time whenever the tab is
 * backgrounded and the browser throttles timers — which is exactly when a
 * student under exam conditions would be hurt by it.
 *
 * NO PERSISTENCE in this commit: a reload restarts the clock. That is
 * deliberate per the brief, and is the main reason this is not yet usable for a
 * real timed attempt.
 *
 * Starts PAUSED. The clock should not run because a page happened to load.
 *
 * NULL DURATION: this used to count down from a hardcoded 90 minutes for every
 * paper, because the schema could not express an exam length. Migration 0015
 * adds past_papers.duration_minutes; where it is still null the timer says so
 * rather than inventing a length. A wrong exam duration is worse than no clock.
 */
export function TestTimer({
  durationMinutes,
}: {
  durationMinutes: number | null;
}) {
  if (durationMinutes == null || durationMinutes <= 0) {
    return (
      <p
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/50"
        title="Set a duration for this paper in the admin panel to enable the countdown."
      >
        Duration not recorded
      </p>
    );
  }
  return <Countdown durationMinutes={durationMinutes} />;
}

function Countdown({ durationMinutes }: { durationMinutes: number }) {
  const durationMs = durationMinutes * 60_000;
  const [remaining, setRemaining] = useState(durationMs);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, (deadlineRef.current ?? 0) - Date.now());
      setRemaining(left);
      if (left === 0) setRunning(false);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function toggle() {
    if (running) {
      // Freeze the true remaining time rather than the last painted value.
      setRemaining(Math.max(0, (deadlineRef.current ?? 0) - Date.now()));
      setRunning(false);
    } else {
      if (remaining === 0) return;
      deadlineRef.current = Date.now() + remaining;
      setRunning(true);
    }
  }

  const expired = remaining === 0;

  return (
    <div className="flex items-center gap-3">
      <span
        role="timer"
        // Deliberately not a live region: announcing every tick would make the
        // page unusable with a screen reader. The button label carries state.
        aria-live="off"
        aria-label={`Time remaining: ${spokenTime(remaining)}`}
        className={`font-mono text-lg tabular-nums tracking-[0.1em] sm:text-xl ${
          expired ? "text-danger" : "text-snow"
        }`}
      >
        {formatTime(remaining)}
      </span>

      <button
        type="button"
        onClick={toggle}
        disabled={expired}
        className="font-mono inline-flex items-center gap-1.5 rounded-md border border-snow/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-parchment/80 transition-colors hover:border-snow/45 hover:text-snow disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? (
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{running ? "Pause" : expired ? "Time up" : "Start"}</span>
      </button>
    </div>
  );
}

/** h:mm:ss once an hour or more remains, mm:ss below that. */
function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function spokenTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (total === 0) return "none, time is up";
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (!parts.length) parts.push("under a minute");
  return parts.join(" ");
}
