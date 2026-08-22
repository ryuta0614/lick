import { describe, expect, it } from "vitest";
import { PlatformAuthError, PlatformRateLimitError, PlatformServerError, PlatformValidationError } from "@social-growth-os/shared";
import { classifyThreadsErrorResponse, ThreadsNetworkError, wrapNetworkError } from "../errors.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("classifyThreadsErrorResponse", () => {
  it("maps HTTP 401 to PlatformAuthError", async () => {
    const error = await classifyThreadsErrorResponse(jsonResponse(401, { error: { message: "bad token" } }));
    expect(error).toBeInstanceOf(PlatformAuthError);
    expect(error.message).toContain("bad token");
  });

  it("maps Graph API error code 190 to PlatformAuthError regardless of HTTP status", async () => {
    const error = await classifyThreadsErrorResponse(jsonResponse(400, { error: { message: "Invalid OAuth access token", code: 190 } }));
    expect(error).toBeInstanceOf(PlatformAuthError);
  });

  it("maps HTTP 429 to PlatformRateLimitError with retryAfterMs from the header", async () => {
    const error = await classifyThreadsErrorResponse(
      jsonResponse(429, { error: { message: "rate limited" } }, { "retry-after": "30" }),
    );
    expect(error).toBeInstanceOf(PlatformRateLimitError);
    expect((error as PlatformRateLimitError).retryAfterMs).toBe(30_000);
  });

  it("maps known Graph API rate-limit codes to PlatformRateLimitError", async () => {
    for (const code of [4, 17, 32, 613]) {
      const error = await classifyThreadsErrorResponse(jsonResponse(400, { error: { message: "limited", code } }));
      expect(error).toBeInstanceOf(PlatformRateLimitError);
    }
  });

  it("maps HTTP 5xx to PlatformServerError (retryable)", async () => {
    const error = await classifyThreadsErrorResponse(jsonResponse(503, { error: { message: "down" } }));
    expect(error).toBeInstanceOf(PlatformServerError);
  });

  it("maps a generic HTTP 400 to PlatformValidationError (non-retryable)", async () => {
    const error = await classifyThreadsErrorResponse(jsonResponse(400, { error: { message: "bad text" } }));
    expect(error).toBeInstanceOf(PlatformValidationError);
  });

  it("falls back gracefully when the error body isn't the expected shape", async () => {
    const error = await classifyThreadsErrorResponse(new Response("not json", { status: 400 }));
    expect(error).toBeInstanceOf(PlatformValidationError);
    expect(error.message).toContain("400");
  });
});

describe("wrapNetworkError", () => {
  it("produces a ThreadsNetworkError distinguishable from a definitive HTTP error", () => {
    const error = wrapNetworkError(new TypeError("fetch failed"), "POST /x/threads");
    expect(error).toBeInstanceOf(ThreadsNetworkError);
    expect(error).toBeInstanceOf(PlatformServerError);
    expect(error.message).toContain("POST /x/threads");
  });
});
