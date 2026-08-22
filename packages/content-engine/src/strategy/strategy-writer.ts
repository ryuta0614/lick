import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import { StrategyRecommendationSchema, type StrategyRecommendation } from "@social-growth-os/ai";
import type { PersonaBrief } from "../ideas/idea-generator.js";

export type StrategyPatternSummary = {
  dimension: string;
  value: string;
  metric: string;
  sampleSize: number;
  relativeLift: number | null;
  confidence: string;
};

export type GenerateStrategyRecommendationInput = {
  persona: PersonaBrief;
  periodDays: number;
  totalPostsAnalyzed: number;
  winningPatterns: StrategyPatternSummary[];
  losingPatterns: StrategyPatternSummary[];
  traceId: string;
  model?: string;
};

const DEFAULT_MODEL = "claude-sonnet-4-5";

/**
 * Turns already-aggregated Learning Engine output into recommendedMix /
 * recommendedTimes / experiments. Never receives raw post text — only
 * dimension/value/sampleSize/relativeLift/confidence rows (CLAUDE.md Phase
 * 2.5 STEP 11/12). winningTopics/losingTopics/winningHooks/winningFormats/
 * observations are computed deterministically elsewhere so their
 * sample-size-citing phrasing is guaranteed rather than left to the model —
 * this class only handles the genuinely creative recommendations.
 */
export class StrategyWriter {
  constructor(private readonly provider: AIProvider) {}

  async generateRecommendation(
    input: GenerateStrategyRecommendationInput,
  ): Promise<{ recommendation: StrategyRecommendation; metadata: AICallMetadata }> {
    const result = await this.provider.generateStructured({
      model: input.model ?? DEFAULT_MODEL,
      traceId: input.traceId,
      operation: "generate_strategy",
      promptVersion: "strategy-writer@1",
      temperature: 0.6,
      prompt: buildStrategyPrompt(input),
      schema: StrategyRecommendationSchema,
    });
    const { data: _data, ...metadata } = result;
    return { recommendation: result.data, metadata };
  }
}

function buildStrategyPrompt(input: GenerateStrategyRecommendationInput): string {
  return [
    `Brand niche: ${input.persona.niche}. Audience: ${input.persona.audience}.`,
    `Analysis window: last ${input.periodDays} days, ${input.totalPostsAnalyzed} published posts with analytics.`,
    "This is AGGREGATED performance data only — no raw post text is included. Every pattern below already includes its sample size; never claim a pattern is reliable if its confidence is LOW or INSUFFICIENT_DATA.",
    input.winningPatterns.length
      ? `Winning patterns (outperforming the account baseline):\n${input.winningPatterns.map(describePattern).join("\n")}`
      : "No winning patterns met the confidence bar this period.",
    input.losingPatterns.length
      ? `Losing patterns (underperforming the account baseline):\n${input.losingPatterns.map(describePattern).join("\n")}`
      : "No losing patterns met the confidence bar this period.",
    "Recommend a short content mix (directions to lean into next, each with a weight from 0-1), recommended posting time windows, and at most 3 experiment ideas (single-variable A/B tests) worth trying next.",
    "Ground every rationale in the sample sizes and lifts given above. Do not invent patterns that weren't listed. Do not state anything as certain when its confidence is LOW or INSUFFICIENT_DATA — say so explicitly instead.",
    'Return JSON: { "recommendedMix": [{ "label", "weight", "rationale" }], "recommendedTimes": [{ "window", "rationale" }], "experiments": [{ "hypothesis", "variable", "control", "variant" }] }',
  ].join("\n");
}

function describePattern(pattern: StrategyPatternSummary): string {
  const liftPct =
    pattern.relativeLift != null
      ? `${pattern.relativeLift >= 0 ? "+" : ""}${Math.round(pattern.relativeLift * 100)}%`
      : "n/a";
  return `- ${pattern.dimension}="${pattern.value}": ${liftPct} ${pattern.metric} vs baseline, sampleSize=${pattern.sampleSize}, confidence=${pattern.confidence}`;
}
