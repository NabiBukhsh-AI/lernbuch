/**
 * Re-ingest idempotency — ARCHITECTURE.md Section 19 (Phase 2) and Section 20.
 *
 * "ingest twice, row counts identical, ids identical", plus the guarantee that
 * matters most (Section 0 rule 5): re-ingesting must never destroy progress or
 * review history.
 *
 * Runs against the configured database using a fixture lesson dated 2099 so it
 * cannot collide with real content, and removes everything it created.
 * Skipped when DATABASE_URL is absent so a database-free CI run still passes.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { parseLesson } from '@/lib/content/parser';
import { upsertLesson } from '@/lib/content/upsert';

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const FIXTURE_NAME = '2099-01-01-lektion-99.md';
const FIXTURE_SLUG = '2099-01-01-lektion-99';
const FIXTURE = readFileSync(
  path.join(import.meta.dirname, '../fixtures', FIXTURE_NAME),
  'utf8',
);

const TEST_USER_ID = 'u_fixture_test';

describeDb('re-ingest idempotency', () => {
  /* Imported lazily so the module never loads when DATABASE_URL is unset. */
  type Mod = typeof import('@/db/client') & typeof import('@/db/schema');
  let m: Mod;

  const snapshot = async () => {
    const [sections, vocab, grammar, quizzes, exercises] = await Promise.all([
      m.db
        .select({ id: m.lessonSections.id })
        .from(m.lessonSections)
        .where(eq(m.lessonSections.lessonId, FIXTURE_SLUG)),
      m.db
        .select({ id: m.vocabItems.id })
        .from(m.vocabItems)
        .where(eq(m.vocabItems.lessonId, FIXTURE_SLUG)),
      m.db
        .select({ id: m.grammarPoints.id })
        .from(m.grammarPoints)
        .where(eq(m.grammarPoints.lessonId, FIXTURE_SLUG)),
      m.db
        .select({ id: m.quizzes.id })
        .from(m.quizzes)
        .where(eq(m.quizzes.lessonId, FIXTURE_SLUG)),
      m.db
        .select({ id: m.exercises.id })
        .from(m.exercises)
        .where(eq(m.exercises.lessonId, FIXTURE_SLUG)),
    ]);
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
    return {
      sections: ids(sections),
      vocab: ids(vocab),
      grammar: ids(grammar),
      quizzes: ids(quizzes),
      exercises: ids(exercises),
    };
  };

  const cleanup = async () => {
    await m.db.delete(m.mistakes).where(eq(m.mistakes.lessonId, FIXTURE_SLUG));
    await m.db.delete(m.srsCards).where(eq(m.srsCards.userId, TEST_USER_ID));
    await m.db.delete(m.submissions).where(eq(m.submissions.userId, TEST_USER_ID));
    await m.db.delete(m.progress).where(eq(m.progress.lessonId, FIXTURE_SLUG));
    await m.db.delete(m.lessons).where(eq(m.lessons.id, FIXTURE_SLUG));
    await m.db.delete(m.users).where(eq(m.users.id, TEST_USER_ID));
  };

  beforeAll(async () => {
    const client = await import('@/db/client');
    const schema = await import('@/db/schema');
    m = { ...client, ...schema } as Mod;
    await cleanup();
  });

  afterAll(async () => {
    if (!m) return;
    await cleanup();
    await m.pool.end();
  });

  it('creates everything on the first pass', async () => {
    const parsed = parseLesson(FIXTURE_NAME, FIXTURE);
    const stats = await upsertLesson(m.db, parsed);

    expect(stats.sections.created).toBe(parsed.sections.length);
    expect(stats.vocab.created).toBe(3);
    expect(stats.grammar.created).toBe(1);
    expect(stats.quizzes.created).toBe(1);
    expect(stats.classwork.created).toBe(17);
    expect(stats.homework.created).toBe(2);
    expect(stats.quizQuestions.created).toBe(2);

    for (const block of Object.values(stats)) {
      expect(block.removed).toBe(0);
    }
  });

  it('re-ingesting changes nothing: same counts, same ids, zero creations, zero deletions', async () => {
    const before = await snapshot();

    const parsed = parseLesson(FIXTURE_NAME, FIXTURE);
    const stats = await upsertLesson(m.db, parsed);

    // The Phase 2 acceptance criterion, asserted directly.
    for (const [name, block] of Object.entries(stats)) {
      expect(block.created, `${name} should create nothing on re-ingest`).toBe(0);
      expect(block.removed, `${name} should remove nothing on re-ingest`).toBe(0);
    }

    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it('composes ids as <lesson>:<blocktype>:<item>', async () => {
    const after = await snapshot();
    expect(after.vocab).toContain(`${FIXTURE_SLUG}:vocab:tisch`);
    expect(after.grammar).toContain(`${FIXTURE_SLUG}:grammar:akkusativ-fixture`);
    expect(after.quizzes).toContain(`${FIXTURE_SLUG}:quiz:main`);
    expect(after.exercises).toContain(`${FIXTURE_SLUG}:cw:cw-mcq`);
    expect(after.exercises).toContain(`${FIXTURE_SLUG}:hw:hw-01`);
    expect(after.exercises).toContain(`${FIXTURE_SLUG}:quiz:q1`);
    expect(after.sections).toContain(`${FIXTURE_SLUG}:sec:ueberblick`);
  });

  it('links quiz questions to their quiz and leaves other scopes unlinked', async () => {
    const rows = await m.db
      .select({
        id: m.exercises.id,
        scope: m.exercises.scope,
        quizId: m.exercises.quizId,
      })
      .from(m.exercises)
      .where(eq(m.exercises.lessonId, FIXTURE_SLUG));

    for (const row of rows) {
      if (row.scope === 'quiz') expect(row.quizId).toBe(`${FIXTURE_SLUG}:quiz:main`);
      else expect(row.quizId).toBeNull();
    }
  });

  it('turns the errors block into class-origin mistakes without duplicating them', async () => {
    const rows = await m.db
      .select({ id: m.mistakes.id, expected: m.mistakes.expected })
      .from(m.mistakes)
      .where(and(eq(m.mistakes.lessonId, FIXTURE_SLUG), eq(m.mistakes.origin, 'class')));

    // Two authored errors, for the admin only (it was their class), and
    // re-ingest added none.
    const admins = await m.db
      .select({ id: m.users.id })
      .from(m.users)
      .where(eq(m.users.role, 'admin'));
    expect(rows).toHaveLength(2 * admins.length);
  });

  it('preserves learner state across a re-ingest (Section 0 rule 5)', async () => {
    await m.db.insert(m.users).values({
      id: TEST_USER_ID,
      username: 'fixture-tester',
      displayName: 'Fixture Tester',
      passwordHash: 'not-a-real-hash',
    });

    const exerciseId = `${FIXTURE_SLUG}:cw:cw-mcq`;
    const vocabId = `${FIXTURE_SLUG}:vocab:tisch`;

    await m.db.insert(m.submissions).values({
      userId: TEST_USER_ID,
      exerciseId,
      userAnswer: { value: 'den' },
      isCorrect: true,
      verdict: 'correct',
    });
    await m.db.insert(m.srsCards).values({
      userId: TEST_USER_ID,
      itemType: 'vocab',
      itemId: vocabId,
      reps: 4,
      lapses: 1,
    });

    const parsed = parseLesson(FIXTURE_NAME, FIXTURE);
    await upsertLesson(m.db, parsed);

    const submissions = await m.db
      .select()
      .from(m.submissions)
      .where(eq(m.submissions.userId, TEST_USER_ID));
    expect(submissions).toHaveLength(1);
    expect(submissions[0]!.exerciseId).toBe(exerciseId);
    expect(submissions[0]!.verdict).toBe('correct');

    const cards = await m.db
      .select()
      .from(m.srsCards)
      .where(eq(m.srsCards.userId, TEST_USER_ID));
    expect(cards).toHaveLength(1);
    expect(cards[0]!.reps).toBe(4);
    expect(cards[0]!.lapses).toBe(1);
  });

  it('removes content dropped from the file, but keeps the learner row pointing at it', async () => {
    // Same lesson with the whole classwork block removed.
    const trimmed = FIXTURE.replace(
      /## Unterrichtsarbeit[\s\S]*?```yaml classwork[\s\S]*?```/,
      '## Unterrichtsarbeit\n\nAll classwork removed for this pass.',
    );
    const parsed = parseLesson(FIXTURE_NAME, trimmed);
    const stats = await upsertLesson(m.db, parsed);

    expect(stats.classwork.removed).toBe(17);

    const remaining = await m.db
      .select({ id: m.exercises.id })
      .from(m.exercises)
      .where(
        and(
          eq(m.exercises.lessonId, FIXTURE_SLUG),
          inArray(m.exercises.scope, ['classwork']),
        ),
      );
    expect(remaining).toHaveLength(0);

    // Section 7.5: the submission survives, its content reference set to NULL.
    const submissions = await m.db
      .select()
      .from(m.submissions)
      .where(eq(m.submissions.userId, TEST_USER_ID));
    expect(submissions).toHaveLength(1);
    expect(submissions[0]!.exerciseId).toBeNull();
    expect(submissions[0]!.verdict).toBe('correct');

    // Restore, so the suite leaves the lesson as it found it.
    await upsertLesson(m.db, parseLesson(FIXTURE_NAME, FIXTURE));
  });
});
