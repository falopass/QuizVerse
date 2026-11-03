'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createQuiz } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/providers/toast-provider';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { trackEvent } from '@/lib/telemetry/client';
import {
  creatorErrors,
  normalizeCreatorDraft,
  resultGraphValid,
  tagFromTitle,
  validateCreatorDraft,
  type CreatorDraftInput,
  type CreatorError,
  type CreatorErrorTarget,
} from '@/lib/quiz/creator-draft';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, PersonalityResult, Question } from '@/types/quiz';

function errorsFor(errors: CreatorError[], target: CreatorErrorTarget): string[] {
  return errors
    .filter(({ target: candidate }) => {
      if (candidate.kind !== target.kind) return false;
      if (candidate.kind === 'question' && target.kind === 'question')
        return candidate.index === target.index;
      if (candidate.kind === 'result' && target.kind === 'result')
        return candidate.index === target.index;
      return true;
    })
    .map(({ message }) => message);
}

export function QuizCreatorForm({
  categories,
  locale = 'en',
}: {
  categories: Category[];
  locale?: Locale;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const copy =
    locale === 'es'
      ? {
          questionsError: 'Completa al menos 3 preguntas completas.',
          success: 'Quiz enviado a revisión.',
          draftSuccess: 'Borrador guardado.',
          genericError: 'No pudimos crear el quiz ahora mismo.',
          eyebrow: 'Compositor manual',
          heading: 'Construye un quiz que se lea como una pieza terminada.',
          title: 'Título',
          category: 'Categoría',
          categoryPlaceholder: 'Elige una categoría',
          description: 'Descripción',
          titlePlaceholder: '¿Qué ciudad encaja con tu estilo de vida?',
          descriptionPlaceholder: 'Presenta la premisa y la recompensa en un párrafo corto.',
          format: 'Formato',
          difficulty: 'Dificultad',
          trivia: 'Trivia',
          personality: 'Personalidad',
          easy: 'Fácil',
          medium: 'Media',
          hard: 'Difícil',
          questions: 'Preguntas',
          questionsHeading: 'Escribe la secuencia jugable.',
          addQuestion: 'Añadir pregunta',
          question: 'Pregunta',
          up: 'Subir',
          down: 'Bajar',
          remove: 'Eliminar',
          markCorrect: 'Marcar correcta',
          correct: 'Correcta',
          option: 'Opción',
          questionPrompt: 'Escribe el prompt exacto que verá la persona.',
          answerCopy: 'Texto de respuesta',
          explanation: 'Explicación opcional o nota de revelación.',
          explanationLabel: 'Explicación',
          outcomes: 'Resultados',
          outcomesHeading: 'Define los finales.',
          resultsRange: 'Define entre 2 y 6 resultados.',
          assignHint: 'Cada opción suma al resultado que elijas.',
          addOutcome: 'Añadir resultado',
          outcome: 'Resultado',
          outcomeTitle: 'La Curadora',
          outcomeDescription: 'Describe el arquetipo y por qué la persona cae aquí.',
          outcomeDescriptionLabel: 'Descripción del resultado',
          personalityTag: 'Tag de personalidad',
          tagHint: 'Se genera desde el título; puedes editarlo.',
          tagPlaceholder: 'la-curadora',
          assign: 'Suma a',
          chooseResult: 'Elige un resultado',
          imageUrl: 'URL de imagen opcional',
          min: 'Mín',
          max: 'Máx',
          saveDraft: 'Guardar borrador',
          savingDraft: 'Guardando borrador...',
          submitReview: 'Enviar a revisión',
          submittingReview: 'Enviando a revisión...',
          fixErrors: 'Revisa estos puntos antes de guardar.',
          previewEyebrow: 'Vista del estudio',
          futureCover: 'Tu próximo gran titular',
          futureSummary: 'Tu resumen aparecerá aquí cuando definas el gancho.',
          headline: 'Titular',
          playableQuestions: 'Preguntas jugables',
          drafted: 'en borrador',
          outcomesLabel: 'Resultados',
          notRequired: 'No hace falta',
          language: 'Idioma',
          spanish: 'Español',
          english: 'Inglés',
          questionsCount: 'preguntas',
        }
      : {
          questionsError: 'Complete at least 3 full questions.',
          success: 'Quiz sent to review.',
          draftSuccess: 'Draft saved.',
          genericError: 'We could not create the quiz right now.',
          eyebrow: 'Manual Composer',
          heading: 'Build a quiz that reads like a finished feature.',
          title: 'Title',
          category: 'Category',
          categoryPlaceholder: 'Choose a category',
          description: 'Description',
          titlePlaceholder: 'Which city secretly matches your lifestyle?',
          descriptionPlaceholder: 'Frame the premise and payoff in one short paragraph.',
          format: 'Format',
          difficulty: 'Difficulty',
          trivia: 'Trivia',
          personality: 'Personality',
          easy: 'Easy',
          medium: 'Medium',
          hard: 'Hard',
          questions: 'Questions',
          questionsHeading: 'Write the playable sequence.',
          addQuestion: 'Add question',
          question: 'Question',
          up: 'Up',
          down: 'Down',
          remove: 'Remove',
          markCorrect: 'Mark correct',
          correct: 'Correct',
          option: 'Option',
          questionPrompt: 'Write the exact prompt the player will see.',
          answerCopy: 'Answer copy',
          explanation: 'Optional explanation or reveal note.',
          explanationLabel: 'Explanation',
          outcomes: 'Outcomes',
          outcomesHeading: 'Define the endings.',
          resultsRange: 'Define between 2 and 6 outcomes.',
          assignHint: 'Each option adds to the outcome you pick.',
          addOutcome: 'Add outcome',
          outcome: 'Outcome',
          outcomeTitle: 'The Curator',
          outcomeDescription: 'Describe the archetype and why the player lands here.',
          outcomeDescriptionLabel: 'Outcome description',
          personalityTag: 'Personality tag',
          tagHint: 'Generated from the title; you can edit it.',
          tagPlaceholder: 'the-curator',
          assign: 'Adds to',
          chooseResult: 'Choose an outcome',
          imageUrl: 'Optional image URL',
          min: 'Min',
          max: 'Max',
          saveDraft: 'Save draft',
          savingDraft: 'Saving draft...',
          submitReview: 'Send to review',
          submittingReview: 'Sending to review...',
          fixErrors: 'Review these points before saving.',
          previewEyebrow: 'Studio Preview',
          futureCover: 'Your future cover line',
          futureSummary: 'Your summary will appear here once you frame the hook.',
          headline: 'Headline',
          playableQuestions: 'Playable questions',
          drafted: 'drafted',
          outcomesLabel: 'Outcomes',
          notRequired: 'Not required',
          language: 'Language',
          spanish: 'Spanish',
          english: 'English',
          questionsCount: 'questions',
        };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<'trivia' | 'personality'>('trivia');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [categoryId, setCategoryId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    question('trivia'),
    question('trivia'),
    question('trivia'),
  ]);
  const [results, setResults] = useState<PersonalityResult[]>([result(), result()]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIntent, setActiveIntent] = useState<'draft' | 'review' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const focusedSubmit = useRef(0);
  // Qué botón disparó el submit: "Guardar borrador" o "Enviar a revisión".
  const intentRef = useRef<'draft' | 'review'>('review');

  const draftInput: CreatorDraftInput = useMemo(
    () => ({
      title,
      description,
      quizType,
      difficulty,
      categoryId,
      language: locale,
      questions,
      results,
      assignments,
    }),
    [assignments, categoryId, description, difficulty, locale, questions, quizType, results, title]
  );
  const validation = useMemo(() => validateCreatorDraft(draftInput, locale), [draftInput, locale]);
  const errors = useMemo(() => creatorErrors(validation.errors), [validation.errors]);
  const visibleErrors = showErrors ? errors : [];
  const titleError = errorsFor(visibleErrors, { kind: 'title' }).join(' ');
  const descriptionError = errorsFor(visibleErrors, { kind: 'description' }).join(' ');
  const formErrors = errorsFor(visibleErrors, { kind: 'form' });

  const checks = useMemo(() => {
    const has = (kind: CreatorErrorTarget['kind']) =>
      errors.some((error) => error.target.kind === kind);
    return {
      title: !has('title'),
      questions: questions.length >= 3 && !has('question'),
      results: resultGraphValid(draftInput),
    };
  }, [draftInput, errors, questions.length]);

  useEffect(() => {
    if (submitCount === 0 || focusedSubmit.current === submitCount) return;
    focusedSubmit.current = submitCount;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('[data-error]');
    target?.focus();
  }, [submitCount, errors]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (questions.length < 3) {
      setShowErrors(true);
      return error(copy.questionsError);
    }
    setShowErrors(true);
    if (!validation.valid) {
      setSubmitCount((count) => count + 1);
      return;
    }
    const intent = intentRef.current;
    setActiveIntent(intent);
    setIsSubmitting(true);
    try {
      await trackEvent({
        name: 'create_start',
        locale,
        quizType,
        source: 'manual_create',
      });
      const response = await createQuiz({ ...normalizeCreatorDraft(draftInput), intent });
      if (!response.success) return error(response.error);
      await trackEvent({
        name: 'create_complete',
        locale,
        quizId: response.quiz.id,
        quizSlug: response.quiz.slug,
        quizType,
        source: 'manual_create',
      });
      success(intent === 'draft' ? copy.draftSuccess : copy.success);
      router.push(localizeHref(locale, `/create/done?id=${encodeURIComponent(response.quiz.id)}`));
    } catch (err) {
      console.error(err);
      error(copy.genericError);
    } finally {
      setIsSubmitting(false);
      setActiveIntent(null);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[1.3fr_0.7fr]"
    >
      <div className="space-y-6">
        <section className="surface-panel p-6">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="text-text-primary mt-3 text-3xl font-semibold tracking-tight">
            {copy.heading}
          </h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field id="creator-title" label={copy.title} error={titleError}>
              {(props) => (
                <Input
                  {...props}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={copy.titlePlaceholder}
                  maxLength={120}
                />
              )}
            </Field>
            <Field id="creator-category" label={copy.category}>
              {(props) => (
                <select
                  {...props}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="border-border-subtle bg-bg-secondary text-text-primary h-11 w-full rounded-xl border px-4 text-sm outline-none"
                >
                  <option value="">{copy.categoryPlaceholder}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field
              id="creator-description"
              label={copy.description}
              error={descriptionError}
              className="lg:col-span-2"
            >
              {(props) => (
                <textarea
                  {...props}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={300}
                  className="border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  placeholder={copy.descriptionPlaceholder}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="surface-panel p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Choice
              id="creator-format"
              label={copy.format}
              value={quizType}
              setValue={(value) => {
                setQuizType(value as 'trivia' | 'personality');
                setQuestions((current) =>
                  current.map((item) => normalize(item, value as 'trivia' | 'personality'))
                );
              }}
              options={[
                ['trivia', copy.trivia],
                ['personality', copy.personality],
              ]}
            />
            <Choice
              id="creator-difficulty"
              label={copy.difficulty}
              value={difficulty}
              setValue={(value) => setDifficulty(value as 'easy' | 'medium' | 'hard')}
              options={[
                ['easy', copy.easy],
                ['medium', copy.medium],
                ['hard', copy.hard],
              ]}
            />
          </div>
        </section>

        <section className="surface-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">{copy.questions}</p>
              <h3 className="text-text-primary mt-2 text-2xl font-semibold">
                {copy.questionsHeading}
              </h3>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQuestions((current) => [...current, question(quizType)])}
            >
              {copy.addQuestion}
            </Button>
          </div>
          <div className="space-y-4">
            {questions.map((item, index) => {
              const itemErrors = errorsFor(visibleErrors, { kind: 'question', index });
              const errorId = `creator-question-${index}-error`;
              const describedBy = itemErrors.length ? errorId : undefined;
              return (
                <article
                  key={item.id}
                  className="border-border-subtle rounded-[28px] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`creator-question-${index}`}
                      className="text-text-primary text-sm font-semibold"
                    >
                      {copy.question} {index + 1}
                    </label>
                    <div className="flex gap-2">
                      <Mini
                        onClick={() => move(setQuestions, questions, index, -1)}
                        disabled={index === 0}
                      >
                        {copy.up}
                      </Mini>
                      <Mini
                        onClick={() => move(setQuestions, questions, index, 1)}
                        disabled={index === questions.length - 1}
                      >
                        {copy.down}
                      </Mini>
                      <Mini
                        tone="danger"
                        onClick={() =>
                          setQuestions((current) => current.filter((_, i) => i !== index))
                        }
                        disabled={questions.length === 1}
                      >
                        {copy.remove}
                      </Mini>
                    </div>
                  </div>
                  {itemErrors.length ? (
                    <ul
                      id={errorId}
                      data-error
                      tabIndex={-1}
                      className="text-error mt-3 list-disc space-y-1 pl-5 text-sm"
                    >
                      {itemErrors.map((message, errorIndex) => (
                        <li key={`${errorIndex}-${message}`}>{message}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-4">
                    <Input
                      id={`creator-question-${index}`}
                      aria-describedby={describedBy}
                      aria-invalid={itemErrors.length && !item.question.trim() ? true : undefined}
                      value={item.question}
                      onChange={(e) =>
                        patchQuestion(setQuestions, index, { question: e.target.value })
                      }
                      placeholder={copy.questionPrompt}
                      maxLength={1000}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {item.options.map((option, optionIndex) => {
                      const optionId = `creator-question-${index}-option-${optionIndex}`;
                      const missingResult =
                        quizType === 'personality' &&
                        !results.some(
                          (result) =>
                            result.id === assignments[option.id] &&
                            Boolean(result.personality_tag?.trim())
                        );
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            'rounded-2xl border p-4',
                            option.is_correct
                              ? 'border-emerald-500/35 bg-emerald-500/8'
                              : 'border-border-subtle bg-bg-secondary/60'
                          )}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <label
                              htmlFor={optionId}
                              className="text-text-muted text-xs font-semibold"
                            >
                              {copy.option} {String.fromCharCode(65 + optionIndex)}
                            </label>
                            {quizType === 'trivia' ? (
                              <button
                                type="button"
                                aria-pressed={Boolean(option.is_correct)}
                                onClick={() =>
                                  setQuestions((current) =>
                                    current.map((q, qIndex) =>
                                      qIndex !== index
                                        ? q
                                        : {
                                            ...q,
                                            options: q.options.map((o, oIndex) => ({
                                              ...o,
                                              is_correct: oIndex === optionIndex,
                                            })),
                                          }
                                    )
                                  )
                                }
                                className={cn(
                                  'rounded-full px-3 py-1 text-xs font-semibold',
                                  option.is_correct
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-text-secondary ring-border-subtle bg-white ring-1'
                                )}
                              >
                                {option.is_correct ? copy.correct : copy.markCorrect}
                              </button>
                            ) : null}
                          </div>
                          <Input
                            id={optionId}
                            aria-describedby={describedBy}
                            aria-invalid={
                              itemErrors.length && !option.text.trim() ? true : undefined
                            }
                            value={option.text}
                            onChange={(e) =>
                              setQuestions((current) =>
                                current.map((q, qIndex) =>
                                  qIndex !== index
                                    ? q
                                    : {
                                        ...q,
                                        options: q.options.map((o, oIndex) =>
                                          oIndex === optionIndex
                                            ? { ...o, text: e.target.value }
                                            : o
                                        ),
                                      }
                                )
                              )
                            }
                            placeholder={copy.answerCopy}
                            maxLength={500}
                          />
                          {quizType === 'personality' ? (
                            <div className="mt-3">
                              <label
                                htmlFor={`${optionId}-result`}
                                className="text-text-secondary mb-1.5 block text-xs font-medium"
                              >
                                {copy.assign}
                              </label>
                              <select
                                id={`${optionId}-result`}
                                value={assignments[option.id] ?? ''}
                                onChange={(e) =>
                                  setAssignments((current) => ({
                                    ...current,
                                    [option.id]: e.target.value,
                                  }))
                                }
                                aria-describedby={describedBy}
                                aria-invalid={showErrors && missingResult ? true : undefined}
                                className="border-border-subtle bg-bg-secondary text-text-primary h-11 w-full rounded-xl border px-4 text-sm outline-none"
                              >
                                <option value="">{copy.chooseResult}</option>
                                {results.map((outcome, outcomeIndex) => (
                                  <option key={outcome.id} value={outcome.id}>
                                    {outcome.title.trim() || `${copy.outcome} ${outcomeIndex + 1}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <Field
                    id={`creator-question-${index}-explanation`}
                    label={copy.explanationLabel}
                    className="mt-4"
                  >
                    {(props) => (
                      <textarea
                        {...props}
                        value={item.explanation || ''}
                        onChange={(e) =>
                          patchQuestion(setQuestions, index, { explanation: e.target.value })
                        }
                        rows={3}
                        maxLength={500}
                        className="border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                        placeholder={copy.explanation}
                      />
                    )}
                  </Field>
                </article>
              );
            })}
          </div>
        </section>

        {quizType === 'personality' ? (
          <section className="surface-panel p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{copy.outcomes}</p>
                <h3 className="text-text-primary mt-2 text-2xl font-semibold">
                  {copy.outcomesHeading}
                </h3>
                <p className="text-text-secondary mt-2 text-sm">{copy.resultsRange}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={results.length >= 6}
                onClick={() => setResults((current) => [...current, result()])}
              >
                {copy.addOutcome}
              </Button>
            </div>
            <p className="text-text-secondary mb-4 text-sm">{copy.assignHint}</p>
            <div className="space-y-4">
              {results.map((item, index) => {
                const itemErrors = errorsFor(visibleErrors, { kind: 'result', index });
                const errorId = `creator-result-${index}-error`;
                const describedBy = itemErrors.length ? errorId : undefined;
                const tagMissing = !item.personality_tag?.trim();
                return (
                  <article
                    key={item.id}
                    className="border-border-subtle rounded-[28px] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`creator-result-${index}-title`}
                        className="text-text-primary text-sm font-semibold"
                      >
                        {copy.outcome} {index + 1}
                      </label>
                      <Mini
                        tone="danger"
                        onClick={() =>
                          setResults((current) => current.filter((_, i) => i !== index))
                        }
                        disabled={results.length <= 2}
                      >
                        {copy.remove}
                      </Mini>
                    </div>
                    {itemErrors.length ? (
                      <ul
                        id={errorId}
                        data-error
                        tabIndex={-1}
                        className="text-error mt-3 list-disc space-y-1 pl-5 text-sm"
                      >
                        {itemErrors.map((message, errorIndex) => (
                          <li key={`${errorIndex}-${message}`}>{message}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <Input
                        id={`creator-result-${index}-title`}
                        aria-describedby={describedBy}
                        aria-invalid={showErrors && !item.title.trim() ? true : undefined}
                        value={item.title}
                        onChange={(e) => patchResultTitle(setResults, index, e.target.value)}
                        placeholder={copy.outcomeTitle}
                        maxLength={100}
                      />
                      <Field id={`creator-result-${index}-image`} label={copy.imageUrl}>
                        {(props) => (
                          <Input
                            {...props}
                            type="url"
                            value={item.image_url || ''}
                            onChange={(e) =>
                              patchResult(setResults, index, { image_url: e.target.value })
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <Field
                      id={`creator-result-${index}-tag`}
                      label={copy.personalityTag}
                      hint={copy.tagHint}
                      className="mt-4"
                    >
                      {(props) => (
                        <Input
                          {...props}
                          aria-describedby={
                            describedBy ??
                            (showErrors && tagMissing && formErrors.length
                              ? 'creator-form-errors'
                              : undefined)
                          }
                          aria-invalid={showErrors && tagMissing ? true : undefined}
                          value={item.personality_tag || ''}
                          onChange={(e) =>
                            patchResult(setResults, index, { personality_tag: e.target.value })
                          }
                          placeholder={copy.tagPlaceholder}
                          maxLength={64}
                        />
                      )}
                    </Field>
                    <Field
                      id={`creator-result-${index}-description`}
                      label={`${copy.outcomeDescriptionLabel} ${index + 1}`}
                      className="mt-4"
                    >
                      {(props) => (
                        <textarea
                          {...props}
                          aria-describedby={describedBy}
                          aria-invalid={showErrors && !item.description.trim() ? true : undefined}
                          value={item.description}
                          onChange={(e) =>
                            patchResult(setResults, index, { description: e.target.value })
                          }
                          rows={3}
                          maxLength={1000}
                          className="border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                          placeholder={copy.outcomeDescription}
                        />
                      )}
                    </Field>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field id={`creator-result-${index}-min`} label={copy.min}>
                        {(props) => (
                          <Input
                            {...props}
                            type="number"
                            value={item.min_score ?? 0}
                            onChange={(e) =>
                              patchResult(setResults, index, {
                                min_score: Number(e.target.value) || 0,
                              })
                            }
                          />
                        )}
                      </Field>
                      <Field id={`creator-result-${index}-max`} label={copy.max}>
                        {(props) => (
                          <Input
                            {...props}
                            type="number"
                            value={item.max_score ?? 0}
                            onChange={(e) =>
                              patchResult(setResults, index, {
                                max_score: Number(e.target.value) || 0,
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {formErrors.length ? (
          <section
            id="creator-form-errors"
            data-error
            tabIndex={-1}
            role="alert"
            className="border-error/30 bg-error/5 rounded-2xl border p-4"
          >
            <p className="text-error text-sm font-semibold">{copy.fixErrors}</p>
            <ul className="text-error mt-2 list-disc space-y-1 pl-5 text-sm">
              {formErrors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            isLoading={isSubmitting && activeIntent === 'draft'}
            disabled={isSubmitting}
            aria-describedby={formErrors.length ? 'creator-form-errors' : undefined}
            onClick={() => {
              intentRef.current = 'draft';
            }}
            className="rounded-full px-7"
          >
            {isSubmitting && activeIntent === 'draft' ? copy.savingDraft : copy.saveDraft}
          </Button>
          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting && activeIntent === 'review'}
            disabled={isSubmitting}
            aria-describedby={formErrors.length ? 'creator-form-errors' : undefined}
            onClick={() => {
              intentRef.current = 'review';
            }}
            className="rounded-full px-7"
          >
            {isSubmitting && activeIntent === 'review' ? copy.submittingReview : copy.submitReview}
          </Button>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="surface-panel sticky top-28 overflow-hidden p-0">
          <div className="border-border-subtle border-b bg-[linear-gradient(135deg,rgba(216,120,52,0.18),transparent_70%)] p-6">
            <p className="eyebrow">{copy.previewEyebrow}</p>
            <h3 className="text-text-primary mt-3 text-2xl font-semibold tracking-tight">
              {title || copy.futureCover}
            </h3>
            <p className="text-text-secondary mt-3 text-sm leading-7">
              {description || copy.futureSummary}
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              <Tag>{difficulty}</Tag>
              <Tag>{quizType === 'trivia' ? copy.trivia : copy.personality}</Tag>
              <Tag>
                {questions.length} {copy.questionsCount}
              </Tag>
              <Tag>
                {copy.language}: {locale === 'es' ? copy.spanish : copy.english}
              </Tag>
            </div>
            <Check ready={checks.title} label={copy.headline} detail={title || 'Missing title'} />
            <Check
              ready={checks.questions}
              label={copy.playableQuestions}
              detail={`${questions.length} ${copy.drafted}`}
            />
            <Check
              ready={checks.results}
              label={copy.outcomesLabel}
              detail={
                quizType === 'trivia' ? copy.notRequired : `${results.length} ${copy.drafted}`
              }
            />
          </div>
        </section>
      </aside>
    </form>
  );
}

const question = (type: 'trivia' | 'personality'): Question => ({
  id: `q-${crypto.randomUUID()}`,
  question: '',
  options: Array.from({ length: 4 }, (_, index) => ({
    id: `o-${crypto.randomUUID()}`,
    text: '',
    is_correct: type === 'trivia' && index === 0,
  })),
  explanation: '',
});
const result = (): PersonalityResult => ({
  id: `r-${crypto.randomUUID()}`,
  title: '',
  description: '',
  personality_tag: '',
  min_score: 0,
  max_score: 0,
  image_url: '',
});
const normalize = (item: Question, type: 'trivia' | 'personality'): Question => ({
  ...item,
  options: item.options.map((option, index) => ({
    ...option,
    is_correct:
      type === 'trivia'
        ? item.options.some((o) => o.is_correct)
          ? Boolean(option.is_correct)
          : index === 0
        : false,
  })),
});
const patchQuestion = (
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>,
  index: number,
  patch: Partial<Question>
) =>
  setQuestions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
const patchResult = (
  setResults: React.Dispatch<React.SetStateAction<PersonalityResult[]>>,
  index: number,
  patch: Partial<PersonalityResult>
) =>
  setResults((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
const patchResultTitle = (
  setResults: React.Dispatch<React.SetStateAction<PersonalityResult[]>>,
  index: number,
  title: string
) =>
  setResults((current) =>
    current.map((item, i) => {
      if (i !== index) return item;
      const auto =
        !item.personality_tag?.trim() || item.personality_tag === tagFromTitle(item.title);
      return { ...item, title, personality_tag: auto ? tagFromTitle(title) : item.personality_tag };
    })
  );
const move = <T,>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  list: T[],
  index: number,
  diff: -1 | 1
) => {
  const target = index + diff;
  if (target < 0 || target >= list.length) return;
  setter((current) => {
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
};
type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};
function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-text-primary mb-2 block text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        'aria-describedby': error ? `${id}-error` : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && !error ? <p className="text-text-muted mt-1.5 text-xs">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} data-error tabIndex={-1} className="text-error mt-1.5 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function Choice({
  id,
  label,
  value,
  setValue,
  options,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-text-primary mb-3 text-sm font-medium">
        {label}
      </p>
      <div className="grid gap-3">
        {options.map(([optionId, text]) => (
          <button
            key={optionId}
            type="button"
            aria-pressed={value === optionId}
            onClick={() => setValue(optionId)}
            className={cn(
              'rounded-[24px] border px-4 py-4 text-left transition',
              value === optionId
                ? 'border-accent-primary bg-accent-primary/8'
                : 'border-border-subtle bg-bg-secondary'
            )}
          >
            <p className="text-text-primary text-base font-semibold">{text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
function Mini({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-45',
        tone === 'danger'
          ? 'bg-rose-500/10 text-rose-700'
          : 'bg-bg-secondary text-text-secondary ring-border-subtle ring-1'
      )}
    >
      {children}
    </button>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-bg-secondary text-text-secondary ring-border-subtle rounded-full px-3 py-1 text-xs font-semibold ring-1">
      {children}
    </span>
  );
}
function Check({ ready, label, detail }: { ready: boolean; label: string; detail: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        ready ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-border-subtle bg-white/75'
      )}
    >
      <p className="text-text-primary text-sm font-medium">{label}</p>
      <p className="text-text-secondary mt-1 text-xs">{detail}</p>
    </div>
  );
}

export default QuizCreatorForm;
