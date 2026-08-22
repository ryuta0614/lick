import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentValidationError,
  PlatformAuthError,
  PlatformRateLimitError,
  PlatformServerError,
  PlatformUnsupportedOperationError,
  PublishError,
} from "@social-growth-os/shared";
import { ThreadsAdapter } from "../adapter.js";

const config = { apiBaseUrl: "https://graph.threads.net", apiVersion: "v1.0", threadsUserId: "123", accessToken: "secret-token" };

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

describe("ThreadsAdapter.publishPost", () => {
  it("publishes via the two-step create -> publish flow and never logs the access token", async () => {
    spyOnConsole();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "published_1" }));

    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await adapter.publishPost("account_1", { text: "hello" });

    expect(result.externalId).toBe("published_1");
    expect(result.dryRun).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const loggedText = logSpy.flatMap((s) => s.mock.calls.flat(2)).join(" ");
    expect(loggedText).not.toContain("secret-token");
  });

  it("rejects empty text before making any network call (container creation failure path)", async () => {
    const fetchMock = vi.fn();
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "" })).rejects.toThrow(ContentValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a definitive container-creation failure (e.g. 400) without calling publish", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(400, { error: { message: "invalid text" } }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a 401 from the publish step as PlatformAuthError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: "expired", code: 190 } }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformAuthError);
  });

  it("propagates a 429 from the publish step as PlatformRateLimitError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "limited" } }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformRateLimitError);
  });

  it("propagates a 5xx from the publish step as PlatformServerError (retryable)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "down" } }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformServerError);
  });

  it("throws a malformed-response error when the container response doesn't match the expected shape", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { unexpected: "shape" }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PlatformServerError);
  });

  it("surfaces a network-level failure on the publish call as an ambiguous, non-retryable PublishError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "container_1" }))
      .mockImplementationOnce(async () => {
        throw new TypeError("connection reset");
      });
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.publishPost("account_1", { text: "hello" })).rejects.toThrow(PublishError);
  });

  it("in dry-run mode, creates a container but never calls the publish endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { id: "container_dry" }));
    const adapter = new ThreadsAdapter({ ...config, dryRun: true, fetchImpl: fetchMock as unknown as typeof fetch });

    const result = await adapter.publishPost("account_1", { text: "hello" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.dryRun).toBe(true);
    expect(result.externalId).toBe("dryrun_container_dry");
  });
});

describe("ThreadsAdapter.getPostMetrics", () => {
  it("leaves metrics the Threads insights API doesn't provide as undefined, never 0", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { data: [{ name: "views", values: [{ value: 42 }] }] }),
    );
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    const metrics = await adapter.getPostMetrics("account_1", "media_1");

    expect(metrics.impressions).toBe(42);
    expect(metrics.likes).toBeUndefined();
    expect(metrics.saves).toBeUndefined();
    expect(metrics.profileVisits).toBeUndefined();
    expect(metrics.linkClicks).toBeUndefined();
  });

  it("refuses to fetch metrics for a dry-run externalId", async () => {
    const fetchMock = vi.fn();
    const adapter = new ThreadsAdapter({ ...config, dryRun: false, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(adapter.getPostMetrics("account_1", "dryrun_abc")).rejects.toThrow(PlatformUnsupportedOperationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ThreadsAdapter unsupported operations", () => {
  it("deletePost throws PlatformUnsupportedOperationError rather than guessing at an endpoint", async () => {
    const adapter = new ThreadsAdapter({ ...config, dryRun: false });
    await expect(adapter.deletePost("account_1", "media_1")).rejects.toThrow(PlatformUnsupportedOperationError);
  });

  it("getPost throws PlatformUnsupportedOperationError rather than guessing at the response shape", async () => {
    const adapter = new ThreadsAdapter({ ...config, dryRun: false });
    await expect(adapter.getPost("account_1", "media_1")).rejects.toThrow(PlatformUnsupportedOperationError);
  });
});
