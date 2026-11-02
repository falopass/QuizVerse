import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { achievementCopy, PROGRESS_UNIT_LABELS } from '@/lib/i18n/achievements';
import { normalizeAchievement } from '@/lib/data/normalizers';
import {
  achievementProgress,
  ACHIEVEMENT_ICONS,
  HIDDEN_ACHIEVEMENT_IDS,
  type AchievementProgress,
} from '@/lib/quiz/achievement-progress';
import { loadAchievementStats } from '@/lib/quiz/achievements';
import { buildMetadata } from '@/lib/seo/metadata';
import type { Achievement } from '@/types/quiz';

/** Colección de logros, privada y con login: nunca indexada. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mis logros' : 'My achievements',
    description: es
      ? 'Los logros que has desbloqueado jugando y creando quizzes, y el progreso de los que te faltan.'
      : 'The achievements you have unlocked by playing and creating quizzes, and the progress on the ones left.',
    path: `/${lang}/achievements`,
    locale: lang,
    noindex: true,
  });
}

interface AchievementCard {
  achievement: Achievement;
  unlockedAt: string | null;
}

export default async function LocalizedAchievementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/achievements'))}`
      )
    );
  }

  const [unlockedResult, catalogResult, stats] = await Promise.all([
    supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at, achievements(*)')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false }),
    supabase.from('achievements').select('*').order('condition_value', { ascending: true }),
    loadAchievementStats(supabase, user.id),
  ]);

  const unlocked = (unlockedResult.data ?? []).flatMap((row) => {
    const achievement = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements;
    return achievement
      ? [{ ...normalizeAchievement(achievement), unlocked_at: row.unlocked_at }]
      : [];
  });
  const unlockedById = new Map(unlocked.map((item) => [item.id, item.unlocked_at]));

  const catalog = (catalogResult.data ?? [])
    .map(normalizeAchievement)
    .filter((achievement) => !HIDDEN_ACHIEVEMENT_IDS.has(achievement.id));

  // Si el catálogo no se pudo leer, al menos se muestran los ya ganados: la
  // página nunca debe quedarse en blanco por una consulta de solo lectura.
  const cards: AchievementCard[] =
    catalog.length > 0
      ? catalog.map((achievement) => ({
          achievement,
          unlockedAt: unlockedById.get(achievement.id) ?? null,
        }))
      : unlocked.map((achievement) => ({ achievement, unlockedAt: achievement.unlocked_at }));

  // Reconciliación: un logro cuyo contador ya cumple la meta pero que nunca se
  // desbloqueó (lo alcanzó antes de aplicar la 018, o checkAchievements falló
  // tras su partida) se concede aquí, con el mismo RPC validado en SQL que paga
  // el premio una sola vez. Sin esto, la barra diría 50/50 y la tarjeta
  // «Bloqueado» al mismo tiempo.
  const pending = stats
    ? cards.filter((card) => {
        if (card.unlockedAt) return false;
        const progress = achievementProgress(card.achievement, stats);
        return progress !== null && progress.current >= progress.target;
      })
    : [];

  if (pending.length > 0) {
    const granted = await Promise.all(
      pending.map((card) =>
        supabase.rpc('unlock_achievement', { p_achievement_id: card.achievement.id })
      )
    );
    const now = new Date().toISOString();
    pending.forEach((card, index) => {
      if (granted[index].data === true) card.unlockedAt = now;
    });
  }

  cards.sort((a, b) => {
    if (Boolean(a.unlockedAt) !== Boolean(b.unlockedAt)) return a.unlockedAt ? -1 : 1;
    return a.achievement.points_reward - b.achievement.points_reward;
  });

  const es = locale === 'es';
  const unlockedCount = cards.filter((card) => card.unlockedAt).length;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Colección' : 'Collection'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Mis logros' : 'My achievements'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Todo lo que has desbloqueado jugando y creando quizzes, y cuánto te falta para el resto.'
            : 'Everything you have unlocked by playing and creating quizzes, and how close you are to the rest.'}
        </p>
        {cards.length > 0 ? (
          <p className="text-text-muted mt-4 text-sm">
            {es
              ? `${unlockedCount} de ${cards.length} desbloqueados`
              : `${unlockedCount} of ${cards.length} unlocked`}
          </p>
        ) : null}
      </section>

      {cards.length === 0 ? (
        <section className="surface-card mt-8 p-10 text-center">
          <h2 className="text-text-primary text-2xl font-semibold">
            {es ? 'Aún no has desbloqueado logros' : "You haven't unlocked any achievements yet"}
          </h2>
          <p className="text-text-secondary mt-2">
            {es ? 'Juega un quiz para empezar.' : 'Play a quiz to get started.'}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="bg-accent-primary hover:bg-accent-hover text-bg-primary mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium transition-colors"
          >
            {es ? 'Explorar quizzes' : 'Browse quizzes'}
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {cards.map(({ achievement, unlockedAt }) => (
            <AchievementTile
              key={achievement.id}
              achievement={achievement}
              unlockedAt={unlockedAt}
              progress={stats ? achievementProgress(achievement, stats) : null}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AchievementTile({
  achievement,
  unlockedAt,
  progress,
  locale,
}: {
  achievement: Achievement;
  unlockedAt: string | null;
  progress: AchievementProgress | null;
  locale: Locale;
}) {
  const es = locale === 'es';
  const copy = achievementCopy(achievement.id, locale, {
    name: achievement.name,
    description: achievement.description,
  });
  const icon = ACHIEVEMENT_ICONS[achievement.id] ?? achievement.icon;
  const unlocked = Boolean(unlockedAt);
  const date = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString(es ? 'es-ES' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const percent = progress
    ? Math.min(
        100,
        Math.round((Math.min(progress.current, progress.target) / progress.target) * 100)
      )
    : 0;

  return (
    <li className={`surface-card flex items-start gap-4 p-5 ${unlocked ? '' : 'opacity-80'}`}>
      <span aria-hidden="true" className={`text-3xl leading-none ${unlocked ? '' : 'grayscale'}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-text-primary font-semibold">{copy.name}</h2>
          <span className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5 text-xs">
            +{achievement.points_reward} pts
          </span>
          {unlocked ? null : (
            <span className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5 text-xs">
              {es ? 'Bloqueado' : 'Locked'}
            </span>
          )}
        </div>
        <p className="text-text-secondary mt-1 text-sm">{copy.description}</p>

        {date ? (
          <p className="text-text-muted mt-2 text-xs">
            {es ? `Desbloqueado el ${date}` : `Unlocked ${date}`}
          </p>
        ) : progress ? (
          <div className="mt-3">
            <div
              aria-hidden="true"
              className="bg-bg-tertiary h-2 w-full overflow-hidden rounded-full"
            >
              <div
                className="bg-accent-primary h-full rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-text-muted mt-2 text-xs">
              {`${Math.min(progress.current, progress.target)}/${progress.target} ${
                PROGRESS_UNIT_LABELS[progress.unit][locale]
              }`}
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
}
