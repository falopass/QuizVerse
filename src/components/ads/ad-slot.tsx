'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

export interface AdSlotProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  layout?: 'in-article' | 'in-feed' | 'fixed';
  className?: string;
  disabled?: boolean;
}

export function AdSlot({ slot, format = 'auto', layout, className, disabled = false }: AdSlotProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (disabled) return;

    try {
      // Push ad configuration to Google
      const win = window as typeof window & {
        adsbygoogle: unknown[];
      };
      (win.adsbygoogle = win.adsbygoogle || []).push({});
      setIsLoading(false);
    } catch (error) {
      console.error('Ad failed to load:', error);
      setHasError(true);
    }

    // Cleanup timer
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [slot, disabled]);

  if (disabled || !process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID) {
    return null;
  }

  if (hasError) {
    return null; // Fail silently - don't show broken ad
  }

  return (
    <div
      className={cn(
        'relative flex justify-center items-center',
        'my-6 mx-auto',
        className
      )}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      )}
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default AdSlot;
