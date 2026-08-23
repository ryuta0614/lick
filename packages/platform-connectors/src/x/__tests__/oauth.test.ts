import { describe, expect, it, vi } from "vitest";
import { buildXAuthorizeUrl, exchangeXCodeForToken, refreshXAccessToken } from "../oauth.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildXAuthorizeUrl", () => {
  it("builds an authorize URL with PKCE params, required scopes, and a state param", () => {
    const url = buildXAuthorizeUrl(
      { clientId: "client_123", redirectUri: "https://example.com/callback" },
      "signed-state-value",
      "challenge-value",
      {} as NodeJS.ProcessEnv,
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://twitter.com");
    expect(parsed.pathname).toBe("/i/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("client_123");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("signed-state-value");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("scope")).toContain("tweet.write");
    expect(parsed.searchParams.get("scope")).toContain("offline.access");
  });
});

describe("exchangeXCodeForToken", () => {
  it("posts the authorization code and code_verifier, and returns the access/refresh tokens", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = new URLSearchParams(init.body as string);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("auth_code_1");
      expect(body.get("code_verifier")).toBe("verifier_1");
      expect(body.get("client_id")).toBe("client_123");
      return jsonResponse(200, { access_token: "access_1", refresh_token: "refresh_1", expires_in: 7200 });
    });

    const result = await exchangeXCodeForToken(
      { apiBaseUrl: "https://api.x.com", clientId: "client_123", clientSecret: undefined, redirectUri: "https://x/cb" },
      "auth_code_1",
      "verifier_1",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("access_1");
    expect(result.refreshToken).toBe("refresh_1");
  });

  it("authenticates with HTTP Basic when a client secret is configured (confidential client)", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Basic ${Buffer.from("client_123:shh").toString("base64")}`);
      return jsonResponse(200, { access_token: "access_1", expires_in: 7200 });
    });

    await exchangeXCodeForToken(
      { apiBaseUrl: "https://api.x.com", clientId: "client_123", clientSecret: "shh", redirectUri: "https://x/cb" },
      "auth_code_1",
      "verifier_1",
      fetchMock as unknown as typeof fetch,
    );
  });
});

describe("refreshXAccessToken", () => {
  it("refreshes and returns a new expiry", async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = new URLSearchParams(init.body as string);
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("old_refresh");
      return jsonResponse(200, { access_token: "refreshed", expires_in: 100 });
    });
    const before = Date.now();

    const result = await refreshXAccessToken(
      { apiBaseUrl: "https://api.x.com", clientId: "client_123", clientSecret: undefined },
      "old_refresh",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.accessToken).toBe("refreshed");
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 100 * 1000);
  });
});
