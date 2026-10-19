import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/actions/quiz.actions', () => ({
  incrementShares: vi.fn(async () => ({ success: true })),
}));

import { copyText } from '@/lib/utils/clipboard';
import { ShareButtons } from '@/components/shared/share-buttons';

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  stubClipboard(undefined);
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copyText', () => {
  it('usa navigator.clipboard.writeText cuando está disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await expect(copyText('https://quizverse.org/es/quiz/x')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('https://quizverse.org/es/quiz/x');
  });

  it('cae al respaldo con execCommand si writeText rechaza', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyText('texto')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('copia con textarea + execCommand cuando no existe la Clipboard API', async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyText('texto')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('devuelve false y no deja nodos cuando todo falla', async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);

    await expect(copyText('texto')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('ShareButtons sin forma de copiar', () => {
  it('muestra el aviso accesible y el enlace para copiar a mano', async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);

    render(
      React.createElement(ShareButtons, {
        title: 't',
        url: 'https://quizverse.org/en/quiz/x',
        text: 's',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent("Couldn't copy: select the link");
    expect(screen.getByRole('textbox')).toHaveValue('https://quizverse.org/en/quiz/x');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
