'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOwnDraftContent, updateQuiz } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { localizeCategory } from '@/lib/i18n/catalog';
import { validateQuiz } from '@/lib/quiz/validator';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { ActionErrorCode } from '@/lib/actions/types';
import type { Category, PersonalityResult, Question } from '@/types/quiz';
import type { Difficulty, QuizStatus, QuizType } from '@/types/database';

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
    minutesError: 'Los minutos estimados deben ser un número de al menos 1.',
    fixedType: 'Formato',
    fixedLanguage: 'Idioma',
    trivia: 'Trivia',
    personality: 'Personalidad',
    poll: 'Encuesta',
    submit: 'Guardar cambios',
    submitting: 'Guardando…',
    cancel: 'Cancelar',
    genericError: 'No pudimos guardar los cambios ahora mismo.',
    rulesTitle: 'Qué puedes editar y qué vuelve a moderación',
    rulesBody:
      'Puedes ajustar título, descripción, categoría, dificultad, etiquetas y duración mientras no esté publicado. Las preguntas y resultados solo se editan en borradores propios. Un quiz publicado ya no se edita directamente: cualquier cambio requiere nueva revisión.',
    loadDraftQuestions: 'Editar preguntas del borrador',
    loadingDraftQuestions: 'Cargando preguntas del borrador…',
    draftQuestionsHeading: 'Preguntas del borrador',
    draftQuestionsHint:
      'Los cambios de preguntas se validan completos antes de guardar y actualizan el conteo automáticamente.',
    addQuestion: 'Añadir pregunta',
    question: 'Pregunta',
    option: 'Opción',
    correct: 'Correcta',
    markCorrect: 'Marcar correcta',
    explanation: 'Explicación opcional',
    remove: 'Eliminar',
    outcomes: 'Resultados de personalidad',
    outcome: 'Resultado',
    outcomeTitle: 'Título del resultado',
    outcomeDescription: 'Descripción del resultado',
    outcomeTag: 'Tag de personalidad',
    optionTags: 'Tags de resultado (separados por comas)',
    notEditablePending:
      'Este quiz está en revisión. Retíralo a borrador desde «Mis quizzes» para editar sus preguntas.',
    notEditablePublished:
      'Un quiz publicado no permite editar preguntas: los cambios deben pasar por moderación.',
    notEditableOther:
      'Las preguntas solo se pueden editar mientras el quiz esté en estado borrador.',
    loadDraftError: 'No pudimos cargar las preguntas del borrador ahora mismo.',
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
    minutesError: 'Estimated minutes must be a number of at least 1.',
    fixedType: 'Format',
    fixedLanguage: 'Language',
    trivia: 'Trivia',
    personality: 'Personality',
    poll: 'Poll',
    submit: 'Save changes',
    submitting: 'Saving…',
    cancel: 'Cancel',
    genericError: 'We could not save the changes right now.',
    rulesTitle: 'What you can edit and what requires moderation',
    rulesBody:
      'You can update title, description, category, difficulty, tags and duration while the quiz is not published. Questions and outcomes can only be edited on your own drafts. Published quizzes cannot be edited directly: changes go through review again.',
    loadDraftQuestions: 'Edit draft questions',
    loadingDraftQuestions: 'Loading draft questions…',
    draftQuestionsHeading: 'Draft questions',
    draftQuestionsHint:
      'Question edits run full validation before saving and recalculate the question count automatically.',
    addQuestion: 'Add question',
    question: 'Question',
    option: 'Option',
    correct: 'Correct',
    markCorrect: 'Mark correct',
    explanation: 'Optional explanation',
    remove: 'Remove',
    outcomes: 'Personality outcomes',
    outcome: 'Outcome',
    outcomeTitle: 'Outcome title',
    outcomeDescription: 'Outcome description',
    outcomeTag: 'Personality tag',
    optionTags: 'Outcome tags (comma separated)',
    notEditablePending:
      'This quiz is pending review. Withdraw it to draft from "My quizzes" to edit its questions.',
    notEditablePublished:
      'Published quizzes cannot have their questions edited: changes go through moderation again.',
    notEditableOther: 'Questions can only be edited while the quiz is in draft status.',
    loadDraftError: 'We could not load the draft questions right now.',
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
  conflict: {
    es: 'Un quiz publicado ya no se puede editar: los cambios vuelven a revisión.',
    en: 'A published quiz can no longer be edited: changes go through review again.',
  },
};

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function emptyDraftQuestion(type: QuizType): Question {
  return {
    id: `q-${crypto.randomUUID().slice(0, 8)}`,
    question: '',
    options: Array.from({ length: 4 }, (_, index) => ({
      id: `o-${crypto.randomUUID().slice(0, 8)}`,
      text: '',
      is_correct: type === 'trivia' && index === 0,
      ...(type === 'personality' ? { personality_tags: [] } : {}),
    })),
    explanation: '',
  };
}

const TYPE_LABEL: Record<QuizType, keyof (typeof COPY)['es']> = {
  trivia: 'trivia',
  personality: 'personality',
  poll: 'poll',
};

const FIELD_CLASS =
  'border-border-subtle bg-bg-secondary text-text-primary placeholder:text-text-muted focus-visible:border-accent-primary focus-visible:ring-accent-primary w-full rounded-[4px] border px-4 py-3 text-sm focus-visible:ring-2 focus-visible:outline-none';

function lockedQuestionsCopy(status: QuizStatus, copy: (typeof COPY)[Locale]): string {
  if (status === 'pending') return copy.notEditablePending;
  if (status === 'published') return copy.notEditablePublished;
  return copy.notEditableOther;
}

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

  const [draftQuestions, setDraftQuestions] = useState<Question[] | null>(null);
  const [draftResults, setDraftResults] = useState<PersonalityResult[] | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [draftStatusNotice, setDraftStatusNotice] = useState<string | null>(null);

  const loadDraftEditor = async () => {
    if (typeof getOwnDraftContent !== 'function') return;
    setIsLoadingDraft(true);
    setDraftStatusNotice(null);
    setErrorMessage(null);
    try {
      const response = await getOwnDraftContent(quiz.id);
      if (!response.success) {
        setErrorMessage(ERROR_LABEL[response.code]?.[es ? 'es' : 'en'] ?? copy.loadDraftError);
        return;
      }
      if (!response.editable) {
        setDraftStatusNotice(lockedQuestionsCopy(response.status, copy));
        return;
      }
      setDraftQuestions(response.questions);
      setDraftResults(response.results);
    } catch {
      setErrorMessage(copy.loadDraftError);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(minutes) || minutes < 1) {
      setErrorMessage(copy.minutesError);
      return;
    }

    const basePayload = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId || null,
      difficulty,
      tags: parseTags(tags),
      estimated_minutes: minutes,
    };

    if (draftQuestions !== null) {
      const sanitizedQuestions = draftQuestions.map((q) => ({
        ...q,
        question: q.question.trim(),
        explanation: q.explanation?.trim() || null,
        options: q.options.map((o) => ({
          ...o,
          text: o.text.trim(),
        })),
      }));
      const sanitizedResults =
        quiz.quiz_type === 'personality' && draftResults
          ? draftResults.map((r) => ({
              ...r,
              title: r.title.trim(),
              description: r.description.trim(),
              personality_tag: r.personality_tag?.trim() || null,
            }))
          : undefined;

      const validation = validateQuiz(
        {
          ...basePayload,
          quiz_type: quiz.quiz_type,
          language: quiz.language,
          questions: sanitizedQuestions,
          results: sanitizedResults,
        },
        locale
      );
      if (!validation.valid) {
        setErrorMessage(validation.errors.join(' · '));
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const result = await updateQuiz(quiz.id, {
          ...basePayload,
          questions: sanitizedQuestions,
          ...(sanitizedResults !== undefined ? { results: sanitizedResults } : {}),
        });
        if (!result.success) {
          setErrorMessage(
            result.code === 'invalid_input'
              ? result.error
              : (ERROR_LABEL[result.code]?.[es ? 'es' : 'en'] ?? copy.genericError)
          );
          return;
        }
        router.push(localizeHref(locale, '/my-quizzes'));
        router.refresh();
      } catch {
        setErrorMessage(copy.genericError);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await updateQuiz(quiz.id, basePayload);
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
      <div className="border-border-subtle bg-bg-secondary mb-6 rounded-[4px] border p-4">
        <p className="text-text-primary text-sm font-semibold">{copy.rulesTitle}</p>
        <p className="text-text-secondary mt-1 text-xs leading-5">{copy.rulesBody}</p>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="border-error/40 bg-error/10 text-error mb-6 rounded-[4px] border px-4 py-3 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label
            htmlFor="quiz-edit-title"
            className="text-text-secondary mb-1 block text-xs font-semibold"
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
            className="text-text-secondary mb-1 block text-xs font-semibold"
          >
            {copy.category}
          </label>
          <select
            id="quiz-edit-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${FIELD_CLASS} h-11`}
          >
            <option value="">{copy.categoryPlaceholder}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {localizeCategory(category, locale)?.name ?? category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="quiz-edit-description"
            className="text-text-secondary mb-1 block text-xs font-semibold"
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
            className="text-text-secondary mb-1 block text-xs font-semibold"
          >
            {copy.difficulty}
          </label>
          <select
            id="quiz-edit-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className={`${FIELD_CLASS} h-11`}
          >
            <option value="easy">{copy.easy}</option>
            <option value="medium">{copy.medium}</option>
            <option value="hard">{copy.hard}</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="quiz-edit-minutes"
            className="text-text-secondary mb-1 block text-xs font-semibold"
          >
            {copy.minutes}
          </label>
          <Input
            id="quiz-edit-minutes"
            type="number"
            required
            min={1}
            value={Number.isFinite(minutes) ? minutes : ''}
            onChange={(e) => setMinutes(e.target.valueAsNumber)}
          />
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="quiz-edit-tags"
            className="text-text-secondary mb-1 block text-xs font-semibold"
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

      {quiz.quiz_type !== 'poll' ? (
        <div className="border-border-subtle mt-8 border-t pt-6">
          {draftQuestions === null ? (
            <div className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                isLoading={isLoadingDraft}
                disabled={isLoadingDraft}
                onClick={loadDraftEditor}
              >
                {isLoadingDraft ? copy.loadingDraftQuestions : copy.loadDraftQuestions}
              </Button>
              {draftStatusNotice ? (
                <p
                  role="status"
                  className="border-warning/40 bg-warning/10 text-warning rounded-[4px] border px-4 py-3 text-sm"
                >
                  {draftStatusNotice}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-text-primary text-lg font-semibold">
                    {copy.draftQuestionsHeading} ({draftQuestions.length})
                  </h2>
                  <p className="text-text-secondary mt-1 text-xs">{copy.draftQuestionsHint}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={draftQuestions.length >= 20}
                  onClick={() =>
                    setDraftQuestions((current) => [
                      ...(current ?? []),
                      emptyDraftQuestion(quiz.quiz_type),
                    ])
                  }
                >
                  {copy.addQuestion}
                </Button>
              </div>
              <div className="space-y-4">
                {draftQuestions.map((item, qIndex) => (
                  <article
                    key={item.id}
                    className="border-border-subtle bg-bg-tertiary rounded-[4px] border p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <label
                        htmlFor={`draft-edit-q-${qIndex}`}
                        className="text-text-primary text-sm font-semibold"
                      >
                        {copy.question} {qIndex + 1}
                      </label>
                      <button
                        type="button"
                        disabled={draftQuestions.length <= 1}
                        onClick={() =>
                          setDraftQuestions((current) =>
                            (current ?? []).filter((_, idx) => idx !== qIndex)
                          )
                        }
                        className="border-error/40 bg-error/15 text-error focus-visible:outline-accent-primary rounded-full border px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45"
                      >
                        {copy.remove}
                      </button>
                    </div>
                    <Input
                      id={`draft-edit-q-${qIndex}`}
                      value={item.question}
                      maxLength={1000}
                      onChange={(e) =>
                        setDraftQuestions((current) =>
                          (current ?? []).map((q, idx) =>
                            idx === qIndex ? { ...q, question: e.target.value } : q
                          )
                        )
                      }
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {item.options.map((option, oIndex) => (
                        <div
                          key={option.id}
                          className={cn(
                            'rounded-[4px] border p-3',
                            option.is_correct
                              ? 'border-accent-primary/50 bg-accent-primary/10'
                              : 'border-border-subtle bg-bg-secondary'
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <label
                              htmlFor={`draft-edit-q-${qIndex}-o-${oIndex}`}
                              className="text-text-secondary text-xs font-semibold"
                            >
                              {copy.option} {String.fromCharCode(65 + oIndex)}
                            </label>
                            {quiz.quiz_type === 'trivia' ? (
                              <button
                                type="button"
                                aria-pressed={Boolean(option.is_correct)}
                                onClick={() =>
                                  setDraftQuestions((current) =>
                                    (current ?? []).map((q, idx) =>
                                      idx !== qIndex
                                        ? q
                                        : {
                                            ...q,
                                            options: q.options.map((opt, optIdx) => ({
                                              ...opt,
                                              is_correct: optIdx === oIndex,
                                            })),
                                          }
                                    )
                                  )
                                }
                                className={cn(
                                  'focus-visible:outline-accent-primary rounded-full px-3 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
                                  option.is_correct
                                    ? 'bg-accent-primary text-bg-primary'
                                    : 'border-border-subtle bg-bg-tertiary text-text-primary border'
                                )}
                              >
                                {option.is_correct ? copy.correct : copy.markCorrect}
                              </button>
                            ) : null}
                          </div>
                          <Input
                            id={`draft-edit-q-${qIndex}-o-${oIndex}`}
                            value={option.text}
                            maxLength={500}
                            onChange={(e) =>
                              setDraftQuestions((current) =>
                                (current ?? []).map((q, idx) =>
                                  idx !== qIndex
                                    ? q
                                    : {
                                        ...q,
                                        options: q.options.map((opt, optIdx) =>
                                          optIdx === oIndex ? { ...opt, text: e.target.value } : opt
                                        ),
                                      }
                                )
                              )
                            }
                          />
                          {quiz.quiz_type === 'personality' ? (
                            <div className="mt-2">
                              <label
                                htmlFor={`draft-edit-q-${qIndex}-o-${oIndex}-tags`}
                                className="text-text-muted mb-1 block text-xs"
                              >
                                {copy.optionTags}
                              </label>
                              <Input
                                id={`draft-edit-q-${qIndex}-o-${oIndex}-tags`}
                                value={(option.personality_tags ?? []).join(', ')}
                                onChange={(e) =>
                                  setDraftQuestions((current) =>
                                    (current ?? []).map((q, idx) =>
                                      idx !== qIndex
                                        ? q
                                        : {
                                            ...q,
                                            options: q.options.map((opt, optIdx) =>
                                              optIdx === oIndex
                                                ? {
                                                    ...opt,
                                                    personality_tags: parseTags(e.target.value),
                                                  }
                                                : opt
                                            ),
                                          }
                                    )
                                  )
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {quiz.quiz_type === 'trivia' ? (
                      <div className="mt-3">
                        <label
                          htmlFor={`draft-edit-q-${qIndex}-explanation`}
                          className="text-text-secondary mb-1 block text-xs font-semibold"
                        >
                          {copy.explanation}
                        </label>
                        <textarea
                          id={`draft-edit-q-${qIndex}-explanation`}
                          rows={2}
                          maxLength={500}
                          value={item.explanation ?? ''}
                          onChange={(e) =>
                            setDraftQuestions((current) =>
                              (current ?? []).map((q, idx) =>
                                idx === qIndex ? { ...q, explanation: e.target.value } : q
                              )
                            )
                          }
                          className={FIELD_CLASS}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {quiz.quiz_type === 'personality' && draftResults ? (
                <div className="space-y-3">
                  <h3 className="text-text-primary text-base font-semibold">{copy.outcomes}</h3>
                  {draftResults.map((outcome, rIndex) => (
                    <article
                      key={outcome.id}
                      className="border-border-subtle bg-bg-tertiary space-y-3 rounded-[4px] border p-4"
                    >
                      <p className="text-text-primary text-sm font-semibold">
                        {copy.outcome} {rIndex + 1}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`draft-edit-r-${rIndex}-title`}
                            className="text-text-secondary mb-1 block text-xs font-semibold"
                          >
                            {copy.outcomeTitle}
                          </label>
                          <Input
                            id={`draft-edit-r-${rIndex}-title`}
                            value={outcome.title}
                            maxLength={100}
                            onChange={(e) =>
                              setDraftResults((current) =>
                                (current ?? []).map((r, idx) =>
                                  idx === rIndex ? { ...r, title: e.target.value } : r
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`draft-edit-r-${rIndex}-tag`}
                            className="text-text-secondary mb-1 block text-xs font-semibold"
                          >
                            {copy.outcomeTag}
                          </label>
                          <Input
                            id={`draft-edit-r-${rIndex}-tag`}
                            value={outcome.personality_tag ?? ''}
                            maxLength={64}
                            onChange={(e) =>
                              setDraftResults((current) =>
                                (current ?? []).map((r, idx) =>
                                  idx === rIndex ? { ...r, personality_tag: e.target.value } : r
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor={`draft-edit-r-${rIndex}-desc`}
                          className="text-text-secondary mb-1 block text-xs font-semibold"
                        >
                          {copy.outcomeDescription}
                        </label>
                        <textarea
                          id={`draft-edit-r-${rIndex}-desc`}
                          rows={2}
                          maxLength={1000}
                          value={outcome.description}
                          onChange={(e) =>
                            setDraftResults((current) =>
                              (current ?? []).map((r, idx) =>
                                idx === rIndex ? { ...r, description: e.target.value } : r
                              )
                            )
                          }
                          className={FIELD_CLASS}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? copy.submitting : copy.submit}
        </Button>
        <Link
          href={localizeHref(locale, '/my-quizzes')}
          className="bg-bg-tertiary text-text-primary hover:bg-bg-secondary border-border-subtle focus-visible:outline-accent-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {copy.cancel}
        </Link>
      </div>
    </form>
  );
}
