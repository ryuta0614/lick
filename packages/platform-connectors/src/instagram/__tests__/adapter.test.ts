import { describe, expect, it, vi } from "vitest";
import {
  ContentValidationError,
  PlatformAuthError,
  PlatformServerError,
  PlatformUnsupportedOperationError,
  PublishError,
} from "@social-growth-os/shared";
import { InstagramAdapter } from "../adapter.js";

const config = { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v21.0", igUserId: "ig_123", accessToken: "secret-token" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("InstagramAdapter.validateContent", () => {
  it("rejects a text-only post — Instagram has no text-only post type", async () => {
    const adapter = new InstagramAdapter({ ...config, dryRun: false });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(ContentValidationError);
  });

  it("rejects more than 10 images (carousel limit)", async () => {
    const adapter = new InstagramAdapter({ ...config, dryRun: false });
    const mediaUrls = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.png`);
    await expect(adapter.publishPost("account_1", { text: "hi", mediaUrls })).rejects.toThrow(ContentValidationError);
  });

  it("accepts a single image with no caption", async () => {
    const adapter = new InstagramAdapter({ ...config, dryRun: false });
    await expect(adapter.validateContent({ mediaUrls: ["https://example.com/a.png"] })).resolves.not.toThrow();
  });
});

describe("InstagramAdapter.publishPost (single image)", () => {
  it("publishes via the two-step create -> publish flow", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "published_1" }));

    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] });

    expect(result.externalId).toBe("published_1");
    expect(result.dryRun).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates a definitive container-creation failure (e.g. 400) without calling publish", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(400, { error: { message: "invalid image_url" } }));
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(
      adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a 401 from the publish step as PlatformAuthError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: "expired", code: 190 } }));
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(
      adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] }),
    ).rejects.toThrow(PlatformAuthError);
  });

  it("propagates a 5xx from the publish step as PlatformServerError (retryable)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "down" } }));
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(
      adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] }),
    ).rejects.toThrow(PlatformServerError);
  });

  it("surfaces a network-level failure on the publish call as an ambiguous, non-retryable PublishError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockImplementationOnce(async () => {
        throw new TypeError("connection reset");
      });
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(
      adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] }),
    ).rejects.toThrow(PublishError);
  });

  it("in dry-run mode, creates a container but never calls the publish endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { id: "container_dry" }));
    const adapter = new InstagramAdapter({ ...config, dryRun: true, fetchImpl: fetchMock as unknown as typeof fetch });

    const result = await adapter.publishPost("account_1", { text: "caption", mediaUrls: ["https://example.com/a.png"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.dryRun).toBe(true);
    expect(result.externalId).toBe("dryrun_container_dry");
  });
});

describe("InstagramAdapter.publishPost (carousel)", () => {
  it("creates each child container, then the carousel parent, then publishes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "child_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "child_2" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "carousel_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "published_1" }));

    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await adapter.publishPost("account_1", {
      text: "carousel caption",
      mediaUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    });

    expect(result.externalId).toBe("published_1");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("InstagramAdapter.getPostMetrics", () => {
  it("leaves metrics Instagram doesn't provide as undefined, never 0", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { data: [{ name: "impressions", values: [{ value: 42 }] }] }),
    );
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const metrics = await adapter.getPostMetrics("account_1", "media_1");

    expect(metrics.impressions).toBe(42);
    expect(metrics.likes).toBeUndefined();
    expect(metrics.profileVisits).toBeUndefined();
    expect(metrics.linkClicks).toBeUndefined();
  });

  it("refuses to fetch metrics for a dry-run externalId", async () => {
    const fetchMock = vi.fn();
    const adapter = new InstagramAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.getPostMetrics("account_1", "dryrun_abc")).rejects.toThrow(PlatformUnsupportedOperationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("InstagramAdapter unsupported operations", () => {
  it("deletePost throws PlatformUnsupportedOperationError rather than guessing at an endpoint", async () => {
    const adapter = new InstagramAdapter({ ...config, dryRun: false });
    await expect(adapter.deletePost("account_1", "media_1")).rejects.toThrow(PlatformUnsupportedOperationError);
  });
});
