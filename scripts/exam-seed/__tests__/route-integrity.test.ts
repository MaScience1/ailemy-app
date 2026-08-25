/**
 * Every internal link points at a route that exists.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/route-integrity.test.ts
 *
 * ============================================================================
 * ⚠ WRITTEN BECAUSE TWO LINKS POINTED AT A ROUTE THAT HAS NEVER EXISTED
 * ============================================================================
 * /tuition/one-to-one/book was linked from the 1-to-1 page and from the
 * calendar's day panel. Neither ever 404'd, because both were gated on Stripe
 * having keys and Stripe has none — so the defect was invisible and would have
 * surfaced on the first day money could move, to the first paying customer, as
 * a Not Found.
 *
 * A dead link that is currently unreachable is still a dead link. Nothing in
 * typecheck, lint or the build catches it: `href` is a string, and Next builds
 * a link to nowhere perfectly happily.
 *
 * ⚠ THIS IS A STRUCTURAL GUARD, NOT A SPOT FIX. It resolves every literal
 * internal href in src/ against the real app-router tree, so the link cannot
 * come back without its destination — including by somebody flipping
 * CHECKOUT_BUILT to true and forgetting the page.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";

/** Every route the router will actually serve, as a segment pattern. */
function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Private folders (_forms) are not routes. Route groups ( site ) do not
    // consume a URL segment — treating them as one is how a real route gets
    // reported missing.
    if (entry.startsWith("_")) continue;
    const next = entry.startsWith("(") && entry.endsWith(")") ? prefix : [...prefix, entry];
    if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
    out.push(...routes(full, next));
  }
  return out;
}

const ROUTES = routes(APP);
t(`the router tree parsed — ${ROUTES.length} routes found`, ROUTES.length > 30, ROUTES.length);

/**
 * ⚠ A CATCH-ALL CANNOT SATISFY A LINK, AND EXCLUDING IT IS THE ONLY REASON
 * THIS FILE CAN EVER FAIL.
 * ============================================================================
 * (site)/[...slug] sits at the ROOT, so it matches every path that nothing
 * more specific claims. The first version of this test let it match, which
 * made every href resolve and the whole check vacuous — it passed while the
 * dead link it was written for sat three lines away in the source.
 *
 * And the catch-all is not a destination anyway: it looks the slug up in the
 * `pages` table and calls notFound() when there is none. Verified live —
 * /tuition/one-to-one/book returns 404 while /tuition/one-to-one returns 200.
 * "The catch-all will handle it" means "the user gets a Not Found".
 *
 * A link to a genuinely CMS-backed page belongs in CMS_PAGES below, named, so
 * that adding one is deliberate.
 */
const CATCH_ALL = (pattern: string[]) => pattern.some((p) => p.startsWith("[..."));

/** Does one URL path match one route pattern? Dynamic segments match anything. */
function matches(path: string[], pattern: string[]): boolean {
  if (CATCH_ALL(pattern)) return false;
  if (path.length !== pattern.length) return false;
  return pattern.every((seg, i) => seg.startsWith("[") || seg === path[i]);
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * ⚠ ROUTES KNOWN TO EXIST OUTSIDE a page file — API handlers and auth
 * callbacks. Listed rather than pattern-matched, so adding one is a deliberate
 * act and a typo here cannot silently excuse a real dead link.
 */
const NON_PAGE_ROUTES = new Set([
  "/api", "/auth", "/_next", "/login", "/signup",
]);

/**
 * Paths with no page file that are genuinely served, by row, from the `pages`
 * table through the (site) catch-all. Each one is a claim that a row exists;
 * an entry here that has no row is a dead link this test will not catch, so
 * keep it short and keep it true.
 */
const CMS_PAGES = new Set<string>([]);

const dead: string[] = [];
let checked = 0;

for (const file of files("src")) {
  const src = readFileSync(file, "utf8");
  // href="/..."  and  href={`/...`}  — the two shapes this codebase uses.
  for (const m of src.matchAll(/href=(?:"(\/[^"]*)"|\{`(\/[^`]*)`\})/g)) {
    const raw = (m[1] ?? m[2] ?? "").trim();
    if (!raw.startsWith("/")) continue;

    /**
     * ⚠ THE QUERY STRING IS STRIPPED BEFORE ANYTHING ELSE, AND THE FIRST
     * VERSION OF THIS DID NOT. It decided "is the last segment interpolated?"
     * from the raw string, so `/a/b/book?slot=${x}` looked like a dynamic
     * trailing segment, `book` was dropped, `/a/b` resolved, and the check
     * passed. On the exact link this file was written to catch.
     *
     * An interpolation inside a QUERY says nothing about the PATH. Only a
     * `${` that appears before the `?` can make a path segment dynamic.
     */
    const pathPart = raw.split("?")[0].split("#")[0];
    if (pathPart === "/" || pathPart === "") continue;

    const staticPath = pathPart.split("${")[0];
    const segs = staticPath.split("/").filter(Boolean);
    if (!segs.length) continue;

    // A trailing segment is dynamic only when the interpolation is IN the path
    // and does not begin at a slash boundary — `/a/${id}` vs `/a/b${x}`.
    const pathInterpolated = pathPart.includes("${");
    const probe = pathInterpolated && !staticPath.endsWith("/") ? segs.slice(0, -1) : segs;
    if (!probe.length) continue;
    checked++;

    if (NON_PAGE_ROUTES.has("/" + probe[0])) continue;
    if (CMS_PAGES.has("/" + probe.join("/"))) continue;
    // Exact route, or a prefix of a deeper route (the interpolation supplies
    // the rest).
    const ok = ROUTES.some((r) => matches(probe, r))
      // …or a PREFIX of a deeper real route, where the interpolation supplies
      // the rest. Catch-alls are excluded here too, for the same reason.
      || ROUTES.some((r) => !CATCH_ALL(r) && r.length > probe.length
        && probe.every((seg, i) => r[i].startsWith("[") || r[i] === seg));
    if (!ok) dead.push(`${relative(".", file)}  →  ${raw}`);
  }
}

t(`internal links checked — ${checked}`, checked > 40, checked);
t("⚠ EVERY internal link resolves to a real route",
  dead.length === 0, dead.length ? "\n      " + dead.join("\n      ") : "");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
