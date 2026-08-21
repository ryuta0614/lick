import Anthropic from "@anthropic-ai/sdk";
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

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      temperature: input.temperature,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!text) {
      throw new AIGenerationError("Anthropic response contained no text content");
    }

    return {
      text,
      provider: this.name,
      model: input.model,
      promptVersion: input.promptVersion,
      temperature: input.temperature,
      traceId: input.traceId,
      operation: input.operation,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      estimatedCostUsd: estimateCostUsd(input.model, response.usage.input_tokens, response.usage.output_tokens),
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
