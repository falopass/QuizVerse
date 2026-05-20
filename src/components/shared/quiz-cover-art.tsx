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
          'relative overflow-hidden rounded-[1.7rem] border border-black/8 shadow-inner',
          ratioClassName,
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={quiz.cover_image_url} alt={quiz.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,10,0.08),rgba(16,12,10,0.18)_38%,rgba(16,12,10,0.72))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)]" />
        <div className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-white uppercase backdrop-blur-md">
          {priorityLabel ?? getCoverEyebrow(locale, quiz.quiz_type)}
        </div>
        <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-4">
          <div className="max-w-[72%] min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-white/72 uppercase">
              {quiz.category?.name ?? getCoverOpenLabel(locale)}
            </p>
            <p className="mt-2 line-clamp-2 text-xl leading-tight font-semibold break-words text-white md:text-2xl">
              {quiz.title}
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border border-white/18 bg-white/10 text-2xl font-semibold text-white backdrop-blur-md">
            {letter}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.7rem] border border-black/8 bg-gradient-to-br shadow-inner',
        theme.shell,
        ratioClassName,
        className
      )}
    >
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(24,20,16,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(24,20,16,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_38%)]" />
      <div className="absolute top-6 -right-8 h-28 w-28 rounded-full bg-white/26 blur-2xl" />
      <div
        className={cn(
          'absolute right-5 bottom-5 h-20 w-20 rounded-[1.8rem] bg-gradient-to-br opacity-90',
          theme.orb
        )}
      />
      <div className="relative flex h-full flex-col justify-between p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <span className="text-text-muted inline-flex rounded-full border border-black/8 bg-white/72 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] uppercase">
              {priorityLabel ?? getCoverEyebrow(locale, quiz.quiz_type)}
            </span>
            <p className="text-text-muted max-w-[16rem] text-[11px] font-semibold tracking-[0.24em] uppercase">
              {quiz.category?.name ?? getCoverOpenLabel(locale)}
            </p>
          </div>
          <div className="text-text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.45rem] border border-white/55 bg-white/50 text-2xl font-semibold">
            {letter}
          </div>
        </div>

        <div className={cn('space-y-3', compact && 'space-y-2')}>
          <h3
            className={cn(
              'text-text-primary max-w-[17rem] font-semibold tracking-tight',
              compact ? 'text-2xl' : 'text-[2rem] md:text-[2.35rem]'
            )}
          >
            {quiz.title}
          </h3>
          {quiz.description ? (
            <p
              className={cn(
                'text-text-secondary max-w-[22rem]',
                compact ? 'line-clamp-2 text-sm leading-6' : 'line-clamp-3 text-[0.98rem] leading-7'
              )}
            >
              {quiz.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
