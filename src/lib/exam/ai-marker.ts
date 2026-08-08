import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  buildMarkingPrompt,
  MARKING_MODEL,
  type AiMarker,
  type AiPointJudgement,
} from "./marking";

/**
 * Tier 2 — the model-backed marker.
 *
 * ============================================================================
 * ⚠ THIS FILE IS THE ONLY PLACE THE API KEY IS READ, AND IT IS server-only
 * ============================================================================
 * ANTHROPIC_API_KEY has no NEXT_PUBLIC_ prefix, so Next will not inline it
 * into a client bundle even by accident; `import "server-only"` makes the
 * build FAIL rather than warn if this module is ever pulled into one. Two
 * independent guards, because a leaked marking key is a leaked mark scheme:
 * anyone holding it could ask the model for the answers directly.
 *
 * ============================================================================
 * WHAT THIS MARKER IS NOT ALLOWED TO DECIDE
 * ============================================================================
 * It returns per-point awarded/not-awarded and a sentence of evidence. It does
 * NOT decide its own confidence, and it cannot: `confidence: 'requires_review'`
 * is hardcoded by the caller in marking.ts and is not derived from anything
 * returned here. A model cannot promote its own marking to authoritative, and
 * there is no field in this file's return type through which it could try.
 *
 * It also cannot invent points. Every judgement is matched back to a point
 * code that was sent, and anything unrecognised is dropped — a hallucinated
 * "M7" on a 2-mark question would otherwise become a third mark.
 */

/**
 * Structured output schema. The model must return exactly this shape, so
 * marking never depends on parsing prose out of a chat response.
 *
 * `additionalProperties: false` and a full `required` list are what make the
 * schema strict; without them the model may add fields, and an extra field on
 * a marking result is an extra mark waiting to happen.
 */
const JUDGEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["judgements"],
  properties: {
    judgements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point_code", "awarded", "evidence"],
        properties: {
          point_code: {
            type: "string",
            description: "Exactly one of the point codes given in the mark scheme.",
          },
          awarded: {
            type: "boolean",
            description:
              "True only if the answer earns this point AND matches nothing in that point's MUST NOT AWARD IF list.",
          },
          evidence: {
            type: "string",
            description:
              "One sentence quoting or closely paraphrasing the student's own words, explaining the decision.",
          },
        },
      },
    },
  },
} as const;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  // Read at call time, not module load: a missing key should degrade this one
  // question to "not marked", never take down the results page at import.
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic();
  return client;
}

/**
 * The wired marker. Pass to markAttempt() to switch Tier 2 on.
 *
 * Every failure path returns ok:false with a sentence a student can read, and
 * the caller renders that as "not marked" rather than as a zero — an outage,
 * a refusal or a malformed response must never look like a wrong answer.
 */
export const claudeMarker: AiMarker = async (request) => {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      ok: false,
      error: "The marking service isn't configured, so this answer hasn't been marked.",
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: MARKING_MODEL,
      max_tokens: 4096,
      // Adaptive thinking: judging a chemistry answer against several criteria
      // with veto rules is exactly the multi-step reasoning it exists for.
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: JUDGEMENT_SCHEMA },
      },
      system:
        "You are an experienced Edexcel examiner marking a student's script. You apply the mark scheme exactly as written — you do not award marks for correct chemistry the scheme does not ask for, and you never award a point whose MUST NOT AWARD IF condition the answer matches.",
      messages: [{ role: "user", content: buildMarkingPrompt(request) }],
    });

    // A refusal is a 200 with stop_reason 'refusal' and no usable content —
    // check it before reading content, or this throws on an index.
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "This answer could not be marked automatically." };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text.trim()) {
      return { ok: false, error: "The marker returned nothing, so this answer wasn't marked." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "The marker's response could not be read." };
    }

    const raw = (parsed as { judgements?: unknown }).judgements;
    if (!Array.isArray(raw)) {
      return { ok: false, error: "The marker's response was not in the expected form." };
    }

    // Match every judgement back to a point that was actually sent, and take
    // the FIRST verdict per point. A model that returns M1 twice must not get
    // two attempts at the same mark.
    const known = new Set(request.points.map((p) => p.pointCode));
    const seen = new Set<string>();
    const judgements: AiPointJudgement[] = [];

    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const j = item as Record<string, unknown>;
      const code = typeof j.point_code === "string" ? j.point_code.trim() : "";
      if (!known.has(code) || seen.has(code)) continue;
      seen.add(code);
      judgements.push({
        pointCode: code,
        awarded: j.awarded === true,
        evidence:
          typeof j.evidence === "string" && j.evidence.trim()
            ? j.evidence.trim().slice(0, 600)
            : "No explanation was given.",
      });
    }

    // A point the model never mentioned is NOT awarded. Silence is not credit.
    for (const p of request.points) {
      if (!seen.has(p.pointCode)) {
        judgements.push({
          pointCode: p.pointCode,
          awarded: false,
          evidence: "This point was not addressed in your answer.",
        });
      }
    }

    return { ok: true, judgements };
  } catch (error) {
    // Never surface a provider message to a student — it can carry request
    // ids, model names and prompt fragments.
    console.error(
      `[claudeMarker] ${request.questionNumber}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { ok: false, error: "Marking is temporarily unavailable for this answer." };
  }
};
