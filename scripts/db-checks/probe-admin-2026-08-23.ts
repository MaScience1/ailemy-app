/**
 * Probe admin for the fix/family-status-visibility UI verification — the
 * SR-A (k) pattern: created here with a captured id, removed by THAT id.
 *
 *   create           → makes probe-fsv-<ts>@example.test + admin role, prints
 *                      the credentials for the browser sign-in
 *   cleanup <uuid>   → removes the role row and the auth user BY EXPLICIT ID
 *                      (no default target — the 2026-08-22 incident rule).
 *                      Refuses any uuid whose email is not @example.test.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [mode, target] = process.argv.slice(2);

if (mode === "create") {
  const stamp = Date.now();
  const email = `probe-fsv-${stamp}@example.test`;
  const password = `Pr0be!fsv-${stamp}`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) { console.error("createUser failed:", error?.message); process.exit(1); }
  const { error: roleErr } = await svc.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
  if (roleErr) {
    console.error("role grant failed:", roleErr.message, "— deleting the probe user again");
    await svc.auth.admin.deleteUser(data.user.id);
    process.exit(1);
  }
  console.log(`id: ${data.user.id}`);
  console.log(`email: ${email}`);
  console.log(`password: ${password}`);
} else if (mode === "cleanup") {
  if (!/^[0-9a-f-]{36}$/.test(target ?? "")) {
    console.error("cleanup requires the explicit probe uuid — no default target, ever");
    process.exit(1);
  }
  const { data: u } = await svc.auth.admin.getUserById(target);
  if (!u?.user) { console.error("no such user — nothing to clean"); process.exit(1); }
  if (!u.user.email?.endsWith("@example.test")) {
    console.error(`REFUSED: ${u.user.email} is not a probe address`);
    process.exit(1);
  }
  const { error: rErr } = await svc.from("user_roles").delete().eq("user_id", target);
  const { error: dErr } = await svc.auth.admin.deleteUser(target);
  console.log(`role rows: ${rErr ? "⚠ " + rErr.message : "deleted"} · auth user: ${dErr ? "⚠ " + dErr.message : "deleted"}`);
} else {
  console.error("usage: create | cleanup <uuid>");
  process.exit(1);
}
