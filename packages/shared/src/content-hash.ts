import { createHash } from "node:crypto";

/**
 * Deterministic hash used for `Post.contentHash` so the same text can never
 * be scheduled/published twice for the same social account (see
 * `@@unique([socialAccountId, contentHash])` in the Prisma schema).
 */
export function computeContentHash(socialAccountId: string, text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256").update(`${socialAccountId}:${normalized}`).digest("hex");
}
