import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PlatformAuthError, PlatformServerError } from "@social-growth-os/shared";
import { threadsApiRequest, ThreadsApiClient } from "../client.js";

const config = { apiBaseUrl: "https://graph.threads.net", apiVersion: "v1.0" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("threadsApiRequest", () => {
  it("sends the access token via the Authorization header, never as a query param", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).not.toContain("secret-token-value");
      return jsonResponse(200, { id: "1" });
    });

    await threadsApiRequest(
      config,
      { method: "GET", path: "/me", accessToken: "secret-token-value" },
      z.object({ id: z.string() }),
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token-value");
  });

  it("throws PlatformServerError when the response doesn't match the expected schema", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    await expect(
      threadsApiRequest(config, { method: "GET", path: "/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("wraps a fetch()-level network failure as a retryable server error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      threadsApiRequest(config, { method: "GET", path: "/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("classifies a non-2xx response into the app error taxonomy", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: { message: "expired" } }));
    await expect(
      threadsApiRequest(config, { method: "GET", path: "/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformAuthError);
  });

  it("does not double-slash an unversioned OAuth-style base URL override", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).toBe("https://graph.threads.net/oauth/access_token");
      return jsonResponse(200, { access_token: "x" });
    });
    await threadsApiRequest(
      { apiBaseUrl: config.apiBaseUrl, apiVersion: "" },
      { method: "POST", path: "/oauth/access_token", baseUrlOverride: config.apiBaseUrl },
      z.object({ access_token: z.string() }),
      fetchMock as unknown as typeof fetch,
    );
  });
});

describe("ThreadsApiClient", () => {
  it("creates a text container with media_type=TEXT", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://graph.threads.net/v1.0/123/threads");
      const body = new URLSearchParams(init.body as string);
      expect(body.get("media_type")).toBe("TEXT");
      expect(body.get("text")).toBe("hello world");
      return jsonResponse(200, { id: "container_1" });
    });

    const client = new ThreadsApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.createTextContainer("123", "token", "hello world");
    expect(result.id).toBe("container_1");
  });

  it("publishes a container via a separate threads_publish call", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://graph.threads.net/v1.0/123/threads_publish");
      const body = new URLSearchParams(init.body as string);
      expect(body.get("creation_id")).toBe("container_1");
      return jsonResponse(200, { id: "published_1" });
    });

    const client = new ThreadsApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.publishContainer("123", "token", "container_1");
    expect(result.id).toBe("published_1");
  });

  it("normalizes insights, leaving unavailable metrics undefined rather than 0", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: [
          { name: "views", values: [{ value: 100 }] },
          { name: "likes", values: [{ value: 5 }] },
          // "replies" and "reposts" intentionally absent from this response.
        ],
      }),
    );
    const client = new ThreadsApiClient(config, fetchMock as unknown as typeof fetch);
    const insights = await client.getInsights("media_1", "token");
    expect(insights.views).toBe(100);
    expect(insights.likes).toBe(5);
    expect(insights.replies).toBeUndefined();
    expect(insights.reposts).toBeUndefined();
  });
});
