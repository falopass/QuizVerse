import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import OpenAI from 'openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const MODEL = process.env.SEED_MODEL || 'deepseek-chat';
const OUTPUT_DIR = path.join(process.cwd(), 'generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'trending-seed.json');
const REPORT_FILE = path.join(OUTPUT_DIR, 'trending-seed-report.json');
const CONCURRENCY = Number(process.env.SEED_CONCURRENCY || 3);
const LIMIT = Number(process.env.SEED_LIMIT || 600);
const API_KEY = process.env.DEEPSEEK_API_KEY;
const ERROR_LOG_FILE = path.join(OUTPUT_DIR, 'trending-seed-errors.log');
const TURBO_MODE = process.env.SEED_MODE === 'turbo';
const QUESTION_COUNT = TURBO_MODE ? 6 : 8;
const MAX_DESCRIPTION = TURBO_MODE ? 180 : 300;

if (!API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY in environment.');
}

async function appendFatalError(prefix, error) {
  await ensureDir();
  const message = `[${new Date().toISOString()}] ${prefix}: ${error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error)}\n\n`;
  await fs.appendFile(ERROR_LOG_FILE, message);
}

process.on('uncaughtException', (error) => {
  void appendFatalError('uncaughtException', error).finally(() => process.exit(1));
});

process.on('unhandledRejection', (error) => {
  void appendFatalError('unhandledRejection', error).finally(() => process.exit(1));
});

const QuizSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(MAX_DESCRIPTION),
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string().min(10).max(300),
        options: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().min(1).max(180),
              is_correct: z.boolean().optional(),
              personality_tags: z.array(z.string()).optional(),
            })
          )
          .length(4),
        explanation: z.string().max(500).nullable().optional(),
        time_limit_seconds: z.number().min(10).max(120).nullable().optional(),
      })
    )
    .min(QUESTION_COUNT)
    .max(12),
  results: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(2).max(100),
        description: z.string().min(20).max(500),
        personality_tag: z.string().min(1),
        background_theme: z.string().optional(),
      })
    )
    .optional(),
  tags: z.array(z.string()).min(2).max(10),
  estimated_minutes: z.number().min(1).max(15),
});

const THEMES = ['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic'];

const TREND_FRANCHISES = [
  { id: 'the-boys', en: 'The Boys', es: 'The Boys', category: 'culture' },
  { id: 'stranger-things', en: 'Stranger Things', es: 'Stranger Things', category: 'culture' },
  { id: 'euphoria', en: 'Euphoria', es: 'Euphoria', category: 'culture' },
  { id: 'beef', en: 'Beef', es: 'Beef', category: 'culture' },
  { id: 'hacks', en: 'Hacks', es: 'Hacks', category: 'culture' },
  { id: 'star-wars', en: 'Star Wars', es: 'Star Wars', category: 'culture' },
  { id: 'rezero', en: 'Re:ZERO', es: 'Re:ZERO', category: 'culture' },
  {
    id: 'witch-hat-atelier',
    en: 'Witch Hat Atelier',
    es: 'Witch Hat Atelier',
    category: 'culture',
  },
  {
    id: 'classroom-of-the-elite',
    en: 'Classroom of the Elite',
    es: 'Classroom of the Elite',
    category: 'culture',
  },
  { id: 'dr-stone', en: 'Dr. Stone', es: 'Dr. Stone', category: 'culture' },
  {
    id: 'slime',
    en: 'That Time I Got Reincarnated as a Slime',
    es: 'That Time I Got Reincarnated as a Slime',
    category: 'culture',
  },
  {
    id: 'mario-galaxy',
    en: 'The Super Mario Galaxy Movie',
    es: 'The Super Mario Galaxy Movie',
    category: 'culture',
  },
  {
    id: 'project-hail-mary',
    en: 'Project Hail Mary',
    es: 'Project Hail Mary',
    category: 'culture',
  },
  { id: 'the-mummy', en: 'The Mummy', es: 'The Mummy', category: 'culture' },
  { id: 'gta-vi', en: 'Grand Theft Auto VI', es: 'Grand Theft Auto VI', category: 'culture' },
  { id: 'resident-evil', en: 'Resident Evil', es: 'Resident Evil', category: 'culture' },
  { id: 'hades-ii', en: 'Hades II', es: 'Hades II', category: 'culture' },
  { id: 'starfield', en: 'Starfield', es: 'Starfield', category: 'culture' },
  { id: 'invincible', en: 'Invincible', es: 'Invincible', category: 'culture' },
  { id: 'harry-potter', en: 'Harry Potter', es: 'Harry Potter', category: 'culture' },
  { id: 'marvel', en: 'Marvel', es: 'Marvel', category: 'culture' },
  { id: 'naruto', en: 'Naruto', es: 'Naruto', category: 'culture' },
  { id: 'one-piece', en: 'One Piece', es: 'One Piece', category: 'culture' },
  { id: 'demon-slayer', en: 'Demon Slayer', es: 'Demon Slayer', category: 'culture' },
  { id: 'jujutsu-kaisen', en: 'Jujutsu Kaisen', es: 'Jujutsu Kaisen', category: 'culture' },
  { id: 'attack-on-titan', en: 'Attack on Titan', es: 'Attack on Titan', category: 'culture' },
  { id: 'pokemon', en: 'Pokemon', es: 'Pokemon', category: 'culture' },
  { id: 'zelda', en: 'The Legend of Zelda', es: 'The Legend of Zelda', category: 'culture' },
  { id: 'taylor-swift', en: 'Taylor Swift', es: 'Taylor Swift', category: 'culture' },
  { id: 'kpop', en: 'K-pop', es: 'K-pop', category: 'culture' },
  { id: 'wicked', en: 'Wicked', es: 'Wicked', category: 'culture' },
  { id: 'severance', en: 'Severance', es: 'Severance', category: 'culture' },
  { id: 'the-last-of-us', en: 'The Last of Us', es: 'The Last of Us', category: 'culture' },
  { id: 'white-lotus', en: 'The White Lotus', es: 'The White Lotus', category: 'culture' },
  { id: 'the-bear', en: 'The Bear', es: 'The Bear', category: 'culture' },
  { id: 'squid-game', en: 'Squid Game', es: 'El Juego del Calamar', category: 'culture' },
  { id: 'wednesday', en: 'Wednesday', es: 'Merlina', category: 'culture' },
  { id: 'bridgerton', en: 'Bridgerton', es: 'Bridgerton', category: 'culture' },
  { id: 'solo-leveling', en: 'Solo Leveling', es: 'Solo Leveling', category: 'culture' },
  { id: 'frieren', en: 'Frieren', es: 'Frieren', category: 'culture' },
  { id: 'chainsaw-man', en: 'Chainsaw Man', es: 'Chainsaw Man', category: 'culture' },
  { id: 'spy-family', en: 'Spy x Family', es: 'Spy x Family', category: 'culture' },
  { id: 'dune', en: 'Dune', es: 'Dune', category: 'culture' },
  { id: 'avatar', en: 'Avatar', es: 'Avatar', category: 'culture' },
  { id: 'barbie', en: 'Barbie', es: 'Barbie', category: 'culture' },
  { id: 'oppenheimer', en: 'Oppenheimer', es: 'Oppenheimer', category: 'culture' },
  { id: 'spiderverse', en: 'Spider-Verse', es: 'Spider-Verse', category: 'culture' },
  { id: 'nintendo-switch-2', en: 'Nintendo Switch 2', es: 'Nintendo Switch 2', category: 'culture' },
  { id: 'baldur-gate-3', en: 'Baldur\'s Gate 3', es: 'Baldur\'s Gate 3', category: 'culture' },
  { id: 'elden-ring', en: 'Elden Ring', es: 'Elden Ring', category: 'culture' },
  { id: 'minecraft', en: 'Minecraft', es: 'Minecraft', category: 'culture' },
  { id: 'chappell-roan', en: 'Chappell Roan', es: 'Chappell Roan', category: 'culture' },
  { id: 'sabrina-carpenter', en: 'Sabrina Carpenter', es: 'Sabrina Carpenter', category: 'culture' },
  { id: 'beyonce', en: 'Beyonce', es: 'Beyonce', category: 'culture' },
  { id: 'bad-bunny', en: 'Bad Bunny', es: 'Bad Bunny', category: 'culture' },
];

const GENERAL_SUBJECTS = [
  {
    id: 'cinema-2026',
    category: 'culture',
    difficulty: 'medium',
    titles: { en: '2026 movie culture trivia', es: 'Trivia de cultura de cine 2026' },
    quizType: 'trivia',
  },
  {
    id: 'streaming-2026',
    category: 'culture',
    difficulty: 'medium',
    titles: { en: '2026 streaming culture trivia', es: 'Trivia de cultura de streaming 2026' },
    quizType: 'trivia',
  },
  {
    id: 'anime-spring-2026',
    category: 'culture',
    difficulty: 'medium',
    titles: { en: 'Spring 2026 anime fan trivia', es: 'Trivia fan del anime primavera 2026' },
    quizType: 'trivia',
  },
  {
    id: 'gaming-2026',
    category: 'culture',
    difficulty: 'medium',
    titles: { en: '2026 gaming hype trivia', es: 'Trivia del hype gamer 2026' },
    quizType: 'trivia',
  },
  {
    id: 'booktok-vibes',
    category: 'culture',
    difficulty: 'easy',
    titles: { en: 'What BookTok reading vibe are you?', es: 'Que vibe lectora tipo BookTok eres?' },
    quizType: 'personality',
  },
  {
    id: 'travel-energy',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What travel energy are you taking into 2026?',
      es: 'Que energia viajera llevas a 2026?',
    },
    quizType: 'personality',
  },
  {
    id: 'music-era',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'Which music era matches your taste?',
      es: 'Que era musical combina con tu gusto?',
    },
    quizType: 'personality',
  },
  {
    id: 'internet-culture',
    category: 'culture',
    difficulty: 'medium',
    titles: {
      en: 'Internet culture essentials trivia',
      es: 'Trivia esencial de cultura de internet',
    },
    quizType: 'trivia',
  },
  {
    id: 'weekend-social',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What weekend social energy are you?',
      es: 'Que energia social de fin de semana eres?',
    },
    quizType: 'personality',
  },
  {
    id: 'design-taste',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What kind of design taste do you have?',
      es: 'Que tipo de gusto de diseno tienes?',
    },
    quizType: 'personality',
  },
  {
    id: 'work-personality-ai-era',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What work style fits the AI era?',
      es: 'Que estilo laboral encaja en la era de la IA?',
    },
    quizType: 'personality',
  },
  {
    id: 'morning-person-vibe',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What kind of morning person are you really?',
      es: 'Que tipo de persona madrugadora eres realmente?',
    },
    quizType: 'personality',
  },
  {
    id: 'friendship-archetype',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'Which friend archetype are you in your group?',
      es: 'Que arquetipo de amigo eres en tu grupo?',
    },
    quizType: 'personality',
  },
  {
    id: 'dating-app-energy',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What dating app energy are you bringing?',
      es: 'Que energia de app de citas estas trayendo?',
    },
    quizType: 'personality',
  },
  {
    id: 'coffee-order-personality',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What does your coffee order say about you?',
      es: 'Que dice tu orden de cafe sobre ti?',
    },
    quizType: 'personality',
  },
  {
    id: 'social-media-alter-ego',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'What social media alter ego do you have?',
      es: 'Que alter ego de redes sociales tienes?',
    },
    quizType: 'personality',
  },
  {
    id: 'weekend-plans-vibe',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What weekend plan actually fits your vibe?',
      es: 'Que plan de fin de semana encaja de verdad con tu vibra?',
    },
    quizType: 'personality',
  },
  {
    id: 'creative-process-style',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What creative process style is yours?',
      es: 'Cual es tu estilo de proceso creativo?',
    },
    quizType: 'personality',
  },
  {
    id: 'conflict-resolution-type',
    category: 'lifestyle',
    difficulty: 'medium',
    titles: {
      en: 'What conflict resolution type are you?',
      es: 'Que tipo de resolucion de conflictos eres?',
    },
    quizType: 'personality',
  },
  {
    id: 'tech-relationship',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What is your relationship with technology?',
      es: 'Cual es tu relacion con la tecnologia?',
    },
    quizType: 'personality',
  },
  {
    id: 'fitness-personality',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What fitness personality fits your energy?',
      es: 'Que personalidad fitness encaja con tu energia?',
    },
    quizType: 'personality',
  },
  {
    id: 'music-festival-archetype',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'What music festival archetype are you?',
      es: 'Que arquetipo de festival de musica eres?',
    },
    quizType: 'personality',
  },
  {
    id: 'reading-personality',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'What is your true reading personality?',
      es: 'Cual es tu verdadera personalidad lectora?',
    },
    quizType: 'personality',
  },
  {
    id: 'home-decor-vibe',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What home decor vibe matches your soul?',
      es: 'Que vibe de decoracion combina con tu alma?',
    },
    quizType: 'personality',
  },
  {
    id: 'pet-owner-personality',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What pet owner personality are you?',
      es: 'Que personalidad de dueno de mascota eres?',
    },
    quizType: 'personality',
  },
  {
    id: 'vacation-style',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What vacation style actually recharges you?',
      es: 'Que estilo de vacaciones realmente te recarga?',
    },
    quizType: 'personality',
  },
  {
    id: 'gift-giving-style',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What gift giving style do you have?',
      es: 'Que estilo de dar regalos tienes?',
    },
    quizType: 'personality',
  },
  {
    id: 'ai-use-style',
    category: 'culture',
    difficulty: 'medium',
    titles: {
      en: 'How do you actually use AI in your daily life?',
      es: 'Como usas realmente la IA en tu vida diaria?',
    },
    quizType: 'personality',
  },
  {
    id: 'nostalgia-era',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'Which nostalgia era actually defines you?',
      es: 'Que era de nostalgia realmente te define?',
    },
    quizType: 'personality',
  },
  {
    id: 'productivity-philosophy',
    category: 'lifestyle',
    difficulty: 'medium',
    titles: {
      en: 'What productivity philosophy is actually yours?',
      es: 'Cual es realmente tu filosofia de productividad?',
    },
    quizType: 'personality',
  },
  {
    id: 'fashion-era-personality',
    category: 'culture',
    difficulty: 'easy',
    titles: {
      en: 'Which fashion era matches your personality?',
      es: 'Que era de la moda combina con tu personalidad?',
    },
    quizType: 'personality',
  },
  {
    id: 'party-personality-type',
    category: 'lifestyle',
    difficulty: 'easy',
    titles: {
      en: 'What party personality type are you?',
      es: 'Que tipo de personalidad de fiesta eres?',
    },
    quizType: 'personality',
  },
  {
    id: 'climate-anxiety-coping',
    category: 'lifestyle',
    difficulty: 'medium',
    titles: {
      en: 'How do you cope with climate anxiety?',
      es: 'Como enfrentas la ansiedad climatica?',
    },
    quizType: 'personality',
  },
  {
    id: 'leadership-instinct',
    category: 'lifestyle',
    difficulty: 'medium',
    titles: {
      en: 'What leadership instinct do you carry?',
      es: 'Que instinto de liderazgo llevas contigo?',
    },
    quizType: 'personality',
  },
  {
    id: 'trivia-2026-pop-culture',
    category: 'culture',
    difficulty: 'medium',
    titles: {
      en: '2026 pop culture timeline trivia',
      es: 'Trivia de la linea de tiempo de la cultura pop 2026',
    },
    quizType: 'trivia',
  },
  {
    id: 'trivia-viral-moments',
    category: 'culture',
    difficulty: 'medium',
    titles: {
      en: 'Viral internet moments trivia 2024-2026',
      es: 'Trivia de momentos virales de internet 2024-2026',
    },
    quizType: 'trivia',
  },
  {
    id: 'trivia-anime-legendary',
    category: 'culture',
    difficulty: 'medium',
    titles: {
      en: 'Legendary anime moments trivia',
      es: 'Trivia de momentos legendarios del anime',
    },
    quizType: 'trivia',
  },
  {
    id: 'trivia-food-around-world',
    category: 'lifestyle',
    difficulty: 'medium',
    titles: {
      en: 'Food around the world trivia',
      es: 'Trivia de comida alrededor del mundo',
    },
    quizType: 'trivia',
  },
  {
    id: 'trivia-space-exploration',
    category: 'culture',
    difficulty: 'hard',
    titles: {
      en: 'Space exploration trivia 2020-2026',
      es: 'Trivia de exploracion espacial 2020-2026',
    },
    quizType: 'trivia',
  },
];

const FRANCHISE_PATTERNS = [
  {
    suffix: 'personality-core',
    quizType: 'personality',
    difficulty: 'easy',
    build: (name) => ({
      en: `Which ${name.en} energy matches you best?`,
      es: `Que energia de ${name.es} combina mejor contigo?`,
    }),
  },
  {
    suffix: 'personality-role',
    quizType: 'personality',
    difficulty: 'medium',
    build: (name) => ({
      en: `What role would you play inside ${name.en}?`,
      es: `Que rol jugarias dentro de ${name.es}?`,
    }),
  },
  {
    suffix: 'trivia-fan',
    quizType: 'trivia',
    difficulty: 'easy',
    build: (name) => ({
      en: `${name.en} fan trivia challenge`,
      es: `Trivia fan de ${name.es}`,
    }),
  },
  {
    suffix: 'trivia-deep',
    quizType: 'trivia',
    difficulty: 'medium',
    build: (name) => ({
      en: `How deep does your ${name.en} knowledge go?`,
      es: `Que tan profundo llega tu conocimiento de ${name.es}?`,
    }),
  },
];

const generatedFranchiseTopics = TREND_FRANCHISES.flatMap((franchise) =>
  FRANCHISE_PATTERNS.map((pattern) => ({
    id: `${franchise.id}-${pattern.suffix}`,
    category: franchise.category,
    difficulty: pattern.difficulty,
    quizType: pattern.quizType,
    titles: pattern.build(franchise),
  }))
);

const seedDefinitions = [
  ...generatedFranchiseTopics,
  ...GENERAL_SUBJECTS.map((item) => ({
    id: item.id,
    category: item.category,
    difficulty: item.difficulty,
    quizType: item.quizType,
    titles: item.titles,
  })),
];

const allTopics = seedDefinitions
  .flatMap((item) => [
    {
      id: `${item.id}-en`,
      sourceId: item.id,
      categorySlug: item.category,
      quizType: item.quizType,
      difficulty: item.difficulty,
      language: 'en',
      topic: item.titles.en,
    },
    {
      id: `${item.id}-es`,
      sourceId: item.id,
      categorySlug: item.category,
      quizType: item.quizType,
      difficulty: item.difficulty,
      language: 'es',
      topic: item.titles.es,
    },
  ])
  .slice(0, LIMIT);

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

function createPrompt(item) {
  const languageLine =
    item.language === 'es'
      ? 'Write all content in natural Latin American Spanish. Avoid literal translation and avoid Spanglish unless it is part of the fandom itself.'
      : 'Write all content in natural contemporary English. Avoid corporate tone and avoid generic filler.';

  const shapeRules =
    item.quizType === 'trivia'
      ? [
          `Return exactly ${QUESTION_COUNT} questions.`,
          'Each question must have exactly 4 options.',
          'Each question must have exactly one correct answer.',
          TURBO_MODE
            ? 'Keep each explanation to one short sentence.'
            : 'Include a short explanation for each question.',
          'Do not include results.',
        ]
      : [
          `Return exactly ${QUESTION_COUNT} questions.`,
          'Each question must have exactly 4 options.',
          'Each option must include 1 or 2 personality_tags.',
          'Return exactly 4 results.',
          'Each result must map to one personality_tag used by the options.',
          TURBO_MODE
            ? 'Keep result descriptions short and punchy.'
            : 'Result descriptions must feel shareable and specific, not generic.',
        ];

  return [
    'You are seeding launch-ready quizzes for QuizVerse.',
    'Output only strict JSON.',
    languageLine,
    `Create a ${item.quizType} quiz about: "${item.topic}"`,
    `Difficulty: ${item.difficulty}.`,
    'The quiz should feel timely, mainstream and highly playable.',
    TURBO_MODE
      ? 'Prefer speed and clarity over complexity. Keep copy concise.'
      : 'Keep the tone polished and editorial.',
    'Avoid copyrighted quotes longer than a short fragment, avoid obscure deep cuts, and keep it accessible for engaged fans.',
    ...shapeRules,
    'Use this exact JSON shape:',
    `{
  "title": "string",
  "description": "string",
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "options": [
        { "id": "a", "text": "string", "is_correct": true, "personality_tags": ["string"] },
        { "id": "b", "text": "string", "is_correct": false, "personality_tags": ["string"] },
        { "id": "c", "text": "string", "is_correct": false, "personality_tags": ["string"] },
        { "id": "d", "text": "string", "is_correct": false, "personality_tags": ["string"] }
      ],
      "explanation": "string",
      "time_limit_seconds": 30
    }
  ],
  "results": [
    {
      "id": "r1",
      "title": "string",
      "description": "string",
      "personality_tag": "string",
      "background_theme": "fire"
    }
  ],
  "tags": ["string", "string"],
  "estimated_minutes": 4
}`,
  ].join('\n');
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function parseJson(content) {
  const sanitized = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .trim();
  const trimmed = sanitized;
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('No JSON object found in model response.');
}

function normalizeQuiz(item, raw) {
  const parsed = QuizSchema.parse(raw);
  const questions = parsed.questions.slice(0, QUESTION_COUNT).map((question, index) => ({
    id: `q${index + 1}`,
    question: question.question.trim(),
    options: question.options.map((option, optionIndex) => ({
      id: String.fromCharCode(97 + optionIndex),
      text: option.text.trim(),
      ...(item.quizType === 'trivia'
        ? { is_correct: Boolean(option.is_correct) }
        : { personality_tags: (option.personality_tags || []).slice(0, 2) }),
    })),
    explanation: item.quizType === 'trivia' ? question.explanation?.trim() || null : null,
    time_limit_seconds: question.time_limit_seconds ?? 30,
  }));

  if (item.quizType === 'trivia') {
    for (const [index, question] of questions.entries()) {
      const correctCount = question.options.filter((option) => option.is_correct).length;
      if (correctCount !== 1) {
        throw new Error(`Trivia question ${index + 1} must have exactly one correct option.`);
      }
    }
  }

  let results = null;
  if (item.quizType === 'personality') {
    if (!parsed.results || parsed.results.length !== 4) {
      throw new Error('Personality quiz must include exactly 4 results.');
    }

    const usedTags = new Set(
      questions.flatMap((question) =>
        question.options.flatMap((option) => option.personality_tags || [])
      )
    );

    results = parsed.results.map((result, index) => ({
      id: `r${index + 1}`,
      title: result.title.trim(),
      description: result.description.trim(),
      personality_tag: result.personality_tag.trim(),
      background_theme: THEMES.includes(result.background_theme)
        ? result.background_theme
        : THEMES[index % THEMES.length],
    }));

    for (const result of results) {
      if (!usedTags.has(result.personality_tag)) {
        throw new Error(`Result tag "${result.personality_tag}" is not used by any option.`);
      }
    }
  }

  return {
    id: `seed-${item.id}`,
    slug: slugify(`${item.language}-${parsed.title}`),
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    cover_image_url: null,
    quiz_type: item.quizType,
    difficulty: item.difficulty,
    language: item.language,
    category_slug: item.categorySlug,
    questions,
    results,
    tags: Array.from(new Set(parsed.tags.map((tag) => tag.trim().toLowerCase()))).slice(0, 8),
    estimated_minutes: Math.min(
      parsed.estimated_minutes,
      TURBO_MODE ? 3 : parsed.estimated_minutes
    ),
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: true,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_model: MODEL,
    source_topic: item.topic,
    source_id: item.sourceId,
  };
}

async function requestQuiz(item) {
  let lastError = new Error('Unknown generation failure.');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You create launch-ready quizzes for a consumer app. Return only JSON.',
          },
          { role: 'user', content: createPrompt(item) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty model response.');
      }

      return normalizeQuiz(item, parseJson(content));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown generation failure.');
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }
  throw lastError;
}

async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

let persistChain = Promise.resolve();

async function persistState(state) {
  persistChain = persistChain
    .then(async () => {
      await ensureDir();
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(state.successes, null, 2));
      await fs.writeFile(
        REPORT_FILE,
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            model: MODEL,
            requested: allTopics.length,
            successes: state.successes.length,
            failures: state.failures,
          },
          null,
          2
        )
      );
    })
    .catch((error) => {
      console.error('Persist error:', error instanceof Error ? error.message : error);
    });

  await persistChain;
}

async function worker(queue, state) {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) return;

    try {
      const quiz = await requestQuiz(item);
      state.successes.push(quiz);
      console.log(
        `OK  [${state.successes.length}/${allTopics.length}] ${item.language.toUpperCase()} ${item.topic}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      state.failures.push({
        id: item.id,
        topic: item.topic,
        language: item.language,
        error: message,
      });
      console.log(
        `ERR [${state.successes.length}/${allTopics.length}] ${item.language.toUpperCase()} ${item.topic} -> ${message}`
      );
    }

    try {
      await persistState(state);
    } catch (error) {
      console.error('Worker persist failure:', error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  await ensureDir();

  let existingSuccesses = [];
  try {
    existingSuccesses = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf8'));
  } catch {}

  const completedIds = new Set(
    existingSuccesses.map((quiz) => String(quiz.id).replace(/^seed-/, ''))
  );
  const queue = allTopics.filter((item) => !completedIds.has(item.id));
  const state = { successes: existingSuccesses, failures: [] };

  console.log(`Generating ${queue.length} trending quizzes with ${MODEL}...`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Mode: ${TURBO_MODE ? 'turbo' : 'standard'}`);

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () =>
    worker(queue, state)
  );
  await Promise.all(workers);

  const byLanguage = state.successes.reduce((acc, quiz) => {
    acc[quiz.language] = (acc[quiz.language] || 0) + 1;
    return acc;
  }, {});

  console.log('Done.');
  console.log(
    JSON.stringify(
      { successes: state.successes.length, failures: state.failures.length, byLanguage },
      null,
      2
    )
  );
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Report: ${REPORT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
