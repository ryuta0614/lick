import { describe, expect, it } from "vitest";
import { PlatformAuthError, PlatformRateLimitError, PlatformServerError, PlatformValidationError } from "@social-growth-os/shared";
import { classifyXErrorResponse, wrapXNetworkError, XNetworkError } from "../errors.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("classifyXErrorResponse", () => {
  it("maps HTTP 401 to PlatformAuthError", async () => {
    const error = await classifyXErrorResponse(jsonResponse(401, { title: "Unauthorized", detail: "bad token" }));
    expect(error).toBeInstanceOf(PlatformAuthError);
    expect(error.message).toContain("bad token");
  });

  it("maps HTTP 429 to PlatformRateLimitError with retryAfterMs from the header", async () => {
    const error = await classifyXErrorResponse(
      jsonResponse(429, { title: "Too Many Requests" }, { "retry-after": "30" }),
    );
    expect(error).toBeInstanceOf(PlatformRateLimitError);
    expect((error as PlatformRateLimitError).retryAfterMs).toBe(30_000);
  });

  it("maps HTTP 5xx to PlatformServerError (retryable)", async () => {
    const error = await classifyXErrorResponse(jsonResponse(503, { title: "down" }));
    expect(error).toBeInstanceOf(PlatformServerError);
  });

  it("maps a generic HTTP 400 to PlatformValidationError (non-retryable)", async () => {
    const error = await classifyXErrorResponse(jsonResponse(400, { detail: "bad text" }));
    expect(error).toBeInstanceOf(PlatformValidationError);
    expect(error.message).toContain("bad text");
  });

  it("falls back to the legacy errors[] array shape when present", async () => {
    const error = await classifyXErrorResponse(jsonResponse(403, { errors: [{ message: "forbidden thing" }] }));
    expect(error).toBeInstanceOf(PlatformValidationError);
    expect(error.message).toContain("forbidden thing");
  });

  it("falls back gracefully when the error body isn't the expected shape", async () => {
    const error = await classifyXErrorResponse(new Response("not json", { status: 400 }));
    expect(error).toBeInstanceOf(PlatformValidationError);
    expect(error.message).toContain("400");
  });
});

describe("wrapXNetworkError", () => {
  it("produces an XNetworkError distinguishable from a definitive HTTP error", () => {
    const error = wrapXNetworkError(new TypeError("fetch failed"), "POST /2/tweets");
    expect(error).toBeInstanceOf(XNetworkError);
    expect(error).toBeInstanceOf(PlatformServerError);
    expect(error.message).toContain("POST /2/tweets");
  });
});
