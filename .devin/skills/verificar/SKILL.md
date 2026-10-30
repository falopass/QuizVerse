---
name: verificar
description: Verifica un cambio en QuizVerse antes de abrir o actualizar un PR, respetando los límites de RAM. Úsala al terminar una edición en src/, scripts/ o supabase/.
---

# Verificar un cambio en QuizVerse

Verifica una sola vez, al final, desde el agente principal y de a un comando pesado por vez. Los subagentes no corren nada de esto.

1. Mientras iteras: `npx vitest related <archivos tocados> --run`.
2. Antes del commit, en este orden:
   a. `npx prettier --write --ignore-unknown` sobre cada archivo que creaste o tocaste (no hace falta el repo entero; `--ignore-unknown` salta los que prettier no soporta, p. ej. `.sql` de migraciones y seeds).
   b. `npm run format:check` (tiene que pasar; el CI lo corre siempre sobre todo el repo).
   c. `npm run typecheck`, `npm run lint`, `npm test`.
3. `npm run build` lo corre el CI de cada PR (`.github/workflows/ci.yml`) y se puede correr en una sesión Cloud. En la máquina del dueño está bloqueado; no lo esquives con `npx next build`.
4. Reglas que el diff no puede romper (ver `AGENTS.md`):
   - Ningún quiz llega al cliente sin `toClientQuiz()`: `is_correct` vive solo en el servidor.
   - Todo texto público pasa por i18n, con rutas bajo `/[locale]`.
   - Metadata solo con `buildMetadata()`; nada de `canonical` en `src/app/layout.tsx`.
   - Migraciones nuevas, nunca editar una existente.
5. Contenido o seeds: `npm run seed:audit` debe pasar.
6. Revisión visual: la preview de Workers Builds (Cloudflare) del PR, no un dev server local.

En el PR, reporta qué corriste y su resultado. Si algo no lo corriste, dilo; no lo inventes.
