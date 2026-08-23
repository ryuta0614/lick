import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentValidationError,
  PlatformAuthError,
  PlatformRateLimitError,
  PlatformServerError,
  PlatformUnsupportedOperationError,
  PublishError,
} from "@social-growth-os/shared";
import { XAdapter } from "../adapter.js";

const config = { apiBaseUrl: "https://api.x.com", accessToken: "secret-token" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let logSpy: ReturnType<typeof vi.spyOn>[];

afterEach(() => {
  logSpy?.forEach((s) => s.mockRestore());
});

function spyOnConsole() {
  logSpy = [vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];
}

describe("XAdapter.publishPost", () => {
  it("publishes with a single POST /2/tweets call and never logs the access token", async () => {
    spyOnConsole();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: { id: "tweet_1" } }));

    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await adapter.publishPost("account_1", { text: "hello" });

    expect(result.externalId).toBe("tweet_1");
    expect(result.dryRun).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const loggedText = logSpy.flatMap((s) => s.mock.calls.flat(2)).join(" ");
    expect(loggedText).not.toContain("secret-token");
  });

  it("rejects empty text before making any network call", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "" })).rejects.toThrow(ContentValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects text over the 280-character X limit before making any network call", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "x".repeat(281) })).rejects.toThrow(ContentValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a 401 as PlatformAuthError", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(401, { title: "expired" }));
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformAuthError);
  });

  it("propagates a 429 as PlatformRateLimitError", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(429, { title: "limited" }));
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformRateLimitError);
  });

  it("propagates a 5xx as PlatformServerError (retryable)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(503, { title: "down" }));
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformServerError);
  });

  it("throws a malformed-response error when the tweet response doesn't match the expected shape", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { unexpected: "shape" }));
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformServerError);
  });

  it("surfaces a network-level failure as an ambiguous, non-retryable PublishError", async () => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      throw new TypeError("connection reset");
    });
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PublishError);
  });

  it("in dry-run mode, never calls the X API at all (there is no safe partial step like Threads' container)", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: true, fetchImpl: fetchMock as unknown as typeof fetch });

    const result = await adapter.publishPost("account_1", { text: "hello" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.externalId).toMatch(/^dryrun_/);
  });
});

describe("XAdapter.getPostMetrics", () => {
  it("leaves metrics X doesn't provide as undefined, never 0", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { data: { id: "tweet_1", public_metrics: { like_count: 42, impression_count: 1000 } } }),
    );
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const metrics = await adapter.getPostMetrics("account_1", "tweet_1");

    expect(metrics.likes).toBe(42);
    expect(metrics.impressions).toBe(1000);
    expect(metrics.shares).toBeUndefined();
    expect(metrics.profileVisits).toBeUndefined();
    expect(metrics.linkClicks).toBeUndefined();
  });

  it("refuses to fetch metrics for a dry-run externalId", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.getPostMetrics("account_1", "dryrun_abc")).rejects.toThrow(PlatformUnsupportedOperationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("XAdapter.deletePost", () => {
  it("calls DELETE /2/tweets/:id (officially documented, unlike Threads)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: { deleted: true } }));
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await adapter.deletePost("account_1", "tweet_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a dry-run externalId (nothing was ever really published)", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await adapter.deletePost("account_1", "dryrun_abc");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("XAdapter.getPost", () => {
  it("refuses to fetch a dry-run externalId", async () => {
    const fetchMock = vi.fn();
    const adapter = new XAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.getPost("account_1", "dryrun_abc")).rejects.toThrow(PlatformUnsupportedOperationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
