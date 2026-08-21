import OpenAI from "openai";
import { AIGenerationError } from "@social-growth-os/shared";
import { estimateCostUsd } from "./cost.js";
import { parseStructuredResponse } from "./extract-json.js";
import type {
  AIProvider,
  GenerateStructuredInput,
  GenerateStructuredResult,
  GenerateTextInput,
  GenerateTextResult,
} from "./types.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const response = await this.client.chat.completions.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      temperature: input.temperature,
      messages: [
        ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
        { role: "user" as const, content: input.prompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new AIGenerationError("OpenAI response contained no text content");
    }

    const usage = response.usage;
    return {
      text,
      provider: this.name,
      model: input.model,
      promptVersion: input.promptVersion,
      temperature: input.temperature,
      traceId: input.traceId,
      operation: input.operation,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
      estimatedCostUsd: estimateCostUsd(input.model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
    };
  }

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>> {
    const jsonInstruction =
      "\n\nRespond with ONLY a single valid JSON object matching the required shape. No prose, no markdown fences.";
    const textResult = await this.generateText({ ...input, prompt: input.prompt + jsonInstruction });
    const data = parseStructuredResponse(textResult.text, input.schema);
    return { ...textResult, data };
  }
}
