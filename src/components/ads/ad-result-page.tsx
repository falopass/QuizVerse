'use client';

import { AdSlot } from './ad-slot';

export interface AdResultPageProps {
  className?: string;
}

export function AdResultPage({ className }: AdResultPageProps) {
  return (
    <div className={className}>
      <div className="text-text-muted mb-3 text-center text-xs">Advertisement</div>
      <AdSlot
        slot={process.env.NEXT_PUBLIC_ADSENSE_RECTANGLE_SLOT || '1234567890'}
        format="rectangle"
        className="mx-auto w-full max-w-md"
      />
    </div>
  );
}

export default AdResultPage;
