import { randomBytes } from 'node:crypto';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { hashPassword, verifyPassword } from './credentials';
import { isLimited, recordEvent } from './rate-limit';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/** 5 failed attempts per username per 15 minutes. */
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Only raised after the password has been verified, so it reveals nothing to
 * someone who does not already hold the credentials.
 */
export class AccountSuspended extends CredentialsSignin {
  code = 'suspended';
}

/**
 * When the username does not exist we still run a full verification against a
 * throwaway hash, so a wrong username and a wrong password cost the same time
 * and cannot be used to work out which accounts exist.
 *
 * The hash has to be produced by Argon2 itself: a hand-written string would be
 * rejected during parsing and return far too quickly to disguise anything. It
 * is computed once, lazily, and reused.
 */
let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyHash;
}

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      /**
       * Returns null for every failure mode. The caller turns that into one
       * generic message, so a locked account, an unknown username and a wrong
       * password are indistinguishable from the outside.
       */
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const limitKey = `login:${username}`;

        if (await isLimited(limitKey, MAX_FAILED_ATTEMPTS, WINDOW_MS)) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        const ok = await verifyPassword(
          user?.passwordHash ?? (await getDummyHash()),
          password,
        );

        if (!user || !ok) {
          await recordEvent(limitKey);
          return null;
        }

        if (user.disabledAt) throw new AccountSuspended();

        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
});
