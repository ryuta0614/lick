import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generatePkcePair } from "../pkce";

describe("generatePkcePair", () => {
  it("derives code_challenge as the SHA-256/base64url hash of code_verifier (S256 method)", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expected);
  });

  it("produces a code_verifier within RFC 7636's 43-128 character range", () => {
    const { codeVerifier } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it("produces a fresh, unguessable pair on every call", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeChallenge).not.toBe(b.codeChallenge);
  });
});
