# Agent Guidelines - Immersion (Layrrrd.)

This file is the single source of truth for any AI coding tool working in this
repo - Claude Code, Codex, Cursor, or otherwise. Tool-specific files (e.g.
`CLAUDE.md`) point back here rather than repeating these rules, so read this
file first regardless of which tool you are.

## Project snapshot

- **Product:** Layrrrd. - an editorial landing page (Next.js App Router)
  with auth-based sign-up, plus legal pages and the app API routes.
- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4,
  shadcn/ui, framer-motion.
- Full stack/layout/motion details: [design-system/README.md](design-system/README.md).
- Progress/decision log: `project-notebook.ipynb`.

## Design system - mandatory default

All UI in this project must be built with **shadcn/ui** on Tailwind v4. Full
reference: [design-system/README.md](design-system/README.md).

- Add new primitives with `npx shadcn@latest add <component>` rather than
  hand-rolling markup, or introducing a different component/styling library.
- Any design that's uploaded, pasted, or generated (Figma, screenshots, other
  tools) must be adapted to the existing components and theme tokens instead
  of introducing new ad hoc styles, colors, or component libraries.
- Theme changes (colors, radius, fonts) go in the tokens in
  `app/globals.css`, not inline overrides per-component.
- This is a light-only site - there is no dark mode toggle. Don't add a
  `.dark` token block back in unless a real theme switcher is built.

## Brand kit - opt-in only, never the default

Layrrrd has its own brand typography (`font-satoshi`, `font-sardin`) and
color palette (`brand-ink`, `brand-cream`, `brand-pink`) for the user-facing
marketing site. Full reference: [design-system/README.md](design-system/README.md#brand-layer-opt-in-not-the-default).

- **Never apply these by default.** Use the design-system tokens/components
  above for everything unless a specific element is explicitly named to use
  a brand utility.
- **Licensing constraint:** the bundled `Sardin` font file is a personal-use
  demo cut, not licensed for this commercial product. Do not ship it on any
  publicly deployed page without confirming a commercial license has been
  purchased (see `design-system/brand-source/Sardin/Readme (DEMO).txt`).

## Working conventions

- **Before starting non-trivial work**, create a git branch rather than
  committing to `main` directly.
- **Never commit or push unless explicitly asked.** Creating a branch is not
  the same as authorization to commit - confirm before either.
- Never force-push, rewrite history, or skip git hooks unless explicitly
  asked.
- Prefer editing existing files/components over introducing new patterns;
  match the editorial layout conventions in `design-system/README.md`
  (hairline `border-t` section dividers, `max-w-[1280px]`,
  `py-[120px] md:py-[160px]`, no border-radius).

## Verification before calling anything done

Run before considering a change complete:

```bash
npm run check   # lint + typecheck + build
```

For UI changes, also start the dev server (`npm run dev`) and check the
actual page in a browser (or via the running tool's browser access) - a
passing build does not confirm the feature looks or behaves correctly.

## Environment & secrets

- Copy `.env.example` → `.env.local` for local secrets; never commit
  `.env.local`.

## Reference map

| File | Purpose |
| --- | --- |
| `AGENTS.md` | This file - canonical guidelines for any AI coding tool. |
| `CLAUDE.md` | Claude Code entry point; points back here. |
| `design-system/README.md` | Full design-system + brand-kit reference. |
| `design-system/fonts.ts` | Brand font loading (`next/font/local`). |
| `design-system/fonts/` | Brand font binaries (Satoshi, Sardin). |
| `design-system/brand-source/` | Raw purchased/demo font files (gitignored). |
| `README.md` | Human-facing setup/deploy instructions. |
| `project-notebook.ipynb` | Running decision/progress log. |
