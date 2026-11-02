import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFollowList, getProfileByUsername } from '@/lib/data/public';
import { formatCompactNumber } from '@/lib/utils/format';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * Lista pública de seguidores (`/followers`) o seguidos (`/following`) de un
 * perfil (SOC-11). Comparte el patrón de estados del ranking: error con
 * reintento, vacío real y filas enlazadas al perfil de cada jugador.
 *
 * El grafo es público hoy (policy "Anyone can read follows", 006); si se
 * cierra a privado (SOC-09), `getFollowList` devolverá listas vacías y estas
 * páginas caerán a su estado vacío sin romperse.
 */
export async function FollowListPage({
  locale,
  username,
  kind,
  page,
}: {
  locale: Locale;
  username: string;
  kind: 'followers' | 'following';
  page: number;
}) {
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const list = await getFollowList(profile.id, kind, page);
  const es = locale === 'es';
  const profilePath = `/profile/${encodeURIComponent(profile.username)}`;
  const basePath = `${profilePath}/${kind}`;
  const heading =
    kind === 'followers' ? (es ? 'Seguidores' : 'Followers') : es ? 'Siguiendo' : 'Following';
  const countLabel = (total: number) =>
    kind === 'followers'
      ? es
        ? total === 1
          ? '1 seguidor'
          : `${total} seguidores`
        : total === 1
          ? '1 follower'
          : `${total} followers`
      : es
        ? `${total} siguiendo`
        : `${total} following`;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pt-28 pb-20">
      <Link href={localizeHref(locale, profilePath)} className="arcade-back">
        ← @{profile.username}
      </Link>

      <section className="surface-panel mt-6 p-8">
        <p className="eyebrow">{es ? 'Perfil' : 'Profile'}</p>
        <h1 className="text-text-primary mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {heading} · @{profile.username}
        </h1>
        {list ? <p className="text-text-secondary mt-2 text-sm">{countLabel(list.total)}</p> : null}
      </section>

      {list === null ? (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{heading}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {es ? 'No pudimos cargar la lista.' : 'We could not load the list.'}
              </h2>
            </div>
            <Link
              // El reintento conserva la página que se estaba viendo.
              href={localizeHref(locale, `${basePath}${page > 1 ? `?page=${page}` : ''}`)}
              className="bg-accent-primary text-bg-primary inline-flex min-h-11 items-center rounded-full px-5 py-3 text-sm font-semibold"
            >
              {es ? 'Reintentar' : 'Try again'}
            </Link>
          </div>
        </section>
      ) : list.entries.length === 0 && list.total > 0 ? (
        // La lista tiene filas pero esta página no: una URL ?page fuera de
        // rango no puede disfrazarse del vacío real.
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{heading}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">
            {es ? 'Esta página no existe.' : 'This page does not exist.'}
          </h2>
          <Link
            href={localizeHref(locale, basePath)}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {es ? 'Volver a la primera página' : 'Back to the first page'}
          </Link>
        </section>
      ) : list.entries.length === 0 ? (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{heading}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">
            {kind === 'followers'
              ? es
                ? 'Todavía nadie sigue este perfil.'
                : 'Nobody follows this profile yet.'
              : es
                ? 'Este perfil todavía no sigue a nadie.'
                : 'This profile does not follow anyone yet.'}
          </h2>
          <Link
            href={localizeHref(locale, '/leaderboard')}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {es ? 'Ver el ranking' : 'See the leaderboard'}
          </Link>
        </section>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {list.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={localizeHref(locale, `/profile/${encodeURIComponent(entry.username)}`)}
                  className="surface-card flex items-center gap-4 p-4 transition-transform hover:-translate-y-1"
                >
                  {entry.avatar_url ? (
                    // El avatar viene de OAuth y el host es arbitrario:
                    // next/image lo rechazaría y a 44 px no aporta nada.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-bg-tertiary text-accent-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold"
                    >
                      {(entry.display_name || entry.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate font-semibold">
                      {entry.display_name || entry.username}
                    </p>
                    <p className="text-text-muted text-sm">@{entry.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-accent-primary text-lg font-semibold">
                      {formatCompactNumber(entry.points, locale)}
                    </p>
                    <p className="text-text-muted text-[11px] tracking-[0.16em] uppercase">
                      {es ? 'puntos' : 'points'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {list.pageCount > 1 ? (
            <nav
              className="mt-8 flex items-center justify-between gap-4"
              aria-label={es ? 'Paginación' : 'Pagination'}
            >
              {list.page > 1 ? (
                <Link
                  href={localizeHref(locale, `${basePath}?page=${list.page - 1}`)}
                  className="ring-border-subtle text-text-secondary inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ring-1"
                >
                  {es ? '← Anterior' : '← Previous'}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-text-muted text-sm">
                {es
                  ? `Página ${list.page} de ${list.pageCount}`
                  : `Page ${list.page} of ${list.pageCount}`}
              </span>
              {list.page < list.pageCount ? (
                <Link
                  href={localizeHref(locale, `${basePath}?page=${list.page + 1}`)}
                  className="ring-border-subtle text-text-secondary inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ring-1"
                >
                  {es ? 'Siguiente →' : 'Next →'}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
