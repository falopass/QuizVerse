import type { Locale } from '@/lib/i18n/dictionaries';
import { inferVisualProfile } from '@/lib/design/visual-profile';
import type { Quiz } from '@/types/quiz';

export interface CoverTheme {
  shell: string;
  accent: string;
  orb: string;
  panel: string;
  text: string;
  badge: string;
  base: string;
  highlight: string;
  deep: string;
}

const BASE_THEMES: Record<'personality' | 'trivia' | 'poll', CoverTheme> = {
  personality: {
    shell: 'from-[#f3cdbd] via-[#fff6f1] to-[#ead8ce]',
    accent: 'bg-[#bb5c35]',
    orb: 'from-[#f09162] to-[#6b3b2b]',
    panel: '#f3cdbd',
    text: '#201712',
    badge: '#8f3f22',
    base: '#bb5c35',
    highlight: '#f0ab77',
    deep: '#3b2018',
  },
  trivia: {
    shell: 'from-[#d8e7fb] via-[#f8fbff] to-[#ede3d8]',
    accent: 'bg-[#2d5f9c]',
    orb: 'from-[#4d8edf] to-[#16395c]',
    panel: '#d8e7fb',
    text: '#132033',
    badge: '#2d5f9c',
    base: '#2d5f9c',
    highlight: '#8db6ff',
    deep: '#18263d',
  },
  poll: {
    shell: 'from-[#e4e0fb] via-[#fcfbff] to-[#e8ddd6]',
    accent: 'bg-[#6f57b9]',
    orb: 'from-[#8d79dd] to-[#41306b]',
    panel: '#e4e0fb',
    text: '#201832',
    badge: '#6f57b9',
    base: '#6f57b9',
    highlight: '#b8a6ea',
    deep: '#241936',
  },
};

const THEME_BY_KEY = {
  'stranger-things': {
    panel: '#f6d9ce',
    text: '#27140f',
    badge: '#a33c2d',
    base: '#a64c33',
    highlight: '#f29663',
    deep: '#34181b',
  },
  'star-wars': {
    panel: '#dce7f5',
    text: '#162131',
    badge: '#315a8c',
    base: '#524332',
    highlight: '#ffb14d',
    deep: '#161311',
  },
  'the-boys': {
    panel: '#f1ddc7',
    text: '#241712',
    badge: '#9f4e28',
    base: '#35455f',
    highlight: '#f1b84a',
    deep: '#161c24',
  },
  euphoria: {
    panel: '#ead9ef',
    text: '#28182c',
    badge: '#8c4f89',
    base: '#63408b',
    highlight: '#ff7bb0',
    deep: '#1c1028',
  },
  're-zero': {
    panel: '#dde5fb',
    text: '#15233b',
    badge: '#4969b2',
    base: '#41506d',
    highlight: '#8db0ff',
    deep: '#171d2a',
  },
  'witch-hat-atelier': {
    panel: '#efe1d6',
    text: '#251913',
    badge: '#9c5d34',
    base: '#745547',
    highlight: '#dcb39a',
    deep: '#251913',
  },
  'dr-stone': {
    panel: '#d7f1e3',
    text: '#10261d',
    badge: '#227d54',
    base: '#2d5c55',
    highlight: '#71d1bc',
    deep: '#162320',
  },
  mario: {
    panel: '#f7dfc7',
    text: '#2a1c12',
    badge: '#cb6a22',
    base: '#c34f34',
    highlight: '#ffd260',
    deep: '#2b1a17',
  },
  hacks: {
    panel: '#efe0d8',
    text: '#241915',
    badge: '#9a5d3f',
    base: '#735040',
    highlight: '#ffb78a',
    deep: '#201412',
  },
  beef: {
    panel: '#f1dccf',
    text: '#26160f',
    badge: '#b05c34',
    base: '#7d392d',
    highlight: '#ff9e77',
    deep: '#2a1412',
  },
  'classroom-of-the-elite': {
    panel: '#dfe6ef',
    text: '#1a2028',
    badge: '#4b627d',
    base: '#544762',
    highlight: '#b8a6ea',
    deep: '#1f1a2a',
  },
  'generic-trivia': {
    panel: '#d8e7fb',
    text: '#132033',
    badge: '#2d5f9c',
    base: '#2d5f9c',
    highlight: '#8db6ff',
    deep: '#18263d',
  },
  'generic-personality': {
    panel: '#f3cdbd',
    text: '#201712',
    badge: '#8f3f22',
    base: '#bb5c35',
    highlight: '#f0ab77',
    deep: '#3b2018',
  },
  'generic-lifestyle': {
    panel: '#e7ded2',
    text: '#231a15',
    badge: '#8b6244',
    base: '#8b6244',
    highlight: '#dec0a3',
    deep: '#2a1b14',
  },
} as const;

export function getCoverTheme(
  quiz: Pick<Quiz, 'quiz_type' | 'title' | 'description' | 'category'> &
    Partial<Pick<Quiz, 'tags' | 'language'>>
): CoverTheme {
  const base = { ...BASE_THEMES[quiz.quiz_type] };
  const profile = inferVisualProfile({
    ...quiz,
    language: quiz.language ?? 'en',
    tags: quiz.tags ?? [],
    category: quiz.category ?? null,
  });
  const override = THEME_BY_KEY[profile.theme_key];

  return override ? { ...base, ...override } : base;
}

export function getCoverEyebrow(locale: Locale, quizType: Quiz['quiz_type']) {
  if (locale === 'es') {
    if (quizType === 'personality') return 'Selección de personalidad';
    if (quizType === 'trivia') return 'Selección de trivia';
    return 'Selección editorial';
  }

  if (quizType === 'personality') return 'Personality pick';
  if (quizType === 'trivia') return 'Trivia pick';
  return 'Editorial pick';
}

export function getCoverOpenLabel(locale: Locale) {
  return locale === 'es' ? 'Abrir quiz' : 'Open quiz';
}
