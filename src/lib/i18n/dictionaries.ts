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
    randomQuiz: string;
    home: string;
    close: string;
    dismissNotification: string;
  };
  nav: {
    statement: string;
    search: string;
    menu: string;
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
    pagination: string;
    previousPage: string;
    nextPage: string;
    page: string;
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
    invite: string;
    inviteBody: string;
    copyInvite: string;
    copied: string;
  };
  error: {
    eyebrow: string;
    title: string;
    body: string;
    retry: string;
    home: string;
    browse: string;
  };
  userMenu: {
    signIn: string;
    account: string;
    label: string;
    activity: string;
    profile: string;
    quizzes: string;
    achievements: string;
    settings: string;
    signOut: string;
  };
  leaderboard: {
    title: string;
    description: string;
    headline: string;
    body: string;
    visiblePlayers: string;
    yourSpot: string;
    scopeLabel: string;
    tabGlobal: string;
    tabWeekly: string;
    tabFriends: string;
    emptyTitle: string;
    emptyBody: string;
    emptyCta: string;
    failedTitle: string;
    weeklyFailedTitle: string;
    weeklyEmptyTitle: string;
    weeklyEmptyBody: string;
    exploreCta: string;
    friendsSignInTitle: string;
    friendsFailedTitle: string;
    noFollowsTitle: string;
    noFollowsBody: string;
    yourRank: string;
    signInTitle: string;
    signInCta: string;
    quizzesPlayed: string;
    points: string;
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
      randomQuiz: 'Surprise me',
      home: 'Home',
      close: 'Close',
      dismissNotification: 'Dismiss notification',
    },
    nav: {
      statement: 'Editorial quizzes for curious people.',
      search: 'Search quizzes',
      menu: 'Menu',
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
        'Everything you need to know before you press play: the pace, the stakes and the payoff waiting at the end.',
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
      tagline: 'Pick a game. Play your pop culture. Share the result.',
    },
    arcade: {
      pickGame: 'Pick a game',
      heroTitle: 'Play your pop culture.',
      heroBody: 'Find your character. Prove you are a superfan. Do it in three minutes.',
      featured: 'Featured',
      playFeatured: 'Play featured quiz',
      stripStart: 'Personality ✦ Trivia ✦ Fandom',
      stripMiddle: 'New games every mood',
      stripEnd: 'Scroll to choose ↓',
      chooseGame: 'Choose your game',
      chooseBody: 'Pick one. Press play. Get your result.',
      play: 'Play',
      quickPlay: 'Quick play',
      backGames: '← Back to games',
      gameType: 'Game type',
      time: 'Time',
      language: 'Language',
      category: 'Category',
      visibleGames: 'Games shown',
      allCategories: 'All categories',
      pagination: 'Pagination',
      previousPage: 'Previous',
      nextPage: 'Next',
      page: 'Page',
      related: 'More games',
      about: 'About',
      privacy: 'Privacy',
      terms: 'Terms',
      contact: 'Contact',
      mainNavigation: 'Main navigation',
      footerNavigation: 'Footer links',
      startPlaying: 'Start playing',
      coverRole: 'Your role',
      coverTrivia: 'Fan test',
      invite: 'Share this quiz',
      inviteBody: 'Send the link to a friend and see what they score.',
      copyInvite: 'Copy link',
      copied: 'Copied!',
    },
    error: {
      eyebrow: 'Error',
      title: 'Something interrupted the flow.',
      body: 'The page could not finish loading. Try again, or jump back into the catalog.',
      retry: 'Try again',
      home: 'Go home',
      browse: 'Browse quizzes',
    },
    userMenu: {
      signIn: 'Sign in',
      account: 'Account',
      label: 'User menu',
      activity: 'My activity',
      profile: 'My profile',
      quizzes: 'My quizzes',
      achievements: 'My achievements',
      settings: 'Settings',
      signOut: 'Sign out',
    },
    leaderboard: {
      title: 'Player leaderboard',
      description:
        'See who leads the QuizVerse board: points, quizzes played and the most active players in the community.',
      headline: 'The people shaping the board.',
      body: 'Points, plays, and consistency. This is where QuizVerse starts looking like a habit.',
      visiblePlayers: 'Visible players',
      yourSpot: 'Your spot',
      scopeLabel: 'Leaderboard scope',
      tabGlobal: 'Global',
      tabWeekly: 'Weekly',
      tabFriends: 'Friends',
      emptyTitle: 'The board is empty.',
      emptyBody: 'Finish a quiz and your name opens the board.',
      emptyCta: 'Be the first on the board',
      failedTitle: 'We could not load the leaderboard.',
      weeklyFailedTitle: 'We could not load the weekly leaderboard.',
      weeklyEmptyTitle: 'Nobody has played this week yet.',
      weeklyEmptyBody:
        'Finish a quiz and you will show up here: the board only looks at the last 7 days.',
      exploreCta: 'Explore quizzes',
      friendsSignInTitle: 'Sign in to see the friends leaderboard.',
      friendsFailedTitle: 'We could not load your friends leaderboard.',
      noFollowsTitle: 'You are not following anyone yet.',
      noFollowsBody:
        'Follow other players from their profile and this board fills up with their activity and yours.',
      yourRank: 'Your rank',
      signInTitle: 'Sign in to see where you land.',
      signInCta: 'Sign in',
      quizzesPlayed: 'quizzes played',
      points: 'points',
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
      randomQuiz: 'Sorpréndeme',
      home: 'Inicio',
      close: 'Cerrar',
      dismissNotification: 'Cerrar aviso',
    },
    nav: {
      statement: 'Quizzes editoriales para gente curiosa.',
      search: 'Buscar quizzes',
      menu: 'Menú',
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
        'Todo lo que necesitas saber antes de jugar: el ritmo, lo que está en juego y la recompensa que te espera al final.',
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
      tagline: 'Elige un juego. Juega tu cultura pop. Comparte el resultado.',
    },
    arcade: {
      pickGame: 'Elige un juego',
      heroTitle: 'Juega tu cultura pop.',
      heroBody: 'Encuentra tu personaje. Demuestra que eres fan. Hazlo en tres minutos.',
      featured: 'Destacado',
      playFeatured: 'Jugar el destacado',
      stripStart: 'Personalidad ✦ Trivia ✦ Fandom',
      stripMiddle: 'Juegos para cada ánimo',
      stripEnd: 'Desliza para elegir ↓',
      chooseGame: 'Elige tu juego',
      chooseBody: 'Elige uno. Juega. Descubre tu resultado.',
      play: 'Jugar',
      quickPlay: 'Partida rápida',
      backGames: '← Volver a juegos',
      gameType: 'Tipo de juego',
      time: 'Tiempo',
      language: 'Idioma',
      category: 'Categoría',
      visibleGames: 'Juegos mostrados',
      allCategories: 'Todas las categorías',
      pagination: 'Paginación',
      previousPage: 'Anterior',
      nextPage: 'Siguiente',
      page: 'Página',
      related: 'Más juegos',
      about: 'Acerca de',
      privacy: 'Privacidad',
      terms: 'Términos',
      contact: 'Contacto',
      mainNavigation: 'Navegación principal',
      footerNavigation: 'Enlaces del pie',
      startPlaying: 'Empezar a jugar',
      coverRole: 'Tu rol',
      coverTrivia: 'Test fan',
      invite: 'Comparte este quiz',
      inviteBody: 'Manda el enlace a un amigo y mira qué puntaje saca.',
      copyInvite: 'Copiar enlace',
      copied: '¡Copiado!',
    },
    error: {
      eyebrow: 'Error',
      title: 'Algo interrumpió el flujo.',
      body: 'La página no pudo terminar de cargar. Intenta de nuevo o vuelve al catálogo.',
      retry: 'Reintentar',
      home: 'Ir al inicio',
      browse: 'Explorar quizzes',
    },
    userMenu: {
      signIn: 'Iniciar sesión',
      account: 'Cuenta',
      label: 'Menú de usuario',
      activity: 'Mi actividad',
      profile: 'Mi perfil',
      quizzes: 'Mis quizzes',
      achievements: 'Mis logros',
      settings: 'Ajustes',
      signOut: 'Cerrar sesión',
    },
    leaderboard: {
      title: 'Ranking de jugadores',
      description:
        'Mira quién lidera el ranking de QuizVerse: puntos, quizzes jugados y los jugadores más activos de la comunidad.',
      headline: 'Las personas que mueven el tablero.',
      body: 'Puntos, partidas y constancia. Aquí aparece quién está convirtiendo QuizVerse en hábito.',
      visiblePlayers: 'Jugadores visibles',
      yourSpot: 'Tu posición',
      scopeLabel: 'Alcance del ranking',
      tabGlobal: 'Global',
      tabWeekly: 'Semanal',
      tabFriends: 'Amigos',
      emptyTitle: 'El tablero está vacío.',
      emptyBody: 'Termina un quiz y tu nombre abre el ranking.',
      emptyCta: 'Sé el primero del ranking',
      failedTitle: 'No pudimos cargar el ranking.',
      weeklyFailedTitle: 'No pudimos cargar el ranking semanal.',
      weeklyEmptyTitle: 'Todavía nadie ha jugado esta semana.',
      weeklyEmptyBody:
        'Termina un quiz y aparecerás aquí: el tablero solo mira los últimos 7 días.',
      exploreCta: 'Explorar quizzes',
      friendsSignInTitle: 'Inicia sesión para ver el ranking entre amigos.',
      friendsFailedTitle: 'No pudimos cargar tu ranking de amigos.',
      noFollowsTitle: 'Todavía no sigues a nadie.',
      noFollowsBody:
        'Sigue a otros jugadores desde su perfil y este ranking se llena con su actividad y la tuya.',
      yourRank: 'Tu puesto',
      signInTitle: 'Inicia sesión para ver dónde caes.',
      signInCta: 'Entrar',
      quizzesPlayed: 'quizzes jugados',
      points: 'puntos',
    },
  },
};

export function hasLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export async function getDictionary(locale: string): Promise<Dictionary> {
  return dictionaries[hasLocale(locale) ? locale : defaultLocale];
}

// Síncrono, para componentes cliente que solo reciben `locale` y no pueden
// `await getDictionary`.
export function getCopy<K extends keyof Dictionary>(locale: string, section: K): Dictionary[K] {
  return dictionaries[hasLocale(locale) ? locale : defaultLocale][section];
}

export function getArcadeCopy(locale: Locale): Dictionary['arcade'] {
  return getCopy(locale, 'arcade');
}

// Síncrono, para las error pages (componentes cliente que no pueden
// `await getDictionary`).
export function getErrorCopy(locale: string): Dictionary['error'] {
  return getCopy(locale, 'error');
}

export function getCommonCopy(locale: Locale): Dictionary['common'] {
  return dictionaries[locale].common;
}
