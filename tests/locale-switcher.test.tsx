import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathname: '/en/category/trivia',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/lib/telemetry/client', () => ({
  trackEvent: vi.fn(() => Promise.resolve()),
}));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
vi.stubGlobal('fetch', fetchMock);

function setAlternate(href: string) {
  const link = document.createElement('link');
  link.setAttribute('rel', 'alternate');
  link.setAttribute('hreflang', 'es');
  link.setAttribute('href', href);
  link.dataset.test = 'alternate';
  document.head.appendChild(link);
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  fetchMock.mockClear();
  document.head.querySelectorAll('link[data-test="alternate"]').forEach((link) => link.remove());
});

describe('LocaleSwitcher', () => {
  it('conserva ?page=N cuando la página hermana existe (enlace hreflang)', async () => {
    setAlternate('https://quizverse.org/es/category/trivia?page=2');
    render(<LocaleSwitcher value="en" label="Idioma" />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/category/trivia?page=2'));
  });

  it('cae a la página 1 cuando no hay página hermana (sin hreflang)', async () => {
    render(<LocaleSwitcher value="en" label="Idioma" />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/category/trivia'));
  });
});
