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

    /**
     * ==========================================================================
     * ⚠ THE "CONTINUE COURSE" DEEP LINK MUST LAND ON REAL LESSON CONTENT.
     * ==========================================================================
     * continueHref resolves to a published lesson when one exists. The whole
     * point is that a paying student stops being sent to the catalogue root —
     * so the destination has to be a lesson that actually teaches, not the
     * "We're organising this lesson now" placeholder with its disabled Notify
     * me button. That placeholder is what 81 of 82 lesson URLs render, so
     * building the URL correctly and landing on a stub is the likely failure,
     * not a hypothetical one.
     *
     * ⚠ FETCHED AND READ, not asserted from source — same discipline as the
     * chip guard. A source test would pass while the lesson was unpublished.
     */
    {
      const LIVE_LESSON =
        "/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/definitions-formulae-and-the-mole";
      let status = 0, html = "";
      try {
        const res = await fetch(BASE + LIVE_LESSON, { signal: AbortSignal.timeout(30_000) });
        status = res.status;
        html = await res.text();
      } catch { /* asserted below */ }

      t("the deep-link lesson resolves", status === 200, `HTTP ${status}`);

      const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ");
      const PLACEHOLDER = [
        "We&#x27;re organising this lesson now",
        "We're organising this lesson now",
        "Form wiring coming in a later session",
      ];
      const hit = PLACEHOLDER.filter((m) => body.includes(m));
      t("⚠ the deep-link destination is a real lesson, not the coming-soon placeholder",
        status === 200 && hit.length === 0,
        hit.length ? `placeholder shown: ${hit[0]}` : `HTTP ${status}`);

      /**
       * ⚠ AND IT IS NOT VACUOUS. A page that 200s with nothing on it would pass
       * the check above; a real lesson carries its own title.
       */
      t("and it renders lesson content, not an empty shell",
        /Definitions, formulae and the mole/i.test(body),
        `${body.length} bytes`);
    }

    /**
     * ==========================================================================
     * ⚠ NO HERO CHIP MAY LEAD TO A SURFACE THAT IS NOT BUILT.
     * ==========================================================================
     * The six chips sit above the fold on the first screen a parent sees after
     * tapping a WhatsApp link. Several nearby surfaces ARE stubs and each says
     * so in its own words:
     *   /exam-builder                "This is not built yet."
     *   /past-papers/<slug>/test     "Not built yet — nothing you type anywhere
     *                                 on this page is saved"
     *   .../interactive/sit/practice "Practice mode isn't built yet."
     * A chip pointing at one of those is not a rough edge; it is the moment a
     * paying parent stops believing the rest of the page.
     *
     * ⚠ IT ASSERTS THE RENDERED DESTINATION, NOT THE LABEL. Fetching each href
     * and reading what comes back is the only check that survives someone
     * renaming a chip, or a destination decaying into a stub later. A test that
     * matched the label would have said nothing about either.
     */
    {
      const CHIP_HREFS = [
        "/learn", "/resources", "/past-papers", "/#try",
      ];
      /** Copy that means "this is not finished" wherever it appears. */
      const NOT_BUILT = [
        "is not built yet",
        "Not built yet",
        "isn't built yet",
        "not built yet",
      ];

      for (const href of CHIP_HREFS) {
        /** "/#try" is the homepage plus an anchor — the document to fetch is "/". */
        const path = href.startsWith("/#") ? "/" : href;
        let status = 0, html = "";
        try {
          const res = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) });
          status = res.status;
          html = await res.text();
        } catch (err) {
          status = 0;
        }
        t(`chip destination ${href} → 200`, status === 200, `HTTP ${status}`);

        let body = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ");

        /**
         * ⚠ AN ANCHOR CHIP IS JUDGED ON ITS SECTION, NOT THE WHOLE DOCUMENT.
         * The homepage says "Teacher tools are not built yet" — an honest
         * disclaimer about a DIFFERENT feature, and exactly the kind of candour
         * this project should keep. Failing "/#try" for it would punish the
         * honesty and say nothing about whether the marking demo works. So for
         * an anchor href the check is scoped to that element's own section.
         */
        if (href.startsWith("/#")) {
          const id = href.slice(2);
          const at = body.search(new RegExp(`id="${id}"`));
          if (at >= 0) {
            const after = body.slice(at);
            const end = after.search(/<\/section>/i);
            body = end > 0 ? after.slice(0, end) : after.slice(0, 6000);
          }
        }
        const hits = NOT_BUILT.filter((m) => body.includes(m));
        t(`⚠ chip destination ${href} renders NO not-built state`,
          status === 200 && hits.length === 0,
          hits.length ? `found: ${hits.join(", ")}` : `HTTP ${status}`);
      }

      /**
       * ⚠ AND THE ANCHOR THE MARKED-FEEDBACK CHIP RELIES ON MUST EXIST. "/#try"
       * is only honest if the marking demo is actually on the homepage; without
       * the target the chip is a link to the top of a page.
       */
      let home = "";
      try {
        const res = await fetch(BASE + "/", { signal: AbortSignal.timeout(30_000) });
        home = res.status === 200 ? await res.text() : "";
      } catch { /* asserted below */ }
      t('⚠ the "/#try" anchor target exists on the homepage', /id="try"/.test(home));

      /**
       * ⚠ AND THE CHIPS ACTUALLY RENDER, ALL SIX. A guard that only checked
       * destinations would pass if the chips vanished entirely.
       */
      const chipCtas = (home.match(/data-cta="hero_chip_[a-z_]+"/g) ?? []);
      t("all four hero chips render on the homepage", chipCtas.length === 4, `${chipCtas.length} chip(s)`);

      /**
       * ⚠ FOUR LABELS, FOUR DESTINATIONS — no label may resolve to a surface it
       * does not name. "Question Bank" and "Exam Practice" both resolved to
       * /past-papers, so three labels shared one archive and two of them named
       * something the app does not have. That is the same broken promise as a
       * link to a stub, made more quietly, and this fails if it comes back.
       */
      const uniqueDestinations = new Set(CHIP_HREFS);
      t("⚠ every chip has its own destination — no label over a shared surface",
        uniqueDestinations.size === chipCtas.length,
        `${uniqueDestinations.size} destination(s) for ${chipCtas.length} chip(s)`);

      /**
       * ⚠ THE QUALIFICATION LINE STAYS ONE LINE AT 375. It cannot be measured
       * from HTML, so this asserts the two things that make the wrap
       * impossible: the nowrap class is present, and the phone-size type/
       * tracking pair is still there. The rendered width is measured in a
       * browser and reported separately — 327px of 375 at the time of writing.
       */
      t("⚠ the qualification line is nowrap with phone-sized tracking",
        /whitespace-nowrap[^"]*text-\[9px\][^"]*tracking-\[0\.12em\]/.test(home)
        || /whitespace-nowrap/.test(home) && /text-\[9px\]/.test(home) && /tracking-\[0\.12em\]/.test(home));
    }

    /**
     * ==========================================================================
     * ⚠ BIDI ISOLATION, PROVED AGAINST THE RENDERED PAGE AND THE SERVED CSS.
     * ==========================================================================
     * On /ar the hero rendered as ".Learn it. Practise it" — the full stop had
     * jumped to the front, because a trailing neutral in an RTL paragraph
     * belongs to the paragraph direction. Measured before the fix: 275 of 276
     * Latin-script text nodes on /ar had no isolation of any kind.
     *
     * ⚠ THE COVERED TAG SET IS READ OUT OF THE SERVED STYLESHEET, NOT TYPED
     * HERE. The guard parses `.font-arabic :is(…) { unicode-bidi: plaintext }`
     * from the CSS the browser actually downloads, then checks the rendered
     * HTML against THAT set. So deleting a tag from the rule does not quietly
     * shrink what the guard demands — it makes the guard fail on the text that
     * tag was carrying. A test with its own hardcoded list would have passed.
     */
    {
      let arHtml = "";
      try {
        const res = await fetch(BASE + "/ar", { signal: AbortSignal.timeout(30_000) });
        arHtml = res.status === 200 ? await res.text() : "";
      } catch { /* asserted below */ }
      t("/ar fetched for bidi inspection", arHtml.length > 0);

      /** Every stylesheet the page links, concatenated. */
      const hrefs = [...arHtml.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
      let css = "";
      for (const h of hrefs) {
        try {
          const r = await fetch(BASE + h, { signal: AbortSignal.timeout(30_000) });
          if (r.status === 200) css += await r.text();
        } catch { /* ignored */ }
      }
      t("the served stylesheet was fetched", css.length > 1000, `${hrefs.length} file(s), ${css.length} bytes`);

      /** ⚠ DERIVED. Which tags does the shipped rule actually isolate? */
      const covered = new Set<string>();
      /**
       * ⚠ PARSED FROM THE BUILT CSS, WHICH IS NOT THE SHAPE THAT WAS AUTHORED.
       * The build merges the two authored rules into one selector list —
       * `.font-arabic :is(h1,…),.font-arabic :is(a,button,span,…){…}` — so the
       * parser takes every :is() group in the selector that precedes a
       * unicode-bidi:plaintext declaration, not the first one.
       */
      for (const m of css.matchAll(/([^{}]*)\{([^}]*unicode-bidi\s*:\s*plaintext[^}]*)\}/g)) {
        const selector = m[1];
        if (!/\.font-arabic/.test(selector)) continue;
        for (const g of selector.matchAll(/:is\(([^)]*)\)/g)) {
          for (const raw of g[1].split(",")) {
            const tag = raw.trim().replace(/\[[^\]]*\]/g, "").trim().toLowerCase();
            if (/^[a-z][a-z0-9]*$/.test(tag)) covered.add(tag);
          }
        }
      }
      t("⚠ the isolation rule is present in the served CSS",
        covered.size > 0, `${covered.size} covered tag(s)`);
      t("it covers block text containers", covered.has("h1") && covered.has("p") && covered.has("li"));

      /**
       * ⚠ NOW THE RENDERED PAGE. Strip script/style/noscript — those are not
       * rendered text and counting them made an earlier measurement report 44
       * phantom failures. Then find Latin-script runs and check the element
       * that directly holds each one.
       */
      /**
       * ⚠ BODY ONLY. <title> is document metadata, not rendered text — it has
       * no paragraph and cannot show the defect. The browser probe walked
       * document.body; this matches it rather than flagging the tab label.
       */
      const bodyStart = arHtml.search(/<body[^>]*>/i);
      const body = (bodyStart >= 0 ? arHtml.slice(bodyStart) : arHtml)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ");

      const offenders: string[] = [];
      let latinRuns = 0;
      for (const m of body.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>([^<]+)</g)) {
        const [, tag, attrs, text] = m;
        const trimmed = text.replace(/&[a-z#0-9]+;/gi, " ").trim();
        if (trimmed.length < 4) continue;
        if (!/[A-Za-z]/.test(trimmed)) continue;
        if (/[\u0600-\u06FF]/.test(trimmed)) continue;      // Arabic — not the case under test
        latinRuns++;
        const explicit = /\sdir="(auto|ltr)"/.test(attrs) || tag === "bdi";
        if (!explicit && !covered.has(tag)) offenders.push(`<${tag}> "${trimmed.slice(0, 40)}"`);
      }

      t("the page actually carries Latin text (else this is vacuous)",
        latinRuns > 20, `${latinRuns} run(s)`);
      /**
       * ⚠ THE GUARD. A Latin string in an RTL document, in an element the
       * isolation rule does not reach and with no dir of its own, is the exact
       * shape that produced ".Learn it. Practise it".
       */
      t("⚠ NO Latin-script text renders on /ar without bidi isolation",
        offenders.length === 0,
        `${offenders.length} unisolated: ${offenders.slice(0, 5).join(" | ")}`);
    }

    /**
     * ==========================================================================
     * ⚠ THE LOCALE-AWARE LINK LAYER, PROVED AGAINST RENDERED HTML.
     * ==========================================================================
     * Two failures, opposite directions, both invisible to a build:
     *   1. A localised link rendered WITHOUT the prefix drops an Arabic reader
     *      into English mid-journey — the exact thing a language toggle exists
     *      to prevent, and the defect phase 1 shipped with.
     *   2. A link to one of the unlocalised roots rendered WITH the prefix
     *      points at /ar/login, which does not exist. That is a 404 on a page
     *      that works in English.
     * SmartLink decides per href at runtime; this proves both directions on the
     * one page Arabic was actually built for.
     */
    {
      let ar = "";
      try {
        const res = await fetch(BASE + "/ar/tuition", { signal: AbortSignal.timeout(30_000) });
        ar = res.status === 200 ? await res.text() : "";
      } catch { /* asserted below */ }

      t("/ar/tuition fetched for link inspection", ar.length > 0);

      /** Localised: the mode tabs must keep the reader in Arabic. */
      t("⚠ /ar/tuition — internal tuition links carry the /ar prefix",
        /href="\/ar\/tuition/.test(ar),
        ar ? "no /ar/tuition href found" : "page not fetched");

      /**
       * ⚠ Unlocalised: these roots live outside the locale segment. Finding a
       * prefixed one means SmartLink sent a reader to a route that cannot exist.
       */
      const prefixedUnlocalised = ["login", "signup", "resources", "past-papers",
        "exam-builder", "calendar", "profile", "intensive"]
        .filter((root) => ar.includes(`href="/ar/${root}"`));
      t("⚠ /ar/tuition — NO unlocalised root is given a locale prefix",
        ar.length > 0 && prefixedUnlocalised.length === 0,
        prefixedUnlocalised.length ? `/ar/${prefixedUnlocalised.join(", /ar/")}` : undefined);

      /** And the unprefixed forms are still present, so they were not simply dropped. */
      t("/ar/tuition — unlocalised links still render, unprefixed",
        /href="\/(login|signup|resources)"/.test(ar));

      /**
       * ⚠ THE PAYMENT LINK IS NEVER TOUCHED. cohort.enrolmentUrl is an absolute
       * Stripe URL; prefixing or rewriting it would break a live, payable CTA.
       */
      t("⚠ /ar/tuition — the external Reserve link is left absolute",
        !/href="\/ar\/https?:/.test(ar) && !/href="\/https?:/.test(ar));
    }

    /**
     * ==========================================================================
     * ⚠ THE COMMITMENT GATE, PROVED AGAINST RENDERED HTML.
     * ==========================================================================
     * A three-month or academic-year tab shows a total, then sends the reader to
     * the SAME single Payment Link as the monthly tab — so the number on screen
     * is not the number charged. commitment-gate.test.ts proves the pure
     * property; this proves the PAGE. Nothing here reads source, so no comment
     * and no dead constant can satisfy it — only what a browser would receive.
     *
     * The tab pills are the only elements carrying these data-cta values, so
     * their presence in the document IS the tab rendering.
     */
    const CTA_OF: Record<string, string> = {
      monthly: "tuition_group_one_month_selected",
      three_month: "tuition_group_three_month_selected",
      academic_year: "tuition_group_academic_selected",
    };
    /** Every price the document shows, in order — derived, never hardcoded. */
    const pricesIn = (html: string) =>
      (html.match(/(?:QAR|&pound;|£)\s?[\d,]+(?:\.\d+)?/g) ?? []).join("|");

    let monthlyHtml = "";
    try {
      const res = await fetch(BASE + "/tuition?commitment=monthly", { signal: AbortSignal.timeout(30_000) });
      monthlyHtml = res.status === 200 ? await res.text() : "";
    } catch { /* the assertions below report it */ }

    t("the monthly tab renders (the page can still sell something)",
      monthlyHtml.includes(CTA_OF.monthly),
      monthlyHtml ? "monthly pill absent from /tuition" : "could not fetch /tuition");
    t("the monthly page shows at least one price (else the comparison below is vacuous)",
      pricesIn(monthlyHtml).length > 0, pricesIn(monthlyHtml).slice(0, 80));

    for (const hidden of ["three_month", "academic_year"]) {
      let html = "", status = 0;
      try {
        const res = await fetch(BASE + `/tuition?commitment=${hidden}`, { signal: AbortSignal.timeout(30_000) });
        status = res.status;
        html = await res.text();
      } catch {
        html = ""; status = 0;
      }

      t(`?commitment=${hidden} → 200, not a 500`, status === 200, `HTTP ${status}`);

      /** ⚠ THE MIS-SALE GUARD. If the tab renders, its pill is in the document. */
      t(`?commitment=${hidden} does NOT render the ${hidden} tab`,
        status === 200 && !html.includes(CTA_OF[hidden]),
        html.includes(CTA_OF[hidden]) ? `${CTA_OF[hidden]} is in the HTML` : undefined);

      /**
       * ⚠ AND IT RENDERS THE MONTHLY PRICES — derived by comparison, so this
       * never hardcodes an amount and cannot go stale when Stripe changes one.
       * If the page honoured the hidden commitment, the totals would differ.
       */
      t(`?commitment=${hidden} shows exactly the monthly prices`,
        status === 200 && pricesIn(html) === pricesIn(monthlyHtml) && pricesIn(html).length > 0,
        `hidden=${pricesIn(html).slice(0, 60)} monthly=${pricesIn(monthlyHtml).slice(0, 60)}`);
    }
  } finally {
    stop();
  }
}

await main();

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
