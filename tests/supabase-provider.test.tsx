import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  pathname: '/es/login',
}));

// El provider importa el cliente con `import()`: el mock cubre igual el
// módulo, así que el test puede comprobar cuándo se pide y cuándo no.
vi.mock('@/lib/supabase/client', () => ({ createClient: mocks.createClient }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));

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
  mocks.pathname = '/es/login';
  document.cookie = 'sb-project-auth-token=; Max-Age=0; Path=/';
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
      <SupabaseProvider>
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
      <SupabaseProvider>
        <Probe />
      </SupabaseProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'pedir cliente' }));

    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(1));
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('con cookie de sesión crea un solo cliente y pinta el usuario', async () => {
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    render(
      <SupabaseProvider>
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
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    render(
      <SupabaseProvider>
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
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    render(
      <SupabaseProvider>
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
      <SupabaseProvider>
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

    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    render(
      <SupabaseProvider>
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
      <SupabaseProvider>
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
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    const { unmount } = render(
      <SupabaseProvider>
        <Probe />
      </SupabaseProvider>
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));

    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('el HTML de servidor no contiene la sesión aunque el navegador tenga cookie', () => {
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    const html = renderToString(<SupabaseProvider><Probe /></SupabaseProvider>);
    expect(html).toContain('loading');
    expect(html).not.toContain('user-1');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('detecta login por acción de servidor al navegar sin remontar el provider', async () => {
    const view = <SupabaseProvider><Probe /></SupabaseProvider>;
    const { rerender } = render(view);
    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    mocks.pathname = '/es';
    rerender(<SupabaseProvider><Probe /></SupabaseProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));
  });

  it('al perder la cookie limpia el usuario al navegar sin volver a importar', async () => {
    document.cookie = 'sb-project-auth-token=synthetic; Path=/';
    const { rerender } = render(<SupabaseProvider><Probe /></SupabaseProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user-1'));
    document.cookie = 'sb-project-auth-token=; Max-Age=0; Path=/';
    mocks.pathname = '/es';
    rerender(<SupabaseProvider><Probe /></SupabaseProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});