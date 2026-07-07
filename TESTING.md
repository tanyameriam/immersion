# Running & testing Layrrrd — the full journey

This walks you from zero to a working app you can click through. Everything
here is free. Budget ~30–40 minutes the first time (most of it is creating a
Firebase project).

---

## Part 1 — Create the accounts & keys (one-time)

### A. Firebase (auth + database) — free "Spark" plan

1. Go to <https://console.firebase.google.com> → **Add project** → name it
   `layrrrd` → accept defaults → **Create project**.
2. **Authentication** → **Get started** → **Sign-in method** →
   **Google** → toggle **Enable** → **Save**.
3. **Firestore Database** → **Create database** → **Start in production mode**
   → choose a region near you → **Enable**.
4. Get the **web config**: click the ⚙️ gear → **Project settings** →
   scroll to **Your apps** → click the **Web** icon `</>` → register app
   "Layrrrd web" → copy the 6 values shown (`apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
5. Get the **server key**: **Project settings** → **Service accounts** →
   **Generate new private key** → a `.json` file downloads. You'll need three
   values from inside it: `project_id`, `client_email`, `private_key`.

### B. Anthropic (the AI) — pay-as-you-go, pennies

1. Go to <https://console.anthropic.com> → **API keys** → **Create key** →
   copy it.
2. **Billing** → add ~$5 credit (covers hundreds of articles).

### C. (Optional, can skip for first test)

- **Telegram**: message **@BotFather** on Telegram → `/newbot` → copy the token.
- **Resend** (email): <https://resend.com> → API key; sending to real inboxes
  needs `layrrrd.com` verified in Resend.

---

## Part 2 — Configure the app

1. In the project folder, copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in:
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`  ← for local testing
   - the six `NEXT_PUBLIC_FIREBASE_*` values from step **A4**
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
     from the service-account JSON (step **A5**). For the private key, paste
     the whole thing in quotes, keeping the `\n` pieces exactly as they are:
     `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`
   - `ANTHROPIC_API_KEY` from step **B**
   - `CRON_SECRET=` any long random string (e.g. mash the keyboard)
   - Telegram/Resend values only if you set them up.
3. Publish the database rules & indexes (so the app can read/write and the
   digest query works). Easiest way:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (If you skip this, the app still runs, but you may see "permission denied"
   or "index needed" errors — the error message includes a one-click link to
   create the index.)

---

## Part 3 — Run it

```bash
npm install      # first time only
npm run dev
```

Open <http://localhost:3000>.

---

## Part 4 — The test journey (what to click, what to expect)

| # | You do | You should see | It proves |
|---|--------|----------------|-----------|
| 1 | Open `/` | The Layrrrd marketing homepage | The site builds & renders |
| 2 | Click **Sign In** → **Continue with Google** → pick your account | Redirected to `/dashboard` | Real Firebase Google auth works |
| 3 | (verify) Firebase Console → Firestore → `users` | A document with your account appears (name, email, lastLogin) | Profile is created on sign-in |
| 4 | On the dashboard, paste a real article URL in **"Paste a link to save…"** → **Save** | The card appears instantly saying **"Summarizing with AI…"** | Save API + instant-pending works |
| 5 | Wait ~5–10 seconds | The card fills in: real **title, one-line summary, topics, "X min read"** | The whole AI pipeline works (fetch → read → Claude → save → live update) |
| 6 | (verify) Firestore → `knowledgeItems` | The doc's `status` is `completed` and an `ai` object is filled in | Data is really stored |
| 7 | Save the **same URL again** | No duplicate is created | Dedupe works |
| 8 | Select a card → **Remove Bookmarks** (or the card's menu) | It disappears; it's also gone from Firestore | Delete persists |
| 9 | Use the **search box / filters / sort** on the Bookmarks tab | They filter your real items | Dashboard is wired to real data |

### Optional: weekly digest (needs Telegram and/or Resend configured)
Trigger it by hand instead of waiting for the weekly schedule:
```bash
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/weekly-digest
```
Expect a JSON reply like `{"users":1,"emailed":1,"messaged":0}` and, if email
is configured, a digest in your inbox.

### Optional: the Chrome extension (one-click save from any page)
1. Edit `extension/config.js`: set `FIREBASE_API_KEY` (same as the web app) and
   `APP_URL=http://localhost:3000`.
2. Follow `extension/README.md` to load it and create the Google "Chrome
   Extension" OAuth client.
3. Click the Layrrrd toolbar button on any page → **Save this page** →
   "Saved!" → it appears on your dashboard.

---

## Known limitations (working as intended for now)
- **Recommended** and **Weekly Issues** tabs show sample/demo content — real
  cross-user recommendations need a community of users.
- **Telegram DM delivery** needs a numeric chat id (not an @username); the
  profile field stores what you enter but Telegram DMs require the user to
  start a chat with the bot first.

---

## Stress-testing checklist (before onboarding real users)

Try to break it — these cover every feature and its edge cases:

**Saving & AI**
- [ ] Save 10–20 links quickly in a row → all appear as "Summarizing…" then complete; the page stays responsive.
- [ ] Save a **paywalled / login-only** article (e.g. an NYT or Medium member post) → it should still complete "degraded" (title + short summary), never get stuck.
- [ ] Save a **dead / 404 URL** → it should mark failed gracefully, not hang the app.
- [ ] Save a **YouTube / Twitter / LinkedIn** link → completes with whatever it can read.
- [ ] Save the **same URL twice** → no duplicate.
- [ ] Save a non-URL / gibberish in the box → friendly "not a valid URL" message.

**Accounts & isolation**
- [ ] Sign in with **two different Google accounts** (e.g. two browsers) → each sees **only their own** saved items. Account A must never see Account B's data.
- [ ] Sign out and back in → your items are still there.

**Dashboard**
- [ ] Search, every filter, every sort option, and grid/list toggle all work over real items.
- [ ] Select several → bulk **Remove** → they're gone (and gone from Firestore).
- [ ] **View summary** on a completed item shows full summary/keywords; on a still-processing item shows "still reading."

**Profile**
- [ ] Change your name / interests / delivery method → **Save** → reload the page → the changes persisted.

**Digest & extension**
- [ ] Trigger the weekly digest manually (see the optional section above) → returns a JSON count without error.
- [ ] (After extension setup) Save a page from the toolbar → it appears on the dashboard.

## Reset to a clean slate (wipe all test data)

When testing is done, wipe every saved item, profile, digest, and sign-in
account in one command (runs locally with your service key — not exposed on the
live site):

```bash
# Preview what would be deleted (safe):
node --env-file=.env.local scripts/reset-data.mjs

# Actually wipe everything:
node --env-file=.env.local scripts/reset-data.mjs --confirm
```

Your deployed app and configuration stay intact — only the data is cleared, so
you start real onboarding from zero.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Google popup says "unauthorized domain" | Firebase → Authentication → Settings → Authorized domains → make sure `localhost` (and `app.layrrrd.com` in prod) are listed |
| Card stays on "Summarizing…" forever | Check `ANTHROPIC_API_KEY` is set and has credit; look at the `npm run dev` terminal for errors |
| "permission denied" in the terminal | Deploy the Firestore rules (Part 2, step 3) |
| "The query requires an index" with a URL | Click the URL to auto-create the index, or run the deploy in Part 2 step 3 |
| Save button does nothing / 401 | Make sure you're signed in (step 2) |
