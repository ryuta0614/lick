import { z } from "zod";
import { Prisma, type PostStatus } from "@prisma/client";
import { prisma } from "@social-growth-os/database";
import { assertPostTransition, PublishError } from "@social-growth-os/shared";
import { getPlatformAdapters } from "../platform-adapters.js";
import { getQueues, getAnalyticsCollectionDelaysMs, JOB_NAMES } from "../queues.js";

export const PublishPostJobSchema = z.object({
  postId: z.string(),
});
export type PublishPostJobData = z.infer<typeof PublishPostJobSchema>;

const PRISMA_UNIQUE_CONSTRAINT_ERROR = "P2002";

/**
 * (APPROVED|SCHEDULED) -> QUEUED -> PUBLISHING -> PUBLISHED/FAILED via the
 * platform adapter (CLAUDE.md section 17). Idempotent: the DB's unique
 * (socialAccountId, contentHash) constraint means a duplicate publish
 * attempt for the same text never creates a second live post.
 */
export async function runPublishPostJob(rawData: unknown): Promise<{ status: string }> {
  const data = PublishPostJobSchema.parse(rawData);
  const post = await prisma.post.findUniqueOrThrow({ where: { id: data.postId } });

  if (post.status === "PUBLISHED") {
    return { status: post.status };
  }

  let status: PostStatus = post.status;
  if (status === "APPROVED" || status === "SCHEDULED") {
    assertPostTransition(status, "QUEUED");
    await prisma.post.update({ where: { id: post.id }, data: { status: "QUEUED" } });
    status = "QUEUED";
  }

  assertPostTransition(status, "PUBLISHING");
  await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

  const adapter = getPlatformAdapters()[post.platform];

  try {
    const published = await adapter.publishPost(post.socialAccountId, { text: post.text ?? undefined });

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        externalId: published.externalId,
        externalUrl: published.url,
        publishedAt: published.publishedAt,
      },
    });

    await scheduleAnalyticsCollection(updated.id);
    return { status: updated.status };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
      // Another attempt already published this exact (account, text) pair — not a failure, just a duplicate no-op.
      await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHED" } });
      return { status: "PUBLISHED" };
    }

    const message = error instanceof Error ? error.message : "Unknown publish error";
    await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: message } });
    throw new PublishError(`Failed to publish post ${post.id}: ${message}`, error);
  }
}

async function scheduleAnalyticsCollection(postId: string): Promise<void> {
  const queues = getQueues();
  for (const delayMs of getAnalyticsCollectionDelaysMs()) {
    await queues.analyticsCollection.add(JOB_NAMES.collectPostAnalytics, { postId }, { delay: delayMs });
  }
}
