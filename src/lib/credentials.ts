import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

/** OWASP Argon2id baseline: 19 MiB, 2 iterations, 1 lane. */
const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

/** Never throws: a malformed stored hash is simply a failed verification. */
export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}

/** Usernames are stored lower-case, so `Anna` and `anna` are one account. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, digits or underscores.');

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name.')
  .max(40, 'Use at most 40 characters.');

/** Names a stranger could use to pass themselves off as the site. */
const RESERVED = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'lernbuch',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED.has(username);
}
