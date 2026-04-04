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
        'w-full p-4 md:p-5 rounded-xl border-2 text-left transition-all duration-300',
        'flex items-center gap-4',
        getButtonStyles(),
        disabled && !showResult && 'cursor-not-allowed',
        !disabled && !showResult && 'cursor-pointer'
      )}
    >
      {/* Option indicator */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all',
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
      <span className="flex-1 text-base md:text-lg text-text-primary">{option.text}</span>

      {/* Result indicator */}
      {showResult && (
        <div className="flex-shrink-0">
          {isCorrect ? (
            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isSelected ? (
            <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : null}
        </div>
      )}
    </motion.button>
  );
}

export default OptionButton;
