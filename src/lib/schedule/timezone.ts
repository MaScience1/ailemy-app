/**
 * Wall-clock times, real instants, and two clocks on screen (§44, §45).
 *
 * ============================================================================
 * ⚠ NO OFFSET IS EVER WRITTEN DOWN IN THIS FILE
 * ============================================================================
 * Not "+03:00" for Doha, and above all not "+01:00" for London. The spec is
 * explicit: when the UK moves BST → GMT the conversions must follow on their
 * own. Every offset here is ASKED FOR, per instant, from the platform's own
 * IANA database via Intl. A cohort scheduled in September and read in December
 * gets December's answer.
 *
 * ⚠ A TIMETABLE IS A WALL CLOCK, NOT AN INSTANT. "Tuesday 7:00 PM Doha" is a
 * rule about a clock face; the instant it means depends on the date. Storing
 * one instant and adding 7 days repeatedly is how a term-long timetable drifts
 * an hour halfway through in any zone with DST. So rules are stored as
 * (weekday, local time, IANA zone) and resolved date by date.
 *
 * Asia/Qatar happens to have no DST today. That is not a licence to shortcut —
 * the students are in Doha, London and elsewhere, the London side moves twice a
 * year, and a Qatari rule change would be somebody else's silent bug.
 */

/** The school's canonical teaching timezone. Everything is scheduled in it. */
export const CANONICAL_TZ = "Asia/Qatar";

/** Shown beside the canonical time when the viewer is somewhere else. */
export const CANONICAL_LABEL = "Doha";

/**
 * Minutes that `tz` is ahead of UTC **at this instant**.
 *
 * Works by asking Intl what the instant looks like on a clock in that zone,
 * reassembling those parts as if they were UTC, and taking the difference.
 * That is the only way to get an offset without a table, and it is correct
 * across DST because the answer is derived from the instant itself.
 */
export function zoneOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);

  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  // ⚠ `% 24`. With hour12:false some ICU builds render midnight as "24", which
  // Date.UTC would roll into the next day and put the offset out by 24 hours.
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

/**
 * "2026-09-15" + "19:00" in Asia/Qatar → the real UTC instant.
 *
 * ⚠ TWO PASSES, AND THE SECOND ONE IS NOT DECORATION. The offset we need is the
 * offset *at the answer*, which we do not have until we have the answer. The
 * first pass guesses using the offset at the naive instant; the second recomputes
 * using the guess. On a DST changeover day those two differ by an hour, and a
 * single-pass version is wrong for exactly the lessons around the changeover —
 * the ones a term timetable is most likely to contain.
 */
export function zonedTimeToInstant(dateISO: string, timeHHMM: string, tz: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  const t = /^(\d{2}):(\d{2})/.exec(timeHHMM);
  if (!d || !t) return null;

  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive), tz) * 60_000);
  guess = new Date(naive - zoneOffsetMinutes(guess, tz) * 60_000);
  return Number.isNaN(guess.getTime()) ? null : guess;
}

/**
 * "7:00 PM" in the given zone.
 *
 * ⚠ THE SPACE IS LOAD-BEARING. en-GB renders "7:00 pm"; uppercasing it with a
 * regex that swallowed the leading space produced "7:00PM" on every calendar
 * surface at once. Normalise the case, keep exactly one space.
 */
export function formatTime(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
  })
    .format(instant)
    // \u202f is the narrow no-break space some ICU builds emit before am/pm.
    .replace(/[\s\u202f]*(am|pm)\.?$/i, (_m, meridiem: string) => ` ${meridiem.toUpperCase()}`);
}

/** "Tue 15 Sep" in the given zone. */
export function formatDay(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
  }).format(instant);
}

/** "YYYY-MM-DD" as that zone's calendar reads it. */
export function calendarDate(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

export type DualTime = {
  /** Always present. The school's own clock. */
  canonical: string;
  canonicalLabel: string;
  /**
   * ⚠ NULL WHEN THE VIEWER IS ALREADY IN DOHA, or when we do not know where
   * they are. Rendering "7:00 PM Doha · 7:00 PM Doha" is noise, and inventing a
   * second time for a viewer whose zone we are guessing at is worse than
   * showing one honest one.
   */
  viewer: string | null;
  viewerLabel: string | null;
};

/** A short human label for an IANA zone: "Asia/Qatar" → "Doha". */
export function zoneLabel(tz: string): string {
  const leaf = tz.split("/").pop() ?? tz;
  return leaf.replace(/_/g, " ");
}

/**
 * The pair of times a public surface should print.
 *
 * ⚠ THE CANONICAL TIME IS NEVER OMITTED. A student in London who reads only
 * "5:00 PM" and then talks to the teacher about "five o'clock" has been
 * mis-served by the interface. Doha time is what the school runs on and is
 * always on screen; the local time is the convenience beside it.
 */
export function dualTime(
  instant: Date,
  viewerTz: string | null,
  canonicalTz: string = CANONICAL_TZ,
): DualTime {
  const canonical = formatTime(instant, canonicalTz);
  const base: DualTime = {
    canonical, canonicalLabel: CANONICAL_LABEL, viewer: null, viewerLabel: null,
  };
  if (!viewerTz || viewerTz === canonicalTz) return base;

  let viewer: string;
  try {
    viewer = formatTime(instant, viewerTz);
  } catch {
    // An unusable zone string from a cookie or a browser is not worth a crash;
    // the canonical time alone is still correct and complete.
    return base;
  }

  // Same clock face, different zone name (Doha and, say, Africa/Nairobi in
  // winter) — a second identical number reads as a rendering fault.
  if (viewer === canonical) return base;

  return { ...base, viewer, viewerLabel: zoneLabel(viewerTz) };
}

/** Whether a string is a zone this runtime actually knows. */
/**
 * ============================================================================
 * ⚠ ICU ACCEPTS LEGACY ABBREVIATIONS AND RESOLVES THEM TO THE WRONG PLACE
 * ============================================================================
 * "Does Intl throw?" was the old test, and it is not enough. Intl accepts a
 * bare abbreviation and silently remaps it — measured on this platform:
 *
 *     BST -> Asia/Dhaka          a 19:00 Doha lesson renders 22:00, not 17:00
 *     AST -> America/Anchorage   renders 08:00
 *     EST -> America/Panama      CET -> Europe/Brussels
 *     PST -> America/Los_Angeles IST -> Asia/Calcutta
 *
 * ⚠ BST IS THE ONE THAT BITES AILEMY. A British student typing the ordinary
 * abbreviation for British Summer Time gets Bangladesh, five hours out, with
 * no error anywhere. Reported from the mobile build; verified here.
 *
 * ⚠ AND IT IS NOT ONLY A DISPLAY BUG ON OUR SIDE. cohort_schedules.timezone
 * and teacher_availability.timezone are resolved to real INSTANTS at expansion
 * time, so an abbreviation there does not mis-render a lesson — it schedules
 * one at the wrong moment, and the exclusion constraint then protects the
 * wrong slot.
 *
 * ⚠ THE TEST IS SHAPE PLUS VALIDITY, NOT "DOES IT RESOLVE TO ITSELF". That
 * tempting one-liner produces false rejections, twice over:
 *   · case is canonicalised — "asia/qatar" resolves to "Asia/Qatar"
 *   · modern names are aliased — "Asia/Kolkata" resolves to "Asia/Calcutta",
 *     and Kolkata is the CURRENT correct IANA name for India
 * Requiring Region/City catches every bare abbreviation instead, because not
 * one of them contains a slash, and it never rejects a real zone. UTC is the
 * single legitimate slashless name and is allowed by name.
 */
export function canonicalTimeZone(tz: string | null | undefined): string | null {
  if (!tz || typeof tz !== "string") return null;
  const trimmed = tz.trim();
  if (trimmed.length === 0) return null;
  // Region/City, or exactly UTC. Everything else is an abbreviation.
  if (trimmed.toUpperCase() !== "UTC" && !trimmed.includes("/")) return null;
  try {
    // ⚠ THE CANONICAL FORM IS WHAT CALLERS SHOULD STORE, so a lowercase entry
    // is corrected rather than refused and two rows cannot disagree about the
    // same zone by capitalisation alone.
    return new Intl.DateTimeFormat("en-GB", { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function isKnownTimeZone(tz: string | null | undefined): tz is string {
  return canonicalTimeZone(tz) !== null;
}

/**
 * The clock in that zone, right now — for showing beside a zone the user chose.
 *
 * ⚠ A ZONE NAME CANNOT BE CHECKED BY READING IT. "Asia/Qatar" and
 * "America/Anchorage" look equally plausible to somebody who picked one from a
 * list; the current time beside it is what makes a wrong choice visible in the
 * second it is made. This is the same guard the mobile client added.
 */
export function currentTimeIn(tz: string, now: Date = new Date()): string | null {
  const canonical = canonicalTimeZone(tz);
  if (!canonical) return null;
  return formatTime(now, canonical);
}


/**
 * Why a zone was refused, in a sentence an admin can act on.
 *
 * ⚠ "not a timezone this system knows" IS TRUE AND USELESS FOR "BST". The
 * platform knows BST perfectly well — it means Asia/Dhaka, which is the whole
 * problem. Naming what it would have resolved to is what turns a refusal into
 * an explanation.
 */
export function tzError(raw: string): string {
  const looksLikeAbbreviation = !raw.includes("/") && raw.trim().toUpperCase() !== "UTC";
  if (looksLikeAbbreviation) {
    let wouldMean: string | null = null;
    try {
      wouldMean = new Intl.DateTimeFormat("en-GB", { timeZone: raw }).resolvedOptions().timeZone;
    } catch { wouldMean = null; }
    return wouldMean && wouldMean !== raw
      ? `"${raw}" is an abbreviation, and it would be read as ${wouldMean} — use the Region/City name, like Europe/London or Asia/Qatar.`
      : `"${raw}" is not a full timezone name. Use the Region/City form, like Europe/London or Asia/Qatar.`;
  }
  return `"${raw}" is not a timezone this system knows.`;
}
