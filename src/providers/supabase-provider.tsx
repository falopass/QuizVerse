'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

interface SupabaseContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Carga `@supabase/supabase-js` bajo demanda y devuelve el cliente del navegador. */
  getClient: () => Promise<SupabaseClient>;
  signOut: () => Promise<void>;
}

const Context = createContext<SupabaseContext | undefined>(undefined);

export function SupabaseProvider({
  children,
  hasSession = false,
}: {
  children: React.ReactNode;
  /**
   * Cookie `sb-*-auth-token` presente en la petición, resuelta en el layout del
   * servidor. Sin ella no se importa el cliente: el visitante anónimo ve el
   * enlace de login desde el primer render, sin parpadeo ni chunk de Supabase.
   */
  hasSession?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(hasSession);
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

  // El layout se reutiliza al navegar: tras un login el servidor manda
  // `hasSession` nuevo sin remontar el provider. Ajustar el estado en render
  // evita enseñar «Iniciar sesión» mientras llega la sesión.
  const [prevHasSession, setPrevHasSession] = useState(hasSession);
  if (prevHasSession !== hasSession) {
    setPrevHasSession(hasSession);
    setLoading(hasSession);
    if (!hasSession) {
      setUser(null);
      setSession(null);
    }
  }

  useEffect(() => {
    if (!hasSession) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const client = await getClient();
      if (cancelled) return;

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
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
  }, [getClient, hasSession]);

  const signOut = useCallback(async () => {
    try {
      const client = await getClient();
      await client.auth.signOut();
    } catch {
      // La sesión del servidor ya se cerró; si el chunk falla, el refresh del
      // layout limpia igualmente el estado.
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
