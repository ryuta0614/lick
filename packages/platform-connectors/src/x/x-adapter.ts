import type { NormalizedPost, NormalizedPostMetrics, PublishedPost, PublishPostInput, SocialPlatformAdapter } from "../types.js";
import { validateTextLength } from "../validation.js";

/**
 * Real X (Twitter) adapter — Phase 3 of the build order (CLAUDE.md section
 * 36). NOT wired into the app yet; only MockPlatformAdapter is used until
 * OAuth 2.0 PKCE user auth and token storage exist.
 *
 * Reference (official docs, not to be guessed at implementation time):
 * - POST https://api.x.com/2/tweets — create a post, authenticated with a
 *   user access token obtained via OAuth 2.0 Authorization Code + PKCE.
 * - DELETE https://api.x.com/2/tweets/:id
 * - GET https://api.x.com/2/tweets/:id — includes public_metrics for
 *   impressions/likes/replies/reposts when requested via tweet.fields.
 */
export class XAdapter implements SocialPlatformAdapter {
  readonly platform = "X" as const;

  async validateContent(input: PublishPostInput): Promise<void> {
    validateTextLength(this.platform, input);
  }

  publishPost(_accountId: string, _input: PublishPostInput): Promise<PublishedPost> {
    throw new Error("XAdapter.publishPost is not implemented yet (Phase 3 — see CLAUDE.md section 36)");
  }

  deletePost(_accountId: string, _externalPostId: string): Promise<void> {
    throw new Error("XAdapter.deletePost is not implemented yet (Phase 3 — see CLAUDE.md section 36)");
  }

  getPost(_accountId: string, _externalPostId: string): Promise<NormalizedPost> {
    throw new Error("XAdapter.getPost is not implemented yet (Phase 3 — see CLAUDE.md section 36)");
  }

  getPostMetrics(_accountId: string, _externalPostId: string): Promise<NormalizedPostMetrics> {
    throw new Error("XAdapter.getPostMetrics is not implemented yet (Phase 3 — see CLAUDE.md section 36)");
  }
}
