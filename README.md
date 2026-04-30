# Patio Finder

A geospatial web app that helps Torontonians find patios with the most sunlight, plus the SunChaser design system that powers it. Both live in this repo.

## Stack

- **Next.js 16.2.4 + React 19.2.4** with the App Router (`src/app/`).
- **Tailwind v4** for the app shell; **CSS Modules + CSS variables** for the design system (no overlap).
- **Storybook 8** + **Vitest** + **React Testing Library** + **vitest-axe** for the design system.
- **Mapbox GL** via `react-map-gl/mapbox` for the map view.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # add your NEXT_PUBLIC_MAPBOX_TOKEN
npm run dev                        # Next.js on http://localhost:3000
npm run storybook                  # Storybook on http://localhost:6006
```

## Scripts

| Command                    | What it does                                              |
| -------------------------- | --------------------------------------------------------- |
| `npm run dev`              | Next.js dev server (http://localhost:3000)                |
| `npm run build` / `start`  | Next.js production build / serve                          |
| `npm run storybook`        | Storybook dev server (http://localhost:6006)              |
| `npm run build-storybook`  | Static Storybook build to `storybook-static/`             |
| `npm test`                 | Vitest (jsdom + RTL + axe) — currently 54 tests           |
| `npm run typecheck`        | `tsc --noEmit`                                            |
| `npm run tokens:gen`       | Regenerate `src/tokens/tokens.{css,ts}` from `tokens.json` |
| `npm run lint`             | ESLint v9 flat config                                     |

## Layout

```
patio-finder/
├─ tokens.json              # Single source of truth for design tokens
├─ scripts/generate-tokens.ts
├─ src/
│  ├─ app/                  # Next.js App Router (layout, page, globals.css)
│  ├─ tokens/               # Generated CSS + TS constants
│  ├─ theme/                # ThemeProvider + useTheme
│  ├─ hooks/                # useFavourites, usePrefersReducedMotion
│  └─ components/
│     ├─ PatioMap.tsx       # The Mapbox view (client component)
│     ├─ layout/            # Stack, Cluster, Grid
│     └─ {Button,Card,Pill,Logo,SunRating,Star,
│         GoogleStars,Sparkline,Toggle,TextField,
│         Modal,Eyebrow,Heading}/
│           ├─ Component.tsx
│           ├─ Component.module.css
│           ├─ Component.stories.tsx
│           ├─ Component.test.tsx
│           └─ index.ts
├─ tests/setup.ts           # Vitest setup (jest-dom + axe)
├─ .storybook/              # Storybook config + Foundations.mdx
├─ vite.config.ts           # Used by Storybook + Vitest only (NOT Next.js)
└─ vitest.config.ts
```

The Next.js build does **not** go through Vite. Vite + the React plugin power Storybook (`@storybook/react-vite`) and Vitest.

## Design tokens

`tokens.json` is the canonical definition for every colour, spacing step, radius, shadow, font family, type ramp entry, theme variant (`cream` / `map`), and card-style modifier (`soft` / `sharp` / `outlined`). Re-run `npm run tokens:gen` after editing it. The Storybook **Foundations / Tokens** docs page renders auto-generated tables straight from the JSON, so docs cannot drift.

## Theming

Two themes flip via `data-theme` on `<html>` (default `cream` is set in `layout.tsx`; `<ThemeProvider>` mutates this when used):

- `cream` — light, used on Home / List / Detail / Favourites screens.
- `map` — dark, used inside the map screen chrome.

The provider also accepts `cardStyle: "soft" | "sharp" | "outlined"`, which sets `data-card-style` so `<Card>` adapts globally. Storybook exposes both as toolbar globals that flip every story without reload.

## What's _not_ in scope

App screens (Home, Map UI, List, Detail, Favourites, Sign-in), the building-shadow rendering, the time scrubber, auth, mobile layouts. The design system primitives are the foundation those will be built on.

## Mapbox

`PatioMap.tsx` reads `NEXT_PUBLIC_MAPBOX_TOKEN` and renders a fallback message when it's missing instead of crashing.
