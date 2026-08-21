import type { AICallMetadata, AIProvider } from "@social-growth-os/ai";
import { HookListSchema, type HookCandidate } from "@social-growth-os/ai";
import type { ContentIdeaCandidate } from "@social-growth-os/ai";
import type { Platform } from "@social-growth-os/shared";

export type GenerateHooksInput = {
  idea: ContentIdeaCandidate;
  platform: Platform;
  count: number;
  traceId: string;
  model?: string;
};

const DEFAULT_MODEL = "claude-sonnet-4-5";

/** First stage of the tournament pipeline (CLAUDE.md section 15): idea -> N hooks, best-first. */
export class HookGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generate(input: GenerateHooksInput): Promise<{ hooks: HookCandidate[]; metadata: AICallMetadata }> {
    const result = await this.provider.generateStructured({
      model: input.model ?? DEFAULT_MODEL,
      traceId: input.traceId,
      operation: "generate_hooks",
      promptVersion: "hook-generator@1",
      temperature: 1,
      prompt: buildHookPrompt(input),
      schema: HookListSchema,
    });
    const { data: _data, ...metadata } = result;
    return { hooks: result.data.hooks, metadata };
  }
}

function buildHookPrompt(input: GenerateHooksInput): string {
  return [
    `Idea: "${input.idea.title}" (angle: ${input.idea.angle}, topic: ${input.idea.topic}).`,
    `Platform: ${input.platform}.`,
    `Write ${input.count} different opening hooks (first line) for this idea, ordered from strongest to weakest.`,
    "Each hook must use a distinct hookType. Do not reuse another creator's wording — only the abstract hook pattern.",
    'Return JSON: { "hooks": [{ "text", "hookType" }] }',
  ].join("\n");
}
