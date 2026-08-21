import { describe, expect, it } from "vitest";
import { aggregateByDimension, isStrongEnoughForRecommendation } from "../reports/learning-engine.js";

describe("aggregateByDimension", () => {
  it("computes sample size, average, and median per dimension value", () => {
    const samples = [
      { dimensionValue: "contrarian", metricValue: 0.1 },
      { dimensionValue: "contrarian", metricValue: 0.2 },
      { dimensionValue: "contrarian", metricValue: 0.3 },
      { dimensionValue: "question", metricValue: 0.05 },
    ];
    const stats = aggregateByDimension(samples);
    const contrarian = stats.find((s) => s.dimensionValue === "contrarian")!;
    expect(contrarian.sampleSize).toBe(3);
    expect(contrarian.average).toBeCloseTo(0.2);
    expect(contrarian.median).toBeCloseTo(0.2);
  });

  it("marks low sample sizes as low confidence", () => {
    const stats = aggregateByDimension([{ dimensionValue: "story", metricValue: 0.5 }]);
    expect(stats[0]?.confidence).toBe("low");
    expect(isStrongEnoughForRecommendation(stats[0]!)).toBe(false);
  });

  it("marks 10-29 samples as medium and 30+ as high confidence", () => {
    const medium = aggregateByDimension(
      Array.from({ length: 10 }, (_, i) => ({ dimensionValue: "d", metricValue: i })),
    );
    expect(medium[0]?.confidence).toBe("medium");

    const high = aggregateByDimension(
      Array.from({ length: 30 }, (_, i) => ({ dimensionValue: "d", metricValue: i })),
    );
    expect(high[0]?.confidence).toBe("high");
  });
});
