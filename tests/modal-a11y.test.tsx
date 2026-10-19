import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '@/components/ui/modal';

function Harness({ closeLabel }: { closeLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Título de prueba"
        description="Descripción de prueba"
        closeLabel={closeLabel}
      >
        <button>Primero</button>
        <button>Último</button>
      </Modal>
    </>
  );
}

function renderOpen(closeLabel?: string) {
  render(<Harness closeLabel={closeLabel} />);
  const trigger = screen.getByRole('button', { name: 'Abrir' });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole('dialog') };
}

describe('Modal accesible', () => {
  it('mueve el foco al diálogo al abrir', () => {
    const { dialog } = renderOpen();
    expect(dialog).toHaveFocus();
  });

  it('expone los ids referenciados por aria-labelledby y aria-describedby', () => {
    const { dialog } = renderOpen();
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    expect(document.getElementById('modal-title')).toHaveTextContent('Título de prueba');
    expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    expect(document.getElementById('modal-description')).toHaveTextContent('Descripción de prueba');
  });

  it('cicla Tab del último focusable al primero', () => {
    renderOpen();
    const last = screen.getByRole('button', { name: 'Último' });
    const first = screen.getByRole('button', { name: 'Close' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });

    expect(first).toHaveFocus();
  });

  it('cicla Shift+Tab del primer focusable al último', () => {
    renderOpen();
    const first = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Último' });

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

    expect(last).toHaveFocus();
  });

  it('ignora controles ocultos al calcular el ciclo de Tab', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <button>Último</button>
        <input type="hidden" name="token" value="x" />
      </Modal>
    );
    const last = screen.getByRole('button', { name: 'Último' });
    const first = screen.getByRole('button', { name: 'Close' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });

    expect(first).toHaveFocus();
  });

  it('cierra con Escape', () => {
    renderOpen();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('etiqueta el botón de cierre con closeLabel', () => {
    renderOpen('Cerrar');

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
  });

  it('usa "Close" como etiqueta por defecto', () => {
    renderOpen();

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('restaura el foco al elemento que abrió el modal al cerrar', () => {
    const { trigger } = renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(trigger).toHaveFocus();
  });
});
