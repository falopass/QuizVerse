interface JsonLdData {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export function generateQuizJsonLd({
  title,
  description,
  url,
  image,
  quizType,
  questions,
  avgScore,
  playsCount,
}: {
  title: string;
  description: string;
  url: string;
  image?: string;
  quizType: 'trivia' | 'personality';
  questions: Array<{
    question: string;
    options: Array<{ text: string; isCorrect?: boolean }>;
  }>;
  avgScore?: number;
  playsCount?: number;
}): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: title,
    description,
    url,
    image,
    quizType,
    educationalLevel: 'Intermediate',
    typicalAgeRange: '13+',
    hasPart: questions.map((q, index) => ({
      '@type': 'Question',
      position: index + 1,
      name: q.question,
      acceptedAnswer: q.options.find((o) => o.isCorrect)
        ? {
            '@type': 'Answer',
            text: q.options.find((o) => o.isCorrect)?.text || '',
          }
        : null,
      suggestedAnswer: q.options.map((o) => ({
        '@type': 'Answer',
        text: o.text,
        isAccepted: o.isCorrect || false,
      })),
    })),
    aggregateRating: avgScore
      ? {
          '@type': 'AggregateRating',
          ratingValue: avgScore.toFixed(0),
          bestRating: '100',
          worstRating: '0',
          ratingCount: playsCount || 0,
        }
      : null,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/PlayAction',
      userInteractionCount: playsCount || 0,
    },
  };
}

export function generateWebSiteJsonLd({
  name,
  url,
  description,
}: {
  name: string;
  url: string;
  description: string;
}): JsonLdData {
  return {
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
}

export function generateProfileJsonLd({
  username,
  name,
  url,
  quizzesCreated,
}: {
  username: string;
  name: string;
  url: string;
  quizzesCreated: number;
}): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url,
    additionalName: username,
    sameAs: [url],
    knowsAbout: ['Quizzes', 'Trivia', 'Personality Tests'],
    accomplishmentCount: quizzesCreated,
  };
}

export default generateQuizJsonLd;
