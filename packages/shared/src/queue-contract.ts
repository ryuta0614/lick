/** Queue names per CLAUDE.md section 18. Shared so apps/web can enqueue jobs without depending on apps/worker. */
export const QUEUE_NAMES = {
  contentGeneration: "content-generation",
  contentPublishing: "content-publishing",
  analyticsCollection: "analytics-collection",
  trendCollection: "trend-collection",
  strategyAnalysis: "strategy-analysis",
} as const;

/** Job names per CLAUDE.md section 18. */
export const JOB_NAMES = {
  generateContent: "generate-content",
  publishPost: "publish-post",
  collectPostAnalytics: "collect-post-analytics",
  collectAccountAnalytics: "collect-account-analytics",
  collectTrends: "collect-trends",
  weeklyStrategyReview: "weekly-strategy-review",
} as const;

/** +1h / +6h / +24h / +72h after publish, per CLAUDE.md section 18. Configurable via env. */
export function getAnalyticsCollectionDelaysMs(env: NodeJS.ProcessEnv = process.env): number[] {
  const raw = env.ANALYTICS_COLLECTION_DELAYS_HOURS;
  const hours = raw ? raw.split(",").map(Number) : [1, 6, 24, 72];
  return hours.map((h) => h * 60 * 60 * 1000);
}
