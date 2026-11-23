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

## 📊 Current Snapshot (2026-11-22)

- ✅ Production deployed on **Cloudflare Workers** (OpenNext / Workers Builds) with **Next.js 16.4.2** and **React 19.2.4**
- ✅ Public routes localized under `/en` and `/es`
- ✅ Runtime catalog backed by Supabase (self-hosted GoTrue + Postgres at `api.quizverse.org`)
- ✅ Core flows live: home, explore (`/[locale]/quiz`), detail, play, result, daily quiz, group rankings (implemented; migration `021` pending prod verification), fandom hubs, embed widget, login, social login (`google` + `github` visible in prod; full session round-trip and `facebook` setup pending — see `docs/login-social.md`), create, AI create, drafts + preview, profile, "Mi actividad" (`/me`), notifications, leaderboard, admin moderation (`/[locale]/admin/*`), and public info pages (`about`, `contact`, `faq`, `privacy`, `terms`)
- ✅ Seed, polish, cover hydration, and Supabase import pipelines in place

### Content stats (dated by evidence source)

- **DB audit (`generated/audit/content-audit.json`, 2026-10-18):** 524 published quizzes and 4,192 questions (262 `en` / 262 `es`; 246 `trivia` / 278 `personality`).
- **Versioned editorial seeds (`scripts/seed/editorial-seed*.json`, verified 2026-11-22):** 89 batches, 916 quizzes (458 `en` / 458 `es`; 801 `trivia` / 115 `personality`). Merged ≠ published: applying SQL to production is always the owner's decision.
- **Anonymous live sitemap/HTTP probe (`https://quizverse.org`, 2026-11-22):** 1,434 quiz URLs observed in `sitemap.xml` (717 per locale in Explore); exact DB totals remain owner-verified.

---

## 🎨 What Is Already Built

### Product surface

- Editorial bilingual home page
- Editorial explore page with filters and visual hierarchy
- Quiz detail pages with cover-led hero, payoff, related quizzes, likes and comments
- Server-authoritative play flow: signed attempts, per-question reveal (with 50/50 hint), idempotent submission and server-built answer review
- Result pages with sharing-oriented composition
- Localized login + social login (`AUTH_OAUTH_PROVIDERS`: `google` and `github` confirmed visible in prod on 2026-11-22 with full session check pending; `facebook` pending Meta/GoTrue setup)
- User profiles, "Mi actividad", follows, notifications, daily quiz (local device streak), achievements and link-shared group rankings
- Leaderboard (global, weekly global, friends)
- Manual quiz creation flow with drafts, unpublish and preview (trivia & personality)
- AI-powered quiz creation flow
- Admin moderation queue (pending quizzes, reports, comment moderation, growth stats)
- AdSense slots + `/ads.txt` route, inert until publisher/slots are approved and configured

### Infrastructure

- Supabase catalog (answer keys isolated in `quiz_answer_keys`, service-role only; migrations versioned up to `022_analytics_events.sql`, with `021` and `022` pending per-object verification in production — see `AGENTS.md`)
- Seed + polish + cover hydration pipelines
- Supabase import pipelines
- OG image generation (Satori)
- Analytics + monitoring hooks (with optional persistent `analytics_events` table in migration `022`)
- Procedural + curated stock cover layers
- Rate limiting: Upstash Redis (pending secrets in Worker) with Cloudflare Rate Limiting bindings as active per-location fallback (`wrangler.jsonc`)
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
│   │   ├── admin/               # Moderation queue & stats (owner)
│   │   ├── daily/ + fandom/     # Daily challenge & fandom hubs
│   │   ├── leaderboard/         # Rankings
│   │   └── login|register|settings|widget|about|contact|faq|privacy|terms|…
│   └── api/                     # 16 API routes (quizzes, categories, stats, leaderboard, daily, reveal, generate, report, auth/send-email, og, analytics, monitor, csp-report, …)
├── src/components/              # UI components
├── src/lib/
│   ├── supabase/                # Supabase client + queries
│   ├── quiz/                    # Answer key, attempts, scoring (server-authoritative)
│   ├── seo/                     # Metadata, JSON-LD, sitemap, OG
│   ├── ads/ + auth/ + utils/    # AdSense config, OAuth flag, rate limiting
│   └── data/ + i18n/            # Public data layer, dictionaries
├── scripts/                     # Seed, polish, import, smoke-prod.sh
└── supabase/                    # migrations/ (versioned to 022; applied through 020 documented, 021–022 pending verification) + seed/
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

## 🗺️ Open Operational & Product Milestones

- Cover art & hero card polish (stock/curated variants and deterministic art)
- Performance, pagination & Core Web Vitals optimization (`/quiz` payload, CDN cache headers, client bundle)
- Operational verification by owner: migrations `021`/`022` per-object check in prod, Upstash Redis secrets in Worker, Facebook OAuth app/GoTrue setup, and end-to-end OAuth session check
- AdSense activation once publisher account and ad units are approved (kept off until then)
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

## Estado actual (2026-11-22)

- ✅ Producción en Cloudflare Workers (OpenNext / Workers Builds) con Next.js 16.4.2 y React 19.2.4
- ✅ Rutas públicas localizadas bajo `/en` y `/es`
- ✅ Catálogo en Supabase (migraciones versionadas hasta `022`; aplicadas documentadas hasta `020`, `021`–`022` pendientes de verificación por objeto en producción)
- ✅ Flujos core en vivo: home, explore, detalle, play, resultado, reto diario, ranking de grupo (implementado; migración `021` pendiente de verificación en prod), login y OAuth (`google` y `github` visibles en prod, sesión completa y `facebook` pendientes), creación manual e IA, perfiles, moderación admin y páginas informativas

## Estadísticas de contenido

- **Audit de DB (`generated/audit/content-audit.json`, 2026-10-18):** 524 quizzes publicados (262 `en`, 262 `es`; 246 `trivia`, 278 `personality`; 4.192 preguntas)
- **Seeds versionados (`scripts/seed/editorial-seed*.json`, 2026-11-22):** 89 lotes, 916 quizzes (mergeado ≠ publicado)
- **Muestreo HTTP/sitemap (`https://quizverse.org`, 2026-11-22):** 1.434 URLs de quiz observadas en `sitemap.xml` (conteo exacto en DB sujeto a verificación del dueño)

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
