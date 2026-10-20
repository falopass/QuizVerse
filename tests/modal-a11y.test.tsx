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
    const titleId = dialog.getAttribute('aria-labelledby');
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(titleId!)).toHaveTextContent('Título de prueba');
    expect(document.getElementById(descriptionId!)).toHaveTextContent('Descripción de prueba');
  });

  it('genera ids únicos por instancia cuando hay dos modales abiertos', () => {
    render(
      <>
        <Modal isOpen onClose={() => {}} title="Modal A" description="Descripción A">
          <p>Contenido A</p>
        </Modal>
        <Modal isOpen onClose={() => {}} title="Modal B" description="Descripción B">
          <p>Contenido B</p>
        </Modal>
      </>
    );
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);

    const ids = dialogs.flatMap((d) => [
      d.getAttribute('aria-labelledby'),
      d.getAttribute('aria-describedby'),
    ]);
    expect(new Set(ids).size).toBe(4);

    for (const dialog of dialogs) {
      const titleId = dialog.getAttribute('aria-labelledby')!;
      const descriptionId = dialog.getAttribute('aria-describedby')!;
      const titleEl = document.getElementById(titleId);
      const descriptionEl = document.getElementById(descriptionId);
      expect(dialog.contains(titleEl)).toBe(true);
      expect(dialog.contains(descriptionEl)).toBe(true);
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    }

    const [dialogA, dialogB] = dialogs;
    expect(document.getElementById(dialogA.getAttribute('aria-labelledby')!)).toHaveTextContent(
      'Modal A'
    );
    expect(document.getElementById(dialogB.getAttribute('aria-labelledby')!)).toHaveTextContent(
      'Modal B'
    );
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
