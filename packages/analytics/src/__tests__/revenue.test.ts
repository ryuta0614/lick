import { describe, expect, it } from "vitest";
import { aggregateRevenue, revenuePer1kImpressions } from "../attribution/revenue.js";

describe("aggregateRevenue", () => {
  it("returns null (unmeasurable) when there are no conversions at all", () => {
    expect(aggregateRevenue([])).toBeNull();
  });

  it("returns null when every conversion has no recorded value (e.g. leads/clicks, not purchases)", () => {
    expect(aggregateRevenue([{ value: null }, { value: null }])).toBeNull();
  });

  it("never conflates unmeasurable with a genuine zero", () => {
    const unmeasurable = aggregateRevenue([]);
    const genuineZero = aggregateRevenue([{ value: 0 }]);
    expect(unmeasurable).toBeNull();
    expect(genuineZero).toBe(0);
  });

  it("sums only the measured values, ignoring null ones in a mixed set", () => {
    expect(aggregateRevenue([{ value: 1000 }, { value: null }, { value: 500 }])).toBe(1500);
  });
});

describe("revenuePer1kImpressions", () => {
  it("is null when revenue is unmeasurable, even with plenty of impressions", () => {
    expect(revenuePer1kImpressions(null, 10000)).toBeNull();
  });

  it("is null when impressions is 0 or null (avoid division by zero)", () => {
    expect(revenuePer1kImpressions(1000, 0)).toBeNull();
    expect(revenuePer1kImpressions(1000, null)).toBeNull();
  });

  it("computes revenue per 1k impressions when both are known", () => {
    expect(revenuePer1kImpressions(2000, 10000)).toBe(200);
  });

  it("is a real zero (not null) when revenue is measured as exactly 0", () => {
    expect(revenuePer1kImpressions(0, 10000)).toBe(0);
  });
});
