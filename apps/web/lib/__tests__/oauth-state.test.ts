import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "../oauth-state";

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

describe("OAuth state (CSRF protection)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-oauth-state-secret";
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("accepts a freshly created state when the cookie and query value match", () => {
    const { state } = createOAuthState();
    expect(verifyOAuthState(state, state)).toBe(true);
  });

  it("rejects when the query state doesn't match the cookie value", () => {
    const { state } = createOAuthState();
    const other = createOAuthState().state;
    expect(verifyOAuthState(state, other)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const { state } = createOAuthState();
    const [nonce, expiresAt] = state.split(".");
    const tampered = `${nonce}.${expiresAt}.tampered-signature`;
    expect(verifyOAuthState(tampered, tampered)).toBe(false);
  });

  it("rejects a tampered payload even if resigned incorrectly", () => {
    const { state } = createOAuthState();
    const parts = state.split(".");
    const forged = `different-nonce.${parts[1]}.${parts[2]}`;
    expect(verifyOAuthState(forged, forged)).toBe(false);
  });

  it("rejects an expired state", () => {
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() - 20 * 60 * 1000; // 20 minutes in the past
      const { state } = createOAuthState();
      Date.now = originalNow;
      expect(verifyOAuthState(state, state)).toBe(false);
    } finally {
      Date.now = originalNow;
    }
  });

  it("rejects when either value is missing", () => {
    const { state } = createOAuthState();
    expect(verifyOAuthState(undefined, state)).toBe(false);
    expect(verifyOAuthState(state, undefined)).toBe(false);
  });

  it("rejects a malformed cookie value", () => {
    expect(verifyOAuthState("not-a-valid-state", "not-a-valid-state")).toBe(false);
  });
});
