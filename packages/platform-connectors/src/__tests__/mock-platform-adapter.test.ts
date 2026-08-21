import { describe, expect, it } from "vitest";
import { ContentValidationError, PlatformValidationError } from "@social-growth-os/shared";
import { MockPlatformAdapter } from "../mock/mock-platform-adapter.js";

describe("MockPlatformAdapter", () => {
  it("publishes a post and returns a normalized result", async () => {
    const adapter = new MockPlatformAdapter("THREADS");
    const result = await adapter.publishPost("account_1", { text: "Hello Threads" });

    expect(result.externalId).toMatch(/^mock_threads_/);
    expect(result.url).toContain(result.externalId);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects text over the platform limit", async () => {
    const adapter = new MockPlatformAdapter("X");
    await expect(adapter.publishPost("account_1", { text: "a".repeat(281) })).rejects.toThrow(
      ContentValidationError,
    );
  });

  it("rejects empty text", async () => {
    const adapter = new MockPlatformAdapter("X");
    await expect(adapter.publishPost("account_1", { text: "" })).rejects.toThrow(ContentValidationError);
  });

  it("returns metrics for a published post with every field present", async () => {
    const adapter = new MockPlatformAdapter("X");
    const published = await adapter.publishPost("account_1", { text: "Hello X" });
    const metrics = await adapter.getPostMetrics("account_1", published.externalId);

    expect(metrics.impressions).toBeGreaterThan(0);
    expect(metrics.likes).toBeGreaterThanOrEqual(0);
  });

  it("throws when fetching metrics for an unknown post", async () => {
    const adapter = new MockPlatformAdapter("X");
    await expect(adapter.getPostMetrics("account_1", "does_not_exist")).rejects.toThrow(PlatformValidationError);
  });

  it("excludes a deleted post from further lookups", async () => {
    const adapter = new MockPlatformAdapter("X");
    const published = await adapter.publishPost("account_1", { text: "Hello X" });
    await adapter.deletePost("account_1", published.externalId);
    await expect(adapter.getPost("account_1", published.externalId)).rejects.toThrow(PlatformValidationError);
  });
});
