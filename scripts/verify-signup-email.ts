/**
 * Did a real signup email actually ARRIVE?
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-signup-email.ts <inbox@you-control.tld>
 *
 * ============================================================================
 * ⚠ A SEND IS NOT A DELIVERY, AND THIS SCRIPT EXISTS TO REFUSE THAT SWAP
 * ============================================================================
 * Supabase records `confirmation_sent_at` the moment GoTrue hands the message
 * to SMTP. That timestamp is written whether or not the mail was accepted,
 * whether or not SPF/DKIM aligned, and whether or not it was silently
 * quarantined at the far end. Every one of those failures looks identical from
 * inside the application: a row with a timestamp on it and no email anywhere.
 *
 * So this asks the RECEIVING side. Resend's API reports a per-message status,
 * and only `delivered` means a mail server accepted it. `sent` means Resend
 * accepted it from us, which is the same claim `confirmation_sent_at` already
 * makes and is not evidence of anything downstream.
 *
 * ⚠ EVEN `delivered` IS NOT A SCREENSHOT OF AN INBOX. It proves the receiving
 * server accepted the message; it does NOT prove the message reached the inbox
 * rather than the spam folder. DMARC quarantine happens after acceptance. The
 * human check — open the mailbox, look at it — is still required, and this
 * script prints that instruction rather than implying it has done it.
 *
 * ============================================================================
 * WHAT IT TOUCHES
 * ============================================================================
 * Creates ONE auth user, by signup, so a real confirmation email is generated
 * through the real path. Deletes it by the id it captured. It writes nothing
 * else and reads no student data.
 */
import { readFile } from "node:fs/promises";

const SKIP = 2;

async function loadEnv(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[t.slice(0, i).trim()] = v;
    }
  } catch {
    /* absent .env.local is fine when the variables are exported */
  }
  return env;
}

const inbox = process.argv[2];
if (!inbox || !inbox.includes("@")) {
  console.error("usage: verify-signup-email.ts <inbox@you-control.tld>");
  console.error("Use a real mailbox you can open. The point is to look at what arrives.");
  process.exit(1);
}

const env = await loadEnv();
const read = (k: string) => process.env[k]?.trim() || env[k];
const url = read("NEXT_PUBLIC_SUPABASE_URL");
const anon = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = read("SUPABASE_SERVICE_ROLE_KEY");
const resendKey = read("RESEND_API_KEY");

if (!url || !anon || !service) {
  console.log("SKIPPED — needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(SKIP);
}

// ⚠ THE SKIP IS DELIBERATE AND IS NOT A PASS. Without a Resend key this can
// only reach the send side, which is the exact claim this script refuses to
// treat as evidence. Better to report that it cannot answer the question than
// to answer a weaker one and let the difference go unnoticed.
if (!resendKey) {
  console.log(
    "SKIPPED — RESEND_API_KEY is not set, so delivery cannot be confirmed.\n" +
      "  Without it this script could only report that Supabase attempted a send,\n" +
      "  which is what it exists to stop anyone accepting as proof.",
  );
  process.exit(SKIP);
}

const svc = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
/**
 * ⚠ NEVER process.exit() INSIDE THE try BELOW — IT SKIPS THE finally.
 *
 * Every failure path called process.exit() directly, and process.exit()
 * terminates immediately: the cleanup in the finally block never ran. Each one
 * therefore LEAKED the test user it had just created into auth.users — on the
 * very script whose contract is to create one and delete it by the id it
 * captured. The happy path cleaned up; every unhappy path did not, and the
 * unhappy paths are the ones this script exists to reach.
 *
 * Throwing lets finally run. process.exitCode is set on the way out, which
 * records the outcome without terminating early.
 */
class Bail {
  // ⚠ A PLAIN FIELD, NOT `constructor(readonly code: number)`. A parameter
  // property is one of the few TypeScript constructs that EMITS code rather
  // than being erased, so node's type-stripping rejects it outright with
  // ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX — at run time, after tsc has already
  // passed. Typecheck-clean and unrunnable is the worst pair in this repo.
  readonly code: number;
  constructor(code: number) {
    this.code = code;
  }
}
const bail = (code: number): never => {
  throw new Bail(code);
};

let userId: string | null = null;

try {
  // ── 1. a real signup, through the real endpoint ──────────────────────────
  const started = Date.now();
  const signup = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: inbox, password: `Verify-${crypto.randomUUID()}!` }),
  });
  const body = await signup.json();
  if (!signup.ok) {
    console.error(`✗ signup failed: HTTP ${signup.status} ${JSON.stringify(body)}`);
    bail(1);
  }
  userId = body?.user?.id ?? body?.id ?? null;
  console.log(`  signup accepted, user id=${userId ?? "(not returned)"}`);

  // ── 2. the SEND side — necessary, and nowhere near sufficient ────────────
  const users = await (await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc })).json();
  const row = (users.users ?? []).find((u: { email?: string }) => u.email?.toLowerCase() === inbox.toLowerCase());
  if (!userId && row?.id) userId = row.id;
  console.log(`  supabase confirmation_sent_at = ${row?.confirmation_sent_at ?? "NULL"}`);
  if (!row?.confirmation_sent_at) {
    console.error("✗ Supabase never even attempted a send. SMTP is not configured, or the template is off.");
    bail(1);
  }

  // ── 3. the RECEIVING side — the only half that answers the question ──────
  // Resend needs a moment to register the message; poll rather than guess.
  let status: string | null = null;
  let subject: string | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch("https://api.resend.com/emails?limit=25", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    // ⚠ A SEND-ONLY KEY CANNOT ANSWER THIS, AND THAT IS NOT A DELIVERY FAILURE.
    //
    // The right key for the application to hold is restricted to sending —
    // least privilege, and all Supabase's SMTP settings need. Reading /emails
    // needs a broader scope. Treating that 401 as "not delivered" would report
    // a PERMISSIONS fact as a MAIL fact and send someone to debug DNS over an
    // API scope.
    //
    // So it takes the inconclusive channel and says exactly what is and is not
    // established. It does not print a tick.
    if (res.status === 401) {
      const why = (await res.text()).slice(0, 140);
      console.log(
        `\n⚠ CANNOT CONFIRM DELIVERY FROM HERE — this Resend key is send-only.\n` +
          `  ${why}\n\n` +
          `  ESTABLISHED:     Supabase accepted the signup and stamped\n` +
          `                   confirmation_sent_at, so GoTrue handed the message\n` +
          `                   to SMTP without an error. A misconfigured SMTP\n` +
          `                   fails that step with a 500, so this is real\n` +
          `                   evidence — just not evidence of ARRIVAL.\n` +
          `  NOT ESTABLISHED: that any mail server accepted it, and so nothing\n` +
          `                   whatsoever about the inbox.\n\n` +
          `  Open ${inbox} and look — that was always the real proof — or re-run\n` +
          `  with a Resend key that has emails:read.`,
      );
      bail(SKIP);
    }

    if (!res.ok) {
      console.error(`✗ Resend API said HTTP ${res.status}. Cannot confirm delivery.`);
      bail(1);
    }
    const list = await res.json();
    const mine = (list?.data ?? []).find(
      (m: { to?: string[]; created_at?: string }) =>
        (m.to ?? []).some((t) => t.toLowerCase() === inbox.toLowerCase()) &&
        new Date(m.created_at ?? 0).getTime() >= started - 60_000,
    );
    if (mine) {
      status = mine.last_event ?? mine.status ?? null;
      subject = mine.subject ?? null;
      if (status === "delivered" || status === "bounced" || status === "complained") break;
    }
  }

  console.log(`  resend status = ${status ?? "(no matching message found)"}`);
  if (subject) console.log(`  subject       = ${JSON.stringify(subject)}`);

  if (status !== "delivered") {
    console.error(
      `\n✗ NOT CONFIRMED. Resend reports "${status ?? "nothing"}", not "delivered".\n` +
        `  'sent' means Resend accepted it from us — the same claim confirmation_sent_at\n` +
        `  already makes. Only 'delivered' means a mail server accepted it.`,
    );
    bail(1);
  }

  console.log(
    `\n✓ DELIVERED — a receiving mail server accepted the signup email for ${inbox}.\n` +
      `\n  ⚠ THIS IS NOT YET THE ANSWER YOU ASKED FOR. Acceptance is not inbox\n` +
      `  placement: DMARC quarantine happens AFTER a server accepts a message.\n` +
      `  Open ${inbox}, check the INBOX and then the spam folder, and screenshot\n` +
      `  what actually arrived. If it is in spam, the DNS is the problem, not SMTP.`,
  );
} catch (e) {
  // ⚠ CAUGHT SO THE finally BELOW STILL RUNS. process.exitCode does not
  // terminate — it sets the code the process leaves with once it unwinds — so
  // the test user is deleted and the caller still sees a non-zero exit.
  if (e instanceof Bail) process.exitCode = e.code;
  else throw e;
} finally {
  // ⚠ BY THE ID CAPTURED AT CREATION. Never a sweep over auth.users.
  if (userId) {
    const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc });
    console.log(`\n  cleaned up test user by id=${userId}: HTTP ${del.status}`);
  } else {
    console.error(
      "\n  ⚠ NO USER ID CAPTURED — nothing was deleted. Check auth.users for the test\n" +
        `  address ${inbox} and remove it by id.`,
    );
  }
}
