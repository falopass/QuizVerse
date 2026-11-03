import type { ExploreCardQuiz } from '@/types/quiz';

/**
 * Proyecta un quiz a la fila mínima del explorador. Los campos que
 * quedan fuera (preguntas, resultados, perfil visual, fechas, contadores que
 * nadie pinta) son la mayor parte del payload RSC de `/[locale]/quiz`.
 */
export function toExploreCard(quiz: ExploreCardQuiz): ExploreCardQuiz {
  return {
    id: quiz.id,
    slug: quiz.slug,
    title: quiz.title,
    description: quiz.description,
    cover_image_url: quiz.cover_image_url,
    quiz_type: quiz.quiz_type,
    estimated_minutes: quiz.estimated_minutes,
    plays_count: quiz.plays_count,
    likes_count: quiz.likes_count,
    is_featured: quiz.is_featured,
    tags: quiz.tags,
    category: quiz.category
      ? { id: quiz.category.id, slug: quiz.category.slug, name: quiz.category.name }
      : null,
  };
}
