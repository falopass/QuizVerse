import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createQuiz: vi.fn(),
  push: vi.fn(),
  trackEvent: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/actions/quiz.actions', () => ({ createQuiz: mocks.createQuiz }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/telemetry/client', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

import { QuizCreatorForm } from '@/components/quiz/quiz-creator-form';

const LETTERS = ['A', 'B', 'C', 'D'];

function cardFor(index: number) {
  return screen.getByLabelText(`Pregunta ${index + 1}`).closest('article') as HTMLElement;
}

function fillQuestion(index: number) {
  const card = cardFor(index);
  fireEvent.change(within(card).getByLabelText(`Pregunta ${index + 1}`), {
    target: { value: `¿Pregunta ${index + 1}?` },
  });
  LETTERS.forEach((letter, optionIndex) => {
    fireEvent.change(within(card).getByLabelText(`Opción ${letter}`), {
      target: { value: `Respuesta ${optionIndex + 1}` },
    });
  });
  return card;
}

function assign(card: HTMLElement, optionIndex: number, outcome: string) {
  const select = within(card).getAllByLabelText('Suma a')[optionIndex];
  const option = within(select).getByRole('option', { name: outcome }) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
}

function fillOutcome(index: number, title: string) {
  fireEvent.change(screen.getByLabelText(`Resultado ${index + 1}`), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText(`Descripción del resultado ${index + 1}`), {
    target: { value: `Descripción de ${title}` },
  });
}

function renderForm() {
  return render(<QuizCreatorForm categories={[]} locale="es" />);
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trackEvent.mockResolvedValue(undefined);
  mocks.createQuiz.mockResolvedValue({
    success: true,
    quiz: { id: 'quiz-1', slug: 'mi-quiz-personalidad' },
  });
});

describe('QuizCreatorForm', () => {
  it('crea un quiz de personalidad válido con tags y opciones asignadas', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Qué resultado eres' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Personalidad' }));
    fillOutcome(0, 'La Curadora');
    fillOutcome(1, 'El Explorador');

    expect(screen.getAllByLabelText('Tag de personalidad')[0]).toHaveValue('la-curadora');
    expect(screen.getAllByLabelText('Tag de personalidad')[1]).toHaveValue('el-explorador');

    const cards = [0, 1, 2].map(fillQuestion);
    cards.forEach((card) => {
      assign(card, 0, 'La Curadora');
      assign(card, 1, 'El Explorador');
      assign(card, 2, 'La Curadora');
      assign(card, 3, 'El Explorador');
    });

    submit();

    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    const payload = mocks.createQuiz.mock.calls[0][0];
    expect(payload.quiz_type).toBe('personality');
    expect(
      payload.results.map((item: { personality_tag: string }) => item.personality_tag)
    ).toEqual(['la-curadora', 'el-explorador']);
    expect(payload.questions[0].options[0].personality_tags).toEqual(['la-curadora']);
    expect(payload.questions[0].options[1].personality_tags).toEqual(['el-explorador']);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/create/done?id=quiz-1'));
  });

  it('muestra el error del validador cuando un resultado no tiene tag', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Qué resultado eres' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Personalidad' }));
    fillOutcome(0, 'La Curadora');
    fillOutcome(1, 'El Explorador');
    [0, 1, 2].map(fillQuestion);
    fireEvent.change(screen.getAllByLabelText('Tag de personalidad')[1], {
      target: { value: '' },
    });

    submit();

    expect(
      await screen.findByText('Cada resultado debe tener un tag de personalidad único y no vacío')
    ).toBeInTheDocument();
    expect(mocks.createQuiz).not.toHaveBeenCalled();
  });

  it('muestra el error cuando una opción no suma a ningún resultado', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Qué resultado eres' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Personalidad' }));
    fillOutcome(0, 'La Curadora');
    fillOutcome(1, 'El Explorador');

    const cards = [0, 1, 2].map(fillQuestion);
    cards.forEach((card, cardIndex) => {
      LETTERS.forEach((_, optionIndex) => {
        if (cardIndex === 1 && optionIndex === 1) return;
        assign(card, optionIndex, optionIndex % 2 === 0 ? 'La Curadora' : 'El Explorador');
      });
    });

    submit();

    expect(
      await screen.findByText('Pregunta 2: cada opción debe usar tags de resultados existentes')
    ).toBeInTheDocument();
    expect(mocks.createQuiz).not.toHaveBeenCalled();
    const pending = within(cards[1]).getAllByLabelText('Suma a')[1];
    await waitFor(() => expect(pending).toHaveFocus());
  });

  it('mantiene el flujo de trivia sin resultados ni tags', async () => {
    mocks.createQuiz.mockResolvedValue({
      success: true,
      quiz: { id: 'quiz-2', slug: 'mi-quiz-trivia' },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Trivia de prueba' },
    });
    [0, 1, 2].map(fillQuestion);

    submit();

    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    const payload = mocks.createQuiz.mock.calls[0][0];
    expect(payload.quiz_type).toBe('trivia');
    expect(payload.results).toBeUndefined();
    expect(
      payload.questions[0].options.map((option: { is_correct?: boolean }) => option.is_correct)
    ).toEqual([true, false, false, false]);
    expect(payload.questions[0].options[0].personality_tags).toBeUndefined();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/create/done?id=quiz-2'));
  });

  it('«Enviar a revisión» manda intent review', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Trivia de prueba' },
    });
    [0, 1, 2].map(fillQuestion);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }));

    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    expect(mocks.createQuiz.mock.calls[0][0].intent).toBe('review');
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Quiz enviado a revisión.'));
  });

  it('«Guardar borrador» manda intent draft', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Trivia de prueba' },
    });
    [0, 1, 2].map(fillQuestion);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(mocks.createQuiz).toHaveBeenCalledTimes(1));
    expect(mocks.createQuiz.mock.calls[0][0].intent).toBe('draft');
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Borrador guardado.'));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/create/done?id=quiz-1'));
  });
});
