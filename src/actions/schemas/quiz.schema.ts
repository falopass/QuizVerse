import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().max(300).optional(),
  quiz_type: z.enum(['trivia', 'personality', 'poll']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  language: z.string().default('en'),
  category_id: z.string().uuid().optional(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          is_correct: z.boolean().optional(),
          personality_tags: z.array(z.string()).optional(),
        })
      ),
      explanation: z.string().optional(),
      time_limit_seconds: z.number().optional(),
    })
  ),
  results: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        min_score: z.number().optional(),
        max_score: z.number().optional(),
        personality_tag: z.string().optional(),
        background_theme: z.enum(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']).optional(),
      })
    )
    .optional(),
  tags: z.array(z.string()).default([]),
  estimated_minutes: z.number().default(3),
});
