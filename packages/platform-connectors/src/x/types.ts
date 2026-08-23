export type XTweet = {
  id: string;
  text?: string;
  createdAt?: Date;
};

export type XUserIdentity = {
  id: string;
  username?: string;
  name?: string;
};

/**
 * Normalized subset of X's public_metrics this app understands. Fields X
 * doesn't return are simply absent — callers must not coerce a missing
 * metric to 0 (CLAUDE.md section 19).
 */
export type XPostInsights = {
  impressions?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  bookmarks?: number;
};

export type XTokenExchangeResult = {
  accessToken: string;
  /** Present when the `offline.access` scope was granted; absent otherwise. */
  refreshToken?: string;
  expiresAt: Date;
};
