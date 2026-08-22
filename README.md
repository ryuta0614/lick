# Social Growth OS

AI-powered autonomous social media growth system (X / Threads / Instagram). See
[`CLAUDE.md`](./CLAUDE.md) for the full product spec — this README covers
running the MVP backbone locally.

**Current status**: Phase 1 (Mock MVP) is complete and verified end-to-end.
Phase 2 adds a real Threads connection (OAuth, text publishing, insights)
behind the same pipeline, gated off by default — see "Threads connection"
below. X and Instagram still use `MockPlatformAdapter` only
(`packages/platform-connectors/src/{x,instagram}` are stubs for later phases).

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
- **Adapter resolution** (`apps/worker/src/platform-adapters.ts`): `getPlatformAdapter(account)` returns `MockPlatformAdapter` for X/Instagram always, and for Threads unless `PLATFORM_MODE`/`THREADS_PLATFORM_MODE=real` **and** the account has a valid, non-expired credential **and** `approvalMode=MANUAL` — otherwise it throws rather than silently falling back to mock.
- **Error taxonomy & retries** (`packages/shared/src/errors.ts`): `PlatformAuthError`/`PlatformValidationError` are non-retryable; `PlatformRateLimitError`/`PlatformServerError` are retryable (`isRetryableError`). `apps/worker` throws BullMQ's `UnrecoverableError` for non-retryable failures so they don't waste retry attempts.
- **Publish safety** (`apps/worker/src/jobs/publish-post.ts`): beyond the `(socialAccountId, contentHash)` unique constraint, a worker crash between a successful Threads publish call and the DB write is handled explicitly — resuming from `PUBLISHING` with an `externalId` already recorded finishes the transition without a new API call; resuming with no `externalId` is treated as ambiguous and fails loudly (no invented idempotency key) rather than risking a duplicate live post.
