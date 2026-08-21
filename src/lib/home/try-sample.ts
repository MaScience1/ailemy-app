/**
 * The one controlled sample question behind "Try Ailemy" (§25).
 *
 * ============================================================================
 * ⚠ THIS IS DELIBERATELY NOT THE MARKING ENGINE, AND THE REASON IS SAFETY
 * ============================================================================
 * §25 offers a fallback for exactly this case and the governance header takes
 * it: "one controlled deterministic sample question with example mark data. No
 * live AI marking to anonymous users."
 *
 * Three reasons that is the right call rather than a shortcut:
 *
 *   1. AI marking is AUDIT-GATED — a 200-response audit at ≥90% and human
 *      countersigning for cohort 1. None of that has happened. Exposing it to
 *      anonymous visitors would ship an unaudited judgement as a product demo.
 *   2. An unauthenticated model call on a public homepage is an open cost and
 *      abuse surface. Rate limits reduce it; they do not remove it.
 *   3. The WCH11/01 mark-scheme seed has not landed, so the real engine has
 *      nothing to mark this question against anyway.
 *
 * ⚠ SO THE MARKING HERE IS KEYWORD MATCHING OVER A FIXED MARK SCHEME, AND THE
 * UI MUST SAY SO. It is a worked example of how Ailemy marks, not a mark. The
 * component labels it "sample marking" and the path into the real system is the
 * account CTA — which is §25's actual requirement.
 *
 * ⚠ AND IT NEVER AWARDS A MARK IT CANNOT JUSTIFY. Every awarded point names the
 * phrase it matched. A point awarded with no evidence would be the invented
 * feedback the whole project forbids, and it would be invisible.
 *
 * Pure: no database, no network, no imports. Testable with no credentials.
 */

export type MarkPoint = {
  code: string;
  /** What the mark scheme actually asks for. */
  requirement: string;
  /**
   * ⚠ ANY ONE OF THESE EARNS THE POINT. Real mark schemes accept alternatives,
   * and a demo that only accepts one phrasing teaches a student that Ailemy is
   * pedantic rather than that it is a mark scheme.
   */
  accepts: string[][];
  /** Shown when the point is missed. Never shown when it is earned. */
  ifMissed: string;
};

export type SampleQuestion = {
  id: string;
  prompt: string;
  marks: number;
  /** Rendered as context, exactly as it would be on a paper. */
  commandWord: string;
  topic: string;
  subject: string;
  scheme: MarkPoint[];
};

/**
 * ⚠ A REAL EXAM-STYLE QUESTION ON SUPPORTED CONTENT. Rates of reaction is IAL
 * Chemistry Unit 1 material and the collision-theory answer is stable — it is
 * the same two marking points in every published scheme, which is what makes a
 * deterministic demo honest here and would not make it honest for, say, a
 * six-mark evaluation.
 */
export const SAMPLE: SampleQuestion = {
  id: "rates-temperature-2",
  prompt: "Explain why increasing the temperature increases the rate of a chemical reaction.",
  marks: 2,
  commandWord: "Explain",
  topic: "Rates of reaction",
  subject: "chemistry",
  scheme: [
    {
      code: "MP1",
      requirement: "Particles gain kinetic energy, so they collide more often",
      accepts: [
        ["kinetic energy"],
        ["move faster"],
        ["moving faster"],
        ["greater speed"],
        ["more frequent", "collision"],
        ["collide more often"],
        ["more collisions per second"],
        ["higher frequency", "collision"],
      ],
      ifMissed:
        "Say what the heat does to the particles first — they gain kinetic energy and move faster, so collisions happen more often.",
    },
    {
      code: "MP2",
      requirement:
        "A greater proportion of collisions have energy ≥ the activation energy, so more are successful",
      accepts: [
        ["activation energy"],
        ["greater proportion", "energy"],
        ["more particles", "enough energy"],
        ["exceed", "energy barrier"],
        ["successful collision"],
        ["effective collision"],
      ],
      ifMissed:
        "The marks here are for the energy of the collisions, not just the number. More particles now have energy greater than or equal to the activation energy, so a greater proportion of collisions are successful.",
    },
  ],
};

export type PointOutcome = {
  code: string;
  requirement: string;
  awarded: boolean;
  /** ⚠ THE PHRASE THAT EARNED IT. Empty when not awarded. */
  evidence: string;
  /** Guidance, present only when the point was missed. */
  improve: string;
};

export type SampleResult = {
  awarded: number;
  outOf: number;
  points: PointOutcome[];
  /** True when the answer is too short to be marked at all. */
  tooShort: boolean;
};

const NORMALISE = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s≥]/g, " ").replace(/\s+/g, " ").trim();

/**
 * ⚠ A CLAUSE MATCHES ONLY IF EVERY TERM IN IT IS PRESENT. `["more frequent",
 * "collision"]` requires both — otherwise "the reaction is more frequent" earns
 * a collision-theory mark, which is exactly the over-crediting that would make
 * the demo dishonest in the student's favour and teach them nothing.
 */
function clauseMatches(answer: string, clause: string[]): string | null {
  const hay = NORMALISE(answer);
  const ok = clause.every((term) => hay.includes(NORMALISE(term)));
  return ok ? clause.join(" + ") : null;
}

export function markSample(answer: string, q: SampleQuestion = SAMPLE): SampleResult {
  const trimmed = answer.trim();

  /**
   * ⚠ REFUSES TO MARK AN EMPTY OR TOKEN ANSWER RATHER THAN AWARDING 0/2.
   * "0 out of 2" on a blank box reads as a judgement of the student; "write an
   * answer first" is the truth. Ten characters is roughly the shortest thing
   * that could contain a marking point.
   */
  if (trimmed.length < 10) {
    return {
      awarded: 0,
      outOf: q.marks,
      points: q.scheme.map((p) => ({
        code: p.code, requirement: p.requirement, awarded: false, evidence: "", improve: "",
      })),
      tooShort: true,
    };
  }

  const points: PointOutcome[] = q.scheme.map((p) => {
    let evidence = "";
    for (const clause of p.accepts) {
      const hit = clauseMatches(trimmed, clause);
      if (hit) { evidence = hit; break; }
    }
    return {
      code: p.code,
      requirement: p.requirement,
      awarded: evidence !== "",
      evidence,
      improve: evidence === "" ? p.ifMissed : "",
    };
  });

  return {
    awarded: points.filter((p) => p.awarded).length,
    outOf: q.marks,
    points,
    tooShort: false,
  };
}
