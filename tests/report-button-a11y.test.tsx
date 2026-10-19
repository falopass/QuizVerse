import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportButton } from '@/components/shared/report-button';

function mockFetch(ok: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok } as Response)
  );
}

function renderAndSubmit(locale: 'es' | 'en') {
  render(<ReportButton quizId="quiz-1" quizSlug="quiz-de-prueba" locale={locale} />);
  fireEvent.click(
    screen.getByRole('button', { name: locale === 'es' ? 'Reportar quiz' : 'Report quiz' })
  );
  fireEvent.click(screen.getAllByRole('radio')[0]);
  fireEvent.click(
    screen.getByRole('button', { name: locale === 'es' ? 'Enviar reporte' : 'Submit report' })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportButton accesible', () => {
  it('anuncia el éxito en español con role="status"', async () => {
    mockFetch(true);
    renderAndSubmit('es');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Gracias. Revisaremos este quiz pronto.');
  });

  it('anuncia el éxito en inglés con role="status"', async () => {
    mockFetch(true);
    renderAndSubmit('en');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Thanks. We will review this quiz shortly.');
  });

  it('anuncia el error con role="alert", no cierra el modal y rehabilita el botón', async () => {
    mockFetch(false);
    renderAndSubmit('es');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos enviar el reporte. Inténtalo otra vez.');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeEnabled()
    );
  });
});
