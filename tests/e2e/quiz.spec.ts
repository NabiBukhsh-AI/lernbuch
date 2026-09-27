import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Phase 6 acceptance — ARCHITECTURE.md Section 19.
 *
 *   "refreshing mid quiz resumes at the same question with prior answers
 *    intact."
 */

const SLUG = '2099-01-01-lektion-99';
const QUIZ_URL = `/lessons/${SLUG}/quiz`;

/**
 * Waits until the runner is showing question `n`.
 *
 * Advancing is asynchronous — "Next" autosaves the current answer before it
 * moves — and Playwright's `click()` resolves as soon as the click is
 * dispatched, not when the handler finishes. Reading the progress line
 * immediately after a click therefore races the save and often sees the old
 * question.
 */
async function expectQuestion(page: Page, n: number) {
  await expect(page.getByText(new RegExp(`Question ${n} of `))).toBeVisible();
}

/**
 * Steps back to question 1.
 *
 * The runner resumes an unfinished attempt at the first unanswered question —
 * that is the behaviour Phase 6 requires — so a test cannot assume it lands on
 * question 1 just because it navigated to the quiz. Rewinding makes each test
 * independent of the ones before it. "Back" only moves the index, so it needs
 * no save and no wait.
 */
async function rewindToStart(page: Page) {
  const back = page.getByRole('button', { name: 'Back', exact: true });
  while (!(await back.isDisabled())) {
    await back.click();
  }
  await expectQuestion(page, 1);
}

test.beforeEach(async ({ page }) => {
  await loginAs(page);
});

/**
 * Opens the quiz and presses Start if it has not been begun.
 *
 * An attempt is no longer created by rendering the page, so the runner only
 * appears once the learner asks for it. An attempt already in flight is
 * resumed, and then there is no Start button to press.
 */
async function openQuiz(page: Page) {
  await page.goto(QUIZ_URL);
  const start = page.getByRole('button', { name: /Start quiz|Take it again/ });
  if ((await start.count()) > 0) {
    await start.click();
  }
  await expect(page.getByText(/Question \d+ of \d+/)).toBeVisible();
}

test.describe('quiz runner', () => {
  /*
   * Must run before anything starts an attempt. Opening the page used to
   * create one, so a quiz that had never been taken already reported as in
   * progress, and once its time limit elapsed, as failed.
   */
  test('does not begin an attempt just by opening the page', async ({ page }) => {
    await page.goto(QUIZ_URL);

    await expect(
      page.getByRole('button', { name: /Start quiz|Take it again/ }),
    ).toBeVisible();
    // No runner, no timer, nothing counted against the learner.
    await expect(page.getByText(/Question \d+ of \d+/)).toHaveCount(0);
    await expect(page.getByRole('timer')).toHaveCount(0);
  });

  test('starts on the button and shows the first question', async ({ page }) => {
    await page.goto(QUIZ_URL);
    await page.getByRole('button', { name: /Start quiz|Take it again/ }).click();
    await expect(page.getByText(/Question 1 of 2/)).toBeVisible();
  });

  test('shows one question at a time with a progress bar', async ({ page }) => {
    await openQuiz(page);

    await expect(page.getByRole('heading', { name: 'Fixture quiz' })).toBeVisible();
    await expect(page.getByText(/Question \d+ of 2/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('offers no hint in a graded quiz (Section 14)', async ({ page }) => {
    await openQuiz(page);
    // The fixture quiz is kind: graded, so the hint must not be offered at all.
    await expect(page.getByRole('button', { name: /Nudge me/ })).toHaveCount(0);
    // Nor may the hint text be in the payload.
    expect(await page.content()).not.toContain('Which gender changes in the Akkusativ?');
  });

  /*
   * The runaway timer used to fire a Server Action every second once the clock
   * had run out, which left React in a permanently pending transition. A
   * Next.js Link navigation is itself a transition, so the app became
   * impossible to leave.
   */
  test('can navigate away from a quiz in progress', async ({ page }) => {
    await openQuiz(page);

    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: 'Lessons' })
      .click();

    await expect(page).toHaveURL(/\/lessons$/);
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
  });

  test('shows the timer for a timed quiz', async ({ page }) => {
    await openQuiz(page);
    await expect(page.getByRole('timer')).toBeVisible();
  });
});

test.describe('resume after refresh (the Phase 6 criterion)', () => {
  test('comes back to the same question with the answer intact', async ({ page }) => {
    await openQuiz(page);
    await rewindToStart(page);

    // Answer question 1 and advance, which autosaves it.
    const firstOption = page.locator('input[type="radio"]').first();
    await firstOption.check();
    const chosen = await firstOption.getAttribute('value');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectQuestion(page, 2);

    await page.reload();

    // Same question, not back to the start.
    await expect(page.getByText(/Question 2 of 2/)).toBeVisible();

    // And the earlier answer survived: stepping back shows it still chosen.
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator(`input[type="radio"][value="${chosen}"]`)).toBeChecked();
  });

  test('does not start a second attempt on reload', async ({ page }) => {
    await openQuiz(page);
    await rewindToStart(page);

    await page.locator('input[type="radio"]').first().check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectQuestion(page, 2);

    await page.reload();
    // A fresh attempt would resume at question 1 with nothing answered.
    await expectQuestion(page, 2);
  });

  test('keeps the question order stable across a refresh', async ({ page }) => {
    await openQuiz(page);
    const promptBefore = await page.locator('p[lang="de"]').first().textContent();

    await page.reload();
    const promptAfter = await page.locator('p[lang="de"]').first().textContent();

    // Shuffle is seeded from the attempt id, so the order must not move.
    expect(promptAfter).toBe(promptBefore);
  });
});

/**
 * Answers every question in the quiz and finishes it.
 *
 * The runner deliberately resumes an unfinished attempt (that is the Phase 6
 * criterion), so a test arriving after the resume tests above lands mid-quiz
 * with earlier answers already saved. Rewinding to the first question first
 * means every question is answered by this helper rather than inherited, which
 * is what makes the resulting score predictable.
 */
async function answerWholeQuiz(page: Page, correctly: boolean) {
  await rewindToStart(page);

  for (let n = 1; ; n++) {
    const prompt = await page.locator('p[lang="de"]').first().textContent();
    // q1 is "Ich sehe ___ Tisch." (den); q2 is "___ Tisch" (der).
    const isAkkusativ = prompt?.includes('sehe') ?? false;
    const value = correctly ? (isAkkusativ ? 'den' : 'der') : isAkkusativ ? 'dem' : 'die';

    await page.locator(`input[type="radio"][value="${value}"]`).check();

    const finish = page.getByRole('button', { name: 'Finish', exact: true });
    if ((await finish.count()) > 0) {
      await finish.click();
      return;
    }

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    // Wait for the advance before reading the next prompt, or the same
    // question gets answered twice and the last one never gets answered.
    await expectQuestion(page, n + 1);
  }
}

test.describe('scoring and results', () => {
  test('scores the attempt and shows the per-skill breakdown', async ({ page }) => {
    await openQuiz(page);
    await answerWholeQuiz(page, true);

    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText(/Passed/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By skill' })).toBeVisible();
  });

  test('lists missed questions with their explanations and offers review', async ({
    page,
  }) => {
    await openQuiz(page);
    await answerWholeQuiz(page, false);

    await expect(
      page.getByRole('heading', { name: 'What to look at again' }),
    ).toBeVisible();
    // Rule 3.6: the answer is never shown without its reason.
    await expect(
      page.getByText('Tisch is masculine and is the direct object.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add missed items to review' }).click();
    await expect(page.getByText('Added to your review queue.')).toBeVisible();
  });
});
