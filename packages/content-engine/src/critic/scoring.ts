import type { PostCritique } from "@social-growth-os/ai";

export type PositiveDimension =
  | "hook"
  | "originality"
  | "usefulness"
  | "clarity"
  | "shareability"
  | "audienceFit"
  | "specificity"
  | "conversionPotential"
  | "brandFit";

export type CriticWeights = {
  /** Weights over the 9 positive dimensions; should sum to 1. */
  positive: Record<PositiveDimension, number>;
  /** Points deducted from the 0-100 score per point of risk (0-10). */
  riskPenaltyPerPoint: number;
};

export const DEFAULT_CRITIC_WEIGHTS: CriticWeights = {
  positive: {
    hook: 0.15,
    originality: 0.1,
    usefulness: 0.15,
    clarity: 0.1,
    shareability: 0.1,
    audienceFit: 0.1,
    specificity: 0.1,
    conversionPotential: 0.1,
    brandFit: 0.1,
  },
  riskPenaltyPerPoint: 3,
};

/**
 * qualityScore = weighted positive scores - risk penalty (CLAUDE.md section
 * 14). We recompute this deterministically from the model's per-dimension
 * scores rather than trusting a self-reported qualityScore field, so the
 * approval thresholds stay consistent even if the model's own arithmetic is
 * off.
 */
export function calculateQualityScore(
  critique: Pick<PostCritique, PositiveDimension | "risk">,
  weights: CriticWeights = DEFAULT_CRITIC_WEIGHTS,
): number {
  const weightedPositive = (Object.entries(weights.positive) as [PositiveDimension, number][]).reduce(
    (sum, [dimension, weight]) => sum + critique[dimension] * weight,
    0,
  );
  const scaledPositive = weightedPositive * 10; // dimensions are 0-10 -> scale weighted avg to 0-100
  const riskPenalty = critique.risk * weights.riskPenaltyPerPoint;
  const score = clamp(scaledPositive - riskPenalty, 0, 100);
  return Math.round(score * 100) / 100; // avoid float dust like 79.99999999999999
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type CriticDecision = "approve" | "rewrite" | "reject";

export function decideFromQualityScore(qualityScore: number): CriticDecision {
  if (qualityScore >= 80) return "approve";
  if (qualityScore >= 65) return "rewrite";
  return "reject";
}
