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
    editorDeck: 'Otra puerta de entrada al catálogo: empieza por la categoría que más te llame.',
    min: 'min',
    plays: 'partidas',
    open: 'Abrir',
    lanesTitle: 'Los mejores caminos para entrar',
    pulseDeck: 'De los más jugados del catálogo.',
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
    editorDeck: 'Another way into the catalog: start with the category that pulls you in.',
    min: 'min',
    plays: 'plays',
    open: 'Open',
    lanesTitle: 'The best ways in',
    pulseDeck: 'One of the most played in the catalog.',
  },
};

export function getExploreCopy(locale: Locale): ExploreCopy {
  return EXPLORE_COPY[locale];
}
