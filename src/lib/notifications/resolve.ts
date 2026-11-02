/**
 * Resolves each notification to its destination and display names.
 *
 * `notifications.data` is loose JSONB written by DB triggers (`quiz_id`,
 * `comment_id`, `follower_id`, `user_id`, ...). Two batched `.in()` lookups —
 * quizzes and profiles — cover the whole page instead of one query per row.
 * Anything that fails to resolve renders as a generic card without a link.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Database, Json } from '@/types/database';

export type NotificationRow = Pick<
  Database['public']['Tables']['notifications']['Row'],
  'id' | 'type' | 'title' | 'body' | 'data' | 'is_read' | 'created_at'
>;

export interface ResolvedNotification {
  id: string;
  /** Widened to `string`: the DB enum can grow before the UI knows the new type. */
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  /** Localized destination, or `null` when the notification goes nowhere. */
  href: string | null;
  /** `display_name` (fallback `username`) of the profile that triggered it. */
  actorName: string | null;
  quizTitle: string | null;
}

type QuizRef = { slug: string; title: string; status: string };
type ProfileRef = { username: string; display_name: string | null };

function dataString(data: Json | null, key: string): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = (data as Record<string, Json | undefined>)[key];
  return typeof value === 'string' && value ? value : null;
}

/** Profile keys that name the actor, in order of preference. */
const ACTOR_KEYS = ['actor_id', 'follower_id', 'user_id'] as const;

function actorId(data: Json | null): string | null {
  for (const key of ACTOR_KEYS) {
    const id = dataString(data, key);
    if (id) return id;
  }
  return null;
}

function destinationHref(
  notification: NotificationRow,
  quiz: QuizRef | null,
  profile: ProfileRef | null,
  locale: Locale
): string | null {
  const quizHref =
    quiz && quiz.status === 'published' ? localizeHref(locale, `/quiz/${quiz.slug}`) : null;
  switch (notification.type) {
    case 'comment':
    case 'mention':
      if (quizHref) return `${quizHref}#quiz-comments`;
      // The quiz left public view: the creator still finds it in My quizzes.
      return quiz ? localizeHref(locale, '/my-quizzes') : null;
    case 'follow':
      return profile ? localizeHref(locale, `/profile/${profile.username}`) : null;
    case 'quiz_approved':
      return quizHref ?? (quiz ? localizeHref(locale, '/my-quizzes') : null);
    case 'quiz_rejected':
      return localizeHref(locale, '/my-quizzes');
    case 'achievement':
      return localizeHref(locale, '/achievements');
    default:
      // Unknown/new types still deep-link when their payload carries a quiz.
      return quizHref;
  }
}

export async function resolveNotificationTargets(
  supabase: SupabaseClient<Database>,
  notifications: NotificationRow[],
  locale: Locale
): Promise<ResolvedNotification[]> {
  const quizIds = new Set<string>();
  const profileIds = new Set<string>();
  for (const notification of notifications) {
    const quizId = dataString(notification.data, 'quiz_id');
    if (quizId) quizIds.add(quizId);
    const profileId = actorId(notification.data);
    if (profileId) profileIds.add(profileId);
  }

  const [quizRows, profileRows] = await Promise.all([
    quizIds.size > 0
      ? supabase
          .from('quizzes')
          .select('id, slug, title, status')
          .in('id', [...quizIds])
      : Promise.resolve({ data: [] }),
    profileIds.size > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', [...profileIds])
      : Promise.resolve({ data: [] }),
  ]);

  const quizzes = new Map((quizRows.data ?? []).map((row) => [row.id, row]));
  const profiles = new Map((profileRows.data ?? []).map((row) => [row.id, row]));

  return notifications.map((notification) => {
    const quizId = dataString(notification.data, 'quiz_id');
    const quiz = quizId ? (quizzes.get(quizId) ?? null) : null;
    const profileId = actorId(notification.data);
    const profile = profileId ? (profiles.get(profileId) ?? null) : null;
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      is_read: notification.is_read,
      created_at: notification.created_at,
      href: destinationHref(notification, quiz, profile, locale),
      actorName: profile ? (profile.display_name ?? profile.username) : null,
      quizTitle: quiz?.title ?? null,
    };
  });
}
