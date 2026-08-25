/**
 * Every route renders on a REAL production server.
 *
 * ============================================================================
 * ⚠ THIS EXISTS BECAUSE `next build` EXITING 0 PUT A 500 ON PRODUCTION.
 * ============================================================================
 * On 2026-08-25 the tuition merge went live with a green gate: typecheck clean
 * on both configs, 66 suites passing, build exit 0. Six routes — /calendar,
 * /resources, /past-papers, /exam-builder and two calendar views — returned 500
 * to real visitors. Nothing in the gate could have caught it, because
 * COMPILING and RENDERING are different questions and the gate only asked the
 * first one.
 *
 * The defect: SiteNav is a client component calling useTranslations, and the
 * NextIntlClientProvider lived under app/[locale]/. Routes outside that segment
 * rendered the hook with no provider above it and threw. Under `next dev` it
 * did not reproduce at all.
 *
 * So this suite builds, boots `next start`, and asks every route the only
 * question that matters: does it return 200. It is slow — a minute or two — and
 * that is the correct price for the one check that would have caught a live
 * outage.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/**
 * ⚠ THE ELEVEN THE FOUNDER CHECKS AFTER EVERY DEPLOY. Kept in one place so the
 * gate and the post-deploy check ask the same question of the same list.
 */
export const PROD_ROUTES = [
  "/",
  "/calendar",
  "/calendar?view=week",
  "/calendar?view=upcoming",
  "/tuition",
  "/tuition?mode=one-to-one",
  "/tuition/one-to-one",
  "/tuition/ial-chemistry-as-sep-2026/roadmap",
  "/resources",
  "/past-papers",
  "/exam-builder",
] as const;

/**
 * ⚠ A FREE PORT, NOT A FIXED ONE — AND THIS BIT ONCE ALREADY.
 * On a fixed 3131 a leftover `next start` from an earlier run held the port,
 * the server failed to bind, and the whole suite went red against code that
 * was perfectly fine. A gate that fails for reasons unrelated to the code is
 * a gate people learn to re-run rather than read.
 */
async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error("no port"))));
    });
  });
}

/** Newest mtime under a directory — used to decide whether .next is stale. */
function newestMtime(dir: string, depth = 0): number {
  if (depth > 4 || !existsSync(dir)) return 0;
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    const m = e.isDirectory() ? newestMtime(p, depth + 1) : statSync(p).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}

async function main() {
  const PORT = await freePort();
  const BASE = `http://127.0.0.1:${PORT}`;
  // ── build, unless a build newer than the sources already exists ───────────
  /**
   * ⚠ A STALE BUILD IS WORSE THAN NO BUILD. It would test yesterday's code and
   * report today's as green, so the freshness comparison is against src/ and
   * messages/ rather than a flag somebody can forget to pass.
   */
  const buildStamp = existsSync(".next/BUILD_ID") ? statSync(".next/BUILD_ID").mtimeMs : 0;
  const srcStamp = Math.max(newestMtime("src"), newestMtime("messages"));
  if (buildStamp === 0 || srcStamp > buildStamp) {
    console.log("  … building (no build, or sources newer than the last one)");
    const b = spawnSync("npm", ["run", "build"], { encoding: "utf8", timeout: 600_000 });
    if (b.status !== 0) {
      t("production build succeeds", false, (b.stderr || b.stdout || "").slice(-800));
      return;
    }
  }
  t("a production build exists", existsSync(".next/BUILD_ID"));

  // ── boot next start ───────────────────────────────────────────────────────
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let serverLog = "";
  server.stdout?.on("data", (d) => { serverLog += String(d); });
  server.stderr?.on("data", (d) => { serverLog += String(d); });

  const stop = () => { try { process.kill(-server.pid!, "SIGKILL"); } catch { /* already gone */ } };

  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(BASE + "/", { signal: AbortSignal.timeout(2000) });
        up = true; break;
      } catch { await new Promise((r) => setTimeout(r, 1000)); }
    }
    t("the production server boots", up, serverLog.slice(-600));
    if (!up) return;

    /**
     * ⚠ EVERY ROUTE, NOT A SAMPLE. The outage hit four routes at once; a
     * spot-check of two would have reported green.
     */
    for (const route of PROD_ROUTES) {
      let status = 0;
      let body = "";
      try {
        const res = await fetch(BASE + route, {
          signal: AbortSignal.timeout(30_000),
          headers: { "user-agent": "ailemy-gate" },
        });
        status = res.status;
        body = status !== 200 ? (await res.text()).slice(0, 200) : "";
      } catch (err) {
        status = 0;
        body = err instanceof Error ? err.message : "fetch failed";
      }
      t(`${route} → 200`, status === 200, status === 200 ? undefined : `HTTP ${status} ${body}`);
    }

    /**
     * ⚠ AND THE ARABIC ROUTES, because the same provider defect would have
     * taken them out in the opposite direction.
     */
    for (const route of ["/ar", "/ar/tuition"]) {
      let ok = false, detail = "";
      try {
        const res = await fetch(BASE + route, { signal: AbortSignal.timeout(30_000) });
        const html = await res.text();
        ok = res.status === 200 && /lang="ar"/.test(html) && /dir="rtl"/.test(html);
        detail = `HTTP ${res.status}`;
      } catch (err) {
        detail = err instanceof Error ? err.message : "fetch failed";
      }
      t(`${route} → 200, lang=ar dir=rtl`, ok, ok ? undefined : detail);
    }
  } finally {
    stop();
  }
}

await main();

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
