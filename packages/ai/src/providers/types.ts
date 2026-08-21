import type { ZodType } from "zod";

export type AICallOptions = {
  model: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
  /** Correlates every call in one generation flow (idea -> hooks -> writer -> critic). */
  traceId: string;
  /** Short machine name for what this call does, e.g. "generate_hooks", "critique_post". Mirrors AIExecution.operation. */
  operation: string;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AICallMetadata = {
  provider: string;
  model: string;
  promptVersion?: string;
  temperature?: number;
  usage: AIUsage;
  estimatedCostUsd: number;
  traceId: string;
  operation: string;
};

export type GenerateTextInput = AICallOptions & {
  system?: string;
  prompt: string;
};

export type GenerateTextResult = AICallMetadata & {
  text: string;
};

export type GenerateStructuredInput<T> = AICallOptions & {
  system?: string;
  prompt: string;
  schema: ZodType<T>;
};

export type GenerateStructuredResult<T> = AICallMetadata & {
  data: T;
};

/**
 * Provider-agnostic interface for LLM calls. Structured output is always
 * validated with Zod before it reaches application code (CLAUDE.md section 8).
 */
export interface AIProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>>;
}
