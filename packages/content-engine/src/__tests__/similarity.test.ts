import { describe, expect, it } from "vitest";
import { filterNearDuplicates, jaccardSimilarity } from "../ideas/similarity.js";

describe("jaccardSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(jaccardSimilarity("AI side hustle ideas", "AI side hustle ideas")).toBe(1);
  });

  it("is 0 for completely different text", () => {
    expect(jaccardSimilarity("AI side hustle ideas", "gardening tips for beginners")).toBe(0);
  });

  it("is high for near-duplicate phrasing", () => {
    const score = jaccardSimilarity("5 AI side hustle ideas for beginners", "5 AI side hustle ideas for starters");
    expect(score).toBeGreaterThan(0.6);
  });
});

describe("filterNearDuplicates", () => {
  it("drops candidates too similar to existing content", () => {
    const candidates = [{ title: "AI side hustle ideas for beginners" }, { title: "How to cook pasta" }];
    const kept = filterNearDuplicates(candidates, (c) => c.title, ["AI side hustle ideas for beginners"]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.title).toBe("How to cook pasta");
  });

  it("drops near-duplicates within the same candidate batch", () => {
    const candidates = [
      { title: "5 AI side hustle ideas for beginners" },
      { title: "5 AI side hustle ideas for starters" },
      { title: "A totally unrelated gardening post" },
    ];
    const kept = filterNearDuplicates(candidates, (c) => c.title);
    expect(kept).toHaveLength(2);
  });
});
