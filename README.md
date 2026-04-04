# QuizVerse

> Editorial quizzes with personality. A bilingual quiz platform built with Next.js 16, React 19 and Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.1-111111?style=flat-square)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-149ECA?style=flat-square)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Prelaunch%20Build%20Ready-c96a2b?style=flat-square)](#current-status)

QuizVerse is a bilingual (`/en`, `/es`) editorial quiz product focused on pop culture, personality formats, sharable results and a stronger product feel than generic quiz sites. The project now runs on a real Supabase catalog, supports manual + AI quiz creation, localized public routes, shareable result pages, OG images, analytics hooks, monitoring hooks, and a scalable cover system with procedural + curated stock layers.

## Table of Contents

- [Current Status](#current-status)
- [What Is Already Built](#what-is-already-built)
- [Tech Stack](#tech-stack)
- [Architecture Snapshot](#architecture-snapshot)
- [Product Highlights](#product-highlights)
- [Catalog and Seed Pipeline](#catalog-and-seed-pipeline)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Roadmap Before Public Launch](#roadmap-before-public-launch)
- [First Git Push](#first-git-push)

## Current Status

QuizVerse is no longer a prototype-only repository. The current state of the product is:

- Production build passes with `Next.js 16.2.1`
- TypeScript passes
- Public routes are localized under `/en` and `/es`
- The runtime catalog is seeded in Supabase with real quizzes
- Core flows are live: home, explore, detail, play, result, login, create, AI create, profile and leaderboard
- Seed + polish + cover hydration + Supabase import pipelines are in place

### Snapshot

- `116` real quizzes currently seeded and synced to Supabase
- `59` quizzes in English
- `57` quizzes in Spanish
- `56` trivia quizzes
- `60` personality quizzes
- `13` featured quizzes
- `103` strong editorial quizzes
- `40` prioritized quizzes currently using stock cover routing

## What Is Already Built

### Product surface

- Editorial bilingual home page
- Editorial explore page with filters and visual hierarchy
- Quiz detail pages with cover-led hero, payoff and related quizzes
- Play flow with localized game modes and result persistence
- Result pages with sharing-oriented composition
- Localized login flow
- Manual quiz creation flow
- AI quiz generation flow
- Leaderboard and profile pages

### Backend and content layer

- Supabase SSR integration for server components and actions
- Public data layer connected to real DB queries
- AI generation endpoint with validation and locale-aware quiz payloads
- Game session persistence and share tokens
- Like/report/session/profile/language flows wired into real persistence
- Seed importer for publishing large curated quiz batches into Supabase

### SEO / growth / instrumentation base

- Locale-aware metadata and canonical URLs
- Open Graph images for home and quiz detail
- Google-friendly `max-image-preview: large`
- Analytics endpoint for page view / quiz lifecycle / locale switch events
- Monitoring endpoint for client-side runtime reporting

## Tech Stack

### Frontend

- `Next.js 16.2.1`
- `React 19.2.4`
- `Framer Motion`
- `Zustand`
- custom editorial UI system + Tailwind/CSS tokens

### Backend / infrastructure

- `Supabase`
- `@supabase/ssr`
- `@supabase/supabase-js`
- `Upstash Redis`
- `Zod`

### Rendering / media

- `Satori`
- `@resvg/resvg-js`
- stock cover hydration via `Pexels` and optional `Pixabay`

### AI / content generation

- Groq-backed generation route for runtime AI quiz creation
- OpenRouter/Qwen-based seed generation pipeline used offline for catalog expansion

## Architecture Snapshot

```text
Browser / Bots
  ├─ proxy.ts
  │   ├─ refreshes Supabase auth session
  │   └─ redirects non-localized paths to /en or /es
  ├─ App Router /[locale]
  │   ├─ Home
  │   ├─ Explore / Category / Detail
  │   ├─ Play / Result
  │   ├─ Create / AI Create / Login
  │   ├─ Profile / Leaderboard
  │   └─ Metadata / OG image routes
  ├─ Public data layer (src/lib/data/public.ts)
  ├─ Server actions (src/actions/quiz.actions.ts)
  ├─ Supabase
  │   ├─ quizzes
  │   ├─ categories
  │   ├─ profiles
  │   ├─ game_sessions
  │   ├─ likes
  │   └─ achievements
  └─ Editorial pipeline (scripts/*.mjs)
      ├─ seed generation
      ├─ seed polish
      ├─ cover hydration
      └─ Supabase import
```

## Product Highlights

### 1. Locale-first public experience

The public product is structured around localized routes:

- `/en`
- `/es`
- `/en/quiz`
- `/es/quiz`
- `/en/quiz/[slug]`
- `/es/quiz/[slug]`
- `/[locale]/quiz/[slug]/play`
- `/[locale]/quiz/[slug]/result`

Legacy non-localized routes redirect into the locale system.

### 2. Editorial catalog instead of flat quiz grids

The product does not rely on generic card walls anymore. Home and explore now prioritize:

- lead quiz
- support rail
- featured strips
- quick-entry lanes
- stronger visual hierarchy for the best topics

### 3. Scalable visual system for infinite quiz generation

QuizVerse now uses a layered cover system:

- `procedural` fallback for every quiz
- `stock` covers for curated / strong editorial picks
- `generated` / `curated` ready in the type system for future AI or manual art direction

This keeps the long tail visually consistent while allowing premium treatment for high-priority pages.

## Catalog and Seed Pipeline

The catalog pipeline is one of the most important parts of the repo now.

### Current workflow

1. Generate quizzes in batches
2. Polish copy, slugs, featured flags, editorial metadata and visual profile
3. Hydrate strong quizzes with stock covers where the match is good enough
4. Import everything into Supabase

### Relevant files

- `generated/trending-seed-openrouter.json`
- `generated/trending-seed-openrouter.normalized.json`
- `generated/trending-seed-polish-report.json`
- `generated/stock-cover-hydration-report.json`
- `src/lib/data/stock-cover-manifest.json`

### Content notes

The seed is already usable, but before a true public launch it is still worth doing one more human pass on the 20-30 quizzes that will live above the fold or be used in acquisition campaigns.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 3. Fill the required environment variables

At minimum, local development expects:

- Supabase URL
- Supabase publishable key
- Supabase service role key for import scripts
- Groq API key for runtime AI generation

### 4. Run the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The project uses more than one external system. See `.env.example` for the full template.

### Core runtime

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (compat fallback)
- `SUPABASE_SERVICE_ROLE_KEY`

### AI / content generation

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY` (optional, for batch seed generation workflows)

### Rate limiting / infrastructure

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Visual enrichment

- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`

### Monetization / future launch

- `NEXT_PUBLIC_ADSENSE_ID`

## Scripts

### App lifecycle

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Editorial pipeline

```bash
npm run seed:polish
npm run seed:covers
npm run seed:stock-covers
npm run seed:supabase:import
```

### What they do

- `seed:polish`: normalizes and curates the generated seed
- `seed:covers`: generates procedural cover assets / supporting cover outputs
- `seed:stock-covers`: hydrates strong quizzes with curated stock cover candidates
- `seed:supabase:import`: imports the current seed into Supabase

## Project Structure

```text
src/
  app/
    [locale]/...
    api/
    covers/
    stock-covers/
  actions/
  components/
    home/
    layout/
    quiz/
    shared/
  lib/
    data/
    design/
    i18n/
    quiz/
    seo/
    supabase/
    telemetry/
  providers/
  stores/
  types/

scripts/
  polish-trending-seed.mjs
  hydrate-stock-covers.mjs
  import-trending-seed-to-supabase.mjs
  generate-cover-assets.mjs

generated/
  trending-seed-openrouter.json
  trending-seed-openrouter.normalized.json
  trending-seed-polish-report.json
  stock-cover-hydration-report.json
  supabase-import-report.json

supabase/
  migrations/
  seed/
```

## Deployment

### Recommended stack

- Frontend + app runtime: `Vercel`
- Database/auth/storage: `Supabase`
- DNS / domain / proxy: `Cloudflare`
- Canonical domain: `https://quizverse.org`

### Production checklist

- set `NEXT_PUBLIC_SITE_URL=https://quizverse.org`
- configure Supabase production project
- configure runtime env vars in Vercel
- verify locale routing on `/en` and `/es`
- verify Open Graph images
- verify share URLs and result pages
- run final mobile + desktop smoke pass
- integrate ad stack carefully to avoid layout shift

## Roadmap Before Public Launch

These are the remaining high-value items, ordered by launch impact.

### Product / content

- final QA pass on the top quizzes used in home and acquisition
- better category balance in the live catalog
- more curated covers or AI-native covers for the most valuable pages
- expand “topic hub” surfaces for SEO and distribution

### Growth / monetization

- ad placement strategy without hurting UX
- traffic acquisition loops for SEO + Google Discover + Shorts + social sharing
- better internal linking between franchise/topic clusters

### Technical hardening

- final browser-level QA across the critical funnel
- production monitoring integration if desired (Sentry/PostHog/etc.)
- privacy/cookie/legal review before ads go live

## First Git Push

If this is the first push of the repository to GitHub, this is the standard sequence.

### 1. Initialize git if needed

```bash
git init
```

### 2. Add the remote

```bash
git remote add origin https://github.com/falopass/QuizVerse.git
```

If `origin` already exists:

```bash
git remote set-url origin https://github.com/falopass/QuizVerse.git
```

### 3. Create the main branch

```bash
git branch -M main
```

### 4. Review your local environment files

Before pushing, make sure you do **not** commit secrets:

- keep `.env.local` untracked
- rotate any keys that were exposed during development
- only commit `.env.example`

### 5. Commit and push

```bash
git add .
git commit -m "Initial public-ready QuizVerse repository"
git push -u origin main
```

## Notes for Contributors

- This repo is using a newer Next.js version; always check the local docs in `node_modules/next/dist/docs/` before making assumptions.
- The architecture HTML file (`QuizVerse-Architecture.html`) is intended to stay as a living executive snapshot, not stale historical documentation.
- The current product direction is editorial, bilingual, discovery-oriented and ad-supported.

---

Built for a launch-ready editorial quiz product, not a generic template grid.
