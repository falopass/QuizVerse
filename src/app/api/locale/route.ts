import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { LOCALE_COOKIE } from '@/lib/i18n/shared';
import type { Database } from '@/types/database';

interface ProfileUpdater {
  from: (table: 'profiles') => {
    update: (
      data: Database['public']['Tables']['profiles']['Update']
    ) => {
      eq: (column: 'id', value: string) => Promise<unknown>;
    };
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: string } | null;
  const locale = body?.locale;

  if (!locale || !hasLocale(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profileUpdater = supabase as unknown as ProfileUpdater;
    await profileUpdater
      .from('profiles')
      .update({ preferred_language: locale })
      .eq('id', user.id);
  }

  return NextResponse.json({ success: true, locale });
}
