# Pipeline de contenido

Cómo entra un quiz al catálogo de QuizVerse: reglas editoriales, lotes,
validaciones y el paso que solo puede dar Diego (importar a producción).

Los comandos detallados y las salidas de cada script están en
[`scripts/seed/README.md`](../scripts/seed/README.md); este documento define las
reglas y el orden del pipeline, sin duplicar esa referencia. La sección
«Contenido y seeds» de [`AGENTS.md`](../AGENTS.md) resume el mismo contrato.

## Anatomía de un quiz

- **8 preguntas** por quiz, **4 opciones** por pregunta.
- `quiz_type` es `trivia` o `personality`:
  - En `trivia`, **exactamente una opción** tiene `is_correct: true`.
  - En `personality` no hay clave de respuestas: las opciones llevan tags.
- `description`: 80 a 158 caracteres (la metadata de SEO la recorta a ~158).
- `slug`: ASCII en minúsculas (`[a-z0-9-]`), con prefijo del idioma: `en-` o
  `es-`.
- `language`: `en` o `es`, coherente con el prefijo del slug.
- `category`: una de las 16 categorías existentes (ver la tabla en el emisor o
  en `AGENTS.md`).
- Cada pregunta puede llevar `explanation`, que se muestra al revisar la
  partida.

Hecho estable: la respuesta correcta no cambia con el tiempo (fechas,
capitales, reglas de un deporte, canon de una franquicia). Si una respuesta
depende de «quién es el campeón actual» o de una temporada en curso, no va en un
seed editorial.

## Reglas de título

- 30 a 65 caracteres.
- La franquicia o el tema va al inicio: «World History Trivia: …», no
  «Trivia: …».
- Gancho concreto: qué va a encontrar quien juega («8 Dates That Changed
  Everything»), no una etiqueta genérica.
- Sin fechas que caducan («Best of 2026») ni plantillas tipo «Fan Trivia
  Challenge» / «Test Your Knowledge».

## Añadir un lote

1. Crea o edita el JSON del lote (el editorial vive en
   `scripts/seed/editorial-seed.json`; otro lote puede venir en su propio
   archivo con la misma forma `{ "quizzes": [...] }`).
2. Emite el SQL:

   ```bash
   node scripts/seed/emit-editorial-seed.mjs --input <json> --out <sql> --write
   ```

   Sin `--input` usa `scripts/seed/editorial-seed.json`; sin `--out` escribe en
   `generated/audit/editorial-seed.sql`. Para dejar copia versionada usa
   `--out supabase/seed/<nombre>.sql`.

El emisor valida antes de escribir y **se niega a emitir** cuando:

- un slug se repite o no empieza con el prefijo de su idioma,
- una pregunta de trivia no tiene exactamente una opción correcta,
- una pregunta tiene menos de dos opciones o ids de opción duplicados,
- la categoría no existe,
- la descripción es más corta de 40 caracteres,
- el quiz tiene menos de 5 preguntas.

Un lote que falla validación nunca llega a la base. El `INSERT` resultante es
`ON CONFLICT (slug) DO NOTHING`: re-ejecutarlo es seguro.

## Auditoría

`npm run seed:audit` corre `scripts/seed/audit-content.mjs` sobre el **export de
la base**, no sobre el seed: audita lo publicado. El export se regenera en el
VPS:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -t -A \
  -f supabase/seed/audit-export.sql > generated/audit/quizzes-audit-export.json
```

Bloquea (exit 1): preguntas de trivia sin exactamente una respuesta correcta,
opciones vacías, quizzes sin preguntas y slugs duplicados. Reporta como
advertencias descripciones delgadas, quizzes cortos y portadas faltantes, y
deja el resumen en `generated/audit/content-audit.json`.

## Categorización

`npm run seed:categorize` reclasifica el catálogo por tema con una tabla de
reglas ordenada y emite `generated/audit/category-report.json`; con
`--write-sql` produce los `UPDATE` idempotentes. Requiere el export
`generated/audit/quizzes-export.json`, generado con la consulta que está en
`scripts/seed/README.md`.

## El límite

El trabajo del agente termina con el SQL listo y el PR abierto. **La
importación a la base de producción la hace Diego.** Ningún script debe
escribir en Supabase producción desde una sesión de agente: los comandos
`docker exec … psql` de este documento se citan como referencia para el dueño,
no para ejecutarlos aquí.
