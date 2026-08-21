import type { AICallMetadata } from "@social-growth-os/ai";
import { prisma } from "@social-growth-os/database";

/** Persists AIExecution metadata for every generation call (CLAUDE.md section 8/31). */
export async function recordAIExecution(
  metadata: AICallMetadata,
  outcome: { success: boolean; errorMessage?: string },
): Promise<void> {
  await prisma.aIExecution.create({
    data: {
      provider: metadata.provider,
      model: metadata.model,
      operation: metadata.operation,
      promptVersion: metadata.promptVersion,
      temperature: metadata.temperature,
      inputTokens: metadata.usage.inputTokens,
      outputTokens: metadata.usage.outputTokens,
      estimatedCost: metadata.estimatedCostUsd,
      traceId: metadata.traceId,
      success: outcome.success,
      errorMessage: outcome.errorMessage,
    },
  });
}
