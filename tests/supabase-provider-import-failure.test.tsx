import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Un factory que lanza hace que el `import()` dinámico del provider rechace,
// que es el fallo real de descarga del chunk (no el de `createClient()`).
vi.mock('@/lib/supabase/client', () => {
  throw new Error('chunk load failed');
});

import { SupabaseProvider, useSupabase } from '@/providers/supabase-provider';

function Probe() {
  const { user, loading } = useSupabase();
  return <span data-testid="state">{loading ? 'loading' : (user?.id ?? 'anonymous')}</span>;
}

describe('SupabaseProvider con el chunk de Supabase roto', () => {
  it('cae al estado anónimo si el import dinámico falla', async () => {
    render(
      <SupabaseProvider hasSession>
        <Probe />
      </SupabaseProvider>
    );

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });
});
