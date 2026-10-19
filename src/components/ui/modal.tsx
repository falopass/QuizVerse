'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  closeLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTabbable(el: HTMLElement): boolean {
  if (el.closest('[hidden], fieldset[disabled]')) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  closeLabel = 'Close',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const instanceId = React.useId();
  const titleId = `${instanceId}-title`;
  const descriptionId = `${instanceId}-description`;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isTabbable);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = active === dialog || !dialog.contains(active);

      if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[95vw] h-[95vh]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-300',
          'animate-fade-in'
        )}
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'bg-bg-secondary shadow-elevated relative w-full rounded-xl',
          'border-border-subtle border',
          'flex flex-col',
          'max-h-[90vh]',
          sizes[size],
          'animate-slide-up'
        )}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="border-border-subtle flex items-center justify-between border-b px-6 py-4">
            {title && (
              <h2 id={titleId} className="text-text-primary text-lg font-semibold">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-2 transition-colors"
                aria-label={closeLabel}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {description && (
            <p id={descriptionId} className="text-text-secondary text-sm leading-6">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
