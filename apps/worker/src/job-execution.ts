import { prisma } from "@social-growth-os/database";

/**
 * Lightweight attempt-metadata tracking (CLAUDE.md STEP 9 / section 31)
 * using the existing JobExecution model — one row per BullMQ attempt.
 */
export async function startJobExecution(params: {
  queue: string;
  jobName: string;
  externalJobId?: string;
  attempts: number;
}): Promise<string> {
  const record = await prisma.jobExecution.create({
    data: {
      queue: params.queue,
      jobName: params.jobName,
      externalJobId: params.externalJobId,
      status: "started",
      attempts: params.attempts,
      startedAt: new Date(),
    },
  });
  return record.id;
}

export async function finishJobExecution(id: string, outcome: { status: "succeeded" | "failed"; errorMessage?: string }): Promise<void> {
  await prisma.jobExecution.update({
    where: { id },
    data: { status: outcome.status, errorMessage: outcome.errorMessage, finishedAt: new Date() },
  });
}
