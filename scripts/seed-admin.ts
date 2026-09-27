/**
 * Creates or updates the single admin account from the environment:
 *
 *   ADMIN_USERNAME       required, 3–24 of [a-z0-9_]
 *   ADMIN_PASSWORD       required, at least 8 characters
 *   ADMIN_DISPLAY_NAME   optional, defaults to the username on first creation
 *
 *   pnpm seed:admin
 *
 * Re-running rotates the password. If ADMIN_USERNAME names an account that
 * already exists (for example one that signed up), it is promoted; whoever
 * held the admin role before is demoted to learner, so there is only ever one.
 */
// Must stay first: loads .env.local before db/client.ts reads DATABASE_URL.
import './_env';
import { randomUUID } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { db, pool } from '../src/db/client';
import { users } from '../src/db/schema';
import {
  displayNameSchema,
  hashPassword,
  passwordSchema,
  usernameSchema,
} from '../src/lib/credentials';

async function main() {
  const username = usernameSchema.safeParse(process.env.ADMIN_USERNAME ?? '');
  const password = passwordSchema.safeParse(process.env.ADMIN_PASSWORD ?? '');
  const displayName = displayNameSchema.safeParse(
    process.env.ADMIN_DISPLAY_NAME || process.env.ADMIN_USERNAME || '',
  );

  const problems = [
    !username.success && `ADMIN_USERNAME: ${username.error.issues[0]?.message}`,
    !password.success && `ADMIN_PASSWORD: ${password.error.issues[0]?.message}`,
    !displayName.success && `ADMIN_DISPLAY_NAME: ${displayName.error.issues[0]?.message}`,
  ].filter(Boolean);

  if (!username.success || !password.success || !displayName.success) {
    console.error(`${problems.join('\n')}\nSet them in .env.local. Nothing was changed.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password.data);

  await db.transaction(async (tx) => {
    // Demote first: the partial unique index allows only one admin at a time.
    await tx
      .update(users)
      .set({ role: 'learner' })
      .where(and(eq(users.role, 'admin'), ne(users.username, username.data)));

    await tx
      .insert(users)
      .values({
        id: randomUUID(),
        username: username.data,
        displayName: displayName.data,
        passwordHash,
        role: 'admin',
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          passwordHash,
          role: 'admin',
          disabledAt: null,
          // The display name is the admin's to change in the app; only an
          // explicit env value overrides it.
          ...(process.env.ADMIN_DISPLAY_NAME ? { displayName: displayName.data } : {}),
        },
      });
  });

  console.log(`Admin "${username.data}" is ready.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
