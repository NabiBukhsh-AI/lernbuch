'use server';

import { randomUUID } from 'node:crypto';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { AccountSuspended, signIn, signOut } from '@/lib/auth';
import {
  displayNameSchema,
  hashPassword,
  isReservedUsername,
  passwordSchema,
  usernameSchema,
} from '@/lib/credentials';
import { clientIp, isLimited, recordEvent } from '@/lib/rate-limit';
import { db } from '@/db/client';
import { users } from '@/db/schema';

const MINUTE = 60 * 1000;

/*
 * Per-IP limits sit on top of the per-username login limit in lib/auth.ts.
 * They are generous on purpose: a whole class signing up from one school
 * network shares a single IP.
 */
const LOGIN_FAILURES_PER_IP = 30; // per 15 minutes
const SIGNUPS_PER_IP = 20; // per hour

/**
 * One message for every failure mode. A wrong password, an unknown username
 * and a rate-limited account all read the same, so the form never confirms
 * which accounts exist.
 */
const GENERIC_FAILURE = 'Incorrect username or password.';

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  callbackUrl: z.string().optional(),
});

export type LoginState = { error?: string };

/** Only same-origin paths, so a crafted callbackUrl cannot bounce the user off-site. */
function safeRedirect(raw: string | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl') ?? undefined,
  });

  if (!parsed.success) return { error: GENERIC_FAILURE };

  const ipKey = `login-ip:${await clientIp()}`;
  if (await isLimited(ipKey, LOGIN_FAILURES_PER_IP, 15 * MINUTE)) {
    return { error: 'Too many attempts from this network. Try again in 15 minutes.' };
  }

  try {
    await signIn('credentials', {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: safeRedirect(parsed.data.callbackUrl),
    });
  } catch (error) {
    if (error instanceof AccountSuspended) {
      return { error: 'This account has been suspended.' };
    }
    if (error instanceof AuthError) {
      await recordEvent(ipKey);
      return { error: GENERIC_FAILURE };
    }
    // A successful signIn signals the redirect by throwing. That must escape.
    throw error;
  }

  return {};
}

const signupSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match.',
  });

type SignupField = 'username' | 'displayName' | 'password' | 'confirm';

export type SignupState = {
  error?: string;
  fieldErrors?: Partial<Record<SignupField, string>>;
  /** Echoed back so a failed submit does not wipe what was typed. */
  values?: { username: string; displayName: string };
};

const USERNAME_TAKEN = 'That username is taken.';

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const values = {
    username: String(formData.get('username') ?? ''),
    displayName: String(formData.get('displayName') ?? ''),
  };

  // Honeypot: hidden from people, filled in by naive bots.
  if (formData.get('website'))
    return { error: 'Sign-up failed. Please try again.', values };

  const ipKey = `signup:${await clientIp()}`;
  if (await isLimited(ipKey, SIGNUPS_PER_IP, 60 * MINUTE)) {
    return {
      error: 'Too many sign-ups from this network. Try again in an hour.',
      values,
    };
  }

  const parsed = signupSchema.safeParse({
    ...values,
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    const fieldErrors: SignupState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SignupField;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const { username, displayName, password } = parsed.data;
  if (isReservedUsername(username))
    return { fieldErrors: { username: USERNAME_TAKEN }, values };

  await recordEvent(ipKey);

  const created = await db
    .insert(users)
    .values({
      id: randomUUID(),
      username,
      displayName,
      passwordHash: await hashPassword(password),
    })
    .onConflictDoNothing({ target: users.username })
    .returning({ id: users.id });

  if (created.length === 0) return { fieldErrors: { username: USERNAME_TAKEN }, values };

  // Throws the redirect on success.
  await signIn('credentials', { username, password, redirectTo: '/' });
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
