/**
 * The timetable: real zones, derived geometry, and nothing invented.
 *
 * ============================================================================
 * ⚠ THE CENTRAL ASSERTION OF THIS FILE IS THAT AN OFFSET IS NOT A CONSTANT.
 * ============================================================================
 * Asia/Qatar is UTC+3 all year. Europe/London is UTC+0 in winter and UTC+1 in
 * summer. So the gap between them is TWO hours for part of the year and THREE
 * for the rest, and a single "+3" anywhere in the rendering path is wrong for
 * roughly half the calendar — silently, plausibly, and by exactly one hour.
 *
 * A student in London reading 4:00 PM for a 7:00 PM Doha lesson in September
 * would arrive an hour early all autumn and never suspect the interface.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  laneKindFor, isRequestable, minutesFromMidnight, gridBounds,
  positionDay, buildWeek, hourRows, labelForMinutes,
} from "../../../src/lib/calendar/timetable.ts";
import { zoneOffsetMinutes } from "../../../src/lib/schedule/timezone.ts";
import { VIEWS, DEFAULT_VIEW, rangeFor, step, periodLabel } from "../../../src/lib/calendar/grid.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

const DOHA = "Asia/Qatar";
const LONDON = "Europe/London";

/** A minimal real-shaped event. Nothing here stands in for a database row. */
const ev = (o: Partial<Record<string, unknown>> & { startsAt: Date; endsAt: Date }) => ({
  key: String(o.key ?? "k"), type: (o.type ?? "group") as never,
  status: (o.status ?? "scheduled") as never,
  startsAt: o.startsAt, endsAt: o.endsAt,
  title: String(o.title ?? "Lesson"),
  subject: (o.subject ?? null) as string | null,
  qualification: (o.qualification ?? null) as string | null,
  yearGroup: (o.yearGroup ?? null) as string | null,
  cohortSlug: null, teacherName: null, cancelledReason: null,
}) as never;

// ============================================================================
console.log("\n=== 1. §8 — the Qatar/UK gap is not a constant ===");
// ============================================================================
{
  // 16:00 UTC. In Doha that is 19:00 all year round.
  const summer = new Date("2026-09-13T16:00:00Z");
  const winter = new Date("2026-12-13T16:00:00Z");

  const dohaSummer = minutesFromMidnight(summer, DOHA);
  const dohaWinter = minutesFromMidnight(winter, DOHA);
  t("Doha is 19:00 for both instants — it does not observe DST",
    dohaSummer === 19 * 60 && dohaWinter === 19 * 60, `${dohaSummer} / ${dohaWinter}`);

  const londonSummer = minutesFromMidnight(summer, LONDON);
  const londonWinter = minutesFromMidnight(winter, LONDON);
  t("London is 17:00 in September (BST)", londonSummer === 17 * 60, londonSummer);
  t("London is 16:00 in December (GMT)", londonWinter === 16 * 60, londonWinter);

  /**
   * ⚠ THIS IS THE ONE THAT MATTERS. If any part of the path used a fixed
   * offset these two numbers would be equal, and every other assertion in this
   * file could still pass.
   */
  const gapSummer = dohaSummer - londonSummer;
  const gapWinter = dohaWinter - londonWinter;
  /**
   * ⚠ VIA A Set, BECAUSE TYPESCRIPT NARROWED THE OBVIOUS FORM AWAY.
   * Written as `gapSummer === 120 && gapWinter === 180 && gapSummer !== gapWinter`
   * the compiler knows both literals by the third clause and rejects the
   * comparison as unintentional — so the one clause that actually says "these
   * are not the same number" could not be written down. The Set carries the
   * same meaning past the narrowing.
   */
  const distinctGaps = new Set([gapSummer, gapWinter]);
  t("⚠ the gap is 120 minutes in summer and 180 in winter — NOT one number",
    gapSummer === 120 && gapWinter === 180 && distinctGaps.size === 2,
    `summer=${gapSummer} winter=${gapWinter}`);

  // And the same fact one level down, straight from the zone database.
  t("zoneOffsetMinutes agrees, per instant",
    zoneOffsetMinutes(summer, LONDON) === 60 && zoneOffsetMinutes(winter, LONDON) === 0
      && zoneOffsetMinutes(summer, DOHA) === 180 && zoneOffsetMinutes(winter, DOHA) === 180);

  /**
   * ⚠ THE BST BOUNDARY ITSELF. The UK moved on 2026-10-25 at 02:00 local.
   * A lesson the evening before and the evening after must land on different
   * clock faces for the same Doha time — this is the week the bug would ship.
   */
  const beforeClocks = new Date("2026-10-24T16:00:00Z");
  const afterClocks = new Date("2026-10-26T16:00:00Z");
  t("⚠ and it changes across the October boundary, not at a version bump",
    minutesFromMidnight(beforeClocks, LONDON) === 17 * 60
      && minutesFromMidnight(afterClocks, LONDON) === 16 * 60,
    `${minutesFromMidnight(beforeClocks, LONDON)} → ${minutesFromMidnight(afterClocks, LONDON)}`);
}

// ============================================================================
console.log("\n=== 2. ⚠ no hardcoded hour difference anywhere in the path ===");
// ============================================================================
{
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  const PATHS = ["src/lib/calendar", "src/lib/schedule", "src/components/calendar", "src/lib/booking"];
  const files = PATHS.flatMap(walk).map((p) => ({ p, c: code(readFileSync(p, "utf8")) }));

  /**
   * ⚠ THE SHAPES A FIXED OFFSET ACTUALLY TAKES. Not the digit 3 — that appears
   * in array indices and tailwind classes and would make this guard useless
   * noise. These are the forms that convert between zones by arithmetic:
   * milliseconds for whole hours, an explicit minute count, or a UTC string
   * with the offset baked in.
   */
  const OFFSET_SHAPES: { re: RegExp; why: string }[] = [
    { re: /\b(10800000|14400000|7200000)\b/, why: "3h/4h/2h in milliseconds" },
    { re: /[+-]\s*(3|4)\s*\*\s*60\s*\*\s*60/, why: "hours arithmetic" },
    { re: /\b(?:offset|diff|delta|shift)\s*[:=]\s*[+-]?(?:120|180|240)\b/, why: "a minute count named as an offset" },
    { re: /["'`](?:UTC|GMT)\s*[+-]\s*[34]["'`]/, why: "a hardcoded UTC±N string" },
    { re: /getTimezoneOffset\(\)/, why: "the RUNNER's zone, which is not the viewer's" },
    { re: /\b\d+\s*hours?\s+(?:ahead|behind)\b/i, why: "a prose claim about a fixed difference" },
  ];
  const hits: string[] = [];
  for (const f of files) {
    for (const s of OFFSET_SHAPES) {
      if (s.re.test(f.c)) hits.push(`${f.p} — ${s.why}`);
    }
  }
  t("⚠ no fixed offset between zones in the calendar, schedule or booking layers",
    hits.length === 0, hits.join("\n      "));

  /** Every zone lookup goes through a named IANA identifier. */
  const tzModule = readFileSync("src/lib/schedule/timezone.ts", "utf8");
  t("the zone layer resolves through Intl, not arithmetic",
    /Intl\.DateTimeFormat/.test(tzModule) && /timeZone:\s*tz/.test(tzModule));
  const grid = readFileSync("src/lib/calendar/grid.ts", "utf8");
  t("§8 — the two zones are IANA identifiers, not labels with offsets",
    /tz:\s*"Asia\/Qatar"/.test(grid) && /tz:\s*"Europe\/London"/.test(grid));
}

// ============================================================================
console.log("\n=== 3. §3 — nothing computes a prayer time ===");
// ============================================================================
{
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(p) ? [p] : [];
    });
  const all = walk("src").map((p) => ({ p, c: code(readFileSync(p, "utf8")) }));
  /**
   * ⚠ A COMPUTED PRAYER TIME IS A CLAIM THE DATABASE CANNOT CHECK. It moves
   * every day, it depends on a calculation method people disagree about, and
   * on the days it is wrong it paints "unavailable" over a real bookable hour.
   * Blocks come from availability_blocks rows and from nowhere else.
   */
  /**
   * ⚠ NO TRAILING \b — AND THE FIRST VERSION HAD ONE, WHICH MADE IT USELESS.
   * `\bmaghrib\b` does not match `maghribFor`, because there is no word
   * boundary between "b" and "F". A sabotage run that added exactly that
   * function left this guard green. Prefix-anchored with a \w* tail now, so a
   * computed prayer time cannot hide behind a camelCase suffix.
   *
   * `asr` is deliberately absent from the loose list — it is three letters and
   * appears inside ordinary words; it is matched only as a standalone token.
   */
  const computed = all.filter((f) =>
    /\b(maghrib|isha|fajr|dhuhr|adhan|qibla|solarPosition|sunAngle|julianDay)\w*/i.test(f.c)
      || /\basr\b/i.test(f.c))
    .map((f) => f.p);
  t("⚠ no prayer-time calculation in src/", computed.length === 0, computed.join(", "));
  const pkg = readFileSync("package.json", "utf8");
  t("⚠ and no prayer-times dependency", !/prayer|adhan|praytime|salah/i.test(pkg));

  const readers = code(readFileSync("src/lib/calendar/readers.ts", "utf8"));
  t("blocks are read from availability_blocks rows",
    /from\("availability_blocks"\)/.test(readers) && /type: "blocked"/.test(readers));
  /**
   * ⚠ AND `reason` IS NOT SELECTED FOR A PUBLIC VIEWER. 0045 grants anon
   * SELECT on (id, teacher_id, starts_at, ends_at) only; reading the reason
   * with the service role and printing it would route around a column grant
   * that exists to keep a teacher's business private.
   */
  t("⚠ §22 — a public block carries no reason", /withReason: false/.test(readers));
}

// ============================================================================
console.log("\n=== 4. §6 — lanes are derived from columns, never from the title ===");
// ============================================================================
{
  t("Year 10 → the lightest Chemistry tone",
    laneKindFor({ type: "group", yearGroup: "Year 10", qualification: "igcse" } as never) === "group_y10");
  t("Year 11 → the middle tone",
    laneKindFor({ type: "group", yearGroup: "Year 11", qualification: "igcse" } as never) === "group_y11");
  t("IAL AS → the deepest tone",
    laneKindFor({ type: "group", yearGroup: null, qualification: "ial-as" } as never) === "group_as");
  t("private open and booked are their own lanes",
    laneKindFor({ type: "private_open", yearGroup: null, qualification: null } as never) === "private_open"
      && laneKindFor({ type: "private_booked", yearGroup: null, qualification: null } as never) === "private_booked");
  t("a block is its own lane",
    laneKindFor({ type: "blocked", yearGroup: null, qualification: null } as never) === "blocked");
  /**
   * ⚠ AN UNIDENTIFIED COHORT IS NOT FORCED INTO A YEAR. It gets a real, neutral
   * lane. Guessing would put a Biology class in the Year 10 Chemistry colour
   * and look entirely deliberate.
   */
  t("⚠ a cohort that identifies neither year nor qualification is 'other', not a guess",
    laneKindFor({ type: "group", yearGroup: null, qualification: null } as never) === "group_other");
  t("⚠ and the title is never consulted — §73",
    laneKindFor({ type: "group", yearGroup: null, qualification: null, title: "Year 10 Chemistry" } as never)
      === "group_other");
  t("§22 — only an available slot is actionable",
    isRequestable("private_open") && !isRequestable("private_booked")
      && !isRequestable("blocked") && !isRequestable("group_as"));
}

// ============================================================================
console.log("\n=== 5. §79 — an empty database is an empty grid ===");
// ============================================================================
{
  t("⚠ no events means no bounds, so a caller renders its empty state",
    gridBounds([], DOHA) === null);
  /**
   * ⚠ TODAY'S DATE, DELIBERATELY. This first asked for blocks on 2026-09-13 —
   * a day a fabricated `new Date()` placeholder could never land on, so a
   * sabotage that manufactured one for an empty week left the assertion green.
   * The whole week is checked now, and it includes today, which is where a
   * fabricated default would actually appear.
   */
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: DOHA }).format(new Date());
  const week = [todayISO, "2026-09-13", "2026-12-13"];
  t("⚠ and no blocks on ANY day — nothing is manufactured to fill an empty week",
    buildWeek([], week, DOHA, { startMin: 0, endMin: 1440 })
      .every((c) => c.blocks.length === 0));
  const one = [ev({ startsAt: new Date("2026-09-13T16:00:00Z"), endsAt: new Date("2026-09-13T18:30:00Z") })];
  const b = gridBounds(one, DOHA)!;
  /**
   * ⚠ THE AXIS IS READ OFF THE EVENTS, NOT WRITTEN IN. 19:00–21:30 padded to
   * whole hours is 19:00–22:00. A fixed 09:00–21:30 frame would be a claim
   * about when teaching happens, and a Saturday morning slot would render off
   * the top of its own grid.
   */
  t("§5 — bounds are derived and hour-aligned", b.startMin === 19 * 60 && b.endMin === 22 * 60,
    `${b.startMin}–${b.endMin}`);
  t("the same events in London give different bounds", (() => {
    const l = gridBounds(one, LONDON)!;
    return l.startMin === 17 * 60 && l.endMin === 20 * 60;
  })());
}

// ============================================================================
console.log("\n=== 6. §17 — a block spans its own duration ===");
// ============================================================================
{
  const bounds = { startMin: 18 * 60, endMin: 22 * 60 }; // a 4h axis
  const day = "2026-09-13";
  const sixty = ev({ key: "a", startsAt: new Date("2026-09-13T16:00:00Z"), endsAt: new Date("2026-09-13T17:00:00Z") });
  // 20:00–21:30 Doha — inside the axis. The first draft ran to 22:30, past the
  // 22:00 end, and the clamp trimmed it to 25% — the test caught its own
  // fixture, which is the clamp working rather than a positioning bug.
  const ninety = ev({ key: "b", startsAt: new Date("2026-09-13T17:00:00Z"), endsAt: new Date("2026-09-13T18:30:00Z") });
  const blocks = positionDay([sixty, ninety], day, DOHA, bounds);
  t("both events are placed", blocks.length === 2);
  /**
   * ⚠ THE PREVIOUS WEEK VIEW DREW THESE THE SAME SIZE. It rendered each event
   * in the cell for its starting hour and nowhere else, so duration was
   * invisible — the single defect this module exists to fix.
   */
  const h60 = blocks.find((x) => x.event.key === "a")!.heightPct;
  const h90 = blocks.find((x) => x.event.key === "b")!.heightPct;
  t("⚠ 60 minutes is a quarter of a four-hour axis", Math.abs(h60 - 25) < 0.01, h60);
  t("⚠ 90 minutes is half again as tall as 60", Math.abs(h90 / h60 - 1.5) < 0.01, `${h90} vs ${h60}`);
  t("a 19:00 start sits a quarter down a 18:00–22:00 axis",
    Math.abs(blocks.find((x) => x.event.key === "a")!.topPct - 25) < 0.01);

  // overlap → side-by-side lanes rather than one hidden behind the other
  const x = ev({ key: "x", startsAt: new Date("2026-09-13T16:00:00Z"), endsAt: new Date("2026-09-13T17:30:00Z") });
  const y = ev({ key: "y", startsAt: new Date("2026-09-13T16:30:00Z"), endsAt: new Date("2026-09-13T18:00:00Z") });
  const over = positionDay([x, y], day, DOHA, bounds);
  t("⚠ overlapping events take separate lanes, so neither is hidden",
    over.every((b) => b.laneCount === 2) && new Set(over.map((b) => b.lane)).size === 2,
    over.map((b) => `${b.event.key}:${b.lane}/${b.laneCount}`).join(" "));
  const apart = positionDay([sixty, ninety], day, DOHA, bounds);
  t("and non-overlapping events keep the full width",
    apart.every((b) => b.laneCount === 1));

  /**
   * ⚠ AN EVENT RUNNING PAST THE AXIS IS TRIMMED TO IT, NOT ALLOWED TO ESCAPE.
   * An absolutely-positioned block with height > remaining space would spill
   * out of the grid box and over whatever follows it on the page.
   */
  const overrun = ev({ key: "z", startsAt: new Date("2026-09-13T18:00:00Z"), endsAt: new Date("2026-09-13T20:00:00Z") });
  const trimmed = positionDay([overrun], day, DOHA, bounds)[0];
  t("⚠ a block that runs past the axis is clamped inside it",
    trimmed.topPct + trimmed.heightPct <= 100.001,
    `top=${trimmed.topPct} h=${trimmed.heightPct}`);
}

// ============================================================================
console.log("\n=== 7. the day a block belongs to is the viewer's day ===");
// ============================================================================
{
  /**
   * ⚠ 23:30 IN DOHA IS 20:30 IN LONDON — the same day. But 00:30 in Doha is
   * 21:30 the PREVIOUS day in London, and a grid that bucketed by UTC or by
   * Doha would put it in the wrong column for a London viewer.
   */
  const lateDoha = ev({ startsAt: new Date("2026-09-13T21:30:00Z"), endsAt: new Date("2026-09-13T22:30:00Z") });
  const bounds = { startMin: 0, endMin: 1440 };
  t("00:30 Doha on the 14th is still the 13th in London",
    positionDay([lateDoha], "2026-09-14", DOHA, bounds).length === 1
      && positionDay([lateDoha], "2026-09-13", LONDON, bounds).length === 1);
  t("and it is NOT double-counted into both days in one zone",
    positionDay([lateDoha], "2026-09-13", DOHA, bounds).length === 0);
}

// ============================================================================
console.log("\n=== 8. the axis labels come from the bounds ===");
// ============================================================================
{
  const rows = hourRows({ startMin: 19 * 60, endMin: 22 * 60 });
  t("one row per hour, inclusive of both ends", rows.length === 4, rows.join(","));
  t("labels read as clock times", labelForMinutes(19 * 60) === "7 PM"
    && labelForMinutes(21 * 60 + 30) === "9:30 PM" && labelForMinutes(12 * 60) === "12 PM");
  t("⚠ midnight is 12 AM, not 0 AM", labelForMinutes(0) === "12 AM");
}

// ============================================================================
console.log("\n=== 9. §4/§10 — every view is reachable from the switcher ===");
// ============================================================================
{
  const cal = code(readFileSync("src/components/calendar/Calendar.tsx", "utf8"));
  /**
   * ⚠ THE SWITCHER HELD ITS OWN COPY OF THE VIEW LIST, AND IT DRIFTED.
   * It read ["month","week","upcoming"] — a literal duplicate of the VIEWS
   * union — so adding the day view left it reachable only by typing ?view=day
   * into the address bar. The feature was built, shipped and invisible. This
   * refuses the shape, not just that one instance.
   */
  t("⚠ the view switcher reads VIEWS rather than a second list",
    /VIEWS\.map\(/.test(cal) && !/\["month",\s*"week"/.test(cal));
  t("§10 — the day view exists in the union",
    VIEWS.includes("day" as never) && VIEWS.length === 4, VIEWS.join(","));
  t("§4 — and week is what an empty URL opens on", DEFAULT_VIEW === "week");
  /**
   * ⚠ EVERY VIEW NEEDS A RANGE AND A STEP, or its arrows walk nowhere.
   * A view added to the union without an arm in rangeFor would fetch the
   * fallback window and look like it worked.
   */
  for (const v of VIEWS) {
    const r = rangeFor(v, "2026-09-13");
    t(`${v} — has a bounded range`, !!r.from && !!r.to && r.from <= r.to, `${r.from}..${r.to}`);
    t(`${v} — steps somewhere on next`, step(v, "2026-09-13", 1) !== "2026-09-13");
    t(`${v} — has a period label`, periodLabel(v, "2026-09-13").length > 0);
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
