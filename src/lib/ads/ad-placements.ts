/**
 * Ad placement logic - determines where and when to show ads
 */

export interface AdPlacementConfig {
  enabled: boolean;
  frequency?: number; // Show ad every N items
  minItems?: number; // Minimum items before showing ads
  positions?: number[]; // Specific positions to show ads
}

export const AD_PLACEMENT_RULES = {
  // Quiz landing page
  quizLanding: {
    sidebar: { enabled: true },
    belowDescription: { enabled: true },
  },

  // Quiz player (between questions)
  quizPlayer: {
    betweenQuestions: {
      enabled: true,
      frequency: 5, // Show ad every 5 questions
      minItems: 2, // Don't show before question 2
    },
  },

  // Result page
  resultPage: {
    belowResult: { enabled: true },
    sidebar: { enabled: true },
  },

  // Category pages (in-feed)
  categoryPage: {
    inFeed: {
      enabled: true,
      frequency: 8, // Show ad every 8 quiz cards
      minItems: 4,
    },
  },

  // Home page
  homePage: {
    belowHero: { enabled: true },
    trendingAfter: {
      enabled: true,
      frequency: 6,
    },
  },
};

export function shouldShowAdBetweenItems(index: number, frequency: number, minItems: number = 0): boolean {
  return index >= minItems && index % frequency === 0;
}

export function getAdPlacementForQuestion(questionIndex: number, totalQuestions: number): boolean {
  const { betweenQuestions } = AD_PLACEMENT_RULES.quizPlayer;
  if (!betweenQuestions.enabled) return false;

  const { frequency = 5, minItems = 2 } = betweenQuestions;

  // Don't show ad after the last question (show on result page instead)
  if (questionIndex >= totalQuestions - 1) return false;

  return (questionIndex + 1) % frequency === 0 && questionIndex >= minItems;
}

export function getAdPlacementForQuizCard(index: number, totalQuizzes: number): boolean {
  const { inFeed } = AD_PLACEMENT_RULES.categoryPage;
  if (!inFeed.enabled) return false;

  const { frequency = 8, minItems = 4 } = inFeed;

  return shouldShowAdBetweenItems(index, frequency, minItems);
}

export default AD_PLACEMENT_RULES;
