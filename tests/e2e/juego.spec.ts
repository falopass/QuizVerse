import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';

const id = '123e4567-e89b-42d3-a456-426614174000';
const slug = 'en-trivia-e2e-fixture';
const questions = [
  {
    id: 'q1',
    question: 'Which number is even?',
    explanation: 'Two is divisible by two.',
    options: [
      { id: 'two', text: 'Two', is_correct: true },
      { id: 'one', text: 'One', is_correct: false },
    ],
  },
  {
    id: 'q2',
    question: 'Which number is odd?',
    options: [
      { id: 'three', text: 'Three', is_correct: true },
      { id: 'four', text: 'Four', is_correct: false },
    ],
  },
];
const publicQuiz = {
  id,
  slug,
  title: 'Numbers fixture',
  description: 'Synthetic quiz for the keyboard flow.',
  quiz_type: 'trivia',
  language: 'en',
  difficulty: 'easy',
  questions: questions.map(({ id, question, options }) => ({
    id,
    question,
    options: options.map(({ id, text }) => ({ id, text })),
  })),
  results: null,
  tags: [],
  estimated_minutes: 1,
  plays_count: 0,
  shares_count: 0,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

const fixture = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4511');
  const single = request.headers.accept?.includes('vnd.pgrst.object+json');
  response.setHeader('content-type', 'application/json');
  if (
    url.pathname === '/rest/v1/quiz_answer_keys' &&
    url.searchParams.get('quiz_id') === `eq.${id}`
  ) {
    response.end(JSON.stringify(single ? { questions } : [{ questions }]));
  } else if (
    url.pathname === '/rest/v1/quizzes' &&
    (url.searchParams.get('slug') === `eq.${slug}` || url.searchParams.get('id') === `eq.${id}`)
  ) {
    response.end(JSON.stringify(single ? publicQuiz : [publicQuiz]));
  } else if (!single && url.pathname.startsWith('/rest/v1/')) {
    response.end('[]');
  } else {
    response.statusCode = 404;
    response.end('{}');
  }
});

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(4511, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    fixture.close((error) => (error ? reject(error) : resolve()));
  });
});

for (const { mode, reducedMotion, viewport } of [
  { mode: 'classic', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } },
  { mode: 'practice', reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } },
] as const) {
  test(`${mode}: pause restores focus and the verdict hands off to the next control`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize(viewport);
    const response = await page.goto(`/en/quiz/${slug}/play?mode=${mode}`);
    expect(response?.ok()).toBe(true);
    expect(await response?.text()).not.toContain('is_correct');

    const firstOption = page.getByRole('button', { name: /Two/ });
    await firstOption.focus();
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(firstOption).toBeFocused();

    const reveal = page.waitForResponse((response) => response.url().endsWith('/api/quiz/reveal'));
    await page.keyboard.press('Enter');
    expect((await reveal).ok()).toBe(true);

    const verdict = page.locator('.arcade-question').locator('[role="status"], [aria-live]');
    await expect(verdict).toHaveCount(1);
    await expect(verdict).toContainText('Correct');
    await expect(verdict).toContainText('Two is divisible by two.');
    await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: questions[1].question })).toBeFocused();
    await page.keyboard.press('1');
    await expect(page.getByRole('button', { name: 'Finish' })).toBeFocused();
  });
}
