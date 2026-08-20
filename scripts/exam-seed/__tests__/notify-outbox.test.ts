/**
 * The notification outbox's decisions (§47, §50) — 0053.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/notify-outbox.test.ts
 *
 * ⚠ NO CREDENTIALS, NO NETWORK. Only the pure key builder is imported; notify()
 * itself is `server-only` and talks to the database, so what is asserted here
 * is the part that decides, and the SOURCE properties that no return value
 * could prove.
 */
import { readFileSync } from "node:fs";

import { eventKey } from "../../../src/lib/booking/notify-keys.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const B = "eb0b28b9-e081-408f-8f8d-70d1acaf3c64";

console.log("── THE KEY IS BUILT FROM THE FACT, NOT THE MOMENT ──");
{
  t("the same fact yields the same key, twice",
    eventKey("booking_confirmed", B) === eventKey("booking_confirmed", B));
  // ⚠ THE ASSERTION THAT MATTERS. A key containing now() is unique every time,
  // which is identical to having no key — and 0053's unique index would never
  // fire. Called twice with a gap; if the builder ever reaches for a clock this
  // goes red.
  const a = eventKey("booking_confirmed", B);
  const busy = Array.from({ length: 200_000 }, (_, i) => i).reduce((x, y) => x + y, 0);
  const b = eventKey("booking_confirmed", B);
  t("…and is stable across time — no clock in the builder", a === b, { a, b, busy: busy > 0 });

  t("different facts do not collide",
    eventKey("booking_confirmed", B) !== eventKey("booking_cancelled", B));
  t("different subjects do not collide",
    eventKey("booking_confirmed", B) !== eventKey("booking_confirmed", B.replace("eb0b", "0000")));
  t("the shape is kind:subject", eventKey("booking_confirmed", B) === `booking_confirmed:${B}`);
  t("an extra discriminator is appended, for facts that recur per change",
    eventKey("session_moved", B, "2026-09-19T17:00Z") === `session_moved:${B}:2026-09-19T17:00Z`);
  t("…and changes the key, so a lesson moved twice is two facts",
    eventKey("session_moved", B, "a") !== eventKey("session_moved", B, "b"));
}

console.log("\n── ⚠ SOURCE PROPERTIES NO RETURN VALUE CAN PROVE ──");
{
  const src = readFileSync("src/lib/booking/notify.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // in_app is the delivery. Leaving it 'pending' queues it for a send that is
  // not a thing that happens.
  t("in_app deliveries are written as 'sent', not 'pending'",
    /channel === "in_app" \? "sent" : "pending"/.test(code), code.match(/status: [^,]+/)?.[0]);
  t("…and carry sent_at, or 0053's sent_needs_time CHECK would refuse them",
    /channel === "in_app" \? now : null/.test(code));

  // A duplicate key is a retry, not a fault.
  t("a 23505 on the event is treated as SUCCESS, not an error",
    /23505/.test(code) && /duplicate: true/.test(code));

  // push must not be queued while no sender exists.
  t("the default channels are email + in_app — push is not queued yet",
    /args\.channels \?\? \["email", "in_app"\]/.test(code));

  // The quiet wrapper must not be able to fail a caller.
  const quiet = code.slice(code.indexOf("export async function notifyQuietly"));
  t("notifyQuietly returns void — it cannot report failure into a booking",
    /Promise<void>/.test(quiet));
  t("…and swallows a throw rather than propagating it",
    /catch \(e\)/.test(quiet));
}

console.log("\n── ⚠ THE FAMILY'S OWN WORDS ARE NOT COPIED INTO A PAYLOAD ──");
{
  /**
   * cancellation_requests.reason is free text a family wrote about why they
   * cannot attend. It lives on the request row, which 0055 deletes on erasure.
   * A second copy inside a notification payload is a second place erasure has
   * to find — and 0055's sweep only looks at EMAIL columns, so it would never
   * find it.
   */
  const actions = readFileSync("src/lib/booking/actions.ts", "utf8");
  const block = actions.slice(
    actions.indexOf('kind: "cancellation_requested"'),
    actions.indexOf('kind: "cancellation_requested"') + 700,
  );
  t("the cancellation_requested payload was located", block.length > 100, block.length);
  t("⚠ `reason` is NOT put in the notification payload",
    block.length > 100 && !/payload:[\s\S]*?\breason\b/.test(block),
    block.match(/payload:[^}]*}/)?.[0]);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
