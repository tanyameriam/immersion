# Layrrrd — Product Requirements Document

**Product name:** Layrrrd ("Layrrrd.")
**Repo / internal name:** `immersion`
**Tagline:** "Save once. Revisit intentionally." / "Save now. Catch up later."
**Doc status:** Reverse-engineered from the codebase on 2026-07-08, spot-corrected 2026-08-07. This is a descriptive PRD of what exists today, not a forward-looking spec — gaps between UI promises and actual implementation are called out explicitly in [§11](#11-known-gaps--discrepancies) so they can be triaged.

> **Read this first.** The product has moved since the original pass, and this
> document has only been corrected where it was factually wrong (business
> model, the removed waitlist, and the gap list in §11). Sections describing
> UI detail and feature scope have *not* been re-verified line by line and may
> still lag the code.
>
> **[docs/architecture.md](docs/architecture.md) is the authoritative technical
> reference** and is kept current. Where the two disagree, that file wins — and
> where either disagrees with the code, the code wins.

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

## 4. Business model

Authoritative source: `lib/billing/config.ts`. Prices live there and nowhere
else, so read that file before quoting a number from this one.

- **Founding Membership** — a one-time payment for lifetime access, not a
  subscription. ₹799 for the first 20 spots, ₹1,199 thereafter, hard-capped at
  100 spots and never offered again once they are gone. Paid via Razorpay.
- **Biscuits** — ₹50 for 15 extra minutes of Rudolf chat, for people on the
  free plan. Bought in packs, never expire, consumed only after the daily free
  allowance is spent.
- **The free plan is generous by design.** Unlimited saves, AI summaries and
  weekly digests are all free. The only metered thing is time spent chatting
  with Rudolf: 120 minutes a day, resetting at midnight India time.
- **No waitlist.** Sign-up is open; the waitlist and its Apps Script webhook
  were removed.

---

## 5. Scope: feature inventory

### 5.1 Marketing site (`/`, unauthenticated)
Single scrolling page composed of: sticky nav (auth-aware), hero with animated mascot, "why" pitch, 4-feature "what's inside" breakdown, "how it works" (4 steps: sign up → save while scrolling → receive digest → gets smarter), pricing, FAQ accordion, contact, footer with legal links (Privacy, Terms, Refund — static pages).

### 5.2 Waitlist — *removed*
The waitlist modal, the `/api/waitlist` route and the `GOOGLE_SCRIPT_URL` Apps Script webhook no longer exist. Sign-up is open to anyone.

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

Mismatches between what the UI promises and what the code does. Reviewed
2026-08-07 — items resolved since the original pass are struck through and kept
for the record rather than deleted, so a reader can tell "already fixed" from
"never was a problem."

### Still open

1. **Weekly Issues tab is built but not rendered** anywhere in the dashboard — `WeeklyIssuesTab.tsx` and `IssueCard.tsx` are mock-data-backed and dormant. Finish or delete.
2. **Community recommendations are promised but always empty:** `matched` and `discover` are retained in the return shape of `generate.ts` and hard-coded to `[]`. The feed is entirely external sources today, while the marketing framing implies a social layer.
3. **Library search only matches whole phrases:** stored keywords are multi-word (`"mountaineering records"`), extracted query terms are usually single words, and Firestore `array-contains-any` demands an exact element match. Harmless below ~100 saves because recency fills the context anyway; degrades quietly above that.
4. **Brand display font license:** `Sardin-DEMO.otf` is explicitly personal-use-only and is live on the wordmark of a site that takes payment. Needs a commercial license or a replacement face.
5. **No automated test suite** — `npm run check` covers lint, types and build only. Nothing verifies behaviour, so a change to Rudolf's system prompt can silently undo an earlier fix.
6. **The daily digest job scans the whole database:** `buildWeeklyDigests()` reads every user and every completed item with no date or ownership filter, every day. Fine now, but it is the first hard scaling ceiling — see the scaling notes in `docs/architecture.md`.

### Resolved since the original pass

7. ~~**Waitlist vs. working product**~~ — waitlist removed entirely; sign-up is open.
8. ~~**Recommendation preferences captured but unused**~~ — `preferredTopics` and `mutedTopics` now shape both the feed and Rudolf's suggestions.
9. ~~**"Delete Account" doesn't delete the account**~~ — `DELETE /api/account` now erases items, digests, link codes, bot memory, support receipts, cached feed, the profile doc and the Firebase Auth user.
10. ~~**"Change Password" button is not wired**~~ — sends a Firebase password-reset email, and is correctly hidden for Google-only accounts.
11. ~~**Telegram needs a numeric chat ID typed by the user**~~ — replaced by a one-time code and deep link; the chat ID is captured automatically.
12. ~~**`@react-email/components` installed but never used**~~ — dependency removed.
13. ~~**Node version mismatch**~~ — `.nvmrc` now matches `engines.node`, so CI tests the runtime production actually uses.
14. ~~**Firestore rules name collections that hold no data**~~ — stale `preferences`, `notifications`, `recommendations`, `analytics` and `systemJobs` blocks removed; unlisted collections are denied by default.

---

## 12. Open questions for stakeholders

- Is "Weekly Issues" still planned, deprioritized, or should the components be removed?
- Is there a commercial license path for the brand display font, or should the wordmark move to a cleared font before wider launch?
- Are community recommendations ("saved by N people") still intended? They are in the pitch and hard-coded empty in the code — either build them or stop implying them.
- Google Custom Search is documented as discontinued for existing customers on 2027-01-01. What replaces the article half of the feed?
