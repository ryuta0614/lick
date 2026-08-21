export type PerformanceWeights = {
  likeRate: number;
  replyRate: number;
  shareRate: number;
  followerConversionRate: number;
  clickRate: number;
  revenueRate: number;
};

/** Defaults from CLAUDE.md section 21. Configurable per account/workspace. */
export const DEFAULT_PERFORMANCE_WEIGHTS: PerformanceWeights = {
  likeRate: 0.1,
  replyRate: 0.15,
  shareRate: 0.2,
  followerConversionRate: 0.15,
  clickRate: 0.15,
  revenueRate: 0.25,
};

export type NormalizedRates = {
  normalizedLikeRate: number;
  normalizedReplyRate: number;
  normalizedShareRate: number;
  normalizedFollowerConversionRate: number;
  normalizedClickRate: number;
  normalizedRevenueRate: number;
};

/** performanceScore = weighted sum of normalized rates (CLAUDE.md section 21). Result is 0-1. */
export function calculatePerformanceScore(
  normalized: NormalizedRates,
  weights: PerformanceWeights = DEFAULT_PERFORMANCE_WEIGHTS,
): number {
  return (
    weights.likeRate * normalized.normalizedLikeRate +
    weights.replyRate * normalized.normalizedReplyRate +
    weights.shareRate * normalized.normalizedShareRate +
    weights.followerConversionRate * normalized.normalizedFollowerConversionRate +
    weights.clickRate * normalized.normalizedClickRate +
    weights.revenueRate * normalized.normalizedRevenueRate
  );
}

/** Min-max normalizes a raw rate against a cohort (e.g. an account's recent posts) into [0, 1]. */
export function normalizeAgainstCohort(value: number, cohort: number[]): number {
  if (cohort.length === 0) return 0.5;
  const min = Math.min(...cohort);
  const max = Math.max(...cohort);
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
