# Publicar un lote editorial en producción

Runbook para llevar un lote ya mergeado en `main` hasta la base de producción
y verificar que quedó publicado. El pipeline que genera el SQL está descrito
en [`contenido.md`](./contenido.md) y en [`scripts/seed/README.md`](../scripts/seed/README.md);
este documento empieza donde aquel termina.

> **Quién ejecuta**: la importación a producción la decide y la ejecuta Diego.
> Este runbook es la receta exacta, no una autorización: ninguna sesión de
> agente corre estos comandos contra el VPS.

Convenciones: `<lote>` es el identificador del lote (por ejemplo `2026bg`), el
SQL versionado es `supabase/seed/editorial-seed-<lote>.sql` y el JSON fuente es
`scripts/seed/editorial-seed-<lote>.json`.

## Antes de importar

1. El PR del lote está **mergeado en `main`**. No se importa desde una rama.
2. Sincroniza el checkout local:

   ```bash
   git switch main && git pull --rebase
   ```

3. Si `package-lock.json` cambió desde la última instalación:

   ```bash
   npm ci
   ```

4. Anota qué lote se va a importar: el archivo
   `supabase/seed/editorial-seed-<lote>.sql` debe existir en `main` y su
   cabecera indica que es idempotente (`on conflict (slug) do nothing`).

## Verificación previa (en local, sin escribir nada)

El emisor valida al generar; al correrlo **sin `--write`** solo imprime a
stdout y falla si el lote está roto:

```bash
node scripts/seed/emit-editorial-seed.mjs --input scripts/seed/editorial-seed-<lote>.json > /dev/null
```

Cada lote lleva su test de contrato en `tests/`:

```bash
npx vitest run tests/editorial-seed-<lote>.test.ts
```

Si alguno de los dos falla, el lote no se importa: se arregla el JSON y se
reemite el SQL en un PR nuevo.

## Importación (en el VPS)

En producción el checkout del repo vive en `~/quizverse/app-src` y la base es
el contenedor `supabase-db`. Como el `.sql` está versionado, no hay que copiar
nada a mano: basta actualizar el checkout.

```bash
cd ~/quizverse/app-src
git switch main && git pull --rebase
```

1. Cuenta las filas del lote **antes** (los slugs del lote comparten los
   prefijos `en-`/`es-`; para contar solo las del lote usa la lista de slugs
   del propio SQL):

   ```bash
   grep -oE "'(en|es)-[a-z0-9-]+'" supabase/seed/editorial-seed-<lote>.sql | sort -u
   docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
     "select count(*) from public.quizzes where slug like 'en-%' or slug like 'es-%';"
   ```

2. Aplica el SQL con el comando de su propia cabecera (el archivo envuelve todo
   en `begin;` … `commit;`, así que o entra completo o no entra):

   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
     < supabase/seed/editorial-seed-<lote>.sql
   ```

   Salida esperada: `BEGIN`, un `INSERT 0 <n>` por bloque y `COMMIT`. Cualquier
   `ERROR` o `ROLLBACK` aborta: revisa el mensaje antes de reintentar. Como es
   idempotente, reintentar es seguro.

3. Cuenta **después** y comprueba que subió en el número de quizzes del lote
   (pares en/es: suele ser el doble de ítems):

   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
     "select count(*) from public.quizzes where slug in ('<slug-1>', '<slug-2>', …);"
   ```

## Después de importar

1. Abre una ficha nueva y comprueba `<title>` y el JSON-LD del quiz:

   ```bash
   curl -s https://quizverse.org/es/quiz/<slug-es> | grep -o '<title>[^<]*</title>'
   curl -s https://quizverse.org/es/quiz/<slug-es> | grep -o 'application/ld+json' | head -1
   ```

2. El sitemap se regenera solo; comprueba que sigue sirviéndose y anota el
   total de URLs (debe crecer en el número de quizzes importados):

   ```bash
   curl -s https://quizverse.org/sitemap.xml | grep -c '<loc>'
   ```

3. Avisa a Bing/Yandex/Seznam/Naver de las URLs nuevas:

   ```bash
   npm run seo:indexnow
   ```

## Reversión

Solo si el lote salió mal. Borrar un quiz **también borra en cascada** sus
sesiones de juego, likes, reportes y comentarios (`ON DELETE CASCADE` en
`game_sessions`, `likes`, `quiz_reports`, `quiz_comments`). Comprueba primero
qué se va a borrar:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "select slug, title from public.quizzes where slug in ('<slug-1>', '<slug-2>', …);"
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "delete from public.quizzes where slug in ('<slug-1>', '<slug-2>', …);"
```

El borrado no toca el repo: después hay que revertir el PR del lote en `main`
para que el SQL no se reimporte en la siguiente corrida.

## Qué NO se hace

- **No tocar `deploy/`** ni la infraestructura del VPS: el deploy de la app es
  cosa del dueño; este runbook solo inserta filas en `public.quizzes`.
- **No crear ni editar migraciones** para publicar contenido: los lotes son
  `INSERT`s idempotentes, no cambios de esquema.
- **No importar desde una rama sin mergear**: si el lote no está en `main`, el
  checkout del VPS no lo tiene y el PR sigue abierto a cambios.
- **No ejecutar la importación desde una sesión de agente**: los comandos
  `docker exec … psql` están aquí como referencia para Diego.
