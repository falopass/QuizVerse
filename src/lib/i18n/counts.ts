import type { Locale } from './dictionaries';

export function countLabel(
  count: number,
  locale: Locale,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function visibleGamesLabel(count: number, locale: Locale): string {
  return locale === 'es'
    ? countLabel(count, locale, 'juego mostrado', 'juegos mostrados')
    : countLabel(count, locale, 'game shown', 'games shown');
}

export function categoryDescription(input: {
  count: number;
  name: string;
  tagline?: string | null;
  locale: Locale;
}): string {
  const tagline = input.tagline?.trim();
  const lead = tagline ? `${tagline} ` : '';
  const word = input.count === 1 ? 'quiz' : 'quizzes';
  return input.locale === 'es'
    ? `${lead}${input.count} ${word} de ${input.name} gratis en QuizVerse, con resultado al instante y sin registro.`
    : `${lead}${input.count} free ${input.name} ${word} on QuizVerse, with instant results and no signup.`;
}

export function quizCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'quiz' : 'quizzes'}`;
}
