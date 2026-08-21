import { Worker, type Job } from "bullmq";
import { logger } from "@social-growth-os/shared";
import { getRedisConnection } from "../redis.js";
import { QUEUE_NAMES, JOB_NAMES } from "../queues.js";
import { runGenerateContentJob } from "../jobs/generate-content.js";
import { runPublishPostJob } from "../jobs/publish-post.js";
import { runCollectPostAnalyticsJob } from "../jobs/collect-post-analytics.js";
import { runCollectTrendsJob } from "../jobs/collect-trends.js";
import { runWeeklyStrategyReviewJob } from "../jobs/weekly-strategy-review.js";

function withLogging(queue: string, handler: (job: Job) => Promise<unknown>) {
  return async (job: Job) => {
    logger.info("job.start", { queue, jobName: job.name, jobId: job.id });
    try {
      const result = await handler(job);
      logger.info("job.completed", { queue, jobName: job.name, jobId: job.id });
      return result;
    } catch (error) {
      logger.error("job.failed", {
        queue,
        jobName: job.name,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function startWorkers(): Worker[] {
  const connection = getRedisConnection();

  const contentGenerationWorker = new Worker(
    QUEUE_NAMES.contentGeneration,
    withLogging(QUEUE_NAMES.contentGeneration, async (job) => {
      if (job.name === JOB_NAMES.generateContent) return runGenerateContentJob(job.data);
      throw new Error(`Unknown job "${job.name}" on queue ${QUEUE_NAMES.contentGeneration}`);
    }),
    { connection },
  );

  const contentPublishingWorker = new Worker(
    QUEUE_NAMES.contentPublishing,
    withLogging(QUEUE_NAMES.contentPublishing, async (job) => {
      if (job.name === JOB_NAMES.publishPost) return runPublishPostJob(job.data);
      throw new Error(`Unknown job "${job.name}" on queue ${QUEUE_NAMES.contentPublishing}`);
    }),
    { connection },
  );

  const analyticsCollectionWorker = new Worker(
    QUEUE_NAMES.analyticsCollection,
    withLogging(QUEUE_NAMES.analyticsCollection, async (job) => {
      if (job.name === JOB_NAMES.collectPostAnalytics) return runCollectPostAnalyticsJob(job.data);
      throw new Error(`Unknown job "${job.name}" on queue ${QUEUE_NAMES.analyticsCollection}`);
    }),
    { connection },
  );

  const trendCollectionWorker = new Worker(
    QUEUE_NAMES.trendCollection,
    withLogging(QUEUE_NAMES.trendCollection, async (job) => {
      if (job.name === JOB_NAMES.collectTrends) return runCollectTrendsJob(job.data);
      throw new Error(`Unknown job "${job.name}" on queue ${QUEUE_NAMES.trendCollection}`);
    }),
    { connection },
  );

  const strategyAnalysisWorker = new Worker(
    QUEUE_NAMES.strategyAnalysis,
    withLogging(QUEUE_NAMES.strategyAnalysis, async (job) => {
      if (job.name === JOB_NAMES.weeklyStrategyReview) return runWeeklyStrategyReviewJob(job.data);
      throw new Error(`Unknown job "${job.name}" on queue ${QUEUE_NAMES.strategyAnalysis}`);
    }),
    { connection },
  );

  return [
    contentGenerationWorker,
    contentPublishingWorker,
    analyticsCollectionWorker,
    trendCollectionWorker,
    strategyAnalysisWorker,
  ];
}
