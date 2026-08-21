# Social Growth OS

AI-powered autonomous social media growth system (X / Threads / Instagram). See
[`CLAUDE.md`](./CLAUDE.md) for the full product spec — this README covers
running the MVP backbone locally.

**Current status**: Phase 1 (Mock MVP) is complete and verified end-to-end —
Topic → Idea → Content → Review → Approve → Schedule → Publish (mock) → Mock
Analytics → Dashboard. Every platform is backed by `MockPlatformAdapter`; no
real SNS credentials are used yet (see `packages/platform-connectors/src/{x,threads,instagram}`
for the real-adapter stubs planned for later phases).

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
