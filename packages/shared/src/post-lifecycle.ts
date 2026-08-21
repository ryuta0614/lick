import type { PostStatus } from "./enums.js";

/**
 * Allowed forward transitions for a Post. Anything not listed here is
 * rejected by `assertTransition` / `transitionPost`. PUBLISHED and REJECTED
 * are terminal states.
 */
export const POST_STATUS_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  DRAFT: ["REVIEW", "REJECTED"],
  REVIEW: ["DRAFT", "APPROVED", "REJECTED"],
  APPROVED: ["SCHEDULED", "QUEUED", "REJECTED"],
  SCHEDULED: ["QUEUED", "REJECTED"],
  QUEUED: ["PUBLISHING", "REJECTED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  FAILED: ["QUEUED", "REJECTED"],
  PUBLISHED: [],
  REJECTED: [],
};

export class InvalidPostTransitionError extends Error {
  constructor(
    public readonly from: PostStatus,
    public readonly to: PostStatus,
  ) {
    super(`Invalid post status transition: ${from} -> ${to}`);
    this.name = "InvalidPostTransitionError";
  }
}

export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return POST_STATUS_TRANSITIONS[from].includes(to);
}

/** Throws InvalidPostTransitionError when the transition is not allowed. */
export function assertPostTransition(from: PostStatus, to: PostStatus): void {
  if (!canTransitionPost(from, to)) {
    throw new InvalidPostTransitionError(from, to);
  }
}
