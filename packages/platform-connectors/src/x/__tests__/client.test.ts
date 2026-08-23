import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PlatformAuthError, PlatformServerError } from "@social-growth-os/shared";
import { xApiRequest, XApiClient } from "../client.js";

const config = { apiBaseUrl: "https://api.x.com" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("xApiRequest", () => {
  it("sends the access token via the Authorization header, never as a query param", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).not.toContain("secret-token-value");
      return jsonResponse(200, { id: "1" });
    });

    await xApiRequest(
      config,
      { method: "GET", path: "/2/users/me", accessToken: "secret-token-value" },
      z.object({ id: z.string() }),
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token-value");
  });

  it("sends a Basic auth header (not the bearer token) for the token endpoint when a client secret is configured", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Basic ${Buffer.from("client_id:client_secret").toString("base64")}`);
      return jsonResponse(200, { access_token: "tok" });
    });

    await xApiRequest(
      config,
      { method: "POST", path: "/2/oauth2/token", basicAuth: { username: "client_id", password: "client_secret" }, formBody: { grant_type: "refresh_token" } },
      z.object({ access_token: z.string() }),
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends jsonBody as a JSON-encoded request with Content-Type: application/json", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body as string)).toEqual({ text: "hello" });
      return jsonResponse(200, { data: { id: "1" } });
    });

    await xApiRequest(
      config,
      { method: "POST", path: "/2/tweets", accessToken: "t", jsonBody: { text: "hello" } },
      z.object({ data: z.object({ id: z.string() }) }),
      fetchMock as unknown as typeof fetch,
    );
  });

  it("throws PlatformServerError when the response doesn't match the expected schema", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    await expect(
      xApiRequest(config, { method: "GET", path: "/2/users/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("wraps a fetch()-level network failure as a retryable server error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      xApiRequest(config, { method: "GET", path: "/2/users/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("classifies a non-2xx response into the app error taxonomy", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { title: "expired" }));
    await expect(
      xApiRequest(config, { method: "GET", path: "/2/users/me" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformAuthError);
  });
});

describe("XApiClient", () => {
  it("creates a tweet with a single POST /2/tweets call", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://api.x.com/2/tweets");
      expect(JSON.parse(init.body as string)).toEqual({ text: "hello world" });
      return jsonResponse(200, { data: { id: "tweet_1", text: "hello world" } });
    });

    const client = new XApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.createTweet("token", "hello world");
    expect(result.id).toBe("tweet_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes a tweet via DELETE /2/tweets/:id", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://api.x.com/2/tweets/tweet_1");
      expect(init.method).toBe("DELETE");
      return jsonResponse(200, { data: { deleted: true } });
    });

    const client = new XApiClient(config, fetchMock as unknown as typeof fetch);
    await client.deleteTweet("token", "tweet_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes a tweet fetch, leaving unavailable metrics undefined rather than 0", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).toContain("tweet.fields=public_metrics%2Ccreated_at");
      return jsonResponse(200, {
        data: {
          id: "tweet_1",
          text: "hi",
          created_at: "2026-01-01T00:00:00.000Z",
          public_metrics: { like_count: 5, impression_count: 100 },
        },
      });
    });

    const client = new XApiClient(config, fetchMock as unknown as typeof fetch);
    const tweet = await client.getTweet("token", "tweet_1");
    expect(tweet.publicMetrics?.like_count).toBe(5);
    expect(tweet.publicMetrics?.impression_count).toBe(100);
    expect(tweet.publicMetrics?.retweet_count).toBeUndefined();
    expect(tweet.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});
