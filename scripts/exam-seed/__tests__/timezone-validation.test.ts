/**
 * Timezone validation: abbreviations are refused, real zones are not.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/timezone-validation.test.ts
 *
 * ============================================================================
 * ⚠ THE DEFECT THIS GUARDS, MEASURED ON THIS PLATFORM
 * ============================================================================
 * Intl accepts a bare abbreviation and silently resolves it somewhere else:
 * BST is Asia/Dhaka, AST is America/Anchorage, EST is America/Panama. A 19:00
 * Doha lesson renders 22:00 for a British student who typed "BST", with
 * nothing erroring anywhere. Reported from the mobile build; the numbers below
 * are re-derived here rather than copied, so if ICU ever changes its mind the
 * suite says so instead of pinning a stale claim.
 */
import { readFileSync } from "node:fs";

import {
  canonicalTimeZone, isKnownTimeZone, currentTimeIn, tzError, CANONICAL_TZ,
} from "../../../src/lib/schedule/timezone.ts";
import { readRuleForm } from "../../../src/lib/admin/schedule-form.ts";
import { readAvailabilityForm } from "../../../src/lib/admin/availability-form.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

/** What Intl would silently do with a value — derived, never retyped. */
const intlWouldResolve = (tz: string): string | null => {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz }).resolvedOptions().timeZone; }
  catch { return null; }
};

const ABBREVIATIONS = ["BST", "AST", "EST", "CET", "PST", "IST", "GMT", "EDT", "CST"];

console.log("── ⚠ THE PLATFORM REALLY DOES REMAP THESE ──");
{
  // ⚠ IF THIS SECTION EVER GOES RED, ICU CHANGED AND THE GUARD BELOW MAY BE
  // GUARDING NOTHING. That is worth knowing loudly.
  const remapped = ABBREVIATIONS.filter((a) => {
    const r = intlWouldResolve(a);
    return r !== null && r !== a;
  });
  t(`Intl silently remaps at least six abbreviations (${remapped.length}/${ABBREVIATIONS.length})`,
    remapped.length >= 6, remapped.map((a) => `${a}->${intlWouldResolve(a)}`));
  t("⚠ BST — the one a British student would type — is not Britain",
    intlWouldResolve("BST") !== null && !String(intlWouldResolve("BST")).startsWith("Europe/"),
    intlWouldResolve("BST"));
  /**
   * ⚠ THE POINT IS THAT MOST DO NOT THROW, NOT THAT NONE DOES. Measured: EDT
   * IS rejected by ICU, so the old "does Intl accept it" test would have caught
   * that one and sailed past the other eight. A guard that catches one in nine
   * is the dangerous kind — it looks like validation.
   */
  const accepted = ABBREVIATIONS.filter((a) => intlWouldResolve(a) !== null);
  t(`most abbreviations do NOT throw — ${accepted.length} of ${ABBREVIATIONS.length} sail through Intl`,
    accepted.length >= 8, { accepted, rejectedByIcu: ABBREVIATIONS.filter((a) => intlWouldResolve(a) === null) });
}

console.log("\n── EVERY ABBREVIATION IS REFUSED ──");
{
  for (const a of ABBREVIATIONS) {
    t(`${a} refused (Intl would have said ${intlWouldResolve(a)})`, canonicalTimeZone(a) === null);
  }
  t("…and isKnownTimeZone agrees with canonicalTimeZone",
    ABBREVIATIONS.every((a) => !isKnownTimeZone(a)));
}

console.log("\n── ⚠ AND NO REAL ZONE IS REFUSED, WHICH IS THE HARDER HALF ──");
{
  // A shape-only check would be too loose; a resolves-to-itself check would be
  // too strict. These are the cases that separate the two.
  t("Asia/Qatar", canonicalTimeZone("Asia/Qatar") === "Asia/Qatar");
  t("Europe/London", canonicalTimeZone("Europe/London") === "Europe/London");
  t("UTC — the one legitimate slashless name", canonicalTimeZone("UTC") === "UTC");
  // ⚠ CASE IS CANONICALISED BY Intl, so a resolves-to-itself test would have
  // rejected a perfectly good lowercase entry.
  t("asia/qatar is corrected, not refused", canonicalTimeZone("asia/qatar") === "Asia/Qatar",
    canonicalTimeZone("asia/qatar"));
  t("utc is corrected too", canonicalTimeZone("utc") === "UTC", canonicalTimeZone("utc"));
  // ⚠ AND MODERN NAMES ARE ALIASED. Kolkata is the CURRENT correct IANA name
  // for India and Intl maps it to Calcutta — another false rejection avoided.
  t("Asia/Kolkata is accepted, not refused as a mismatch",
    canonicalTimeZone("Asia/Kolkata") !== null, canonicalTimeZone("Asia/Kolkata"));
  t("Etc/GMT+3 is a real zone and survives", canonicalTimeZone("Etc/GMT+3") === "Etc/GMT+3");
  /**
   * ⚠ A THREE-SEGMENT ZONE IS ACCEPTED, AND Intl SHORTENS IT. My first
   * assertion here expected identity and was wrong — the code was right.
   * Derived from Intl rather than retyped, so the suite tracks the platform
   * instead of pinning what I assumed it did.
   */
  t("America/Argentina/Buenos_Aires is accepted",
    canonicalTimeZone("America/Argentina/Buenos_Aires") !== null,
    canonicalTimeZone("America/Argentina/Buenos_Aires"));
  t("…and canonicalises to whatever Intl calls it",
    canonicalTimeZone("America/Argentina/Buenos_Aires")
      === intlWouldResolve("America/Argentina/Buenos_Aires"),
    canonicalTimeZone("America/Argentina/Buenos_Aires"));
  t("the canonical zone is stable under a second pass",
    canonicalTimeZone(canonicalTimeZone("asia/qatar")!) === "Asia/Qatar");
}

console.log("\n── JUNK ──");
{
  for (const junk of ["", "   ", "Nonsense/Nowhere", "///", "Asia/", "/Qatar", "12:00"]) {
    t(`refused: ${JSON.stringify(junk)}`, canonicalTimeZone(junk) === null);
  }
  t("null and undefined refused",
    canonicalTimeZone(null) === null && canonicalTimeZone(undefined) === null);
}

console.log("\n── ⚠ THE ADMIN FORMS, WHERE A WRONG ZONE SCHEDULES RATHER THAN DISPLAYS ──");
{
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  const RULE = {
    cohort_id: "c1", weekday: "2", start_time: "19:00", end_time: "21:30",
    valid_from: "2026-09-15",
  };
  const AVAIL = {
    teacher_id: "11111111-2222-3333-4444-555555555555",
    weekday: "2", start_time: "16:00", end_time: "19:00",
  };

  const ruleBad = readRuleForm(fd({ ...RULE, timezone: "BST" }));
  t("a timetable rule refuses BST", !ruleBad.ok, ruleBad.ok ? "ACCEPTED" : ruleBad.error);
  t("…and the message NAMES what it would have meant, because 'unknown' is a lie",
    !ruleBad.ok && ruleBad.error.includes(String(intlWouldResolve("BST"))), !ruleBad.ok ? ruleBad.error : "");
  const ruleOk = readRuleForm(fd({ ...RULE, timezone: "asia/qatar" }));
  t("…and a lowercase real zone is accepted AND canonicalised",
    ruleOk.ok && ruleOk.value.timezone === "Asia/Qatar", ruleOk.ok ? ruleOk.value.timezone : ruleOk.error);
  t("…and a blank falls back to the canonical zone",
    (() => { const r = readRuleForm(fd({ ...RULE, timezone: "" })); return r.ok && r.value.timezone === CANONICAL_TZ; })());

  const availBad = readAvailabilityForm(fd({ ...AVAIL, timezone: "AST" }));
  t("1-to-1 availability refuses AST", !availBad.ok, availBad.ok ? "ACCEPTED" : availBad.error);
  const availOk = readAvailabilityForm(fd({ ...AVAIL, timezone: "Europe/London" }));
  t("…and accepts Europe/London", availOk.ok, availOk.ok ? "" : availOk.error);
}

console.log("\n── ⚠ THE CLOCK BESIDE THE ZONE — THE PART A HUMAN CHECKS ──");
{
  const at = new Date("2026-09-15T16:00:00Z"); // 19:00 Doha
  t("currentTimeIn renders the zone's own clock",
    currentTimeIn("Asia/Qatar", at) === "7:00 PM", currentTimeIn("Asia/Qatar", at));
  // ⚠ THE TWO MUST DIFFER, or showing the clock proves nothing.
  t("…and a different zone reads differently",
    currentTimeIn("Europe/London", at) !== currentTimeIn("Asia/Qatar", at),
    `${currentTimeIn("Europe/London", at)} vs ${currentTimeIn("Asia/Qatar", at)}`);
  t("…and an abbreviation gets no clock at all, rather than a wrong one",
    currentTimeIn("BST", at) === null);

  t("tzError names the resolution for an abbreviation",
    tzError("BST").includes(String(intlWouldResolve("BST"))), tzError("BST"));
  t("…and suggests the Region/City form", /Region\/City/.test(tzError("BST")));
}

console.log("\n── ⚠ NOTHING STILL TRUSTS THE OLD 'DOES Intl ACCEPT IT' TEST ──");
{
  /**
   * ⚠ "THE FILE MENTIONS canonicalTimeZone" IS NOT AN ASSERTION. The first
   * version of this checked exactly that, and a sabotage which made viewer-tz
   * return the raw cookie again left it GREEN — the import line still mentioned
   * the function. It has to check that the VALUE goes through it.
   */
  const strip = (f: string) =>
    readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const checks: [file: string, mustMatch: RegExp, why: string][] = [
    ["src/lib/schedule/viewer-tz.ts", /return canonicalTimeZone\(raw\)/,
      "the cookie value is passed through it, not returned raw"],
    ["src/app/_actions/timezone.ts", /const canonical = canonicalTimeZone\(tz\)[\s\S]{0,200}TZ_COOKIE, canonical/,
      "the CANONICAL value is what gets written to the cookie"],
    ["src/lib/admin/schedule-form.ts", /canonicalTimeZone\(timezoneRaw\)/,
      "the rule's zone is canonicalised before it is stored"],
    ["src/lib/admin/availability-form.ts", /canonicalTimeZone\(timezoneRaw\)/,
      "the availability zone is canonicalised before it is stored"],
  ];
  for (const [f, re, why] of checks) {
    t(`${f.split("/").pop()} — ${why}`, re.test(strip(f)), strip(f).match(/canonicalTimeZone[^\n]*/)?.[0]);
  }
  // The old helper still exists for callers that only want a boolean, but it
  // must delegate rather than keep its own permissive body.
  const tzsrc = readFileSync("src/lib/schedule/timezone.ts", "utf8");
  t("isKnownTimeZone delegates to canonicalTimeZone",
    /isKnownTimeZone[\s\S]{0,160}canonicalTimeZone\(tz\) !== null/.test(tzsrc));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
