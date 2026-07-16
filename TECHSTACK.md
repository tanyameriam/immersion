# Tech Stack

## Core Framework
- **Next.js 15** (App Router) — React framework, server + API routes
- **React 19** / **React DOM 19**
- **TypeScript 5**
- **Node.js 22/24** (`.nvmrc` pins 22, `package.json engines` requests 24.x)

## Styling & UI
- **Tailwind CSS 4** (`@tailwindcss/postcss`)
- **shadcn** component system on top of **Base UI** (`@base-ui/react`)
- **class-variance-authority**, **clsx**, **tailwind-merge** — class composition utilities
- **tw-animate-css** — animation utility classes
- **Framer Motion** — animations/transitions
- **lucide-react** — icon set
- **sonner** — toast notifications
- **react-qr-code** — QR code rendering (Telegram connect flow)

## Backend / Data
- **Firebase** (client SDK) + **firebase-admin** (server SDK)
  - **Firestore** as the primary database (`firestore.rules`, `firestore.indexes.json`)
  - Firebase Auth (client keys in env)
- Next.js **API routes** (under `app/api`) for server-side logic, including a **cron endpoint** (`/api/cron/weekly-digest`, scheduled via `vercel.json`)

## AI / Content Processing
- **@anthropic-ai/sdk** — Claude API integration
- **GEMINI_API_KEY** env var — Google Gemini API integration
- **@mozilla/readability** + **linkedom** — server-side HTML parsing/readability extraction for saved pages
- **YouTube Data API**, **Spotify Web API**, **Google Custom Search API** — external content/metadata lookups (env-configured)

## Email
- **Resend** — transactional email delivery
- **@react-email/components** — React-based email templates

## Analytics
- **PostHog** (`posthog-js`) — product analytics

## Messaging / Integrations
- **Telegram Bot API** — bot token + webhook secret configured (QR-based phone handoff flow)
- **Browser Extension** (`extension/`) — Manifest V3 Chrome extension ("Layrrrd: Save to your knowledge layer") that saves pages to the app via `content.js`/`popup.js`

## Validation
- **Zod** — schema validation

## Tooling
- **ESLint** (`eslint-config-next`) — linting
- **TypeScript compiler** — type checking (`tsc --noEmit`)
- **node-webpmux** — WebP image manipulation (build/scripts use)

## Deployment / Infra
- **Vercel** — hosting + deployment (`vercel.json`, `.vercelignore`), cron jobs
- **Firebase** — Firestore database + security rules, deployed independently via Firebase CLI

## Package Management
- **npm** (`package-lock.json`)
