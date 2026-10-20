import type { Locale } from './dictionaries';

export interface ExploreCopy {
  eyebrow: string;
  visibleNow: string;
  playsInView: string;
  publishedNow: string;
  search: string;
  categoryLanes: string;
  leadPick: string;
  pulse: string;
  moreWaysIn: string;
  quizzesAfterFilters: string;
  showMore: (count: number) => string;
  showLess: string;
  editorialGrid: string;
  editorDeck: string;
  min: string;
  plays: string;
  open: string;
  lanesTitle: string;
  pulseDeck: string;
}

const EXPLORE_COPY: Record<Locale, ExploreCopy> = {
  es: {
    eyebrow: 'Explorar',
    visibleNow: 'Visibles ahora',
    playsInView: 'Partidas en vista',
    publishedNow: 'Publicados ahora',
    search: 'Buscar',
    categoryLanes: 'Carriles editoriales',
    leadPick: 'Selección principal',
    pulse: 'Pulso del momento',
    moreWaysIn: 'Más caminos de entrada',
    quizzesAfterFilters: 'quizzes tras filtros',
    showMore: (count: number) => `Ver los ${count} restantes`,
    showLess: 'Mostrar menos',
    editorialGrid: 'Entradas curadas',
    editorDeck:
      'No es solo volumen: ahora el catálogo prioriza quizzes con una promesa más clara, mejor ritmo y mejor superficie visual.',
    min: 'min',
    plays: 'partidas',
    open: 'Abrir',
    lanesTitle: 'Los mejores caminos para entrar',
    pulseDeck:
      'La segunda carta fuerte no debería perderse en una grilla plana. Aquí le damos un espacio propio para convertir mejor.',
  },
  en: {
    eyebrow: 'Explore',
    visibleNow: 'Visible now',
    playsInView: 'Plays in view',
    publishedNow: 'Published now',
    search: 'Search',
    categoryLanes: 'Editorial lanes',
    leadPick: 'Lead pick',
    pulse: 'Now in pulse',
    moreWaysIn: 'More ways in',
    quizzesAfterFilters: 'quizzes after filters',
    showMore: (count: number) => `Show the ${count} remaining`,
    showLess: 'Show less',
    editorialGrid: 'Curated entries',
    editorDeck:
      'This is not just volume. The catalog now surfaces quizzes with a stronger promise, better pacing and cleaner visual priority.',
    min: 'min',
    plays: 'plays',
    open: 'Open',
    lanesTitle: 'The best ways in',
    pulseDeck:
      'The second-strongest quiz should not disappear inside a flat grid, so it gets its own selling space here.',
  },
};

export function getExploreCopy(locale: Locale): ExploreCopy {
  return EXPLORE_COPY[locale];
}
