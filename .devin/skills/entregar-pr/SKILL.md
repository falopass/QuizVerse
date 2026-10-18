---
name: entregar-pr
description: Sube el trabajo de QuizVerse en una rama propia y abre o actualiza su Pull Request sin tocar main. Úsala al cerrar cada bloque de trabajo.
---

# Entregar un cambio por PR

1. Rama propia: si estás en `main`, `git switch -c tipo/nombre-corto` (`feat/`, `fix/`, `docs/`, `seo/`).
2. Commit primero: `git add` de los archivos de tu encargo (revisa `git status`; nada de `.env*` ni `generated/` editado a mano) y `git commit` en español con Conventional Commits.
3. Con el árbol limpio: `git fetch origin && git rebase origin/main`. Si hay conflictos, resuélvelos, `git rebase --continue` y vuelve a verificar con la skill `verificar`.
4. Subir: `git push -u origin HEAD`. Si la rama ya estaba subida y la rebasaste: `git push --force-with-lease`.
5. PR: escribe el cuerpo en un archivo temporal fuera del repo y úsalo con `gh pr create --base main --title "<tipo>: <resumen>" --body-file <archivo>` (o `gh pr edit --body-file <archivo>` si el PR ya existe). No uses `--fill`, porque arma el cuerpo con los commits y deja fuera lo que importa. El cuerpo lleva:
   - Qué cambia y por qué.
   - Verificación: comandos corridos y resultado; lo no verificado, dicho como tal.
   - Impacto en SEO (`hreflang`, `canonical`, `noindex`, sitemap) o en puntuación, si aplica.
6. Espera el CI con `gh pr checks --watch` y revisa la preview de Vercel.
7. No mergees y no ejecutes `gh pr merge`: el merge lo decide el dueño.

Cierra tu respuesta con el enlace del PR y una línea `RESULTADO:`.
