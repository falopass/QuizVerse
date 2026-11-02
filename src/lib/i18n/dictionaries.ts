export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export interface Dictionary {
  common: {
    explore: string;
    create: string;
    leaderboard: string;
    login: string;
    playNow: string;
    minutesShort: string;
    questionsShort: string;
    switchLocale: string;
    randomQuiz: string;
    home: string;
    close: string;
    dismissNotification: string;
  };
  nav: {
    menu: string;
  };
  home: {
    sections: {
      categories: string;
      discovery: string;
    };
  };
  explore: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allCategories: string;
    emptyTitle: string;
    emptyBody: string;
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
    backGames: string;
    gameType: string;
    time: string;
    language: string;
    category: string;
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
    categoryNavigation: string;
    startPlaying: string;
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
    common: {
      explore: 'Explore',
      create: 'Create',
      leaderboard: 'Leaderboard',
      login: 'Log in',
      playNow: 'Play now',
      minutesShort: 'min',
      questionsShort: 'questions',
      switchLocale: 'Language',
      randomQuiz: 'Surprise me',
      home: 'Home',
      close: 'Close',
      dismissNotification: 'Dismiss notification',
    },
    nav: {
      menu: 'Menu',
    },
    home: {
      sections: {
        categories: 'Category spectrum',
        discovery: 'Fresh discovery',
      },
    },
    explore: {
      title: 'Explore the full catalog',
      subtitle: 'Search by feeling, topic, pace or popularity.',
      searchPlaceholder: 'Search for fandoms, topics, vibes or creators',
      allCategories: 'All categories',
      emptyTitle: 'Nothing matched that search',
      emptyBody: 'Try a broader keyword or switch category.',
    },
    auth: {
      title: 'Step into QuizVerse',
      subtitle: 'Keep your history, your results and the quizzes you publish.',
      guest: 'Continue as guest',
    },
    create: {
      title: 'Craft a quiz with intention',
      subtitle: 'Shape the story, pacing and payoff before you publish.',
      aiTitle: 'Generate a first draft with AI',
      aiSubtitle: 'Start from a prompt, then edit the result into something worth sharing.',
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
      backGames: '← Back to games',
      gameType: 'Game type',
      time: 'Time',
      language: 'Language',
      category: 'Category',
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
      categoryNavigation: 'Category shortcuts',
      startPlaying: 'Start playing',
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
    common: {
      explore: 'Explorar',
      create: 'Crear',
      leaderboard: 'Ranking',
      login: 'Entrar',
      playNow: 'Jugar ahora',
      minutesShort: 'min',
      questionsShort: 'preguntas',
      switchLocale: 'Idioma',
      randomQuiz: 'Sorpréndeme',
      home: 'Inicio',
      close: 'Cerrar',
      dismissNotification: 'Cerrar aviso',
    },
    nav: {
      menu: 'Menú',
    },
    home: {
      sections: {
        categories: 'Mapa de categorías',
        discovery: 'Descubrimiento fresco',
      },
    },
    explore: {
      title: 'Explora el catálogo completo',
      subtitle: 'Busca por tema, ánimo, ritmo o popularidad.',
      searchPlaceholder: 'Busca fandoms, temas, estados de ánimo o creadores',
      allCategories: 'Todas las categorías',
      emptyTitle: 'No encontramos coincidencias',
      emptyBody: 'Prueba una búsqueda más amplia o cambia la categoría.',
    },
    auth: {
      title: 'Entra a QuizVerse',
      subtitle: 'Guarda tu historial, tus resultados y los quizzes que publiques.',
      guest: 'Continuar como invitado',
    },
    create: {
      title: 'Crea un quiz con intención',
      subtitle: 'Define historia, ritmo y payoff antes de publicar.',
      aiTitle: 'Genera un primer borrador con IA',
      aiSubtitle: 'Parte desde un prompt y edita el resultado hasta que valga la pena compartirlo.',
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
      backGames: '← Volver a juegos',
      gameType: 'Tipo de juego',
      time: 'Tiempo',
      language: 'Idioma',
      category: 'Categoría',
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
      categoryNavigation: 'Atajos de categorías',
      startPlaying: 'Empezar a jugar',
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
