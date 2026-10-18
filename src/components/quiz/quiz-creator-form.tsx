'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createQuiz } from '@/actions/quiz.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/providers/toast-provider';
import { cn } from '@/lib/utils/cn';
import { localizeHref } from '@/lib/i18n/navigation';
import { trackEvent } from '@/lib/telemetry/client';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, PersonalityResult, Question } from '@/types/quiz';

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
          titleError: 'Primero añade un mejor título.',
          questionsError: 'Completa al menos 3 preguntas completas.',
          resultsError: 'Añade al menos 2 resultados completos.',
          success: 'Quiz creado correctamente.',
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
          outcomes: 'Resultados',
          outcomesHeading: 'Define los finales.',
          addOutcome: 'Añadir resultado',
          outcome: 'Resultado',
          outcomeTitle: 'La Curadora',
          imageUrl: 'URL de imagen opcional',
          outcomeDescription: 'Describe el arquetipo y por qué la persona cae aquí.',
          min: 'Mín',
          max: 'Máx',
          publishing: 'Publicando quiz...',
          publish: 'Publicar quiz',
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
          titleError: 'Add a stronger title first.',
          questionsError: 'Complete at least 3 full questions.',
          resultsError: 'Add at least 2 full outcomes.',
          success: 'Quiz created successfully.',
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
          outcomes: 'Outcomes',
          outcomesHeading: 'Define the endings.',
          addOutcome: 'Add outcome',
          outcome: 'Outcome',
          outcomeTitle: 'The Curator',
          imageUrl: 'Optional image URL',
          outcomeDescription: 'Describe the archetype and why the player lands here.',
          min: 'Min',
          max: 'Max',
          publishing: 'Publishing quiz...',
          publish: 'Publish quiz',
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checks = useMemo(
    () => ({
      title: title.trim().length >= 5,
      questions: questions.length >= 3 && questions.every(validQuestion),
      results: quizType === 'trivia' || (results.length >= 2 && results.every(validResult)),
    }),
    [questions, quizType, results, title]
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checks.title) return error(copy.titleError);
    if (!checks.questions) return error(copy.questionsError);
    if (!checks.results) return error(copy.resultsError);
    setIsSubmitting(true);
    try {
      await trackEvent({
        name: 'create_start',
        locale,
        quizType,
        source: 'manual_create',
      });
      const response = await createQuiz({
        title: title.trim(),
        description: description.trim(),
        quiz_type: quizType,
        difficulty,
        category_id: categoryId || undefined,
        questions,
        results: quizType === 'personality' ? results : undefined,
        language: locale,
        estimated_minutes: Math.max(1, questions.length),
      });
      if (!response.success) return error(response.error);
      await trackEvent({
        name: 'create_complete',
        locale,
        quizId: response.quiz.id,
        quizSlug: response.quiz.slug,
        quizType,
        source: 'manual_create',
      });
      success(copy.success);
      router.push(localizeHref(locale, `/quiz/${response.quiz.slug}`));
    } catch (err) {
      console.error(err);
      error(copy.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-6">
        <section className="surface-panel p-6">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="text-text-primary mt-3 text-3xl font-semibold tracking-tight">
            {copy.heading}
          </h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Block label={copy.title}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.titlePlaceholder}
                maxLength={120}
              />
            </Block>
            <Block label={copy.category}>
              <select
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
            </Block>
            <Block label={copy.description} className="lg:col-span-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                placeholder={copy.descriptionPlaceholder}
              />
            </Block>
          </div>
        </section>

        <section className="surface-panel p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Choice
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
            {questions.map((item, index) => (
              <article
                key={item.id}
                className="border-border-subtle rounded-[28px] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-text-primary text-sm font-semibold">
                    {copy.question} {index + 1}
                  </p>
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
                <div className="mt-4">
                  <Input
                    value={item.question}
                    onChange={(e) =>
                      patchQuestion(setQuestions, index, { question: e.target.value })
                    }
                    placeholder={copy.questionPrompt}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {item.options.map((option, optionIndex) => (
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
                        <span className="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">
                          {copy.option} {String.fromCharCode(65 + optionIndex)}
                        </span>
                        {quizType === 'trivia' ? (
                          <button
                            type="button"
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
                        value={option.text}
                        onChange={(e) =>
                          setQuestions((current) =>
                            current.map((q, qIndex) =>
                              qIndex !== index
                                ? q
                                : {
                                    ...q,
                                    options: q.options.map((o, oIndex) =>
                                      oIndex === optionIndex ? { ...o, text: e.target.value } : o
                                    ),
                                  }
                            )
                          )
                        }
                        placeholder={copy.answerCopy}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  value={item.explanation || ''}
                  onChange={(e) =>
                    patchQuestion(setQuestions, index, { explanation: e.target.value })
                  }
                  rows={3}
                  className="border-border-subtle bg-bg-secondary text-text-primary mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  placeholder={copy.explanation}
                />
              </article>
            ))}
          </div>
        </section>

        {quizType === 'personality' ? (
          <section className="surface-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow">{copy.outcomes}</p>
                <h3 className="text-text-primary mt-2 text-2xl font-semibold">
                  {copy.outcomesHeading}
                </h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setResults((current) => [...current, result()])}
              >
                {copy.addOutcome}
              </Button>
            </div>
            <div className="space-y-4">
              {results.map((item, index) => (
                <article
                  key={item.id}
                  className="border-border-subtle rounded-[28px] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-text-primary text-sm font-semibold">
                      {copy.outcome} {index + 1}
                    </p>
                    <Mini
                      tone="danger"
                      onClick={() => setResults((current) => current.filter((_, i) => i !== index))}
                      disabled={results.length <= 2}
                    >
                      {copy.remove}
                    </Mini>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Input
                      value={item.title}
                      onChange={(e) => patchResult(setResults, index, { title: e.target.value })}
                      placeholder={copy.outcomeTitle}
                    />
                    <Input
                      type="url"
                      value={item.image_url || ''}
                      onChange={(e) =>
                        patchResult(setResults, index, { image_url: e.target.value })
                      }
                      placeholder={copy.imageUrl}
                    />
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      patchResult(setResults, index, { description: e.target.value })
                    }
                    rows={3}
                    className="border-border-subtle bg-bg-secondary text-text-primary mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder={copy.outcomeDescription}
                  />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input
                      type="number"
                      value={item.min_score ?? 0}
                      onChange={(e) =>
                        patchResult(setResults, index, { min_score: Number(e.target.value) || 0 })
                      }
                      placeholder={copy.min}
                    />
                    <Input
                      type="number"
                      value={item.max_score ?? 0}
                      onChange={(e) =>
                        patchResult(setResults, index, { max_score: Number(e.target.value) || 0 })
                      }
                      placeholder={copy.max}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" isLoading={isSubmitting} className="rounded-full px-7">
            {isSubmitting ? copy.publishing : copy.publish}
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
              <Tag>{quizType}</Tag>
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
const validQuestion = (item: Question) =>
  item.question.trim() &&
  item.options.every((option) => option.text.trim()) &&
  item.options.some((option) => option.is_correct);
const validResult = (item: PersonalityResult) => item.title.trim() && item.description.trim();
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
function Block({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-text-primary mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
function Choice({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <p className="text-text-primary mb-3 text-sm font-medium">{label}</p>
      <div className="grid gap-3">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => setValue(id)}
            className={cn(
              'rounded-[24px] border px-4 py-4 text-left transition',
              value === id
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
