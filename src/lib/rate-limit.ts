import { and, count, eq, gte, lt } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/db/client';
import { rateLimitEvents } from '@/db/schema';

/*
 * Sliding-window counters in Postgres (see `rateLimitEvents`).
 *
 * ponytail: count-then-insert is not atomic, so a burst of parallel requests
 * can overshoot a limit by a few. Fine for abuse throttling; move to an
 * atomic counter (Upstash, or an upsert on a bucket row) if it must be exact.
 */

/** True when `key` already has `limit` events inside the window. */
export async function isLimited(key: string, limit: number, windowMs: number) {
  const [row] = await db
    .select({ n: count() })
    .from(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.key, key),
        gte(rateLimitEvents.createdAt, new Date(Date.now() - windowMs)),
      ),
    );
  return (row?.n ?? 0) >= limit;
}

export async function recordEvent(key: string): Promise<void> {
  await db.insert(rateLimitEvents).values({ key });

  // ponytail: probabilistic cleanup instead of a cron; no window exceeds a day.
  if (Math.random() < 0.02) {
    await db
      .delete(rateLimitEvents)
      .where(lt(rateLimitEvents.createdAt, new Date(Date.now() - 86_400_000)));
  }
}

/**
 * The caller's IP. On Vercel `x-forwarded-for` is overwritten by the edge, so
 * its first entry cannot be spoofed by the client. Behind another proxy, make
 * sure that proxy does the same.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  );
}
