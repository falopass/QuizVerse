import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const rpcMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { incrementShares } from '@/actions/quiz.actions';
import { ShareButtons } from '@/components/shared/share-buttons';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
});

describe('incrementShares', () => {
  it('invoca el RPC increment_shares con el id del quiz', async () => {
    const result = await incrementShares(QUIZ_ID);

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('increment_shares', { quiz_uuid: QUIZ_ID });
  });

  it('rechaza un id inválido sin tocar la base', async () => {
    const result = await incrementShares('no-es-un-uuid');

    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('ShareButtons', () => {
  it('registra un share al copiar el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ShareButtons title="t" url="https://example.com/r" text="s" quizId={QUIZ_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('increment_shares', { quiz_uuid: QUIZ_ID })
    );
  });

  it('registra un share cuando Web Share se completa', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    render(<ShareButtons title="t" url="https://example.com/r" text="s" quizId={QUIZ_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('increment_shares', { quiz_uuid: QUIZ_ID })
    );
  });

  it('registra un share al abrir una red social', async () => {
    render(<ShareButtons title="t" url="https://example.com/r" text="s" quizId={QUIZ_ID} />);
    fireEvent.click(screen.getByRole('link', { name: /whatsapp/i }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('increment_shares', { quiz_uuid: QUIZ_ID })
    );
  });

  it('no registra nada cuando no hay quizId', async () => {
    render(<ShareButtons title="t" url="https://example.com/r" text="s" />);
    fireEvent.click(screen.getByRole('link', { name: /whatsapp/i }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
