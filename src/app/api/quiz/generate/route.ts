import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQuizWithAI } from '@/lib/quiz/generator';
import { inferVisualProfile } from '@/lib/design/visual-profile';

const generateQuizSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  quiz_type: z.enum(['trivia', 'personality']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  num_questions: z.number().int().min(3).max(20),
  language: z.string().trim().min(2).max(10).default('en'),
});

function getRequestIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'anonymous';
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = generateQuizSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid generation request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekApiKey) {
    return NextResponse.json(
      { error: 'Missing DEEPSEEK_API_KEY server configuration' },
      { status: 500 }
    );
  }

  let rateLimit = {
    allowed: true,
    remaining: 10,
    reset: 60,
  };

  try {
    const { quizLimiter } = await import('@/lib/utils/rate-limit');
    rateLimit = await quizLimiter.check(getRequestIdentifier(request));
  } catch {
    rateLimit = {
      allowed: true,
      remaining: 10,
      reset: 60,
    };
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        rateLimit,
      },
      { status: 429 }
    );
  }

  const result = await generateQuizWithAI(parsed.data, deepseekApiKey);

  if (!result.success || !result.data) {
    return NextResponse.json(
      {
        error: result.error || 'Failed to generate quiz',
        rateLimit,
      },
      { status: 502 }
    );
  }

  const validationWarnings: string[] = [];

  if (result.data.questions.length !== parsed.data.num_questions) {
    validationWarnings.push('The generated question count differs from the requested count.');
  }

  if (parsed.data.quiz_type === 'trivia') {
    const invalidTriviaQuestion = result.data.questions.find(
      (question) => question.options.filter((option) => option.is_correct).length !== 1
    );

    if (invalidTriviaQuestion) {
      validationWarnings.push(
        'At least one trivia question does not have exactly one correct answer.'
      );
    }
  }

  if (parsed.data.quiz_type === 'personality' && !result.data.results?.length) {
    validationWarnings.push('The personality quiz did not return any results.');
  }

  return NextResponse.json({
    quiz: {
      ...result.data,
      quiz_type: parsed.data.quiz_type,
      difficulty: parsed.data.difficulty,
      language: parsed.data.language,
      visual_profile: inferVisualProfile({
        title: result.data.title,
        description: result.data.description,
        quiz_type: parsed.data.quiz_type,
        tags: result.data.tags ?? [],
        category: null,
        language: parsed.data.language,
      }),
    },
    validationWarnings,
    rateLimit,
    sourceLanguage: parsed.data.language,
  });
}
