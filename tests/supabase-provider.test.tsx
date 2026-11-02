import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

// El provider importa el cliente con `import()`: el mock cubre igual el
// módulo, así que el test puede comprobar cuándo se pide y cuándo no.
vi.mock('@/lib/supabase/client', () => ({ createClient: mocks.createClient }));

import { SupabaseProvider, useSupabase } from '@/providers/supabase-provider';

const USER = { id: 'user-1', email: 'ada@example.com' };
const SESSION = { user: USER, access_token: 'token' };

function Probe() {
  const { user, loading, getClient, signOut } = useSupabase();
  return (
    <>
      <span data-testid="state">{loading ? 'loading' : (user?.id ?? 'anonymous')}</span>
      <button type="button" onClick={() => void getClient().catch(() => {})}>
        pedir cliente
      </button>
      <button type="button" onClick={() => void signOut()}>
        salir
      </button>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
  });
});

describe('SupabaseProvider perezoso', () => {
  it('sin cookie de sesión no importa el cliente ni pide la sesión', async () => {
    render(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );

    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('sin sesión carga el cliente solo si un consumidor lo pide', async () => {
    render(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'pedir cliente' }));

    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(1));
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('con cookie de sesión crea un solo cliente y pinta el usuario', async () => {
    render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('reacciona a los cambios de auth del cliente', async () => {
    render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));

    const onChange = mocks.onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown
    ) => void;
    act(() => onChange('SIGNED_IN', { user: { id: 'user-2' }, access_token: 'token-2' }));

    expect(screen.getByTestId('state')).toHaveTextContent('user-2');
  });

  it('cerrar sesión usa el cliente ya cargado', async () => {
    render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));

    fireEvent.click(screen.getByRole('button', { name: 'salir' }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  // `import()` y `createClient()` comparten la misma cadena: el rechazo de
  // cualquiera de los dos pasa por el catch que suelta la promesa. El fallo
  // del propio import se cubre en supabase-provider-import-failure.test.tsx.
  it('reintenta si la creación del cliente falla', async () => {
    mocks.createClient.mockImplementationOnce(() => {
      throw new Error('chunk load failed');
    });

    render(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'pedir cliente' }));
    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'pedir cliente' }));
    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(2));
  });

  it('si el chunk no carga, cae al estado anónimo en vez de dejar el placeholder', async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error('chunk load failed');
    });

    render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });

  it('cerrar sesión no rompe si el cliente no está disponible', async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error('chunk load failed');
    });

    render(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'salir' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('al desmontar cancela la suscripción de auth', async () => {
    const { unmount } = render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));

    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('si el login cambia hasSession en caliente, muestra el placeholder y luego el usuario', async () => {
    const { rerender } = render(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');

    rerender(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));
  });

  it('al perder la sesión limpia el usuario sin volver a importar', async () => {
    const { rerender } = render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));

    rerender(
      <SupabaseProvider hasSession={false}>
        <Probe />
      </SupabaseProvider>
    );

    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });
});
