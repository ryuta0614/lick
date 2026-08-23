import { z } from "zod";

/** Response of POST /{ig-user-id}/media (container creation, single image or carousel item/parent). */
export const InstagramContainerResponseSchema = z.object({
  id: z.string(),
});
export type InstagramContainerResponse = z.infer<typeof InstagramContainerResponseSchema>;

/** Response of POST /{ig-user-id}/media_publish. */
export const InstagramPublishResponseSchema = z.object({
  id: z.string(),
});
export type InstagramPublishResponse = z.infer<typeof InstagramPublishResponseSchema>;

/** Response of GET /{ig-user-id}?fields=id,username (identifies the connected Instagram Business Account). */
export const InstagramUserResponseSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
});
export type InstagramUserResponse = z.infer<typeof InstagramUserResponseSchema>;

/** Response of GET /{media-id}?fields=id,caption,timestamp,permalink,media_type. */
export const InstagramMediaResponseSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
  timestamp: z.string().optional(),
  permalink: z.string().optional(),
  media_type: z.string().optional(),
});
export type InstagramMediaResponse = z.infer<typeof InstagramMediaResponseSchema>;

/** Response of GET /{media-id}/insights?metric=... — same shape family as Threads' insights. */
export const InstagramInsightsResponseSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      period: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      values: z.array(z.object({ value: z.number() })).optional(),
      total_value: z.object({ value: z.number() }).optional(),
    }),
  ),
});
export type InstagramInsightsResponse = z.infer<typeof InstagramInsightsResponseSchema>;

/** Response of GET /me/accounts?fields=id,name,access_token,instagram_business_account — the Facebook Pages the user manages. */
export const InstagramPagesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      /** Page access token — required to publish to that Page's linked Instagram Business Account. */
      access_token: z.string(),
      instagram_business_account: z.object({ id: z.string() }).optional(),
    }),
  ),
});
export type InstagramPagesResponse = z.infer<typeof InstagramPagesResponseSchema>;

/** Response of GET /oauth/access_token (both the code exchange and the long-lived fb_exchange_token grant). */
export const InstagramTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});
export type InstagramTokenResponse = z.infer<typeof InstagramTokenResponseSchema>;

/** Standard Graph API error envelope — Instagram Content Publishing runs on the same Graph API family as Threads. */
export const InstagramApiErrorBodySchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});
export type InstagramApiErrorBody = z.infer<typeof InstagramApiErrorBodySchema>;
