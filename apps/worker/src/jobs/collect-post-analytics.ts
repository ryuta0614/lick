import { z } from "zod";
import { UnrecoverableError } from "bullmq";
import { prisma } from "@social-growth-os/database";
import { isRetryableError, PlatformAuthError, PlatformUnsupportedOperationError } from "@social-growth-os/shared";
import { getPlatformAdapter, markCredentialNeedsReconnect } from "../platform-adapters.js";
import { finishJobExecution, startJobExecution } from "../job-execution.js";

export const CollectPostAnalyticsJobSchema = z.object({
  postId: z.string(),
});

export type AnalyticsJobMeta = {
  externalJobId?: string;
  attemptsMade?: number;
};

/**
 * Fetches normalized metrics from the platform adapter and stores them as a
 * new snapshot (never overwrites previous ones) so performance can be
 * analyzed as a time series (CLAUDE.md section 19).
 */
export async function runCollectPostAnalyticsJob(rawData: unknown, jobMeta?: AnalyticsJobMeta): Promise<{ snapshotId: string }> {
  const executionId = await startJobExecution({
    queue: "analytics-collection",
    jobName: "collect-post-analytics",
    externalJobId: jobMeta?.externalJobId,
    attempts: (jobMeta?.attemptsMade ?? 0) + 1,
  });

  try {
    const result = await collectPostAnalyticsCore(rawData);
    await finishJobExecution(executionId, { status: "succeeded" });
    return result;
  } catch (error) {
    await finishJobExecution(executionId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function collectPostAnalyticsCore(rawData: unknown): Promise<{ snapshotId: string }> {
  const data = CollectPostAnalyticsJobSchema.parse(rawData);
  const post = await prisma.post.findUniqueOrThrow({ where: { id: data.postId } });

  if (!post.externalId || post.status !== "PUBLISHED") {
    throw new UnrecoverableError(`Post ${post.id} is not published yet; cannot collect analytics`);
  }

  const account = await prisma.socialAccount.findUniqueOrThrow({
    where: { id: post.socialAccountId },
    include: { credential: true },
  });

  let metrics;
  try {
    const adapter = getPlatformAdapter(account);
    metrics = await adapter.getPostMetrics(post.socialAccountId, post.externalId);
  } catch (error) {
    if (error instanceof PlatformAuthError) {
      await markCredentialNeedsReconnect(account.id);
    }
    if (error instanceof PlatformUnsupportedOperationError) {
      // e.g. a dry-run post with no real Threads media id — nothing to collect, not a failure worth retrying.
      throw new UnrecoverableError(error.message);
    }
    const message = error instanceof Error ? error.message : "Unknown analytics collection error";
    if (!isRetryableError(error)) {
      throw new UnrecoverableError(message);
    }
    throw error;
  }

  const snapshot = await prisma.postAnalyticsSnapshot.create({
    data: {
      postId: post.id,
      impressions: metrics.impressions ?? null,
      likes: metrics.likes ?? null,
      replies: metrics.replies ?? null,
      shares: metrics.shares ?? null,
      saves: metrics.saves ?? null,
      profileVisits: metrics.profileVisits ?? null,
      linkClicks: metrics.linkClicks ?? null,
    },
  });

  return { snapshotId: snapshot.id };
}
