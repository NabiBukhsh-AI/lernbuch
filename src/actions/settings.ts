'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/session';
import { signOut } from '@/lib/auth';
import {
  displayNameSchema,
  hashPassword,
  passwordSchema,
  verifyPassword,
} from '@/lib/credentials';
import { isLimited, recordEvent } from '@/lib/rate-limit';
import { db } from '@/db/client';
import { mistakes, users } from '@/db/schema';

const settingsSchema = z.object({
  displayName: displayNameSchema,
  strictMode: z.boolean(),
  showUrdu: z.boolean(),
  dailyGoal: z.number().int().min(5).max(200),
  targetLevel: z.string().min(1).max(10),
});

/** Preferences. Applies to the signed-in user only. */
export async function updateSettings(formData: FormData): Promise<void> {
  const { id: userId } = await requireUser();

  const parsed = settingsSchema.parse({
    displayName: String(formData.get('displayName') ?? ''),
    strictMode: formData.get('strictMode') === 'on',
    showUrdu: formData.get('showUrdu') === 'on',
    dailyGoal: Number(formData.get('dailyGoal')),
    targetLevel: String(formData.get('targetLevel') ?? 'A1.1'),
  });

  await db.update(users).set(parsed).where(eq(users.id, userId));

  revalidatePath('/', 'layout');
}

export type AccountState = { error?: string; ok?: string };

const passwordChangeSchema = z
  .object({ current: z.string().min(1), next: passwordSchema, confirm: z.string() })
  .refine((d) => d.next === d.confirm, { message: 'The new passwords do not match.' });

/**
 * Needs the current password, so a session left open on a shared computer
 * cannot be used to lock the owner out. Wrong guesses count against the same
 * limiter as the login form.
 */
export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  const parsed = passwordChangeSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const limitKey = `login:${user.username}`;
  if (await isLimited(limitKey, 5, 15 * 60 * 1000)) {
    return { error: 'Too many attempts. Try again in 15 minutes.' };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id));

  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.current))) {
    await recordEvent(limitKey);
    return { error: 'Your current password is incorrect.' };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, user.id));

  return { ok: 'Password changed.' };
}

/** Deletes the account and, by cascade, all of its learning history. */
export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  if (user.role === 'admin') return { error: 'The admin account cannot delete itself.' };
  if (
    String(formData.get('confirm') ?? '')
      .trim()
      .toLowerCase() !== user.username
  ) {
    return { error: 'Type your username exactly to confirm.' };
  }

  await db.delete(users).where(eq(users.id, user.id));
  await signOut({ redirectTo: '/welcome' });
  return {};
}

const resolveSchema = z.object({ mistakeId: z.string().uuid() });

/** Manual "resolve" on the mistake log — Section 15. */
export async function resolveMistake(input: unknown): Promise<void> {
  const { id: userId } = await requireUser();
  const { mistakeId } = resolveSchema.parse(input);

  await db
    .update(mistakes)
    .set({ resolved: true, resolvedAt: new Date() })
    /*
     * Scoped by userId as well as id (Section 9.3). Without it, knowing a uuid
     * would be enough to resolve another learner's mistake.
     */
    .where(and(eq(mistakes.id, mistakeId), eq(mistakes.userId, userId)));

  revalidatePath('/progress');
}
