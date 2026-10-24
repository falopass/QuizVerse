# REVIEW.md — QuizVerse

Instrucciones para el revisor automático (Devin Review). Responde en español.

## Contexto
App de quizzes con Next.js (App Router), rutas bilingües `/en` `/es`, Supabase y generación
con IA en `src/app/api`. La taxonomía y el contenido son el activo del producto.

## Revisa con rigor
- Paridad bilingüe: cambios en una ruta deben reflejarse en el otro locale o ser intencionales.
- Rutas de IA (`/api`): valida outputs del modelo, no rutear secretos ni PII, costos controlados.
- SEO: metadata, canonical y sitemap en páginas públicas; quizzes nuevos indexables.
- Datos: el seed y los imports a Supabase no deben perder ni duplicar contenido.

## Ignora
- Assets generados (covers, procedural): no revisar su contenido, solo su pipeline.
- Detalles visuales menores fuera del diff.
