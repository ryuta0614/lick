import { describe, expect, it } from "vitest";
import { calculatePostMetrics } from "../metrics.js";

describe("calculatePostMetrics", () => {
  it("computes rates from raw counts", () => {
    const result = calculatePostMetrics({
      impressions: 1000,
      likes: 50,
      replies: 10,
      shares: 20,
      linkClicks: 15,
      followersGained: 5,
      revenue: 100,
    });
    expect(result.engagementRate).toBeCloseTo(0.08);
    expect(result.shareRate).toBeCloseTo(0.02);
    expect(result.replyRate).toBeCloseTo(0.01);
    expect(result.clickRate).toBeCloseTo(0.015);
    expect(result.followerConversionRate).toBeCloseTo(0.005);
    expect(result.revenuePer1kImpressions).toBeCloseTo(100);
  });

  it("returns null instead of dividing by zero when impressions are missing", () => {
    const result = calculatePostMetrics({ impressions: 0, likes: 5 });
    expect(result.engagementRate).toBeNull();
    expect(result.revenuePer1kImpressions).toBeNull();
  });

  it("returns null when impressions are unknown (not just zero)", () => {
    const result = calculatePostMetrics({ likes: 5 });
    expect(result.engagementRate).toBeNull();
  });
});
