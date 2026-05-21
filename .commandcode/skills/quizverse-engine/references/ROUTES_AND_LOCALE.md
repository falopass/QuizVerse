# Routes & Locale Reference

## Locale System

- Soporta `en` y `es`.
- Todas las rutas públicas usan `/[locale]/...`.
- `proxy.ts` (middleware) redirige paths sin locale a `/en`.
- `proxy.ts` también refresca sesión de Supabase en cada request.
- `LocaleSwitcher` componente para cambio EN ↔ ES con persistencia.
- `/api/locale` — Endpoint para preferencia de idioma.

## Rutas principales

| Ruta | Propósito |
|---|---|
| `/[locale]` | Home editorial: hero, lead quiz, support rail, strips curadas |
| `/[locale]/quiz` | Explore: filtros, lanes, pulse card |
| `/[locale]/quiz/[slug]` | Detail: portada, payoff, preview |
| `/[locale]/quiz/[slug]/play` | Play: timer, streak, power-ups, modos normal/practice |
| `/[locale]/quiz/[slug]/result` | Result: compartible con share_token |
| `/[locale]/create` | Creación manual de quiz |
| `/[locale]/create/ai` | Generación con DeepSeek |
| `/[locale]/login` | Auth Supabase |
| `/[locale]/leaderboard` | Ranking global |
| `/[locale]/profile/[username]` | Perfil de usuario |
| `/[locale]/about` | Acerca de |
| `/[locale]/contact` | Contacto |
| `/[locale]/privacy` | Política de privacidad |
| `/[locale]/terms` | Términos de servicio |

## API Routes

| Ruta | Propósito |
|---|---|
| `/api/quiz/generate` | DeepSeek quiz generation con Zod |
| `/api/quiz/report` | Reporte de quizzes |
| `/api/analytics` | Eventos de telemetría |
| `/api/monitor` | Client error logging |
| `/api/locale` | Preferencia de idioma |

## Server Actions (src/actions/quiz.actions.ts)

- `createQuiz()` — Manual + AI-generated con Zod
- `submitQuizResult()` — Sesiones con share_token
- `likeQuiz()` / `reportQuiz()`
- Rate limiting vía Upstash Redis

## Telemetría

- `page_view` — Navegación
- `locale_switch` — Cambio de idioma
- `quiz_start` / `quiz_complete` — Ciclo de juego
- `create_start` / `create_complete` — Creación AI
