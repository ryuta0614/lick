import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "@social-growth-os/shared";
import { getRedisConnection } from "./redis";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
};

let contentPublishingQueue: Queue | undefined;
let trendCollectionQueue: Queue | undefined;
let strategyAnalysisQueue: Queue | undefined;

function getContentPublishingQueue(): Queue {
  contentPublishingQueue ??= new Queue(QUEUE_NAMES.contentPublishing, { connection: getRedisConnection() });
  return contentPublishingQueue;
}

function getTrendCollectionQueue(): Queue {
  trendCollectionQueue ??= new Queue(QUEUE_NAMES.trendCollection, { connection: getRedisConnection() });
  return trendCollectionQueue;
}

function getStrategyAnalysisQueue(): Queue {
  strategyAnalysisQueue ??= new Queue(QUEUE_NAMES.strategyAnalysis, { connection: getRedisConnection() });
  return strategyAnalysisQueue;
}

/** Schedules (or immediately queues, when delayMs is 0) a publish-post job. Consumed by apps/worker. */
export async function enqueuePublishPost(data: { postId: string }, delayMs = 0): Promise<void> {
  await getContentPublishingQueue().add(JOB_NAMES.publishPost, data, { ...DEFAULT_JOB_OPTIONS, delay: delayMs });
}

export async function enqueueCollectTrends(data: {
  workspaceId: string;
  topics: { title: string; text?: string; url?: string; source?: string }[];
}): Promise<void> {
  await getTrendCollectionQueue().add(JOB_NAMES.collectTrends, data, DEFAULT_JOB_OPTIONS);
}

export async function enqueueWeeklyStrategyReview(data: {
  workspaceId: string;
  socialAccountId?: string;
  periodDays?: number;
}): Promise<void> {
  await getStrategyAnalysisQueue().add(JOB_NAMES.weeklyStrategyReview, data, DEFAULT_JOB_OPTIONS);
}
