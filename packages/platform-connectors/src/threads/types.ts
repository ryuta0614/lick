export type ThreadsTextContainer = {
  id: string;
};

export type ThreadsPublishedPost = {
  id: string;
};

export type ThreadsUserIdentity = {
  id: string;
  username?: string;
};

/**
 * Normalized subset of Threads insights this app understands. Fields the
 * API doesn't provide for a given metric set are simply absent — callers
 * must not coerce a missing metric to 0 (CLAUDE.md section 19).
 */
export type ThreadsPostInsights = {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
};

export type ThreadsTokenExchangeResult = {
  accessToken: string;
  /** Present on the short-lived token response; absent on the long-lived exchange response. */
  userId?: string;
};

export type ThreadsLongLivedToken = {
  accessToken: string;
  expiresAt: Date;
};
