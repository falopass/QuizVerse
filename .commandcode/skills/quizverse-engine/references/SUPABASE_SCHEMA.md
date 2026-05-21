# Supabase Schema Reference

## Tables

### quizzes
- `id` — UUID, PK
- `slug` — text, unique, URL-safe
- `title` — text
- `description` — text
- `locale` — text ('en' | 'es')
- `category` — text (FK to categories.slug)
- `quiz_type` — text ('trivia' | 'personality')
- `questions` — jsonb[]
- `visual_profile` — text (una de las 12 VisualFamilies)
- `featured` — boolean
- `cover_type` — text ('procedural' | 'stock' | 'ai')
- `cover_url` — text (nullable)
- `is_ai_generated` — boolean
- `created_at`, `updated_at` — timestamptz

### categories
- `id` — UUID, PK
- `slug` — text, unique
- `label` — jsonb { en: string, es: string }
- `icon` — text
- `color` — text

### profiles
- Linked to Supabase Auth
- `id` — UUID (matches auth.users.id)
- `username` — text, unique
- `avatar_url` — text (nullable)

### game_sessions
- `id` — UUID, PK
- `quiz_id` — UUID (FK to quizzes.id)
- `user_id` — UUID (nullable, FK to profiles.id)
- `score` — integer
- `max_score` — integer
- `share_token` — text, unique
- `answers` — jsonb[]
- `created_at` — timestamptz

### likes
- `user_id` — UUID (FK to profiles.id)
- `quiz_id` — UUID (FK to quizzes.id)
- PK: (user_id, quiz_id)

### achievements
- `id` — UUID, PK
- `user_id` — UUID (FK to profiles.id)
- `type` — text
- `data` — jsonb
- `created_at` — timestamptz

## Supabase Clients

| Client | Archivo | Uso |
|---|---|---|
| Server (SSR) | `src/lib/supabase/server.ts` | Server Components, Server Actions |
| Browser | `src/lib/supabase/client.ts` | Client Components |
| Admin | `src/lib/supabase/admin.ts` | Scripts de seed (service role) |
| Env | `src/lib/supabase/env.ts` | Fallback + warning si faltan vars |

## Queries principales (src/lib/data/public.ts)

- `getHomePayload()` — Totales reales + selección localizada para home
- `getPublishedQuizzes()` — Catálogo con filtros y paginación
- `getQuizBySlug()` — Quiz individual con relaciones
- `getRelatedQuizzes()` — Sugerencias por categoría y visual
