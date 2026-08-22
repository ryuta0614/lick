import type { AICallMetadata } from "@social-growth-os/ai";
import { prisma } from "@social-growth-os/database";

/**
 * Persists AIExecution metadata for every generation call (CLAUDE.md section
 * 8/31). `workspaceId` scopes it to a tenant so per-account/per-workspace AI
 * spend and volume can be queried, and so it's cleaned up when the
 * workspace is deleted (cascade) instead of accumulating forever.
 */
export async function recordAIExecution(
  workspaceId: string,
  metadata: AICallMetadata,
  outcome: { success: boolean; errorMessage?: string },
): Promise<void> {
  await prisma.aIExecution.create({
    data: {
      workspaceId,
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
