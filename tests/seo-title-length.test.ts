import { describe, expect, it } from 'vitest';
import { generateCategoryMetadata, resolveTitle } from '@/lib/seo/metadata';

describe('resolveTitle', () => {
  it('keeps the template suffix when title + suffix fit in 60 chars', () => {
    expect(resolveTitle('x'.repeat(40), false)).toBe('x'.repeat(40));
  });

  it('drops the suffix when title + suffix exceed 60 chars', () => {
    const title = 'x'.repeat(50); // 50 + 12 = 62
    expect(resolveTitle(title, false)).toEqual({ absolute: title });
  });

  it('drops the suffix at 60 chars', () => {
    const title = 'x'.repeat(60);
    expect(resolveTitle(title, false)).toEqual({ absolute: title });
  });

  it('always returns absolute when absoluteTitle is true', () => {
    const title = 'x'.repeat(20);
    expect(resolveTitle(title, true)).toEqual({ absolute: title });
  });

  it('never truncates the title itself', () => {
    const title = 'x'.repeat(100);
    expect(resolveTitle(title, false)).toEqual({ absolute: title });
  });
});

describe('generateCategoryMetadata', () => {
  it('still produces a templated title for short category names', () => {
    const metadata = generateCategoryMetadata({
      name: 'Anime & Manga',
      slug: 'anime-manga',
      quizCount: 12,
    });
    expect(typeof metadata.title).toBe('string');
  });
});
