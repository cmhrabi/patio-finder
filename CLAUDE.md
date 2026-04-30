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
- `npm run dev` — start dev server on http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config)
- TypeScript check: `npx tsc --noEmit` (no dedicated script; `tsconfig.json` has `noEmit: true`)
- No test runner is configured.

## Environment
Mapbox is required at runtime. Copy `.env.local.example` → `.env.local` and set:

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

The `NEXT_PUBLIC_` prefix exposes it to the browser bundle (the map renders client-side). `PatioMap.tsx` renders a fallback message when the token is missing instead of crashing.

## Architecture
Tiny App Router app. The whole product is "render a Mapbox map of Toronto":

- `src/app/layout.tsx` — root layout; wires Geist Sans/Mono via `next/font/google` into CSS variables consumed by Tailwind's `@theme inline` block.
- `src/app/page.tsx` — server component; renders `<PatioMap />` inside a full-viewport `<main>`.
- `src/components/PatioMap.tsx` — **client component** (`'use client'`). Imports `Map` from `react-map-gl/mapbox` and `mapbox-gl/dist/mapbox-gl.css`. Initial view is hard-coded to Toronto (`-79.3832, 43.6532`, zoom 12).
- Path alias `@/*` → `src/*` (see `tsconfig.json`).

When adding map features (markers, layers, data fetching for patios), keep the Mapbox-touching code inside client components — `mapbox-gl` requires `window`. Server-side data fetching for patio data should live in server components or route handlers and be passed down as props.
