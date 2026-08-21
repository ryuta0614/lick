import { z } from "zod";
import { prisma } from "@social-growth-os/database";
import { getPlatformAdapters } from "../platform-adapters.js";

export const CollectPostAnalyticsJobSchema = z.object({
  postId: z.string(),
});

/**
 * Fetches normalized metrics from the platform adapter and stores them as a
 * new snapshot (never overwrites previous ones) so performance can be
 * analyzed as a time series (CLAUDE.md section 19).
 */
export async function runCollectPostAnalyticsJob(rawData: unknown): Promise<{ snapshotId: string }> {
  const data = CollectPostAnalyticsJobSchema.parse(rawData);
  const post = await prisma.post.findUniqueOrThrow({ where: { id: data.postId } });

  if (!post.externalId || post.status !== "PUBLISHED") {
    throw new Error(`Post ${post.id} is not published yet; cannot collect analytics`);
  }

  const adapter = getPlatformAdapters()[post.platform];
  const metrics = await adapter.getPostMetrics(post.socialAccountId, post.externalId);

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
