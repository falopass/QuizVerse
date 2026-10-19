import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/explore',
}));

import { trackEvent } from '@/lib/telemetry/client';
import { AppTelemetry } from '@/components/layout/app-telemetry';
import { CONSENT_KEY } from '@/components/shared/cookie-consent';

const fetchMock = vi.fn().mockResolvedValue({ ok: true });

function setConsent(level: 'essential' | 'all') {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ level, version: 1, timestamp: Date.now() }));
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('trackEvent', () => {
  it('no llama a fetch sin decisión de consentimiento', async () => {
    await trackEvent({ name: 'page_view', path: '/es/explore' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no llama a fetch con consentimiento essential', async () => {
    setConsent('essential');
    await trackEvent({ name: 'quiz_start', path: '/es/explore' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía a /api/analytics con consentimiento all', async () => {
    setConsent('all');
    await trackEvent({ name: 'page_view', path: '/es/explore' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analytics',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('AppTelemetry', () => {
  it('emite el page_view de la ruta actual cuando el consentimiento pasa a all', async () => {
    render(React.createElement(AppTelemetry));
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();

    setConsent('all');
    act(() => {
      window.dispatchEvent(new CustomEvent('quizverse:consent', { detail: { level: 'all' } }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ name: 'page_view', path: '/es/explore', locale: 'es' });
  });

  it('emite el page_view cuando el consentimiento llega por storage (otra pestaña)', async () => {
    render(React.createElement(AppTelemetry));
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();

    setConsent('all');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: CONSENT_KEY,
          newValue: localStorage.getItem(CONSENT_KEY),
        })
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ name: 'page_view', path: '/es/explore' });
  });

  it('ignora eventos storage ajenos al consentimiento', async () => {
    setConsent('all');
    render(React.createElement(AppTelemetry));
    await act(async () => {});
    fetchMock.mockClear();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'otra-key', newValue: 'x' }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
