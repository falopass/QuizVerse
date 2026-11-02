<div align="center">

# 🎯 QuizVerse

**Editorial quizzes with personality**

A bilingual quiz platform built with Next.js 16, React 19, and Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-111111?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.4-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Status](https://img.shields.io/badge/Status-Prelaunch_Build_Ready-c96a2b?style=for-the-badge)](#current-status)

</div>

---

## 📖 Overview

QuizVerse is a bilingual (`/en`, `/es`) editorial quiz product focused on pop culture, personality formats, shareable results, and a stronger product feel than generic quiz sites. Runs on a real Supabase catalog with manual + AI quiz creation, localized public routes, shareable result pages, OG images, analytics hooks, monitoring hooks, and a scalable cover system with procedural + curated stock layers.

---

## 📊 Current Snapshot

- ✅ Production build passes with **Next.js 16.4.2**
- ✅ TypeScript passes clean
- ✅ Public routes localized under `/en` and `/es`
- ✅ Runtime catalog seeded in Supabase with real quizzes
- ✅ Core flows live: home, explore (`/[locale]/quiz`), detail, play, result, login, social login (behind flag), create, AI create, drafts + preview, profile, "Mi actividad" (`/me`), notifications, leaderboard, admin moderation
- ✅ Seed, polish, cover hydration, and Supabase import pipelines in place

### Content stats

Last DB audit (`generated/audit/content-audit.json`, 2026-10-18): **524 published quizzes** and 4192 questions (262 en / 262 es; 246 trivia / 278 personality). Newer editorial batches merged since then are pending import — merged ≠ published; applying the SQL is the owner's call.

---

## 🎨 What Is Already Built

### Product surface

- Editorial bilingual home page
- Editorial explore page with filters and visual hierarchy
- Quiz detail pages with cover-led hero, payoff, related quizzes, likes and comments
- Server-authoritative play flow: signed attempts, per-question reveal (with 50/50 hint), idempotent submission and server-built answer review
- Result pages with sharing-oriented composition
- Localized login + social login (Google/GitHub/Facebook behind `AUTH_OAUTH_PROVIDERS`)
- User profiles, "Mi actividad", follows, notifications, daily streak and achievements
- Leaderboard
- Manual quiz creation flow with drafts, unpublish and preview
- AI-powered quiz creation flow
- Admin moderation queue (pending quizzes, reports, comment moderation)
- AdSense slots, inert until configured

### Infrastructure

- Supabase catalog (524+ published quizzes; answer keys isolated in `quiz_answer_keys`, service-role only)
- Seed + polish + cover hydration pipelines
- Supabase import pipelines
- OG image generation
- Analytics + monitoring hooks
- Procedural + curated stock cover layers
- Rate limiting: Upstash Redis, with Cloudflare Rate Limiting bindings as fallback (`wrangler.jsonc`)
- Production smoke every 30 min (`scripts/smoke-prod.sh` + `smoke.yml` workflow)

---

## 🛠️ Tech Stack

| Layer               | Technology                           |
| ------------------- | ------------------------------------ |
| **Framework**       | Next.js 16.4.2 (App Router)          |
| **UI**              | React 19.2.4                         |
| **Language**        | TypeScript 5.x                       |
| **Database & Auth** | Supabase                             |
| **AI**              | LLM-powered quiz generation pipeline |
| **Deploy**          | Cloudflare Workers (OpenNext)        |
| **Analytics**       | Analytics hooks (provider-agnostic)  |
| **Monitoring**      | Monitoring hooks (provider-agnostic) |

---

## 🏗️ Architecture Snapshot

```
QuizVerse/
├── src/app/
│   ├── [locale]/                # /en and /es localized routes
│   │   ├── (inicio)/            # Home
│   │   ├── quiz/                # Explore (/[locale]/quiz; /explore 308-redirects)
│   │   │   └── [slug]/          # Detail + play/ + result/
│   │   ├── category/[slug]/     # Category hubs
│   │   ├── me/                  # "Mi actividad"
│   │   ├── profile/[username]/  # Public profiles
│   │   ├── my-quizzes/          # Drafts, edit, preview
│   │   ├── create/ + create/ai/ # Manual and AI composers
│   │   ├── notifications/       # Inbox
│   │   ├── admin/               # Moderation queue (owner)
│   │   ├── leaderboard/         # Rankings
│   │   └── login|register|settings|…
│   └── api/                     # quiz (reveal, generate), og, analytics, monitor, csp-report
├── src/components/              # UI components
├── src/lib/
│   ├── supabase/                # Supabase client + queries
│   ├── quiz/                    # Answer key, attempts, scoring (server-authoritative)
│   ├── seo/                     # Metadata, JSON-LD, sitemap, OG
│   ├── ads/ + auth/ + utils/    # AdSense config, OAuth flag, rate limiting
│   └── data/ + i18n/            # Public data layer, dictionaries
├── scripts/                     # Seed, polish, import, smoke-prod.sh
└── supabase/                    # migrations/ (applied up to 020) + seed/
```

---

## ⚙️ Getting Started

```bash
# Clone
git clone https://github.com/falopass/QuizVerse.git
cd QuizVerse

# Install
npm install

# Configure environment
cp deploy/env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, QUIZ_ATTEMPT_SECRET, DEEPSEEK_API_KEY
# Optional: AUTH_OAUTH_PROVIDERS, UPSTASH_REDIS_REST_*, NEXT_PUBLIC_ADSENSE_*,
#         PEXELS_API_KEY / PIXABAY_API_KEY (see AGENTS.md → Worker variables)

# Run dev server
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build
```

---

## 🚀 Deployment

Deployed to **Cloudflare Workers** via OpenNext: Workers Builds builds and deploys `main` to [quizverse.org](https://quizverse.org). Supabase provides the backend (database, auth, storage). LLM provider is configurable through environment variables.

### Production smoke test

`scripts/smoke-prod.sh` hits the deployed site with `curl` and asserts real HTTP statuses: localized homes, quiz detail, `/play` and `/result`, OG images, category, leaderboard, auth pages, `sitemap.xml`, `robots.txt`, the `/feed.xml` redirect, the old `/en/explore` redirects, real 404s (also with the Googlebot UA) and that the `/play` HTML never leaks `is_correct`. It exits non-zero on any failure and prints a summary.

The `smoke` GitHub workflow runs it every 30 minutes, on `workflow_dispatch`, and after each push to `main` (with retries while Workers Builds publishes). To run it by hand:

```bash
scripts/smoke-prod.sh                      # against https://quizverse.org
scripts/smoke-prod.sh https://preview-url  # or any base URL
```

---

## 🗺️ Roadmap Before Public Launch

- Polishing remaining covers and hero art
- SEO metadata pass on all quiz detail pages
- Performance audit and Core Web Vitals optimization
- Public marketing pages (about, terms, privacy)
- Content moderation flow for user-generated quizzes
- Public launch announcement

---

## 📊 About This Project

QuizVerse is part of an indie SaaS portfolio focused on shipping real, editorial-quality products. Solo-built and maintained.

**Built by:** Diego Bravo Opazo — [Portfolio](https://github.com/falopass)

---

<details>
<summary><b>🇪🇸 Descripción en español</b></summary>

<br>

## Sobre QuizVerse

QuizVerse es un producto editorial de quizzes bilingüe (`/en`, `/es`) enfocado en cultura pop, formatos de personalidad, resultados compartibles y una sensación de producto más fuerte que los sitios genéricos de quizzes. Corre sobre un catálogo real en Supabase con creación manual y con IA, rutas localizadas, páginas de resultados compartibles, imágenes OG, hooks de analítica y monitoreo, y un sistema escalable de portadas con capas procedurales y curadas.

## Estado actual

- ✅ Build de producción funcionando con Next.js 16.4.2
- ✅ TypeScript sin errores
- ✅ Rutas públicas localizadas bajo `/en` y `/es`
- ✅ Catálogo de runtime seedeado en Supabase con quizzes reales
- ✅ Flujos core en vivo: home, explore, detalle, play, resultado, login, create, AI create, profile, leaderboard

## Estadísticas de contenido

- **524 quizzes publicados** en el último audit de la DB (`generated/audit/content-audit.json`, 2026-10-18): 262 en inglés, 262 en español, 246 trivia, 278 personalidad, 4192 preguntas
- Lotes editoriales mergeados desde entonces quedan pendientes de importar (mergeado ≠ publicado)

## Stack

- Next.js 16.4.2 (App Router)
- React 19.2.4
- TypeScript 5.x
- Supabase (backend + auth)
- Pipelines de IA para generación de quizzes
- Cloudflare Workers (deploy)

**Construido por:** Diego Bravo Opazo — [Portfolio](https://github.com/falopass)

</details>

---

<div align="center">

**⭐ If this project interests you, please star the repo!**

</div>
