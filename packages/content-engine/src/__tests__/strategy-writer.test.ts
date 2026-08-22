import { describe, expect, it } from "vitest";
import type { AIProvider, GenerateStructuredInput, GenerateStructuredResult, GenerateTextInput, GenerateTextResult } from "@social-growth-os/ai";
import { StrategyWriter } from "../strategy/strategy-writer.js";

class RecordingProvider implements AIProvider {
  readonly name = "recording";
  lastPrompt = "";
  lastOperation = "";

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
    this.lastOperation = input.operation;
    const data = input.schema.parse({
      recommendedMix: [{ label: "Story-driven posts", weight: 0.4, rationale: "Reflects the data above." }],
      recommendedTimes: [{ window: "20:00-21:59", rationale: "Reflects the data above." }],
      experiments: [{ hypothesis: "h", variable: "v", control: "c", variant: "x" }],
    });
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

const persona = { niche: "AI productivity", audience: "office workers", tone: ["friendly"] };

describe("StrategyWriter", () => {
  it("feeds the AI only aggregated pattern rows, never raw post text", async () => {
    const provider = new RecordingProvider();
    const writer = new StrategyWriter(provider);

    await writer.generateRecommendation({
      persona,
      periodDays: 30,
      totalPostsAnalyzed: 16,
      winningPatterns: [
        {
          dimension: "hookType",
          value: "story",
          metric: "engagementRate",
          sampleSize: 16,
          relativeLift: 0.31,
          confidence: "MEDIUM",
        },
      ],
      losingPatterns: [],
      traceId: "t1",
    });

    expect(provider.lastPrompt).toContain("AGGREGATED performance data only");
    expect(provider.lastPrompt).toContain('hookType="story"');
    expect(provider.lastPrompt).toContain("sampleSize=16");
    expect(provider.lastPrompt).toContain("+31%");
    // Nothing in GenerateStrategyRecommendationInput carries post text — only
    // dimension/value/metric/sampleSize/relativeLift/confidence get interpolated.
    expect(provider.lastPrompt).not.toContain("Post about");
  });

  it("uses the operation name generate_strategy so it can be mocked and logged distinctly", async () => {
    const provider = new RecordingProvider();

    await new StrategyWriter(provider).generateRecommendation({
      persona,
      periodDays: 7,
      totalPostsAnalyzed: 0,
      winningPatterns: [],
      losingPatterns: [],
      traceId: "t2",
    });

    expect(provider.lastOperation).toBe("generate_strategy");
  });
});
