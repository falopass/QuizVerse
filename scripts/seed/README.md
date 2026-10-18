# Seed pipeline

Two pipelines live here. Both are deterministic: the same input always produces
the same SQL, and both validate before touching the database.

## 1. Taxonomy: `categorize-quizzes.mjs`

The catalogue was imported with every quiz under `culture`, leaving 14 of the 16
categories empty. This script maps each quiz to the category its subject belongs
to, with an ordered rule table (franchises → topics → themes → `culture`).

```bash
# 1. Export the catalogue (on the VPS, from ~/quizverse/app-src)
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c "
  select json_agg(json_build_object(
    'id', q.id, 'slug', q.slug, 'title', q.title, 'tags', q.tags,
    'quiz_type', q.quiz_type, 'language', q.language,
    'category', c.slug, 'excerpt', left(coalesce(q.description,''), 160)
  ) order by q.id)
  from public.quizzes q left join public.categories c on c.id = q.category_id;
" > generated/audit/quizzes-export.json

# 2. Classify (report only) or classify + emit SQL
node scripts/seed/categorize-quizzes.mjs
node scripts/seed/categorize-quizzes.mjs --write-sql

# 3. Apply
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < generated/audit/category-assignments.sql
```

Outputs:

- `generated/audit/category-report.json` — counts, samples and the surviving
  empty categories.
- `generated/audit/category-assignments.sql` — idempotent `UPDATE`s guarded by
  `category_id is distinct from …`, so re-running changes nothing.

The `update_category_quiz_count` trigger keeps `categories.quiz_count` in sync.

## 2. Editorial content: `editorial-seed.json` + `emit-editorial-seed.mjs`

Fills the categories the imported catalogue cannot cover — currently history,
geography and sports — with quizzes whose answers are stable, checkable facts
(dates, capitals, sport rules). Nothing is invented per run: the content lives in
`editorial-seed.json` and is reviewed like code.

```bash
node scripts/seed/emit-editorial-seed.mjs --write
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < generated/audit/editorial-seed.sql
```

`emit-editorial-seed.mjs` refuses to emit when:

- a slug repeats or does not start with its language prefix,
- a trivia question does not have exactly one correct option,
- a question has fewer than two options or duplicated option ids,
- the category is not in `categories`,
- a description is shorter than 40 characters.

The insert is `ON CONFLICT (slug) DO NOTHING`, so the seed is safe to re-run.

## 3. Quality gate: `audit-content.mjs`

Reads `supabase/seed/audit-export.sql` output and fails (exit 1) on blocking
problems: missing questions, trivia without a single answer, empty option text,
duplicate slugs.

```bash
docker exec -i supabase-db psql -U postgres -d postgres -t -A \
  -f supabase/seed/audit-export.sql > generated/audit/quizzes-audit-export.json

node scripts/seed/audit-content.mjs
```

Outputs `generated/audit/content-audit.json` with totals per category, language
and type, plus warnings for thin descriptions, short quizzes and missing covers.
