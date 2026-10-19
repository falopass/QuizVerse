import type { Quiz, ThemeKey, VisualFamily, VisualProfile } from '@/types/quiz';

type QuizVisualInput = Pick<
  Quiz,
  'title' | 'description' | 'quiz_type' | 'tags' | 'category' | 'language'
>;

interface VisualPreset {
  themeKey: ThemeKey;
  visualFamily: VisualFamily;
  searchTerms: string[];
  prompt: {
    en: string;
    es: string;
  };
}

const VISUAL_PRESETS: Array<{ match: RegExp; preset: VisualPreset }> = [
  {
    match: /stranger things|upside down|hawkins/i,
    preset: {
      themeKey: 'stranger-things',
      visualFamily: 'retro-mystery',
      searchTerms: ['retro suburb night', 'red fog forest', '80s mystery lights'],
      prompt: {
        en: 'retro suburban night, eerie red mist, editorial thriller atmosphere, no copyrighted characters',
        es: 'noche suburbana retro, niebla roja inquietante, atmósfera editorial de thriller, sin personajes con copyright',
      },
    },
  },
  {
    match: /star wars|maul|jedi|sith/i,
    preset: {
      themeKey: 'star-wars',
      visualFamily: 'space-opera',
      searchTerms: ['desert planet horizon', 'space opera glow', 'sci-fi duel silhouette'],
      prompt: {
        en: 'space opera horizon, desert planet, glowing red and amber light, premium editorial sci-fi, no copyrighted characters',
        es: 'horizonte de space opera, planeta desértico, luz roja y ámbar, sci-fi editorial premium, sin personajes con copyright',
      },
    },
  },
  {
    match: /the boys|vought|homelander/i,
    preset: {
      themeKey: 'the-boys',
      visualFamily: 'corporate-chaos',
      searchTerms: [
        'corporate skyline night',
        'hero propaganda poster mood',
        'urban chaos spotlight',
      ],
      prompt: {
        en: 'corporate skyline, propaganda-like spotlight, urban chaos editorial tone, no copyrighted characters',
        es: 'skyline corporativo, luz tipo propaganda, tono editorial de caos urbano, sin personajes con copyright',
      },
    },
  },
  {
    match: /euphoria/i,
    preset: {
      themeKey: 'euphoria',
      visualFamily: 'neon-drama',
      searchTerms: ['pink blue neon room', 'night glitter blur', 'moody neon interior'],
      prompt: {
        en: 'neon nightlife mood, glitter, pink and blue glow, teen drama editorial styling, no copyrighted characters',
        es: 'mood nocturno con neón, glitter, brillo rosa y azul, estilo editorial de drama juvenil, sin personajes con copyright',
      },
    },
  },
  {
    match: /re:zero|re-zero|lugunica|subaru/i,
    preset: {
      themeKey: 're-zero',
      visualFamily: 'dark-fantasy',
      searchTerms: ['fantasy clock tower', 'blue moon magic', 'dark royal corridor'],
      prompt: {
        en: 'dark fantasy corridor, moonlit blue magic, royal mystery, premium editorial anime mood, no copyrighted characters',
        es: 'corredor de fantasía oscura, magia azul a la luz de la luna, misterio real, mood anime editorial premium, sin personajes con copyright',
      },
    },
  },
  {
    match: /witch hat atelier|coco|qifrey/i,
    preset: {
      themeKey: 'witch-hat-atelier',
      visualFamily: 'dark-fantasy',
      searchTerms: ['ink magic workshop', 'fantasy atelier desk', 'mystic parchment glow'],
      prompt: {
        en: 'fantasy atelier, parchment, ink magic glow, crafted editorial fantasy mood, no copyrighted characters',
        es: 'atelier de fantasía, pergamino, brillo de magia con tinta, mood editorial de fantasía, sin personajes con copyright',
      },
    },
  },
  {
    match: /dr\. stone|science future|senku/i,
    preset: {
      themeKey: 'dr-stone',
      visualFamily: 'science-lab',
      searchTerms: ['glass lab glow', 'science table minerals', 'clean experiment setup'],
      prompt: {
        en: 'editorial science lab, glass reflections, minerals and formulas, optimistic discovery mood, no copyrighted characters',
        es: 'laboratorio científico editorial, reflejos en vidrio, minerales y fórmulas, mood de descubrimiento optimista, sin personajes con copyright',
      },
    },
  },
  {
    match: /mario|galaxy|platformer/i,
    preset: {
      themeKey: 'mario',
      visualFamily: 'bright-platformer',
      searchTerms: ['bright cosmic platformer', 'toy-like planets', 'colorful arcade sky'],
      prompt: {
        en: 'bright cosmic platformer world, playful planets, joyful editorial game mood, no copyrighted characters',
        es: 'mundo de plataformas cósmico y brillante, planetas juguetones, mood editorial alegre de juego, sin personajes con copyright',
      },
    },
  },
  {
    match: /hacks|deborah vance|stand-up|comedy/i,
    preset: {
      themeKey: 'hacks',
      visualFamily: 'comedy-stage',
      searchTerms: ['comedy club spotlight', 'velvet theater stage', 'microphone backstage glow'],
      prompt: {
        en: 'comedy club stage, velvet theater glow, microphone and backstage glamour, editorial entertainment look',
        es: 'escenario de club de comedia, brillo de teatro de terciopelo, micrófono y glamour backstage, look editorial de entretenimiento',
      },
    },
  },
  {
    match: /beef|danny|amy|conflict/i,
    preset: {
      themeKey: 'beef',
      visualFamily: 'corporate-chaos',
      searchTerms: [
        'road rage urban tension',
        'suburban confrontation mood',
        'tense modern drama frame',
      ],
      prompt: {
        en: 'modern urban tension, suburban confrontation energy, sharp dramatic editorial look, no copyrighted characters',
        es: 'tensión urbana moderna, energía de confrontación suburbana, look editorial dramático y afilado, sin personajes con copyright',
      },
    },
  },
  {
    match: /classroom of the elite|ayanokoji|academy/i,
    preset: {
      themeKey: 'classroom-of-the-elite',
      visualFamily: 'academic-strategy',
      searchTerms: [
        'elite academy corridor',
        'clean tactical classroom',
        'dark school strategy mood',
      ],
      prompt: {
        en: 'elite academy corridor, tactical classroom mood, clean high-stakes editorial anime tone, no copyrighted characters',
        es: 'corredor de academia élite, mood de aula táctica, tono anime editorial de alta tensión, sin personajes con copyright',
      },
    },
  },
];

function getDefaultPreset(quiz: QuizVisualInput): VisualPreset {
  const categorySlug = quiz.category?.slug ?? '';

  if (quiz.quiz_type === 'personality') {
    if (categorySlug === 'lifestyle') {
      return {
        themeKey: 'generic-lifestyle',
        visualFamily: 'lifestyle-soft',
        searchTerms: ['soft lifestyle still life', 'editorial desk mood', 'warm routine scene'],
        prompt: {
          en: 'soft lifestyle editorial scene, warm light, thoughtful objects, premium magazine composition',
          es: 'escena editorial lifestyle suave, luz cálida, objetos contemplativos, composición premium tipo revista',
        },
      };
    }

    return {
      themeKey: 'generic-personality',
      visualFamily: 'personality-pulse',
      searchTerms: [
        'abstract light gradient',
        'identity aura gradient',
        'modern introspective visual',
      ],
      prompt: {
        en: 'editorial personality mood, abstract aura, human-centered premium composition',
        es: 'mood editorial de personalidad, aura abstracta, composición premium centrada en identidad',
      },
    };
  }

  return {
    themeKey: 'generic-trivia',
    visualFamily: categorySlug === 'culture' ? 'editorial-generic' : 'science-lab',
    searchTerms: ['editorial quiz cover', 'premium knowledge mood', 'clean magazine visual'],
    prompt: {
      en: 'premium editorial quiz cover, knowledge-driven mood, polished magazine-like composition',
      es: 'cover editorial premium para quiz, mood guiado por conocimiento, composición pulida tipo revista',
    },
  };
}

export function inferVisualProfile(quiz: QuizVisualInput): VisualProfile {
  const haystack = [
    quiz.title,
    quiz.description ?? '',
    ...(quiz.tags ?? []),
    quiz.category?.name ?? '',
    quiz.category?.slug ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const matched = VISUAL_PRESETS.find((entry) => entry.match.test(haystack))?.preset;
  const preset = matched ?? getDefaultPreset(quiz);
  const coverMode = matched ? ('stock' as const) : ('procedural' as const);

  return {
    theme_key: preset.themeKey,
    visual_family: preset.visualFamily,
    cover_mode: coverMode,
    cover_prompt: quiz.language === 'es' ? preset.prompt.es : preset.prompt.en,
    cover_search_terms: preset.searchTerms,
  };
}
