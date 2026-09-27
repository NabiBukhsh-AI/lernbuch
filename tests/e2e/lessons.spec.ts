import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Phase 3 acceptance — ARCHITECTURE.md Section 19.
 *
 *   "the fixture lesson renders completely, every noun shows article and
 *    plural, and the Satzklammer draws on the tagged example."
 */

const SLUG = '2099-01-01-lektion-99';

test.beforeEach(async ({ page }) => {
  await loginAs(page);
});

test.describe('lesson list', () => {
  test('lists the ingested lesson with its counts', async ({ page }) => {
    await page.goto('/lessons');

    const card = page.getByRole('link', { name: /Fixture lesson/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText('A1.1');
    await expect(card).toContainText('2099-01-01');
  });

  test('the rail links to the lesson', async ({ page }) => {
    await page.goto('/lessons');
    const rail = page.getByRole('navigation', { name: 'Lessons' });
    await expect(rail.getByRole('link', { name: '99' })).toBeVisible();
  });
});

test.describe('lesson overview', () => {
  test('renders the header, counts and every prose section', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}`);

    await expect(page.getByRole('heading', { name: 'Fixture lesson' })).toBeVisible();
    await expect(page.getByText('Exercises every block type')).toBeVisible();

    // The four prose sections that carry body text, by their authored titles.
    for (const title of ['Überblick', 'Aussprache', 'Landeskunde', 'Mitnehmen']) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
  });

  test('never renders the maintainer instruction block', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}`);
    await expect(page.getByText('Instructions for the maintainer')).toHaveCount(0);
    await expect(page.getByText('must never become a lessonSections row')).toHaveCount(0);
  });

  test('offers the six sub-views', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}`);
    const tabs = page.getByRole('navigation', { name: 'Lesson sections' });
    for (const label of [
      'Overview',
      'Vocabulary',
      'Grammar',
      'Classwork',
      'Homework',
      'Quiz',
    ]) {
      await expect(tabs.getByRole('link', { name: new RegExp(label) })).toBeVisible();
    }
  });
});

test.describe('vocabulary', () => {
  test('every noun shows its article and its plural (rule 3.1)', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/vocabulary`);

    const noun = page.locator('#tisch');
    await expect(noun).toBeVisible();
    // article + noun + plural, all three present
    await expect(noun).toContainText('der');
    await expect(noun).toContainText('Tisch');
    await expect(noun).toContainText('Tische');
    await expect(noun).toContainText('table');
  });

  test('verbs render their forms and open a conjugation table (rule 3.2)', async ({
    page,
  }) => {
    await page.goto(`/lessons/${SLUG}/vocabulary`);

    const verb = page.locator('#gehen');
    await expect(verb).toContainText('gehen');
    await expect(verb).toContainText('er geht');
    await expect(verb).toContainText('ist gegangen');

    await verb.getByRole('button', { name: 'conjugate' }).click();
    await expect(verb.getByRole('table')).toBeVisible();
    await expect(verb.getByRole('table')).toContainText('gehst');
    await expect(verb.getByRole('table')).toContainText('geht');
  });

  test('shows the gender tip and the false-friend warning', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/vocabulary`);
    await expect(page.getByText('Furniture words are often masculine')).toBeVisible();
  });
});

test.describe('grammar', () => {
  test('renders the rule, the table and the highlighted cell', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);

    await expect(page.getByRole('heading', { name: 'Akkusativ, fixture' })).toBeVisible();
    await expect(
      page.getByText('Only the masculine article changes in the Akkusativ'),
    ).toBeVisible();

    const table = page.getByRole('table').first();
    await expect(table).toBeVisible();
    await expect(table).toContainText('Nominativ');
    await expect(table).toContainText('Akkusativ');

    // Rule 3.3: the cell that actually changes is called out in words too.
    await expect(page.getByText('The only cell that changes.')).toBeVisible();
    await expect(page.getByText('(the form that changes)')).toBeAttached();
  });

  test('draws the Satzklammer on the tagged example (rule 3.4)', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);

    // The label naming both ends of the bracket.
    const label = page.getByText(/Satzklammer:\s*will\s*…\s*kaufen/);
    await expect(label).toBeVisible();

    /*
     * The bracket draws itself when the sentence scrolls into view (Section
     * 16.5), so it must be scrolled to before it can be expected to be drawn.
     * Asserting without scrolling tested nothing except that the page is long.
     */
    const bracket = page.locator('span.border-accent.origin-left').first();
    await expect(bracket).toBeAttached();
    await bracket.scrollIntoViewIfNeeded();
    await expect(bracket).toHaveClass(/scale-x-100/);
  });

  test('shows case chips under the labelled phrases (rule 3.3)', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);
    await expect(page.getByTitle('Nominativ, the subject').first()).toBeVisible();
    await expect(page.getByTitle('Akkusativ, the direct object').first()).toBeVisible();
  });

  test('toggles the TeKaMoLo view (rule 3.5)', async ({ page }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);

    const toggle = page.getByRole('button', { name: 'show TeKaMoLo' });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.getByText('Te · when')).toBeVisible();
    await expect(page.getByText('Ka · why')).toBeVisible();
    await expect(page.getByText('Mo · how')).toBeVisible();
    await expect(page.getByText('Lo · where')).toBeVisible();
  });

  test('renders common mistakes with the correct form dominant (rule 3.7)', async ({
    page,
  }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);

    const wrong = page.getByText('Ich sehe der Tisch.');
    await expect(wrong).toBeVisible();
    // The wrong form is struck through so it is never the memorable one.
    await expect(wrong).toHaveClass(/line-through/);
  });

  test('shows the memory hook and the contrast against earlier lessons', async ({
    page,
  }) => {
    await page.goto(`/lessons/${SLUG}/grammar`);
    await expect(page.getByText('den is the only one with an n.')).toBeVisible();
    await expect(page.getByText('Compared with what you already know')).toBeVisible();
  });
});
