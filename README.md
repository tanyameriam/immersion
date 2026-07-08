# Immersion - Content Curation App

A Next.js (TypeScript) app deployed on Vercel. Every push to GitHub is automatically
checked so that broken code never reaches production.

> Tip: to see the checks run on a Pull Request, make a change on a branch, commit it,
> push the branch, then open a PR against `main`.

---

## The short version

1. You write code (with Claude Code or by hand).
2. You push to GitHub.
3. **GitHub runs automated checks** (lint, type-check, build). ✅ or ❌
4. If green, **Vercel deploys it automatically** and gives you a live URL.

If the checks pass on GitHub, the Vercel deploy will succeed - because GitHub runs the
exact same build Vercel does.

---

## What the checks do

On every push and pull request, GitHub Actions runs three checks (see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

| Check          | What it catches                                              |
| -------------- | ----------------------------------------------------------- |
| **Lint**       | Common mistakes and code-style problems.                    |
| **Type-check** | Type errors that would otherwise crash the build.           |
| **Build**      | Anything that would make the Vercel deploy fail.            |

You can run all three yourself at any time with:

```bash
npm run check
```

---

## Running it on your computer

You need [Node.js 22](https://nodejs.org) installed (the version is pinned in
[`.nvmrc`](.nvmrc)).

```bash
npm install        # install dependencies (first time only)
npm run dev        # start the app at http://localhost:3000
```

To confirm everything is healthy before pushing:

```bash
npm run check      # lint + type-check + build, all in one
```

---

## First-time setup (one-time, done in web dashboards)

These two steps are done by clicking in the GitHub and Vercel websites - they can't be
done from the command line.

### 1. Connect Vercel (enables auto-deploy)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New… → Project**.
3. Import the **`immersion`** repository.
4. Leave all settings as-is (Vercel auto-detects Next.js) and click **Deploy**.

Done. From now on every push to `main` deploys automatically, and every pull request
gets its own preview URL.

### 2. Require checks before merging (recommended)

This stops broken code from ever reaching `main`.

1. On GitHub, open the repo → **Settings → Branches**.
2. Click **Add branch ruleset** (or "Add branch protection rule").
3. Target branch: **`main`**.
4. Enable **Require status checks to pass before merging**.
5. Select the **`Lint, type-check & build`** check.
6. Save.

---

## Project layout

```
app/                 # Your pages and UI live here
  layout.tsx         # App shell (wraps every page)
  page.tsx           # The home page
  globals.css        # Global styles
.github/workflows/   # The automated checks (CI)
.env.example         # Template for secrets/API keys (copy to .env.local)
.nvmrc               # Pins the Node.js version
```

## Environment variables / secrets

- Copy `.env.example` to `.env.local` and put real values there. `.env.local` is
  gitignored and is never committed.
- For production, add the same variables in Vercel: **Project → Settings →
  Environment Variables**.
