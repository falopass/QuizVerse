<div align="center">

# 🎯 QuizVerse

**Editorial quizzes with personality**

A bilingual quiz platform built with Next.js 16, React 19, and Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.1-111111?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
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

- ✅ Production build passes with **Next.js 16.2.1**
- ✅ TypeScript passes clean
- ✅ Public routes localized under `/en` and `/es`
- ✅ Runtime catalog seeded in Supabase with real quizzes
- ✅ Core flows live: home, explore, detail, play, result, login, create, AI create, profile, leaderboard
- ✅ Seed, polish, cover hydration, and Supabase import pipelines in place

### Content stats

| Metric                                       | Count   |
| -------------------------------------------- | ------- |
| Real quizzes seeded and synced to Supabase   | **493** |
| English quizzes                              | 259     |
| Spanish quizzes                              | 259     |
| Trivia quizzes                               | 188     |
| Personality quizzes                          | 189     |
| Featured quizzes                             | 13      |
| Strong editorial quizzes                     | 338     |
| Prioritized quizzes with stock cover routing | 40      |

---

## 🎨 What Is Already Built

### Product surface

- Editorial bilingual home page
- Editorial explore page with filters and visual hierarchy
- Quiz detail pages with cover-led hero, payoff, and related quizzes
- Play flow with localized game modes and result persistence
- Result pages with sharing-oriented composition
- Localized login flow
- User profile pages
- Leaderboard
- Manual quiz creation flow
- AI-powered quiz creation flow

### Infrastructure

- Supabase catalog with 493 real quizzes
- Seed + polish + cover hydration pipelines
- Supabase import pipelines
- OG image generation
- Analytics + monitoring hooks
- Procedural + curated stock cover layers

---

## 🛠️ Tech Stack

| Layer               | Technology                           |
| ------------------- | ------------------------------------ |
| **Framework**       | Next.js 16.2.1 (App Router)          |
| **UI**              | React 19.2.4                         |
| **Language**        | TypeScript 5.x                       |
| **Database & Auth** | Supabase                             |
| **AI**              | LLM-powered quiz generation pipeline |
| **Deploy**          | Vercel                               |
| **Analytics**       | Analytics hooks (provider-agnostic)  |
| **Monitoring**      | Monitoring hooks (provider-agnostic) |

---

## 🏗️ Architecture Snapshot

```
QuizVerse/
├── app/
│   ├── [locale]/                # /en and /es localized routes
│   │   ├── page.tsx             # Home
│   │   ├── explore/             # Discovery + filters
│   │   ├── quiz/[slug]/         # Detail
│   │   ├── play/[slug]/         # Play flow
│   │   ├── result/[id]/         # Shareable results
│   │   ├── create/              # Manual creation
│   │   ├── ai-create/           # AI-powered creation
│   │   ├── profile/             # User profile
│   │   ├── leaderboard/         # Rankings
│   │   └── login/               # Auth
│   └── api/
│       ├── og/                  # OG image generation
│       └── quiz/                # Quiz CRUD
├── components/                  # UI components
├── lib/
│   ├── supabase/                # Supabase client + queries
│   ├── ai/                      # AI quiz generation
│   ├── seed/                    # Seeding pipelines
│   ├── polish/                  # Content polishing
│   └── covers/                  # Cover hydration
├── scripts/                     # Seed, polish, import scripts
└── content/                     # Editorial quiz drafts
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
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, and any LLM provider keys

# Run dev server
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build
```

---

## 🚀 Deployment

Deployed to **Vercel**. Supabase provides the backend (database, auth, storage). LLM provider is configurable through environment variables.

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

- ✅ Build de producción funcionando con Next.js 16.2.1
- ✅ TypeScript sin errores
- ✅ Rutas públicas localizadas bajo `/en` y `/es`
- ✅ Catálogo de runtime seedeado en Supabase con quizzes reales
- ✅ Flujos core en vivo: home, explore, detalle, play, resultado, login, create, AI create, profile, leaderboard

## Estadísticas de contenido

- **493 quizzes reales** seedeados y sincronizados con Supabase
- 259 quizzes en inglés
- 259 quizzes en español
- 188 quizzes de trivia
- 189 quizzes de personalidad
- 13 quizzes destacados
- 338 quizzes editoriales de alta calidad

## Stack

- Next.js 16.2.1 (App Router)
- React 19.2.4
- TypeScript 5.x
- Supabase (backend + auth)
- Pipelines de IA para generación de quizzes
- Vercel (deploy)

**Construido por:** Diego Bravo Opazo — [Portfolio](https://github.com/falopass)

</details>

---

<div align="center">

**⭐ If this project interests you, please star the repo!**

</div>
