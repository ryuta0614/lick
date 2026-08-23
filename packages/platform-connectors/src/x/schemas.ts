import { z } from "zod";

/** Response of POST /2/oauth2/token (both the authorization_code and refresh_token grants). */
export const XTokenResponseSchema = z.object({
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  access_token: z.string(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
});
export type XTokenResponse = z.infer<typeof XTokenResponseSchema>;

/** Response of GET /2/users/me. */
export const XUserResponseSchema = z.object({
  data: z.object({ id: z.string(), username: z.string().optional(), name: z.string().optional() }),
});
export type XUserResponse = z.infer<typeof XUserResponseSchema>;

/** Response of POST /2/tweets. */
export const XTweetCreateResponseSchema = z.object({
  data: z.object({ id: z.string(), text: z.string().optional() }),
});
export type XTweetCreateResponse = z.infer<typeof XTweetCreateResponseSchema>;

/** Response of GET /2/tweets/:id?tweet.fields=public_metrics,created_at. */
export const XTweetGetResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    text: z.string().optional(),
    created_at: z.string().optional(),
    public_metrics: z
      .object({
        retweet_count: z.number().optional(),
        reply_count: z.number().optional(),
        like_count: z.number().optional(),
        quote_count: z.number().optional(),
        bookmark_count: z.number().optional(),
        impression_count: z.number().optional(),
      })
      .optional(),
  }),
});
export type XTweetGetResponse = z.infer<typeof XTweetGetResponseSchema>;

/** Response of DELETE /2/tweets/:id. */
export const XDeleteResponseSchema = z.object({
  data: z.object({ deleted: z.boolean() }),
});
export type XDeleteResponse = z.infer<typeof XDeleteResponseSchema>;

/**
 * X API v2 errors come back either as a "Problem Details" object
 * (title/detail/type/status) or a legacy `{ errors: [...] }` array,
 * depending on the endpoint — this accepts both loosely; classification
 * mainly relies on the HTTP status code, this is only used for the message.
 */
export const XApiErrorBodySchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  type: z.string().optional(),
  status: z.number().optional(),
  errors: z.array(z.object({ message: z.string().optional(), code: z.number().optional() })).optional(),
});
export type XApiErrorBody = z.infer<typeof XApiErrorBodySchema>;
