/**
 * One lesson file in, one outcome out. Shared by `pnpm ingest` and the admin
 * upload, so both paths hash, validate, upsert and log identically.
 */
import { eq } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from '@/db/schema';
import { ingestLog, lessons } from '@/db/schema';
import { ContentValidationError, hasSlug, parseLesson, sha256 } from './parser';
import { upsertLesson, type IngestStats } from './upsert';

type Db = NeonDatabase<typeof schema>;

export type IngestOutcome =
  | { action: 'ignored' | 'skipped'; lesson: string; detail: string }
  | { action: 'created' | 'updated'; lesson: string; stats: IngestStats }
  | { action: 'failed'; lesson: string; error: unknown };

export async function ingestLessonFile(
  db: Db,
  fileName: string,
  raw: string,
  { force = false } = {},
): Promise<IngestOutcome> {
  // A stray README or a copy of a spec has no slug and is skipped, not an error.
  if (!hasSlug(raw)) return { action: 'ignored', lesson: fileName, detail: 'no slug' };

  const hash = sha256(raw);
  const slug = fileName.replace(/\.md$/i, '');

  try {
    const [existing] = await db
      .select({ fileHash: lessons.fileHash })
      .from(lessons)
      .where(eq(lessons.slug, slug))
      .limit(1);

    if (existing?.fileHash === hash && !force) {
      return { action: 'skipped', lesson: fileName, detail: 'hash unchanged' };
    }

    const parsed = parseLesson(fileName, raw);
    const stats = await upsertLesson(db, parsed);
    const action = existing ? 'updated' : 'created';

    await db
      .insert(ingestLog)
      .values({ lessonSlug: parsed.slug, fileHash: hash, action, stats, message: null });

    return { action, lesson: parsed.slug, stats };
  } catch (error) {
    await db
      .insert(ingestLog)
      .values({
        lessonSlug: slug,
        fileHash: hash,
        action: 'failed',
        stats: null,
        message: (error as Error).message.slice(0, 4000),
      })
      .catch(() => undefined);

    return { action: 'failed', lesson: fileName, error };
  }
}

/** `vocab +44, grammar ~3` — only the blocks that changed. */
export function formatStats(stats: IngestStats): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(stats)) {
    if (value.created === 0 && value.updated === 0 && value.removed === 0) continue;
    const bits = [
      value.created ? `+${value.created}` : null,
      value.updated ? `~${value.updated}` : null,
      value.removed ? `-${value.removed}` : null,
    ].filter(Boolean);
    parts.push(`${name} ${bits.join('/')}`);
  }
  return parts.length ? parts.join(', ') : 'no changes';
}

/** Human-readable reason for a failed outcome, YAML paths included. */
export function describeFailure(error: unknown): string {
  if (error instanceof ContentValidationError) {
    return error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
  }
  return error instanceof Error ? error.message : String(error);
}
