/**
 * Listas públicas de seguidores/siguiendo (SOC-11): filas enlazadas al
 * perfil, vacío real, error con reintento y paginación.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getProfileByUsername: vi.fn(),
  getFollowList: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getProfileByUsername: mocks.getProfileByUsername,
  getFollowList: mocks.getFollowList,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import { FollowListPage } from '@/components/profile/follow-list';

const PROFILE = {
  id: 'u-1',
  username: 'dana',
  display_name: 'Dana',
  avatar_url: null,
};

const ADA = {
  id: 'u-2',
  username: 'ada',
  display_name: 'Ada Lovelace',
  avatar_url: null,
  points: 120,
  quizzes_played: 3,
};

beforeEach(() => {
  mocks.getProfileByUsername.mockReset().mockResolvedValue(PROFILE);
  mocks.getFollowList.mockReset().mockResolvedValue({
    entries: [],
    total: 0,
    page: 1,
    pageCount: 1,
  });
});

describe('FollowListPage', () => {
  it('pinta seguidores con enlace a su perfil y el total', async () => {
    mocks.getFollowList.mockResolvedValue({
      entries: [ADA],
      total: 1,
      page: 1,
      pageCount: 1,
    });

    render(await FollowListPage({ locale: 'es', username: 'dana', kind: 'followers', page: 1 }));

    expect(screen.getByRole('heading', { name: /Seguidores · @dana/ })).toBeInTheDocument();
    expect(screen.getByText('1 seguidor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute(
      'href',
      '/es/profile/ada'
    );
    // La vuelta al perfil se conserva.
    expect(screen.getByRole('link', { name: '← @dana' })).toHaveAttribute(
      'href',
      '/es/profile/dana'
    );
  });

  it('sin seguidores muestra un vacío honesto, no una lista rota', async () => {
    render(await FollowListPage({ locale: 'es', username: 'dana', kind: 'followers', page: 1 }));

    expect(screen.getByText('Todavía nadie sigue este perfil.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('si la consulta falla avisa con reintento en vez de fingir vacío', async () => {
    mocks.getFollowList.mockResolvedValue(null);

    render(await FollowListPage({ locale: 'es', username: 'dana', kind: 'following', page: 1 }));

    expect(screen.getByText('No pudimos cargar la lista.')).toBeInTheDocument();
    expect(screen.queryByText('Este perfil todavía no sigue a nadie.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reintentar' })).toHaveAttribute(
      'href',
      '/es/profile/dana/following'
    );
  });

  it('pagina con enlaces anterior/siguiente', async () => {
    mocks.getFollowList.mockResolvedValue({
      entries: [ADA],
      total: 72,
      page: 2,
      pageCount: 3,
    });

    render(await FollowListPage({ locale: 'en', username: 'dana', kind: 'followers', page: 2 }));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/en/profile/dana/followers?page=1'
    );
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/en/profile/dana/followers?page=3'
    );
  });

  it('un perfil inexistente llama a notFound()', async () => {
    mocks.getProfileByUsername.mockResolvedValue(null);

    await expect(
      FollowListPage({ locale: 'es', username: 'ghost', kind: 'followers', page: 1 })
    ).rejects.toThrow('notFound');
  });
});
