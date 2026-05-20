import 'server-only';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, hasLocale, type Locale } from './dictionaries';
import { LOCALE_COOKIE } from './shared';

export async function getLocale(): Promise<Locale> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', user.id)
      .single();

    const profileLocale = (profile as { preferred_language?: string } | null)?.preferred_language;
    if (profileLocale && hasLocale(profileLocale)) {
      return profileLocale;
    }
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && hasLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language')?.toLowerCase() ?? '';
  if (acceptLanguage.includes('es')) {
    return 'es';
  }

  return defaultLocale;
}

export function getLocaleFromParam(locale?: string): Locale {
  return locale && hasLocale(locale) ? locale : defaultLocale;
}
