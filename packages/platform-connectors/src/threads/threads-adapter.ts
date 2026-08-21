import type { NormalizedPost, NormalizedPostMetrics, PublishedPost, PublishPostInput, SocialPlatformAdapter } from "../types.js";
import { validateTextLength } from "../validation.js";

/**
 * Real Threads adapter — Phase 2 of the build order (CLAUDE.md section 36),
 * the first real platform to connect. NOT wired into the app yet.
 *
 * Reference (official Meta Threads API docs, not to be guessed at
 * implementation time):
 * - POST /{threads-user-id}/threads — create a media container (text post).
 * - POST /{threads-user-id}/threads_publish — publish the created container.
 * - GET /{thread-id}/insights — post-level metrics (views, likes, replies,
 *   reposts, quotes, shares).
 */
export class ThreadsAdapter implements SocialPlatformAdapter {
  readonly platform = "THREADS" as const;

  async validateContent(input: PublishPostInput): Promise<void> {
    validateTextLength(this.platform, input);
  }

  publishPost(_accountId: string, _input: PublishPostInput): Promise<PublishedPost> {
    throw new Error("ThreadsAdapter.publishPost is not implemented yet (Phase 2 — see CLAUDE.md section 36)");
  }

  deletePost(_accountId: string, _externalPostId: string): Promise<void> {
    throw new Error("ThreadsAdapter.deletePost is not implemented yet (Phase 2 — see CLAUDE.md section 36)");
  }

  getPost(_accountId: string, _externalPostId: string): Promise<NormalizedPost> {
    throw new Error("ThreadsAdapter.getPost is not implemented yet (Phase 2 — see CLAUDE.md section 36)");
  }

  getPostMetrics(_accountId: string, _externalPostId: string): Promise<NormalizedPostMetrics> {
    throw new Error("ThreadsAdapter.getPostMetrics is not implemented yet (Phase 2 — see CLAUDE.md section 36)");
  }
}
