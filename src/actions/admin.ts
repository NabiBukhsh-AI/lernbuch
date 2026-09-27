'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { lessons, users } from '@/db/schema';
import { hashPassword } from '@/lib/credentials';
import { describeFailure, formatStats, ingestLessonFile } from '@/lib/content/ingest';
import { requireAdmin } from '@/lib/session';

/*
 * Every action re-checks the admin role from the database, and every user
 * mutation is limited to `role = 'learner'`, so the admin account cannot be
 * suspended, reset or deleted from here, not even by the admin by mistake.
 */

const userSchema = z.object({ userId: z.string().min(1) });
const learner = (userId: string) => and(eq(users.id, userId), eq(users.role, 'learner'));

export async function setUserSuspended(input: unknown): Promise<void> {
  await requireAdmin();
  const { userId, suspended } = userSchema
    .extend({ suspended: z.boolean() })
    .parse(input);

  await db
    .update(users)
    .set({ disabledAt: suspended ? new Date() : null })
    .where(learner(userId));

  revalidatePath('/admin');
}

/**
 * Sets a random password and returns it once, for the admin to pass on. There
 * is no email, so this is the "forgot password" path.
 */
export async function resetUserPassword(input: unknown): Promise<{ password: string }> {
  await requireAdmin();
  const { userId } = userSchema.parse(input);

  const password = randomBytes(9).toString('base64url');
  const updated = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(learner(userId))
    .returning({ id: users.id });

  if (updated.length === 0) throw new Error('No such learner.');
  return { password };
}

/** Deletes the account and, by cascade, every row of its learning history. */
export async function deleteUser(input: unknown): Promise<void> {
  await requireAdmin();
  const { userId } = userSchema.parse(input);

  await db.delete(users).where(learner(userId));
  revalidatePath('/admin');
}

export async function setLessonPublished(input: unknown): Promise<void> {
  await requireAdmin();
  const { lessonId, publish } = z
    .object({ lessonId: z.string().min(1), publish: z.boolean() })
    .parse(input);

  await db.update(lessons).set({ publish }).where(eq(lessons.id, lessonId));
  revalidatePath('/', 'layout');
}

export type UploadResult = {
  file: string;
  status: 'created' | 'updated' | 'skipped' | 'ignored' | 'failed';
  detail: string;
};

/** The admin-panel equivalent of `pnpm ingest`, one or more .md files at a time. */
export async function uploadLessons(
  _prev: UploadResult[] | null,
  formData: FormData,
): Promise<UploadResult[]> {
  await requireAdmin();
  const force = formData.get('force') === 'on';

  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0);

  const results: UploadResult[] = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.md')) {
      results.push({ file: file.name, status: 'failed', detail: 'Not a .md file.' });
      continue;
    }

    const outcome = await ingestLessonFile(db, file.name, await file.text(), { force });
    results.push({
      file: file.name,
      status: outcome.action,
      detail:
        outcome.action === 'failed'
          ? describeFailure(outcome.error)
          : 'stats' in outcome
            ? formatStats(outcome.stats)
            : outcome.detail,
    });
  }

  revalidatePath('/', 'layout');
  return results;
}
