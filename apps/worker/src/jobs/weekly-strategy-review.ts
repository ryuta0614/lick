import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { calculatePostMetrics } from "@social-growth-os/shared";
import { aggregateByDimension, isStrongEnoughForRecommendation, type DimensionStats } from "@social-growth-os/analytics";

export const WeeklyStrategyReviewJobSchema = z.object({
  workspaceId: z.string(),
  periodDays: z.number().int().positive().default(30),
});

/**
 * Aggregates recent post performance by hook type (SQL-equivalent
 * aggregation, no ML needed per CLAUDE.md section 9) and writes a Strategy
 * row. Only dimensions with enough samples produce explainable observations
 * (CLAUDE.md sections 22-23) — this intentionally stays a light MVP version
 * of the weekly review.
 */
export async function runWeeklyStrategyReviewJob(rawData: unknown): Promise<{ strategyId: string }> {
  const data = WeeklyStrategyReviewJobSchema.parse(rawData);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - data.periodDays * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      workspaceId: data.workspaceId,
      status: "PUBLISHED",
      publishedAt: { gte: periodStart, lte: periodEnd },
    },
    include: { idea: true, analytics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  const samples = posts.flatMap((post) => {
    const snapshot = post.analytics[0];
    const hookType = post.idea?.hookType;
    if (!snapshot || !hookType) return [];

    const metrics = calculatePostMetrics({
      impressions: snapshot.impressions,
      likes: snapshot.likes,
      replies: snapshot.replies,
      shares: snapshot.shares,
    });
    if (metrics.engagementRate == null) return [];

    return [{ dimensionValue: hookType, metricValue: metrics.engagementRate }];
  });

  const allStats = aggregateByDimension(samples);
  const trustworthy = allStats.filter(isStrongEnoughForRecommendation).sort((a, b) => b.average - a.average);

  const winningHooks = trustworthy.slice(0, 3);
  const losingHooks = [...trustworthy].reverse().slice(0, 3);
  const observations = trustworthy.map(explainDimension);
  const confidence = allStats.length > 0 ? trustworthy.length / allStats.length : 0;

  const strategy = await prisma.strategy.create({
    data: {
      workspaceId: data.workspaceId,
      periodStart,
      periodEnd,
      winningHooks,
      losingHooks,
      observations,
      confidence,
    },
  });

  return { strategyId: strategy.id };
}

function explainDimension(stats: DimensionStats): string {
  const pct = (stats.average * 100).toFixed(1);
  return `"${stats.dimensionValue}" hooks averaged ${pct}% engagement across ${stats.sampleSize} posts (${stats.confidence} confidence).`;
}
