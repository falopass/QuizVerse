import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildEmbedSnippet } from '@/lib/seo/embed';
import { InviteBar } from '@/components/shared/invite-bar';

const CANONICAL = 'https://quizverse.org/es/quiz/mi-quiz';

const labels = {
  invite: 'Retar a un amigo',
  inviteBody: 'Manda el enlace y mira si supera tu puntuación.',
  copyInvite: 'Copiar enlace',
  copied: '¡Copiado!',
};

describe('buildEmbedSnippet', () => {
  it('deriva la URL de embed y arma el snippet para un canonical de quiz', () => {
    const result = buildEmbedSnippet(CANONICAL, 'es', 'Mi Quiz');

    expect(result?.embedUrl).toBe('https://quizverse.org/embed/es/mi-quiz');
    expect(result?.snippet).toContain('<iframe src="https://quizverse.org/embed/es/mi-quiz"');
    expect(result?.snippet).toContain('width="600"');
    expect(result?.snippet).toContain('height="720"');
    expect(result?.snippet).toContain('loading="lazy"');
    expect(result?.snippet).toContain('href="https://quizverse.org/es/quiz/mi-quiz"');
  });

  it('escapa el título en el iframe y el enlace', () => {
    const result = buildEmbedSnippet(CANONICAL, 'en', 'A "quoted" <quiz> & more');

    expect(result?.snippet).not.toContain('<quiz>');
    expect(result?.snippet).toContain('&quot;quoted&quot;');
    expect(result?.snippet).toContain('&lt;quiz&gt;');
    expect(result?.snippet).toContain('&amp; more');
  });

  it('usa el locale pedido para la ruta de embed', () => {
    const result = buildEmbedSnippet('https://quizverse.org/en/quiz/my-quiz', 'en');

    expect(result?.embedUrl).toBe('https://quizverse.org/embed/en/my-quiz');
    expect(result?.snippet).toContain('Play');
  });

  it('devuelve null con una URL inválida', () => {
    expect(buildEmbedSnippet('no-es-una-url', 'es')).toBeNull();
  });
});

describe('InviteBar', () => {
  it('copia el snippet de embed al pulsar «Insertar»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<InviteBar url={CANONICAL} quizTitle="Mi Quiz" locale="es" labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insertar' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('<iframe src="https://quizverse.org/embed/es/mi-quiz"');
    expect(copied).toContain('href="https://quizverse.org/es/quiz/mi-quiz"');
  });
});
