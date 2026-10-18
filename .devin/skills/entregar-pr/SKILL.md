---
name: entregar-pr
description: Sube el trabajo de QuizVerse en una rama propia y abre o actualiza su Pull Request sin tocar main. Úsala al cerrar cada bloque de trabajo.
---

# Entregar un cambio por PR

1. Rama propia: si estás en `main`, `git switch -c tipo/nombre-corto` (`feat/`, `fix/`, `docs/`, `seo/`).
2. Antes de subir: `git fetch origin && git rebase origin/main`. Si hay conflictos, resuélvelos y vuelve a verificar con la skill `verificar`.
3. Commits en español con Conventional Commits.
4. Subir: `git push -u origin HEAD`. Si la rama ya estaba subida y la rebasaste: `git push --force-with-lease`.
5. PR: `gh pr create --base main --fill` (o `gh pr edit` si ya existe). Cuerpo:
   - Qué cambia y por qué.
   - Verificación: comandos corridos y resultado; lo no verificado, dicho como tal.
   - Impacto en SEO (`hreflang`, `canonical`, `noindex`, sitemap) o en puntuación, si aplica.
6. Espera el CI (`gh pr checks`) y revisa la preview de Vercel. No mergees y no ejecutes `gh pr merge`: el merge lo decide el dueño.

Cierra tu respuesta con el enlace del PR y una línea `RESULTADO:`.
