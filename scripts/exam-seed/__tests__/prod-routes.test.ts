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
import { LIVE_CHIPS } from "../../../src/lib/home/hero-chips.ts";
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
      /**
       * ⚠ DERIVED FROM THE MODULE, NEVER TYPED HERE. A hardcoded list checks
       * the four destinations that were true when the test was written — so
       * promoting a coming-soon chip into row 1 with a stub href would sail
       * past it, which is precisely the change this guard exists to stop.
       * Reading LIVE_CHIPS means the guard fetches whatever the page actually
       * links to, including a bad one added tomorrow.
       */
      const CHIP_HREFS = [...new Set(LIVE_CHIPS.map((c) => c.href))];
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
      const liveCtas = chipCtas.filter((c) => !c.includes("hero_chip_soon_"));
      const soonCtas = chipCtas.filter((c) => c.includes("hero_chip_soon_"));
      t("all four LIVE hero chips render", liveCtas.length === 4, `${liveCtas.length}`);
      t("all four COMING-SOON hero chips render", soonCtas.length === 4, `${soonCtas.length}`);

      /**
       * ⚠ ROW 2 CARRIES NO href AND NO FOCUS STOP.
       * ========================================================
       * These four name things that do not exist — Flashcards has no tables,
       * /exam-builder says "This is not built yet.", there is no question-bank
       * route, and Progress reads a table with zero writers. Rendering them as
       * muted LINKS would still make them tappable, still put four dead stops
       * in the keyboard order, and still announce them as links.
       *
       * This reads the rendered element for each soon-chip and requires it to
       * be a non-anchor with no href. Promoting one into row 1 without building
       * the thing fails here AND on the destination check above.
       */
      for (const raw of soonCtas) {
        const cta = raw.replace(/^data-cta="|"$/g, "");
        /** The whole element that carries this data-cta, tag included. */
        const m = home.match(new RegExp(`<([a-z]+)([^>]*data-cta="${cta}"[^>]*)>`));
        t(`⚠ soon-chip ${cta} is not an anchor`, !!m && m[1] !== "a", m ? `<${m[1]}>` : "not found");
        t(`⚠ soon-chip ${cta} has no href`, !!m && !/\shref=/.test(m[2]), m ? m[2].slice(0, 60) : "not found");
        t(`⚠ soon-chip ${cta} is marked aria-disabled`, !!m && /aria-disabled="true"/.test(m[2]));
        t(`⚠ soon-chip ${cta} is not focusable`, !!m && !/tabindex="0"/i.test(m[2]));
      }

      /**
       * ⚠ AND NO ROW-2 LABEL MAY APPEAR INSIDE AN ANCHOR ANYWHERE IN THE HERO.
       * The per-element check above would pass if somebody added a SECOND,
       * linked copy of the same label rather than changing the existing one.
       */
      /**
       * ⚠ SCOPED TO ROW 2'S OWN LIST, NOT "THE HERO". The first version scanned
       * everything above the CTAs and failed on the site nav's own "Exam
       * Builder" link — a real and separate problem, reported to the founder,
       * but not this guard's business. Widening a guard until it catches
       * unrelated things is how a guard gets weakened later to shut it up.
       *
       * The assertion is now the strongest form available: row 2's list element
       * contains no anchor at all.
       */
      const soonUlStart = home.indexOf(`aria-label="${"Coming soon"}"`);
      const soonUl = soonUlStart > 0
        ? home.slice(soonUlStart, home.indexOf("</ul>", soonUlStart))
        : "";
      t("the coming-soon list was found (else the checks below are vacuous)",
        soonUl.length > 50, `${soonUl.length} chars`);
      t("⚠ row 2 contains NO anchor element at all", soonUl.length > 50 && !/<a[\s>]/.test(soonUl),
        (soonUl.match(/<a[^>]*>/g) ?? []).slice(0, 2).join(" "));
      for (const label of ["Flashcards", "Exam Builder", "Question Bank", "Progress"]) {
        t(`⚠ "${label}" appears in row 2, unlinked`, soonUl.includes(label));
      }

      /**
       * ⚠ FOUR LABELS, FOUR DESTINATIONS — no label may resolve to a surface it
       * does not name. "Question Bank" and "Exam Practice" both resolved to
       * /past-papers, so three labels shared one archive and two of them named
       * something the app does not have. That is the same broken promise as a
       * link to a stub, made more quietly, and this fails if it comes back.
       */
      /**
       * ⚠ COMPARED AGAINST THE LIVE CHIPS ONLY. Row 2 has no destinations by
       * design, so counting all eight would make this permanently red and the
       * obvious "fix" would be to delete the check.
       */
      const uniqueDestinations = new Set(CHIP_HREFS);
      t("⚠ every LIVE chip has its own destination — no label over a shared surface",
        uniqueDestinations.size === liveCtas.length,
        `${uniqueDestinations.size} destination(s) for ${liveCtas.length} live chip(s)`);

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
     * ⚠ THE COMMITMENT PILL ROW, READ FROM A REAL RESPONSE.
     * ==========================================================================
     * This closes a hole that was open and PROVEN open: after the mis-sale
     * section was removed, deleting the Academic-year pill outright still passed
     * the whole gate, and so did re-adding a hardcoded "Best value" badge. The
     * pill row had no rendered-HTML coverage at all, so two founder rulings
     * could have regressed without a single red.
     *
     * ⚠ WHAT THIS DOES NOT DO. It does NOT re-assert that a hidden tab is absent
     * or that every tab prices as monthly. Standing founder ruling: all three
     * commitments render, and all three send the reader to the same Payment
     * Link, knowingly. This guard is about the row EXISTING and being CLEAN.
     * See COMMITMENT_TABS_NOTE.md before adding anything price-vs-link here.
     *
     * ⚠ IT READS EACH PILL'S OWN MARKUP, NOT THE CARD'S. "Save 250 QAR" is a
     * legitimate line in the price panel below and stays; a card-wide search for
     * /Save/ would fail on it and the guard would have to be weakened to pass —
     * which is how a guard ends up asserting nothing.
     */
    {
      /** The three pills, in the order the page must render them. */
      const PILLS = [
        { cta: "tuition_group_one_month_selected", label: "1 month" },
        { cta: "tuition_group_three_month_selected", label: "3 months" },
        { cta: "tuition_group_academic_selected", label: "Academic year" },
      ] as const;
      /** Any claim of comparative worth. The pills carry their label only. */
      const CLAIM = /best value|saving|\bsave\b|~\s*\d+\s*%/i;

      let html = "", status = 0;
      try {
        const res = await fetch(BASE + "/tuition", { signal: AbortSignal.timeout(30_000) });
        status = res.status;
        html = await res.text();
      } catch { /* the assertions below report it */ }
      t("/tuition → 200 (every pill assertion below needs a real page)",
        status === 200, `HTTP ${status}`);

      /**
       * ⚠ THE COHORT COUNT IS ASSERTED FIRST, because every per-cohort loop
       * below is vacuously green over an empty list. A page that rendered no
       * cards at all — a failed read, an empty catalogue — would otherwise pass
       * this entire section without executing one assertion.
       */
      const cards = html.split(/<article\b/).slice(1)
        .filter((c) => c.includes(PILLS[0].cta));
      t("⚠ at least one group cohort card renders (else the loop below proves nothing)",
        cards.length > 0, `${cards.length} cards`);

      for (const card of cards) {
        const name = ((card.match(/<h3[^>]*>([^<]{2,90})<\/h3>/) ?? [])[1] ?? "?")
          .replace(/&amp;/g, "&").trim().slice(0, 34);

        /**
         * ⚠ THE ROW IS LOCATED STRUCTURALLY, NOT BY CLASS NAME. The card also
         * holds "Reserve your place" as data-cta="tuition_group_programme_selected"
         * — the first draft of this guard matched it as a fourth pill, which is
         * how the row came to be scoped properly. Matching on the row's Tailwind
         * classes instead would silently stop finding anything the next time the
         * row is restyled, and this whole section would pass on an empty slice.
         *
         * The pills are direct <a> children with no nested <div>, so the first
         * </div> after the first pill closes the row.
         */
        const firstAt = card.indexOf(`data-cta="${PILLS[0].cta}"`);
        const rowStart = firstAt < 0 ? -1 : card.lastIndexOf("<div", firstAt);
        const rowEnd = firstAt < 0 ? -1 : card.indexOf("</div>", firstAt);
        const row = rowStart < 0 || rowEnd < 0 ? "" : card.slice(rowStart, rowEnd);
        t(`${name} — ⚠ the pill row was located (else every count below is vacuous)`,
          row.length > 0 && PILLS.every((p) => row.includes(p.cta)),
          row.length ? `${row.length} chars` : "row not found");

        /** Every pill in the row, by data-cta, in DOM order. */
        const rendered = [...row.matchAll(/data-cta="([a-z_]+)"/g)].map((m) => m[1]);
        t(`${name} — exactly three commitment pills, and exactly the expected three`,
          rendered.length === 3 && rendered.every((c, i) => c === PILLS[i].cta),
          rendered.join(",") || "(none)");

        /** One pill's own markup: from its opening <a to its closing </a>. */
        const markupOf = (cta: string): string | null => {
          const at = card.indexOf(`data-cta="${cta}"`);
          if (at < 0) return null;
          const open = card.lastIndexOf("<a", at);
          const close = card.indexOf("</a>", at);
          return open < 0 || close < 0 ? null : card.slice(open, close);
        };
        const textOf = (m: string) => m.replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;|&#160;| /g, " ").replace(/\s+/g, " ").trim();

        for (const { cta, label } of PILLS) {
          const markup = markupOf(cta);
          const text = markup === null ? null : textOf(markup);
          /**
           * ⚠ EQUALITY, NOT "CONTAINS". A pill whose text merely CONTAINS its
           * label is satisfied by "3 months Best value", which is the exact
           * thing this exists to catch.
           */
          t(`${name} — the ${cta.replace(/^tuition_group_|_selected$/g, "")} pill reads exactly "${label}"`,
            text === label, text === null ? "pill absent" : JSON.stringify(text));
          t(`${name} — the "${label}" pill carries no value claim`,
            markup !== null && !CLAIM.test(textOf(markup)),
            markup === null ? "pill absent" : JSON.stringify(text));
        }

        /**
         * ⚠ THE DEFAULT IS ASSERTED IN BOTH DIRECTIONS. "monthly is current" is
         * satisfied by a page that marks all three current; the second half is
         * what makes it mean "selected".
         */
        const currentOf = (cta: string) => {
          const m = markupOf(cta);
          return m !== null && /aria-current="true"/.test(m);
        };
        t(`${name} — "1 month" is the selected default, and it is the only one`,
          currentOf(PILLS[0].cta) && !currentOf(PILLS[1].cta) && !currentOf(PILLS[2].cta),
          PILLS.filter((p) => currentOf(p.cta)).map((p) => p.label).join(",") || "(none current)");
      }
    }
  } finally {
    stop();
  }
}

await main();

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
