import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { calculatePostMetrics } from "@social-growth-os/shared";
import {
  analyzeAccountPerformance,
  explainLosingPattern,
  explainWinningPattern,
  extractPostFeatures,
  isStrongEnoughForRecommendation,
  type AccountPerformanceAnalysis,
  type PublishedPostRecord,
  type WinningPattern,
} from "@social-growth-os/analytics";
import { StrategyWriter, type PersonaBrief, type StrategyPatternSummary } from "@social-growth-os/content-engine";
import { getAIProvider } from "../ai-provider.js";
import { recordAIExecution } from "../record-ai-execution.js";

export const WeeklyStrategyReviewJobSchema = z.object({
  workspaceId: z.string(),
  periodDays: z.number().int().positive().default(30),
});
export type WeeklyStrategyReviewJobData = z.infer<typeof WeeklyStrategyReviewJobSchema>;

const RECENT_WINDOW_DAYS = 7;
const NOT_ENOUGH_DATA_OBSERVATION = "Not enough performance data yet.";
const MAX_PATTERNS_PER_LIST = 5;

/**
 * Weekly review over this workspace's published-post performance (CLAUDE.md
 * sections 22-23, Phase 2.5 STEP 11/12), analyzing both the full period
 * (default 30 days) and the last 7 days.
 *
 * winningTopics/losingTopics/winningHooks/winningFormats/observations are
 * computed deterministically from the Learning Engine's aggregated output —
 * never hallucinated by an AI call, which guarantees their sample-size-citing
 * phrasing (CLAUDE.md section 23) by construction. Only recommendedMix/
 * recommendedTimes/experiments go through the AI, fed exclusively aggregated
 * pattern rows (dimension/value/sampleSize/relativeLift/confidence — never
 * raw post text). When there isn't enough data yet, the AI call is skipped
 * entirely and a minimal "Not enough performance data yet" Strategy row is
 * written instead so the AI can never invent a fictional winning pattern
 * (CLAUDE.md Phase 2.5 STEP 16).
 */
export async function runWeeklyStrategyReviewJob(rawData: unknown): Promise<{ strategyId: string }> {
  const data = WeeklyStrategyReviewJobSchema.parse(rawData);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - data.periodDays * 24 * 60 * 60 * 1000);
  const recentStart = new Date(periodEnd.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      workspaceId: data.workspaceId,
      status: "PUBLISHED",
      publishedAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      idea: { select: { topic: true, hookType: true, emotion: true, contentType: true } },
      variants: { select: { selected: true, hookType: true } },
      analytics: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });

  const toRecord = (post: (typeof posts)[number]): PublishedPostRecord => {
    const snapshot = post.analytics[0];
    const features = extractPostFeatures({
      id: post.id,
      platform: post.platform,
      text: post.text,
      cta: post.cta,
      publishedAt: post.publishedAt,
      idea: post.idea,
      variants: post.variants,
    });
    const metrics = calculatePostMetrics({
      impressions: snapshot?.impressions,
      likes: snapshot?.likes,
      replies: snapshot?.replies,
      shares: snapshot?.shares,
      linkClicks: snapshot?.linkClicks,
      followersGained: snapshot?.followersGained,
    });
    return { ...features, metrics };
  };

  const records = posts.map(toRecord);
  const recentRecords = posts
    .filter((post) => post.publishedAt != null && post.publishedAt >= recentStart)
    .map(toRecord);

  const periodAnalysis = analyzeAccountPerformance(records);
  const recentAnalysis = analyzeAccountPerformance(recentRecords);

  if (periodAnalysis.coldStart) {
    const strategy = await prisma.strategy.create({
      data: {
        workspaceId: data.workspaceId,
        periodStart,
        periodEnd,
        observations: [NOT_ENOUGH_DATA_OBSERVATION],
        confidence: 0,
      },
    });
    return { strategyId: strategy.id };
  }

  const winningTopics = valuesForDimension(periodAnalysis.winningPatterns, "topic");
  const losingTopics = valuesForDimension(periodAnalysis.losingPatterns, "topic");
  const winningHooks = valuesForDimension(periodAnalysis.winningPatterns, "hookType");
  const losingHooks = valuesForDimension(periodAnalysis.losingPatterns, "hookType");
  const winningFormats = valuesForDimension(periodAnalysis.winningPatterns, "contentType");

  const observations = [
    ...periodAnalysis.winningPatterns.slice(0, 3).map(explainWinningPattern),
    ...periodAnalysis.losingPatterns.slice(0, 2).map(explainLosingPattern),
    ...(recentAnalysis.coldStart
      ? []
      : recentAnalysis.winningPatterns
          .slice(0, 2)
          .map((p) => `Last ${RECENT_WINDOW_DAYS} days: ${explainWinningPattern(p)}`)),
  ];

  const persona = await loadPersonaBrief(data.workspaceId);
  const provider = getAIProvider();
  const strategyWriter = new StrategyWriter(provider);
  const traceId = randomUUID();

  const { recommendation, metadata } = await strategyWriter.generateRecommendation({
    persona,
    periodDays: data.periodDays,
    totalPostsAnalyzed: periodAnalysis.totalPostsAnalyzed,
    winningPatterns: periodAnalysis.winningPatterns.map(toPatternSummary),
    losingPatterns: periodAnalysis.losingPatterns.map(toPatternSummary),
    traceId,
  });
  await recordAIExecution(data.workspaceId, metadata, { success: true });

  const strategy = await prisma.strategy.create({
    data: {
      workspaceId: data.workspaceId,
      periodStart,
      periodEnd,
      winningTopics,
      losingTopics,
      winningHooks,
      losingHooks,
      winningFormats,
      recommendedMix: recommendation.recommendedMix,
      recommendedTimes: recommendation.recommendedTimes,
      experiments: recommendation.experiments,
      observations,
      confidence: computeOverallConfidence(periodAnalysis),
    },
  });

  return { strategyId: strategy.id };
}

function valuesForDimension(patterns: WinningPattern[], dimension: WinningPattern["dimension"]): string[] {
  return patterns
    .filter((p) => p.dimension === dimension)
    .slice(0, MAX_PATTERNS_PER_LIST)
    .map((p) => p.value);
}

function toPatternSummary(pattern: WinningPattern): StrategyPatternSummary {
  return {
    dimension: pattern.dimension,
    value: pattern.value,
    metric: pattern.metric,
    sampleSize: pattern.sampleSize,
    relativeLift: pattern.relativeLift,
    confidence: pattern.confidence,
  };
}

/** Fraction of analyzed dimension buckets that cleared the confidence bar — a rough overall-reliability signal for this Strategy row. */
function computeOverallConfidence(analysis: AccountPerformanceAnalysis): number {
  const allStats = Object.values(analysis.dimensions).flatMap((stats) => stats ?? []);
  if (allStats.length === 0) return 0;
  const trustworthy = allStats.filter(isStrongEnoughForRecommendation);
  return trustworthy.length / allStats.length;
}

async function loadPersonaBrief(workspaceId: string): Promise<PersonaBrief> {
  const persona = await prisma.brandPersona.findFirst({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  if (!persona) {
    return { niche: "general", audience: "general audience", tone: [] };
  }
  return {
    niche: persona.niche,
    audience: persona.audience,
    tone: Array.isArray(persona.tone) ? (persona.tone as string[]) : [],
    avoid: Array.isArray(persona.avoid) ? (persona.avoid as string[]) : undefined,
  };
}
