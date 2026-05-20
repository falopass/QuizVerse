'use client';

import { AdSlot } from './ad-slot';

export interface AdSidebarProps {
  className?: string;
  variant?: 'rectangle' | 'skyscraper';
}

export function AdSidebar({ className, variant = 'rectangle' }: AdSidebarProps) {
  const slot =
    variant === 'rectangle'
      ? process.env.NEXT_PUBLIC_ADSENSE_RECTANGLE_SLOT || '1234567890'
      : process.env.NEXT_PUBLIC_ADSENSE_SKYSCRAPER_SLOT || '0987654321';

  const format = variant === 'rectangle' ? 'rectangle' : 'vertical';

  return (
    <div className={className}>
      <div className="text-text-muted mb-3 text-center text-xs">Advertisement</div>
      <AdSlot slot={slot} format={format} className="w-full" />
    </div>
  );
}

export default AdSidebar;
