import { describe, expect, it } from "vitest";
import { analyzeAccountPerformance, type PublishedPostRecord } from "../engine.js";
import {
  buildGenerationContext,
  DEFAULT_GENERATION_MIX,
  pickGenerationMode,
  resolveGenerationMix,
} from "../generation-context.js";

function makeRecord(overrides: Partial<PublishedPostRecord> & { engagementRate: number | null }): PublishedPostRecord {
  const { engagementRate, ...rest } = overrides;
  return {
    postId: "p",
    platform: "THREADS",
    topic: null,
    hookType: null,
    emotion: null,
    contentType: null,
    cta: null,
    textLength: null,
    lengthBucket: null,
    weekday: null,
    postingHour: null,
    metrics: {
      engagementRate,
      likeRate: null,
      shareRate: null,
      replyRate: null,
      followerConversionRate: null,
      clickRate: null,
      revenuePer1kImpressions: null,
    },
    ...rest,
  };
}

describe("pickGenerationMode", () => {
  it("respects the configured mix boundaries deterministically", () => {
    expect(pickGenerationMode(DEFAULT_GENERATION_MIX, () => 0)).toBe("proven");
    expect(pickGenerationMode(DEFAULT_GENERATION_MIX, () => 0.75)).toBe("adjacent");
    expect(pickGenerationMode(DEFAULT_GENERATION_MIX, () => 0.95)).toBe("exploration");
  });
});

describe("resolveGenerationMix", () => {
  it("returns full exploration on cold start", () => {
    const mix = resolveGenerationMix({ coldStart: true, winningPatterns: [] });
    expect(mix.exploration).toBe(1);
    expect(mix.proven).toBe(0);
  });

  it("raises exploration when there is data but no MEDIUM/HIGH confidence pattern yet", () => {
    const mix = resolveGenerationMix({
      coldStart: false,
      winningPatterns: [
        { dimension: "hookType", value: "story", metric: "engagementRate", sampleSize: 6, median: 0.1, accountMedian: 0.08, relativeLift: 0.25, confidence: "LOW" },
      ],
    });
    expect(mix.exploration).toBeGreaterThan(DEFAULT_GENERATION_MIX.exploration);
  });

  it("uses the base mix when there is a reliable (MEDIUM+) pattern", () => {
    const mix = resolveGenerationMix({
      coldStart: false,
      winningPatterns: [
        { dimension: "hookType", value: "story", metric: "engagementRate", sampleSize: 15, median: 0.1, accountMedian: 0.08, relativeLift: 0.25, confidence: "MEDIUM" },
      ],
    });
    expect(mix).toEqual(DEFAULT_GENERATION_MIX);
  });
});

describe("buildGenerationContext", () => {
  it("returns no learnings and full exploration on cold start", () => {
    const analysis = analyzeAccountPerformance([makeRecord({ engagementRate: 0.1 })]);
    const context = buildGenerationContext(analysis, { random: () => 0.99 });
    expect(context.recentLearnings).toEqual([]);
    expect(context.mode).toBe("exploration");
  });

  it("produces plain-English learnings referencing sample size and lift, not a rigid schema", () => {
    const posts = [
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" })),
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.04, hookType: "question" })),
    ];
    const analysis = analyzeAccountPerformance(posts);
    const context = buildGenerationContext(analysis, { random: () => 0 });

    expect(context.recentLearnings.length).toBeGreaterThan(0);
    expect(context.recentLearnings[0]).toContain("story");
    expect(context.recentLearnings[0]).toContain("12 posts");
    expect(context.mode).toBe("proven");
  });

  it("folds in strategy observations alongside live pattern learnings, capped at maxLearnings", () => {
    const posts = [
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" })),
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.04, hookType: "question" })),
    ];
    const analysis = analyzeAccountPerformance(posts);
    const context = buildGenerationContext(analysis, {
      strategyObservations: ["Weekly review: focus on mornings."],
      maxLearnings: 3,
      random: () => 0,
    });
    expect(context.recentLearnings.length).toBeLessThanOrEqual(3);
  });

  it("works with no strategy at all (undefined observations)", () => {
    const posts = Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" }));
    const analysis = analyzeAccountPerformance(posts);
    expect(() => buildGenerationContext(analysis)).not.toThrow();
  });
});
