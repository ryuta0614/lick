import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@social-growth-os/ai";
import { IdeaGenerator } from "../ideas/idea-generator.js";
import { runContentTournament } from "../optimizer/tournament.js";
import { createDefaultMockGenerators } from "../mock-generators.js";

const persona = {
  niche: "AI productivity",
  audience: "Japanese office workers",
  tone: ["friendly", "practical", "concise"],
  avoid: ["fake income claims"],
};

describe("content generation pipeline (mock provider, no network)", () => {
  it("goes from a topic to ideas to a scored, decided winner", async () => {
    const provider = new MockAIProvider(createDefaultMockGenerators());

    const { ideas } = await new IdeaGenerator(provider).generate({
      topic: "AI side hustle",
      persona,
      traceId: "trace_test_1",
    });
    expect(ideas.length).toBeGreaterThan(0);

    const idea = ideas[0]!;
    const { winners, losers, aiCalls } = await runContentTournament(provider, {
      idea,
      platform: "THREADS",
      persona,
      traceId: "trace_test_1",
    });

    expect(winners).toHaveLength(1);
    expect(winners[0]?.draft.text.length).toBeGreaterThan(0);
    expect(winners[0]?.qualityScore).toBeGreaterThanOrEqual(0);
    expect(winners[0]?.qualityScore).toBeLessThanOrEqual(100);
    expect(["approve", "rewrite", "reject"]).toContain(winners[0]?.decision);
    // default config: 3 full candidates, 1 winner -> 2 losers
    expect(losers).toHaveLength(2);
    // 1 hooks call + 3 writer calls + 3 critic calls
    expect(aiCalls).toHaveLength(7);
  });
});
