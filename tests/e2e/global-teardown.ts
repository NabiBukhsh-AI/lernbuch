import '../../scripts/_env';
import { eq, like } from 'drizzle-orm';
import { db, pool } from '../../src/db/client';
import { lessons, mistakes, progress, users } from '../../src/db/schema';
import { FIXTURE_SLUG } from './helpers';

/**
 * Leaves no trace: the fixture lesson and every `e2e_` account, whose
 * learning history goes with it by cascade.
 *
 * `mistakes` rows are deleted explicitly because they deliberately carry no
 * foreign key to content, so they would outlive the lesson they came from.
 * That is right for real learner history and wrong for a fixture.
 */
export default async function globalTeardown() {
  await db.delete(users).where(like(users.username, 'e2e\\_%'));
  await db.delete(mistakes).where(eq(mistakes.lessonId, FIXTURE_SLUG));
  await db.delete(progress).where(eq(progress.lessonId, FIXTURE_SLUG));
  await db.delete(lessons).where(eq(lessons.id, FIXTURE_SLUG));
  await pool.end();
}
