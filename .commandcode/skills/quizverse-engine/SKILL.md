---
name: quizverse-engine
description: Knowledge base for QuizVerse quiz engine, scoring, visual families, seed pipeline, and content architecture. Load when working on quiz generation, scoring logic, visual profiles, cover system, or seed pipeline.
---

# QuizVerse Engine

Carga esta skill cuando trabajes en la lógica de quizzes, scoring, visual families, covers, seed pipeline o generación con IA.

## Quiz Types

QuizVerse soporta dos tipos de quiz:

### Trivia
- Preguntas con respuesta correcta única.
- Scoring basado en aciertos, tiempo y streaks.
- Power-ups disponibles durante el juego.
- Resultado: score numérico + porcentaje.

### Personality
- Preguntas sin respuesta "correcta".
- Cada opción suma puntos a diferentes perfiles de resultado.
- Resultado: perfil de personalidad asignado.
- Los resultados deben ser memorables y compartibles.

## Scoring System

Archivo: `tests/scoring.test.ts` (12 tests)

- Base score por respuesta correcta.
- Bonus por tiempo restante.
- Streak multiplier por respuestas consecutivas correctas.
- Power-ups: 50/50, time extension, skip.

## Quiz Engine

Archivo: `tests/engine.test.ts` (18 tests)

- Gestión de estado del juego (pregunta actual, respuestas, timer).
- Modos: normal y practice.
- Persistencia de sesión en Supabase (`game_sessions`).
- `share_token` para resultados compartibles.

## Visual Families

12 familias temáticas con paletas de fondo dinámico:

| Family | Uso típico |
|---|---|
| `space-opera` | Sci-fi, Star Wars, space |
| `dark-fantasy` | Game of Thrones, horror, gothic |
| `science-lab` | Science, chemistry, tech |
| `retro-mystery` | Detective, noir, vintage |
| `neon-drama` | Euphoria, nightlife, drama |
| `corporate-chaos` | Business, office, The Office |
| `comedy-stage` | Comedy, sitcoms, humor |
| `academic-strategy` | History, strategy, education |
| `bright-platformer` | Gaming, Mario, colorful |
| `editorial-generic` | Default fallback |
| `lifestyle-soft` | Lifestyle, wellness, food |
| `personality-pulse` | Personality quizzes default |

Componente: `QuizDynamicBackground` — doble capa: gradiente base + acento radial.

## Cover System

Tres capas en orden de prioridad:

1. **Stock covers** — Pexels (principal) + Pixabay (fallback). 40 quizzes prioritarios.
2. **Procedural covers** — Fallback SVG generado por slug. Ruta: `/covers/[slug]`.
3. **IA covers** — Arquitectura preparada, no implementado aún.

Archivos:
- `scripts/hydrate-stock-covers.mjs` — Asigna stock covers.
- `scripts/generate-cover-assets.mjs` — Genera covers procedurales.
- `src/lib/data/stock-cover-manifest.json` — Manifiesto de atribución.

Reglas:
- Matching endurecido para evitar retratos o imágenes irrelevantes.
- Overrides manuales para franquicias sensibles (Star Wars, Euphoria, etc.).

## Seed Pipeline

Flujo completo para generar y publicar quizzes:

```
generate-trending-seed.mjs → polish-trending-seed.mjs → generate-cover-assets.mjs → hydrate-stock-covers.mjs → import-trending-seed-to-supabase.mjs
```

1. **Generate**: DeepSeek genera quizzes batch desde topics (franchises + general + patterns).
2. **Polish**: Normaliza, valida Zod, limpia formatting, asigna `visual_profile`.
3. **Covers**: Genera covers procedurales SVG.
4. **Stock covers**: Busca y asigna fotos de Pexels/Pixabay.
5. **Import**: Sube a Supabase con upsert por slug.

Output intermedio: `generated/trending-seed.json`

## AI Generation (Runtime)

- Modelo: `deepseek-chat`
- Endpoint: `https://api.deepseek.com/v1/chat/completions`
- Client: OpenAI SDK con baseURL override.
- Validación: Zod para input y output.
- Rate limit: 10 quizzes/minuto vía Upstash Redis.
- Archivos: `src/lib/quiz/generator.ts` + `src/app/api/quiz/generate/route.ts`

## Validation

Archivo: `tests/validator.test.ts` (18 tests)

Todo quiz generado pasa por validación Zod:
- Estructura correcta de preguntas y opciones.
- Locale válido (en/es).
- quiz_type válido (trivia/personality).
- visual_profile válido (una de las 12 families).
- Slug único y URL-safe.

## Reglas al tocar el engine

1. No cambiar scoring sin actualizar tests.
2. No agregar quiz types sin actualizar Zod schemas + tests.
3. No cambiar visual families sin actualizar QuizDynamicBackground.
4. DeepSeek es el único AI provider. No reintroducir otros.
5. Todo quiz nuevo debe pasar por validación Zod.
6. Covers stock requieren atribución en el manifiesto.
