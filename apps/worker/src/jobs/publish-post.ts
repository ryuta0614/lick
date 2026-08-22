import { z } from "zod";
import { UnrecoverableError } from "bullmq";
import { Prisma, type PostStatus } from "@prisma/client";
import { prisma } from "@social-growth-os/database";
import { assertPostTransition, isRetryableError, PlatformAuthError, PublishError } from "@social-growth-os/shared";
import { getPlatformAdapter, markCredentialNeedsReconnect } from "../platform-adapters.js";
import { getQueues, getAnalyticsCollectionDelaysMs, JOB_NAMES } from "../queues.js";
import { finishJobExecution, startJobExecution } from "../job-execution.js";

export const PublishPostJobSchema = z.object({
  postId: z.string(),
});
export type PublishPostJobData = z.infer<typeof PublishPostJobSchema>;

/** Optional BullMQ attempt metadata — used to decide whether a retryable failure should go back to QUEUED. */
export type PublishJobMeta = {
  attemptsMade: number;
  maxAttempts: number;
  externalJobId?: string;
};

const PRISMA_UNIQUE_CONSTRAINT_ERROR = "P2002";

/**
 * (APPROVED|SCHEDULED|FAILED) -> QUEUED -> PUBLISHING -> PUBLISHED/FAILED via
 * the platform adapter (CLAUDE.md section 17).
 *
 * Duplicate-publish safety (CLAUDE.md STEP 9): beyond the DB's unique
 * (socialAccountId, contentHash) constraint, this also guards the window
 * where a worker crashes *between* a successful remote publish call and the
 * DB write that records it. If this job resumes and finds the post already
 * in PUBLISHING:
 *   - externalId is set  -> the previous attempt's remote call already
 *     succeeded and was recorded; just finish the transition, no new call.
 *   - externalId is null -> ambiguous (we don't know if the previous
 *     attempt's remote call reached Threads or not). Threads has no
 *     documented idempotency key we could have used to make this safe, so
 *     rather than invent one, this fails loudly and requires a human to
 *     verify before retrying (UnrecoverableError — BullMQ will not retry).
 */
export async function runPublishPostJob(rawData: unknown, jobMeta?: PublishJobMeta): Promise<{ status: string }> {
  const executionId = await startJobExecution({
    queue: "content-publishing",
    jobName: "publish-post",
    externalJobId: jobMeta?.externalJobId,
    attempts: (jobMeta?.attemptsMade ?? 0) + 1,
  });

  try {
    const result = await publishPostCore(rawData, jobMeta);
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

async function publishPostCore(rawData: unknown, jobMeta?: PublishJobMeta): Promise<{ status: string }> {
  const data = PublishPostJobSchema.parse(rawData);
  const post = await prisma.post.findUniqueOrThrow({ where: { id: data.postId } });

  if (post.status === "PUBLISHED") {
    return { status: post.status };
  }

  if (post.status === "PUBLISHING") {
    if (post.externalId) {
      const updated = await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHED" } });
      await scheduleAnalyticsCollection(updated.id);
      return { status: updated.status };
    }

    const message =
      "Publish was interrupted after a previous attempt in an unknown state (the request may or may not have reached Threads). Manual verification is required before retrying.";
    await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: message } });
    throw new UnrecoverableError(message);
  }

  let status: PostStatus = post.status;
  if (status === "APPROVED" || status === "SCHEDULED" || status === "FAILED") {
    assertPostTransition(status, "QUEUED");
    await prisma.post.update({ where: { id: post.id }, data: { status: "QUEUED" } });
    status = "QUEUED";
  }

  assertPostTransition(status, "PUBLISHING");
  await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

  const account = await prisma.socialAccount.findUniqueOrThrow({
    where: { id: post.socialAccountId },
    include: { credential: true },
  });

  try {
    const adapter = getPlatformAdapter(account);
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

    if (!published.dryRun) {
      await scheduleAnalyticsCollection(updated.id);
    }
    return { status: updated.status };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
      // Another attempt already published this exact (account, text) pair — not a failure, just a duplicate no-op.
      await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHED" } });
      return { status: "PUBLISHED" };
    }

    if (error instanceof PlatformAuthError) {
      await markCredentialNeedsReconnect(account.id);
    }

    const message = error instanceof Error ? error.message : "Unknown publish error";
    const retryable = isRetryableError(error);
    const attemptsRemain = jobMeta ? jobMeta.attemptsMade + 1 < jobMeta.maxAttempts : false;

    if (retryable && attemptsRemain) {
      // Leave a trail (FAILED with the reason) but land back on QUEUED so the next BullMQ attempt proceeds normally.
      await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: message } });
      await prisma.post.update({ where: { id: post.id }, data: { status: "QUEUED" } });
      throw new PublishError(message, error);
    }

    await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: message } });
    if (!retryable) {
      throw new UnrecoverableError(message);
    }
    throw new PublishError(message, error);
  }
}

async function scheduleAnalyticsCollection(postId: string): Promise<void> {
  const queues = getQueues();
  for (const delayMs of getAnalyticsCollectionDelaysMs()) {
    await queues.analyticsCollection.add(JOB_NAMES.collectPostAnalytics, { postId }, { delay: delayMs });
  }
}
