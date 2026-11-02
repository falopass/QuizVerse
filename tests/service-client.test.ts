/**
 * `createServiceClient` solo vive en el servidor y solo cuando la key está
 * configurada: sin `SUPABASE_SERVICE_ROLE_KEY` devuelve `null` para que el
 * llamador caiga al cliente SSR (estados pre-migración), nunca fabrica un
 * cliente con la anon key — ese es justo el rol que pierde la clave.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientSpy } = vi.hoisted(() => ({ createClientSpy: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientSpy }));

import { createServiceClient } from '@/lib/supabase/service';

afterEach(() => {
  vi.unstubAllEnvs();
  createClientSpy.mockClear();
});

describe('createServiceClient', () => {
  it('devuelve null sin SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(createServiceClient()).toBeNull();
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it('crea el cliente con la service key y sin sesión persistente', () => {
    createClientSpy.mockReturnValue('SERVICE_CLIENT');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://real.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'sb_publishable_x');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

    expect(createServiceClient()).toBe('SERVICE_CLIENT');
    expect(createClientSpy).toHaveBeenCalledWith('https://real.supabase.co', 'service-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});
