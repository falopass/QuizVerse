'use client';

import { useCallback } from 'react';
import { useToast } from '@/providers/toast-provider';

export function useShare() {
  const { success, error } = useToast();

  const share = useCallback(
    async (title: string, text: string, url: string) => {
      const shareData = { title, text, url };

      // Web Share API (mobile)
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          success('Shared successfully!');
          return true;
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            return false;
          }
          error('Failed to share');
          return false;
        }
      }

      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        success('Link copied to clipboard!');
        return true;
      } catch {
        error('Failed to copy link');
        return false;
      }
    },
    [success, error]
  );

  const shareToWhatsApp = useCallback((text: string, url: string) => {
    const encoded = encodeURIComponent(`${text} ${url}`);
    const shareUrl = `https://wa.me/?text=${encoded}`;
    window.open(shareUrl, '_blank');
  }, []);

  const shareToTwitter = useCallback((text: string, url: string) => {
    const encodedText = encodeURIComponent(text);
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    share,
    shareToWhatsApp,
    shareToTwitter,
    copyToClipboard,
  };
}

export default useShare;
