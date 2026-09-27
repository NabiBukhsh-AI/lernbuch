import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Phase 5 acceptance — ARCHITECTURE.md Section 19.
 *
 *   "no hint text is present in the initial HTML payload before it is
 *    requested (verify in the network tab, hints load through a Server Action,
 *    not hidden CSS)."
 *
 * Checked two ways, because they fail differently:
 *   - the raw HTTP response body, which catches server-rendered text
 *   - the live DOM, which catches anything hidden with CSS instead of omitted
 */

const SLUG = '2099-01-01-lektion-99';
const HOMEWORK_URL = `/lessons/${SLUG}/homework`;

/** The exact hint and solution strings authored in the fixture. */
const SECRETS = {
  hint1: 'German has no continuous tense.',
  hint2: 'The verb is lesen and its du and er forms are irregular.',
  hint3: 'Buch is neuter, so the article does not change.',
  solution: 'Ich lese das Buch.',
  why: 'Neuter is identical in the Nominativ and the Akkusativ.',
};

test.beforeEach(async ({ page }) => {
  await loginAs(page);
});

test.describe('sealed payload', () => {
  test('the raw HTML response contains no hint text and no solution', async ({
    page,
  }) => {
    const response = await page.request.get(HOMEWORK_URL);
    expect(response.ok()).toBe(true);
    const body = await response.text();

    // Sanity check that the right page was fetched.
    expect(body).toContain('Hausaufgaben');

    for (const [name, secret] of Object.entries(SECRETS)) {
      expect(body, `${name} leaked into the HTML payload`).not.toContain(secret);
    }
  });

  test('the rendered DOM contains no hint text either (not hidden CSS)', async ({
    page,
  }) => {
    await page.goto(HOMEWORK_URL);
    await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();

    const dom = await page.content();
    for (const [name, secret] of Object.entries(SECRETS)) {
      expect(dom, `${name} is present in the DOM before being requested`).not.toContain(
        secret,
      );
    }
  });

  test('shows how many hints exist without revealing them', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');
    await expect(card.getByRole('button', { name: 'Nudge me' })).toBeVisible();
  });
});

test.describe('staged hints (Section 14)', () => {
  test('reveals one level at a time, with the fixed copy', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');

    // Level 1
    await expect(card.getByRole('button', { name: 'Show the rule' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Nudge me' }).click();
    await expect(card.getByText(SECRETS.hint1)).toBeVisible();

    // Level 2 only becomes available after level 1 has been taken.
    await card.getByRole('button', { name: 'Show the rule' }).click();
    await expect(card.getByText(SECRETS.hint2)).toBeVisible();

    // Level 3
    await card.getByRole('button', { name: 'Nearly there' }).click();
    await expect(card.getByText(SECRETS.hint3)).toBeVisible();

    // No fourth hint exists.
    await expect(card.getByRole('button', { name: 'Nudge me' })).toHaveCount(0);
  });

  test('records hints taken in the attempt history', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');
    await card.getByRole('button', { name: 'Nudge me' }).click();
    await expect(card.getByText(SECRETS.hint1)).toBeVisible();

    await page.reload();
    /*
     * Not an exact count: these tests share one database, and an earlier test
     * in this file has already taken hints on the same item. What matters is
     * that hint use survives a reload and is reported.
     */
    await expect(page.getByText(/\d+ hints taken/)).toBeVisible();
  });
});

test.describe('sealed solution', () => {
  test('sits behind a confirm with the fixed copy', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');

    await card.getByRole('button', { name: 'Show the answer' }).click();
    await expect(
      card.getByText('This logs the item for review. Continue?'),
    ).toBeVisible();

    // Cancelling must not reveal anything.
    await card.getByRole('button', { name: 'Cancel' }).click();
    expect(await page.content()).not.toContain(SECRETS.solution);
  });

  test('reveals the answer with its reason once confirmed (rule 3.6)', async ({
    page,
  }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');

    await card.getByRole('button', { name: 'Show the answer' }).click();
    await card.getByRole('button', { name: 'Yes, show it' }).click();

    await expect(card.getByText(SECRETS.solution)).toBeVisible();
    // The solution is never shown without the reason.
    await expect(card.getByText(SECRETS.why)).toBeVisible();
  });

  test('logs the reveal and adds the item to review', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');

    await card.getByRole('button', { name: 'Show the answer' }).click();
    await card.getByRole('button', { name: 'Yes, show it' }).click();
    await expect(card.getByText(SECRETS.solution)).toBeVisible();

    await page.reload();
    await expect(page.getByText('answer shown, added to review')).toBeVisible();
  });
});

test.describe('revealPolicy enforcement (Section 8.7)', () => {
  test('after_due keeps the answer locked before the due date', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    // hw-02 is revealPolicy: after_due with a due date in 2099.
    const card = page.locator('#hw-02');

    await card.getByRole('button', { name: 'Show the answer' }).click();
    await card.getByRole('button', { name: 'Yes, show it' }).click();

    await expect(card.getByRole('status')).toContainText('unlocks after the due date');
    expect(await page.content()).not.toContain('Ich kaufe den Tisch.');
  });

  test('shows the policy and the due date in the history line', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    await expect(
      page.getByText('Answer unlocks after the due date').first(),
    ).toBeVisible();
    await expect(page.getByText('due 2099-01-08').first()).toBeVisible();
  });
});

test.describe('answering homework', () => {
  test('grades a correct answer and returns the reason', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    const card = page.locator('#hw-01');

    await card.getByRole('textbox', { name: 'Your answer' }).fill('Ich lese das Buch.');
    await card.getByRole('button', { name: 'Check' }).click();

    await expect(card.getByRole('status').first()).toContainText('Correct');
    await expect(card.getByText(SECRETS.why)).toBeVisible();
  });

  test('a due-date banner is shown for the set', async ({ page }) => {
    await page.goto(HOMEWORK_URL);
    await expect(page.getByText(/Due 2099-01-08/)).toBeVisible();
  });
});
