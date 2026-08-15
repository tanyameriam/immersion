# Environments: dev → test → production

Three isolated environments. Real user data exists **only** in production;
dev and test run against separate backends with fake, seeded data, so QA can
never read or corrupt a real user's account.

| | Dev | Test (QA) | Production (live) |
| --- | --- | --- | --- |
| Runs at | `localhost:3000` | `test.layrrrd.com` (Vercel Preview) | `layrrrd.com` / `app.layrrrd.com` |
| Deployed from | your machine | `test` branch | `main` branch |
| Firebase project | Emulator Suite (or `layrrrd-test`) | `layrrrd-test` | `layrrrd-18b1e` |
| Razorpay | test keys | test keys | live keys |
| PostHog analytics | off | off | on |

## The flow

1. Develop on a feature branch, `npm run dev` locally.
2. Merge (or push) the feature branch into the `test` branch. Vercel
   auto-deploys it to `test.layrrrd.com` against the `layrrrd-test` Firebase
   project. Anyone with the link can QA there - accounts, checkout (Razorpay
   test cards), digests are all real flows against fake data.
3. Bugs found in QA are fixed on the feature branch and re-merged into
   `test`.
4. When QA passes, merge `test` into `main`. Only that merge touches
   production.

Env vars are scoped per environment in Vercel (Project → Settings →
Environment Variables): Production values point at `layrrrd-18b1e` + live
keys, Preview values point at `layrrrd-test` + test keys. A preview
deployment holds no production credentials, which is what makes prod data
physically unreachable from QA.

## Local dev

Two options:

- **Emulators (preferred, zero-risk, offline):** run `npm run emulators` in
  one terminal, `npm run dev` in another, with the three emulator vars set in
  `.env.local` (see `.env.example`). Firestore + Auth run entirely on your
  machine and enforce `firestore.rules`. Emulator UI: `localhost:4000`.
- **Shared test project:** leave the emulator vars unset and fill
  `.env.local` with the `layrrrd-test` web + admin credentials.

Never put `layrrrd-18b1e` (production) credentials in `.env.local` except
temporarily to run an admin script on prod (backup first, see below).

## Firestore rules & indexes

`.firebaserc` defines two aliases; deploys are always explicit:

```bash
npx firebase-tools deploy --only firestore --project test
npx firebase-tools deploy --only firestore --project prod
```

Deploy to `test` first, QA, then `prod` - same order as code.

## Test data

Seed the test project with the existing scripts, pointed at test credentials
(an env file containing the `layrrrd-test` admin credentials):

```bash
node --env-file=.env.test scripts/seed-items.mjs
node --env-file=.env.test scripts/seed-starter-lists.mjs
```

`scripts/reset-data.mjs` against test credentials gives QA a clean slate any
time. Never seed test with copies of production data - invent users instead.

## Production backups

Firestore scheduled backups need the Blaze plan, so back up manually before
any risky migration or destructive script:

```bash
npm run backup   # exports all collections + auth users to backups/ (gitignored)
```

## Per-service notes

- **Crons:** `vercel.json` crons run on Production only. To QA the digest,
  call `/api/cron/weekly-digest` on `test.layrrrd.com` with the Preview
  `CRON_SECRET`.
- **Telegram:** one bot = one webhook URL, so test uses a separate bot
  (create via @BotFather) whose webhook points at
  `test.layrrrd.com/api/telegram/webhook`.
- **WhatsApp:** use Meta's free test number, webhook pointed at
  `test.layrrrd.com/api/whatsapp/webhook`.
- **Razorpay:** test-mode keys + a test-mode webhook registered to
  `test.layrrrd.com/api/payments/webhook`. Pay with Razorpay test cards.
- **Resend:** leave the key unset in Preview (digest emails skip) or use a
  key that only mails yourself.
- **Chrome extension:** the store build points at production; load an
  unpacked build with the API base set to `test.layrrrd.com` for QA.
