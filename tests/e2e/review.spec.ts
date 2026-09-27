import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Phase 7 — review session and the global banks.
 *
 * The Phase 7 acceptance criterion (a fresh card graded good four times gives
 * 1, 3, 8, 20 days) is a property of the scheduler and is asserted exactly in
 * tests/srs/scheduler.test.ts. This covers the surfaces around it.
 */

test.beforeEach(async ({ page }) => {
  await loginAs(page);
});

test.describe('review session', () => {
  test('shows a card and hides the answer until asked', async ({ page }) => {
    await page.goto('/review');

    const card = page.getByTestId('review-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('card-front')).toBeVisible();
    // The back must not be rendered before the reveal.
    await expect(page.getByTestId('card-back')).toHaveCount(0);
  });

  test('space reveals and 1..4 grade (Section 11.3)', async ({ page }) => {
    await page.goto('/review');
    await expect(page.getByTestId('review-card')).toBeVisible();

    // Grade buttons only exist once the answer is showing.
    await expect(page.getByRole('button', { name: /Good/ })).toHaveCount(0);

    // The card renders before the key listener is attached on hydration, so a
    // single early press can be lost. Revealing twice is harmless.
    await expect(async () => {
      await page.keyboard.press('Space');
      await expect(page.getByTestId('card-back')).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(page.getByRole('button', { name: /Good/ })).toBeVisible();

    const before = await page.getByText(/\d+ of \d+/).textContent();
    await page.keyboard.press('3');
    // Grading advances, so the counter has to move.
    await expect(page.getByText(/\d+ of \d+/)).not.toHaveText(before ?? '');
  });

  test('clicking a grade button works as well as the keyboard', async ({ page }) => {
    await page.goto('/review');
    await page.getByRole('button', { name: /Show answer/ }).click();
    await expect(page.getByTestId('card-back')).toBeVisible();
    await page.getByRole('button', { name: /Good/ }).click();
    await expect(page.getByTestId('review-card')).toBeVisible();
  });

  test('class mistakes come first (Section 13)', async ({ page }) => {
    await page.goto('/review');
    // The fixture lesson authors two errors, so the queue opens on one.
    await expect(page.getByText('from class')).toBeVisible();
    await expect(page.getByText('Correct the sentence')).toBeVisible();
  });
});

test.describe('vocabulary bank', () => {
  test('lists words with their article and plural', async ({ page }) => {
    await page.goto('/vocabulary');

    await expect(page.getByRole('heading', { name: 'Vocabulary' })).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'Tisch' });
    await expect(row).toContainText('der');
    await expect(row).toContainText('Tische');
    await expect(row).toContainText('table');
  });

  test('search uses the German stemmer', async ({ page }) => {
    // "Tische" is the plural; the German configuration stems it to "Tisch".
    await page.goto('/vocabulary?q=Tische');
    await expect(page.getByRole('row').filter({ hasText: 'Tisch' })).toBeVisible();
  });

  test('filters by gender', async ({ page }) => {
    await page.goto('/vocabulary?gender=der');
    const rows = page.getByRole('row');
    // Header plus at least one match, and nothing feminine.
    await expect(rows.filter({ hasText: 'Tisch' })).toBeVisible();
    await expect(rows.filter({ hasText: 'die Jacke' })).toHaveCount(0);
  });

  test('an empty result explains itself rather than showing a blank table', async ({
    page,
  }) => {
    await page.goto('/vocabulary?q=zzzzznotaword');
    await expect(page.getByRole('heading', { name: 'Nothing matches' })).toBeVisible();
  });
});

test.describe('grammar bank', () => {
  test('groups rules by skill family', async ({ page }) => {
    await page.goto('/grammar');
    await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible();
    // Lektion 01 and the fixture both teach the Akkusativ.
    await expect(page.getByRole('heading', { name: 'case', exact: true })).toBeVisible();
  });

  test('searches titles and rules', async ({ page }) => {
    await page.goto('/grammar?q=Akkusativ');
    await expect(page.getByRole('link', { name: /Akkusativ/ }).first()).toBeVisible();
  });

  test('links through to the lesson that taught the rule', async ({ page }) => {
    await page.goto('/grammar?q=Akkusativ');
    const link = page.getByRole('link', { name: /Akkusativ/ }).first();
    await expect(link).toHaveAttribute('href', /\/lessons\/.+\/grammar#/);
  });
});
