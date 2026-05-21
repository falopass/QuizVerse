import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

const seedPath = path.join(rootDir, 'generated', 'trending-seed.json');
const normalizedPath = path.join(rootDir, 'generated', 'trending-seed.normalized.json');
const manifestPath = path.join(rootDir, 'src', 'lib', 'data', 'stock-cover-manifest.json');
const reportPath = path.join(rootDir, 'generated', 'stock-cover-hydration-report.json');
const limit = Number(process.env.STOCK_COVER_LIMIT || 24);
const shouldRefresh = process.env.STOCK_COVER_REFRESH === '1';
const minimumScore = Number(process.env.STOCK_COVER_MIN_SCORE || 34);

const pexelsKey = process.env.PEXELS_API_KEY;
const pixabayKey = process.env.PIXABAY_API_KEY;

if (!pexelsKey && !pixabayKey) {
  throw new Error('Missing PEXELS_API_KEY and PIXABAY_API_KEY');
}

const GLOBAL_REJECT_TERMS = [
  'portrait',
  'selfie',
  'wedding',
  'bridal',
  'lingerie',
  'underwear',
  'model',
  'runway',
  'fashion',
  'headshot',
  'closeup',
  'close-up',
  'face',
];

const STOCK_READY_THEMES = new Set([
  'stranger-things',
  'star-wars',
  'the-boys',
  'euphoria',
  're-zero',
  'witch-hat-atelier',
  'dr-stone',
  'mario',
  'hacks',
  'beef',
  'classroom-of-the-elite',
  'generic-lifestyle',
]);

const CURATED_QUERY_OVERRIDES = {
  'en-how-sharp-is-your-star-wars-maul-lore': ['desert dunes sunset', 'desert planet horizon'],
  'es-que-tan-afilado-esta-tu-lore-de-star-wars-maul': [
    'desert dunes sunset',
    'desert planet horizon',
  ],
  'en-which-euphoria-aura-fits-you-best': ['blue and pink neon light', 'neon club interior'],
  'es-que-aura-de-euphoria-encaja-contigo': ['blue and pink neon light', 'neon club interior'],
  'en-which-classroom-of-the-elite-strategy-is-yours': [
    'empty classroom interior',
    'school corridor night',
  ],
  'es-que-estrategia-de-classroom-of-the-elite-es-la-tuya': [
    'empty classroom interior',
    'school corridor night',
  ],
};

const CURATED_REJECT_OVERRIDES = {
  'en-how-sharp-is-your-star-wars-maul-lore': ['astronaut', 'woman', 'man'],
  'es-que-tan-afilado-esta-tu-lore-de-star-wars-maul': ['astronaut', 'woman', 'man'],
  'en-which-euphoria-aura-fits-you-best': ['person', 'woman', 'man', 'jumps'],
  'es-que-aura-de-euphoria-encaja-contigo': ['person', 'woman', 'man', 'jumps'],
  'en-which-classroom-of-the-elite-strategy-is-yours': ['students', 'boys', 'girl'],
  'es-que-estrategia-de-classroom-of-the-elite-es-la-tuya': ['students', 'boys', 'girl'],
};

const THEME_CONFIG = {
  'stranger-things': {
    primary: [
      'red fog forest',
      'suburban street fog night',
      'mysterious string lights room',
      'eerie forest red mist',
    ],
    secondary: ['dark woods night', 'retro suburb night atmosphere'],
    positives: ['forest', 'fog', 'night', 'mist', 'suburban', 'lights', 'dark', 'red'],
    rejects: ['man', 'woman', 'couple', 'fashion'],
  },
  'star-wars': {
    primary: [
      'desert planet horizon',
      'red sci fi corridor',
      'space opera skyline',
      'cosmic desert sunset',
    ],
    secondary: ['spaceship corridor light', 'epic science fiction landscape'],
    positives: ['desert', 'planet', 'space', 'sci', 'corridor', 'cosmic', 'sunset', 'sky'],
    rejects: ['toy', 'lego', 'cosplay'],
  },
  'the-boys': {
    primary: [
      'corporate skyline night',
      'urban billboard lights',
      'dramatic downtown street',
      'city propaganda billboard',
    ],
    secondary: ['night city tension', 'corporate tower dramatic'],
    positives: ['city', 'urban', 'skyline', 'billboard', 'tower', 'night', 'street'],
    rejects: ['selfie', 'wedding', 'fashion'],
  },
  euphoria: {
    primary: [
      'pink blue neon room',
      'night club lights abstract',
      'glitter neon blur',
      'moody neon interior',
    ],
    secondary: ['neon night lights', 'colorful nightclub interior'],
    positives: ['neon', 'pink', 'blue', 'night', 'lights', 'club', 'glitter', 'interior'],
    rejects: ['underwear', 'lingerie', 'wedding'],
  },
  're-zero': {
    primary: [
      'moonlit castle corridor',
      'fantasy clock tower night',
      'blue magic forest night',
      'gothic corridor candlelight',
    ],
    secondary: ['enchanted castle hall', 'fantasy night pathway'],
    positives: ['castle', 'corridor', 'clock', 'tower', 'fantasy', 'moon', 'blue', 'night'],
    rejects: ['bridal', 'fashion'],
  },
  'witch-hat-atelier': {
    primary: [
      'ink parchment desk',
      'magic workshop candlelight',
      'fantasy atelier interior',
      'spellbook desk glow',
    ],
    secondary: ['parchment and candles', 'old desk magic light'],
    positives: ['ink', 'parchment', 'desk', 'candles', 'interior', 'book', 'workshop', 'magic'],
    rejects: ['fashion', 'wedding'],
  },
  'dr-stone': {
    primary: [
      'science lab glass',
      'chemistry laboratory equipment',
      'minerals research table',
      'clean experiment setup',
    ],
    secondary: ['science beakers laboratory', 'glass chemistry close shot'],
    positives: ['science', 'lab', 'chemistry', 'glass', 'equipment', 'minerals', 'experiment'],
    rejects: ['person', 'selfie', 'fashion'],
  },
  mario: {
    primary: [
      'colorful sky clouds',
      'bright playful landscape',
      'cosmic colorful abstract',
      'rainbow game world',
    ],
    secondary: ['joyful colorful scene', 'bright fantasy clouds'],
    positives: ['colorful', 'sky', 'clouds', 'bright', 'rainbow', 'fantasy', 'playful'],
    rejects: ['fashion', 'wedding'],
  },
  hacks: {
    primary: [
      'microphone stage spotlight',
      'velvet theater stage',
      'comedy club interior',
      'backstage dressing room lights',
    ],
    secondary: ['stage curtain spotlight', 'theater interior night'],
    positives: ['microphone', 'stage', 'spotlight', 'theater', 'velvet', 'backstage', 'club'],
    rejects: ['wedding', 'couple'],
  },
  beef: {
    primary: [
      'urban street tension',
      'suburban road confrontation',
      'dramatic traffic night',
      'parking lot tension',
    ],
    secondary: ['city road conflict', 'suburban street mood'],
    positives: ['street', 'road', 'traffic', 'parking', 'urban', 'suburban', 'night'],
    rejects: ['selfie', 'fashion'],
  },
  'classroom-of-the-elite': {
    primary: [
      'elite classroom interior',
      'academic hallway night',
      'exam desk papers',
      'modern school corridor',
    ],
    secondary: ['classroom desks empty', 'academy corridor interior'],
    positives: ['classroom', 'hallway', 'desk', 'school', 'academy', 'corridor', 'papers'],
    rejects: ['children', 'graduation'],
  },
  'generic-lifestyle': {
    primary: [
      'warm desk morning light',
      'soft coffee still life',
      'cozy notebook scene',
      'home ritual editorial',
    ],
    secondary: ['soft interior light', 'calm lifestyle objects'],
    positives: ['desk', 'coffee', 'morning', 'cozy', 'notebook', 'interior', 'light'],
    rejects: ['wedding', 'fashion'],
  },
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getThemeConfig(quiz) {
  return THEME_CONFIG[quiz.theme_key] ?? null;
}

function buildQueries(quiz) {
  const config = getThemeConfig(quiz);
  if (!config) return [];

  const searchTerms = Array.isArray(quiz.cover_search_terms)
    ? quiz.cover_search_terms.slice(0, 2)
    : [];
  const curated = CURATED_QUERY_OVERRIDES[quiz.slug] ?? [];

  return [...new Set([...curated, ...config.primary, ...searchTerms, ...config.secondary])]
    .filter(Boolean)
    .slice(0, 8);
}

function getAllRejectTerms(quiz) {
  const config = getThemeConfig(quiz);
  return [
    ...GLOBAL_REJECT_TERMS,
    ...(config?.rejects ?? []),
    ...(CURATED_REJECT_OVERRIDES[quiz.slug] ?? []),
  ].map(normalizeText);
}

function getPositiveTerms(quiz) {
  const config = getThemeConfig(quiz);
  return (config?.positives ?? []).map(normalizeText);
}

function isHardRejected(quiz, candidate) {
  const text = normalizeText(
    [candidate.alt, candidate.tags, candidate.source_url, candidate.photographer]
      .filter(Boolean)
      .join(' ')
  );

  return getAllRejectTerms(quiz).some((term) => text.includes(term));
}

function scoreCandidate(quiz, candidate, query) {
  if (isHardRejected(quiz, candidate)) {
    return -999;
  }

  const text = normalizeText(
    [candidate.alt, candidate.tags, candidate.source_url, candidate.photographer, query]
      .filter(Boolean)
      .join(' ')
  );
  const positives = getPositiveTerms(quiz);
  let score = 0;

  for (const term of positives) {
    if (text.includes(term)) {
      score += 10;
    }
  }

  const queryTokens = normalizeText(query).split(/\s+/).filter(Boolean);
  score += queryTokens.filter((token) => text.includes(token)).length * 4;

  if ((candidate.width ?? 0) >= 1600) score += 6;
  if ((candidate.width ?? 0) >= 2400) score += 4;

  if ((candidate.height ?? 0) > 0) {
    const ratio = (candidate.width ?? 1) / candidate.height;
    if (ratio >= 1.35 && ratio <= 2.1) {
      score += 8;
    }
  }

  if (candidate.provider === 'pexels') {
    score += 2;
  }

  return score;
}

async function searchPexels(query) {
  if (!pexelsKey) return [];

  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('per_page', '10');

  const response = await fetch(url, {
    headers: {
      Authorization: pexelsKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Pexels error ${response.status}`);
  }

  const data = await response.json();
  return (data.photos ?? []).map((photo) => ({
    provider: 'pexels',
    image_url:
      photo.src?.large2x || photo.src?.landscape || photo.src?.large || photo.src?.original,
    source_url: photo.url,
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    attribution: `Photo by ${photo.photographer} on Pexels`,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || '',
    tags: photo.alt || '',
  }));
}

async function searchPixabay(query) {
  if (!pixabayKey) return [];

  const url = new URL('https://pixabay.com/api/');
  url.searchParams.set('key', pixabayKey);
  url.searchParams.set('q', query);
  url.searchParams.set('image_type', 'photo');
  url.searchParams.set('orientation', 'horizontal');
  url.searchParams.set('per_page', '8');
  url.searchParams.set('safesearch', 'true');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pixabay error ${response.status}`);
  }

  const data = await response.json();
  return (data.hits ?? []).map((hit) => ({
    provider: 'pixabay',
    image_url: hit.largeImageURL || hit.webformatURL,
    source_url: hit.pageURL,
    photographer: hit.user,
    photographer_url: hit.pageURL,
    attribution: `Photo by ${hit.user} on Pixabay`,
    width: hit.imageWidth,
    height: hit.imageHeight,
    alt: hit.tags || '',
    tags: hit.tags || '',
  }));
}

async function resolveCover(quiz) {
  const queries = buildQueries(quiz);

  for (const query of queries) {
    const candidates = [];

    try {
      candidates.push(...(await searchPexels(query)));
    } catch (error) {
      console.error('pexels-search-failed', {
        query,
        error: error instanceof Error ? error.message : error,
      });
    }

    if (candidates.length < 3) {
      try {
        candidates.push(...(await searchPixabay(query)));
      } catch (error) {
        console.error('pixabay-search-failed', {
          query,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const scored = candidates
      .map((candidate) => ({ ...candidate, query, score: scoreCandidate(quiz, candidate, query) }))
      .filter((candidate) => candidate.score >= minimumScore)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return scored[0];
    }
  }

  return null;
}

function shouldHydrate(quiz) {
  return (
    (quiz.editorial_status === 'featured' || quiz.editorial_status === 'strong') &&
    STOCK_READY_THEMES.has(quiz.theme_key)
  );
}

function resetToProcedural(quiz) {
  quiz.cover_image_url = `/covers/${quiz.slug}`;
  quiz.cover_mode = 'procedural';
}

async function main() {
  const seed = readJson(seedPath, []);
  const manifest = shouldRefresh ? {} : readJson(manifestPath, {});
  const nextSeed = [...seed];
  const candidates = nextSeed.filter(shouldHydrate).slice(0, limit);
  const report = {
    totalCandidates: candidates.length,
    minimumScore,
    hydrated: [],
    skipped: [],
  };

  for (const quiz of candidates) {
    if (manifest[quiz.slug] && !shouldRefresh) {
      quiz.cover_image_url = `/stock-covers/${quiz.slug}`;
      quiz.cover_mode = 'stock';
      report.skipped.push({ slug: quiz.slug, reason: 'already_hydrated' });
      continue;
    }

    const result = await resolveCover(quiz);

    if (!result) {
      delete manifest[quiz.slug];
      resetToProcedural(quiz);
      report.skipped.push({ slug: quiz.slug, reason: 'no_good_match' });
      continue;
    }

    manifest[quiz.slug] = {
      slug: quiz.slug,
      provider: result.provider,
      image_url: result.image_url,
      source_url: result.source_url,
      photographer: result.photographer,
      photographer_url: result.photographer_url,
      attribution: result.attribution,
      query: result.query,
      theme_key: quiz.theme_key,
      visual_family: quiz.visual_family,
      width: result.width,
      height: result.height,
      score: result.score,
    };

    quiz.cover_image_url = `/stock-covers/${quiz.slug}`;
    quiz.cover_mode = 'stock';
    report.hydrated.push({
      slug: quiz.slug,
      provider: result.provider,
      query: result.query,
      score: result.score,
    });
  }

  for (const quiz of nextSeed) {
    if (!manifest[quiz.slug] && quiz.cover_image_url === `/stock-covers/${quiz.slug}`) {
      resetToProcedural(quiz);
    }
  }

  writeJson(seedPath, nextSeed);
  writeJson(normalizedPath, nextSeed);
  writeJson(manifestPath, manifest);
  writeJson(reportPath, report);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
