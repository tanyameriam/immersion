---
name: verify
description: How to build, run, and drive Layrrrd locally to verify changes end-to-end (auth handle, API surface, cleanup).
---

# Verifying Layrrrd changes

## Build / launch

- `npm run check` = lint + typecheck + build (CI parity, not verification).
- `npm run dev` starts the app on http://localhost:3000 using `.env.local`
  (real Firebase project `layrrrd-18b1e` - writes are LIVE data).

## Getting an authenticated handle (headless)

Google popup sign-in doesn't work headless. Instead:

1. Create/reset a disposable password user:
   `node --env-file=.env.local scripts/set-test-password.mjs <email> <password>`
2. Mint a Firebase ID token via REST (keep it in a shell variable, do NOT
   write it to a file - the permission classifier blocks persisting tokens):
   `curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$NEXT_PUBLIC_FIREBASE_API_KEY" -d '{"email":...,"password":...,"returnSecureToken":true}'`
3. Call API routes with `Authorization: Bearer $TOKEN`. Doc ids are
   deterministic: `sha256("<uid>::<canonicalUrl>").slice(0,24)`, so
   `/api/items/<id>` is reachable without list queries.

## Flows worth driving

- Save/dedup: POST /api/items twice with URL variants (utm, www., youtu.be
  vs watch?v=) - expect same item id, 201 then 200 with `created:false`.
- Processing: POST /api/items/process retries pending/failed items; check
  the item doc for `status`, `type`, `ai.degraded`, top-level
  `topics`/`keywords`. Anthropic 529 "Overloaded" errors are transient - the
  sweep retries them.
- Cron digest: requires `Authorization: Bearer $CRON_SECRET`; do NOT run
  against live users casually - it actually sends email/Telegram.

## Gotchas

- `listItems`/`searchItems`/dashboard onSnapshot need the composite indexes
  from `firestore.indexes.json` DEPLOYED, or every call 500s with
  FAILED_PRECONDITION. The dev log prints index-creation URLs.
- Creating indexes or deploying rules programmatically is blocked by the
  permission classifier - the user must run
  `npx firebase-tools deploy --only firestore:indexes,firestore:rules`
  (needs `firebase login`).
- Clean up disposable users afterwards:
  `node --env-file=.env.local scripts/reset-data.mjs --user <email> --confirm`
- Scripts follow a dry-run-by-default convention: `--confirm` to write.
