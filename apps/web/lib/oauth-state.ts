import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OAUTH_STATE_COOKIE_NAME = "threads_oauth_state";
/** X's OAuth flow additionally needs a PKCE code_verifier cookie — see lib/pkce.ts and X_PKCE_VERIFIER_COOKIE_NAME below. */
export const X_OAUTH_STATE_COOKIE_NAME = "x_oauth_state";
export const X_PKCE_VERIFIER_COOKIE_NAME = "x_pkce_verifier";
const STATE_TTL_SECONDS = 10 * 60; // short-lived per CLAUDE.md STEP 6

function getStateSecret(): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY is not set — required to sign OAuth state");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

/**
 * CSRF protection for the Threads OAuth flow (CLAUDE.md STEP 6): a signed,
 * short-lived, single-use-in-spirit nonce is both set as an httpOnly cookie
 * and passed as the `state` query param to Meta. The callback only
 * succeeds if the two match AND the signature/expiry are valid — an
 * attacker who can only guess or replay a `state` value (without also
 * controlling the victim's cookie jar) cannot forge this.
 */
export function createOAuthState(): { state: string; maxAgeSeconds: number } {
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + STATE_TTL_SECONDS * 1000;
  const payload = `${nonce}.${expiresAt}`;
  const state = `${payload}.${sign(payload)}`;
  return { state, maxAgeSeconds: STATE_TTL_SECONDS };
}

export function verifyOAuthState(cookieValue: string | undefined, queryState: string | undefined): boolean {
  if (!cookieValue || !queryState) return false;
  if (!constantTimeEqual(cookieValue, queryState)) return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiresAtRaw, signature] = parts as [string, string, string];

  const expectedSignature = sign(`${nonce}.${expiresAtRaw}`);
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && Date.now() <= expiresAt;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
