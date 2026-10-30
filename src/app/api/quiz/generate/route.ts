import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQuizWithAI } from '@/lib/quiz/generator';
import { validateAIQuizResponse } from '@/lib/quiz/validator';
import { inferVisualProfile } from '@/lib/design/visual-profile';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

const generateQuizSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  quiz_type: z.enum(['trivia', 'personality']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  num_questions: z.number().int().min(3).max(20),
  language: z.string().trim().min(2).max(10).default('en'),
});

function getRequestIdentifier(request: NextRequest) {
  return clientIpFromHeaders(request.headers, 'anonymous');
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

  const aiValidation = validateAIQuizResponse(result.data, parsed.data.quiz_type);

  if (!aiValidation.valid) {
    console.error('[quiz/generate] AI returned an invalid quiz', {
      topic: parsed.data.topic,
      quizType: parsed.data.quiz_type,
      errors: aiValidation.errors,
    });
    const error =
      parsed.data.language === 'es' ? 'El quiz generado no es válido' : 'Generated quiz is invalid';
    return NextResponse.json({ error, rateLimit }, { status: 502 });
  }

  const validationWarnings: string[] = [];

  if (result.data.questions.length !== parsed.data.num_questions) {
    validationWarnings.push('The generated question count differs from the requested count.');
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
