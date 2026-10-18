-- Content audit export for scripts/seed/audit-content.mjs
--
-- Run on the VPS:
--   docker exec -i supabase-db psql -U postgres -d postgres -t -A \
--     -f supabase/seed/audit-export.sql > generated/audit/quizzes-audit-export.json
--
-- Produces a single JSON array with everything the audit needs: taxonomy,
-- question counts, answer-key integrity and cover coverage.

select coalesce(
  json_agg(row_to_json(row) order by row.slug),
  '[]'::json
)::text
from (
  select
    q.id,
    q.slug,
    q.title,
    q.language,
    q.quiz_type,
    q.difficulty,
    q.status,
    c.slug as category,
    coalesce(length(q.description), 0) as description_length,
    coalesce(jsonb_array_length(q.questions), 0) as question_count,
    -- A trivia question is valid only with exactly one correct option.
    -- Personality questions have no answer key by design, hence the filter.
    coalesce((
      select count(*)
      from jsonb_array_elements(q.questions) as question
      where q.quiz_type = 'trivia'
        and (
          select count(*)
          from jsonb_array_elements(question -> 'options') as option
          where (option ->> 'is_correct')::boolean is true
        ) <> 1
    ), 0) as trivia_questions_without_single_answer,
    -- Options with no text at all.
    coalesce((
      select count(*)
      from jsonb_array_elements(q.questions) as question,
           jsonb_array_elements(question -> 'options') as option
      where coalesce(trim(option ->> 'text'), '') = ''
    ), 0) as empty_options,
    (q.cover_image_url is not null) as has_cover,
    q.plays_count,
    q.published_at
  from public.quizzes q
  left join public.categories c on c.id = q.category_id
  where q.status = 'published'
) as row;
