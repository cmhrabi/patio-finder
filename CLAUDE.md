@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first
The `@AGENTS.md` import above is load-bearing: this project uses **Next.js 16.2.4 + React 19.2.4**, which post-date most training data. Before writing Next.js, React, or Tailwind code, consult `node_modules/next/dist/docs/` (split into `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`). Do not assume APIs from earlier versions still exist.

Other version notes that bite:
- **Tailwind v4** — `src/app/globals.css` uses `@import "tailwindcss";` and `@theme inline { ... }`. There is no `tailwind.config.{js,ts}`; theme tokens live in CSS. PostCSS plugin is `@tailwindcss/postcss`.
- **ESLint v9 flat config** — `eslint.config.mjs` uses `defineConfig` from `eslint/config` and composes `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`. No `.eslintrc`.
- **React 19** — server components by default; client components must declare `'use client'` (see `src/components/PatioMap.tsx`).

## Commands
- `npm run dev` — Next.js dev server on http://localhost:3000
- `npm run build` / `npm run start` — Next.js prod build / serve
- `npm run lint` — ESLint (flat config)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` / `npm run test:watch` — Vitest (jsdom + RTL + axe)
- `npm run storybook` — Storybook dev on http://localhost:6006
- `npm run build-storybook` — static Storybook build
- `npm run tokens:gen` — regenerate `src/tokens/tokens.{css,ts}` from `tokens.json`

## Environment
Mapbox is required at runtime. Copy `.env.local.example` → `.env.local` and set:

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

The `NEXT_PUBLIC_` prefix exposes it to the browser bundle (the map renders client-side). `PatioMap.tsx` renders a fallback message when the token is missing instead of crashing.

## Architecture

App Router app with an in-tree design system:

**App shell**
- `src/app/layout.tsx` — root layout. Sets `data-theme="cream"` on `<html>`, imports both `globals.css` (Tailwind) and `@/tokens/tokens.css` (design-system CSS variables).
- `src/app/page.tsx` — server component; renders `<PatioMap />` inside a full-viewport `<main>`.
- `src/components/PatioMap.tsx` — **client component** (`'use client'`). Mapbox GL via `react-map-gl/mapbox`. Initial view hard-coded to Toronto.

**Design system (the SunChaser kit)**
- `tokens.json` (repo root) — single source of truth for colour, spacing, radius, shadow, fonts, type ramp, theme variants, and card-style modifiers.
- `scripts/generate-tokens.ts` — emits `src/tokens/tokens.css` (CSS variables + `[data-theme]` + `[data-card-style]` + `.type-*` utility classes) and `src/tokens/tokens.ts` (typed constants + `cssVar()` helper). Re-run with `npm run tokens:gen` whenever `tokens.json` changes.
- `src/theme/` — `ThemeProvider` (sets `data-theme` and `data-card-style` on `<html>`) and `useTheme` hook.
- `src/hooks/` — `useFavourites` (localStorage-backed Set), `usePrefersReducedMotion`.
- `src/components/{Button,Card,Pill,Logo,SunRating,Star,GoogleStars,Sparkline,Toggle,TextField,Modal,Eyebrow,Heading}` — primitives, each in its own folder with `.tsx`, `.module.css`, `.stories.tsx`, `.test.tsx`, `index.ts`. Stateful primitives (Toggle, Modal, Star, TextField, GoogleStars, Sparkline) declare `'use client'`; pure-render ones (Heading, Eyebrow, Pill, Logo, Card, SunRating, Button, layout helpers) are server-component-safe.
- `src/components/layout/` — `Stack`, `Cluster`, `Grid` token-driven layout helpers.
- `src/index.ts` — public re-exports for downstream consumption.

**Storybook**
- `.storybook/main.ts` — `@storybook/react-vite` framework. Storybook does NOT go through Next; it has its own Vite pipeline (`vite.config.ts`). The Next build doesn't use Vite.
- `.storybook/preview.tsx` — wraps every story in `<ThemeProvider>` and exposes `Theme` + `Card style` toolbar globals that flip `data-theme` and `data-card-style` without reload.
- `.storybook/Foundations.mdx` — auto-generates colour/space/radius/type-ramp tables from `tokens.json` so docs cannot drift.

**Tests**
- `tests/setup.ts` — extends `expect` with `vitest-axe` matchers; stubs `HTMLCanvasElement.prototype.getContext` to silence axe's colour-contrast probe under jsdom.
- 54 tests across 14 files covering behaviour (Star toggle, Toggle controlled/uncontrolled, Modal Esc + focus return, useFavourites refresh-persistence) plus an a11y smoke test on every primitive.
- Vitest excludes `node_modules`, `.next`, `storybook-static`.

**Conventions**
- Path alias `@/*` → `src/*`.
- When adding map features, keep Mapbox-touching code inside client components (`mapbox-gl` requires `window`). Server-side data fetching for patio data should live in server components or route handlers and be passed as props.
- Any new component using `useState`/`useEffect`/`useRef`/`useId`/`useContext`/`useReducer`/`useMemo`/`useCallback` must declare `'use client'`.
- Design-system styling lives in CSS Modules + CSS variables — not Tailwind. Tailwind is reserved for the app shell. Don't mix the two inside one component.
