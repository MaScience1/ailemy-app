/**
 * The lesson practice engine — deterministic, seeded, server-marked (§35–§45).
 *
 * ============================================================================
 * ⚠ THE SEED IS THE ATTEMPT (§45)
 * ============================================================================
 * Every attempt is a pure function of (lessonSlug, seed, avoid-list). The
 * server generates the ten questions from the seed when the attempt starts,
 * and REGENERATES them from the same seed at marking time — so the correct
 * answers never travel to the browser before submission (§103), refreshing
 * the page reproduces the identical questions (§45), and there is nothing to
 * store server-side until the schema for practice attempts lands. When it
 * does, persisting an attempt is persisting its seed and the marked snapshot;
 * nothing about generation changes.
 *
 * ⚠ NUMERICAL ANSWERS ARE COMPUTED, NEVER CHOSEN (§37, §101). A family's
 * `answer()` computes the value; its `verify()` is a SECOND, independent
 * derivation of the same value. A variant whose two derivations disagree is
 * refused at generation time — it cannot be served, because serve() throws
 * rather than returns. The distractors are named mistakes (§38): × for ÷, a
 * dropped power of ten, a forgotten multiplier — never random numbers.
 *
 * ⚠ MASTERY, RETRY WEIGHTING AND PROGRESS ROLL-UPS DO NOT LIVE HERE. This
 * module produces attempt evidence (marks, spec codes, family keys); the
 * academic record consumes it. One record architecture — the parked schema
 * defines its tables, and src/lib/account/academic.ts already defines the
 * mastery arithmetic that will read it.
 */

// ── deterministic randomness ────────────────────────────────────────────────

/** mulberry32 — small, fast, and stable across platforms. The seed is a
 *  uint32; attempts store it as a decimal string. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)];

export const shuffle = <T,>(r: () => number, xs: readonly T[]): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ── the question shapes ─────────────────────────────────────────────────────

export type QuestionKind = "definition" | "classification" | "formula" | "calculation" | "application";

/** What the STUDENT receives — no correct index, no explanations (§103). */
export type ServedQuestion = {
  qIndex: number;
  familyKey: string;
  specCode: string;
  kind: QuestionKind;
  stem: string;
  options: string[];
  /** Slide to revisit — grounding, shown after marking (§52). */
  reviewSlide: number | null;
};

/** The full generated form — server-side only until marking returns it. */
export type GeneratedQuestion = ServedQuestion & {
  correctIndex: number;
  explanation: string;
  /** Why each wrong option is wrong, where the family can say (§51). Keyed by
   *  option index; absent = no reviewed feedback for that distractor, and the
   *  UI says nothing rather than inventing (§39). */
  wrongWhy: Partial<Record<number, string>>;
};

// ── families ────────────────────────────────────────────────────────────────

/**
 * A question family (§36): one validated generator, many variants.
 *
 * ⚠ `generate` must be PURE in the rng — same rng stream, same question. The
 * engine relies on that for §45 (refresh keeps the attempt) and §103 (marking
 * regenerates rather than trusting the client).
 *
 * ⚠ `verify` exists ONLY on numerical families and must recompute the correct
 * answer by a DIFFERENT expression than generate used. Copying generate's
 * arithmetic into verify would make §101's check a tautology — the sabotage
 * test proves it bites by shipping a family whose derivations disagree.
 */
export type Family = {
  key: string;
  lessonSlug: string;
  specCode: string;
  kind: QuestionKind;
  /** Slides this family is grounded in — must exist in the deck manifest. */
  sourceSlides: number[];
  /** Terms that must appear in the lesson source pack for this family to be
   *  servable at all — the §100 content boundary, machine-checkable. */
  groundingTerms: string[];
  generate: (r: () => number) => Omit<GeneratedQuestion, "qIndex" | "familyKey" | "specCode" | "kind">;
  verify?: (q: GeneratedQuestion) => boolean;
};

export type FamilyStatus = "draft" | "approved" | "disabled";

// ── the lesson source pack (§41) — the machine-readable content boundary ────

export type SourcePack = {
  lessonSlug: string;
  /** The codes this lesson TEACHES — from the catalogue's lesson_spec_points
   *  where the lesson is mapped, else the deck's own repeated header chips.
   *  Never widened by a closing-slide "next lesson" pointer. */
  taughtSpecCodes: string[];
  /** Lower-cased concatenation of every slide's extracted text. */
  vocabulary: string;
  slideNumbers: number[];
};

export type FamilyVerdict = { servable: true } | { servable: false; reason: string };

/**
 * Build the pack from a parsed manifest plus the TAUGHT spec codes.
 *
 * ⚠ taughtCodes COMES FROM THE CATALOGUE (lesson_spec_points), NOT THE DECK.
 * The deck's chips corroborate, but a closing slide's "next lesson" pointer
 * must never widen the boundary — L1's slide 25 mentions spec 1.3 exactly
 * that way. Pure so the suite exercises it against the real manifest with no
 * server imports.
 */
export function buildSourcePack(
  manifest: { lessonSlug: string; slides: { n: number; text: string }[] },
  taughtCodes: string[],
): SourcePack {
  return {
    lessonSlug: manifest.lessonSlug,
    taughtSpecCodes: [...taughtCodes].sort(),
    vocabulary: manifest.slides.map((s) => s.text).join("\n").toLowerCase(),
    slideNumbers: manifest.slides.map((s) => s.n),
  };
}

/**
 * §100 enforcement — a family is servable only when the PACK vouches for it.
 * This runs at serve time, not only in tests, so a family added without
 * re-running the suite still cannot escape its lesson's boundary.
 */
export function familyWithinBoundary(f: Family, pack: SourcePack): FamilyVerdict {
  if (f.lessonSlug !== pack.lessonSlug) {
    return { servable: false, reason: `family ${f.key} belongs to ${f.lessonSlug}, not ${pack.lessonSlug}` };
  }
  if (!pack.taughtSpecCodes.includes(f.specCode)) {
    return {
      servable: false,
      reason: `family ${f.key} claims spec ${f.specCode}, but this lesson teaches only ${pack.taughtSpecCodes.join(", ")}`,
    };
  }
  for (const s of f.sourceSlides) {
    if (!pack.slideNumbers.includes(s)) {
      return { servable: false, reason: `family ${f.key} cites slide ${s}, which the deck does not have` };
    }
  }
  const missing = f.groundingTerms.filter((t) => !pack.vocabulary.includes(t.toLowerCase()));
  if (missing.length > 0) {
    return {
      servable: false,
      reason: `family ${f.key} depends on terms the lesson never shows: ${missing.join(", ")}`,
    };
  }
  return { servable: true };
}

// ── attempt generation ──────────────────────────────────────────────────────

export const ATTEMPT_SIZE = 10;

export type AttemptSpec = {
  lessonSlug: string;
  seed: number;
  questions: GeneratedQuestion[];
};

/**
 * Build one 10-question attempt (§32, §34, §44).
 *
 * Selection: families are grouped by kind and drawn round-robin across kinds
 * so an attempt cannot be ten definitions (§34); within the pool, families on
 * the avoid-list (recent attempts) sort last (§44) — avoided, not banned,
 * because a small pool must still fill ten. A family may repeat within an
 * attempt only when the pool has fewer than ten families; repeated draws get
 * fresh rng, so even a repeated family asks different values.
 *
 * ⚠ EVERY SERVED VARIANT IS VERIFIED AT BIRTH (§101): a numerical family's
 * independent recomputation must agree, every question must have exactly one
 * correct option among four distinct options, and the family must clear the
 * §100 boundary. Any failure THROWS — a bad variant is a bug to surface, not
 * a question to serve.
 */
export function buildAttempt(input: {
  families: Family[];
  statuses: Record<string, FamilyStatus>;
  pack: SourcePack;
  seed: number;
  avoidFamilies?: string[];
  /** Retry-mistakes (§54): restrict the pool to these families. Falls back to
   *  the full pool if none of them are servable — a retry button must never
   *  dead-end because the founder disabled a family overnight. */
  focusFamilies?: string[];
  /** Admin preview may serve draft families; students never do (§66, §67). */
  includeDraft?: boolean;
}): AttemptSpec {
  const { pack, seed } = input;
  const avoid = new Set(input.avoidFamilies ?? []);

  let eligible = input.families.filter((f) => {
    const status = input.statuses[f.key] ?? "draft";
    if (status === "disabled") return false;
    if (status === "draft" && !input.includeDraft) return false;
    return familyWithinBoundary(f, pack).servable;
  });
  if (eligible.length === 0) {
    throw new Error(`no servable families for ${pack.lessonSlug} — nothing approved yet?`);
  }
  if (input.focusFamilies && input.focusFamilies.length > 0) {
    const focused = eligible.filter((f) => input.focusFamilies!.includes(f.key));
    if (focused.length > 0) eligible = focused;
  }

  const r = rng(seed);

  // Round-robin over kinds for balance (§34): shuffle kinds, then families
  // within each kind with avoided ones last.
  const byKind = new Map<QuestionKind, Family[]>();
  for (const f of eligible) {
    byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
  }
  const kindOrder = shuffle(r, [...byKind.keys()]);
  for (const [k, fs] of byKind) {
    const fresh = shuffle(r, fs.filter((f) => !avoid.has(f.key)));
    const seen = shuffle(r, fs.filter((f) => avoid.has(f.key)));
    byKind.set(k, [...fresh, ...seen]);
  }

  const chosen: Family[] = [];
  const cursors = new Map<QuestionKind, number>();
  while (chosen.length < ATTEMPT_SIZE) {
    let advanced = false;
    for (const k of kindOrder) {
      if (chosen.length >= ATTEMPT_SIZE) break;
      const fs = byKind.get(k) ?? [];
      const cursor = cursors.get(k) ?? 0;
      if (cursor < fs.length) {
        chosen.push(fs[cursor]);
        cursors.set(k, cursor + 1);
        advanced = true;
      }
    }
    if (!advanced) {
      // Pool exhausted below ten — wrap and repeat families with fresh rng.
      for (const k of kindOrder) cursors.set(k, 0);
      if (eligible.length === 0) break;
    }
  }

  const questions: GeneratedQuestion[] = chosen.map((f, qIndex) => {
    const g = f.generate(r);
    const q: GeneratedQuestion = {
      ...g,
      qIndex,
      familyKey: f.key,
      specCode: f.specCode,
      kind: f.kind,
    };
    // ── birth checks (§99, §101) ──────────────────────────────────────────
    if (q.options.length !== 4) {
      throw new Error(`${f.key}: ${q.options.length} options, expected 4`);
    }
    if (new Set(q.options).size !== 4) {
      throw new Error(`${f.key}: duplicate options: ${q.options.join(" | ")}`);
    }
    if (q.correctIndex < 0 || q.correctIndex > 3) {
      throw new Error(`${f.key}: correctIndex out of range`);
    }
    if (f.verify && !f.verify(q)) {
      throw new Error(
        `${f.key}: independent recomputation DISAGREES with the labelled answer — refusing to serve (§101)`,
      );
    }
    return q;
  });

  // No two questions in one set may share an exact stem (§99).
  const stems = new Set<string>();
  for (const q of questions) {
    if (stems.has(q.stem)) {
      throw new Error(`duplicate stem in one attempt: "${q.stem.slice(0, 60)}"`);
    }
    stems.add(q.stem);
  }

  return { lessonSlug: pack.lessonSlug, seed, questions };
}

/** Strip an attempt to what the browser may see before submission (§103). */
export function toServed(spec: AttemptSpec): ServedQuestion[] {
  return spec.questions.map(({ correctIndex: _c, explanation: _e, wrongWhy: _w, ...served }) => served);
}

// ── marking (§49, §102) ─────────────────────────────────────────────────────

export type MarkedQuestion = GeneratedQuestion & {
  selectedIndex: number | null;
  correct: boolean;
};

/** A stable fingerprint of what the student was SHOWN — the client returns it
 *  at submit so a pool change mid-attempt (a family disabled between start and
 *  submit) is DETECTED and refused instead of silently marking different
 *  questions than the student answered. */
export function attemptFingerprint(spec: AttemptSpec): string {
  let h = 2166136261 >>> 0; // FNV-1a over the stems and option order
  const text = spec.questions.map((q) => q.stem + "\u0000" + q.options.join("\u0001")).join("\u0002");
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16);
}

export type MarkedAttempt = {
  lessonSlug: string;
  seed: number;
  score: number;
  outOf: number;
  /** Exact integer percentage where it divides cleanly; one decimal otherwise.
   *  7/10 is 70, never 69.99 (§102). */
  percent: number;
  questions: MarkedQuestion[];
};

export function markAttempt(spec: AttemptSpec, selections: (number | null)[]): MarkedAttempt {
  if (selections.length !== spec.questions.length) {
    throw new Error(`selections length ${selections.length} != ${spec.questions.length}`);
  }
  const questions: MarkedQuestion[] = spec.questions.map((q, i) => {
    const sel = selections[i];
    const selectedIndex = sel === null || sel === undefined || sel < 0 || sel > 3 ? null : sel;
    return { ...q, selectedIndex, correct: selectedIndex === q.correctIndex };
  });
  const score = questions.filter((q) => q.correct).length;
  const outOf = questions.length;
  const raw = (score / outOf) * 100;
  const percent = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10;
  return { lessonSlug: spec.lessonSlug, seed: spec.seed, score, outOf, percent, questions };
}
