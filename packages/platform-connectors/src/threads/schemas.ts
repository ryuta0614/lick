import { z } from "zod";

/** Response of POST /{threads-user-id}/threads (container creation). */
export const ThreadsContainerResponseSchema = z.object({
  id: z.string(),
});
export type ThreadsContainerResponse = z.infer<typeof ThreadsContainerResponseSchema>;

/** Response of POST /{threads-user-id}/threads_publish. */
export const ThreadsPublishResponseSchema = z.object({
  id: z.string(),
});
export type ThreadsPublishResponse = z.infer<typeof ThreadsPublishResponseSchema>;

/** Response of GET /me (or /{id}) fetched right after OAuth to identify the account. */
export const ThreadsUserResponseSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
});
export type ThreadsUserResponse = z.infer<typeof ThreadsUserResponseSchema>;

/** Response of GET /{media-id}/insights?metric=... */
export const ThreadsInsightsResponseSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      period: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      values: z.array(z.object({ value: z.number() })).optional(),
      // Some Graph API insight rows use `total_value.value` instead of `values[]`.
      total_value: z.object({ value: z.number() }).optional(),
    }),
  ),
});
export type ThreadsInsightsResponse = z.infer<typeof ThreadsInsightsResponseSchema>;

/** Response of POST https://graph.threads.net/oauth/access_token (short-lived, ~1h). */
export const ThreadsShortLivedTokenResponseSchema = z.object({
  access_token: z.string(),
  user_id: z.union([z.string(), z.number()]).optional(),
  token_type: z.string().optional(),
});
export type ThreadsShortLivedTokenResponse = z.infer<typeof ThreadsShortLivedTokenResponseSchema>;

/** Response of GET https://graph.threads.net/access_token?grant_type=th_exchange_token (long-lived, ~60d). */
export const ThreadsLongLivedTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number(),
});
export type ThreadsLongLivedTokenResponse = z.infer<typeof ThreadsLongLivedTokenResponseSchema>;

/** Standard Graph API error envelope, present on non-2xx responses. */
export const ThreadsApiErrorBodySchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});
export type ThreadsApiErrorBody = z.infer<typeof ThreadsApiErrorBodySchema>;
