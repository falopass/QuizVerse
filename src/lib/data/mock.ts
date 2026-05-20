/**
 * Datos Mock para Demostración del Producto
 * Estos datos permiten usar la UI sin necesidad de backend
 */

import type {
  Quiz,
  Question,
  PersonalityResult,
  Category,
  Achievement,
  Profile,
} from '@/types/quiz';
import QUIZZES_GENERATED from './quizzes-generated.json';

// ============================================
// CATEGORÍAS
// ============================================

export const CATEGORIES_MOCK: Category[] = [
  {
    id: '1',
    name: 'Personality',
    slug: 'personality',
    description: 'Descubre tu verdadero yo',
    icon: '🧠',
    color: '#7c3aed',
    gradient_from: '#7c3aed',
    gradient_to: '#a855f7',
    quiz_count: 1250,
    sort_order: 1,
  },
  {
    id: '2',
    name: 'Movies & TV',
    slug: 'movies-tv',
    description: 'Para fans del cine y series',
    icon: '🎬',
    color: '#ef4444',
    gradient_from: '#ef4444',
    gradient_to: '#f97316',
    quiz_count: 890,
    sort_order: 2,
  },
  {
    id: '3',
    name: 'Music',
    slug: 'music',
    description: 'Demuestra tu conocimiento musical',
    icon: '🎵',
    color: '#ec4899',
    gradient_from: '#ec4899',
    gradient_to: '#f472b6',
    quiz_count: 567,
    sort_order: 3,
  },
  {
    id: '4',
    name: 'Gaming',
    slug: 'gaming',
    description: 'Para gamers verdaderos',
    icon: '🎮',
    color: '#06b6d4',
    gradient_from: '#06b6d4',
    gradient_to: '#22d3ee',
    quiz_count: 743,
    sort_order: 4,
  },
  {
    id: '5',
    name: 'Science',
    slug: 'science',
    description: 'Pon a prueba tu conocimiento científico',
    icon: '🔬',
    color: '#22c55e',
    gradient_from: '#22c55e',
    gradient_to: '#4ade80',
    quiz_count: 432,
    sort_order: 5,
  },
  {
    id: '6',
    name: 'History',
    slug: 'history',
    description: 'Viaja a través del tiempo',
    icon: '📜',
    color: '#f59e0b',
    gradient_from: '#f59e0b',
    gradient_to: '#fbbf24',
    quiz_count: 321,
    sort_order: 6,
  },
  {
    id: '7',
    name: 'Sports',
    slug: 'sports',
    description: 'Para amantes del deporte',
    icon: '⚽',
    color: '#3b82f6',
    gradient_from: '#3b82f6',
    gradient_to: '#60a5fa',
    quiz_count: 289,
    sort_order: 7,
  },
  {
    id: '8',
    name: 'Geography',
    slug: 'geography',
    description: 'Explora el mundo',
    icon: '🌍',
    color: '#14b8a6',
    gradient_from: '#14b8a6',
    gradient_to: '#2dd4bf',
    quiz_count: 234,
    sort_order: 8,
  },
  {
    id: '9',
    name: 'Anime & Manga',
    slug: 'anime-manga',
    description: 'Otaku nivel máximo',
    icon: '⛩️',
    color: '#e11d48',
    gradient_from: '#e11d48',
    gradient_to: '#f43f5e',
    quiz_count: 678,
    sort_order: 9,
  },
  {
    id: '10',
    name: 'Food & Drink',
    slug: 'food-drink',
    description: 'Para foodies',
    icon: '🍕',
    color: '#f97316',
    gradient_from: '#f97316',
    gradient_to: '#fb923c',
    quiz_count: 198,
    sort_order: 10,
  },
  {
    id: '11',
    name: 'Literature',
    slug: 'literature',
    description: 'Amantes de los libros',
    icon: '📚',
    color: '#8b5cf6',
    gradient_from: '#8b5cf6',
    gradient_to: '#a78bfa',
    quiz_count: 167,
    sort_order: 11,
  },
  {
    id: '12',
    name: 'Technology',
    slug: 'technology',
    description: 'Tech enthusiasts',
    icon: '💻',
    color: '#0ea5e9',
    gradient_from: '#0ea5e9',
    gradient_to: '#38bdf8',
    quiz_count: 245,
    sort_order: 12,
  },
  {
    id: '13',
    name: 'Pop Culture',
    slug: 'pop-culture',
    description: 'Siempre al día',
    icon: '🌟',
    color: '#d946ef',
    gradient_from: '#d946ef',
    gradient_to: '#e879f9',
    quiz_count: 512,
    sort_order: 13,
  },
  {
    id: '14',
    name: 'Animals',
    slug: 'animals',
    description: 'Para amantes de los animales',
    icon: '🐾',
    color: '#84cc16',
    gradient_from: '#84cc16',
    gradient_to: '#a3e635',
    quiz_count: 156,
    sort_order: 14,
  },
  {
    id: '15',
    name: 'Relationships',
    slug: 'relationships',
    description: 'Amor y amistad',
    icon: '💕',
    color: '#f43f5e',
    gradient_from: '#f43f5e',
    gradient_to: '#fb7185',
    quiz_count: 234,
    sort_order: 15,
  },
];

// ============================================
// QUIZZES MOCK
// ============================================

export const QUIZZES_MOCK: Quiz[] = [
  {
    id: '1',
    slug: 'which-harry-potter-house',
    title: 'Which Harry Potter House Do You Belong To?',
    description:
      'Discover your true Hogwarts house with this personality quiz. Are you brave like Gryffindor or wise like Ravenclaw?',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'easy',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'What quality do you value most in yourself?',
        options: [
          { id: 'a', text: 'Bravery and courage', personality_tags: ['gryffindor'] },
          { id: 'b', text: 'Intelligence and wisdom', personality_tags: ['ravenclaw'] },
          { id: 'c', text: 'Loyalty and patience', personality_tags: ['hufflepuff'] },
          { id: 'd', text: 'Ambition and determination', personality_tags: ['slytherin'] },
        ],
      },
      {
        id: 'q2',
        question: 'Choose a magical creature:',
        options: [
          { id: 'a', text: 'Phoenix', personality_tags: ['gryffindor'] },
          { id: 'b', text: 'Eagle', personality_tags: ['ravenclaw'] },
          { id: 'c', text: 'Badger', personality_tags: ['hufflepuff'] },
          { id: 'd', text: 'Serpent', personality_tags: ['slytherin'] },
        ],
      },
      {
        id: 'q3',
        question: 'What is your ideal weekend?',
        options: [
          { id: 'a', text: 'An adventurous outing', personality_tags: ['gryffindor'] },
          { id: 'b', text: 'Reading in the library', personality_tags: ['ravenclaw'] },
          { id: 'c', text: 'Time with friends', personality_tags: ['hufflepuff'] },
          { id: 'd', text: 'Working on personal goals', personality_tags: ['slytherin'] },
        ],
      },
    ] as unknown as Question[],
    results: [
      {
        id: 'r1',
        title: 'Gryffindor',
        description: 'You are brave, daring, and chivalrous. Your courage knows no bounds!',
        personality_tag: 'gryffindor',
        background_theme: 'fire',
      },
      {
        id: 'r2',
        title: 'Ravenclaw',
        description: 'You are wise, intelligent, and creative. Knowledge is your greatest asset.',
        personality_tag: 'ravenclaw',
        background_theme: 'stars',
      },
      {
        id: 'r3',
        title: 'Hufflepuff',
        description: 'You are loyal, patient, and kind. You value fairness and hard work.',
        personality_tag: 'hufflepuff',
        background_theme: 'forest',
      },
      {
        id: 'r4',
        title: 'Slytherin',
        description:
          'You are ambitious, cunning, and determined. You will stop at nothing to achieve your goals.',
        personality_tag: 'slytherin',
        background_theme: 'ocean',
      },
    ] as PersonalityResult[],
    tags: ['harry-potter', 'personality', 'movies'],
    estimated_minutes: 3,
    plays_count: 142000,
    shares_count: 28400,
    avg_score: null,
    likes_count: 8500,
    status: 'published',
    is_featured: true,
    is_ai_generated: false,
    published_at: '2024-01-15T00:00:00Z',
    created_at: '2024-01-15T00:00:00Z',
    category: CATEGORIES_MOCK[0],
  },
  {
    id: '2',
    slug: 'what-is-your-spirit-animal',
    title: 'What Is Your Spirit Animal?',
    description: 'Discover which animal best represents your inner self and personality.',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'easy',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'How do you handle challenges?',
        options: [
          { id: 'a', text: 'Face them head-on with confidence', personality_tags: ['lion'] },
          { id: 'b', text: 'Observe and plan carefully', personality_tags: ['owl'] },
          { id: 'c', text: 'Adapt and go with the flow', personality_tags: ['dolphin'] },
          { id: 'd', text: 'Work together with others', personality_tags: ['wolf'] },
        ],
      },
      {
        id: 'q2',
        question: 'What is your favorite environment?',
        options: [
          { id: 'a', text: 'Open plains or savannas', personality_tags: ['lion'] },
          { id: 'b', text: 'Dark forests or libraries', personality_tags: ['owl'] },
          { id: 'c', text: 'Oceans or beaches', personality_tags: ['dolphin'] },
          { id: 'd', text: 'Mountains or wilderness', personality_tags: ['wolf'] },
        ],
      },
    ] as unknown as Question[],
    results: [
      {
        id: 'r1',
        title: 'The Lion',
        description: 'You are a natural leader, brave and confident.',
        personality_tag: 'lion',
        background_theme: 'fire',
      },
      {
        id: 'r2',
        title: 'The Owl',
        description: 'You are wise and analytical, always seeking knowledge.',
        personality_tag: 'owl',
        background_theme: 'stars',
      },
      {
        id: 'r3',
        title: 'The Dolphin',
        description: 'You are playful, social, and free-spirited.',
        personality_tag: 'dolphin',
        background_theme: 'ocean',
      },
      {
        id: 'r4',
        title: 'The Wolf',
        description: 'You are loyal, protective, and value family.',
        personality_tag: 'wolf',
        background_theme: 'forest',
      },
    ] as PersonalityResult[],
    tags: ['animals', 'personality', 'spirit'],
    estimated_minutes: 2,
    plays_count: 98000,
    shares_count: 19600,
    avg_score: null,
    likes_count: 5200,
    status: 'published',
    is_featured: true,
    is_ai_generated: false,
    published_at: '2024-02-01T00:00:00Z',
    created_at: '2024-02-01T00:00:00Z',
    category: CATEGORIES_MOCK[0],
  },
  {
    id: '3',
    slug: 'mcu-avengers-quiz',
    title: 'Which MCU Avenger Are You?',
    description: 'Find out which Marvel superhero matches your personality and values.',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'What is your greatest strength?',
        options: [
          { id: 'a', text: 'Leadership and determination', personality_tags: ['captain'] },
          { id: 'b', text: 'Intelligence and innovation', personality_tags: ['ironman'] },
          { id: 'c', text: 'Raw power and resilience', personality_tags: ['hulk'] },
          { id: 'd', text: 'Skill and adaptability', personality_tags: ['blackwidow'] },
        ],
      },
      {
        id: 'q2',
        question: 'How do you approach conflict?',
        options: [
          {
            id: 'a',
            text: 'Stand firm and fight for what is right',
            personality_tags: ['captain'],
          },
          { id: 'b', text: 'Outsmart your opponent', personality_tags: ['ironman'] },
          { id: 'c', text: 'Overwhelm with force', personality_tags: ['hulk'] },
          { id: 'd', text: 'Use strategy and precision', personality_tags: ['blackwidow'] },
        ],
      },
    ] as unknown as Question[],
    results: [
      {
        id: 'r1',
        title: 'Captain America',
        description: 'You are a natural leader with unwavering morals.',
        personality_tag: 'captain',
        background_theme: 'stars',
      },
      {
        id: 'r2',
        title: 'Iron Man',
        description: 'You are brilliant, witty, and always one step ahead.',
        personality_tag: 'ironman',
        background_theme: 'fire',
      },
      {
        id: 'r3',
        title: 'Hulk',
        description: 'You are powerful and resilient, with hidden depths.',
        personality_tag: 'hulk',
        background_theme: 'forest',
      },
      {
        id: 'r4',
        title: 'Black Widow',
        description: 'You are skilled, mysterious, and fiercely loyal.',
        personality_tag: 'blackwidow',
        background_theme: 'ocean',
      },
    ] as PersonalityResult[],
    tags: ['marvel', 'mcu', 'movies', 'superhero'],
    estimated_minutes: 4,
    plays_count: 87000,
    shares_count: 17400,
    avg_score: null,
    likes_count: 4100,
    status: 'published',
    is_featured: true,
    is_ai_generated: false,
    published_at: '2024-02-10T00:00:00Z',
    created_at: '2024-02-10T00:00:00Z',
    category: CATEGORIES_MOCK[1],
  },
  {
    id: '4',
    slug: 'genius-or-not',
    title: 'Are You Actually A Genius?',
    description:
      'Test your knowledge across multiple subjects to find out if you have genius-level intelligence.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'hard',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'What is the speed of light?',
        options: [
          { id: 'a', text: '299,792 km/s', is_correct: true },
          { id: 'b', text: '199,792 km/s', is_correct: false },
          { id: 'c', text: '399,792 km/s', is_correct: false },
          { id: 'd', text: '99,792 km/s', is_correct: false },
        ],
        explanation: 'The speed of light in vacuum is exactly 299,792,458 meters per second.',
      },
      {
        id: 'q2',
        question: 'What is the powerhouse of the cell?',
        options: [
          { id: 'a', text: 'Nucleus', is_correct: false },
          { id: 'b', text: 'Mitochondria', is_correct: true },
          { id: 'c', text: 'Ribosome', is_correct: false },
          { id: 'd', text: 'Endoplasmic Reticulum', is_correct: false },
        ],
        explanation: 'Mitochondria produce ATP, the energy currency of cells.',
      },
      {
        id: 'q3',
        question: 'What year did World War II end?',
        options: [
          { id: 'a', text: '1943', is_correct: false },
          { id: 'b', text: '1944', is_correct: false },
          { id: 'c', text: '1945', is_correct: true },
          { id: 'd', text: '1946', is_correct: false },
        ],
        explanation: "World War II ended in 1945 with Japan's surrender in September.",
      },
    ] as unknown as Question[],
    results: null,
    tags: ['trivia', 'science', 'knowledge', 'genius'],
    estimated_minutes: 5,
    plays_count: 54000,
    shares_count: 8100,
    avg_score: 65.5,
    likes_count: 2800,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2024-02-15T00:00:00Z',
    created_at: '2024-02-15T00:00:00Z',
    category: CATEGORIES_MOCK[4],
  },
  {
    id: '5',
    slug: 'demon-slayer-breathing-style',
    title: 'Which Demon Slayer Breathing Style Suits You?',
    description: 'Find out which breathing style matches your fighting spirit and personality.',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'easy',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'What is your fighting style?',
        options: [
          { id: 'a', text: 'Direct and powerful', personality_tags: ['water'] },
          { id: 'b', text: 'Fast and agile', personality_tags: ['thunder'] },
          { id: 'c', text: 'Flexible and adaptive', personality_tags: ['insect'] },
          { id: 'd', text: 'Overwhelming force', personality_tags: ['flame'] },
        ],
      },
      {
        id: 'q2',
        question: 'What drives you forward?',
        options: [
          { id: 'a', text: 'Protecting others', personality_tags: ['water'] },
          { id: 'b', text: 'Overcoming fears', personality_tags: ['thunder'] },
          { id: 'c', text: 'Helping teammates', personality_tags: ['insect'] },
          { id: 'd', text: 'Justice and duty', personality_tags: ['flame'] },
        ],
      },
    ] as unknown as Question[],
    results: [
      {
        id: 'r1',
        title: 'Water Breathing',
        description: 'You are calm, adaptable, and protective.',
        personality_tag: 'water',
        background_theme: 'ocean',
      },
      {
        id: 'r2',
        title: 'Thunder Breathing',
        description: 'You are fast, precise, and overcome your fears.',
        personality_tag: 'thunder',
        background_theme: 'stars',
      },
      {
        id: 'r3',
        title: 'Insect Breathing',
        description: 'You are clever, helpful, and underestimated.',
        personality_tag: 'insect',
        background_theme: 'forest',
      },
      {
        id: 'r4',
        title: 'Flame Breathing',
        description: 'You are passionate, determined, and just.',
        personality_tag: 'flame',
        background_theme: 'fire',
      },
    ] as PersonalityResult[],
    tags: ['anime', 'demon-slayer', 'personality'],
    estimated_minutes: 3,
    plays_count: 65000,
    shares_count: 13000,
    avg_score: null,
    likes_count: 3900,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2024-02-20T00:00:00Z',
    created_at: '2024-02-20T00:00:00Z',
    category: CATEGORIES_MOCK[8],
  },
];

// ============================================
// USUARIOS MOCK
// ============================================

export const USERS_MOCK: Profile[] = [
  {
    id: '1',
    username: 'quiz_master',
    display_name: 'Quiz Master',
    avatar_url: null,
    bio: 'Creating and playing quizzes since 2020. Personality quiz enthusiast!',
    points: 15420,
    quizzes_played: 342,
    quizzes_created: 28,
    is_admin: false,
    is_verified: true,
    preferred_language: 'en',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-03-30T00:00:00Z',
  },
  {
    id: '2',
    username: 'anime_lover',
    display_name: 'Anime Lover',
    avatar_url: null,
    bio: 'Anime, manga, and everything Japanese. Always looking for new quiz recommendations!',
    points: 8750,
    quizzes_played: 198,
    quizzes_created: 12,
    is_admin: false,
    is_verified: false,
    preferred_language: 'en',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-03-29T00:00:00Z',
  },
  {
    id: '3',
    username: 'trivia_king',
    display_name: 'Trivia King',
    avatar_url: null,
    bio: 'Knowledge is power. 95% average score across all trivia quizzes!',
    points: 22100,
    quizzes_played: 567,
    quizzes_created: 45,
    is_admin: true,
    is_verified: true,
    preferred_language: 'en',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-03-30T00:00:00Z',
  },
  {
    id: '4',
    username: 'casual_player',
    display_name: 'Casual Player',
    avatar_url: null,
    bio: 'Just here for fun and to discover something new about myself.',
    points: 1250,
    quizzes_played: 45,
    quizzes_created: 2,
    is_admin: false,
    is_verified: false,
    preferred_language: 'en',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-28T00:00:00Z',
  },
  {
    id: '5',
    username: 'personality_queen',
    display_name: 'Personality Queen',
    avatar_url: null,
    bio: 'Personality quizzes are my therapy. I have 15 different spirit animals.',
    points: 12300,
    quizzes_played: 289,
    quizzes_created: 34,
    is_admin: false,
    is_verified: true,
    preferred_language: 'en',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-03-30T00:00:00Z',
  },
];

// ============================================
// LOGROS / ACHIEVEMENTS
// ============================================

export const ACHIEVEMENTS_MOCK: Achievement[] = [
  {
    id: 'first_quiz',
    name: 'First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    points_reward: 10,
    condition_type: 'plays',
    condition_value: 1,
  },
  {
    id: 'quiz_addict_10',
    name: 'Quiz Addict',
    description: 'Complete 10 quizzes',
    icon: '🔥',
    points_reward: 50,
    condition_type: 'plays',
    condition_value: 10,
  },
  {
    id: 'quiz_master_50',
    name: 'Quiz Master',
    description: 'Complete 50 quizzes',
    icon: '👑',
    points_reward: 150,
    condition_type: 'plays',
    condition_value: 50,
  },
  {
    id: 'perfect_score',
    name: 'Flawless',
    description: 'Get a perfect score on any quiz',
    icon: '💎',
    points_reward: 25,
    condition_type: 'score',
    condition_value: 100,
  },
  {
    id: 'creator',
    name: 'Quiz Creator',
    description: 'Create your first quiz',
    icon: '✏️',
    points_reward: 30,
    condition_type: 'creates',
    condition_value: 1,
  },
  {
    id: 'going_viral',
    name: 'Going Viral',
    description: 'Your quiz reaches 100 plays',
    icon: '🚀',
    points_reward: 50,
    condition_type: 'shares',
    condition_value: 100,
  },
  {
    id: 'internet_famous',
    name: 'Internet Famous',
    description: 'Your quiz reaches 1000 plays',
    icon: '🌟',
    points_reward: 200,
    condition_type: 'shares',
    condition_value: 1000,
  },
  {
    id: 'week_streak',
    name: 'Streak Master',
    description: 'Play quizzes 7 days in a row',
    icon: '📅',
    points_reward: 50,
    condition_type: 'streak',
    condition_value: 7,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Play quizzes from 5 different categories',
    icon: '🗺️',
    points_reward: 75,
    condition_type: 'categories',
    condition_value: 5,
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Share 10 quiz results',
    icon: '📤',
    points_reward: 40,
    condition_type: 'shares',
    condition_value: 10,
  },
];

// ============================================
// LEADERBOARD DATA
// ============================================

export const LEADERBOARD_MOCK = [
  { rank: 1, user: USERS_MOCK[2], points: 22100, quizzesPlayed: 567 },
  { rank: 2, user: USERS_MOCK[0], points: 15420, quizzesPlayed: 342 },
  { rank: 3, user: USERS_MOCK[4], points: 12300, quizzesPlayed: 289 },
  { rank: 4, user: USERS_MOCK[1], points: 8750, quizzesPlayed: 198 },
  { rank: 5, user: USERS_MOCK[3], points: 1250, quizzesPlayed: 45 },
];

// ============================================
// QUIZ RESULTADO MOCK (para página de resultado)
// ============================================

export const GAME_SESSION_MOCK = {
  id: 'session-1',
  quiz_id: '1',
  player_id: null,
  score: 2,
  max_score: 3,
  percentage: 66.67,
  result_id: 'r1',
  result_title: 'Gryffindor',
  time_taken_seconds: 45,
  share_token: 'abc123xyz',
  was_shared: false,
  result: {
    id: 'r1',
    title: 'Gryffindor',
    description: 'You are brave, daring, and chivalrous. Your courage knows no bounds!',
    background_theme: 'fire' as const,
  },
};

// ============================================
// COMBINAR QUIZZES GENERADOS CON MOCK ORIGINAL
// ============================================

// Importar quizzes generados por AI y combinarlos con los existentes
const GENERATED_QUIZZES = Array.isArray(QUIZZES_GENERATED)
  ? (QUIZZES_GENERATED as unknown as Quiz[])
  : [];

export const ALL_QUIZZES: Quiz[] = [...GENERATED_QUIZZES, ...QUIZZES_MOCK];

// ============================================
// FUNCIONES HELPER PARA OBTENER DATOS
// ============================================

export function getQuizBySlug(slug: string): Quiz | undefined {
  return ALL_QUIZZES.find((q) => q.slug === slug);
}

export function getQuizzesByCategory(categorySlug: string): Quiz[] {
  return ALL_QUIZZES.filter((q) => q.category?.slug === categorySlug);
}

export function getFeaturedQuizzes(): Quiz[] {
  return ALL_QUIZZES.filter((q) => q.is_featured);
}

export function getTrendingQuizzes(): Quiz[] {
  return [...ALL_QUIZZES].sort((a, b) => b.plays_count - a.plays_count);
}

export function searchQuizzes(query: string): Quiz[] {
  const lowerQuery = query.toLowerCase();
  return ALL_QUIZZES.filter(
    (q) =>
      q.title.toLowerCase().includes(lowerQuery) ||
      q.description?.toLowerCase().includes(lowerQuery) ||
      q.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  );
}
