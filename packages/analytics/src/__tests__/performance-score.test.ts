import { describe, expect, it } from "vitest";
import { calculatePerformanceScore, normalizeAgainstCohort } from "../scoring/performance-score.js";

describe("normalizeAgainstCohort", () => {
  it("maps the min of a cohort to 0 and the max to 1", () => {
    const cohort = [1, 5, 10];
    expect(normalizeAgainstCohort(1, cohort)).toBe(0);
    expect(normalizeAgainstCohort(10, cohort)).toBe(1);
  });

  it("returns 0.5 when the cohort has no spread", () => {
    expect(normalizeAgainstCohort(5, [5, 5, 5])).toBe(0.5);
  });

  it("returns 0.5 for an empty cohort instead of dividing by zero", () => {
    expect(normalizeAgainstCohort(5, [])).toBe(0.5);
  });
});

describe("calculatePerformanceScore", () => {
  it("returns 1 when every normalized rate is maxed out", () => {
    const score = calculatePerformanceScore({
      normalizedLikeRate: 1,
      normalizedReplyRate: 1,
      normalizedShareRate: 1,
      normalizedFollowerConversionRate: 1,
      normalizedClickRate: 1,
      normalizedRevenueRate: 1,
    });
    expect(score).toBeCloseTo(1);
  });

  it("returns 0 when every normalized rate is zero", () => {
    const score = calculatePerformanceScore({
      normalizedLikeRate: 0,
      normalizedReplyRate: 0,
      normalizedShareRate: 0,
      normalizedFollowerConversionRate: 0,
      normalizedClickRate: 0,
      normalizedRevenueRate: 0,
    });
    expect(score).toBe(0);
  });

  it("weights revenue the highest by default", () => {
    const revenueOnly = calculatePerformanceScore({
      normalizedLikeRate: 0,
      normalizedReplyRate: 0,
      normalizedShareRate: 0,
      normalizedFollowerConversionRate: 0,
      normalizedClickRate: 0,
      normalizedRevenueRate: 1,
    });
    const likeOnly = calculatePerformanceScore({
      normalizedLikeRate: 1,
      normalizedReplyRate: 0,
      normalizedShareRate: 0,
      normalizedFollowerConversionRate: 0,
      normalizedClickRate: 0,
      normalizedRevenueRate: 0,
    });
    expect(revenueOnly).toBeGreaterThan(likeOnly);
  });
});
