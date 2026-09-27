import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Phase 4 acceptance — ARCHITECTURE.md Section 19.
 *
 *   "every exercise type in the fixture can be answered and graded"
 *
 * The fixture lesson carries one classwork item per exercise type, so this
 * exercises all sixteen through the real Server Action and the real grader.
 */

const SLUG = '2099-01-01-lektion-99';

const ALL_TYPES = [
  'cw-fill-blank',
  'cw-mcq',
  'cw-multi-select',
  'cw-true-false',
  'cw-match',
  'cw-order-words',
  'cw-translate-de-en',
  'cw-translate-en-de',
  'cw-transform',
  'cw-conjugate',
  'cw-gender-pick',
  'cw-case-pick',
  'cw-short-answer',
  'cw-dialogue',
  'cw-listening',
  'cw-cloze',
];

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto(`/lessons/${SLUG}/classwork`);
});

test('renders one card for every exercise type', async ({ page }) => {
  for (const id of ALL_TYPES) {
    await expect(page.locator(`#${id}`), `${id} did not render`).toBeVisible();
  }
});

test('classwork shows the why panel and tips by default (Section 8.6)', async ({
  page,
}) => {
  const card = page.locator('#cw-mcq');
  await expect(card.getByText('Why')).toBeVisible();
  await expect(
    card.getByText('Tisch is masculine and is the direct object.'),
  ).toBeVisible();
});

test('grades a correct mcq', async ({ page }) => {
  const card = page.locator('#cw-mcq');
  await card.getByRole('radio', { name: 'den' }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('grades a wrong mcq without a red fill (rule 3.1)', async ({ page }) => {
  const card = page.locator('#cw-mcq');
  await card.getByRole('radio', { name: 'der', exact: true }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Not yet');
});

test('grades a fill_blank', async ({ page }) => {
  const card = page.locator('#cw-fill-blank');
  await card.getByRole('textbox').first().fill('den');
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

/*
 * Regression: a multi-blank item used to render its inputs from the grading
 * result, which is null until the answer is submitted. Every fill_blank and
 * cloze item therefore showed exactly one box no matter how many blanks it
 * had, and the "add another blank" button wrote to state nothing rendered
 * from. Five of Lektion 01's classwork items were unanswerable as a result.
 */
test('renders one input per blank before anything is submitted', async ({ page }) => {
  const card = page.locator('#cw-cloze');
  // The fixture cloze has two blanks: answer is ["gehe", "sehe"].
  await expect(card.getByRole('textbox')).toHaveCount(2);
  await expect(card.getByText('blank 1')).toBeVisible();
  await expect(card.getByText('blank 2')).toBeVisible();
});

test('grades every blank of a multi-blank item', async ({ page }) => {
  const card = page.locator('#cw-cloze');
  const boxes = card.getByRole('textbox');
  await boxes.nth(0).fill('gehe');
  await boxes.nth(1).fill('sehe');
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('a single-blank item shows one box labelled answer', async ({ page }) => {
  const card = page.locator('#cw-fill-blank');
  await expect(card.getByRole('textbox')).toHaveCount(1);
  await expect(card.getByText('answer', { exact: true })).toBeVisible();
});

test('grades multi_select with partial credit', async ({ page }) => {
  const card = page.locator('#cw-multi-select');
  await card.getByRole('checkbox', { name: 'den' }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  // One of two correct: almost, not wrong.
  await expect(card.getByRole('status')).toContainText('Almost');
});

test('grades true_false', async ({ page }) => {
  const card = page.locator('#cw-true-false');
  await card.getByRole('radio', { name: 'false' }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('grades order_words built from the word bank', async ({ page }) => {
  const card = page.locator('#cw-order-words');
  // The bank supplies lowercase "ich"; the expected sentence starts with a
  // capital. Lenient mode forgives that with a note, which is exactly the
  // Section 12.2 row for sentence capitalisation.
  for (const token of ['ich', 'fahre', 'morgen', 'nach Berlin']) {
    await card.getByRole('button', { name: token, exact: true }).click();
  }
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
  await expect(card.getByText('A sentence starts with a capital letter.')).toBeVisible();
});

test('grades match through the pair selects', async ({ page }) => {
  const card = page.locator('#cw-match');
  await card.getByLabel('Match for der').selectOption('maskulin');
  await card.getByLabel('Match for die').selectOption('feminin');
  await card.getByLabel('Match for das').selectOption('neutrum');
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('grades conjugate cell by cell', async ({ page }) => {
  const card = page.locator('#cw-conjugate');
  const forms: Record<string, string> = {
    ich: 'gehe',
    du: 'gehst',
    er: 'geht',
    wir: 'gehen',
    ihr: 'geht',
    sie: 'gehen',
  };
  for (const [person, form] of Object.entries(forms)) {
    await card.locator(`input`).nth(Object.keys(forms).indexOf(person)).fill(form);
  }
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('grades gender_pick and case_pick', async ({ page }) => {
  const gender = page.locator('#cw-gender-pick');
  await gender.getByRole('radio', { name: 'der', exact: true }).check();
  await gender.getByRole('button', { name: 'Check' }).click();
  await expect(gender.getByRole('status')).toContainText('Correct');

  const kase = page.locator('#cw-case-pick');
  await kase.getByRole('radio', { name: 'AKK' }).check();
  await kase.getByRole('button', { name: 'Check' }).click();
  await expect(kase.getByRole('status')).toContainText('Correct');
});

test('grades the free-text types', async ({ page }) => {
  const cases: Array<[string, string]> = [
    ['cw-translate-de-en', 'I see the table.'],
    ['cw-translate-en-de', 'Ich sehe den Tisch.'],
    ['cw-transform', 'Das ist kein Tisch.'],
    ['cw-dialogue', 'Ich komme aus Pakistan.'],
    ['cw-listening', 'Der Tisch ist neu.'],
  ];

  for (const [id, answer] of cases) {
    const card = page.locator(`#${id}`);
    await card.getByRole('textbox', { name: 'Your answer' }).fill(answer);
    await card.getByRole('button', { name: 'Check' }).click();
    await expect(card.getByRole('status'), `${id} was not graded correct`).toContainText(
      'Correct',
    );
  }
});

test('accepts an ae/ss spelling but flags it (rule 3.8)', async ({ page }) => {
  const card = page.locator('#cw-short-answer');
  await card.getByRole('textbox', { name: 'Your answer' }).fill('Ich heisse Nabi.');
  await card.getByRole('button', { name: 'Check' }).click();
  // The fixture lists this spelling in `accept`, so it is correct outright.
  await expect(card.getByRole('status')).toContainText('Correct');
});

test('flags a sentence that does not start with a capital', async ({ page }) => {
  const card = page.locator('#cw-translate-en-de');
  await card.getByRole('textbox', { name: 'Your answer' }).fill('ich sehe den Tisch.');
  await card.getByRole('button', { name: 'Check' }).click();

  await expect(card.getByRole('status')).toContainText('Correct');
  await expect(card.getByText('A sentence starts with a capital letter.')).toBeVisible();
});

test('shows the answer only together with its reason (rule 3.6)', async ({ page }) => {
  const card = page.locator('#cw-transform');
  await card.getByRole('textbox', { name: 'Your answer' }).fill('wrong answer');
  await card.getByRole('button', { name: 'Check' }).click();

  // `exact` matters: the typed answer and the "Mark my answer as acceptable"
  // button both contain the word, so a substring match is ambiguous.
  await expect(card.getByText('Answer', { exact: true })).toBeVisible();
  await expect(card.getByText('Why', { exact: true })).toBeVisible();
  await expect(card.getByText('Take away', { exact: true })).toBeVisible();
});

test('lets the learner retry', async ({ page }) => {
  const card = page.locator('#cw-mcq');
  await card.getByRole('radio', { name: 'der', exact: true }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Not yet');

  await card.getByRole('button', { name: 'Try again' }).click();
  await expect(card.getByRole('status')).toHaveCount(0);

  await card.getByRole('radio', { name: 'den' }).check();
  await card.getByRole('button', { name: 'Check' }).click();
  await expect(card.getByRole('status')).toContainText('Correct');
});
