# Plan: Migrar AI Generation a DeepSeek + Limpieza

## Resumen

Reemplazar Groq (runtime) y OpenRouter (seed pipeline) por DeepSeek como único provider AI. Eliminar todo código muerto, referencias, y archivos generados obsoletos.

---

## Archivos a MODIFICAR

### 1. `src/lib/quiz/generator.ts`
- `GROQ_API_URL` → `DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'`
- `MODEL` → `'deepseek-chat'`
- Comentario JSDoc: "Groq API" → "DeepSeek API", "Llama 3.3 70B" → "deepseek-chat"
- `estimateGenerationCost()`: `0.64` → `0.28` (DeepSeek output pricing)
- `generateQuizWithAI()` usa `fetch(DEEPSEEK_API_URL, ...)` — solo cambia URL

### 2. `src/app/api/quiz/generate/route.ts`
- `GROQ_API_KEY` → `DEEPSEEK_API_KEY` (check y pasaje al generator)
- Mensaje de error: `'Missing GROQ_API_KEY'` → `'Missing DEEPSEEK_API_KEY'`

### 3. `scripts/generate-trending-seed.mjs`
- `baseURL` → `'https://api.deepseek.com/v1'`
- `MODEL` default → `'deepseek-chat'`
- `OPENROUTER_API_KEY` → `DEEPSEEK_API_KEY`
- Eliminar headers OpenRouter (`HTTP-Referer`, `X-Title`)
- `OUTPUT_FILE` → `trending-seed.json`
- `NORMALIZED_FILE` → `trending-seed.normalized.json`

### 4. `scripts/polish-trending-seed.mjs`
- Input path: `trending-seed-openrouter.normalized.json` → `trending-seed.normalized.json`
- Output paths: mismo rename

### 5. `scripts/import-trending-seed-to-supabase.mjs`
- `sourcePath` default: `trending-seed-openrouter.json` → `trending-seed.json`

### 6. `scripts/generate-cover-assets.mjs`
- Input: `trending-seed-openrouter.json` → `trending-seed.json`

### 7. `scripts/hydrate-stock-covers.mjs`
- Input: `trending-seed-openrouter.json` → `trending-seed.json`

### 8. `AGENTS.md`
- Línea AI Generation: `Groq (runtime) + OpenRouter/Qwen` → `DeepSeek (runtime + offline)`
- Tabla Vercel env: reemplazar `GROQ_API_KEY` + `OPENROUTER_API_KEY` → `DEEPSEEK_API_KEY`
- Pipeline step 1: `OpenRouter/Qwen` → `DeepSeek`
- WHAT NOT TO TOUCH: `Groq endpoint` → `DeepSeek endpoint`

### 9. `.env.local`
- Verificar que no tenga `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY` ya está presente

---

## Archivos a BORRAR

| Archivo | Motivo |
|---------|--------|
| `scripts/seed-quizzes.ts` | Redundante con generate-trending-seed.mjs, usa OpenRouter |
| `src/lib/data/quizzes-generated.json` | Output de seed-quizzes.ts, nunca importado |
| `generated/trending-seed-openrouter.json` | Artefacto viejo OpenRouter |
| `generated/trending-seed-openrouter.normalized.json` | Artefacto viejo normalizado |
| `generated/trending-seed-polish-report.json` | Report viejo |
| `generated/trending-seed-report.json` | Report viejo |
| `generated/stock-cover-hydration-report.json` | Report viejo |
| `generated/supabase-import-report.json` | Report viejo |
| `generated/cover-assets-report.json` | Report viejo (si existe) |
| `generated/trending-seed-errors.log` | Log viejo (si existe) |

---

## Archivo NUEVO

### `PROXIMOS_PASOS.md`
Documento en español con:
1. Checklist de verificación post-migración
2. Cómo regenerar el seed pipeline con DeepSeek
3. Comparativa de costos (Groq/OpenRouter vs DeepSeek)
4. Limitaciones conocidas de deepseek-chat
5. Próximas features (deepseek-reasoner, fine-tuning, etc.)

---

## Verificación

```bash
npm run typecheck   # Debe pasar limpio
npm run lint        # Debe pasar limpio
npm run test        # 65 tests pasando
npm run build       # Build de producción exitoso
```
