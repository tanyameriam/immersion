# Layrrrd Architecture

Last reviewed: 2026-07-15

This document explains how the project is put together, why each part exists,
and what it costs to run. It is written as an operator/developer handoff: start
here when you need to understand the whole product end to end.

## Product Summary

Layrrrd is a Next.js app for saving links, turning them into readable AI
summaries, and bringing users back to what they saved through a dashboard,
weekly digest, browser extension, Telegram chat, and WhatsApp chat.

At a high level:

1. A user signs in with Firebase Auth.
2. They save a URL from the dashboard, Chrome extension, Telegram, or WhatsApp.
3. The API stores a pending `knowledgeItems` document in Firestore.
4. A server-side worker extracts readable content and asks Claude for structured
   metadata.
5. The dashboard and bot surfaces render the enriched item.
6. Recommendation and digest jobs reuse the same saved item data to produce
   weekly recaps and personalized feed picks.

## Core Stack

| Area | Technology | Why it is used |
| --- | --- | --- |
| Web app | Next.js 15 App Router, React 19, TypeScript | App routes, serverless API routes, React UI, strict typing. |
| Styling | Tailwind CSS v4, shadcn/ui, Base UI primitives | Consistent component system, theme tokens, accessible UI primitives. |
| Auth | Firebase Authentication | Email/password and Google sign-in, ID tokens for web and extension API calls. |
| Database | Cloud Firestore | User profiles, saved items, recommendations support data, link codes, digest history, cache docs. |
| Server auth | Firebase Admin SDK | Verifies ID tokens and performs privileged backend writes. |
| AI | Anthropic Claude Haiku 4.5 | Structured article/video/podcast summaries and chat answers. |
| Optional video AI | Gemini API | Fallback video understanding when configured. |
| Email | Resend | Sends weekly digest email. |
| Messaging | Telegram Bot API, WhatsApp Cloud API | Chat-based link saving, Q&A, and Telegram digest delivery. |
| Analytics | PostHog | Product events and pageviews, disabled when key is absent. |
| Hosting | Vercel | Next.js deployment, serverless functions, Vercel Cron. |
| Extension | Chrome Manifest V3 | One-click saves from the browser toolbar. |

## Repository Map

| Path | What belongs there | Why it exists |
| --- | --- | --- |
| `app/` | App Router pages and API routes. | Next.js routing convention. UI pages and backend endpoints live together by route. |
| `app/page.tsx` | Marketing/landing page composition. | Imports the landing sections in order. |
| `app/layout.tsx` | Root HTML shell, fonts, auth provider, analytics, feedback widget, toaster. | Cross-app providers and global UI belong at the root. |
| `app/dashboard/page.tsx` | Auth-gated dashboard with Recommended and Bookmarks tabs. | Main signed-in product surface. |
| `app/dashboard/profile/page.tsx` | User profile, interests, delivery settings, Telegram/WhatsApp linking, account actions. | All persistent user preferences are managed here. |
| `app/onboarding/page.tsx` | First-run profile setup, interests, starter picks, delivery setup. | Seeds recommendations before a user has many saves. |
| `app/api/**/route.ts` | Serverless API route handlers. | Auth verification, saving, processing, recommendations, webhooks, cron. |
| `components/` | Shared React components and feature components. | Keeps pages mostly compositional. |
| `components/ui/` | shadcn/ui primitives. | Canonical local component primitives. Add new ones with `npx shadcn@latest add`. |
| `components/dashboard/` | Dashboard-only presentation and interactions. | Keeps dashboard page logic smaller. |
| `components/onboarding/` | Onboarding-specific UI. | Separates first-run flow from profile/dashboard code. |
| `hooks/` | Client-side data hooks. | Live Firestore subscriptions, preferences, recommendations. |
| `lib/` | Shared business logic and server/client helpers. | Most non-UI behavior lives here. |
| `lib/firebase/` | Firebase client, admin, and token verification. | Separates browser Firebase SDK from server-only Admin SDK. |
| `lib/firestore/` | Data access for saved items. | Centralizes Firestore document shape and conversions. |
| `lib/ai/` | Extraction, Claude analysis, Gemini video helpers. | AI-specific code and model config. |
| `lib/items/` | End-to-end saved-item processing. | Claims pending items, extracts content, writes AI fields. |
| `lib/recommendations/` | Taste profile, community matches, external web feed. | Builds the Recommended tab and digest picks. |
| `lib/recommendations/sources/` | Medium, YouTube, Spotify, Google Custom Search adapters. | Each source has its own fetch/normalize logic. |
| `lib/digest/` | Weekly digest builder and email/Telegram formatting. | Keeps cron route thin. |
| `lib/rudolf/` | Shared channel-agnostic chat brain, feed cache, mention memory. | Telegram and WhatsApp reuse one bot intelligence layer. |
| `lib/telegram/` | Telegram linking, send, chat adapter, nudges. | Telegram-specific protocol and delivery behavior. |
| `lib/whatsapp/` | WhatsApp linking, send, chat adapter. | WhatsApp-specific Cloud API behavior and webhook verification. |
| `extension/` | Chrome extension source. | Browser toolbar save flow and extension auth. |
| `scripts/` | Local/admin utilities and seed data. | Reset demo data, seed starter lists, prepare assets. |
| `design-system/` | Design system documentation and local brand fonts. | Canonical styling rules and font loading. |
| `docs/` | Longer architecture/ops docs. | Maintainer-facing documentation. |
| `firestore.rules` | Firestore security rules. | Client-side access control. |
| `firestore.indexes.json` | Firestore composite indexes. | Supports Firestore query patterns. |
| `firebase.json` | Firebase deploy config for rules/indexes. | Deployable Firestore configuration. |
| `vercel.json` | Vercel Cron schedule. | Runs the weekly digest route daily at 08:00 UTC. |
| `.github/workflows/ci.yml` | GitHub Actions CI. | Runs lint, typecheck, and build on pushes/PRs. |

## Runtime Architecture

### Client Surfaces

The app has four user-facing surfaces:

1. Marketing site: `app/page.tsx` and section components such as `Hero`,
   `Pricing`, `FAQ`, and `Contact`.
2. Authenticated web app: `app/dashboard/page.tsx`, `app/onboarding/page.tsx`,
   and `app/dashboard/profile/page.tsx`.
3. Chrome extension: `extension/popup.js`, `extension/manifest.json`.
4. Messaging bots: Telegram and WhatsApp webhooks in `app/api/telegram/*` and
   `app/api/whatsapp/*`.

They all converge on the same backend concepts: Firebase identity, Firestore
user profiles, and `knowledgeItems`.

### Auth Model

Browser auth is initialized in `lib/firebase/client.ts`.

The root `AuthProvider` in `components/AuthContext.tsx` handles:

- Firebase email/password sign-up.
- Firebase email/password sign-in.
- Google popup sign-in.
- Session state hydration.
- Profile upsert into `users/{uid}` on sign-in.
- A client-only demo login for `tanyameriamsunny@gmail.com` with password
  `test`.

Server routes use `lib/firebase/verify-auth.ts`:

- Read `Authorization: Bearer <idToken>`.
- Verify with Firebase Admin.
- Return `{ uid, email, name, picture }`.

The Chrome extension cannot use the web app Firebase SDK directly, so it:

1. Gets a Google OAuth token through `chrome.identity`.
2. Exchanges it for a Firebase ID token through the Firebase Auth REST API.
3. Calls the same `/api/items` endpoints with the same Bearer token.

### Data Model

Firestore is the primary database.

Important collections:

| Collection | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `users/{uid}` | Auth provider, onboarding, profile, bot linking | Preferences hook, recommendations, digest, bots | Profile, interests, delivery settings, Telegram/WhatsApp IDs, onboarding state. |
| `knowledgeItems/{id}` | `/api/items`, bots | Dashboard, recommendations, digest, bots | Saved URLs and AI-derived summaries. |
| `starterLists/{topicSlug}` | Seed script | `/api/starter-lists` | Curated onboarding picks by topic. |
| `weeklyDigests/{id}` | Weekly cron | Account deletion, possible audit views | Digest send history. |
| `telegramLinkCodes/{code}` | Telegram link route | Telegram webhook/poll | Short-lived account linking code. |
| `whatsappLinkCodes/{code}` | WhatsApp link route | WhatsApp webhook | Short-lived account linking code. |
| `feedCache/{uid}` | Rudolf feed helper | Rudolf chat | Cached recommendation context for chat. |
| `telegramChats/{chatId}` | Rudolf memory helper | Rudolf chat | Recent links Rudolf sent, also used for WhatsApp keys like `wa:<id>`. |
| `feedback/{id}` | `/api/feedback` | Admin/operator | Rating/comment submissions from the feedback widget. |

`knowledgeItems` are deterministic per user and URL. `lib/firestore/items.ts`
hashes `${userId}::${url}` and slices it to 24 characters, so saving the same
URL twice returns the existing item instead of creating duplicates.

Important fields on a `knowledgeItems` doc:

- `userId`, `url`, `title`, `description`, `image`, `favicon`, `domain`.
- `status`: `pending`, `processing`, `completed`, or `failed`.
- `read`, `readAt`, `isFavorite`, `isArchived`.
- `note`: user comment sent with a link.
- `ai`: structured summary fields from Claude:
  - `summary`
  - `sections`
  - `takeaways`
  - `tldr`
  - `topics`
  - `keywords`
  - `difficulty`
  - `sentiment`
  - `readingTime`
  - `wordCount`
  - `degraded`
  - `aiModel`

### Firestore Security Rules

`firestore.rules` uses the principle "users can only read/write their own data".

Client-accessible:

- `users/{uid}`: signed-in user can read/write their own profile.
- `preferences/{uid}`: signed-in user can read/write their own preferences.
- `knowledgeItems/{id}`: user can read/delete own items, create own items, and
  update user-facing flags.

Backend-only:

- AI/status/ownership fields on `knowledgeItems` are not client-writable.
- `recommendations`, `weeklyDigests`, and `notifications` are read-only for
  their owner and never client-writable.
- `analytics` and `systemJobs` have no client access.

The Admin SDK bypasses rules, so server code must keep ownership checks in
route handlers and data access helpers.

## Main User Flows

### Save a Link From the Dashboard

Files:

- `components/dashboard/SaveLinkBar.tsx`
- `hooks/use-knowledge-items.ts`
- `lib/api-client.ts`
- `app/api/items/route.ts`
- `lib/firestore/items.ts`
- `lib/items/process-item.ts`

Flow:

1. User enters a URL in the dashboard.
2. `useKnowledgeItems().save()` calls `apiFetch("/api/items", { method: "POST" })`.
3. `apiFetch` attaches the Firebase ID token.
4. `/api/items` verifies the token.
5. `createPendingItem()` creates or reuses a Firestore doc.
6. New items are queued with Next.js `after()` for best-effort background
   processing.
7. The dashboard also runs `/api/items/process` as a safety net while it sees
   pending/failed/stale items.
8. Firestore `onSnapshot` updates the UI live as the item changes status.

Why this design:

- Fast user response: saving does not wait for AI processing.
- Idempotent saves: same URL is not duplicated.
- Resilient processing: if background processing fails, dashboard open/polling
  retries it.

### Process a Saved Item

Files:

- `lib/items/process-item.ts`
- `lib/ai/extract-content.ts`
- `lib/ai/analyze.ts`
- `lib/ai/claude.ts`

Flow:

1. Transactionally claim an item if it is `pending`, `failed`, or stale
   `processing`.
2. Fetch the URL.
3. Extract readable content with `@mozilla/readability` and `linkedom`.
4. Special-case YouTube with oEmbed to get better title/thumbnail metadata.
5. Cap extracted text at 14,000 characters to control AI cost.
6. Ask Claude Haiku 4.5 for a structured tool response.
7. Validate Claude output with zod.
8. Write `ai` fields and set `status: "completed"`.
9. On failure, salvage metadata where possible, mark `failed`, and increment
   `retryCount`.

Why this design:

- Transactional claiming prevents two workers from processing the same item.
- Extraction happens outside the transaction because it is slow/networked.
- Zod validation protects downstream UI from malformed model output.
- Metadata salvage keeps failed items useful instead of blank.

### Dashboard Recommendations

Files:

- `hooks/use-recommendations.ts`
- `app/api/recommendations/route.ts`
- `lib/recommendations/generate.ts`
- `lib/recommendations/web-feed.ts`
- `lib/recommendations/sources/*`

Recommendation buckets:

1. `matched`: community items saved by other users that share the user's topics.
2. `discover`: popular community items outside the user's known topics.
3. `web`: external picks from enabled sources.

Taste profile inputs:

- Topics from the user's completed saved items.
- Onboarding `preferredTopics`.
- Starter picks from onboarding.
- Dismissed URLs.
- Muted topics.

External sources:

| Source | File | Key needed | Notes |
| --- | --- | --- | --- |
| Medium RSS | `medium.ts` | None | Always enabled. Uses Medium tag feeds and UX Collective feed. |
| YouTube Data API | `youtube.ts` | `YOUTUBE_API_KEY` | Most-viewed recent videos by topic. |
| Spotify Web API | `spotify.ts` | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Podcast episodes by topic. |
| Google Custom Search | `google-search.ts` | `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` | Web-wide fresh article search. |

Why this design:

- Recommendations work even with no paid source keys because Medium RSS is keyless.
- External source fetches are topic-level cached with `unstable_cache`, so many
  users with the same topic share the upstream calls.
- Personal exclusions and dismissals happen after the cache, so user feedback is
  immediate.

### Onboarding

Files:

- `app/onboarding/page.tsx`
- `components/onboarding/*`
- `app/api/starter-lists/route.ts`
- `scripts/data/starter-lists/*.json`
- `scripts/seed-starter-lists.mjs`

Flow:

1. User sets name, confirms email, optionally uploads avatar.
2. User selects interest topics. Only the Design group is enabled for now.
3. App fetches curated starter list items for selected topics.
4. User selects starter picks.
5. User chooses delivery channel and day.
6. Preferences and starter picks are saved on `users/{uid}`.
7. `onboardedAt` is written so the flow does not repeat.

Why this design:

- New users have taste signals before they save enough items.
- Uploaded avatars are compressed into a small data URL, avoiding a separate
  storage bucket.

### Weekly Digest

Files:

- `vercel.json`
- `app/api/cron/weekly-digest/route.ts`
- `lib/digest/build.ts`
- `lib/email/resend.ts`
- `lib/telegram/send.ts`
- `lib/telegram/nudge.ts`

Flow:

1. Vercel Cron calls `/api/cron/weekly-digest` daily at `0 8 * * *`.
2. Route requires `Authorization: Bearer $CRON_SECRET`.
3. `buildWeeklyDigests()` scans users and completed items.
4. It builds sections for saved-this-week, unread items, read stats, and
   recommendations.
5. It sends via Telegram if chosen and linked.
6. It falls back to email when Telegram is not selected or fails.
7. It writes a `weeklyDigests` audit doc.
8. It also runs Telegram nudges because the project is using one cron slot.

Why this design:

- Daily cron plus per-user delivery day avoids seven separate cron jobs.
- Email fallback protects delivery when Telegram is unavailable.
- The digest uses the same recommendation engine as the dashboard.

### Telegram Linking and Chat

Files:

- `components/TelegramConnect.tsx`
- `app/api/telegram/link/route.ts`
- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/poll/route.ts`
- `lib/telegram/linking.ts`
- `lib/telegram/chat.ts`
- `lib/rudolf/chat.ts`

Flow:

1. Signed-in user requests a Telegram connect link.
2. Server creates a short-lived `telegramLinkCodes/{code}` doc.
3. User opens `https://t.me/<bot>?start=<code>`.
4. Telegram sends `/start <code>` to the webhook.
5. Server stores `telegramChatId` on `users/{uid}`.
6. Future messages route through the shared Rudolf chat brain.

Development note:

- `app/api/telegram/poll/route.ts` exists because local development often cannot
  receive public Telegram webhooks.

### WhatsApp Linking and Chat

Files:

- `components/WhatsAppConnect.tsx`
- `app/api/whatsapp/link/route.ts`
- `app/api/whatsapp/webhook/route.ts`
- `lib/whatsapp/linking.ts`
- `lib/whatsapp/chat.ts`
- `lib/rudolf/chat.ts`

Flow:

1. Signed-in user requests a WhatsApp connect link.
2. Server creates a short-lived `whatsappLinkCodes/{code}` doc.
3. User opens `wa.me/<business-number>?text=connect <code>`.
4. WhatsApp webhook receives the inbound message.
5. Webhook verifies Meta's HMAC signature.
6. Server stores `whatsappWaId` on `users/{uid}`.
7. Future messages route through the shared Rudolf chat brain.

Why this design:

- The user never types their phone number into Layrrrd.
- WhatsApp sender identity comes from the signed inbound webhook payload.
- Telegram and WhatsApp share the same link ingestion and Q&A logic.

### Rudolf Chat Brain

Files:

- `lib/rudolf/chat.ts`
- `lib/rudolf/feed.ts`
- `lib/rudolf/memory.ts`

Rudolf handles:

- Detecting links in messages.
- Saving up to three links per message.
- Keeping the user's message text as a bookmark note.
- Processing newly saved items inline so the chat can respond with a gist.
- Answering user questions using:
  - processed saved items,
  - cached recommendation feed,
  - recent links Rudolf sent.

Why this design:

- Channel adapters only handle protocol details like message limits, formatting,
  typing/read indicators, and chat ID lookup.
- The expensive/complex logic lives once in `lib/rudolf/chat.ts`.

### Chrome Extension

Files:

- `extension/manifest.json`
- `extension/popup.html`
- `extension/popup.js`
- `extension/content.js`
- `lib/http.ts`

Flow:

1. User opens the extension popup.
2. Popup gets active tab URL/title/favicon.
3. Popup signs in with Google via `chrome.identity`.
4. Popup exchanges the Google access token for a Firebase ID token.
5. Popup calls `${APP_URL}/api/items`.
6. API CORS helper reflects the extension origin and still requires a valid
   Firebase Bearer token.

Why this design:

- The extension uses the same account and API as the web app.
- It avoids bundling the Firebase JS SDK into the extension.
- CORS is permissive by origin but auth is strict by token.

## API Route Reference

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/items` | `GET` | Firebase Bearer | List current user's saved items. |
| `/api/items` | `POST` | Firebase Bearer | Save a URL and queue processing. |
| `/api/items/[id]` | `GET` | Firebase Bearer | Read one item owned by the user. |
| `/api/items/[id]` | `DELETE` | Firebase Bearer | Delete one item owned by the user. |
| `/api/items/process` | `POST` | Firebase Bearer | Process current user's pending/failed/stale items. |
| `/api/recommendations` | `GET` | Firebase Bearer | Build recommendation buckets and web feed. |
| `/api/web-summary` | `GET` | Firebase Bearer | Summarize a recommendation URL the user has not saved. |
| `/api/starter-lists` | `GET` | Firebase Bearer | Return curated onboarding items for selected topics. |
| `/api/account` | `DELETE` | Firebase Bearer | Delete user data and Firebase Auth account. |
| `/api/feedback` | `POST` | Optional Firebase Bearer | Store rating/comment feedback. |
| `/api/telegram/link` | `POST` | Firebase Bearer | Create Telegram deep link. |
| `/api/telegram/webhook` | `POST` | Telegram webhook secret | Process production Telegram updates. |
| `/api/telegram/poll` | `POST` | Firebase Bearer or cron secret | Poll Telegram updates for local/dev ops. |
| `/api/whatsapp/link` | `POST` | Firebase Bearer | Create WhatsApp wa.me connect link. |
| `/api/whatsapp/webhook` | `GET` | Verify token query | Meta webhook verification challenge. |
| `/api/whatsapp/webhook` | `POST` | Meta HMAC signature | Process WhatsApp inbound messages. |
| `/api/cron/weekly-digest` | `GET`/`POST` | `CRON_SECRET` | Send due weekly digests and nudges. |

## Environment Variables

The authoritative template is `.env.example`.

### Required for core app

| Variable | Used by | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Digest links, extension config reference | Correct absolute app links. |
| `NEXT_PUBLIC_FIREBASE_*` | Browser Firebase SDK | Web auth and client Firestore. |
| `FIREBASE_PROJECT_ID` | Firebase Admin | Server auth/database. |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin | Server auth/database. |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin | Server auth/database. |
| `ANTHROPIC_API_KEY` | Claude SDK | Item processing and Rudolf answers. |

### Required for scheduled/background features

| Variable | Used by | Required for |
| --- | --- | --- |
| `CRON_SECRET` | Cron and some ops endpoints | Weekly digest route and protected polling. |
| `RESEND_API_KEY` | Resend client | Email digest delivery. |
| `RESEND_FROM_EMAIL` | Resend client | Email sender identity. |

### Messaging

| Variable | Used by | Required for |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram send/linking/poll | Telegram chat and delivery. |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook | Production Telegram webhook security. |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp send | WhatsApp replies. |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp send | WhatsApp replies. |
| `WHATSAPP_BUSINESS_NUMBER` | WhatsApp link route | wa.me connect link. |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook GET | Meta webhook setup. |
| `WHATSAPP_APP_SECRET` | WhatsApp webhook POST | HMAC signature verification. |

### Optional recommendation sources

| Variable | Used by | Behavior if missing |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | YouTube source | Video recommendations skipped. |
| `SPOTIFY_CLIENT_ID` | Spotify source | Podcast recommendations skipped. |
| `SPOTIFY_CLIENT_SECRET` | Spotify source | Podcast recommendations skipped. |
| `GOOGLE_CSE_API_KEY` | Google source | Web-wide article source skipped. |
| `GOOGLE_CSE_ID` | Google source | Web-wide article source skipped. |
| `GEMINI_API_KEY` | Gemini video helper | Video summaries fall back to captions/description paths. |

### Analytics

| Variable | Used by | Behavior if missing |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog | Analytics no-op. |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog | Defaults to `https://us.i.posthog.com`. |

## Design System Rules

Read `design-system/README.md` before making UI changes.

Important rules:

- Use shadcn/ui components on Tailwind v4.
- Add primitives with `npx shadcn@latest add <component>`.
- Theme tokens live in `app/globals.css`.
- Light-only site. Do not add dark mode unless a real switcher is designed.
- Brand fonts/colors are opt-in. Do not apply them by default.
- The bundled Sardin font is demo/personal-use only. Do not ship it publicly on
  a commercial page without confirming a commercial license.

## Deployment and CI

### Local

```bash
npm install
npm run dev
npm run check
```

`npm run check` runs:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

### CI

`.github/workflows/ci.yml` runs the same lint, typecheck, and build on:

- pushes to `main`
- pull requests

### Vercel

The app is designed for Vercel:

- Next.js routes become Vercel serverless functions.
- `vercel.json` registers one cron job:

```json
{
  "path": "/api/cron/weekly-digest",
  "schedule": "0 8 * * *"
}
```

### Firebase

Deploy Firestore rules/indexes from:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

## Cost Map

Prices and limits change. The numbers below were checked against official
pricing/docs pages on 2026-07-15. Use the linked vendor pages before making a
budget commitment.

### Fixed or Platform Costs

| Vendor | What this app uses | Current pricing signal | Practical note |
| --- | --- | --- | --- |
| Vercel | Hosting, functions, cron, CDN | Hobby is `$0/mo`; Pro is `$20/mo` and includes usage credit. Vercel's page also lists included function invocations, compute, data transfer, analytics, and overages. Source: https://vercel.com/pricing | Hobby may be enough for early testing. Pro is likely needed for commercial/team usage and better controls. |
| Firebase Auth | Email/password and Google auth | Other Authentication services are no-cost up to 50K monthly active users. Phone auth is billed per SMS. Source: https://firebase.google.com/pricing | This app does not use phone auth, so auth should stay free at small/medium scale. |
| Cloud Firestore | Profiles, items, caches, link codes, digest history | Free tier includes 1 GiB stored data, 50K reads/day, 20K writes/day, 20K deletes/day, and 10 GiB/month egress for Standard edition. Source: https://firebase.google.com/pricing | Main usage driver is dashboard live reads, recommendation scans, and digest scans. |
| PostHog | Pageviews and product events | Free tier includes 1M analytics events/month. Usage-based product analytics starts after the free tier. Source: https://posthog.com/pricing | Optional. If `NEXT_PUBLIC_POSTHOG_KEY` is unset, analytics sends nothing. |
| Resend | Weekly digest email | Free tier shown as 3,000 emails/month. Pro is `$20/mo` for 50,000 emails/month plus overage. Source: https://resend.com/pricing | Digest email volume is roughly active email users times sends per month. |

### Usage-Based AI and API Costs

| Vendor | Used by | Current pricing signal | Cost driver |
| --- | --- | --- | --- |
| Anthropic Claude Haiku 4.5 | Item summaries and Rudolf answers | Claude Haiku 4.5 is listed at `$1/MTok` input and `$5/MTok` output on the first-party Claude API. Source: https://platform.claude.com/docs/en/about-claude/pricing | Every processed save, web summary, and bot answer consumes tokens. Extraction caps item text at 14,000 chars to control this. |
| Gemini API | Optional video understanding | Gemini pricing has free tiers and paid token pricing by model. Example current paid Gemini 3.1 Flash-Lite standard pricing: `$0.25/1M` input tokens for text/image/video and `$1.50/1M` output tokens. Source: https://ai.google.dev/gemini-api/docs/pricing | Only used when `GEMINI_API_KEY` is configured and the Gemini video path is invoked. |
| YouTube Data API | Video recommendation source | Default quota docs list 10,000 units/day for most endpoints and 100 `search.list` calls/day; quota-cost page lists `search.list` as 100 and `videos.list` as 1. Sources: https://developers.google.com/youtube/v3/getting-started and https://developers.google.com/youtube/v3/determine_quota_cost | Code does one search and one video details request per topic cache refresh. With 6 topics, estimate about 606 quota units per cache refresh if enabled. |
| Google Custom Search JSON API | Web-wide article recommendations | Existing customers get 100 queries/day free; additional requests cost `$5/1000` queries up to 10K/day. The page says the API is not available for new customers and is discontinued on 2027-01-01 for existing customers. Source: https://developers.google.com/custom-search/v1/overview | This integration needs replacement before 2027 or for new Google customers. |
| Spotify Web API | Podcast recommendations | Uses client credentials and API rate limits. Public docs expose API/rate-limit concepts but no per-request price in this repo's path. Source: https://developer.spotify.com/documentation/web-api | Treat as quota/rate-limit constrained rather than direct metered cost unless Spotify account terms say otherwise. |
| Telegram Bot API | Telegram chat and digest delivery | Telegram says bots can message users at no cost but with rate limits. Paid broadcasts only matter above the free bulk broadcast threshold. Source: https://core.telegram.org/bots/faq | Normal one-to-one chat and small digest sends should not create direct Telegram cost. |
| WhatsApp Cloud API | WhatsApp chat | Meta pricing is country/category/account dependent and changes over time. Source to check: https://developers.facebook.com/docs/whatsapp/pricing/ | This is the least predictable messaging cost. Budget using the Meta dashboard/rate card for target countries and message categories. |

### Rough Cost Formula

Use this to estimate monthly spend:

```text
monthly_cost =
  vercel_plan
  + firebase_overages
  + posthog_overages
  + resend_plan_or_overages
  + anthropic_tokens
  + gemini_tokens_if_enabled
  + google_cse_queries_if_enabled
  + whatsapp_messages
```

Where:

```text
anthropic_tokens =
  (input_tokens / 1_000_000 * 1.00)
  + (output_tokens / 1_000_000 * 5.00)
```

Approximate item-processing cost depends on article length and Claude output.
Because the code caps extracted text to 14,000 characters, a typical processed
save should usually be cents or fractions of a cent, not dollars, but bot Q&A can
become more expensive because it sends a larger library/feed context to Claude.

### Current Cost Risks

1. Claude is the main variable cost. Every save and most bot answers can call it.
2. Recommendation scans currently read Firestore broadly. This is fine at small
   scale but can become a Firestore read cost and latency issue.
3. Google Custom Search is not a durable long-term dependency because the docs
   say it is unavailable for new customers and discontinuing for existing
   customers on 2027-01-01.
4. WhatsApp cost depends on Meta's current message pricing for your recipient
   countries and categories.
5. Vercel function duration matters because item processing, bot answers, and
   digest generation can be network-heavy.

## Scaling Notes

Current architecture is good for an MVP/small community. The first scaling
pressure points will be:

1. Firestore scans in `buildRecommendations()` and `buildWeeklyDigests()`.
   - Current code scans completed `knowledgeItems`.
   - Later improvement: precompute per-topic recommendation pools and per-user
     digest candidates.
2. AI work inside request/serverless lifetimes.
   - Current code uses `after()` and process-on-open.
   - Later improvement: durable queue/worker for item processing.
3. Bot Q&A context size.
   - Current code includes up to 150 items, with fuller summaries for 25.
   - Later improvement: embeddings/search or topic-indexed retrieval.
4. Google Custom Search dependency.
   - Needs replacement before its documented discontinuation.
5. Extension distribution.
   - Current manifest includes a pinned unpacked extension key for local/dev.
   - Chrome Web Store packaging should remove the `key` field.

## Operational Checklist

Before deploying production:

1. Create `.env.local` from `.env.example` locally.
2. Set the same secrets in Vercel Environment Variables.
3. Configure Firebase Auth providers and authorized domains.
4. Deploy Firestore rules and indexes.
5. Configure Resend domain/from address.
6. Register Telegram webhook with `TELEGRAM_WEBHOOK_SECRET`.
7. Configure WhatsApp webhook URL, verify token, app secret, phone number ID,
   and permanent access token.
8. Set `CRON_SECRET` and verify the cron route rejects bad tokens.
9. Run `npm run check`.
10. For UI changes, run `npm run dev` and inspect the affected pages.

## Security Notes

- Firebase public web config is intentionally public. Access is enforced by
  rules and ID-token verification.
- Firebase Admin credentials, Anthropic, Resend, Telegram, WhatsApp, Google,
  and Spotify keys are server secrets and must not be exposed.
- WhatsApp webhook POST verifies `x-hub-signature-256`.
- Telegram webhook verifies `x-telegram-bot-api-secret-token`.
- Cron route requires `CRON_SECRET`.
- Extension API calls still require Firebase Bearer tokens, even though CORS
  reflects the extension origin.
- Account deletion removes user docs, knowledge items, digest history, link
  codes, profile, and finally the Firebase Auth user.

## Development Rules From AGENTS.md

- Do not commit or push unless explicitly asked.
- Prefer existing components and patterns.
- Use shadcn/ui for UI.
- Keep theme changes in `app/globals.css`.
- Run `npm run check` before calling code changes complete.
- For UI work, also run the dev server and inspect the page.

