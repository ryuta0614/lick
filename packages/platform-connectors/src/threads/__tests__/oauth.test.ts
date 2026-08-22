import { describe, expect, it, vi } from "vitest";
import { buildThreadsAuthorizeUrl, exchangeCodeForToken, exchangeForLongLivedToken, refreshLongLivedToken } from "../oauth.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildThreadsAuthorizeUrl", () => {
  it("builds an authorize URL with the required scopes and a state param", () => {
    const url = buildThreadsAuthorizeUrl(
      { clientId: "app_123", redirectUri: "https://example.com/callback" },
      "signed-state-value",
      {} as NodeJS.ProcessEnv,
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://threads.net");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("app_123");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("signed-state-value");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toContain("threads_content_publish");
  });
});

describe("exchangeCodeForToken", () => {
  it("posts the authorization code and returns the short-lived token", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = new URLSearchParams(init.body as string);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("auth_code_1");
      return jsonResponse(200, { access_token: "short_lived_token", user_id: 555 });
    });

    const result = await exchangeCodeForToken(
      { apiBaseUrl: "https://graph.threads.net", clientId: "id", clientSecret: "secret", redirectUri: "https://x/cb" },
      "auth_code_1",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("short_lived_token");
    expect(result.userId).toBe("555");
  });
});

describe("exchangeForLongLivedToken", () => {
  it("computes expiresAt from expires_in", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: "long_lived", expires_in: 5_184_000 }));
    const before = Date.now();

    const result = await exchangeForLongLivedToken(
      { apiBaseUrl: "https://graph.threads.net", clientSecret: "secret" },
      "short_lived",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("long_lived");
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 5_184_000 * 1000);
  });
});

describe("refreshLongLivedToken", () => {
  it("refreshes and returns a new expiry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: "refreshed", expires_in: 100 }));
    const result = await refreshLongLivedToken(
      { apiBaseUrl: "https://graph.threads.net" },
      "old_token",
      fetchMock as unknown as typeof fetch,
    );
    expect(result.accessToken).toBe("refreshed");
  });
});
