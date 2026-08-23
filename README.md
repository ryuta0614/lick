# Social Growth OS

AI-powered autonomous social media growth system (X / Threads / Instagram). See
[`CLAUDE.md`](./CLAUDE.md) for the full product spec — this README covers
running the MVP backbone locally.

**Current status**: Phase 1 (Mock MVP) is complete and verified end-to-end.
Phase 2 adds a real Threads connection (OAuth, text publishing, insights),
and Phase 3 adds a real X connection (OAuth 2.0 + PKCE, tweet publishing,
delete, public metrics) — both behind the same pipeline, gated off by
default; see "Threads connection" and "X connection" below. Instagram still
uses `MockPlatformAdapter` only (`packages/platform-connectors/src/instagram`
is a stub for a later phase).

## Stack

pnpm + Turborepo monorepo · Next.js 14 (App Router) · TypeScript strict ·
Tailwind CSS · PostgreSQL + Prisma · Redis + BullMQ · Zod · Vitest ·
Anthropic/OpenAI SDKs (optional — a network-free mock AI provider is used
when no API key is configured).

## Repository layout

```
apps/
  web/      Next.js dashboard + API routes
  worker/   BullMQ queues/workers (content generation, publishing, analytics, trends, strategy)
packages/
  database/            Prisma schema + client
  ai/                  AIProvider abstraction (Anthropic/OpenAI/Mock) + Zod schemas
  platform-connectors/ SocialPlatformAdapter interface + MockPlatformAdapter + real-adapter stubs
  content-engine/      IdeaGenerator, HookGenerator, PostWriter, PostCritic, tournament orchestrator
  analytics/           Performance scoring, revenue attribution, learning-engine aggregation
  shared/              Cross-cutting types, post lifecycle state machine, queue contract, errors
  config/              Shared tsconfig/eslint base configs
```

## Prerequisites

- Node.js >= 20, pnpm 10
- A running PostgreSQL instance and a running Redis instance

## Setup

```bash
pnpm install

# Copy env vars into every place that needs them (see "Environment variables" below)
cp .env.example .env
cp .env packages/database/.env   # Prisma CLI reads .env next to schema.prisma
cp .env apps/worker/.env         # apps/worker loads its own .env explicitly (no framework auto-load)
cp .env apps/web/.env            # Next.js auto-loads .env from the app directory

# Edit each .env: set DATABASE_URL and REDIS_URL to your local Postgres/Redis.
# ANTHROPIC_API_KEY / OPENAI_API_KEY can be left blank — the app falls back
# to a deterministic, network-free MockAIProvider.

pnpm db:push      # create tables from packages/database/prisma/schema.prisma
pnpm db:generate  # generate the Prisma client (also run automatically by db:push)
pnpm db:seed      # optional — the app also creates a default workspace/persona/account on first request
```

## Running locally

```bash
pnpm dev
```

This runs `apps/web` (http://localhost:3000) and `apps/worker` together via
Turborepo. Open the dashboard and use the **Content** page to enter a topic
and click **Generate Ideas + Post** — this runs the full pipeline
(IdeaGenerator → hook/writer/critic tournament) synchronously and creates a
Post in `REVIEW`. From there: Approve → Schedule (or Publish now) → the
worker publishes through `MockPlatformAdapter` and schedules
analytics-collection jobs at `ANALYTICS_COLLECTION_DELAYS_HOURS` (defaults to
+1h/+6h/+24h/+72h after publish, configurable — see `.env.example`).

## Environment variables

See [`.env.example`](./.env.example). Never commit a real `.env` — all
`.env*` files are gitignored.

## Threads connection (Phase 2)

By default the app publishes nothing for real: `PLATFORM_MODE=mock` routes
every platform (including Threads) through `MockPlatformAdapter`, and even
if you flip Threads to `real`, `THREADS_DRY_RUN=true` still stops short of
the live publish call. **Both** must be changed deliberately to actually
post to Threads — see step 8 below.

> The exact endpoints/OAuth flow below were verified against several
> independent, current (2026) third-party developer guides for the Threads
> API, cross-checked against each other, because `developers.facebook.com`
> was not reachable from this environment to confirm directly. **Meta's
> dashboard UI (menu names, product/use-case picker) changes over time and
> was not verified here** — follow Meta's current in-app instructions for
> the console navigation; only the API/OAuth mechanics below are
> load-bearing in the code.

1. **Create a Meta Developer App** at [developers.facebook.com/apps](https://developers.facebook.com/apps) (an
   Individual/Business Meta Developer account is required). Note the **App
   ID** and **App Secret** from the app's Basic Settings.
2. **Add the Threads API** to the app (Meta's console offers it as a
   product/use case you add to an existing app — the exact button label may
   have changed; look for "Threads API" or "Threads" under the products the
   console offers to add).
3. **Set the callback/redirect URL** in the Threads product's OAuth
   settings to exactly match `THREADS_REDIRECT_URI` below, e.g.
   `https://your-domain.example/api/accounts/threads/callback` (or
   `http://localhost:3000/api/accounts/threads/callback` for local testing,
   if Meta's console accepts a localhost redirect for your app type — if
   not, tunnel `apps/web` through an HTTPS URL, e.g. with a reverse proxy).
4. **Set env vars** in `.env` (and copy to `apps/web/.env`, `apps/worker/.env`,
   `packages/database/.env` per the Setup section above):
   ```
   META_APP_ID=<your app id>
   META_APP_SECRET=<your app secret>
   THREADS_REDIRECT_URI=<the exact URL registered in step 3>
   PLATFORM_MODE=mock
   THREADS_DRY_RUN=true
   ```
5. **Start the app**: `pnpm dev` (runs `apps/web` + `apps/worker`).
6. **Connect Threads**: go to `/settings/accounts` and click **Connect
   Threads**. You'll be redirected to Meta to authorize, then back to
   `/settings/accounts?connected=threads`. This stores the account
   (`SocialAccount`, platform `THREADS`) and its encrypted long-lived token
   (`PlatformCredential.accessTokenEnc`, AES-256-GCM via `ENCRYPTION_KEY`).
7. **Confirm dry-run behavior**: set `PLATFORM_MODE=real` (keep
   `THREADS_DRY_RUN=true`), restart `apps/worker`, then generate → approve →
   publish a post from `/content`. The worker creates a real Threads media
   *container* (harmless — nothing goes live) but never calls
   `/threads_publish`; the post still ends up `PUBLISHED` in this app with
   an `externalId` prefixed `dryrun_`, and the Content pages show a **REAL
   (DRY RUN)** badge throughout.
8. **Switch to live publishing**: only after confirming step 7, set
   `THREADS_DRY_RUN=false` and restart the worker. From here, an
   **Approve** + **Publish now**/**Schedule** on a Threads post targeting a
   real, connected account with `approvalMode=MANUAL` will post for real —
   the Content pages show a **REAL** badge with a red confirmation notice
   before you approve. `SEMI_AUTO`/`AUTO` accounts are never allowed to
   publish for real in this phase (CLAUDE.md STEP 15).

## X connection (Phase 3)

Same safety model as Threads above: `PLATFORM_MODE=mock` (or
`X_PLATFORM_MODE=mock`) routes X through `MockPlatformAdapter`, and even in
`real` mode, `X_DRY_RUN=true` (the default) never calls the live X API.
**Both** must be changed deliberately to post to X for real.

Unlike Threads, X requires OAuth 2.0 **Authorization Code + PKCE** for
every app (confidential or public), and a tweet is a single `POST
/2/tweets` call — there's no separate "create a container, then publish"
step to safely stop at, so `X_DRY_RUN` skips calling the X API entirely
rather than creating-but-not-publishing.

1. **Create an X app** at the [X Developer Portal](https://developer.x.com/) with **OAuth 2.0** enabled. Note the **Client ID**
   (and **Client Secret**, only if you chose a "confidential" app type —
   a "public" app has no secret and relies on PKCE alone; both work here).
2. **Set the callback URL** in the app's OAuth 2.0 settings to exactly match
   `X_REDIRECT_URI` below, e.g.
   `https://your-domain.example/api/accounts/x/callback`.
3. **Set env vars** in `.env` (and copy to `apps/web/.env`, `apps/worker/.env`,
   `packages/database/.env`):
   ```
   X_CLIENT_ID=<your client id>
   X_CLIENT_SECRET=<your client secret, or leave blank for a public app>
   X_REDIRECT_URI=<the exact URL registered in step 2>
   PLATFORM_MODE=mock
   X_DRY_RUN=true
   ```
4. **Start the app**: `pnpm dev`.
5. **Connect X**: go to `/settings/accounts` and click **Connect X**. You'll
   be redirected to X to authorize, then back to
   `/settings/accounts?connected=x`. This stores the account
   (`SocialAccount`, platform `X`) and its encrypted access/refresh tokens
   (`PlatformCredential.accessTokenEnc`/`refreshTokenEnc`, AES-256-GCM via
   `ENCRYPTION_KEY`).
6. **Confirm dry-run behavior**: set `PLATFORM_MODE=real` (keep
   `X_DRY_RUN=true`), restart `apps/worker`, then generate → approve →
   publish a post from `/content`. The worker never calls the real X API;
   the post still ends up `PUBLISHED` in this app with an `externalId`
   prefixed `dryrun_`, and the Content pages show a **REAL (DRY RUN)**
   badge throughout.
7. **Switch to live publishing**: only after confirming step 6, set
   `X_DRY_RUN=false` and restart the worker. From here, an **Approve** +
   **Publish now**/**Schedule** on an X post targeting a real, connected
   account with `approvalMode=MANUAL` will post for real — the Content
   pages show a **REAL** badge with a red confirmation notice before you
   approve. `SEMI_AUTO`/`AUTO` accounts are never allowed to publish for
   real in this phase (CLAUDE.md STEP 15).

**Manual real-X validation (human only, same rule as Threads below):**
Claude Code must never execute the real-publish step. Run through the same
checklist as Threads below with X's equivalents — OAuth success (redirected
back with `?connected=x`), `@username` fetched, encrypted credential
storage, dry run, real text publish (`X_DRY_RUN=false`), `externalId`
matching a real tweet id, the tweet actually visible on x.com, analytics
fetched (`public_metrics`), snapshot saved, dashboard reflects it.

### Manual real-Threads validation checklist (human only)

**Claude Code must never execute any of the steps below itself.** Every
automated test in this repo runs against `MockAIProvider`/`MockPlatformAdapter`
or a mocked `fetch` — nothing in CI or in an AI coding session ever calls the
real Threads API. This checklist is for a human to run by hand, once, against
a real Threads developer account, to confirm the whole real-publish → real-
analytics → learning loop actually works end to end (CLAUDE.md Phase 2.5).

Real publishing additionally requires **all** of: `PLATFORM_MODE=real`,
`THREADS_DRY_RUN=false`, the account's `approvalMode=MANUAL`, the post in
`APPROVED` status, and an explicit **Publish now** click — see steps 1–8
above. Before that final click, the Content detail page and the Publish
button both show **"REAL THREADS POST @&lt;username&gt;"** in red — stop and
double-check the account before proceeding.

- [ ] **OAuth success** — `/settings/accounts` → Connect Threads completes
      the Meta authorization redirect and lands back on
      `/settings/accounts?connected=threads` without an error.
- [ ] **Username fetched** — the connected account shows the real Threads
      `@username` (not a placeholder) in `/settings/accounts` and on the
      Content pages.
- [ ] **Credential stored encrypted** — inspect the `PlatformCredential` row
      in Postgres directly (`accessTokenEnc`) and confirm it is ciphertext,
      not the raw token, and that the raw token never appears in server logs.
- [ ] **Dry run** — with `THREADS_DRY_RUN=true`, Approve + Publish now on a
      real-account post creates a Threads media container but stops before
      `/threads_publish`; the post ends `PUBLISHED` here with an
      `externalId` prefixed `dryrun_`, and nothing appears on Threads.
- [ ] **Real text publish** — with `THREADS_DRY_RUN=false`, after seeing the
      "REAL THREADS POST @username" warning, Publish now actually posts.
- [ ] **externalId saved** — the `Post.externalId` recorded here matches the
      real Threads post ID (not a `dryrun_`/mock id).
- [ ] **Post actually exists on Threads** — open the real Threads profile in
      a browser and confirm the post is visible there.
- [ ] **Analytics fetched** — after the scheduled analytics-collection delays
      (see `apps/worker/src/jobs/collect-post-analytics.ts`), the job pulls
      real insights from the Threads API without error.
- [ ] **Snapshot saved** — a new `PostAnalyticsSnapshot` row appears for the
      post, with metrics Threads doesn't provide left `NULL` (never `0`).
- [ ] **Dashboard reflects it** — `/dashboard`, `/analytics`, and `/content/[id]`
      all show the real post's numbers after the snapshot lands.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

All three run across every package/app via Turborepo. Tests never call real
AI or social platform APIs — the `MockAIProvider` and `MockPlatformAdapter`
are used throughout.

## Notes on the architecture

- **Post lifecycle** (`packages/shared/src/post-lifecycle.ts`): `DRAFT → REVIEW → APPROVED → SCHEDULED → QUEUED → PUBLISHING → PUBLISHED`, with `FAILED`/`REJECTED` branches. Invalid transitions throw `InvalidPostTransitionError`.
- **Duplicate-publish prevention**: `Post` has a unique `(socialAccountId, contentHash)` constraint, so a retried publish job can never create a second live post for the same text.
- **AI generation never publishes directly**: `packages/content-engine` only writes `Post` rows in `REVIEW`; `apps/worker/src/jobs/publish-post.ts` is the only code path that calls a `SocialPlatformAdapter`.
- **BullMQ queues** (`packages/shared/src/queue-contract.ts`): `content-generation`, `content-publishing`, `analytics-collection`, `trend-collection`, `strategy-analysis`.
- **Adapter resolution** (`apps/worker/src/platform-adapters.ts`): `getPlatformAdapter(account)` returns `MockPlatformAdapter` for Instagram always, and for Threads/X unless that platform's `PLATFORM_MODE`/`{THREADS,X}_PLATFORM_MODE=real` **and** the account has a valid, non-expired credential **and** `approvalMode=MANUAL` — otherwise it throws rather than silently falling back to mock. `apps/web/lib/publish-mode.ts` mirrors the same gate for the UI.
- **XAdapter vs ThreadsAdapter** (`packages/platform-connectors/src/{x,threads}/adapter.ts`): X's Tweets API is a single `POST /2/tweets` call with officially documented `DELETE`/`GET` support, so `XAdapter` implements the full `SocialPlatformAdapter` surface (`deletePost`/`getPost` included) — unlike `ThreadsAdapter`, which throws `PlatformUnsupportedOperationError` for those two because Threads' behavior there isn't verified against official docs. X also has no safe partial step like Threads' "create a container" — `X_DRY_RUN` skips calling the X API entirely rather than creating-but-not-publishing.
- **X OAuth (PKCE)** (`apps/web/lib/pkce.ts`, `packages/platform-connectors/src/x/oauth.ts`): X requires OAuth 2.0 Authorization Code + PKCE for every app. `generatePkcePair()` produces a `code_verifier`/`code_challenge` pair; the verifier is held in a short-lived httpOnly cookie (`X_PKCE_VERIFIER_COOKIE_NAME`) alongside the CSRF `state` cookie until the callback completes the token exchange.
- **Error taxonomy & retries** (`packages/shared/src/errors.ts`): `PlatformAuthError`/`PlatformValidationError` are non-retryable; `PlatformRateLimitError`/`PlatformServerError` are retryable (`isRetryableError`). `apps/worker` throws BullMQ's `UnrecoverableError` for non-retryable failures so they don't waste retry attempts.
- **Publish safety** (`apps/worker/src/jobs/publish-post.ts`): beyond the `(socialAccountId, contentHash)` unique constraint, a worker crash between a successful Threads publish call and the DB write is handled explicitly — resuming from `PUBLISHING` with an `externalId` already recorded finishes the transition without a new API call; resuming with no `externalId` is treated as ambiguous and fails loudly (no invented idempotency key) rather than risking a duplicate live post.
- **Learning Engine** (`packages/analytics/src/learning/`): `extractPostFeatures()` derives platform/topic/hookType/emotion/contentType/CTA/textLength/lengthBucket/weekday/postingHour from each published `Post` (mostly computed on the fly, not stored — only `Post.cta` was added as a genuinely new column). `analyzeAccountPerformance()` groups by dimension, compares each bucket's median against the account-wide median (`relativeLift`), and tags every bucket with a confidence tier (`INSUFFICIENT_DATA` &lt;5, `LOW` 5-9, `MEDIUM` 10-29, `HIGH` 30+, all configurable). Below 5 measured posts the whole analysis is flagged `coldStart` and the system explicitly reports "not enough data" rather than inventing a pattern.
- **Generation feedback loop** (`apps/worker/src/jobs/generate-content.ts` → `buildGenerationContext()`): the Writer receives a short list of plain-English `recentLearnings` (never raw DB rows, never "you must" phrasing — reference info only) plus a `mode` (`proven`/`adjacent`/`exploration`) sampled from a configurable mix, default 70/20/10, that widens toward exploration automatically when there's no `MEDIUM+` confidence pattern yet and goes to 100% exploration on cold start — the account never converges to only ever repeating past winners.
- **Weekly Strategy** (`apps/worker/src/jobs/weekly-strategy-review.ts`): `winningTopics`/`losingTopics`/`winningHooks`/`losingHooks`/`winningFormats`/`observations` are computed **deterministically** from the Learning Engine's output (guaranteeing sample-size-citing phrasing like *"'story' hooks has outperformed the account median engagement rate by 31% over 16 posts"* by construction). Only `recommendedMix`/`recommendedTimes`/`experiments` go through an AI call (`StrategyWriter`), fed exclusively aggregated `{dimension, value, sampleSize, relativeLift, confidence}` rows — never raw post text. On cold start the AI call is skipped entirely and a minimal `observations: ["Not enough performance data yet."]` row is written instead.
- **Revenue: null vs. zero** (`packages/analytics/src/attribution/revenue.ts`): `aggregateRevenue()` returns `null` — not `0` — when there isn't a single `Conversion` with a recorded `value` (no conversions yet, or only non-monetary ones like leads/clicks). The dashboard and per-post metrics render that as "Not enough data", never as ¥0, so an unmeasured account is never mistaken for a genuinely zero-revenue one.
