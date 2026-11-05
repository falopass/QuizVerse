/**
 * La tarjeta de compatibilidad: los dos resultados lado a lado, el porcentaje
 * compartido y la etiqueta del rango. Sin nombre del amigo dice «tu amigo» /
 * «your friend», y el botón de comparar delega en el diálogo de compartir.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompatibilityCard } from '@/components/quiz/compatibility-card';

describe('CompatibilityCard', () => {
  it('muestra los dos resultados, el porcentaje y la etiqueta', () => {
    render(
      <CompatibilityCard
        locale="es"
        myResult="Goku"
        theirResult="Vegeta"
        theirName="Camila"
        percent={12}
        tier="rivals"
      />
    );

    expect(screen.getByText('Compatibilidad')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('Rivales eternos')).toBeInTheDocument();
    expect(screen.getByText('Goku')).toBeInTheDocument();
    expect(screen.getByText('Vegeta')).toBeInTheDocument();
    expect(screen.getByText('Camila')).toBeInTheDocument();
  });

  it('usa «tu amigo» cuando no hay nombre visible', () => {
    render(
      <CompatibilityCard
        locale="es"
        myResult="Goku"
        theirResult="Vegeta"
        percent={88}
        tier="soulmates"
      />
    );

    expect(screen.getByText('tu amigo')).toBeInTheDocument();
    expect(screen.getByText('Almas gemelas')).toBeInTheDocument();
  });

  it('renderiza en inglés', () => {
    render(
      <CompatibilityCard
        locale="en"
        myResult="Goku"
        theirResult="Vegeta"
        percent={50}
        tier="opposites"
      />
    );

    expect(screen.getByText('Compatibility')).toBeInTheDocument();
    expect(screen.getByText('Opposites attract')).toBeInTheDocument();
    expect(screen.getByText('your friend')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('el botón «Compara con otro amigo» dispara el compartir', () => {
    const onShare = vi.fn();
    render(
      <CompatibilityCard
        locale="es"
        myResult="Goku"
        theirResult="Vegeta"
        percent={70}
        tier="team"
        onShareChallenge={onShare}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Compara con otro amigo' }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('sin manejador de compartir no pinta el botón', () => {
    render(
      <CompatibilityCard locale="en" myResult="Goku" theirResult={null} percent={70} tier="team" />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Resultado desconocido del amigo: guion en vez de hueco.
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
