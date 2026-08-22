import { describe, expect, it } from "vitest";
import { analyzeAccountPerformance, findLosingPatterns, findWinningPatterns, type PublishedPostRecord } from "../engine.js";

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

describe("analyzeAccountPerformance", () => {
  it("flags coldStart when there are fewer measured posts than the threshold", () => {
    const posts = [makeRecord({ engagementRate: 0.1, hookType: "story" })];
    const analysis = analyzeAccountPerformance(posts);
    expect(analysis.coldStart).toBe(true);
    expect(analysis.winningPatterns).toHaveLength(0);
    expect(analysis.losingPatterns).toHaveLength(0);
  });

  it("excludes posts with a null metric value from the analysis", () => {
    const posts = [
      ...Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" })),
      makeRecord({ engagementRate: null, hookType: "story" }),
    ];
    const analysis = analyzeAccountPerformance(posts);
    expect(analysis.totalPostsAnalyzed).toBe(10);
  });

  it("finds a winning pattern for a dimension value that beats the account median", () => {
    const posts = [
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" })),
      ...Array.from({ length: 12 }, () => makeRecord({ engagementRate: 0.04, hookType: "question" })),
    ];
    const analysis = analyzeAccountPerformance(posts);

    const storyPattern = analysis.winningPatterns.find((p) => p.dimension === "hookType" && p.value === "story");
    expect(storyPattern).toBeDefined();
    expect(storyPattern!.relativeLift).toBeGreaterThan(0);
    expect(storyPattern!.sampleSize).toBe(12);
    expect(storyPattern!.confidence).toBe("MEDIUM");

    const questionPattern = analysis.losingPatterns.find((p) => p.dimension === "hookType" && p.value === "question");
    expect(questionPattern).toBeDefined();
    expect(questionPattern!.relativeLift).toBeLessThan(0);
  });

  it("orders winningPatterns strongest-lift-first and losingPatterns worst-first", () => {
    const posts = [
      ...Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.2, hookType: "story" })),
      ...Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.12, hookType: "number" })),
      ...Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.02, hookType: "question" })),
    ];
    const analysis = analyzeAccountPerformance(posts);
    const winningValues = analysis.winningPatterns.filter((p) => p.dimension === "hookType").map((p) => p.value);
    expect(winningValues[0]).toBe("story");
  });

  it("excludes INSUFFICIENT_DATA buckets from winning/losing patterns", () => {
    const posts = [
      ...Array.from({ length: 10 }, () => makeRecord({ engagementRate: 0.1, hookType: "story" })),
      ...Array.from({ length: 2 }, () => makeRecord({ engagementRate: 0.5, hookType: "rare-hook" })),
    ];
    const analysis = analyzeAccountPerformance(posts);
    expect(analysis.winningPatterns.some((p) => p.value === "rare-hook")).toBe(false);
  });

  it("supports analyzing a different metric (e.g. revenuePer1kImpressions)", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makeRecord({
        engagementRate: 0.1,
        hookType: "story",
        metrics: {
          engagementRate: 0.1,
          likeRate: null,
          shareRate: null,
          replyRate: null,
          followerConversionRate: null,
          clickRate: null,
          revenuePer1kImpressions: i < 5 ? 100 : null,
        },
      }),
    );
    const analysis = analyzeAccountPerformance(posts, { metric: "revenuePer1kImpressions" });
    expect(analysis.totalPostsAnalyzed).toBe(5);
    expect(analysis.metric).toBe("revenuePer1kImpressions");
  });
});

describe("findWinningPatterns / findLosingPatterns", () => {
  it("return empty arrays for empty input", () => {
    expect(findWinningPatterns({}, "engagementRate")).toEqual([]);
    expect(findLosingPatterns({}, "engagementRate")).toEqual([]);
  });
});
