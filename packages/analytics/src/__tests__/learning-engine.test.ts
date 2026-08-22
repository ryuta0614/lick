import { describe, expect, it } from "vitest";
import {
  aggregateByDimension,
  classifyConfidence,
  compareToBaseline,
  isStrongEnoughForRecommendation,
  median,
  percentile,
} from "../reports/learning-engine.js";

describe("aggregateByDimension", () => {
  it("computes sample size, average, median, p25, p75 per dimension value", () => {
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
    expect(contrarian.p25).toBeCloseTo(0.1);
    expect(contrarian.p75).toBeCloseTo(0.3);
  });

  it("marks samples below the low threshold as INSUFFICIENT_DATA", () => {
    const stats = aggregateByDimension([{ dimensionValue: "story", metricValue: 0.5 }]);
    expect(stats[0]?.confidence).toBe("INSUFFICIENT_DATA");
    expect(isStrongEnoughForRecommendation(stats[0]!)).toBe(false);
  });

  it("marks 5-9 samples LOW, 10-29 MEDIUM, 30+ HIGH", () => {
    const low = aggregateByDimension(Array.from({ length: 5 }, (_, i) => ({ dimensionValue: "d", metricValue: i })));
    expect(low[0]?.confidence).toBe("LOW");
    expect(isStrongEnoughForRecommendation(low[0]!)).toBe(true);

    const medium = aggregateByDimension(Array.from({ length: 10 }, (_, i) => ({ dimensionValue: "d", metricValue: i })));
    expect(medium[0]?.confidence).toBe("MEDIUM");

    const high = aggregateByDimension(Array.from({ length: 30 }, (_, i) => ({ dimensionValue: "d", metricValue: i })));
    expect(high[0]?.confidence).toBe("HIGH");
  });

  it("supports configurable thresholds", () => {
    const stats = aggregateByDimension([{ dimensionValue: "d", metricValue: 1 }], { low: 1, medium: 2, high: 3 });
    expect(stats[0]?.confidence).toBe("LOW");
  });
});

describe("classifyConfidence", () => {
  it("classifies boundary values correctly with defaults", () => {
    expect(classifyConfidence(0)).toBe("INSUFFICIENT_DATA");
    expect(classifyConfidence(4)).toBe("INSUFFICIENT_DATA");
    expect(classifyConfidence(5)).toBe("LOW");
    expect(classifyConfidence(9)).toBe("LOW");
    expect(classifyConfidence(10)).toBe("MEDIUM");
    expect(classifyConfidence(29)).toBe("MEDIUM");
    expect(classifyConfidence(30)).toBe("HIGH");
  });
});

describe("median / percentile", () => {
  it("computes the median of an odd-length array", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("computes a nearest-rank percentile", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBeGreaterThanOrEqual(5);
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(10);
  });

  it("returns 0 for an empty array rather than throwing", () => {
    expect(median([])).toBe(0);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("compareToBaseline", () => {
  it("computes relativeLift against the account-wide median", () => {
    const samples = [
      { dimensionValue: "story", metricValue: 0.08 },
      { dimensionValue: "story", metricValue: 0.08 },
      { dimensionValue: "question", metricValue: 0.04 },
      { dimensionValue: "question", metricValue: 0.04 },
    ];
    const stats = aggregateByDimension(samples);
    const allValues = samples.map((s) => s.metricValue);
    const withBaseline = compareToBaseline(stats, allValues);

    const story = withBaseline.find((s) => s.dimensionValue === "story")!;
    expect(story.baselineMedian).toBeCloseTo(0.06);
    expect(story.relativeLift).toBeCloseTo((0.08 - 0.06) / 0.06);
  });

  it("returns null relativeLift when the baseline is exactly 0", () => {
    const stats = aggregateByDimension([{ dimensionValue: "x", metricValue: 0 }]);
    const withBaseline = compareToBaseline(stats, [0]);
    expect(withBaseline[0]?.relativeLift).toBeNull();
  });
});
