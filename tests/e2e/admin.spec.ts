import { expect, test } from '@playwright/test';
import { fillLogin, FIXTURE_SLUG, LEARNER, loginAs, SUSPENDABLE } from './helpers';

test('a learner gets a 404 for the admin panel', async ({ page }) => {
  await loginAs(page, LEARNER);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('the admin sees learners with their activity', async ({ page }) => {
  await loginAs(page);
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search learners' }).fill(LEARNER.username);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(`@${LEARNER.username}`)).toBeVisible();
});

test('a suspended learner cannot sign in, and is let back in when restored', async ({
  page,
  browser,
}) => {
  await loginAs(page);
  await page.goto(`/admin?q=${SUSPENDABLE.username}`);
  page.on('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: `Suspend @${SUSPENDABLE.username}` }).click();
  await expect(page.getByText('suspended', { exact: true })).toBeVisible();

  const other = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await fillLogin(other, SUSPENDABLE.username, SUSPENDABLE.password);
  await expect(other.locator('form [role="alert"]')).toHaveText(
    'This account has been suspended.',
  );

  await page.getByRole('button', { name: `Restore @${SUSPENDABLE.username}` }).click();
  await expect(page.getByText('suspended', { exact: true })).toHaveCount(0);

  await fillLogin(other, SUSPENDABLE.username, SUSPENDABLE.password);
  await expect(other).toHaveURL('/');
  await other.close();
});

test('a hidden lesson disappears for learners and comes back when published', async ({
  page,
  browser,
}) => {
  await loginAs(page);
  await page.goto('/admin/lessons');

  const row = page
    .getByRole('row')
    .filter({ has: page.locator(`a[href="/lessons/${FIXTURE_SLUG}"]`) });
  await row.getByRole('button', { name: 'Published' }).click();
  await expect(row.getByRole('button', { name: 'Hidden' })).toBeVisible();

  const learner = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await loginAs(learner, LEARNER);
  await learner.goto(`/lessons/${FIXTURE_SLUG}`);
  await expect(learner.getByRole('heading', { name: 'Not found' })).toBeVisible();

  await row.getByRole('button', { name: 'Hidden' }).click();
  await expect(row.getByRole('button', { name: 'Published' })).toBeVisible();

  await learner.goto(`/lessons/${FIXTURE_SLUG}`);
  await expect(learner.getByRole('heading', { name: 'Not found' })).toHaveCount(0);
  await learner.close();
});
