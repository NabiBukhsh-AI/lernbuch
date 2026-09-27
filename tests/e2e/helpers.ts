import { expect, type Page } from '@playwright/test';

/** The fixture lesson global setup ingests; dated 2099 so it cannot collide with real content. */
export const FIXTURE_SLUG = '2099-01-01-lektion-99';

export type Account = { username: string; password: string; displayName: string };

/** Seeded by `pnpm seed:admin` from the same environment variables. */
export function admin(): Account {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'ADMIN_USERNAME / ADMIN_PASSWORD are not set. Run `pnpm seed:admin` first.',
    );
  }
  return { username, password, displayName: process.env.ADMIN_DISPLAY_NAME || username };
}

/** Created by global setup, removed by global teardown (every `e2e_` account is). */
export const LEARNER: Account = {
  username: 'e2e_learner',
  password: 'e2e-learner-password',
  displayName: 'Erika Lernerin',
};

/** A second learner the admin tests suspend, so the main one is never locked out. */
export const SUSPENDABLE: Account = {
  username: 'e2e_suspend',
  password: 'e2e-suspend-password',
  displayName: 'Sam Suspend',
};

export async function fillLogin(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function loginAs(page: Page, account: Account = admin()) {
  await fillLogin(page, account.username, account.password);
  await expect(page).toHaveURL('/');
}
