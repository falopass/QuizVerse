/**
 * AdSense configuration and helpers
 */

export const ADSENSE_PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || '';

export interface AdSlotProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  layout?: 'in-article' | 'in-feed' | 'fixed';
  className?: string;
}

export function getAdScript(): string {
  return `
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}"
     crossorigin="anonymous"></script>
  `.trim();
}

export function getDefaultAdUnits() {
  return {
    // Leaderboard (728x90) - desktop header
    leaderboard: process.env.NEXT_PUBLIC_ADSENSE_LEADERBOARD_SLOT || '',
    // Rectangle (300x250) - sidebar
    rectangle: process.env.NEXT_PUBLIC_ADSENSE_RECTANGLE_SLOT || '',
    // In-article native ad
    inArticle: process.env.NEXT_PUBLIC_ADSENSE_IN_ARTICLE_SLOT || '',
    // In-feed native ad
    inFeed: process.env.NEXT_PUBLIC_ADSENSE_IN_FEED_SLOT || '',
    // Anchor ad (mobile)
    anchor: process.env.NEXT_PUBLIC_ADSENSE_ANCHOR_SLOT || '',
  };
}

export interface AdPlacement {
  id: string;
  format: 'display' | 'native' | 'anchor';
  size: string;
  location: 'header' | 'sidebar' | 'between-content' | 'footer' | 'mobile-bottom';
  enabled: boolean;
}

export const AD_PLACEMENTS: AdPlacement[] = [
  {
    id: 'header-leaderboard',
    format: 'display',
    size: '728x90',
    location: 'header',
    enabled: true,
  },
  {
    id: 'sidebar-rectangle',
    format: 'display',
    size: '300x250',
    location: 'sidebar',
    enabled: true,
  },
  {
    id: 'between-questions',
    format: 'native',
    size: 'fluid',
    location: 'between-content',
    enabled: true,
  },
  {
    id: 'result-page-rectangle',
    format: 'display',
    size: '336x280',
    location: 'sidebar',
    enabled: true,
  },
  {
    id: 'mobile-anchor',
    format: 'anchor',
    size: '320x50',
    location: 'mobile-bottom',
    enabled: true,
  },
];

export function shouldShowAd(position: number, interval: number = 5): boolean {
  // Show ad every N positions, but not on the first item
  return position > 0 && position % interval === 0;
}

export function isAdAllowed(): boolean {
  // Check if we're in production and have valid publisher ID
  return process.env.NODE_ENV === 'production' && ADSENSE_PUBLISHER_ID !== '';
}

export default ADSENSE_PUBLISHER_ID;
