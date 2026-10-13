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
4. When QA passes, open a PR from the **feature branch** (not `test`) to
   `main` and merge it. Only that merge touches production. `test` can hold
   other people's unreleased work, so merging `test` itself would ship that
   too.
5. Sync QA with production by merging `main` into `test` and pushing
   (a plain `git push origin main:test` is rejected whenever `test` holds
   work that isn't on `main` yet).

Env vars are scoped per environment in Vercel (Project → Settings →
Environment Variables): Production values point at `layrrrd-18b1e` + live
keys, Preview values point at `layrrrd-test` + test keys. A preview
deployment holds no production credentials, which is what makes prod data
physically unreachable from QA.

## Day-to-day commands

```bash
# 1. Start a change
git checkout main && git pull
git checkout -b feat/<name>

# 2. Develop (two terminals)
npm run emulators        # Firestore + Auth on your machine, UI at localhost:4000
npm run dev              # app at localhost:3000
npm run check            # lint + typecheck + build before pushing
git add <files> && git commit -m "..."
git push -u origin feat/<name>

# 3. QA on test.layrrrd.com
git checkout test && git pull
git merge feat/<name>
git push origin test     # Vercel deploys test.layrrrd.com in ~1-2 min
git checkout feat/<name>

# 4. Go live (after QA passes)
gh pr create --base main --head feat/<name>
gh pr merge --merge      # Vercel deploys layrrrd.com
git checkout test && git pull && git merge origin/main && git push   # sync QA
git checkout main && git pull
```

## Local dev

Two options:

- **Emulators (preferred, zero-risk, offline):** run `npm run emulators` in
  one terminal, `npm run dev` in another, with the three emulator vars set in
  `.env.local` (see `.env.example`). Needs Java 21+ (`brew install openjdk@21`);
  the script fetches a pinned `firebase-tools` via `npx`, so no global
  install is needed. Use the `demo-layrrrd` project id and any API key for
  the `NEXT_PUBLIC_FIREBASE_*` / `FIREBASE_PROJECT_ID` vars. Emulator data
  is wiped when the emulators stop. Firestore + Auth run entirely on your
  machine and enforce `firestore.rules`. Emulator UI: `localhost:4000`.
- **Shared test project:** leave the emulator vars unset and fill
  `.env.local` with the `layrrrd-test` web + admin credentials.

Never put `layrrrd-18b1e` (production) credentials in `.env.local`. Keep
them in the gitignored `.env.prod.local`, used only by `npm run backup` and
by admin scripts you deliberately run against prod
(`node --env-file=.env.prod.local scripts/...`, backup first).

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
npm run backup   # reads .env.prod.local; exports all collections + auth users to backups/ (gitignored)
```

## Per-service notes

- **Crons:** `vercel.json` crons run on Production only. To QA the digest,
  call `/api/cron/weekly-digest` on `test.layrrrd.com` with the Preview
  `CRON_SECRET`.
- **Telegram:** one bot = one webhook URL, so test uses a separate bot
  (create via @BotFather) whose webhook points at
  `test.layrrrd.com/api/telegram/webhook`.
- **WhatsApp:** a separate Meta app using Meta's free test number, webhook
  pointed at `test.layrrrd.com/api/whatsapp/webhook`. Only the (max 5)
  recipient numbers verified in that app can talk to it. Step-by-step:
  [rudolf-whatsapp-integration.md](rudolf-whatsapp-integration.md#setup-walkthrough).
- **Razorpay:** test-mode keys + a test-mode webhook registered to
  `test.layrrrd.com/api/payments/webhook`. Pay with Razorpay test cards.
- **Resend:** leave the key unset in Preview (digest emails skip) or use a
  key that only mails yourself.
- **Chrome extension:** the store build points at production; load an
  unpacked build with the API base set to `test.layrrrd.com` for QA.
