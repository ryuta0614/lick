import { describe, expect, it } from "vitest";
import { calculateQualityScore, decideFromQualityScore } from "../critic/scoring.js";

const baseCritique = {
  hook: 8,
  originality: 8,
  usefulness: 8,
  clarity: 8,
  shareability: 8,
  audienceFit: 8,
  specificity: 8,
  conversionPotential: 8,
  brandFit: 8,
  risk: 0,
};

describe("calculateQualityScore", () => {
  it("scores a strong, low-risk post as approval-eligible", () => {
    const score = calculateQualityScore(baseCritique);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(decideFromQualityScore(score)).toBe("approve");
  });

  it("applies a risk penalty that can push a strong post into rewrite/reject", () => {
    const risky = { ...baseCritique, risk: 8 };
    const score = calculateQualityScore(risky);
    expect(score).toBeLessThan(calculateQualityScore(baseCritique));
  });

  it("never returns a score outside [0, 100]", () => {
    const worst = Object.fromEntries(Object.keys(baseCritique).map((k) => [k, k === "risk" ? 10 : 0])) as typeof baseCritique;
    const best = Object.fromEntries(Object.keys(baseCritique).map((k) => [k, k === "risk" ? 0 : 10])) as typeof baseCritique;
    expect(calculateQualityScore(worst)).toBe(0);
    expect(calculateQualityScore(best)).toBeLessThanOrEqual(100);
  });
});

describe("decideFromQualityScore", () => {
  it("approves scores >= 80", () => {
    expect(decideFromQualityScore(80)).toBe("approve");
    expect(decideFromQualityScore(95)).toBe("approve");
  });

  it("sends 65-79 to rewrite", () => {
    expect(decideFromQualityScore(65)).toBe("rewrite");
    expect(decideFromQualityScore(79.9)).toBe("rewrite");
  });

  it("rejects below 65", () => {
    expect(decideFromQualityScore(64.9)).toBe("reject");
    expect(decideFromQualityScore(0)).toBe("reject");
  });
});
