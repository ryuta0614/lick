import type { PostMetricsResult } from "@social-growth-os/shared";
import {
  aggregateByDimension,
  compareToBaseline,
  isStrongEnoughForRecommendation,
  type ConfidenceLevel,
  type ConfidenceThresholds,
  type DimensionStatsWithBaseline,
} from "../reports/learning-engine.js";
import type { PublishedPostFeatures } from "./feature-extraction.js";

export const LEARNING_DIMENSIONS = [
  "topic",
  "hookType",
  "contentType",
  "emotion",
  "cta",
  "lengthBucket",
  "weekday",
  "postingHour",
  "platform",
] as const;
export type LearningDimension = (typeof LEARNING_DIMENSIONS)[number];

export type PublishedPostRecord = PublishedPostFeatures & {
  metrics: PostMetricsResult;
};

export type WinningPattern = {
  dimension: LearningDimension;
  value: string;
  metric: keyof PostMetricsResult;
  sampleSize: number;
  median: number;
  accountMedian: number;
  relativeLift: number | null;
  confidence: ConfidenceLevel;
};

export type AccountPerformanceAnalysis = {
  metric: keyof PostMetricsResult;
  /** Posts that actually had a non-null value for `metric` — the denominator behind every stat below. */
  totalPostsAnalyzed: number;
  dimensions: Partial<Record<LearningDimension, DimensionStatsWithBaseline[]>>;
  winningPatterns: WinningPattern[];
  losingPatterns: WinningPattern[];
  /** True when there isn't enough data yet to say anything reliable (CLAUDE.md Phase 2.5 STEP 16). */
  coldStart: boolean;
};

export type AnalyzeAccountPerformanceOptions = {
  metric?: keyof PostMetricsResult;
  confidenceThresholds?: ConfidenceThresholds;
  /** Below this many measured posts, the whole analysis is flagged coldStart. Default 5. */
  coldStartThreshold?: number;
};

const DEFAULT_COLD_START_THRESHOLD = 5;

/**
 * The Learning Engine's core: groups published, analytics-measured posts by
 * every tracked dimension, compares each bucket against the account-wide
 * baseline, and separates the result into winning/losing patterns
 * (CLAUDE.md Phase 2.5 STEP 5/6/8).
 */
export function analyzeAccountPerformance(
  posts: PublishedPostRecord[],
  options: AnalyzeAccountPerformanceOptions = {},
): AccountPerformanceAnalysis {
  const metric = options.metric ?? "engagementRate";
  const coldStartThreshold = options.coldStartThreshold ?? DEFAULT_COLD_START_THRESHOLD;

  const measured = posts.filter((p) => p.metrics[metric] != null);
  const allValues = measured.map((p) => p.metrics[metric] as number);
  const coldStart = measured.length < coldStartThreshold;

  const dimensions: AccountPerformanceAnalysis["dimensions"] = {};
  for (const dimension of LEARNING_DIMENSIONS) {
    const samples = measured
      .map((post) => ({ value: dimensionValue(post, dimension), metricValue: post.metrics[metric] as number }))
      .filter((s): s is { value: string; metricValue: number } => s.value != null)
      .map((s) => ({ dimensionValue: s.value, metricValue: s.metricValue }));

    if (samples.length === 0) continue;
    const stats = aggregateByDimension(samples, options.confidenceThresholds);
    dimensions[dimension] = compareToBaseline(stats, allValues);
  }

  return {
    metric,
    totalPostsAnalyzed: measured.length,
    dimensions,
    winningPatterns: findWinningPatterns(dimensions, metric),
    losingPatterns: findLosingPatterns(dimensions, metric),
    coldStart,
  };
}

/** Dimension buckets that beat the account baseline, ranked by lift (strongest first). Excludes INSUFFICIENT_DATA. */
export function findWinningPatterns(
  dimensions: AccountPerformanceAnalysis["dimensions"],
  metric: keyof PostMetricsResult,
): WinningPattern[] {
  return collectPatterns(dimensions, metric, (lift) => lift > 0).sort(
    (a, b) => (b.relativeLift ?? 0) - (a.relativeLift ?? 0),
  );
}

/** Dimension buckets that underperform the account baseline, ranked by lift (worst first). Excludes INSUFFICIENT_DATA. */
export function findLosingPatterns(
  dimensions: AccountPerformanceAnalysis["dimensions"],
  metric: keyof PostMetricsResult,
): WinningPattern[] {
  return collectPatterns(dimensions, metric, (lift) => lift < 0).sort(
    (a, b) => (a.relativeLift ?? 0) - (b.relativeLift ?? 0),
  );
}

function collectPatterns(
  dimensions: AccountPerformanceAnalysis["dimensions"],
  metric: keyof PostMetricsResult,
  predicate: (lift: number) => boolean,
): WinningPattern[] {
  const patterns: WinningPattern[] = [];
  for (const dimension of LEARNING_DIMENSIONS) {
    const statsList = dimensions[dimension];
    if (!statsList) continue;
    for (const stats of statsList) {
      if (!isStrongEnoughForRecommendation(stats)) continue;
      if (stats.relativeLift == null || !predicate(stats.relativeLift)) continue;
      patterns.push({
        dimension,
        value: stats.dimensionValue,
        metric,
        sampleSize: stats.sampleSize,
        median: stats.median,
        accountMedian: stats.baselineMedian,
        relativeLift: stats.relativeLift,
        confidence: stats.confidence,
      });
    }
  }
  return patterns;
}

function dimensionValue(post: PublishedPostFeatures, dimension: LearningDimension): string | null {
  switch (dimension) {
    case "topic":
      return post.topic;
    case "hookType":
      return post.hookType;
    case "contentType":
      return post.contentType;
    case "emotion":
      return post.emotion;
    case "cta":
      return post.cta;
    case "lengthBucket":
      return post.lengthBucket;
    case "weekday":
      return post.weekday;
    case "postingHour":
      return post.postingHour != null ? String(post.postingHour) : null;
    case "platform":
      return post.platform;
  }
}
