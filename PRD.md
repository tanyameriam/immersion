# Layrrrd — Product Requirements Document

**Product name:** Layrrrd ("Layrrrd.")
**Repo / internal name:** `immersion`
**Tagline:** "Save once. Revisit intentionally." / "Save now. Catch up later."
**Doc status:** Reverse-engineered from the current codebase (2026-07-08). This is a descriptive PRD of what exists today, not a forward-looking spec — gaps between UI promises and actual implementation are called out explicitly in [§11](#11-known-gaps--discrepancies) so they can be triaged.

---

## 1. Problem statement

People already save content constantly — tweets, LinkedIn posts, articles, Dribbble shots — but it scatters across bookmarks, browser tabs, screenshots, Notes, and Telegram saved-messages, and is never revisited. The product's core thesis (stated verbatim in the marketing copy):

> "You don't have a discovery problem. You have a **revisit** problem."

Layrrrd's bet is that the fix isn't a better bookmarking UI — it's removing the need to organize anything, and instead **pushing** a curated, digestible summary of what was saved back to the user on a schedule they chose.

## 2. Target users

- **Primary persona (current):** designers. Profile Settings currently only offers "Designer" as a profession option, and recommendation-interest topics (Product Design, UX Design, Typography, Accessibility, AI, etc.) are design-industry-specific.
- **Usage pattern assumed:** heavy scrollers of Twitter/X, LinkedIn, Dribbble, and design blogs who save far more than they read, and want the "read later" pile to resurface itself instead of relying on willpower to revisit a library.

## 3. Value proposition / core loop

1. **Save frictionlessly** — one click from a browser extension (or paste a URL into the web app).
2. **Layrrrd reads it for you** — Claude (Anthropic) extracts and summarizes the content automatically; no manual tagging.
3. **It comes back to you** — a personalized weekly digest (email or Telegram), grouped by topic, on a day of the week the user picked.
4. **It gets smarter / more social over time** — a "Recommended" tab surfaces content saved by other users with overlapping interests ("saved by N people").

## 4. Business model (as reflected in the marketing site)

- Single paid tier, **"Founding Member," ₹99/month**, everything included: unlimited saves, weekly curated reading list, source/context retained per save, delivery on the user's schedule.
- Currently gated behind a **waitlist** (email capture → forwarded to a Google Apps Script webhook) — see [§11](#11-known-gaps--discrepancies) for the discrepancy between waitlist framing and the fully working product behind it.

---

## 5. Scope: feature inventory

### 5.1 Marketing site (`/`, unauthenticated)
Single scrolling page composed of: sticky nav (auth-aware), hero with animated mascot, "why" pitch, 4-feature "what's inside" breakdown, "how it works" (4 steps: sign up → save while scrolling → receive digest → gets smarter), pricing, FAQ accordion, contact, footer with legal links (Privacy, Terms, Refund — static pages).

### 5.2 Waitlist
Modal email capture → `POST /api/waitlist` → forwards to a Google Apps Script webhook (`GOOGLE_SCRIPT_URL`). Fails loudly (500) if not configured, by design.

### 5.3 Authentication
- Firebase Auth: **Google OAuth popup** and **email/password**, with friendly error mapping for common failure codes (wrong password, email in use, weak password, popup closed, rate-limited, etc.).
- Auth state hydration flag prevents flash-of-signed-out-content.
- Every successful sign-in upserts a `users/{uid}` Firestore profile doc.
- Protected routes (`/dashboard`, `/dashboard/profile`) are guarded **client-side** by a `RequireAuth` wrapper (no Next.js middleware) — redirects to `/` and opens the sign-in modal if unauthenticated.

### 5.4 Dashboard — Bookmarks tab
- Extension-install callout (auto-detects whether the Chrome extension is present).
- Manual "paste a link to save" bar.
- Search, filter (category / content type / reading time / date saved / source), sort (recent / oldest / recently published / alphabetical / reading time), grid/list view toggle.
- Bulk actions: mark as read, remove, clear selection.
- Per-item card: expandable detail (AI summary, keywords, difficulty/sentiment badges, or a "still reading" placeholder while processing), overflow menu (mark read, copy link, native share, report [no-op], remove).
- Saves render **instantly** as a pending card and live-update in place via Firestore real-time subscription once AI processing finishes (typically 5–10s).

### 5.5 Dashboard — Recommended tab
Community-sourced suggestions (falls back to sample data until a real community exists); same search/filter/sort/card UI; a "Bookmark" action saves the item into the user's own library through the same save pipeline.

### 5.6 Browser extension (Chrome, Manifest V3)
One-click save of the currently open tab from anywhere in the browser:
1. Reads active tab title/URL.
2. Obtains a Google OAuth token via `chrome.identity`.
3. Exchanges it for a Firebase ID token directly against the Firebase Identity Toolkit REST API (no bundled Firebase SDK).
4. Calls the same authenticated `POST /api/items` endpoint the web app uses.
5. Shows inline progress ("Signing you in…" → "Saving…" → "Saved! Layrrrd is reading it now.").

A tiny content script only sets a DOM marker attribute on Layrrrd's own domains so the web app can detect "extension is installed" and update its UI accordingly. Distributed via the Chrome Web Store (store assets and a live listing URL exist in the repo).

### 5.7 AI content analysis
Every saved item is run through:
1. **Extraction** — fetch the URL (8s timeout, desktop Chrome UA to avoid bot-shells); YouTube links use the oEmbed API directly; articles are parsed with Mozilla Readability over a `linkedom`-parsed DOM; if extraction yields too little text, falls back to `<meta>`/OG-tag scraping and flags the item `degraded` (handles paywalls / JS-heavy / login-gated pages without failing outright).
2. **Analysis** — the extracted text (capped ~14k chars) is sent to Claude Haiku (`claude-haiku-4-5`) via a forced tool-call, returning structured, schema-validated fields: `summary`, `tldr`, `topics[]`, `keywords[]`, `difficulty` (Beginner/Intermediate/Advanced), `sentiment` (Positive/Neutral/Negative). Reading time and word count are computed deterministically in code, not by the model.
3. **Resilience** — processing is claimed transactionally (so concurrent workers can't double-process), stale in-flight jobs (>3 min) are recovered, failures are recorded with an error message and retry count, and a client-side "sweep" (poll every 6s while anything is unprocessed) guarantees eventual completion even if the initial background execution doesn't fire.

### 5.8 Recommendations
Deterministic scoring algorithm (not an LLM call) that surfaces other users' completed items based on topic overlap with the current user's own saved-item topics.

### 5.9 Weekly digest
- Vercel Cron hits `/api/cron/weekly-digest` daily at 08:00 UTC; each user is only actually sent a digest on **their own chosen day of the week** (Profile Settings), giving a "weekly" cadence per user off a daily trigger.
- Content: topic-grouped items saved that week (top 6 topics, up to 5 items each), an unread backlog (up to 8 items), and a "you read more/less than the community average" gamification line.
- Delivery: **Telegram** (raw Bot API call) and/or **email** (via Resend, hand-built inline-styled HTML — not the `@react-email/components` package, despite it being a dependency). Both channels no-op gracefully rather than hard-failing if not configured. If Telegram is preferred but fails, email is sent as a fallback.
- Every send attempt is logged to a `weeklyDigests` audit collection.
- Endpoint is protected by a `CRON_SECRET` bearer token; supports a `?force=1` override for manual testing.

### 5.10 Profile / settings
- Personal info (name, profession).
- Recommendation-interest checkboxes (currently **not yet wired** into the recommendation algorithm — see [§11](#11-known-gaps--discrepancies)).
- Newsletter delivery channel (email vs. Telegram), Telegram handle/day-of-week picker, with Slack/WhatsApp/Discord/Push shown as disabled "coming soon."
- Account panel: registered email (read-only), a "Change Password" button that is **not wired up**, and a "Delete Account" button that currently only signs the user out — it does **not** delete their Firebase account or Firestore data (a real admin script, `scripts/reset-data.mjs`, does perform true deletion but is a developer/ops tool, not user-facing).

### 5.11 Weekly Issues (parked feature)
UI components for a "past digests" archive exist (`WeeklyIssuesTab`, `IssueCard`) and are fully mock-data-backed, but the tab is **not currently rendered** in the dashboard — built but dormant.

---

## 6. Data model (Firestore)

| Collection | Purpose | Client access |
|---|---|---|
| `users/{uid}` | Profile: name, email, photo, provider, `preferredTopics`, `notificationPreference` (email/telegram), `telegramChatId`, `notificationDay`, timestamps | Owner read/write |
| `knowledgeItems/{itemId}` | Core saved-content entity (see below) | Owner read/delete; create requires matching `userId`; update blocked on AI/pipeline fields |
| `recommendations/{id}` | Reserved for a future materialized-recommendation cache (currently computed on-the-fly per request instead) | Owner read only |
| `weeklyDigests/{id}` | Audit log of digest sends (`savedThisWeek`, `readThisWeek`, `emailSent`, `telegramSent`) | Owner read only |
| `preferences/{uid}` | Declared in rules; superseded in practice by fields on `users/{uid}` | Owner read/write (unused) |
| `notifications/{id}` | Declared in rules; no write path implemented yet | Owner read only |
| `analytics/{id}`, `systemJobs/{id}` | Reserved, backend-only | No client access |

**`knowledgeItems` fields:** `userId`, `url`, `title`, `description`, `image`, `favicon`, `domain`, `type` (`"article"` today), `status` (`pending`/`processing`/`completed`/`failed`), `isFavorite`, `isArchived`, `read`, `readAt`, `createdAt`/`updatedAt`/`processingStartedAt`, `retryCount`, `error`, and `ai` (`summary`, `tldr`, `topics[]`, `keywords[]`, `difficulty`, `sentiment`, `readingTime`, `wordCount`, `degraded`, `aiModel`).

Document ID is `sha256(userId + "::" + url).slice(0,24)` — saving the same URL twice is idempotent by construction.

**Security model:** owners can read/write their own data; AI-derived and pipeline-control fields (`ai`, `status`, `processingStartedAt`, `retryCount`, `createdAt`) can only be written by the Admin SDK (server), never directly by a client, even the owner's.

---

## 7. Architecture overview

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui (`base-sera` style, `@base-ui/react` primitives, not Radix), Framer Motion, light-mode-only design with square corners (`--radius: 0`) as a deliberate editorial choice.
- **Backend:** Next.js API routes on Vercel (Node runtime), no separate backend service.
- **Auth:** Firebase Authentication (Google + email/password); ID tokens verified server-side via Firebase Admin SDK.
- **Database:** Firestore, real-time client subscriptions for live UI updates; Admin SDK for all privileged/pipeline writes.
- **AI:** Anthropic Claude (`claude-haiku-4-5`) via `@anthropic-ai/sdk`, forced tool-use for structured output.
- **Content extraction:** `@mozilla/readability` + `linkedom`, with a metadata-scraping fallback and a YouTube oEmbed special case.
- **Email:** Resend.
- **Messaging:** Telegram Bot API (raw HTTP, no SDK).
- **Scheduling:** Vercel Cron (daily trigger; per-user weekly cadence is application logic).
- **Browser extension:** Chrome Manifest V3, no service worker — logic lives entirely in the popup; authenticates independently against Firebase's REST API rather than embedding the Firebase JS SDK.
- **CI/CD:** GitHub Actions runs lint + typecheck + build on every push/PR (mirrors the Vercel build exactly); Vercel auto-deploys `main` and PR previews.
- **Testing:** No automated test suite — `TESTING.md` defines a manual, end-to-end QA script covering sign-in, save pipeline (including degraded/paywalled/dead-link edge cases), multi-account isolation, and digest triggering; `scripts/reset-data.mjs` resets all Firestore/Auth data for a clean-slate QA pass.

---

## 8. Environment configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL |
| `GOOGLE_SCRIPT_URL` | Waitlist-form webhook |
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | Firebase Web SDK config (public) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK service account (secret) |
| `ANTHROPIC_API_KEY` | Claude API access |
| `TELEGRAM_BOT_TOKEN` | Digest delivery via Telegram |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Digest delivery via email |
| `CRON_SECRET` | Bearer-token guard on the weekly-digest cron endpoint |

---

## 9. Non-functional requirements

- **Resilience over correctness-by-construction:** the processing pipeline is built to never leave an item stuck — degrade gracefully on paywalls, fail explicitly with a stored error and retry count, and self-heal via both a claim-timeout and a client-driven sweep.
- **Cost/latency-conscious AI usage:** Haiku chosen explicitly as "the cost/latency sweet spot for high-volume summarization"; extracted text capped at ~14k characters before it reaches the model.
- **CORS-aware API surface:** `/api/items` reflects the request `Origin` (needed because the Chrome extension's ID differs between unpacked/dev and published builds).
- **No dark mode, no rounded corners:** explicit, documented design-system constraints (AGENTS.md / design-system README) — treat as product requirements, not oversights.
- **Brand typography is opt-in only:** the custom display font bundled in the repo is under a personal-use-only demo license and must not be treated as cleared for general commercial use until a license is purchased.

---

## 10. Success metrics (inferred, not instrumented)

No analytics/telemetry code was found in the repo (the `analytics` Firestore collection is reserved but unwritten). Candidate metrics implied by the product's own value proposition, for future instrumentation:
- Save → open-digest → click-through rate (does the digest actually drive revisits?).
- % of saved items ever marked "read."
- Digest delivery success rate by channel (email vs. Telegram), given both channels can silently no-op on misconfiguration.
- Extension-install rate among active web users (the dashboard already surfaces this state, just not aggregated).

---

## 11. Known gaps / discrepancies

These are real mismatches between what the UI promises and what the code currently does — flagged so they can be prioritized rather than discovered later:

1. **Waitlist vs. working product:** the marketing site gates everything behind a waitlist, yet a fully functional sign-up/dashboard/AI pipeline already exists and is reachable directly. Decide whether the waitlist is intentional gating (e.g., managed rollout) or stale marketing copy.
2. **Recommendation preferences are captured but unused:** Profile Settings lets users check topics of interest, but `lib/recommendations/generate.ts` only scores against the user's own saved-item topics, ignoring `preferredTopics` entirely.
3. **"Delete Account" doesn't delete the account:** it signs the user out and redirects home; actual data/account deletion only exists as a developer script (`scripts/reset-data.mjs`).
4. **"Change Password" button is not wired to any handler.**
5. **Weekly Issues tab is built but not rendered** anywhere in the dashboard — fully mock-data-backed and dormant.
6. **`@react-email/components` is an installed dependency but never used** — digest emails are hand-built HTML strings in `lib/digest/build.ts` instead.
7. **Telegram delivery requires a numeric chat ID**, but the profile field accepts free-text (commonly an `@username`), so most users who fill it in naturally will not actually receive digests without an extra step (starting a chat with the bot first).
8. **Several Firestore collections/indexes are provisioned but unused in code** (`preferences`, `notifications`, materialized `recommendations`, keyword/topic-filtered indexes) — forward-looking scaffolding, not active bugs, but worth confirming against actual roadmap.
9. **Node version mismatch:** `.nvmrc` pins `22`, `package.json engines.node` says `24.x`; CI uses `.nvmrc`.
10. **Brand display font license:** bundled font file is explicitly marked personal-use-only demo; currently used live on the wordmark.
11. **No automated test suite** — all QA is manual per `TESTING.md`; regressions in the save/AI pipeline would only be caught by a human running the documented script.

---

## 12. Open questions for stakeholders

- Is the waitlist meant to stay, or should the dashboard be opened up directly?
- Should recommendation scoring incorporate stated topic preferences, or is behavior-based scoring the intended design?
- Is "Weekly Issues" still planned, deprioritized, or should the components be removed?
- What's the intended fix for Telegram chat-ID collection (bot deep-link / `/start` flow to capture the numeric ID automatically)?
- Is there a commercial license path for the brand display font, or should the wordmark move to a cleared font before wider launch?
