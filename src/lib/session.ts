import { cache } from 'react';
import { eq, getTableColumns } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';

const { passwordHash: _passwordHash, ...publicColumns } = getTableColumns(users);

/**
 * The signed-in user's row, or null.
 *
 * The JWT alone is not trusted: a suspended or deleted account keeps a valid
 * token for up to 30 days, so the row is re-read (once per request) and
 * checked on every page and every write.
 */
export const currentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user && !user.disabledAt ? user : null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/**
 * For Server Actions. The user id always comes from the session, never from
 * client input, which is what keeps one learner out of another's data.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Not authorised.');
  return user;
}
