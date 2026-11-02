'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useToast, type Toast } from '@/providers/toast-provider';
import { cn } from '@/lib/utils/cn';

interface DisplayedToast {
  toast: Toast;
  exiting: boolean;
}

function ToastIcon({ type }: { type: Toast['type'] }) {
  switch (type) {
    case 'success':
      return (
        <svg className="text-success h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="text-error h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className="text-warning h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'info':
      return (
        <svg
          className="text-accent-secondary h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

function ToastItem({
  entry,
  onClose,
  onExited,
  closeLabel,
}: {
  entry: DisplayedToast;
  onClose: (id: string) => void;
  onExited: (id: string) => void;
  closeLabel: string;
}) {
  const { toast, exiting } = entry;
  return (
    <div
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && exiting) onExited(toast.id);
      }}
      className={cn(
        exiting ? 'toast-item-exit' : 'toast-item',
        'relative flex items-start gap-3 rounded-lg border p-4 shadow-lg',
        'bg-bg-secondary border-border-subtle',
        'w-[calc(100vw-2rem)] max-w-md min-w-0 sm:w-auto sm:min-w-[320px]'
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        <ToastIcon type={toast.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="text-text-secondary mt-1 text-sm">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        aria-label={closeLabel}
        className="text-text-muted hover:text-text-primary flex-shrink-0 transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      {/* Progress bar for duration */}
      {toast.duration && (
        <div className="bg-bg-tertiary absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-lg">
          <div
            className={cn(
              'toast-progress h-full',
              toast.type === 'success'
                ? 'bg-success'
                : toast.type === 'error'
                  ? 'bg-error'
                  : toast.type === 'warning'
                    ? 'bg-warning'
                    : 'bg-accent-primary'
            )}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  const pathname = usePathname();
  const es = pathname === '/es' || pathname?.startsWith('/es/');
  const closeLabel = es ? 'Cerrar aviso' : 'Dismiss notification';

  // El provider quita el aviso al instante; el viewport lo conserva como
  // "fantasma" hasta que termina su animación de salida de CSS.
  const [displayed, setDisplayed] = useState<DisplayedToast[]>(() =>
    toasts.map((toast) => ({ toast, exiting: false }))
  );
  const [lastToasts, setLastToasts] = useState(toasts);

  if (toasts !== lastToasts) {
    setLastToasts(toasts);
    setDisplayed((prev) => {
      const live = new Map(toasts.map((toast) => [toast.id, toast]));
      const kept = prev.map((entry) => {
        const current = live.get(entry.toast.id);
        return current ? { toast: current, exiting: false } : { ...entry, exiting: true };
      });
      const known = new Set(prev.map((entry) => entry.toast.id));
      const added = toasts
        .filter((toast) => !known.has(toast.id))
        .map((toast) => ({ toast, exiting: false }));
      return [...kept, ...added];
    });
  }

  const dropExited = useCallback((id: string) => {
    setDisplayed((prev) => prev.filter((entry) => entry.toast.id !== id || !entry.exiting));
  }, []);

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {displayed.map((entry) => (
        <ToastItem
          key={entry.toast.id}
          entry={entry}
          onClose={removeToast}
          onExited={dropExited}
          closeLabel={closeLabel}
        />
      ))}
    </div>
  );
}

export default ToastViewport;
