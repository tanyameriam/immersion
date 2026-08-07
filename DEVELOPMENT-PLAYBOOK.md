# Layrrrd Development Playbook

**The rulebook for how we build, test, and release.** Written for a team of
designers shipping code through AI tools. These are not suggestions — words
like **MUST** and **NEVER** are load-bearing. When a rule feels annoying,
remember it exists because some company lost its users' data or its weekend
learning it.

The companion doc is [OPERATING-PLAN.md](OPERATING-PLAN.md) (what we build and
who owns it). This one is *how* we build anything at all.

---

## 1. The three environments (the biggest gap we have today)

Professional teams never let development work touch real user data. We
currently have ONE Firebase project, which means a coding mistake during
development can corrupt or delete real users' libraries. Fix this first.

| Environment | What it is | Data | Who touches it |
| --- | --- | --- | --- |
| **Local** | The app running on your own computer (`npm run dev`) | Dev Firebase project, fake data | Whoever is building |
| **Preview** | Vercel's automatic per-change link | Dev Firebase project, fake data | Team, for review/QA |
| **Production** | layrrrd.com | Prod Firebase project, real users | Users only |

**Setup task (one-time, ~half a day with AI help):**

1. Create a second Firebase project: `layrrrd-dev`. Enable Auth + Firestore,
   deploy the same rules and indexes to it.
2. Local `.env.local` and Vercel *Preview* environment variables point at
   `layrrrd-dev`. Vercel *Production* variables point at the real project.
3. Same split for every other key: Razorpay **test mode** keys, a separate
   Telegram test bot, a dev Anthropic key with a low spend cap, Resend in
   test mode. Production keys exist ONLY in Vercel's Production environment.
4. Seed `layrrrd-dev` with fake users and items (`scripts/` already has
   seeding patterns) so previews look real.

**Hard rules:**

- **NEVER** put production keys in `.env.local`, in the repo, in a chat
  message, or in a prompt to an AI tool.
- **NEVER** run any script against production unless the release checklist
  (§6) says so, and `scripts/reset-data.mjs` MUST refuse to run against the
  production project ID at the code level.
- Anyone may break the dev environment without apologizing. That is what it
  is for.

---

## 2. How every change flows (no exceptions)

```
idea → branch → small change → CI green → preview link → human QA → merge → production
```

1. **Every change starts on a branch, never on `main`.** `main` deploys to
   production automatically, so `main` IS production.
2. **One change per branch.** "Add the streak counter" is one change. "Add
   streaks and fix onboarding and tweak pricing copy" is three branches.
   Small changes can be reviewed; big ones just get skimmed and trusted —
   and trust is how bugs ship.
3. **Open a Pull Request (PR) for everything**, even one-line changes. The PR
   is where CI runs, the preview link appears, and the review happens.
4. **Turn on branch protection for `main`** (GitHub setting, 5 minutes):
   require a PR, require CI to pass, forbid direct pushes and force-pushes.
   This makes the rule physically unbreakable, which is the point — rules
   that rely on remembering are not rules.
5. **A human clicks the preview before merge. Always.** CI proves the code
   compiles; only a person can see that the button is in the wrong place or
   the summary reads like nonsense.

---

## 3. Testing: the four layers

### Layer 1 — Machine checks (already exist, keep green)

`npm run check` (lint + typecheck + build) runs in CI on every PR. A red CI
is a stop sign, never something to merge past. If CI is red on `main`,
fixing it outranks all feature work.

### Layer 2 — Automated tests (missing today; build up in this order)

We add a real test suite (Vitest — the AI knows how) and CI runs it on every
PR. Priority order, because test-writing time is limited:

1. **Money paths first:** payment order creation, signature verification,
   webhook handling, founding-spot counting, biscuit crediting, playtime
   metering. A pricing bug or a double-charge is the most expensive bug we
   can ship.
2. **Auth and account paths:** token verification, account deletion actually
   deletes everything it promises.
3. **The save pipeline** with the AI call faked ("mocked"): URL in →
   summary fields out, degraded-page fallback, retry behavior.
4. **Digest builder:** right users selected on the right day, correct items
   grouped.

**The ratchet rule:** every bug that reaches production gets a test that
would have caught it, written as part of the fix. This is how the suite
grows exactly where it earns its keep. No test, no fix merged.

**The AI rule:** when asking the AI to build a feature, the request includes
"and write tests for it." AI-written code with AI-written tests reviewed by
a human is a genuinely solid loop; AI code with no tests reviewed by a
non-programmer is a time bomb.

### Layer 3 — Golden-path smoke test (add once streaks ship)

One automated browser test (Playwright) that does what a real user does:
sign up → save a link → see the summary appear → check the dashboard.
Runs against every preview. It exists to answer one question after any
change: "is the product fundamentally alive?"

### Layer 4 — Human QA (the checklist, forever)

`TESTING.md` stays our manual script. It runs:

- On the preview link, before merging anything non-trivial.
- On production, every Friday ship review (§4 of the operating plan).
- **By a second person** (not the one who made the change) for anything
  touching payments, sign-in, deletion, or the digest. Four eyes on money
  paths is non-negotiable.

Keep a one-page "10-minute smoke checklist" version pinned in the team chat:
sign in, save a link, summary appears, open digest email, Rudolf replies,
buy flow reaches the payment screen (test mode).

---

## 4. Database changes: the ones you can't undo

Code can be rolled back in one click. **Data cannot.** A bad deploy is an
incident; corrupted user data is a catastrophe. So:

- Any change to what we store (new fields, renamed fields, moved
  collections) is flagged in the PR title as `[data]` and gets the strict
  treatment: tried on dev first, backward-compatible (old app version must
  still work against the new data during rollout), and never deletes or
  rewrites existing fields in the same release that adds new ones.
- Backfill scripts (updating thousands of existing documents) run on dev
  first, then on production only during a release window with a fresh
  backup confirmed.
- Firestore **daily backups MUST be on** (operating plan 0.1), and once a
  quarter we do a **restore drill**: actually restore a backup into the dev
  project and open it. An untested backup is a rumor, not a backup.

---

## 5. Release plan

### Cadence

- **Merge to production on Tuesdays and Thursdays**, before 3pm. Small,
  boring, frequent releases beat big scary ones.
- **NEVER release Friday afternoon, weekends, or the night before a
  holiday.** Nothing ships when nobody will be awake to notice it broke.
- Hotfixes (production is broken) are exempt from cadence but not from the
  flow — even a hotfix gets a branch, CI, and a second pair of eyes.

### The release checklist (copy into every release PR)

- [ ] CI green (lint, types, build, tests)
- [ ] Preview link clicked through by a human
- [ ] Money/auth/deletion touched? → second person QA'd the preview
- [ ] `[data]` change? → ran on dev, backup confirmed, backward-compatible
- [ ] Sentry open in a tab, dashboard open in a tab
- [ ] Someone is "watching the release" for the next 2 hours (see below)

### After every release

The person who merged **watches for 2 hours**: Sentry for new errors, the
PostHog dashboard for a sudden drop in saves/opens, the team chat for user
reports. Most bad releases announce themselves in the first 30 minutes —
if someone is looking.

### Rollback: our safety ripcord

Vercel keeps every previous deployment; **"Instant Rollback" restores the
last good version in under a minute.** Two rules:

1. When production misbehaves: **roll back first, diagnose later.** Users
   don't care why it broke; they care that it works again.
2. **Practice the rollback once, this month, on purpose.** Deploy a trivial
   change, roll it back, watch it take 60 seconds. The first time you use
   the ripcord must not be during a real emergency.

### Feature flags for anything scary

Big features (streaks, Pro plan, community feed) launch **dark**: the code
merges switched off, then gets switched on for the team's own accounts first,
then for everyone. A simple on/off flag (env var or a per-user field) is
enough — the AI can add one in minutes. This turns "launch day terror" into
"flip a switch, watch the dashboard, flip it back if needed."

### The Chrome extension is special

The web app can roll back in one minute; the extension **cannot** — Chrome
Web Store review takes days, and users update on Chrome's schedule, not
ours. Therefore:

- Keep the extension as thin as possible (it mostly just calls our API —
  good, keep it that way).
- **Never break the API the currently-shipped extension depends on.** Old
  extension versions will be alive in browsers for months; the server must
  keep serving them.
- Test every extension release manually as an unpacked extension before
  submitting to the store.

---

## 6. Production access rules

- Production Firebase console, Vercel production settings, Razorpay live
  dashboard, and the domain registrar are **CEO-access-only** (plus one
  named backup person — bus factor). Everyone else works in dev.
- **Every account with production access has 2-factor authentication on.**
  Google, GitHub, Vercel, Firebase, Razorpay, Resend, domain registrar —
  all of them. One phished password must not be enough to destroy the
  company. Do this audit this week; it costs an hour.
- Secrets live in exactly two places: Vercel environment settings and a
  team password manager (1Password/Bitwarden). Never in docs, chats, or
  screenshots. If a key ever leaks (pasted somewhere public, in a screen
  recording), it gets **rotated the same day** — every provider makes this
  a 5-minute operation.
- GitHub: private repo, and check the collaborator list quarterly — remove
  anyone who no longer needs access.

---

## 7. When production breaks: the incident playbook

Pin this in the team chat.

1. **Say it out loud:** post "INCIDENT: <what you see>" in the team chat.
   No blame, ever — a blamed team hides problems, and hidden problems grow.
2. **Stop the bleeding:** roll back the last deploy (§5). If it's not the
   deploy, turn the feature flag off. If it's a runaway AI bill, revoke the
   API key.
3. **Tell users if they're affected** — one honest sentence on the site or
   from Rudolf beats silence. People forgive outages; they don't forgive
   feeling ignored.
4. **Afterwards, write five sentences** in the incident log (a simple doc):
   what happened, what users saw, how we fixed it, what test/alarm/rule now
   prevents a repeat. Add that test (§3 ratchet rule). Move on.

---

## 8. Rules for AI-driven development (our version of code review)

The AI is the engineering team; these rules are its management:

1. **One focused request at a time.** Review each diff before asking for the
   next thing. Never "fix everything you find."
2. **Read the AI's summary of every change and the diff itself.** You don't
   need to understand every line — you need to check *scope*: did it touch
   only the files the task needed? An AI that was asked for a copy change
   but edited the payment route gets its change rejected.
3. **The AI runs `npm run check` and the tests before claiming done** —
   make it show the output, don't accept "it should work."
4. **Never paste production secrets or real user data into a prompt.** Use
   the dev environment's fake data for everything.
5. **AGENTS.md is the AI's permanent rulebook** — when we adopt a new
   convention (like "always write tests"), it goes in that file so every
   future session obeys it automatically, not just the sessions where
   someone remembers.
6. **Keep the decision log honest** (`project-notebook.ipynb`, PRD, and
   architecture doc are already good) — an AI is only as good as the
   context it's given, and these docs *are* that context.

---

## 9. Definition of done (for anything, ever)

A task is done when ALL of these are true — not when the code exists:

- [ ] CI green, tests included for new behavior
- [ ] A human used it on the preview link and it felt right
- [ ] It works on a phone screen, not just a laptop
- [ ] Money/auth/data paths: second person verified
- [ ] Analytics event added if we'll ever ask "is anyone using this?"
- [ ] Docs updated if behavior changed (PRD gap list, architecture doc)
- [ ] Merged, released per §5, and watched for 2 hours

"Done" is a high bar on purpose. Half-done features are the most expensive
inventory a small team can hold.

---

## 10. Setup order (do these in sequence)

| # | Task | Effort | Unblocks |
| --- | --- | --- | --- |
| 1 | Branch protection on `main` | 5 min | Everything below |
| 2 | 2FA audit on all accounts | 1 hour | §6 |
| 3 | Firestore backups on + reset-script guard | 1 hour | §4 |
| 4 | `layrrrd-dev` Firebase project + split env keys | Half a day | §1 |
| 5 | Sentry + uptime monitoring | Half a day | §5, §7 |
| 6 | Vitest wired into CI + first money-path tests | 1–2 days (AI does the writing) | §3 |
| 7 | Rollback practice run | 30 min | §5 |
| 8 | Smoke-test checklist pinned in team chat | 30 min | §3 |
| 9 | Playwright golden-path test | 1 day | §3 (after streaks ship) |
| 10 | First restore drill | 1 hour | §4 (this quarter) |

Items 1–3 happen **this week** alongside operating-plan Phase 0. Items 4–8
before any Phase 1 feature merges. Nothing about this list is optional; it
is the difference between a product and a liability.
