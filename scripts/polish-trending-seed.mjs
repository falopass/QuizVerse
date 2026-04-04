import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const inputPath = path.join(rootDir, 'generated', 'trending-seed-openrouter.normalized.json');
const outputPaths = [
  path.join(rootDir, 'generated', 'trending-seed-openrouter.normalized.json'),
  path.join(rootDir, 'generated', 'trending-seed-openrouter.json'),
];
const reportPath = path.join(rootDir, 'generated', 'trending-seed-polish-report.json');

const editorialTitleOverrides = new Map([
  ['es-que-tan-afilado-esta-tu-lore-de-star-wars-maul', '¿Cuánto sabes sobre Darth Maul?'],
  ['es-trivia-fan-de-the-boys', 'Trivia para fans de The Boys'],
  ['es-trivia-fan-de-stranger-things', 'Trivia para fans de Stranger Things'],
  ['es-trivia-fan-de-euphoria', 'Trivia para fans de Euphoria'],
  ['es-trivia-fan-de-beef', 'Trivia para fans de Beef'],
  ['es-trivia-fan-de-hacks', 'Trivia para fans de Hacks'],
  ['es-trivia-fan-de-star-wars', 'Trivia para fans de Star Wars'],
  ['es-trivia-fan-de-re-zero', 'Trivia para fans de Re:ZERO'],
  ['es-trivia-fan-de-witch-hat-atelier', 'Trivia para fans de Witch Hat Atelier'],
  ['es-trivia-fan-de-classroom-of-the-elite', 'Trivia para fans de Classroom of the Elite'],
  ['es-trivia-fan-de-dr-stone', 'Trivia para fans de Dr. Stone'],
  ['es-que-vibe-de-mario-galaxy-eres', '¿Qué vibra de Mario Galaxy va más contigo?'],
  ['es-cual-es-tu-estilo-de-conflicto-tipo-beef', '¿Cómo enfrentas el conflicto al estilo Beef?'],
  ['es-que-tan-profundo-llega-tu-conocimiento-de-beef', '¿Qué tanto sabes de Beef?'],
  ['es-que-tan-profundo-llega-tu-conocimiento-de-classroom-of-the-elite', '¿Qué tanto sabes de Classroom of the Elite?'],
  ['es-que-rol-jugarias-dentro-de-classroom-of-the-elite', '¿Qué rol jugarías dentro de Classroom of the Elite?'],
]);

const editorialDescriptionOverrides = new Map([
  ['es-que-tan-afilado-esta-tu-lore-de-star-wars-maul', 'Pon a prueba cuánto sabes sobre el origen, la caída y el legado de Darth Maul dentro del canon de Star Wars.'],
  ['es-trivia-fan-de-the-boys', 'Pon a prueba cuánto sabes sobre Los Siete, Vought y el costado más turbio del universo de The Boys.'],
  ['es-trivia-fan-de-stranger-things', 'Pon a prueba cuánto sabes sobre Hawkins, Once y los momentos más recordados de Stranger Things.'],
  ['es-trivia-fan-de-euphoria', 'Pon a prueba cuánto recuerdas sobre los personajes, el drama y la identidad visual de Euphoria.'],
  ['es-trivia-fan-de-beef', 'Pon a prueba tu memoria sobre el choque entre Danny y Amy en una de las series más tensas de los últimos años.'],
  ['es-trivia-fan-de-hacks', 'Pon a prueba cuánto sabes sobre Deborah Vance, Ava Daniels y el detrás de escena de Hacks.'],
  ['es-trivia-fan-de-star-wars', 'Pon a prueba cuánto recuerdas de la galaxia de Star Wars con un recorrido accesible por personajes, lugares y momentos clave.'],
  ['es-trivia-fan-de-re-zero', 'Pon a prueba tus conocimientos sobre Lugunica, Subaru y los misterios que definen Re:ZERO.'],
  ['es-trivia-fan-de-witch-hat-atelier', 'Pon a prueba cuánto sabes sobre Coco, el taller y la lógica mágica de Witch Hat Atelier.'],
  ['es-trivia-fan-de-classroom-of-the-elite', 'Pon a prueba cuánto recuerdas sobre la academia, sus reglas y las estrategias que definen Classroom of the Elite.'],
  ['es-trivia-fan-de-dr-stone', 'Pon a prueba tus conocimientos sobre Senku, el Reino de la Ciencia y la reconstrucción del mundo en Dr. Stone.'],
  ['es-que-vibe-de-mario-galaxy-eres', 'Recorre planetas, estrellas y pequeños impulsos de aventura para descubrir qué vibra del universo de Mario Galaxy encaja mejor contigo.'],
  ['es-cual-es-tu-estilo-de-conflicto-tipo-beef', 'Desde un roce mínimo hasta un drama imposible de detener, descubre cómo reaccionas cuando un conflicto se sale de control.'],
  ['es-que-tan-profundo-llega-tu-conocimiento-de-beef', 'Pon a prueba tu memoria sobre Beef, desde el incidente inicial hasta las decisiones que convierten un enojo menor en una espiral total.'],
  ['es-que-tan-profundo-llega-tu-conocimiento-de-classroom-of-the-elite', 'Pon a prueba tu memoria sobre la academia, sus reglas invisibles y los movimientos que marcan Classroom of the Elite.'],
]);

const featuredSlugs = new Set([
  'en-stranger-things-trivia-and-the-upside-down',
  'es-trivia-de-stranger-things-y-el-upside-down',
  'en-what-stranger-things-energy-are-you-carrying',
  'es-que-energia-de-stranger-things-llevas-contigo',
  'en-how-well-do-you-really-know-darth-maul',
  'es-que-tan-afilado-esta-tu-lore-de-star-wars-maul',
  'en-what-star-wars-role-would-you-play',
  'es-que-rol-jugarias-dentro-de-star-wars',
  'en-what-the-boys-chaos-archetype-are-you',
  'es-que-arquetipo-de-caos-de-the-boys-eres',
  'en-the-boys-fan-trivia',
  'es-trivia-fan-de-the-boys',
  'en-what-euphoria-aura-fits-you',
  'es-que-aura-de-euphoria-encaja-contigo',
  'en-hacks-trivia-and-the-business-of-comedy',
  'es-trivia-de-hacks-y-la-industria-de-la-comedia',
  'en-what-re-zero-survival-instinct-matches-you',
  'es-que-instinto-de-supervivencia-de-re-zero-te-representa',
  'en-witch-hat-atelier-magic-style-personality-test',
  'es-que-estilo-magico-de-witch-hat-atelier-te-queda',
  'en-what-classroom-of-the-elite-strategy-is-yours',
  'es-que-estrategia-de-classroom-of-the-elite-es-la-tuya',
  'en-dr-stone-science-future-trivia',
  'es-trivia-de-dr-stone-science-future',
]);

const strongFranchises = [
  'stranger things',
  'the boys',
  'star wars',
  'euphoria',
  're:zero',
  're-zero',
  'witch hat atelier',
  'dr. stone',
  'mario',
  'hacks',
  'beef',
  'classroom of the elite',
];

function inferVisualTheme(quiz) {
  const haystack = `${quiz.title} ${quiz.description ?? ''} ${(quiz.tags ?? []).join(' ')}`.toLowerCase();

  const rules = [
    ['stranger-things', 'retro-mystery', ['retro suburb night', 'red fog forest', '80s mystery lights']],
    ['star-wars', 'space-opera', ['desert planet horizon', 'space opera glow', 'sci-fi duel silhouette']],
    ['the-boys', 'corporate-chaos', ['corporate skyline night', 'hero propaganda mood', 'urban chaos spotlight']],
    ['euphoria', 'neon-drama', ['neon portrait mood', 'night glitter closeup', 'pink blue nightlife editorial']],
    ['re-zero', 'dark-fantasy', ['fantasy clock tower', 'blue moon magic', 'dark royal corridor']],
    ['witch-hat-atelier', 'dark-fantasy', ['ink magic workshop', 'fantasy atelier desk', 'mystic parchment glow']],
    ['dr-stone', 'science-lab', ['glass lab glow', 'science table minerals', 'clean experiment setup']],
    ['mario', 'bright-platformer', ['bright cosmic platformer', 'toy-like planets', 'colorful arcade sky']],
    ['hacks', 'comedy-stage', ['comedy club spotlight', 'velvet theater stage', 'microphone backstage glow']],
    ['beef', 'corporate-chaos', ['road rage urban tension', 'suburban confrontation mood', 'tense modern drama frame']],
    ['classroom-of-the-elite', 'academic-strategy', ['elite academy corridor', 'clean tactical classroom', 'dark school strategy mood']],
  ];

  for (const [themeKey, visualFamily, searchTerms] of rules) {
    const matcher = String(themeKey).replace(/-/g, '.*');
    if (new RegExp(matcher, 'i').test(haystack)) {
      return { themeKey, visualFamily, searchTerms };
    }
  }

  if (quiz.quiz_type === 'personality') {
    return {
      themeKey: quiz.category_slug === 'lifestyle' ? 'generic-lifestyle' : 'generic-personality',
      visualFamily: quiz.category_slug === 'lifestyle' ? 'lifestyle-soft' : 'personality-pulse',
      searchTerms:
        quiz.category_slug === 'lifestyle'
          ? ['soft lifestyle still life', 'editorial desk mood', 'warm routine scene']
          : ['editorial portrait mood', 'identity aura gradient', 'modern introspective visual'],
    };
  }

  return {
    themeKey: 'generic-trivia',
    visualFamily: quiz.category_slug === 'culture' ? 'editorial-generic' : 'science-lab',
    searchTerms: ['editorial quiz cover', 'premium knowledge mood', 'clean magazine visual'],
  };
}

function maybeDecodeMojibake(value) {
  if (typeof value !== 'string') return value;
  if (!/[ÃÂâ€™â€œâ€]/.test(value)) return value;

  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
  }
}

function normalizeStringsDeep(value) {
  if (typeof value === 'string') {
    let current = value;
    for (let index = 0; index < 3; index += 1) {
      const next = maybeDecodeMojibake(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeStringsDeep);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, innerValue]) => [key, normalizeStringsDeep(innerValue)]));
  }

  return value;
}

function polishSpanishText(text) {
  if (typeof text !== 'string') return text;

  return text
    .replace(/^Que tan /, '¿Qué tan ')
    .replace(/^Que /, '¿Qué ')
    .replace(/\bQue tan profundo llega tu conocimiento de\b/g, '¿Qué tanto sabes de')
    .replace(/\bTrivia fan de\b/g, 'Trivia para fans de')
    .replace(/\blore\b/gi, 'conocimiento')
    .replace(/\bvibe\b/gi, 'vibra')
    .replace(/tipo "beef"/gi, 'al estilo Beef')
    .replace(/Que Rol Jugarías Dentro de/gi, '¿Qué rol jugarías dentro de')
    .replace(/\bupside down\b/gi, 'Upside Down')
    .replace(/\s+/g, ' ')
    .trim();
}

function polishEnglishText(text) {
  if (typeof text !== 'string') return text;

  return text
    .replace(/\s+/g, ' ')
    .replace(/\bdeep knowledge\b/gi, 'sharp knowledge')
    .trim();
}

function classifyCategory(quiz) {
  const haystack = `${quiz.title} ${quiz.description ?? ''} ${(quiz.tags ?? []).join(' ')}`.toLowerCase();

  if (quiz.quiz_type === 'personality') {
    if (/coffee|travel|study|design|desk|sunday|ritual|weekend|playlist/.test(haystack)) {
      return 'lifestyle';
    }
    return 'personality';
  }

  if (/capital|geography|astronomy|kitchen|language|landmark/.test(haystack)) {
    return 'trivia';
  }

  if (/dessert|startup|internet|movie|film|book|album|football|streaming|star wars|stranger things|the boys|euphoria|re:zero|re-zero|dr. stone|witch hat atelier|classroom of the elite|mario|hacks|beef/.test(haystack)) {
    return 'culture';
  }

  return quiz.quiz_type === 'trivia' ? 'trivia' : 'personality';
}

function getEditorialStatus(quiz) {
  if (featuredSlugs.has(quiz.slug)) return 'featured';
  const haystack = `${quiz.title} ${quiz.description ?? ''}`.toLowerCase();
  if (strongFranchises.some((franchise) => haystack.includes(franchise))) return 'strong';
  if ((quiz.description ?? '').length < 70) return 'needs_edit';
  return 'strong';
}

function polishQuestion(question, language) {
  const normalized = normalizeStringsDeep(question);
  return {
    ...normalized,
    question: language === 'es' ? polishSpanishText(normalized.question) : polishEnglishText(normalized.question),
    explanation:
      typeof normalized.explanation === 'string'
        ? language === 'es'
          ? polishSpanishText(normalized.explanation)
          : polishEnglishText(normalized.explanation)
        : normalized.explanation,
    options: Array.isArray(normalized.options)
      ? normalized.options.map((option) => ({
          ...option,
          text: language === 'es' ? polishSpanishText(option.text) : polishEnglishText(option.text),
        }))
      : normalized.options,
  };
}

function polishResult(result, language) {
  const normalized = normalizeStringsDeep(result);
  return {
    ...normalized,
    title: language === 'es' ? polishSpanishText(normalized.title) : polishEnglishText(normalized.title),
    description: language === 'es' ? polishSpanishText(normalized.description) : polishEnglishText(normalized.description),
  };
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Seed file not found: ${inputPath}`);
  }

  const seed = normalizeStringsDeep(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  const timestamp = new Date().toISOString();

  const updated = seed.map((quiz) => {
    const normalizedQuiz = normalizeStringsDeep(quiz);
    const language = normalizedQuiz.language === 'es' ? 'es' : 'en';
    const localizedQuiz =
      language === 'es'
        ? {
            ...normalizedQuiz,
            title: editorialTitleOverrides.get(normalizedQuiz.slug) ?? polishSpanishText(normalizedQuiz.title),
            description:
              editorialDescriptionOverrides.get(normalizedQuiz.slug) ?? polishSpanishText(normalizedQuiz.description),
            source_topic:
              typeof normalizedQuiz.source_topic === 'string'
                ? polishSpanishText(normalizedQuiz.source_topic)
                : normalizedQuiz.source_topic,
          }
        : {
            ...normalizedQuiz,
            title: polishEnglishText(normalizedQuiz.title),
            description: polishEnglishText(normalizedQuiz.description),
          };

    const categorySlug = classifyCategory(localizedQuiz);
    const editorialStatus = getEditorialStatus(localizedQuiz);
    const visualTheme = inferVisualTheme({ ...localizedQuiz, category_slug: categorySlug });
    const coverMode = editorialStatus === 'featured' ? 'generated' : 'procedural';

    return {
      ...localizedQuiz,
      questions: Array.isArray(localizedQuiz.questions)
        ? localizedQuiz.questions.map((question) => polishQuestion(question, language))
        : localizedQuiz.questions,
      results: Array.isArray(localizedQuiz.results)
        ? localizedQuiz.results.map((result) => polishResult(result, language))
        : localizedQuiz.results,
      tags: Array.isArray(localizedQuiz.tags)
        ? localizedQuiz.tags.map((tag) => (language === 'es' ? polishSpanishText(tag) : polishEnglishText(tag)))
        : localizedQuiz.tags,
      category_slug: categorySlug,
      editorial_status: editorialStatus,
      theme_key: visualTheme.themeKey,
      visual_family: visualTheme.visualFamily,
      cover_mode: coverMode,
      cover_search_terms: visualTheme.searchTerms,
      cover_prompt:
        language === 'es'
          ? `${visualTheme.visualFamily}, look editorial premium, sin personajes con copyright`
          : `${visualTheme.visualFamily}, premium editorial look, no copyrighted characters`,
      cover_image_url: `/covers/${localizedQuiz.slug}`,
      is_featured: editorialStatus === 'featured',
      featured_at: editorialStatus === 'featured' ? localizedQuiz.featured_at ?? timestamp : null,
    };
  });

  for (const outputPath of outputPaths) {
    fs.writeFileSync(outputPath, JSON.stringify(updated, null, 2), 'utf8');
  }

  const report = {
    total: updated.length,
    spanish: updated.filter((quiz) => quiz.language === 'es').length,
    featured: updated.filter((quiz) => quiz.editorial_status === 'featured').length,
    strong: updated.filter((quiz) => quiz.editorial_status === 'strong').length,
    needsEdit: updated.filter((quiz) => quiz.editorial_status === 'needs_edit').length,
    byCategory: updated.reduce((acc, quiz) => {
      acc[quiz.category_slug] = (acc[quiz.category_slug] ?? 0) + 1;
      return acc;
    }, {}),
    overriddenTitles: [...editorialTitleOverrides.keys()],
    overriddenDescriptions: [...editorialDescriptionOverrides.keys()],
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
