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
import type { PersonalityResult, Question } from '@/types/quiz';

interface Draft {
  title: string;
  description: string;
  quiz_type: 'trivia' | 'personality';
  difficulty: 'easy' | 'medium' | 'hard';
  questions: Question[];
  results?: PersonalityResult[];
}
interface ApiResponse {
  quiz: Draft;
  validationWarnings?: string[];
  rateLimit?: { limited: boolean; remaining?: number };
  error?: string;
}
const TOPICS = {
  en: [
    'Summer travel personality',
    'Modern cinema trivia',
    'Coffee culture',
    'Design instincts',
    'World capitals',
    'Pop music eras',
  ],
  es: [
    'Personalidad viajera de verano',
    'Trivia de cine moderno',
    'Cultura del café',
    'Instintos de diseño',
    'Capitales del mundo',
    'Eras del pop',
  ],
} as const;

export function AIQuizGenerator({ locale = 'en' }: { locale?: Locale }) {
  const router = useRouter();
  const { success, error } = useToast();
  const copy =
    locale === 'es'
      ? {
          enterTopic: 'Escribe un tema antes de generar.',
          rateLimited: 'La generación está limitada temporalmente.',
          remaining: (count: number) => `Quedan ${count} generaciones en esta ventana.`,
          draftCreated: 'Borrador creado. Revísalo antes de guardarlo.',
          generateError: 'No se pudo generar el quiz',
          saveSuccess: 'Quiz guardado correctamente.',
          saveError: 'No se pudo guardar el quiz',
          promptEngine: 'Motor de prompts',
          promptTitle: 'Convierte una idea en un borrador jugable.',
          topic: 'Tema o ángulo',
          topicPlaceholder: '¿Qué ciudad encaja con tu personalidad según tus hábitos?',
          quizType: 'Tipo de quiz',
          difficulty: 'Dificultad',
          questionCount: 'Cantidad de preguntas',
          generating: 'Generando borrador...',
          generate: 'Generar con AI',
          studioNotes: 'Notas del estudio',
          notesTitle: 'La AI escribe la primera pasada, no la versión final.',
          note1Title: 'Empieza con una premisa más precisa',
          note1Body: 'Un ángulo específico te da mejores preguntas que un tema genérico.',
          note2Title: 'Edita antes de guardar',
          note2Body:
            'Aprieta prompts, elimina repeticiones y haz que el final se sienta intencional.',
          generatedDraft: 'Borrador generado',
          refineTitle: 'Refina la salida de AI antes de publicarla.',
          backToPrompt: 'Volver al prompt',
          saving: 'Guardando quiz...',
          saveDraft: 'Guardar borrador',
          metadata: 'Metadatos',
          description: 'Descripción',
          descriptionPlaceholder: 'Reescribe el resumen de AI para que suene más afilado.',
          questions: 'Preguntas',
          cleanSequence: 'Limpia la secuencia.',
          addQuestion: 'Añadir pregunta',
          question: 'Pregunta',
          up: 'Subir',
          down: 'Bajar',
          remove: 'Eliminar',
          option: 'Opción',
          correct: 'Correcta',
          markCorrect: 'Marcar correcta',
          answerCopy: 'Texto de respuesta',
          explanation: 'Explicación opcional o nota de revelación.',
          outcomes: 'Resultados',
          outcomesTitle: 'Haz que los finales valgan la pena.',
          addOutcome: 'Añadir resultado',
          outcome: 'Resultado',
          outcomeTitle: 'Título del resultado',
          whyEnding: 'Por qué este final encaja y qué dice sobre la persona.',
          min: 'Mín',
          max: 'Máx',
          draftStatus: 'Estado del borrador',
          untitled: 'Borrador generado sin título',
          generatedSummary: 'Aquí aparecerá el resumen generado.',
          headline: 'Titular',
          drafted: 'en borrador',
          validationWarnings: 'Avisos de validación',
          trivia: 'Trivia',
          personality: 'Personalidad',
          easy: 'Fácil',
          medium: 'Media',
          hard: 'Difícil',
          questionsShort: 'preguntas',
          notRequired: 'No hace falta',
        }
      : {
          enterTopic: 'Enter a topic before generating.',
          rateLimited: 'Generation is temporarily rate limited.',
          remaining: (count: number) => `${count} generations remaining in this window.`,
          draftCreated: 'Draft created. Review it before saving.',
          generateError: 'Failed to generate quiz',
          saveSuccess: 'Quiz saved successfully.',
          saveError: 'Failed to save quiz',
          promptEngine: 'Prompt Engine',
          promptTitle: 'Turn one idea into a playable draft.',
          topic: 'Topic or angle',
          topicPlaceholder: 'Which city matches your personality based on your habits?',
          quizType: 'Quiz type',
          difficulty: 'Difficulty',
          questionCount: 'Question count',
          generating: 'Generating draft...',
          generate: 'Generate with AI',
          studioNotes: 'Studio Notes',
          notesTitle: 'AI writes the first pass, not the final version.',
          note1Title: 'Start with a sharper premise',
          note1Body: 'A specific angle gives you better questions than a generic topic.',
          note2Title: 'Edit before save',
          note2Body: 'Tighten prompts, remove repetition, and make the ending feel intentional.',
          generatedDraft: 'Generated Draft',
          refineTitle: 'Refine the AI output before it goes live.',
          backToPrompt: 'Back to prompt',
          saving: 'Saving quiz...',
          saveDraft: 'Save draft',
          metadata: 'Metadata',
          description: 'Description',
          descriptionPlaceholder: 'Rewrite the AI summary into something sharper.',
          questions: 'Questions',
          cleanSequence: 'Clean the sequence.',
          addQuestion: 'Add question',
          question: 'Question',
          up: 'Up',
          down: 'Down',
          remove: 'Remove',
          option: 'Option',
          correct: 'Correct',
          markCorrect: 'Mark correct',
          answerCopy: 'Answer copy',
          explanation: 'Optional explanation or reveal note.',
          outcomes: 'Outcomes',
          outcomesTitle: 'Make the endings worth sharing.',
          addOutcome: 'Add outcome',
          outcome: 'Outcome',
          outcomeTitle: 'Outcome title',
          whyEnding: 'Why this ending lands and what it says about the player.',
          min: 'Min',
          max: 'Max',
          draftStatus: 'Draft Status',
          untitled: 'Untitled generated draft',
          generatedSummary: 'The generated summary will appear here.',
          headline: 'Headline',
          drafted: 'drafted',
          validationWarnings: 'Validation warnings',
          trivia: 'Trivia',
          personality: 'Personality',
          easy: 'Easy',
          medium: 'Medium',
          hard: 'Hard',
          questionsShort: 'questions',
          notRequired: 'Not required',
        };
  const topics = TOPICS[locale];
  const [topic, setTopic] = useState('');
  const [quizType, setQuizType] = useState<'trivia' | 'personality'>('personality');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rateNote, setRateNote] = useState<string | null>(null);

  const checks = useMemo(
    () =>
      draft
        ? [
            {
              label: copy.headline,
              ok: draft.title.trim().length >= 5,
              detail: draft.title || 'Missing title',
            },
            {
              label: copy.questions,
              ok: draft.questions.length >= 3,
              detail: `${draft.questions.length} ${copy.drafted}`,
            },
            {
              label: copy.outcomes,
              ok: draft.quiz_type === 'trivia' || (draft.results?.length || 0) >= 2,
              detail:
                draft.quiz_type === 'trivia'
                  ? copy.notRequired
                  : `${draft.results?.length || 0} ${copy.drafted}`,
            },
          ]
        : [],
    [copy.drafted, copy.headline, copy.notRequired, copy.outcomes, copy.questions, draft]
  );

  const generate = async () => {
    if (!topic.trim()) return error(copy.enterTopic);
    setIsGenerating(true);
    setRateNote(null);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          quiz_type: quizType,
          difficulty,
          num_questions: numQuestions,
          language: locale,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.error) throw new Error(data.error || copy.generateError);
      setDraft({ ...data.quiz, difficulty });
      setWarnings(data.validationWarnings || []);
      if (data.rateLimit?.limited) setRateNote(copy.rateLimited);
      else if (typeof data.rateLimit?.remaining === 'number')
        setRateNote(copy.remaining(data.rateLimit.remaining));
      success(copy.draftCreated);
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : copy.generateError);
    } finally {
      setIsGenerating(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await trackEvent({
        name: 'create_start',
        locale,
        quizType: draft.quiz_type,
        source: 'ai_create',
      });
      const response = await createQuiz({
        ...draft,
        language: locale,
        estimated_minutes: Math.max(1, draft.questions.length),
        is_ai_generated: true,
      });
      if (response.error || !response.quiz) throw new Error(response.error || copy.saveError);
      await trackEvent({
        name: 'create_complete',
        locale,
        quizId: response.quiz.id,
        quizSlug: response.quiz.slug,
        quizType: draft.quiz_type,
        source: 'ai_create',
      });
      success(copy.saveSuccess);
      router.push(localizeHref(locale, `/quiz/${response.quiz.slug}`));
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : copy.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="surface-panel p-6">
            <p className="eyebrow">{copy.promptEngine}</p>
            <h2 className="text-text-primary mt-3 text-3xl font-semibold tracking-tight">
              {copy.promptTitle}
            </h2>
            <div className="mt-6 space-y-5">
              <Block label={copy.topic}>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={copy.topicPlaceholder}
                />
              </Block>
              <div className="flex flex-wrap gap-2">
                {topics.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTopic(item)}
                    className="bg-bg-secondary text-text-secondary ring-border-subtle rounded-full px-4 py-2 text-sm font-medium ring-1"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Choice
                  label={copy.quizType}
                  value={quizType}
                  setValue={(value) => setQuizType(value as 'trivia' | 'personality')}
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
              <Block label={`${copy.questionCount}: ${numQuestions}`}>
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="accent-accent-primary w-full"
                />
              </Block>
              <Button
                onClick={generate}
                disabled={isGenerating || !topic.trim()}
                isLoading={isGenerating}
                size="xl"
                className="w-full rounded-full"
              >
                {isGenerating ? copy.generating : copy.generate}
              </Button>
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="surface-panel sticky top-28 p-6">
            <p className="eyebrow">{copy.studioNotes}</p>
            <h3 className="text-text-primary mt-3 text-2xl font-semibold tracking-tight">
              {copy.notesTitle}
            </h3>
            <div className="mt-5 space-y-3">
              <Note title={copy.note1Title} body={copy.note1Body} />
              <Note title={copy.note2Title} body={copy.note2Body} />
              {rateNote ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                  {rateNote}
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <section className="surface-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{copy.generatedDraft}</p>
              <h2 className="text-text-primary mt-3 text-3xl font-semibold tracking-tight">
                {copy.refineTitle}
              </h2>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setDraft(null);
                  setWarnings([]);
                }}
              >
                {copy.backToPrompt}
              </Button>
              <Button className="rounded-full" isLoading={isSaving} onClick={save}>
                {isSaving ? copy.saving : copy.saveDraft}
              </Button>
            </div>
          </div>
        </section>
        <section className="surface-panel p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Block label="Title">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Block>
            <Block label={copy.metadata}>
              <div className="border-border-subtle bg-bg-secondary text-text-secondary flex h-11 items-center gap-2 rounded-xl border px-4 text-sm">
                <Tag>{draft.quiz_type}</Tag>
                <Tag>{draft.difficulty}</Tag>
                <Tag>{draft.questions.length}Q</Tag>
              </div>
            </Block>
          </div>
          <Block label={copy.description} className="mt-4">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={4}
              className="border-border-subtle bg-bg-secondary text-text-primary w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              placeholder={copy.descriptionPlaceholder}
            />
          </Block>
        </section>
        <section className="surface-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">{copy.questions}</p>
              <h3 className="text-text-primary mt-2 text-2xl font-semibold">
                {copy.cleanSequence}
              </h3>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setDraft({ ...draft, questions: [...draft.questions, question(draft.quiz_type)] })
              }
            >
              {copy.addQuestion}
            </Button>
          </div>
          <div className="space-y-4">
            {draft.questions.map((item, index) => (
              <article
                key={item.id}
                className="border-border-subtle rounded-[28px] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-text-primary text-sm font-semibold">
                    {copy.question} {index + 1}
                  </p>
                  <div className="flex gap-2">
                    <Mini onClick={() => move(setDraft, draft, index, -1)} disabled={index === 0}>
                      {copy.up}
                    </Mini>
                    <Mini
                      onClick={() => move(setDraft, draft, index, 1)}
                      disabled={index === draft.questions.length - 1}
                    >
                      {copy.down}
                    </Mini>
                    <Mini
                      tone="danger"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          questions: draft.questions.filter((_, i) => i !== index),
                        })
                      }
                    >
                      {copy.remove}
                    </Mini>
                  </div>
                </div>
                <div className="mt-4">
                  <Input
                    value={item.question}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.map((q, i) =>
                          i === index ? { ...q, question: e.target.value } : q
                        ),
                      })
                    }
                    placeholder={copy.question}
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
                        {draft.quiz_type === 'trivia' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                questions: draft.questions.map((q, i) =>
                                  i !== index
                                    ? q
                                    : {
                                        ...q,
                                        options: q.options.map((o, oi) => ({
                                          ...o,
                                          is_correct: oi === optionIndex,
                                        })),
                                      }
                                ),
                              })
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
                          setDraft({
                            ...draft,
                            questions: draft.questions.map((q, i) =>
                              i !== index
                                ? q
                                : {
                                    ...q,
                                    options: q.options.map((o, oi) =>
                                      oi === optionIndex ? { ...o, text: e.target.value } : o
                                    ),
                                  }
                            ),
                          })
                        }
                        placeholder={copy.answerCopy}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  value={item.explanation || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      questions: draft.questions.map((q, i) =>
                        i === index ? { ...q, explanation: e.target.value } : q
                      ),
                    })
                  }
                  rows={3}
                  className="border-border-subtle bg-bg-secondary text-text-primary mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  placeholder={copy.explanation}
                />
              </article>
            ))}
          </div>
        </section>
        {draft.quiz_type === 'personality' ? (
          <section className="surface-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow">{copy.outcomes}</p>
                <h3 className="text-text-primary mt-2 text-2xl font-semibold">
                  {copy.outcomesTitle}
                </h3>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft({ ...draft, results: [...(draft.results || []), result()] })
                }
              >
                {copy.addOutcome}
              </Button>
            </div>
            <div className="space-y-4">
              {(draft.results || []).map((item, index) => (
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
                      onClick={() =>
                        setDraft({
                          ...draft,
                          results: (draft.results || []).filter((_, i) => i !== index),
                        })
                      }
                      disabled={(draft.results || []).length <= 2}
                    >
                      {copy.remove}
                    </Mini>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Input
                      value={item.title}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          results: (draft.results || []).map((r, i) =>
                            i === index ? { ...r, title: e.target.value } : r
                          ),
                        })
                      }
                      placeholder={copy.outcomeTitle}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        value={item.min_score ?? 0}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            results: (draft.results || []).map((r, i) =>
                              i === index ? { ...r, min_score: Number(e.target.value) || 0 } : r
                            ),
                          })
                        }
                        placeholder={copy.min}
                      />
                      <Input
                        type="number"
                        value={item.max_score ?? 0}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            results: (draft.results || []).map((r, i) =>
                              i === index ? { ...r, max_score: Number(e.target.value) || 0 } : r
                            ),
                          })
                        }
                        placeholder={copy.max}
                      />
                    </div>
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        results: (draft.results || []).map((r, i) =>
                          i === index ? { ...r, description: e.target.value } : r
                        ),
                      })
                    }
                    rows={3}
                    className="border-border-subtle bg-bg-secondary text-text-primary mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder={copy.whyEnding}
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <aside className="space-y-6">
        <section className="surface-panel sticky top-28 overflow-hidden p-0">
          <div className="border-border-subtle border-b bg-[linear-gradient(140deg,rgba(216,120,52,0.18),transparent_72%)] p-6">
            <p className="eyebrow">{copy.draftStatus}</p>
            <h3 className="text-text-primary mt-3 text-2xl font-semibold tracking-tight">
              {draft.title || copy.untitled}
            </h3>
            <p className="text-text-secondary mt-3 text-sm leading-7">
              {draft.description || copy.generatedSummary}
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              <Tag>{draft.difficulty}</Tag>
              <Tag>{draft.quiz_type}</Tag>
              <Tag>
                {draft.questions.length} {copy.questionsShort}
              </Tag>
            </div>
            {checks.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded-2xl border px-4 py-3',
                  item.ok
                    ? 'border-emerald-500/20 bg-emerald-500/8'
                    : 'border-border-subtle bg-white/75'
                )}
              >
                <p className="text-text-primary text-sm font-medium">{item.label}</p>
                <p className="text-text-secondary mt-1 text-xs">{item.detail}</p>
              </div>
            ))}
            {warnings.length ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.2em] text-amber-900 uppercase">
                  {copy.validationWarnings}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
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
});
function move(
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>,
  draft: Draft,
  index: number,
  diff: -1 | 1
) {
  const target = index + diff;
  if (target < 0 || target >= draft.questions.length) return;
  setDraft((current) => {
    if (!current) return current;
    const next = [...current.questions];
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, questions: next };
  });
}
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
    <span className="text-text-secondary ring-border-subtle rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1">
      {children}
    </span>
  );
}
function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border-subtle rounded-2xl border bg-white/80 p-4">
      <p className="text-text-primary text-sm font-semibold">{title}</p>
      <p className="text-text-secondary mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}

export default AIQuizGenerator;
