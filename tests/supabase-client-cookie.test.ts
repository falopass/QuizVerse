import { stringToBase64URL } from '@supabase/ssr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';

function clearCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(clearCookies);
afterEach(clearCookies);

describe('createClient con cookies sb-* corruptas', () => {
  it('borra una cookie de sesión ilegible y arranca sin error de decodificación', async () => {
    // `base64-_w` decodifica a 0xFF: UTF-8 inválido, el mismo lanzamiento del SDK.
    document.cookie = 'sb-corrupt-auth-token=base64-_w; path=/';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = await createClient();
    // initialize() del SDK lee las cookies en microtasks tras construir el cliente.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client).toBeDefined();
    expect(document.cookie).not.toContain('sb-corrupt-auth-token');
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/UTF-8|Base64/);
    consoleError.mockRestore();
  });

  it('borra todos los trozos cuando el valor combinado es ilegible', async () => {
    document.cookie = 'sb-chunked-auth-token.0=base64-a; path=/';
    document.cookie = 'sb-chunked-auth-token.1=!; path=/';

    await createClient();

    expect(document.cookie).not.toContain('sb-chunked-auth-token');
  });

  it('conserva una cookie de sesión válida y las cookies ajenas', async () => {
    const session = stringToBase64URL(JSON.stringify({ access_token: 'token' }));
    document.cookie = `sb-ok-auth-token=base64-${session}; path=/`;
    document.cookie = 'theme=dark; path=/';

    await createClient();

    expect(document.cookie).toContain('sb-ok-auth-token');
    expect(document.cookie).toContain('theme=dark');
  });
});
