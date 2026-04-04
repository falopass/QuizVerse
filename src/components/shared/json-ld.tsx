import type { Quiz } from '@/types/quiz';

interface QuizJsonLdProps {
  quiz: Quiz;
}

export function QuizJsonLd({ quiz }: QuizJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: quiz.title,
    description: quiz.description,
    url: `https://quizverse.app/quiz/${quiz.slug}`,
    image: quiz.cover_image_url,
    quizType: quiz.quiz_type,
    difficulty: quiz.difficulty,
    educationalLevel: quiz.difficulty,
    typicalAgeRange: '13+',
    creator: quiz.creator
      ? {
          '@type': 'Person',
          name: quiz.creator.display_name || quiz.creator.username,
          url: `https://quizverse.app/profile/${quiz.creator.username}`,
        }
      : null,
    hasPart: quiz.questions.map((q, index) => ({
      '@type': 'Question',
      position: index + 1,
      name: q.question,
      acceptedAnswer: q.options.find((o) => o.is_correct)
        ? {
            '@type': 'Answer',
            text: q.options.find((o) => o.is_correct)?.text || '',
          }
        : null,
      suggestedAnswer: q.options.map((o) => ({
        '@type': 'Answer',
        text: o.text,
        isAccepted: o.is_correct || false,
      })),
    })),
    aggregateRating: quiz.avg_score
      ? {
          '@type': 'AggregateRating',
          ratingValue: quiz.avg_score.toFixed(0),
          bestRating: '100',
          worstRating: '0',
          ratingCount: quiz.plays_count,
        }
      : null,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/PlayAction',
      userInteractionCount: quiz.plays_count,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface WebSiteJsonLdProps {
  name: string;
  url: string;
  description: string;
}

export function WebSiteJsonLd({ name, url, description }: WebSiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${url}/quiz?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default QuizJsonLd;
