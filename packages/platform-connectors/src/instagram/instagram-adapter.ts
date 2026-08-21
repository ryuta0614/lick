import type { NormalizedPost, NormalizedPostMetrics, PublishedPost, PublishPostInput, SocialPlatformAdapter } from "../types.js";
import { validateTextLength } from "../validation.js";

/**
 * Real Instagram adapter — Phase 4 of the build order (CLAUDE.md section
 * 36). NOT wired into the app yet.
 *
 * Reference (official Meta Instagram Content Publishing API docs, not to be
 * guessed at implementation time):
 * - Requires an Instagram Professional (Business/Creator) account linked to
 *   a Facebook Page.
 * - POST /{ig-user-id}/media — create a media container; images/video must
 *   reference a publicly reachable URL (S3/R2 public URL per section 5).
 * - POST /{ig-user-id}/media_publish — publish the created container.
 * - Carousels: create child item containers first, then a carousel
 *   container referencing them via children.
 * - GET /{ig-media-id}/insights — post-level metrics.
 */
export class InstagramAdapter implements SocialPlatformAdapter {
  readonly platform = "INSTAGRAM" as const;

  async validateContent(input: PublishPostInput): Promise<void> {
    validateTextLength(this.platform, input);
  }

  publishPost(_accountId: string, _input: PublishPostInput): Promise<PublishedPost> {
    throw new Error("InstagramAdapter.publishPost is not implemented yet (Phase 4 — see CLAUDE.md section 36)");
  }

  deletePost(_accountId: string, _externalPostId: string): Promise<void> {
    throw new Error("InstagramAdapter.deletePost is not implemented yet (Phase 4 — see CLAUDE.md section 36)");
  }

  getPost(_accountId: string, _externalPostId: string): Promise<NormalizedPost> {
    throw new Error("InstagramAdapter.getPost is not implemented yet (Phase 4 — see CLAUDE.md section 36)");
  }

  getPostMetrics(_accountId: string, _externalPostId: string): Promise<NormalizedPostMetrics> {
    throw new Error("InstagramAdapter.getPostMetrics is not implemented yet (Phase 4 — see CLAUDE.md section 36)");
  }
}
