import { describe, expect, it, vi } from "vitest";
import { buildInstagramAuthorizeUrl, exchangeForLongLivedInstagramToken, exchangeInstagramCodeForToken } from "../oauth.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildInstagramAuthorizeUrl", () => {
  it("builds an authorize URL with the required scopes and a state param", () => {
    const url = buildInstagramAuthorizeUrl(
      { clientId: "app_123", redirectUri: "https://example.com/callback" },
      "signed-state-value",
      {} as NodeJS.ProcessEnv,
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://www.facebook.com");
    expect(parsed.pathname).toBe("/dialog/oauth");
    expect(parsed.searchParams.get("client_id")).toBe("app_123");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("signed-state-value");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(parsed.searchParams.get("scope")).toContain("pages_show_list");
  });
});

describe("exchangeInstagramCodeForToken", () => {
  it("requests the authorization code exchange and returns the short-lived user token", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("code")).toBe("auth_code_1");
      expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
      return jsonResponse(200, { access_token: "short_lived_token", expires_in: 3600 });
    });

    const result = await exchangeInstagramCodeForToken(
      { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v21.0", clientId: "id", clientSecret: "secret", redirectUri: "https://x/cb" },
      "auth_code_1",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("short_lived_token");
  });
});

describe("exchangeForLongLivedInstagramToken", () => {
  it("computes expiresAt from expires_in", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("grant_type")).toBe("fb_exchange_token");
      expect(url.searchParams.get("fb_exchange_token")).toBe("short_lived");
      return jsonResponse(200, { access_token: "long_lived", expires_in: 5_184_000 });
    });
    const before = Date.now();

    const result = await exchangeForLongLivedInstagramToken(
      { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v21.0", clientId: "id", clientSecret: "secret" },
      "short_lived",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("long_lived");
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 5_184_000 * 1000);
  });

  it("falls back to a 60-day expiry when expires_in is absent", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: "long_lived" }));
    const before = Date.now();

    const result = await exchangeForLongLivedInstagramToken(
      { apiBaseUrl: "https://graph.facebook.com", apiVersion: "v21.0", clientId: "id", clientSecret: "secret" },
      "short_lived",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 59 * 24 * 60 * 60 * 1000);
  });
});
