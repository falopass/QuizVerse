'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { preconnect } from 'react-dom';
import { usePathname } from 'next/navigation';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { hasSessionCookie } from '@/lib/supabase/session-cookie';

interface SupabaseContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Carga `@supabase/supabase-js` bajo demanda y devuelve el cliente del navegador. */
  getClient: () => Promise<SupabaseClient>;
  signOut: () => Promise<void>;
}

const Context = createContext<SupabaseContext | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // El HTML y el primer render siempre son iguales, incluso con sesión.
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<Promise<SupabaseClient> | null>(null);

  // `import()` deja `@supabase/supabase-js` en un chunk aparte que solo se pide
  // cuando hace falta. El ref cachea la promesa para no crear dos clientes; si
  // la descarga falla se suelta para que la próxima llamada reintente.
  const getClient = useCallback(() => {
    clientRef.current ??= import('@/lib/supabase/client')
      .then(({ createClient }) => createClient())
      .catch((error: unknown) => {
        clientRef.current = null;
        throw error;
      });
    return clientRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      // También al navegar: login/register son acciones de servidor, no
      // eventos del SDK. Sus redirects deben descubrir la cookie nueva.
      const hasSession = hasSessionCookie(
        document.cookie.split(';').map((cookie) => ({ name: cookie.trim().split('=')[0] }))
      );
      if (!hasSession) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (apiUrl) {
        try {
          preconnect(new URL(apiUrl).origin, { crossOrigin: 'anonymous' });
        } catch {
          // Un hint opcional no puede impedir resolver la sesión.
        }
      }
      const client = await getClient();
      if (cancelled) return;

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });
      unsubscribe = () => subscription.unsubscribe();

      const { data } = await client.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })().catch(() => {
      // Si el chunk no carga, el visitante ve el estado anónimo en vez de un
      // placeholder eterno; las páginas siguen resolviendo la sesión en el
      // servidor.
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [getClient, pathname]);

  const signOut = useCallback(async () => {
    try {
      const client = await getClient();
      await client.auth.signOut();
    } catch {
      // La acción del servidor ya cerró la sesión.
    } finally {
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  }, [getClient]);

  return (
    <Context.Provider value={{ user, session, loading, getClient, signOut }}>
      {children}
    </Context.Provider>
  );
}

export function useSupabase() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
