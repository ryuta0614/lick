import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import { PostCritiqueSchema, type PostCritique } from "@social-growth-os/ai";
import type { Platform } from "@social-growth-os/shared";
import type { PersonaBrief } from "../ideas/idea-generator.js";
import { calculateQualityScore, decideFromQualityScore, type CriticDecision, type CriticWeights } from "./scoring.js";

export type CritiquePostInput = {
  text: string;
  platform: Platform;
  persona: PersonaBrief;
  traceId: string;
  model?: string;
  weights?: CriticWeights;
};

export type CritiqueResult = {
  critique: PostCritique;
  qualityScore: number;
  decision: CriticDecision;
  metadata: AICallMetadata;
};

const DEFAULT_MODEL = "claude-sonnet-4-5";

/** Critic: scores every candidate 0-10 per dimension and gates approval (CLAUDE.md section 14). */
export class PostCritic {
  constructor(private readonly provider: AIProvider) {}

  async critique(input: CritiquePostInput): Promise<CritiqueResult> {
    const result = await this.provider.generateStructured({
      model: input.model ?? DEFAULT_MODEL,
      traceId: input.traceId,
      operation: "critique_post",
      promptVersion: "post-critic@1",
      temperature: 0.3,
      prompt: buildCriticPrompt(input),
      schema: PostCritiqueSchema,
    });

    const qualityScore = calculateQualityScore(result.data, input.weights);
    const { data: _data, ...metadata } = result;
    return { critique: result.data, qualityScore, decision: decideFromQualityScore(qualityScore), metadata };
  }
}

function buildCriticPrompt(input: CritiquePostInput): string {
  return [
    `You are a strict editorial critic for a "${input.persona.niche}" brand targeting: ${input.persona.audience}.`,
    input.persona.avoid?.length ? `Flag any use of: ${input.persona.avoid.join(", ")} as high risk.` : undefined,
    `Platform: ${input.platform}.`,
    `Evaluate this candidate post:\n"""\n${input.text}\n"""`,
    "Score each dimension 0-10 (risk: higher = worse, e.g. fabricated claims, policy violations, brand mismatch).",
    'Return JSON: { "hook", "originality", "usefulness", "clarity", "shareability", "audienceFit", "specificity", "conversionPotential", "brandFit", "risk", "strengths": [], "weaknesses": [], "suggestedChanges": [], "qualityScore" }',
  ]
    .filter(Boolean)
    .join("\n");
}
