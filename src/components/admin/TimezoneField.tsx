"use client";

import { useState } from "react";

/**
 * A timezone input that shows what the zone actually means.
 *
 * ============================================================================
 * ⚠ A ZONE NAME CANNOT BE CHECKED BY READING IT
 * ============================================================================
 * "Asia/Qatar" and "America/Anchorage" look equally plausible in a text field.
 * The clock in that zone does not — an admin who meant Doha and sees 08:00
 * beside the field knows immediately, in the second they typed it, rather than
 * when a student turns up eleven hours late.
 *
 * ⚠ THIS IS THE ADMIN SURFACE, WHICH IS WHERE THE REAL DAMAGE LIVES. A wrong
 * zone on /profile renders a wrong second clock for one person. A wrong zone on
 * a cohort rule expands into lesson INSTANTS — it does not mis-display a
 * lesson, it schedules one at the wrong moment for everybody on the cohort.
 *
 * ⚠ THE READOUT IS A COURTESY; THE SERVER STILL DECIDES. readRuleForm and
 * readAvailabilityForm both refuse an abbreviation whatever this shows, so a
 * browser with JavaScript off loses the preview and keeps the protection.
 */
export function TimezoneField({
  name, defaultValue, label = "Timezone", hint,
}: {
  name: string;
  defaultValue: string;
  label?: string;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  // Mirrors canonicalTimeZone: Region/City, or exactly UTC. Kept deliberately
  // small — the server's copy is the one that decides.
  const shapeOk = value.trim().toUpperCase() === "UTC" || value.includes("/");
  let resolved: string | null = null;
  let now: string | null = null;
  if (shapeOk && value.trim()) {
    try {
      const f = new Intl.DateTimeFormat("en-GB", {
        timeZone: value.trim(), hour: "numeric", minute: "2-digit", hour12: true,
      });
      resolved = f.resolvedOptions().timeZone;
      now = f.format(new Date());
    } catch {
      resolved = null;
    }
  }

  /**
   * ⚠ AN ABBREVIATION GETS ITS OWN MESSAGE, NAMING WHAT IT WOULD MEAN.
   * "Not a timezone" is false for BST — the platform knows it perfectly well,
   * and that is the problem.
   */
  let wouldMean: string | null = null;
  if (!shapeOk && value.trim()) {
    try {
      wouldMean = new Intl.DateTimeFormat("en-GB", { timeZone: value.trim() })
        .resolvedOptions().timeZone;
    } catch { wouldMean = null; }
  }

  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${name}-tz-state`}
        aria-invalid={value.trim().length > 0 && !resolved}
        className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
      />
      <span id={`${name}-tz-state`} className="mt-1 block text-[11px]" role="status">
        {resolved ? (
          <span className="text-slate-600">
            {resolved} — it is{" "}
            {/* ⚠ THE WHOLE POINT OF THIS COMPONENT. */}
            <strong className="font-medium text-slate-900">{now}</strong> there now
          </span>
        ) : wouldMean ? (
          <span className="text-red-700">
            “{value.trim()}” is an abbreviation — it would be read as{" "}
            <strong className="font-medium">{wouldMean}</strong>. Use the Region/City name.
          </span>
        ) : value.trim() ? (
          <span className="text-red-700">
            Not a timezone. Use the Region/City form, like Europe/London or Asia/Qatar.
          </span>
        ) : (
          <span className="text-slate-500">{hint ?? "Region/City, like Asia/Qatar."}</span>
        )}
      </span>
    </label>
  );
}
