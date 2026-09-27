import '../../scripts/_env';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from '../../src/db/client';
import { rateLimitEvents, users } from '../../src/db/schema';
import { hashPassword } from '../../src/lib/credentials';
import { parseLesson } from '../../src/lib/content/parser';
import { upsertLesson } from '../../src/lib/content/upsert';
import { FIXTURE_SLUG, LEARNER, SUSPENDABLE } from './helpers';

/**
 * Prepares the database for the suite. Expects `pnpm db:migrate` and
 * `pnpm seed:admin` to have run.
 *
 * 1. Clears the rate-limit counters. The negative-path tests fail logins on
 *    purpose, and once those reach the limit the later positive-path tests
 *    would be locked out for a reason unrelated to what they assert. The
 *    table holds nothing but short-lived counters, so emptying it is safe.
 *
 * 2. Creates (or resets) the two e2e learner accounts.
 *
 * 3. Ingests the fixture lesson, the only one carrying every block and
 *    exercise type. Removed again by the global teardown.
 */
export default async function globalSetup() {
  await db.delete(rateLimitEvents);

  for (const account of [LEARNER, SUSPENDABLE]) {
    const passwordHash = await hashPassword(account.password);
    await db
      .insert(users)
      .values({
        id: randomUUID(),
        username: account.username,
        displayName: account.displayName,
        passwordHash,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { passwordHash, displayName: account.displayName, disabledAt: null },
      });
  }

  const fileName = `${FIXTURE_SLUG}.md`;
  const raw = readFileSync(
    path.join(import.meta.dirname, '../fixtures', fileName),
    'utf8',
  );
  await upsertLesson(db, parseLesson(fileName, raw));

  /*
   * The pool is deliberately left open. Playwright runs globalSetup and
   * globalTeardown in the same process, sharing this module instance, so
   * closing it here would make every teardown query fail. Teardown closes it.
   */
}
