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
    socialAccountId?: string;
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
        socialAccountId: opts.socialAccountId ?? socialAccountId,
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

    const result = await runWeeklyStrategyReviewJob({ workspaceId });
    const strategy = await prisma.strategy.findUniqueOrThrow({ where: { id: result.strategyId } });

    expect(strategy.observations).toEqual(["Not enough performance data yet."]);
    expect(strategy.confidence).toBe(0);
    expect(strategy.winningHooks).toBeNull();
    expect(strategy.recommendedMix).toBeNull();

    const executions = await prisma.aIExecution.findMany({ where: { workspaceId, operation: "generate_strategy" } });
    expect(executions).toHaveLength(0);
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

    const executions = await prisma.aIExecution.findMany({ where: { workspaceId, operation: "generate_strategy" } });
    expect(executions).toHaveLength(1);
  });

  it("scopes the review to one account when socialAccountId is given, and keeps a workspace-wide review separate", async () => {
    const secondAccount = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: "THREADS",
        externalId: `threads_user_${randomUUID()}`,
        username: "strategy_test_user_2",
        approvalMode: "MANUAL",
        active: true,
      },
    });

    // Account A: 6 posts (past cold start). Account B: only 2 posts (cold start).
    for (let i = 0; i < 6; i++) {
      await createPublishedPost({ hookType: "story", topic: "topic a", impressions: 100, likes: 10, publishedAt: new Date() });
    }
    await createPublishedPost({
      hookType: "story",
      topic: "topic b",
      impressions: 100,
      likes: 10,
      publishedAt: new Date(),
      socialAccountId: secondAccount.id,
    });
    await createPublishedPost({
      hookType: "story",
      topic: "topic b",
      impressions: 100,
      likes: 10,
      publishedAt: new Date(),
      socialAccountId: secondAccount.id,
    });

    const accountAResult = await runWeeklyStrategyReviewJob({ workspaceId, socialAccountId });
    const accountAStrategy = await prisma.strategy.findUniqueOrThrow({ where: { id: accountAResult.strategyId } });
    expect(accountAStrategy.socialAccountId).toBe(socialAccountId);
    expect(accountAStrategy.observations).not.toEqual(["Not enough performance data yet."]);

    const accountBResult = await runWeeklyStrategyReviewJob({ workspaceId, socialAccountId: secondAccount.id });
    const accountBStrategy = await prisma.strategy.findUniqueOrThrow({ where: { id: accountBResult.strategyId } });
    expect(accountBStrategy.socialAccountId).toBe(secondAccount.id);
    expect(accountBStrategy.observations).toEqual(["Not enough performance data yet."]);

    // A workspace-wide review (no socialAccountId) pools both accounts' 8 posts together.
    const workspaceWideResult = await runWeeklyStrategyReviewJob({ workspaceId });
    const workspaceWideStrategy = await prisma.strategy.findUniqueOrThrow({ where: { id: workspaceWideResult.strategyId } });
    expect(workspaceWideStrategy.socialAccountId).toBeNull();
  });
});
