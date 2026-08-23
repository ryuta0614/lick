import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE (RFC 7636) code_verifier/code_challenge pair for the X OAuth 2.0
 * flow — X requires Authorization Code + PKCE for every app, confidential
 * or public. `codeVerifier` must be held server-side (an httpOnly cookie,
 * same as the CSRF `state` in lib/oauth-state.ts) until the token exchange.
 */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  // 32 random bytes -> 43-char base64url string, within the RFC's 43-128 char range.
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}
