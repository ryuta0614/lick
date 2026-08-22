import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../crypto.js";

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

describe("encryptSecret / decryptSecret", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-not-for-prod";
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("round-trips a plaintext secret", () => {
    const encrypted = encryptSecret("super-secret-access-token");
    expect(encrypted).not.toContain("super-secret-access-token");
    expect(decryptSecret(encrypted)).toBe("super-secret-access-token");
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptSecret("same-token");
    const b = encryptSecret("same-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-token");
    expect(decryptSecret(b)).toBe("same-token");
  });

  it("works with a proper 32-byte base64 key", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("token-with-real-key");
    expect(decryptSecret(encrypted)).toBe("token-with-real-key");
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws on malformed ciphertext", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow();
  });

  it("throws when decrypting with a different key (auth tag mismatch)", () => {
    const encrypted = encryptSecret("token-a");
    process.env.ENCRYPTION_KEY = "a-completely-different-key";
    expect(() => decryptSecret(encrypted)).toThrow();
  });
});
