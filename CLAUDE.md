# Social Growth OS

## 1. Project Overview

This project is an AI-powered autonomous social media growth system.

Primary platforms:

- X
- Threads
- Instagram

The system must:

1. Collect trends and content opportunities
2. Analyze why topics and content structures perform
3. Generate original content ideas
4. Generate platform-specific content
5. Score and critique generated content
6. Queue and schedule approved content
7. Publish through official APIs
8. Collect post analytics
9. Measure business outcomes
10. Learn which content strategies work
11. Improve future generation using historical performance

This project must NOT be designed as a spam bot.

This project must NOT directly copy viral posts.

The system should extract abstract patterns such as:

- hook type
- topic
- emotional trigger
- narrative structure
- formatting style
- level of specificity
- CTA type
- content length
- posting time
- content format

and use those patterns to create original content.

---

# 2. Primary Business Objective

The primary objective is NOT:

- maximum posting frequency
- maximum likes

The primary objective is:

maximize sustainable business value generated from social traffic.

Main KPI:

Revenue per 1,000 Impressions

Secondary KPIs:

- impressions
- engagement rate
- likes
- replies/comments
- reposts/shares
- saves
- profile visits
- link clicks
- follower growth
- leads
- conversions
- revenue

The optimization engine should favor content that produces downstream business results.

---

# 3. Product Philosophy

Build an autonomous Social Media Growth OS.

The conceptual loop is:

Trend Collection
→ Opportunity Analysis
→ Idea Generation
→ Content Generation
→ Content Critique
→ Human Approval / Auto Approval
→ Scheduling
→ Publishing
→ Analytics
→ Performance Analysis
→ Strategy Update
→ New Generation

The system must continuously learn from previous posts.

Do not optimize blindly for virality.

Optimize for:

1. originality
2. usefulness
3. audience relevance
4. engagement
5. conversion potential
6. sustainable account growth

---

# 4. MVP Target

The MVP must support:

## Platforms

- X
- Threads
- Instagram

## MVP content types

X:
- text posts

Threads:
- text posts

Instagram:
- image/carousel posts
- captions

Reels can be added later.

## MVP functionality

- account connection
- topic configuration
- trend ingestion
- idea generation
- post generation
- AI scoring
- manual approval
- scheduling
- publishing
- analytics collection
- dashboard
- basic performance learning

Do NOT initially build complicated multi-agent infrastructure.

Agents should initially be implemented as TypeScript services with clear interfaces.

---

# 5. Technology Stack

Use a TypeScript monorepo.

Recommended structure:

- pnpm
- Turborepo
- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Zod
- Tailwind CSS
- shadcn/ui

AI providers:

- Anthropic
- OpenAI

Use provider abstraction.

Infrastructure:

Web:
- Vercel-compatible

Worker:
- Railway / Render / Fly.io compatible

Database:
- PostgreSQL

Queue:
- Redis

Media:
- S3-compatible storage
- Cloudflare R2 supported

Do not hardcode deployment provider behavior into business logic.

---

# 6. Repository Structure

Create:

apps/
  web/
  worker/

packages/
  database/
  ai/
  platform-connectors/
  analytics/
  content-engine/
  shared/
  config/

apps/web/
  app/
  components/
  lib/

apps/worker/
  src/
    jobs/
    scheduler/
    workers/

packages/ai/
  src/
    providers/
    prompts/
    schemas/
    services/

packages/platform-connectors/
  src/
    x/
    threads/
    instagram/
    types.ts

packages/content-engine/
  src/
    trend/
    research/
    ideas/
    writer/
    critic/
    optimizer/

packages/analytics/
  src/
    scoring/
    attribution/
    reports/

packages/database/
  prisma/
    schema.prisma
  src/

---

# 7. Architecture Rules

Follow these rules.

## Separation of concerns

AI generation must not directly publish.

Content generation:

generatePost()

Publishing:

publishPost()

Analytics:

collectAnalytics()

Optimization:

analyzePerformance()

must remain separated.

## Platform abstraction

Create:

interface SocialPlatformAdapter {
  publishPost(...)
  deletePost(...)
  getPost(...)
  getPostMetrics(...)
  validateContent(...)
}

Implement:

XAdapter
ThreadsAdapter
InstagramAdapter

Do not expose raw third-party API responses to application code.

Normalize them first.

---

# 8. AI Provider Abstraction

Create:

interface AIProvider {
  generateStructured<T>()
  generateText()
}

Implement:

AnthropicProvider
OpenAIProvider

All structured AI output must use Zod validation.

Never trust unvalidated LLM JSON.

AI calls must support:

- prompt version
- model
- temperature
- usage
- estimated cost
- trace id

Store generation metadata.

---

# 9. Content Pipeline

Implement the following pipeline.

## STEP 1 Trend Collection

Sources may include:

- official platform APIs where available
- Google Trends-compatible data sources
- RSS
- Google News-compatible sources
- Reddit API/data sources
- YouTube data
- manually entered topics
- internal account performance

Do not create unauthorized scraping logic.

Normalize every collected trend into:

Trend {
  id
  source
  externalId
  title
  text
  url
  publishedAt
  score
  velocity
  rawData
}

---

# 10. Trend Analysis

Trend Analyzer evaluates:

- relevance
- freshness
- velocity
- audience fit
- monetization fit
- saturation
- novelty
- source credibility

Output:

{
  topic,
  summary,
  reasonTrending,
  targetAudience,
  opportunityScore,
  contentAngles[],
  risks[],
  evidence[]
}

Opportunity score:

0-100.

---

# 11. Viral Pattern Analysis

The system must NOT save competitor text for reuse as generated output.

Analyze abstract content attributes.

Possible attributes:

hookType:
- contrarian
- curiosity
- confession
- warning
- question
- number
- prediction
- story
- result
- authority

emotion:
- curiosity
- surprise
- fear
- aspiration
- empathy
- humor
- urgency

structure:
- hook-value-cta
- problem-solution
- story-lesson
- list
- before-after
- myth-reality
- mistake-fix
- prediction-reason

CTA:
- none
- reply
- follow
- save
- share
- click
- comment
- DM

Store pattern metadata instead of copied content.

---

# 12. Idea Generator

For each high-quality opportunity:

Generate 5-20 original ideas.

Idea object:

{
  title,
  topic,
  angle,
  audience,
  hookType,
  emotion,
  contentType,
  whyNow,
  conversionIntent,
  originalityNotes
}

Ideas must be deduplicated.

Create semantic similarity checks before publishing.

Avoid generating posts too similar to:

- previous account posts
- input reference posts
- other generated candidates

---

# 13. Writer

Writer accepts:

- account persona
- platform
- idea
- strategy
- historical winners
- historical losers
- constraints

Output platform-specific copy.

Do not simply cross-post identical text.

## X

Prefer:
- concise copy
- clear hooks
- strong standalone value

## Threads

Prefer:
- conversational writing
- relatable observation
- story / discussion formats

## Instagram

Prefer:
- strong first slide/hook
- saveable educational content
- carousel structure
- caption
- CTA

---

# 14. Critic

Every candidate must be evaluated.

Score:

Hook: 0-10
Originality: 0-10
Usefulness: 0-10
Clarity: 0-10
Shareability: 0-10
AudienceFit: 0-10
Specificity: 0-10
ConversionPotential: 0-10
BrandFit: 0-10
Risk: 0-10

Risk means higher = worse.

Calculate:

qualityScore = weighted positive scores - risk penalty

Default rules:

qualityScore >= 80:
  eligible for approval

65 <= qualityScore < 80:
  rewrite

qualityScore < 65:
  reject

Initially DO NOT auto publish.

Require human approval.

Auto publishing can be enabled per account later.

---

# 15. Tournament Generation

Support candidate tournament mode.

Example:

idea
→ 10 hooks
→ top 5
→ 5 full posts
→ critique
→ top 2
→ final polish
→ approval

Do not run huge tournaments by default because of AI cost.

Default:

hooks = 5
fullCandidates = 3
winner = 1

Store losing variants for analysis.

---

# 16. Brand Persona

Each account has:

- niche
- target audience
- tone
- expertise
- beliefs
- forbidden claims
- forbidden words
- preferred style
- CTA strategy
- products
- landing pages

Example:

{
  "niche": "AI productivity",
  "audience": "Japanese office workers",
  "tone": ["friendly", "practical", "concise"],
  "avoid": ["fake income claims", "excessive hype"],
  "ctaStyle": "soft"
}

Generation must always apply persona.

---

# 17. Publishing

Publishing must happen through platform adapters.

Do not use browser automation when official APIs are available.

Publishing workflow:

APPROVED
→ SCHEDULED
→ QUEUED
→ PUBLISHING
→ PUBLISHED

Failure:

PUBLISHING
→ FAILED

Retry using exponential backoff.

Do not retry permanent validation errors.

Use idempotency logic.

A job must never accidentally publish the same post twice.

---

# 18. Scheduler

Use BullMQ.

Queues:

content-generation
content-publishing
analytics-collection
trend-collection
strategy-analysis

Job names:

generate-content
publish-post
collect-post-analytics
collect-account-analytics
collect-trends
weekly-strategy-review

Scheduled analytics:

+1 hour
+6 hours
+24 hours
+72 hours

Make intervals configurable.

---

# 19. Analytics

Normalize platform analytics.

Post metrics:

- impressions/views
- likes
- replies/comments
- reposts/shares
- saves
- profileVisits
- linkClicks
- followersGained

Not every platform provides every metric.

Missing values must be NULL, not 0.

Store snapshots rather than overwriting metrics.

This allows time-series analysis.

---

# 20. Performance Metrics

Calculate:

engagementRate =
engagements / impressions

shareRate =
shares / impressions

replyRate =
replies / impressions

followerConversionRate =
followersGained / impressions

clickRate =
linkClicks / impressions

revenuePer1kImpressions =
revenue / impressions * 1000

Avoid division by zero.

---

# 21. Content Performance Score

Initial configurable score:

performanceScore =

0.10 * normalizedLikeRate
+ 0.15 * normalizedReplyRate
+ 0.20 * normalizedShareRate
+ 0.15 * normalizedFollowerConversionRate
+ 0.15 * normalizedClickRate
+ 0.25 * normalizedRevenueRate

Weights must be configurable per account.

Do NOT hardcode them permanently.

---

# 22. Learning Engine

Analyze performance by dimensions:

- platform
- topic
- content type
- hook type
- emotion
- CTA
- length bucket
- weekday
- hour
- content format

Never conclude causality from small samples.

Store:

sampleSize
average
median
confidence level

Only create strong recommendations when enough data exists.

Minimum default sample:

10 posts

Prefer 30+.

---

# 23. Strategy Engine

Create weekly strategy review.

Input:

last 7 / 30 / 90 day performance.

Output:

{
  winningTopics,
  losingTopics,
  winningHooks,
  winningFormats,
  recommendedMix,
  recommendedTimes,
  experiments,
  observations,
  confidence
}

Strategy suggestions must remain explainable.

Example:

"Contrarian hooks performed +31% vs account median over 18 posts."

Not:

"Contrarian posts are always better."

---

# 24. Experiment Engine

Support A/B-style content experiments.

Experiment examples:

- short vs long
- question hook vs claim hook
- CTA vs no CTA
- morning vs evening
- story vs list

Experiment:

{
  hypothesis,
  variable,
  control,
  variant,
  primaryMetric,
  startDate,
  endDate
}

Avoid changing multiple variables when possible.

---

# 25. Revenue Attribution

The system must support business outcomes.

Track:

- link click
- lead
- purchase
- subscription
- manual revenue

Support UTM parameters.

Example:

utm_source=threads
utm_medium=social
utm_campaign=ai_productivity
utm_content={postId}

Provide conversion webhook API.

Revenue must be associated with:

Post
→ Campaign
→ Conversion

when possible.

---

# 26. Safety and Quality

Do not:

- copy complete posts
- plagiarize creators
- generate deceptive testimonials
- invent personal experiences as factual claims
- fabricate statistics
- impersonate people
- post fake financial results
- bypass platform limits
- circumvent account restrictions
- perform unauthorized scraping

Factual claims should optionally use research evidence.

Support:

needsFactCheck = true

for risky factual content.

---

# 27. Approval Modes

Account setting:

MANUAL
SEMI_AUTO
AUTO

MANUAL:
everything requires approval.

SEMI_AUTO:
high-score low-risk posts can automatically schedule.

AUTO:
eligible content can publish automatically.

Default:

MANUAL

AUTO must be explicitly enabled.

---

# 28. Dashboard

Build the following pages.

## /dashboard

Display:

- impressions
- followers gained
- engagement
- clicks
- conversions
- revenue
- revenue / 1k impressions

Charts:
7 day
30 day
90 day

## /content

Tabs:

Draft
Review
Approved
Scheduled
Published
Failed

## /content/[id]

Display:

- idea
- copy
- platform
- AI scores
- reasoning
- generation metadata
- analytics
- variants

Actions:

Approve
Reject
Rewrite
Schedule
Publish now

## /trends

Trend feed with:

- source
- score
- velocity
- relevance
- opportunity

## /ideas

Generated idea board.

## /analytics

Break down by:

- platform
- topic
- hook
- format
- CTA
- posting time

## /strategy

Show:

- current strategy
- weekly AI review
- recommended experiments

## /settings/accounts

Platform connections.

## /settings/persona

Brand configuration.

---

# 29. Authentication

Implement secure user authentication.

Never expose platform access tokens client-side.

Platform credentials must be encrypted at rest.

Tokens must only be accessible server-side.

Implement token refresh where platform APIs support it.

Never log:

- access tokens
- refresh tokens
- secrets
- API keys

---

# 30. Environment Variables

Create `.env.example`.

Include:

DATABASE_URL=
REDIS_URL=

ANTHROPIC_API_KEY=
OPENAI_API_KEY=

APP_URL=
ENCRYPTION_KEY=

X_CLIENT_ID=
X_CLIENT_SECRET=

META_APP_ID=
META_APP_SECRET=

S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PUBLIC_URL=

Do not commit real credentials.

---

# 31. Observability

Use structured logs.

Every AI generation:

traceId

Every publish job:

jobId
postId
accountId
platform

Every third-party request:

provider
endpoint
statusCode
duration

Never log secrets.

---

# 32. Error Handling

Create custom errors:

PlatformAuthError
PlatformRateLimitError
PlatformValidationError
AIGenerationError
ContentValidationError
PublishError

Implement retries only where appropriate.

429:
retry with backoff.

401:
mark integration as needing reconnection where appropriate.

4xx validation:
do not blindly retry.

---

# 33. Testing

Use:

Vitest

Tests required for:

- scoring
- platform normalization
- post validation
- scheduler logic
- duplicate prevention
- UTM generation
- revenue calculation
- AI structured output validation

Third-party APIs must be mocked during tests.

Do not make real social posts from automated tests.

---

# 34. Coding Standards

Use strict TypeScript.

Avoid:

any

unless absolutely necessary.

Use:

Zod

at external boundaries.

Prefer:

small functions
explicit types
dependency injection

Avoid giant service classes.

Business logic should be testable without external APIs.

---

# 35. Development Rules For Claude Code

When implementing:

1. inspect existing code first
2. propose changes
3. implement in small logical steps
4. run lint
5. run typecheck
6. run tests
7. fix failures
8. summarize changes

Never silently delete existing functionality.

Never expose secrets.

Never invent undocumented third-party endpoints.

When platform API behavior is uncertain:

create an adapter interface and TODO,
rather than guessing.

Prefer official APIs and official documentation.

---

# 36. Initial Build Order

Implement in this order.

PHASE 1:
Repository setup

PHASE 2:
Database

PHASE 3:
Auth

PHASE 4:
Account / persona management

PHASE 5:
AI provider abstraction

PHASE 6:
Idea generator

PHASE 7:
Writer

PHASE 8:
Critic

PHASE 9:
Content approval UI

PHASE 10:
Scheduler

PHASE 11:
Threads integration

PHASE 12:
X integration

PHASE 13:
Instagram integration

PHASE 14:
Analytics collection

PHASE 15:
Analytics dashboard

PHASE 16:
Trend ingestion

PHASE 17:
Learning engine

PHASE 18:
Weekly strategy engine

PHASE 19:
Revenue attribution

PHASE 20:
Auto-publishing controls

Do NOT try to implement all phases in one uncontrolled edit.

---

# 37. Definition of MVP Complete

MVP is complete when a user can:

1. log in
2. create an account persona
3. connect at least Threads
4. enter a topic
5. generate ideas
6. generate post candidates
7. see AI critique scores
8. approve a post
9. schedule it
10. publish through official API
11. retrieve metrics
12. see metrics on dashboard

Only after this works end-to-end should advanced automation be prioritized.
