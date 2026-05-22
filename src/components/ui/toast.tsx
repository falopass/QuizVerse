'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useToast, type Toast } from '@/providers/toast-provider';
import { cn } from '@/lib/utils/cn';

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

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn(
        'relative flex items-start gap-3 rounded-lg border p-4 shadow-lg',
        'bg-bg-secondary border-border-subtle',
        'max-w-md min-w-[320px]'
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
        className="text-text-muted hover:text-text-primary flex-shrink-0 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: toast.duration / 1000, ease: 'linear' }}
            onAnimationComplete={() => onClose(toast.id)}
            className={cn(
              'h-full',
              toast.type === 'success'
                ? 'bg-success'
                : toast.type === 'error'
                  ? 'bg-error'
                  : toast.type === 'warning'
                    ? 'bg-warning'
                    : 'bg-accent-primary'
            )}
          />
        </div>
      )}
    </motion.div>
  );
}

export function ToastViewport() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastViewport;
