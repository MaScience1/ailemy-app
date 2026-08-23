/**
 * Who the student is, as three separate things (§9).
 *
 * ============================================================================
 * ⚠ ACCOUNT IDENTITY, STUDENT PROFILE AND PAYER IDENTITY ARE NOT ONE RECORD
 * ============================================================================
 * §9 asks for them kept apart, and the reason is §72: the payer may be a parent
 * and not the student, and "do not assume student = payer forever" is a thing
 * that has to be true in the TYPES or it stops being true the first time
 * somebody writes `profile.email` into a receipt.
 *
 *   AccountIdentity   auth.users — the login. Email lives here and NOWHERE else.
 *   StudentProfile    public.profiles — the person: name, where, what school.
 *   payer             public.billing_profiles (0060) — deliberately ABSENT from
 *                     this module. A student's own read model must not be able
 *                     to reach it; 0060 has no policy admitting them, and a
 *                     field here would invite one.
 *
 * ⚠ ONLY SHOW WHAT IS KNOWN (§8). Every field is nullable and every one is
 * genuinely unknown for a real account today. `displayName` falls back through
 * a stated ladder rather than inventing a name, and the last rung is null — a
 * page that renders "there" for a missing city is worse than one that renders
 * nothing.
 *
 * ⚠ NO RAW IDS (§8). `userId` is here because policies and readers need it;
 * nothing in this type is meant for display except the labelled fields, and the
 * UI helpers below are what a page should render.
 *
 * Pure below the reader: the shaping functions take rows and are testable with
 * no credentials.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canonicalTimeZone, currentTimeIn } from "@/lib/schedule/timezone";

// ============================================================================
// SHAPES
// ============================================================================

export type AccountIdentity = {
  userId: string;
  /** ⚠ The login address. It lives on auth.users, not on profiles. */
  email: string | null;
};

export type StudentProfile = {
  fullName: string | null;
  country: string | null;
  city: string | null;
  /**
   * ⚠ CANONICAL, OR NULL. A stored value that ICU would silently remap — "AST"
   * resolving to America/Anchorage — comes back as null rather than as a zone,
   * so a caller cannot render a wrong time confidently. feat/tz-validation.
   */
  timezone: string | null;
  /** The raw stored value, when it failed canonicalisation. For the fix-it prompt. */
  timezoneRaw: string | null;
  schoolName: string | null;
  language: string | null;
};

export type Identity = {
  account: AccountIdentity;
  profile: StudentProfile;
  /** Rows the reader refused, travelling with the result rather than logged away. */
  refusals: string[];
};

// ============================================================================
// SHAPING — pure
// ============================================================================

const text = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

export function profileFromRow(row: Record<string, unknown> | null): {
  profile: StudentProfile;
  refusals: string[];
} {
  const refusals: string[] = [];
  if (row === null) {
    return {
      profile: {
        fullName: null, country: null, city: null,
        timezone: null, timezoneRaw: null, schoolName: null, language: null,
      },
      refusals,
    };
  }
  const raw = text(row.timezone);
  const canonical = canonicalTimeZone(raw);
  if (raw !== null && canonical === null) {
    /**
     * ⚠ THIS IS A REAL STATE, NOT A DEFENSIVE BRANCH. profiles.timezone is bare
     * text with no CHECK (0057 is reserved for one), so a value that ICU would
     * remap can be sitting there right now. Reporting it lets the UI say "we
     * could not read your timezone" instead of rendering a lesson at the wrong
     * hour with total confidence.
     */
    refusals.push(`timezone ${JSON.stringify(raw)} is not a canonical IANA zone — times cannot be shown in it`);
  }
  return {
    profile: {
      fullName: text(row.full_name),
      country: text(row.country),
      city: text(row.city),
      timezone: canonical,
      timezoneRaw: canonical === null ? raw : null,
      schoolName: text(row.school_name),
      language: text(row.language),
    },
    refusals,
  };
}

/**
 * What to call them.
 *
 * ⚠ THE LADDER ENDS AT null, NOT AT A PLACEHOLDER. "Student", "User" and
 * "there" are all worse than showing nothing: they look like the system knows
 * who you are and got it wrong. A page with no name simply has no name on it.
 *
 * ⚠ AND THE EMAIL IS NOT A NAME. It is offered as a distinct, clearly-labelled
 * rung so a caller chooses deliberately — the profile header renders the name
 * when there is one and the address when there is not, and they look different.
 */
export function displayName(id: Identity): { value: string; kind: "name" | "email" } | null {
  if (id.profile.fullName) return { value: id.profile.fullName, kind: "name" };
  if (id.account.email) return { value: id.account.email, kind: "email" };
  return null;
}

/**
 * The monogram for an avatar bubble — "Muhammed Ali" → "MA".
 *
 * ⚠ FROM A NAME, AND NEVER FROM AN EMAIL. displayName() offers the address as a
 * separate, clearly-LABELLED rung precisely so a caller cannot mistake it for a
 * name. Slicing "MA" out of `ma.science@example.com` and drawing it in a circle
 * undoes that in one step: the circle then asserts a name the system does not
 * have, in the one place a user cannot see the source. No name, no monogram —
 * the caller draws a neutral silhouette instead, which is the same ruling as the
 * ladder ending at null.
 *
 * ⚠ SPREAD, NOT charAt. `[...word][0]` iterates by CODE POINT, so a name outside
 * the BMP yields a whole character rather than half a surrogate pair. A mangled
 * initial for a student's own name is a worse failure than no initial.
 *
 * ⚠ FIRST AND LAST, NOT FIRST TWO. "Abd al-Rahman Khan" is A K, not A A —
 * middle words are the ones a person is least identified by, and the last word
 * is what the second letter is expected to be.
 *
 * The result is capped at two code points because it is drawn in a fixed circle:
 * toLocaleUpperCase can lengthen a character (ß → SS) and a three-letter
 * monogram overflows the bubble.
 */
export function initialsFor(name: string | null): string | null {
  const t = text(name);
  if (t === null) return null;
  const heads = t
    .split(/[\s._-]+/)
    .filter((w) => w.length > 0)
    .map((w) => [...w][0]);
  if (heads.length === 0) return null;
  const picked = heads.length === 1 ? heads : [heads[0], heads[heads.length - 1]];
  return [...picked.join("").toLocaleUpperCase()].slice(0, 2).join("");
}

/**
 * "Doha · Asia/Qatar · 7:14 pm there now" — as much of it as is true.
 *
 * ⚠ THE CLOCK IS THE POINT. A zone NAME cannot be checked by reading it —
 * Asia/Qatar and America/Anchorage are equally plausible strings — but the time
 * in it can be, at a glance, by the one person who knows what time it is where
 * they are. This is the cross-client finding that started feat/tz-validation.
 */
export function placeLine(id: Identity, now = new Date()): string | null {
  const parts: string[] = [];
  if (id.profile.city) parts.push(id.profile.city);
  else if (id.profile.country) parts.push(id.profile.country);
  if (id.profile.timezone) {
    parts.push(id.profile.timezone);
    const t = currentTimeIn(id.profile.timezone, now);
    if (t) parts.push(`${t} there now`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ============================================================================
// READER
// ============================================================================

/**
 * ⚠ TWO SOURCES, AND THE EMAIL COMES FROM THE SESSION. profiles has no email
 * column — the address is on auth.users, outside the schema PostgREST serves —
 * so it arrives through getUser() and not through a join. That is also why
 * erase_user's sweep has never had a profiles row to scrub.
 */
export async function loadIdentity(): Promise<Identity | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  /**
   * ⚠ maybeSingle, NOT single. A missing profiles row is a real state — the
   * signup trigger can lag, and 0001's handle_new_user fires AFTER INSERT — and
   * single() would throw where the honest answer is "we know your login and
   * nothing else yet". The refusal travels; the page still renders.
   */
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, country, city, timezone, school_name, language")
    .eq("id", user.id)
    .maybeSingle();

  const shaped = profileFromRow((data as Record<string, unknown>) ?? null);
  const refusals = [...shaped.refusals];
  if (error) {
    refusals.push(`profile could not be read (${error.code ?? "?"}) — showing account details only`);
  } else if (data === null) {
    refusals.push("no profile row yet — only the account is known");
  }

  return {
    account: { userId: user.id, email: user.email ?? null },
    profile: shaped.profile,
    refusals,
  };
}
