import { expect, test, type Page } from '@playwright/test';
import { admin, fillLogin, LEARNER, loginAs } from './helpers';

const GENERIC_FAILURE = 'Incorrect username or password.';

/**
 * Every signed-in route, including ones that do not exist. The middleware
 * guards by default, so an unknown route must still redirect rather than 404
 * to an anonymous visitor.
 */
const PROTECTED_ROUTES = [
  '/lessons',
  '/lessons/2026-08-15-lektion-01',
  '/review',
  '/vocabulary',
  '/grammar',
  '/progress',
  '/search',
  '/settings',
  '/admin',
];

/**
 * Scoped to the form on purpose. Next.js renders its own
 * `<div role="alert" id="__next-route-announcer__">` for route changes, so a
 * bare getByRole('alert') matches two elements.
 */
function formError(page: Page) {
  return page.locator('form [role="alert"]');
}

test.describe('logged out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/ shows the public landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome/);
    await expect(
      page
        .getByRole('navigation', { name: 'Account' })
        .getByRole('link', { name: 'Create account' }),
    ).toBeVisible();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });
  }
});

test.describe('login', () => {
  test('the admin can log in', async ({ page }) => {
    await loginAs(page, admin());
    await expect(page.getByRole('heading', { name: /^Hallo/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  });

  test('a learner can log in and sees no admin link', async ({ page }) => {
    await loginAs(page, LEARNER);
    await expect(page.getByRole('heading', { name: 'Hallo, Erika' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('usernames are case-insensitive', async ({ page }) => {
    await fillLogin(page, LEARNER.username.toUpperCase(), LEARNER.password);
    await expect(page).toHaveURL('/');
  });

  test('a wrong password is rejected with a generic message', async ({ page }) => {
    await fillLogin(page, LEARNER.username, 'definitely-not-the-password');
    await expect(page).toHaveURL(/\/login/);
    await expect(formError(page)).toHaveText(GENERIC_FAILURE);
  });

  test('an unknown username gives the same message', async ({ page }) => {
    await fillLogin(page, 'niemand', 'definitely-not-the-password');
    await expect(page).toHaveURL(/\/login/);
    await expect(formError(page)).toHaveText(GENERIC_FAILURE);
  });
});

test.describe('signup', () => {
  test('a new account lands on the dashboard', async ({ page }) => {
    const username = `e2e_${Date.now().toString(36)}`;

    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Neue Nutzerin');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password');
    await page.getByLabel('Confirm password').fill('a-long-enough-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Hallo, Neue' })).toBeVisible();
  });

  test('a taken username is refused and the form keeps its values', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Doppelt');
    await page.getByLabel('Username').fill(LEARNER.username);
    await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password');
    await page.getByLabel('Confirm password').fill('a-long-enough-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('That username is taken.')).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveValue('Doppelt');
  });

  test('mismatched passwords are refused', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Tippfehler');
    await page.getByLabel('Username').fill('e2e_mismatch');
    await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password');
    await page.getByLabel('Confirm password').fill('a-different-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('The passwords do not match.')).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('session', () => {
  test('a logged in user reaching /login is sent to the dashboard', async ({ page }) => {
    await loginAs(page, LEARNER);
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('logging out closes the session and re-protects the routes', async ({ page }) => {
    await loginAs(page, LEARNER);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('shell', () => {
  test('umlaut strip and gender legend are present', async ({ page }) => {
    await loginAs(page, LEARNER);

    await expect(page.getByRole('group', { name: 'Insert umlauts' })).toBeVisible();
    for (const char of ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']) {
      await expect(page.getByRole('button', { name: char, exact: true })).toBeVisible();
    }

    const legend = page.getByRole('list', { name: 'Article colours' });
    await expect(legend).toBeVisible();
    await expect(legend.getByText('der', { exact: true })).toBeVisible();
    await expect(legend.getByText('das', { exact: true })).toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Lessons' })).toBeVisible();
  });

  test('the dashboard is never announced as an error', async ({ page }) => {
    await loginAs(page, LEARNER);
    await expect(page.getByRole('heading', { name: /^Hallo/ })).toBeVisible();
    await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  });
});
