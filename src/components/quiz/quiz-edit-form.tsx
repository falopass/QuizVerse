'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateQuiz } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { ActionErrorCode } from '@/lib/actions/types';
import type { Category } from '@/types/quiz';
import type { Difficulty, QuizType } from '@/types/database';

export interface EditableQuiz {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  quiz_type: QuizType;
  difficulty: Difficulty;
  language: string;
  tags: string[];
  estimated_minutes: number;
}

const COPY = {
  es: {
    title: 'Título',
    description: 'Descripción',
    category: 'Categoría',
    categoryPlaceholder: 'Sin categoría',
    difficulty: 'Dificultad',
    easy: 'Fácil',
    medium: 'Media',
    hard: 'Difícil',
    tags: 'Etiquetas',
    tagsHint: 'Separadas por comas.',
    minutes: 'Minutos estimados',
    fixedType: 'Formato',
    fixedLanguage: 'Idioma',
    trivia: 'Trivia',
    personality: 'Personalidad',
    poll: 'Encuesta',
    submit: 'Guardar cambios',
    submitting: 'Guardando…',
    cancel: 'Cancelar',
    genericError: 'No pudimos guardar los cambios ahora mismo.',
  },
  en: {
    title: 'Title',
    description: 'Description',
    category: 'Category',
    categoryPlaceholder: 'No category',
    difficulty: 'Difficulty',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    tags: 'Tags',
    tagsHint: 'Separated by commas.',
    minutes: 'Estimated minutes',
    fixedType: 'Format',
    fixedLanguage: 'Language',
    trivia: 'Trivia',
    personality: 'Personality',
    poll: 'Poll',
    submit: 'Save changes',
    submitting: 'Saving…',
    cancel: 'Cancel',
    genericError: 'We could not save the changes right now.',
  },
} as const;

/** Server actions reply in English; map the code to the page locale. */
const ERROR_LABEL: Partial<Record<ActionErrorCode, { es: string; en: string }>> = {
  unauthorized: {
    es: 'Inicia sesión de nuevo para guardar.',
    en: 'Sign in again to save.',
  },
  forbidden: {
    es: 'Ese quiz no es tuyo.',
    en: 'That quiz is not yours.',
  },
  not_found: {
    es: 'No encontramos ese quiz.',
    en: 'We could not find that quiz.',
  },
  invalid_input: {
    es: 'Revisa los campos: hay datos que no cuadran.',
    en: 'Check the fields: some values do not look right.',
  },
  rate_limited: {
    es: 'Demasiados intentos. Espera un momento.',
    en: 'Too many attempts. Please wait a moment.',
  },
};

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const TYPE_LABEL: Record<QuizType, keyof (typeof COPY)['es']> = {
  trivia: 'trivia',
  personality: 'personality',
  poll: 'poll',
};

const FIELD_CLASS =
  'border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none';

export function QuizEditForm({
  quiz,
  categories,
  locale,
}: {
  quiz: EditableQuiz;
  categories: Category[];
  locale: Locale;
}) {
  const router = useRouter();
  const copy = COPY[locale];
  const es = locale === 'es';

  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? '');
  const [categoryId, setCategoryId] = useState(quiz.category_id ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(quiz.difficulty);
  const [tags, setTags] = useState(quiz.tags.join(', '));
  const [minutes, setMinutes] = useState(quiz.estimated_minutes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await updateQuiz(quiz.id, {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId || null,
        difficulty,
        tags: parseTags(tags),
        estimated_minutes: Number.isFinite(minutes) ? minutes : undefined,
      });
      if (!result.success) {
        setErrorMessage(ERROR_LABEL[result.code]?.[es ? 'es' : 'en'] ?? copy.genericError);
        return;
      }
      router.push(localizeHref(locale, '/my-quizzes'));
      router.refresh();
    } catch {
      setErrorMessage(copy.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface-panel mt-8 p-6 md:p-8">
      {errorMessage ? (
        <p
          role="alert"
          className="border-error/40 bg-error/10 text-error mb-6 rounded-xl border px-4 py-3 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label
            htmlFor="quiz-edit-title"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.title}
          </label>
          <Input
            id="quiz-edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label
            htmlFor="quiz-edit-category"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.category}
          </label>
          <select
            id="quiz-edit-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${FIELD_CLASS} h-11 rounded-xl`}
          >
            <option value="">{copy.categoryPlaceholder}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="quiz-edit-description"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.description}
          </label>
          <textarea
            id="quiz-edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={300}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="quiz-edit-difficulty"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.difficulty}
          </label>
          <select
            id="quiz-edit-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className={`${FIELD_CLASS} h-11 rounded-xl`}
          >
            <option value="easy">{copy.easy}</option>
            <option value="medium">{copy.medium}</option>
            <option value="hard">{copy.hard}</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="quiz-edit-minutes"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.minutes}
          </label>
          <Input
            id="quiz-edit-minutes"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.valueAsNumber)}
          />
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="quiz-edit-tags"
            className="text-text-secondary mb-1 block text-xs font-semibold tracking-wide uppercase"
          >
            {copy.tags}
          </label>
          <Input
            id="quiz-edit-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            aria-describedby="quiz-edit-tags-hint"
          />
          <p id="quiz-edit-tags-hint" className="text-text-muted mt-1 text-xs">
            {copy.tagsHint}
          </p>
        </div>
        <div className="text-text-secondary flex flex-wrap items-center gap-3 text-sm lg:col-span-2">
          <span>
            {copy.fixedType}:{' '}
            <strong className="text-text-primary">{copy[TYPE_LABEL[quiz.quiz_type]]}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {copy.fixedLanguage}: <strong className="text-text-primary">{quiz.language}</strong>
          </span>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? copy.submitting : copy.submit}
        </Button>
        <Link
          href={localizeHref(locale, '/my-quizzes')}
          className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all duration-200"
        >
          {copy.cancel}
        </Link>
      </div>
    </form>
  );
}
