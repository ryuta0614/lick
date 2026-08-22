import { describe, expect, it } from "vitest";
import { bucketTextLength, extractPostFeatures, type PostForFeatureExtraction } from "../feature-extraction.js";

function makePost(overrides: Partial<PostForFeatureExtraction> = {}): PostForFeatureExtraction {
  return {
    id: "post_1",
    platform: "THREADS",
    text: "hello world",
    cta: "reply",
    publishedAt: new Date("2026-08-22T20:30:00Z"), // Saturday, hour depends on local TZ but getDay/getHours are consistent within a run
    idea: { topic: "AI productivity", hookType: "curiosity", emotion: "curiosity", contentType: "text" },
    variants: [{ selected: true, hookType: "story" }],
    ...overrides,
  };
}

describe("bucketTextLength", () => {
  it("buckets into coarse ranges", () => {
    expect(bucketTextLength(0)).toBe("0-99");
    expect(bucketTextLength(99)).toBe("0-99");
    expect(bucketTextLength(100)).toBe("100-199");
    expect(bucketTextLength(250)).toBe("200-299");
    expect(bucketTextLength(499)).toBe("300-499");
    expect(bucketTextLength(500)).toBe("500+");
  });
});

describe("extractPostFeatures", () => {
  it("prefers the selected variant's hookType over the idea's suggested hookType", () => {
    const features = extractPostFeatures(makePost());
    expect(features.hookType).toBe("story");
  });

  it("falls back to the idea's hookType when no variant is selected", () => {
    const features = extractPostFeatures(makePost({ variants: [] }));
    expect(features.hookType).toBe("curiosity");
  });

  it("extracts topic/emotion/contentType from the idea", () => {
    const features = extractPostFeatures(makePost());
    expect(features.topic).toBe("AI productivity");
    expect(features.emotion).toBe("curiosity");
    expect(features.contentType).toBe("text");
  });

  it("extracts cta directly from the post", () => {
    const features = extractPostFeatures(makePost({ cta: "follow" }));
    expect(features.cta).toBe("follow");
  });

  it("computes textLength and lengthBucket from post.text", () => {
    const features = extractPostFeatures(makePost({ text: "x".repeat(150) }));
    expect(features.textLength).toBe(150);
    expect(features.lengthBucket).toBe("100-199");
  });

  it("returns null textLength/lengthBucket when text is null", () => {
    const features = extractPostFeatures(makePost({ text: null }));
    expect(features.textLength).toBeNull();
    expect(features.lengthBucket).toBeNull();
  });

  it("computes weekday and postingHour from publishedAt", () => {
    const publishedAt = new Date(2026, 7, 22, 14, 30); // local time, Aug 22 2026
    const features = extractPostFeatures(makePost({ publishedAt }));
    expect(features.weekday).toBe(publishedAt.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase());
    expect(features.postingHour).toBe(14);
  });

  it("returns null weekday/postingHour when publishedAt is null (not yet published)", () => {
    const features = extractPostFeatures(makePost({ publishedAt: null }));
    expect(features.weekday).toBeNull();
    expect(features.postingHour).toBeNull();
  });

  it("returns null feature values when there is no idea at all", () => {
    const features = extractPostFeatures(makePost({ idea: null, variants: [] }));
    expect(features.topic).toBeNull();
    expect(features.hookType).toBeNull();
    expect(features.emotion).toBeNull();
    expect(features.contentType).toBeNull();
  });
});
