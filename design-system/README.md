# Design System

Immersion's UI is built on **shadcn/ui** on top of **Tailwind CSS v4**. This is the
single design system for the project — new UI should be built with it rather than
introducing separate styling approaches (see the enforcement rule in
[AGENTS.md](../AGENTS.md)).

## Stack

| Piece                | Choice                                            |
| --------------------- | ------------------------------------------------- |
| CSS framework          | Tailwind CSS v4                                  |
| Component system       | [shadcn/ui](https://ui.shadcn.com/), style `base-sera` |
| Component primitives   | `@base-ui/react` (this preset's choice, not Radix) |
| Icon library            | `lucide-react`                                  |
| Class merging           | `cn()` in [lib/utils.ts](../lib/utils.ts) (clsx + tailwind-merge) |
| Font                    | `Inter Tight` (loaded in [app/layout.tsx](../app/layout.tsx)) |
| Motion                  | `framer-motion`, via the [FadeUp](../components/FadeUp.tsx) primitive and the waitlist modal |

Brand: **Layrrrd.** — an editorial, high-contrast landing page with a warm
off-white background, no rounded corners (`--radius: 0`), and hairline rules
instead of cards/shadows for section dividers.

Configuration lives in [components.json](../components.json).

## Setup

The system was scaffolded with a shared preset so every environment gets the same
config:

```bash
npx shadcn@latest init --preset b3SkLI2EK --template next
```

Re-running `init` is not needed day-to-day — this is only relevant if the project is
ever re-scaffolded from scratch.

## Adding components

Never hand-write component markup/styling from scratch. Pull components from the
shadcn registry as needed:

```bash
npx shadcn@latest add <component>
# e.g.
npx shadcn@latest add dialog
npx shadcn@latest add input
```

This drops source files into `components/ui/`, which you then import and use
directly — there's no black-box package to configure.

### Installed so far

- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx` — powers the waitlist modal
- `components/ui/input.tsx` — powers the waitlist email field
- `components/ui/sheet.tsx` — powers the mobile nav menu

## Theme tokens

All colors, radius, and font variables are defined as CSS custom properties in
[app/globals.css](../app/globals.css) under `:root`. Layrrrd is a light-only
editorial site — there is no dark mode toggle, so no `.dark` block exists.
Use the semantic token, not a hardcoded value:

| Token                    | Use for                                  |
| ------------------------ | ----------------------------------------- |
| `--background` / `--foreground` | Page background / default text     |
| `--card` / `--card-foreground`  | Card surfaces                       |
| `--primary` / `--primary-foreground` | Primary actions, emphasis text |
| `--secondary` / `--secondary-foreground` | Secondary actions          |
| `--muted` / `--muted-foreground` | De-emphasized backgrounds/text     |
| `--accent` / `--accent-foreground` | Hover/highlight states            |
| `--destructive`          | Errors, destructive actions               |
| `--border` / `--input` / `--ring` | Borders, form inputs, focus rings |
| `--radius`               | Base corner radius (`--radius-sm` … `--radius-4xl` derive from it) |

In JSX/CSS, reference these via Tailwind utilities (`bg-card`, `text-muted-foreground`,
`rounded-lg`) rather than `var(--token)` directly, except in plain CSS files like
`globals.css` itself.

### Changing the theme

Edit the variables in [app/globals.css](../app/globals.css) — don't override colors inline per-component.

## Brand layer (opt-in, not the default)

Layrrrd has its own brand typography and color palette for the **user-facing
marketing site**, separate from the design-system tokens above. These are
never applied automatically — use the design-system tokens/components by
default everywhere, and only reach for a brand utility when a specific
element is explicitly called out to use it.

**Fonts** (loaded via `next/font/local` in [fonts.ts](fonts.ts), CSS
vars wired in [app/globals.css](../app/globals.css)):

| Utility        | Font       | Notes |
| -------------- | ---------- | ----- |
| `font-satoshi` | Satoshi    | Full weight range 300–900 + italics, `design-system/fonts/satoshi/` |
| `font-sardin`  | Sardin     | Display weight only. **Bundled file is a DEMO cut, personal-use license only** — needs a commercial license from PandekaStudio before use on the live paid site. See `design-system/brand-source/Sardin/Readme (DEMO).txt`. |

All design-system/brand assets now live in this folder:

```
design-system/
  README.md        — this file
  fonts.ts          — next/font/local loaders (satoshi, sardin)
  fonts/            — font binaries actually used by the app
    satoshi/*.otf
    sardin/*.otf
  brand-source/     — raw purchased/demo font files, gitignored
```

**Colors** (`--brand-*` vars in `:root`, mapped to `--color-brand-*` in
`@theme inline`):

| Utility (e.g. `bg-`, `text-`, `border-`) | Hex | Note |
| ------------------------------------------ | ------- | ---- |
| `brand-ink`   | `#212121` | near-black |
| `brand-cream` | `#FFF6E5` | warm off-white |
| `brand-pink`  | `#FF859A` | accent |

These do not replace `--foreground`/`--background`/etc. — both systems
coexist, and default UI stays on the shadcn/ui tokens unless told otherwise.

## Using external/uploaded designs

If a design comes from Figma, a screenshot, or another tool, adapt it to these
existing components and tokens rather than introducing new component libraries or
one-off styles. Add any missing primitive via `shadcn add` first, then compose the
design from it.

## Reference

- Progress/decisions are logged in `project-notebook.ipynb`, section 6.
- Enforcement rule for any AI coding tool: [AGENTS.md](../AGENTS.md).
- shadcn/ui docs: https://ui.shadcn.com/
- Tailwind CSS docs: https://tailwindcss.com/docs
