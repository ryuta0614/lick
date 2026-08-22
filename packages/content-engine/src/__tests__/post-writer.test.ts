import { describe, expect, it } from "vitest";
import type { AIProvider, GenerateStructuredInput, GenerateStructuredResult, GenerateTextInput, GenerateTextResult } from "@social-growth-os/ai";
import { PostWriter } from "../writer/post-writer.js";

class RecordingProvider implements AIProvider {
  readonly name = "recording";
  lastPrompt = "";

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    this.lastPrompt = input.prompt;
    return {
      text: "n/a",
      provider: this.name,
      model: input.model,
      traceId: input.traceId,
      operation: input.operation,
      usage: { inputTokens: 1, outputTokens: 1 },
      estimatedCostUsd: 0,
    };
  }

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>> {
    this.lastPrompt = input.prompt;
    const data = input.schema.parse({ text: "Generated post text", hookType: "story", cta: "reply" });
    return {
      data,
      provider: this.name,
      model: input.model,
      traceId: input.traceId,
      operation: input.operation,
      usage: { inputTokens: 1, outputTokens: 1 },
      estimatedCostUsd: 0,
    };
  }
}

const idea = {
  title: "AI side hustle: a simple 3-step framework",
  topic: "AI side hustle",
  angle: "a simple 3-step framework",
  hookType: "curiosity" as const,
  emotion: "curiosity" as const,
};

const persona = { niche: "AI productivity", audience: "office workers", tone: ["friendly"] };

describe("PostWriter generation context", () => {
  it("includes recentLearnings as reference info, not as a mandatory instruction", async () => {
    const provider = new RecordingProvider();
    const writer = new PostWriter(provider);

    await writer.write({
      idea,
      hook: { text: "Here's a hard truth", hookType: "warning" },
      platform: "THREADS",
      persona,
      traceId: "t1",
      generationContext: {
        recentLearnings: ['"story" hooks have outperformed the account median engagement rate by 33% over 18 posts.'],
        mode: "proven",
      },
    });

    expect(provider.lastPrompt).toContain("story");
    expect(provider.lastPrompt).toContain("For reference only");
    expect(provider.lastPrompt.toLowerCase()).not.toMatch(/must use|always use|required format|you must/);
  });

  it("nudges toward exploration without forbidding proven patterns entirely", async () => {
    const provider = new RecordingProvider();
    const writer = new PostWriter(provider);

    await writer.write({
      idea,
      hook: { text: "Unpopular opinion", hookType: "contrarian" },
      platform: "THREADS",
      persona,
      traceId: "t2",
      generationContext: { recentLearnings: [], mode: "exploration" },
    });

    expect(provider.lastPrompt.toLowerCase()).toContain("explore");
  });

  it("works with no generationContext at all (Strategy/learnings not required)", async () => {
    const provider = new RecordingProvider();
    const writer = new PostWriter(provider);

    const { draft } = await writer.write({
      idea,
      hook: { text: "Here's a hard truth", hookType: "warning" },
      platform: "THREADS",
      persona,
      traceId: "t3",
    });

    expect(draft.text).toBe("Generated post text");
    expect(provider.lastPrompt).not.toContain("For reference only");
  });
});
