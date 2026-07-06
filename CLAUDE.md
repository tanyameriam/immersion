# Immersion — Design System

This project's design system is shadcn/ui, scaffolded via:

```
npx shadcn@latest init --preset b3SkLI2EK --template next
```

- Style: `base-sera` (see `components.json`)
- Base color: `neutral`, CSS variables enabled, icon library: `lucide`
- Component primitives: `@base-ui/react` (not Radix)
- Utility: `cn()` in `lib/utils.ts` (clsx + tailwind-merge)
- Theme tokens live in `app/globals.css` under `:root`, `.dark`, and `@theme inline`

## Rule

All UI in this project must be built with this design system:

- Add new components with `npx shadcn@latest add <component>` rather than hand-rolling
  markup or pulling in a different component/styling library.
- Any design that is uploaded, pasted, or generated (e.g. from Figma, screenshots, or
  other tools) must be adapted to use these existing components and theme tokens
  instead of introducing new ad hoc styles, colors, or component libraries.
- Theme changes (colors, radius, fonts) should be made by editing the tokens in
  `app/globals.css`, not by overriding styles inline per-component.
