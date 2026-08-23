import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PlatformAuthError, PlatformServerError } from "@social-growth-os/shared";
import { instagramApiRequest, InstagramApiClient } from "../client.js";

const config = { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v21.0" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("instagramApiRequest", () => {
  it("sends the access token via the Authorization header, never as a query param", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).not.toContain("secret-token-value");
      return jsonResponse(200, { id: "1" });
    });

    await instagramApiRequest(
      config,
      { method: "GET", path: "/123", accessToken: "secret-token-value" },
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
      instagramApiRequest(config, { method: "GET", path: "/123" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("wraps a fetch()-level network failure as a retryable server error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      instagramApiRequest(config, { method: "GET", path: "/123" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformServerError);
  });

  it("classifies a non-2xx response into the app error taxonomy", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: { message: "expired" } }));
    await expect(
      instagramApiRequest(config, { method: "GET", path: "/123" }, z.object({ id: z.string() }), fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(PlatformAuthError);
  });

  it("does not double-slash an unversioned OAuth-style base URL override", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).toBe("https://graph.facebook.com/oauth/access_token");
      return jsonResponse(200, { access_token: "x" });
    });
    await instagramApiRequest(
      { apiBaseUrl: config.apiBaseUrl, apiVersion: "" },
      { method: "GET", path: "/oauth/access_token", baseUrlOverride: config.apiBaseUrl },
      z.object({ access_token: z.string() }),
      fetchMock as unknown as typeof fetch,
    );
  });
});

describe("InstagramApiClient", () => {
  it("creates a single-image container with image_url and caption", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://graph.facebook.com/v21.0/ig_123/media");
      const body = new URLSearchParams(init.body as string);
      expect(body.get("image_url")).toBe("https://example.com/img.png");
      expect(body.get("caption")).toBe("hello world");
      return jsonResponse(200, { id: "container_1" });
    });

    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.createImageContainer("ig_123", "token", "https://example.com/img.png", "hello world");
    expect(result.id).toBe("container_1");
  });

  it("creates carousel item containers with is_carousel_item=true and no caption", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = new URLSearchParams(init.body as string);
      expect(body.get("is_carousel_item")).toBe("true");
      expect(body.has("caption")).toBe(false);
      return jsonResponse(200, { id: "child_1" });
    });

    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.createCarouselItemContainer("ig_123", "token", "https://example.com/img1.png");
    expect(result.id).toBe("child_1");
  });

  it("creates a carousel parent container referencing its children", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = new URLSearchParams(init.body as string);
      expect(body.get("media_type")).toBe("CAROUSEL");
      expect(body.get("children")).toBe("child_1,child_2");
      expect(body.get("caption")).toBe("carousel caption");
      return jsonResponse(200, { id: "carousel_1" });
    });

    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.createCarouselContainer("ig_123", "token", ["child_1", "child_2"], "carousel caption");
    expect(result.id).toBe("carousel_1");
  });

  it("publishes a container via a separate media_publish call", async () => {
    const fetchMock = vi.fn(async (url: URL, init: RequestInit) => {
      expect(String(url)).toBe("https://graph.facebook.com/v21.0/ig_123/media_publish");
      const body = new URLSearchParams(init.body as string);
      expect(body.get("creation_id")).toBe("container_1");
      return jsonResponse(200, { id: "published_1" });
    });

    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.publishContainer("ig_123", "token", "container_1");
    expect(result.id).toBe("published_1");
  });

  it("normalizes insights, leaving unavailable metrics undefined rather than 0", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: [
          { name: "impressions", values: [{ value: 500 }] },
          { name: "likes", values: [{ value: 20 }] },
          // "comments", "saved", "reach", "shares" intentionally absent from this response.
        ],
      }),
    );
    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const insights = await client.getInsights("media_1", "token");
    expect(insights.impressions).toBe(500);
    expect(insights.likes).toBe(20);
    expect(insights.comments).toBeUndefined();
    expect(insights.saved).toBeUndefined();
  });

  it("maps /me/accounts into Facebook Pages with their linked Instagram Business Account", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: [
          { id: "page_1", name: "My Page", access_token: "page_token_1", instagram_business_account: { id: "ig_123" } },
          { id: "page_2", name: "No IG Page", access_token: "page_token_2" },
        ],
      }),
    );
    const client = new InstagramApiClient(config, fetchMock as unknown as typeof fetch);
    const pages = await client.getFacebookPages("user_token");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ pageId: "page_1", pageName: "My Page", pageAccessToken: "page_token_1", instagramBusinessAccountId: "ig_123" });
    expect(pages[1]?.instagramBusinessAccountId).toBeUndefined();
  });
});
