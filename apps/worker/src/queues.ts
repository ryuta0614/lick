import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES, getAnalyticsCollectionDelaysMs } from "@social-growth-os/shared";
import { getRedisConnection } from "./redis.js";

export { QUEUE_NAMES, JOB_NAMES, getAnalyticsCollectionDelaysMs };

let queues: {
  contentGeneration: Queue;
  contentPublishing: Queue;
  analyticsCollection: Queue;
  trendCollection: Queue;
  strategyAnalysis: Queue;
} | undefined;

export function getQueues() {
  if (!queues) {
    const connection = getRedisConnection();
    queues = {
      contentGeneration: new Queue(QUEUE_NAMES.contentGeneration, { connection }),
      contentPublishing: new Queue(QUEUE_NAMES.contentPublishing, { connection }),
      analyticsCollection: new Queue(QUEUE_NAMES.analyticsCollection, { connection }),
      trendCollection: new Queue(QUEUE_NAMES.trendCollection, { connection }),
      strategyAnalysis: new Queue(QUEUE_NAMES.strategyAnalysis, { connection }),
    };
  }
  return queues;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 },
  removeOnFail: { age: 60 * 60 * 24 * 30 },
};

export async function enqueueGenerateContent(data: {
  workspaceId: string;
  socialAccountId: string;
  personaId: string;
  topic: string;
}) {
  return getQueues().contentGeneration.add(JOB_NAMES.generateContent, data, DEFAULT_JOB_OPTIONS);
}

export async function enqueuePublishPost(data: { postId: string }) {
  return getQueues().contentPublishing.add(JOB_NAMES.publishPost, data, DEFAULT_JOB_OPTIONS);
}

export async function enqueueCollectTrends(data: {
  workspaceId: string;
  topics: { title: string; text?: string; url?: string; source?: string }[];
}) {
  return getQueues().trendCollection.add(JOB_NAMES.collectTrends, data, DEFAULT_JOB_OPTIONS);
}

export async function enqueueWeeklyStrategyReview(data: { workspaceId: string; periodDays?: number }) {
  return getQueues().strategyAnalysis.add(JOB_NAMES.weeklyStrategyReview, data, DEFAULT_JOB_OPTIONS);
}
