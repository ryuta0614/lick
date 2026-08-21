import { AIGenerationError } from "@social-growth-os/shared";
import type {
  AIProvider,
  GenerateStructuredInput,
  GenerateStructuredResult,
  GenerateTextInput,
  GenerateTextResult,
} from "./types.js";

export type MockStructuredGenerator = (input: { prompt: string; system?: string }) => unknown;

/**
 * Deterministic, network-free provider used in tests and local dev when no
 * ANTHROPIC_API_KEY/OPENAI_API_KEY is configured. Structured calls are still
 * validated against the caller's Zod schema so behavior matches production.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  constructor(private readonly generators: Record<string, MockStructuredGenerator> = {}) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return {
      text: `[mock:${input.operation}] response for: ${input.prompt.slice(0, 160)}`,
      provider: this.name,
      model: input.model,
      promptVersion: input.promptVersion,
      temperature: input.temperature,
      traceId: input.traceId,
      operation: input.operation,
      usage: { inputTokens: Math.ceil(input.prompt.length / 4), outputTokens: 40 },
      estimatedCostUsd: 0,
    };
  }

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>> {
    const generator = this.generators[input.operation];
    if (!generator) {
      throw new AIGenerationError(`MockAIProvider has no generator registered for operation "${input.operation}"`);
    }

    const raw = generator({ prompt: input.prompt, system: input.system });
    const parsed = input.schema.safeParse(raw);
    if (!parsed.success) {
      throw new AIGenerationError(
        `Mock data failed schema validation for operation "${input.operation}": ${parsed.error.message}`,
        parsed.error,
      );
    }

    const textResult = await this.generateText(input);
    return { ...textResult, data: parsed.data };
  }
}
