import { describe, expect, it } from "vitest";
import { appendUtmParams, buildUtmParams } from "../utm.js";

describe("buildUtmParams", () => {
  it("builds required utm params with a default medium", () => {
    const params = buildUtmParams({ source: "threads", campaign: "ai_productivity" });
    expect(params.get("utm_source")).toBe("threads");
    expect(params.get("utm_medium")).toBe("social");
    expect(params.get("utm_campaign")).toBe("ai_productivity");
    expect(params.get("utm_content")).toBeNull();
  });

  it("includes utm_content when provided", () => {
    const params = buildUtmParams({ source: "x", campaign: "launch", content: "post_123" });
    expect(params.get("utm_content")).toBe("post_123");
  });
});

describe("appendUtmParams", () => {
  it("appends utm params onto an existing URL without clobbering other query params", () => {
    const url = appendUtmParams("https://example.com/landing?ref=abc", {
      source: "threads",
      campaign: "ai_productivity",
      content: "post_123",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("ref")).toBe("abc");
    expect(parsed.searchParams.get("utm_source")).toBe("threads");
    expect(parsed.searchParams.get("utm_content")).toBe("post_123");
  });
});
