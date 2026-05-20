'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { Option } from '@/types/quiz';

export interface OptionButtonProps {
  option: Option;
  isSelected: boolean;
  isCorrect?: boolean;
  showResult: boolean;
  disabled: boolean;
  onSelect: (optionId: string) => void;
  index: number;
}

export function OptionButton({
  option,
  isSelected,
  isCorrect,
  showResult,
  disabled,
  onSelect,
  index,
}: OptionButtonProps) {
  const getButtonStyles = () => {
    if (!showResult) {
      if (isSelected) {
        return 'border-accent-primary bg-accent-primary/10 shadow-glow';
      }
      return 'border-border-subtle bg-bg-secondary hover:border-accent-primary/50 hover:bg-bg-tertiary';
    }

    // Show result mode
    if (isCorrect) {
      return 'border-success bg-success/10';
    }
    if (isSelected && !isCorrect) {
      return 'border-error bg-error/10';
    }
    return 'border-border-subtle bg-bg-secondary opacity-50';
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => !disabled && onSelect(option.id)}
      disabled={disabled}
      className={cn(
        'w-full rounded-xl border-2 p-4 text-left transition-all duration-300 md:p-5',
        'flex items-center gap-4',
        getButtonStyles(),
        disabled && !showResult && 'cursor-not-allowed',
        !disabled && !showResult && 'cursor-pointer'
      )}
    >
      {/* Option indicator */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all',
          isSelected || (showResult && isCorrect)
            ? 'bg-accent-primary text-white'
            : showResult && isSelected && !isCorrect
              ? 'bg-error text-white'
              : 'bg-bg-tertiary text-text-secondary'
        )}
      >
        {String.fromCharCode(65 + index)}
      </div>

      {/* Option text */}
      <span className="text-text-primary flex-1 text-base md:text-lg">{option.text}</span>

      {/* Result indicator */}
      {showResult && (
        <div className="flex-shrink-0">
          {isCorrect ? (
            <svg
              className="text-success h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : isSelected ? (
            <svg
              className="text-error h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : null}
        </div>
      )}
    </motion.button>
  );
}

export default OptionButton;
