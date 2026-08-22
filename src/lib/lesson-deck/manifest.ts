/**
 * The lesson-deck manifest contract (§8, §19, §23).
 *
 * ============================================================================
 * ⚠ ONE CONTRACT, TWO PRODUCERS, THREE CONSUMERS
 * ============================================================================
 * scripts/lesson-ingest/ingest.py writes manifest.json; the uploader copies it
 * verbatim into the private assets bucket. The lesson page (server), the admin
 * preview and the practice source-pack builder all parse it through THIS
 * module, so a malformed bundle fails loudly in one place with the reason
 * attached, instead of three surfaces each half-tolerating it.
 *
 * ⚠ THE MANIFEST IS STUDENT-SAFE BY CONSTRUCTION AND THIS PARSER KEEPS IT SO.
 * Speaker notes live in a separate notes.json that no student path reads. This
 * parser REFUSES a manifest that carries a "notes" key anywhere — if a future
 * ingest change merges the files, every consumer goes down rather than one
 * quietly serving a teacher's notes to students (§22).
 *
 * ⚠ FRAMES, NOT SLIDES, ARE THE UNIT (§19). A static slide is the one-frame
 * case of the same shape — there is no separate code path for it, so the
 * player cannot drift into treating animation as an add-on.
 */

export type DeckSlide = {
  n: number;
  title: string;
  /** Codes the DECK claims (its own spec chips). Detection, never invention. */
  specCodes: string[];
  /** Extracted text runs — accessibility, search, and question grounding (§23). */
  text: string;
  /** Bucket-relative frame paths in build order; last = fully revealed. */
  frames: string[];
  /** Human label per build step, e.g. "n(Na) = 0.20 mol + MARK SCHEME [3]". */
  buildLabels: string[];
};

export type DeckManifest = {
  schema: 1;
  lessonSlug: string;
  version: number;
  deckLabel: string;
  sourceSha256: string;
  slideCount: number;
  frameCount: number;
  specCodes: string[];
  slides: DeckSlide[];
};

export type ManifestVerdict =
  | { ok: true; manifest: DeckManifest }
  | { ok: false; reason: string };

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseManifest(raw: unknown): ManifestVerdict {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "manifest is not an object" };
  }
  const m = raw as Record<string, unknown>;

  // ⚠ THE NOTES REFUSAL COMES FIRST — before any tolerance below can accept.
  if (containsNotesKey(raw)) {
    return {
      ok: false,
      reason:
        "manifest contains a 'notes' key — speaker notes are admin-only and travel in notes.json, never here. Refusing the whole deck rather than serving it.",
    };
  }

  if (m.schema !== 1) return { ok: false, reason: `unknown manifest schema: ${String(m.schema)}` };
  if (!isStr(m.lessonSlug) || !m.lessonSlug) return { ok: false, reason: "lessonSlug missing" };
  if (!isNum(m.version)) return { ok: false, reason: "version missing" };
  if (!isStr(m.sourceSha256) || m.sourceSha256.length !== 64) {
    return { ok: false, reason: "sourceSha256 missing or malformed" };
  }
  if (!Array.isArray(m.slides) || m.slides.length === 0) {
    return { ok: false, reason: "no slides" };
  }

  const slides: DeckSlide[] = [];
  let frameCount = 0;
  for (const s of m.slides as unknown[]) {
    const o = s as Record<string, unknown>;
    if (!isNum(o.n) || !Array.isArray(o.frames) || o.frames.length === 0) {
      return { ok: false, reason: `slide entry malformed (n=${String(o?.n)})` };
    }
    const frames = o.frames.filter(isStr);
    if (frames.length !== o.frames.length) {
      return { ok: false, reason: `slide ${o.n}: non-string frame path` };
    }
    // ⚠ FRAME PATHS ARE RELATIVE AND CONFINED. An absolute path or a traversal
    // here would let a poisoned manifest point the asset route outside the
    // deck's own directory.
    for (const f of frames) {
      if (!/^frames\/[a-z0-9-]+\.png$/.test(f)) {
        return { ok: false, reason: `slide ${o.n}: frame path escapes the bundle: ${f}` };
      }
    }
    slides.push({
      n: o.n,
      title: isStr(o.title) ? o.title : "",
      specCodes: Array.isArray(o.specCodes) ? o.specCodes.filter(isStr) : [],
      text: isStr(o.text) ? o.text : "",
      frames,
      buildLabels: Array.isArray(o.buildLabels) ? o.buildLabels.filter(isStr) : [],
    });
    frameCount += frames.length;
  }

  // ⚠ THE COUNTS MUST AGREE WITH THEMSELVES. A manifest whose frameCount
  // disagrees with its own slides is a truncated or hand-edited file.
  if (m.slideCount !== slides.length) {
    return { ok: false, reason: `slideCount says ${String(m.slideCount)}, slides array has ${slides.length}` };
  }
  if (m.frameCount !== frameCount) {
    return { ok: false, reason: `frameCount says ${String(m.frameCount)}, slides carry ${frameCount}` };
  }

  return {
    ok: true,
    manifest: {
      schema: 1,
      lessonSlug: m.lessonSlug,
      version: m.version,
      deckLabel: isStr(m.deckLabel) ? m.deckLabel : "",
      sourceSha256: m.sourceSha256,
      slideCount: slides.length,
      frameCount,
      specCodes: Array.isArray(m.specCodes) ? (m.specCodes as unknown[]).filter(isStr) : [],
      slides,
    },
  };
}

function containsNotesKey(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(containsNotesKey);
  if (typeof v === "object" && v !== null) {
    return Object.entries(v).some(([k, val]) => k === "notes" || containsNotesKey(val));
  }
  return false;
}

/**
 * Flatten a manifest into the player's linear frame list.
 *
 * The player walks ONE ordered list; "next" is index+1 whether that is the
 * next build step or the next slide — which is exactly PowerPoint presenter
 * behaviour (§16) falling out of the data shape instead of being implemented
 * as a special case.
 */
export type FlatFrame = {
  index: number;
  slideN: number;
  /** 0-based step within the slide; last step = fully revealed. */
  step: number;
  stepCount: number;
  path: string;
  buildLabel: string | null;
};

export function flattenFrames(manifest: DeckManifest): FlatFrame[] {
  const out: FlatFrame[] = [];
  for (const s of manifest.slides) {
    s.frames.forEach((path, step) => {
      out.push({
        index: out.length,
        slideN: s.n,
        step,
        stepCount: s.frames.length,
        path,
        // step 0 is the slide's opening state — no build has fired yet.
        buildLabel: step > 0 ? (s.buildLabels[step - 1] ?? null) : null,
      });
    });
  }
  return out;
}
