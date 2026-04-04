/**
 * Script para generar quizzes con AI usando OpenRouter API
 *
 * Uso:
 * 1. Setear OPENROUTER_API_KEY en .env.local
 * 2. Ejecutar: npx tsx scripts/seed-quizzes.ts
 *
 * Genera 80+ quizzes en ~5-8 minutos
 * Costo estimado: ~$0.10-0.20 USD con Qwen (free model)
 */

import * as fs from 'fs';
import * as path from 'path';
import { transformAIQuizToDB, generateSlug } from '@/lib/quiz/generator';
import { validateQuiz } from '@/lib/quiz/validator';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// ============================================
// CONFIGURACIÓN DE OPENROUTER
// ============================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'qwen/qwen3.6-plus-preview:free';

function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no encontrada en .env.local');
  }

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://quizverse.app',
      'X-Title': 'QuizVerse',
    },
  });
}

// ============================================
// TOPICS PARA GENERAR QUIZZES
// ============================================

const PERSONALITY_TOPICS = [
  // Movies & TV
  'Which Harry Potter character are you',
  'Which Marvel Avenger are you',
  'Which Star Wars character are you',
  'Which Game of Thrones character are you',
  'Which Stranger Things character are you',
  'Which Disney villain are you',
  'Which Pixar character are you',
  'Which Lord of the Rings character are you',
  'Which Twilight character are you',
  'Which Hunger Games character are you',

  // Anime
  'Which Naruto character are you',
  'Which One Piece character are you',
  'Which Attack on Titan character are you',
  'Which My Hero Academia character are you',
  'Which Demon Slayer character are you',
  'Which Dragon Ball character are you',
  'Which Sailor Moon character are you',
  'Which Death Note character are you',
  'Which Jujutsu Kaisen character are you',
  'Which Spy x Family character are you',

  // Gaming
  'Which League of Legends champion are you',
  'Which Overwatch hero are you',
  'Which Valorant agent are you',
  'Which Genshin Impact character are you',
  'Which Minecraft creature are you',
  'Which Pokemon type are you',
  'Which Zelda character are you',
  'Which Final Fantasy character are you',
  'Which Skyrim class are you',
  'Which Among Us color are you',

  // Music
  'Which music genre matches your personality',
  'Which K-pop group matches your vibe',
  'Which Taylor Swift era are you',
  'Which rock star are you',
  'Which rapper are you',

  // Lifestyle
  'What is your spirit animal',
  'What is your spirit element',
  'What is your ideal vacation type',
  'What is your coffee order personality',
  'What is your interior design style',
  'What is your fashion style',
  'What is your workout personality',
  'What is your cooking style',

  // Personality Traits
  'What is your love language',
  'What is your communication style',
  'What is your leadership style',
  'What is your learning style',
  'What is your decision-making style',
  'What is your stress response style',
  'What is your social battery type',
  'What is your creativity type',

  // Career
  'What career path suits you',
  'What startup role are you',
  'What tech job matches you',
  'What creative career fits you',
  'What business type should you run',

  // Fantasy
  'Which Hogwarts house do you belong to',
  'Which magical creature are you',
  'Which wizard type are you',
  'Which mythological god are you',
  'Which fairy tale character are you',
  'Which superhero power do you have',

  // Food
  'What pizza topping are you',
  'What dessert matches your personality',
  'What snack are you',
  'What breakfast food are you',
  'What cocktail matches your vibe',

  // Nature
  'What season are you',
  'What weather type are you',
  'What flower are you',
  'What tree are you',
  'What natural landscape are you',

  // Fun
  'What emoji are you',
  'What color are you',
  'What decade were you born in (soul)',
  'What fictional school would you attend',
  'What superpower do you have',
];

const TRIVIA_TOPICS = [
  'Harry Potter trivia',
  'Marvel MCU trivia',
  'Star Wars trivia',
  'General knowledge',
  'Science trivia',
  'History trivia',
  'Geography trivia',
  'Music trivia',
  'Movie trivia',
  'Sports trivia',
  'Anime trivia',
  'Video game trivia',
  '90s nostalgia trivia',
  'Pop culture trivia',
  'Food and drink trivia',
];

// ============================================
// GENERAR QUIZZES CON CONCURRENCY POOL
// ============================================

const CONCURRENCY_LIMIT = 5; // Requests simultáneos

// Implementación simple de pool de concurrencia
async function runWithConcurrency<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  concurrencyLimit: number
): Promise<void> {
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = processor(item, i).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function generateQuizzes() {
  let client: OpenAI;

  try {
    client = createOpenRouterClient();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  const allQuizzes: any[] = [];
  const failedTopics: { topic: string; error: string }[] = [];

  console.log('🚀 Iniciando generación de quizzes con AI (paralelo)...\n');
  console.log(`📋 Topics a procesar: ${PERSONALITY_TOPICS.length + TRIVIA_TOPICS.length}`);
  console.log(`🔀 Concurrencia: ${CONCURRENCY_LIMIT} requests simultáneos`);
  console.log(`🤖 Modelo: ${OPENROUTER_MODEL}`);
  console.log(`⏱️  Tiempo estimado: ~${Math.ceil((PERSONALITY_TOPICS.length + TRIVIA_TOPICS.length) * 4 / CONCURRENCY_LIMIT / 60)} minutos\n`);

  // Generar personality quizzes en paralelo
  console.log('📝 Generando personality quizzes...\n');

  // Saltar los primeros 42 (ya generados)
  const SKIP_FIRST = 42;

  await runWithConcurrency(
    PERSONALITY_TOPICS.slice(SKIP_FIRST),
    async (topic, i) => {
      const realIndex = i + SKIP_FIRST;
      const progress = `${realIndex + 1}/${PERSONALITY_TOPICS.length}`;
      console.log(`[${progress}] Generando: ${topic}...`);

      try {
        const result = await generatePersonalityQuiz(client, topic);

        if (result) {
          const slug = generateSlug(topic);

          const quizData = transformAIQuizToDB(result, {
            slug,
            category_id: null,
            creator_id: null,
            language: 'en',
          });

          const quiz = {
            id: `generated-${realIndex + 1}`,
            ...quizData,
            plays_count: Math.floor(Math.random() * 10000),
            shares_count: Math.floor(Math.random() * 2000),
            likes_count: Math.floor(Math.random() * 500),
            avg_score: null,
            status: 'published' as const,
            is_featured: realIndex < 5,
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          allQuizzes.push(quiz);
          console.log(`   ✅ Exitoso - ${quiz.questions.length} preguntas, ${quiz.results?.length || 0} resultados`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Falló: ${errorMsg}`);
        failedTopics.push({ topic, error: errorMsg });
      }
    },
    CONCURRENCY_LIMIT
  );

  // Generar trivia quizzes en paralelo
  console.log('\n📊 Generando trivia quizzes...\n');

  await runWithConcurrency(
    TRIVIA_TOPICS,
    async (topic, i) => {
      const progress = `${PERSONALITY_TOPICS.length + i + 1}/${PERSONALITY_TOPICS.length + TRIVIA_TOPICS.length}`;
      console.log(`[${progress}] Generando: ${topic}...`);

      try {
        const result = await generateTriviaQuiz(client, topic);

        if (result) {
          const slug = generateSlug(topic);

          const quizData = transformAIQuizToDB(result, {
            slug,
            category_id: null,
            creator_id: null,
            language: 'en',
          });

          const quiz = {
            id: `trivia-${i + 1}`,
            ...quizData,
            plays_count: Math.floor(Math.random() * 10000),
            shares_count: Math.floor(Math.random() * 2000),
            likes_count: Math.floor(Math.random() * 500),
            avg_score: 65 + Math.random() * 20,
            status: 'published' as const,
            is_featured: false,
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          allQuizzes.push(quiz);
          console.log(`   ✅ Exitoso - ${quiz.questions.length} preguntas`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Falló: ${errorMsg}`);
        failedTopics.push({ topic, error: errorMsg });
      }
    },
    CONCURRENCY_LIMIT
  );

  // ============================================
  // GUARDAR RESULTADOS
  // ============================================

  const outputDir = path.join(process.cwd(), 'src', 'lib', 'data');
  const outputPath = path.join(outputDir, 'quizzes-generated.json');

  // Crear directorio si no existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Guardar quizzes generados
  fs.writeFileSync(outputPath, JSON.stringify(allQuizzes, null, 2));

  // ============================================
  // RESUMEN
  // ============================================

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE GENERACIÓN');
  console.log('='.repeat(50));
  console.log(`✅ Exitosos: ${allQuizzes.length}`);
  console.log(`❌ Fallidos: ${failedTopics.length}`);
  console.log(`📁 Archivo guardado: ${outputPath}`);

  if (failedTopics.length > 0) {
    console.log('\n⚠️  Topics fallidos:');
    failedTopics.forEach(({ topic, error }) => {
      console.log(`   - ${topic}: ${error}`);
    });
  }

  console.log('\n✨ ¡Generación completada!');
  console.log(`\nPara usar los quizzes:`);
  console.log('1. Importa el archivo en src/lib/data/mock.ts');
  console.log('2. Agrega: export const QUIZZES_GENERATED = require("./quizzes-generated.json").default;');
  console.log('3. Combina con: export const QUIZZES_MOCK = [...QUIZZES_GENERATED, ...QUIZZES_MOCK_ORIGINAL];');
}

// ============================================
// FUNCIONES DE GENERACIÓN CON OPENAI
// ============================================

const PERSONALITY_SYSTEM_PROMPT = `You are a quiz creator for QuizVerse, a fun quiz platform.
Create a personality quiz with the following EXACT JSON structure:

{
  "title": "Quiz Title",
  "description": "2-3 sentence engaging description",
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "options": [
        {"id": "a", "text": "Option A", "personality_tags": ["tag1", "tag2"]},
        {"id": "b", "text": "Option B", "personality_tags": ["tag3", "tag4"]},
        {"id": "c", "text": "Option C", "personality_tags": ["tag5", "tag6"]},
        {"id": "d", "text": "Option D", "personality_tags": ["tag7", "tag8"]}
      ],
      "explanation": null
    }
  ],
  "results": [
    {
      "id": "r1",
      "title": "Result Name",
      "description": "2-3 sentence result description",
      "personality_tag": "tag1",
      "background_theme": "fire"
    }
  ],
  "tags": ["tag1", "tag2"],
  "estimated_minutes": 3
}

Rules:
- Exactly 10 questions, each with exactly 4 options
- Exactly 4 results with distinct personality_tag values
- personality_tags in options MUST match result personality_tag values
- background_theme: one of "fire", "ice", "stars", "ocean", "forest", "mystic"
- Fun, engaging questions
- Output ONLY valid JSON, no markdown or explanations`;

const TRIVIA_SYSTEM_PROMPT = `You are a quiz creator for QuizVerse, a fun quiz platform.
Create a trivia quiz with the following EXACT JSON structure:

{
  "title": "Quiz Title",
  "description": "2-3 sentence engaging description",
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "options": [
        {"id": "a", "text": "Option A", "is_correct": false},
        {"id": "b", "text": "Option B", "is_correct": true},
        {"id": "c", "text": "Option C", "is_correct": false},
        {"id": "d", "text": "Option D", "is_correct": false}
      ],
      "explanation": "Brief explanation of why this is correct"
    }
  ],
  "tags": ["tag1", "tag2"],
  "estimated_minutes": 3
}

Rules:
- Exactly 10 questions, each with exactly 4 options
- Exactly 1 correct answer per question (is_correct: true)
- Vary the position of correct answers (a, b, c, d)
- Mix of easy, medium, and hard questions
- explanation should be 1-2 sentences
- Output ONLY valid JSON, no markdown or explanations`;

async function generatePersonalityQuiz(client: OpenAI, topic: string) {
  const completion = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: PERSONALITY_SYSTEM_PROMPT },
      { role: 'user', content: `Create a personality quiz about: ${topic}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  return JSON.parse(content);
}

async function generateTriviaQuiz(client: OpenAI, topic: string) {
  const completion = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: TRIVIA_SYSTEM_PROMPT },
      { role: 'user', content: `Create a trivia quiz about: ${topic}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  return JSON.parse(content);
}

// Ejecutar
generateQuizzes().catch(console.error);
