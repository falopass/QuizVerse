'use client';

import { AdSlot } from './ad-slot';
import { getAdPlacementForQuestion } from '@/lib/ads/ad-placements';

export interface AdBetweenQuestionsProps {
  questionIndex: number;
  totalQuestions: number;
}

export function AdBetweenQuestions({ questionIndex, totalQuestions }: AdBetweenQuestionsProps) {
  const shouldShow = getAdPlacementForQuestion(questionIndex, totalQuestions);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="my-8">
      <div className="text-text-muted mb-3 text-center text-xs">Advertisement</div>
      <AdSlot
        slot={process.env.NEXT_PUBLIC_ADSENSE_IN_ARTICLE_SLOT || '1234567890'}
        format="fluid"
        layout="in-article"
        className="max-w-2xl"
      />
    </div>
  );
}

export default AdBetweenQuestions;
