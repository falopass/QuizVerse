import { cn } from '@/lib/utils/cn';
import { getCoverEyebrow, getCoverOpenLabel, getCoverTheme } from '@/lib/design/cover-system';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

interface QuizCoverArtProps {
  quiz: Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category' | 'cover_image_url'>;
  locale: Locale;
  className?: string;
  ratioClassName?: string;
  compact?: boolean;
  priorityLabel?: string;
}

export function QuizCoverArt({
  quiz,
  locale,
  className,
  ratioClassName = 'aspect-[16/10]',
  compact = false,
  priorityLabel,
}: QuizCoverArtProps) {
  const theme = getCoverTheme(quiz);
  const letter = (quiz.category?.icon ?? quiz.title.charAt(0).toUpperCase()).slice(0, 1);

  if (quiz.cover_image_url) {
    return (
      <div
        className={cn(
          'border-border-subtle relative overflow-hidden rounded-xl border',
          ratioClassName,
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={quiz.cover_image_url} alt={quiz.title} className="h-full w-full object-cover" />
        <div className="from-bg-primary/70 via-bg-primary/10 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="bg-bg-primary/60 absolute top-4 left-4 rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-white uppercase backdrop-blur-sm">
          {priorityLabel ?? getCoverEyebrow(locale, quiz.quiz_type)}
        </div>
        <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-4">
          <div className="max-w-[72%] min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-white/70 uppercase">
              {quiz.category?.name ?? getCoverOpenLabel(locale)}
            </p>
            <p className="mt-1 line-clamp-2 text-lg leading-tight font-semibold break-words text-white md:text-xl">
              {quiz.title}
            </p>
          </div>
          <div className="bg-bg-primary/50 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 text-xl font-semibold text-white backdrop-blur-sm">
            {letter}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border-subtle relative overflow-hidden rounded-xl border bg-gradient-to-br shadow-inner',
        theme.shell,
        ratioClassName,
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_40%)]" />
      <div className="bg-accent-primary/8 absolute top-6 -right-8 h-24 w-24 rounded-full blur-2xl" />
      <div
        className={cn(
          'absolute right-5 bottom-5 h-16 w-16 rounded-2xl bg-gradient-to-br opacity-60',
          theme.orb
        )}
      />
      <div className="relative flex h-full flex-col justify-between p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <span className="bg-accent-primary/10 text-accent-primary inline-flex rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.22em] uppercase">
              {priorityLabel ?? getCoverEyebrow(locale, quiz.quiz_type)}
            </span>
            <p className="text-text-muted max-w-[16rem] truncate text-[11px] font-semibold tracking-[0.24em] uppercase">
              {quiz.category?.name ?? getCoverOpenLabel(locale)}
            </p>
          </div>
          <div className="bg-accent-primary/10 text-accent-primary border-accent-primary/20 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-xl font-semibold">
            {letter}
          </div>
        </div>

        <div className={cn('min-w-0 space-y-3', compact && 'space-y-2')}>
          <h3
            className={cn(
              'text-text-primary line-clamp-2 max-w-[17rem] font-semibold tracking-tight break-words',
              compact ? 'text-xl' : 'text-2xl md:text-[1.75rem]'
            )}
          >
            {quiz.title}
          </h3>
          {quiz.description && (
            <p
              className={cn(
                'text-text-secondary max-w-[22rem]',
                compact ? 'line-clamp-2 text-sm leading-6' : 'line-clamp-3 text-[0.95rem] leading-7'
              )}
            >
              {quiz.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
