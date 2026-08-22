import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@social-growth-os/database";
import { runWeeklyStrategyReviewJob } from "../weekly-strategy-review.js";

/**
 * Real-DB integration test (CLAUDE.md STEP 18) for the weekly Strategy job.
 * Uses MockAIProvider throughout (no ANTHROPIC_API_KEY/OPENAI_API_KEY set in
 * this environment) — the AI is never called with raw post text, and is
 * skipped entirely on cold start (CLAUDE.md Phase 2.5 STEP 11/12/16).
 */
describe("runWeeklyStrategyReviewJob (real DB, mock AI provider)", () => {
  let workspaceId: string;
  let socialAccountId: string;

  beforeEach(async () => {
    const workspace = await prisma.workspace.create({ data: { name: `strategy-test-${randomUUID()}` } });
    workspaceId = workspace.id;

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: "THREADS",
        externalId: `threads_user_${randomUUID()}`,
        username: "strategy_test_user",
        approvalMode: "MANUAL",
        active: true,
      },
    });
    socialAccountId = account.id;
  });

  afterEach(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  async function createPublishedPost(opts: {
    hookType: string;
    topic: string;
    impressions: number;
    likes: number;
    publishedAt: Date;
  }) {
    const idea = await prisma.contentIdea.create({
      data: {
        workspaceId,
        title: `${opts.topic} idea`,
        topic: opts.topic,
        angle: "angle",
        hookType: opts.hookType,
        emotion: "curiosity",
        contentType: "text",
      },
    });
    const post = await prisma.post.create({
      data: {
        workspaceId,
        socialAccountId,
        ideaId: idea.id,
        platform: "THREADS",
        status: "PUBLISHED",
        text: `Post about ${opts.topic}`,
        cta: "reply",
        contentHash: `hash_${randomUUID()}`,
        publishedAt: opts.publishedAt,
        externalId: `ext_${randomUUID()}`,
      },
    });
    await prisma.postVariant.create({
      data: { postId: post.id, text: post.text ?? "", hookType: opts.hookType, selected: true },
    });
    await prisma.postAnalyticsSnapshot.create({
      data: {
        postId: post.id,
        impressions: opts.impressions,
        likes: opts.likes,
      },
    });
    return post;
  }

  it("skips the AI call entirely and writes a minimal 'Not enough performance data yet' row on cold start", async () => {
    // Only 2 published+measured posts — well under the default cold-start threshold of 5.
    await createPublishedPost({ hookType: "story", topic: "topic a", impressions: 100, likes: 5, publishedAt: new Date() });
    await createPublishedPost({ hookType: "story", topic: "topic a", impressions: 100, likes: 5, publishedAt: new Date() });

    // AIExecution rows aren't workspace-scoped, so compare a before/after
    // delta rather than an absolute count (robust to rows left by other tests).
    const executionsBefore = await prisma.aIExecution.count({ where: { operation: "generate_strategy" } });

    const result = await runWeeklyStrategyReviewJob({ workspaceId });
    const strategy = await prisma.strategy.findUniqueOrThrow({ where: { id: result.strategyId } });

    expect(strategy.observations).toEqual(["Not enough performance data yet."]);
    expect(strategy.confidence).toBe(0);
    expect(strategy.winningHooks).toBeNull();
    expect(strategy.recommendedMix).toBeNull();

    const executionsAfter = await prisma.aIExecution.count({ where: { operation: "generate_strategy" } });
    expect(executionsAfter - executionsBefore).toBe(0);
  });

  it("derives evidence-based, sample-size-citing observations and AI-generated recommendations once there is enough data", async () => {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    // 14 high-engagement "story" posts vs 14 low-engagement "question" posts,
    // spread across the 30-day window (well past both the cold-start floor
    // and the MEDIUM-confidence threshold of 10).
    for (let i = 0; i < 14; i++) {
      await createPublishedPost({
        hookType: "story",
        topic: "ai productivity",
        impressions: 1000,
        likes: 100,
        publishedAt: daysAgo(2 + i),
      });
    }
    for (let i = 0; i < 14; i++) {
      await createPublishedPost({
        hookType: "question",
        topic: "ai productivity",
        impressions: 1000,
        likes: 10,
        publishedAt: daysAgo(2 + i),
      });
    }

    const executionsBefore = await prisma.aIExecution.count({ where: { operation: "generate_strategy" } });

    const result = await runWeeklyStrategyReviewJob({ workspaceId });
    const strategy = await prisma.strategy.findUniqueOrThrow({ where: { id: result.strategyId } });

    expect(strategy.winningHooks).toEqual(["story"]);
    expect(strategy.losingHooks).toEqual(["question"]);
    expect(strategy.confidence).toBeGreaterThan(0);

    const observations = strategy.observations as string[];
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.some((o) => o.includes("story") && o.includes("14 posts"))).toBe(true);

    // recommendedMix/recommendedTimes/experiments come from the (mocked) AI call.
    expect(strategy.recommendedMix).not.toBeNull();
    expect(strategy.recommendedTimes).not.toBeNull();
    expect(strategy.experiments).not.toBeNull();

    const executionsAfter = await prisma.aIExecution.count({ where: { operation: "generate_strategy" } });
    expect(executionsAfter - executionsBefore).toBe(1);
  });
});
