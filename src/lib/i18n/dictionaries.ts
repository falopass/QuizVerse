export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export interface Dictionary {
  localeLabel: string;
  common: {
    explore: string;
    create: string;
    leaderboard: string;
    login: string;
    signup: string;
    playNow: string;
    loading: string;
    minutesShort: string;
    questionsShort: string;
    backHome: string;
    switchLocale: string;
  };
  nav: {
    statement: string;
    search: string;
  };
  home: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    featuredTitle: string;
    featuredBody: string;
    quickTitle: string;
    quickBody: string;
    sections: {
      momentum: string;
      moods: string;
      categories: string;
      discovery: string;
    };
  };
  explore: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    sortPopular: string;
    sortRecent: string;
    sortTitle: string;
    allCategories: string;
    emptyTitle: string;
    emptyBody: string;
  };
  detail: {
    eyebrow: string;
    duration: string;
    difficulty: string;
    plays: string;
    likes: string;
    supporting: string;
    primaryCta: string;
    secondaryCta: string;
    preview: string;
    whatToExpect: string;
    questionPreview: string;
    previewHeadline: string;
    relatedEyebrow: string;
    relatedHeadline: string;
    socialProof: string;
    whyPlay: string;
    perfectFor: string;
    moreLikeThis: string;
    personality: string;
    trivia: string;
    poll: string;
  };
  auth: {
    title: string;
    subtitle: string;
    guest: string;
  };
  create: {
    title: string;
    subtitle: string;
    aiTitle: string;
    aiSubtitle: string;
  };
  result: {
    share: string;
    playAgain: string;
    review: string;
    exploreMore: string;
    yourScore: string;
    summary: string;
  };
  footer: {
    tagline: string;
  };
  arcade: {
    pickGame: string;
    heroTitle: string;
    heroBody: string;
    featured: string;
    playFeatured: string;
    stripStart: string;
    stripMiddle: string;
    stripEnd: string;
    chooseGame: string;
    chooseBody: string;
    play: string;
    quickPlay: string;
    backGames: string;
    gameType: string;
    time: string;
    language: string;
    category: string;
    visibleGames: string;
    allCategories: string;
    related: string;
    about: string;
    privacy: string;
    terms: string;
    contact: string;
    mainNavigation: string;
    footerNavigation: string;
    startPlaying: string;
    coverRole: string;
    coverTrivia: string;
  };
}

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    localeLabel: 'English',
    common: {
      explore: 'Explore',
      create: 'Create',
      leaderboard: 'Leaderboard',
      login: 'Log in',
      signup: 'Join now',
      playNow: 'Play now',
      loading: 'Loading',
      minutesShort: 'min',
      questionsShort: 'questions',
      backHome: 'Back home',
      switchLocale: 'Language',
    },
    nav: {
      statement: 'Editorial quizzes for curious people.',
      search: 'Search quizzes',
    },
    home: {
      eyebrow: 'Not another template quiz site',
      title: 'A quiz universe with',
      titleAccent: 'real editorial taste',
      subtitle:
        'Play cinematic personality tests, sharp trivia and quick social formats that feel crafted, not assembled from a UI kit.',
      primaryCta: 'Start exploring',
      secondaryCta: 'Create with AI',
      featuredTitle: 'High-conviction discovery',
      featuredBody:
        'Trending, fast plays, strong personalities and evergreen culture in one place.',
      quickTitle: 'Built for momentum',
      quickBody: 'Browse quickly, land on a quiz fast and get a result worth sharing.',
      sections: {
        momentum: 'Momentum',
        moods: 'Browse by mood',
        categories: 'Category spectrum',
        discovery: 'Fresh discovery',
      },
    },
    explore: {
      title: 'Explore the full catalog',
      subtitle: 'Search by feeling, topic, pace or popularity.',
      searchPlaceholder: 'Search for fandoms, topics, vibes or creators',
      sortPopular: 'Most played',
      sortRecent: 'Newest',
      sortTitle: 'Title',
      allCategories: 'All categories',
      emptyTitle: 'Nothing matched that search',
      emptyBody: 'Try a broader keyword or switch category.',
    },
    detail: {
      eyebrow: 'Play this next',
      duration: 'Duration',
      difficulty: 'Difficulty',
      plays: 'Plays',
      likes: 'Likes',
      supporting:
        'A polished quiz page should sell the rhythm, stakes and payoff before the first tap. This one now does exactly that.',
      primaryCta: 'Start this quiz',
      secondaryCta: 'Browse more quizzes',
      preview: 'Preview',
      whatToExpect: 'What to expect',
      questionPreview: 'Inside the flow',
      previewHeadline: 'A first look at the pacing',
      relatedEyebrow: 'Stay in the lane',
      relatedHeadline: 'More quizzes with the same energy',
      socialProof: 'people have already played this one',
      whyPlay: 'Why this works',
      perfectFor: 'Perfect for',
      moreLikeThis: 'More in this lane',
      personality: 'Personality quiz',
      trivia: 'Trivia challenge',
      poll: 'Opinion poll',
    },
    auth: {
      title: 'Step into QuizVerse',
      subtitle: 'Save your streaks, publish quizzes and keep your favorite results close.',
      guest: 'Continue as guest',
    },
    create: {
      title: 'Craft a quiz with intention',
      subtitle: 'Shape the story, pacing and payoff before you publish.',
      aiTitle: 'Generate a first draft with AI',
      aiSubtitle: 'Start from a prompt, then edit the result into something worth sharing.',
    },
    result: {
      share: 'Share my result',
      playAgain: 'Play again',
      review: 'Review answers',
      exploreMore: 'Explore more quizzes',
      yourScore: 'Your score',
      summary: 'Session summary',
    },
    footer: {
      tagline:
        'QuizVerse turns quizzes into a sharper editorial product, not generic content sludge.',
    },
    arcade: {
      pickGame: 'Pick a game', heroTitle: 'Play your pop culture.',
      heroBody: 'Find your character. Prove you are a superfan. Do it in three minutes.',
      featured: 'Featured', playFeatured: 'Play featured quiz',
      stripStart: 'Personality ✦ Trivia ✦ Fandom', stripMiddle: 'New games every mood', stripEnd: 'Scroll to choose ↓',
      chooseGame: 'Choose your game', chooseBody: 'Pick one. Press play. Get your result.',
      play: 'Play', quickPlay: 'Quick play', backGames: '← Back to games',
      gameType: 'Game type', time: 'Time', language: 'Language',
      category: 'Category', visibleGames: 'Games shown', allCategories: 'All categories',
      related: 'More games', about: 'About', privacy: 'Privacy', terms: 'Terms', contact: 'Contact',
      mainNavigation: 'Main navigation', footerNavigation: 'Footer links', startPlaying: 'Start playing',
      coverRole: 'Your role', coverTrivia: 'Fan test',
    },
  },
  es: {
    localeLabel: 'Español',
    common: {
      explore: 'Explorar',
      create: 'Crear',
      leaderboard: 'Ranking',
      login: 'Entrar',
      signup: 'Únete',
      playNow: 'Jugar ahora',
      loading: 'Cargando',
      minutesShort: 'min',
      questionsShort: 'preguntas',
      backHome: 'Volver al inicio',
      switchLocale: 'Idioma',
    },
    nav: {
      statement: 'Quizzes editoriales para gente curiosa.',
      search: 'Buscar quizzes',
    },
    home: {
      eyebrow: 'No es otra web de quizzes de plantilla',
      title: 'Un universo de quizzes con',
      titleAccent: 'criterio editorial real',
      subtitle:
        'Juega tests de personalidad con carácter, trivia afilada y formatos rápidos que se sienten diseñados, no ensamblados desde un kit.',
      primaryCta: 'Empezar a explorar',
      secondaryCta: 'Crear con AI',
      featuredTitle: 'Descubrimiento con intención',
      featuredBody:
        'Tendencias, partidas rápidas, personalidades marcadas y cultura evergreen en un solo lugar.',
      quickTitle: 'Diseñado para el ritmo',
      quickBody:
        'Navega rápido, encuentra un quiz enseguida y consigue un resultado que sí vale la pena compartir.',
      sections: {
        momentum: 'Impulso',
        moods: 'Explorar por mood',
        categories: 'Mapa de categorías',
        discovery: 'Descubrimiento fresco',
      },
    },
    explore: {
      title: 'Explora el catálogo completo',
      subtitle: 'Busca por tema, vibra, ritmo o popularidad.',
      searchPlaceholder: 'Busca fandoms, temas, moods o creadores',
      sortPopular: 'Más jugados',
      sortRecent: 'Más nuevos',
      sortTitle: 'Título',
      allCategories: 'Todas las categorías',
      emptyTitle: 'No encontramos coincidencias',
      emptyBody: 'Prueba una búsqueda más amplia o cambia la categoría.',
    },
    detail: {
      eyebrow: 'Tu siguiente quiz',
      duration: 'Duración',
      difficulty: 'Dificultad',
      plays: 'Partidas',
      likes: 'Me gusta',
      supporting:
        'Una buena página de detalle debe vender ritmo, expectativa y recompensa antes del primer tap. Ahora esta experiencia sí lo hace.',
      primaryCta: 'Empezar quiz',
      secondaryCta: 'Ver más quizzes',
      preview: 'Vista previa',
      whatToExpect: 'Qué esperar',
      questionPreview: 'Dentro del flujo',
      previewHeadline: 'Un vistazo al ritmo del quiz',
      relatedEyebrow: 'Sigue en este mood',
      relatedHeadline: 'Más quizzes con esta energía',
      socialProof: 'personas ya jugaron este quiz',
      whyPlay: 'Por qué funciona',
      perfectFor: 'Ideal para',
      moreLikeThis: 'Más de este estilo',
      personality: 'Quiz de personalidad',
      trivia: 'Trivia',
      poll: 'Encuesta',
    },
    auth: {
      title: 'Entra a QuizVerse',
      subtitle: 'Guarda tus rachas, publica quizzes y conserva tus resultados favoritos.',
      guest: 'Continuar como invitado',
    },
    create: {
      title: 'Crea un quiz con intención',
      subtitle: 'Define historia, ritmo y payoff antes de publicar.',
      aiTitle: 'Genera un primer borrador con AI',
      aiSubtitle: 'Parte desde un prompt y edita el resultado hasta que valga la pena compartirlo.',
    },
    result: {
      share: 'Compartir mi resultado',
      playAgain: 'Jugar de nuevo',
      review: 'Revisar respuestas',
      exploreMore: 'Explorar más quizzes',
      yourScore: 'Tu puntuación',
      summary: 'Resumen de la sesión',
    },
    footer: {
      tagline:
        'QuizVerse convierte los quizzes en un producto editorial con criterio, no en contenido genérico.',
    },
    arcade: {
      pickGame: 'Elige un juego', heroTitle: 'Juega tu cultura pop.',
      heroBody: 'Encuentra tu personaje. Demuestra que eres fan. Hazlo en tres minutos.',
      featured: 'Destacado', playFeatured: 'Jugar quiz destacado',
      stripStart: 'Personalidad ✦ Trivia ✦ Fandom', stripMiddle: 'Juegos para cada ánimo', stripEnd: 'Desliza para elegir ↓',
      chooseGame: 'Elige tu juego', chooseBody: 'Elige uno. Juega. Descubre tu resultado.',
      play: 'Jugar', quickPlay: 'Partida rápida', backGames: '← Volver a juegos',
      gameType: 'Tipo de juego', time: 'Tiempo', language: 'Idioma',
      category: 'Categoría', visibleGames: 'Juegos mostrados', allCategories: 'Todas las categorías',
      related: 'Más juegos', about: 'Acerca de', privacy: 'Privacidad', terms: 'Términos', contact: 'Contacto',
      mainNavigation: 'Navegación principal', footerNavigation: 'Enlaces del pie', startPlaying: 'Empezar a jugar',
      coverRole: 'Tu rol', coverTrivia: 'Test fan',
    },
  },
};

export function hasLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export async function getDictionary(locale: string): Promise<Dictionary> {
  return dictionaries[hasLocale(locale) ? locale : defaultLocale];
}

export function getArcadeCopy(locale: Locale): Dictionary['arcade'] {
  return dictionaries[locale].arcade;
}
