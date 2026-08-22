import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

/**
 * Normalizes `ENCRYPTION_KEY` into a 32-byte AES-256 key. Accepts a
 * base64-encoded or hex-encoded 32-byte key directly; anything else
 * (an arbitrary passphrase) is folded into a 32-byte key via SHA-256 for
 * developer convenience. Production deployments should set a real random
 * 32-byte key (e.g. `openssl rand -base64 32`).
 */
function resolveEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set — required to encrypt/decrypt platform credentials");
  }

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === KEY_LENGTH_BYTES) return base64;

  const hex = /^[0-9a-fA-F]+$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.alloc(0);
  if (hex.length === KEY_LENGTH_BYTES) return hex;

  return createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Encrypts a secret (e.g. an OAuth access/refresh token) for storage in
 * `PlatformCredential.accessTokenEnc` / `refreshTokenEnc`
 * (CLAUDE.md section 29: "Platform credentials must be encrypted at rest").
 * Returns `iv.authTag.ciphertext`, each base64url-encoded.
 */
export function encryptSecret(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64url")).join(".");
}

/** Inverse of `encryptSecret`. Throws if the ciphertext is malformed or the auth tag doesn't match. */
export function decryptSecret(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret (expected iv.authTag.ciphertext)");
  }
  const [ivPart, authTagPart, ciphertextPart] = parts as [string, string, string];

  const key = resolveEncryptionKey();
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
