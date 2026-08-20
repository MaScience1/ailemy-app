import { redirect } from "next/navigation";

/**
 * /my-tuition → /profile.
 *
 * ============================================================================
 * ⚠ ONE STUDENT SURFACE, NOT TWO. FOUNDER RULING, 2026-08-20.
 * ============================================================================
 * This route was §35 written before 0045–0047 existed: group lessons, private
 * lessons, a credit ledger and past lessons, each with an honest empty state
 * for tables that had not been created yet. /profile supersedes it entirely —
 * same data, plus the shared calendar in personal mode, the cancellation
 * controls and Schedule updates — and the credit ledger has been ported across
 * so nothing this page showed is lost.
 *
 * ⚠ A REDIRECT, NOT A DELETION. The path may sit in a browser history, a
 * bookmark or an email sent while it was live. Deleting it would answer those
 * with a 404; this answers them with the page they were looking for.
 *
 * ⚠ 307, NOT 308 — AND THAT IS A CHOICE, NOT AN OVERSIGHT. redirect() answers
 * 307; permanentRedirect() answers 308. A 308 is cached by browsers
 * indefinitely, so if this ruling were ever revisited, everyone who had visited
 * once would keep being bounced with no way to reach the page short of clearing
 * their cache. A 307 costs nothing here — the traffic is tiny and the route is
 * internal — and it stays reversible.
 *
 * (The first version of this comment claimed 308. It was wrong, and a comment
 * asserting a status code the code does not return is worse than none.)
 */
export default function MyTuitionRedirect(): never {
  redirect("/profile");
}
