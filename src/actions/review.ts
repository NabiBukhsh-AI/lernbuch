'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/session';
import { db } from '@/db/client';
import { mistakes, srsCards, studySessions } from '@/db/schema';
import { FRESH_CARD, schedule, type SrsGrade } from '@/lib/srs/scheduler';

const gradeSchema = z.object({
  itemType: z.enum(['vocab', 'grammar', 'phrase']),
  itemId: z.string().min(1),
  grade: z.enum(['again', 'hard', 'good', 'easy']),
});

export type GradeCardResult = {
  intervalDays: number;
  dueAt: string;
  /** True when the card should come round again inside this session. */
  repeatThisSession: boolean;
};

/**
 * Applies one grade to a card — Section 13.
 *
 * The card row is created on first sight, so a brand new item does not need to
 * have been pre-seeded into `srs_cards` before it can be reviewed.
 */
export async function gradeCard(input: unknown): Promise<GradeCardResult> {
  const { id: userId } = await requireUser();
  const parsed = gradeSchema.parse(input);

  const [existing] = await db
    .select()
    .from(srsCards)
    .where(
      and(
        eq(srsCards.userId, userId),
        eq(srsCards.itemType, parsed.itemType),
        eq(srsCards.itemId, parsed.itemId),
      ),
    )
    .limit(1);

  const state = existing
    ? {
        ease: Number(existing.ease),
        intervalDays: Number(existing.intervalDays),
        reps: existing.reps,
        lapses: existing.lapses,
      }
    : FRESH_CARD;

  const next = schedule(state, parsed.grade as SrsGrade);

  await db
    .insert(srsCards)
    .values({
      userId,
      itemType: parsed.itemType,
      itemId: parsed.itemId,
      ease: String(next.ease),
      intervalDays: String(next.intervalDays),
      dueAt: next.dueAt,
      reps: next.reps,
      lapses: next.lapses,
      lastGrade: parsed.grade,
    })
    .onConflictDoUpdate({
      target: [srsCards.userId, srsCards.itemType, srsCards.itemId],
      set: {
        ease: String(next.ease),
        intervalDays: String(next.intervalDays),
        dueAt: next.dueAt,
        reps: next.reps,
        lapses: next.lapses,
        lastGrade: parsed.grade,
      },
    });

  return {
    intervalDays: next.intervalDays,
    dueAt: next.dueAt.toISOString(),
    repeatThisSession: parsed.grade === 'again',
  };
}

const mistakeSchema = z.object({
  mistakeId: z.string().uuid(),
  correct: z.boolean(),
});

/**
 * Records the outcome of a class-mistake drill — Section 8.9.
 *
 * "prioritised in the review queue until answered correctly three times in a
 * row". The streak lives in `noteMd` because `mistakes` has no counter column;
 * a miss resets it, and the third consecutive hit resolves the row.
 */
export async function drillMistake(input: unknown): Promise<{ resolved: boolean }> {
  const { id: userId } = await requireUser();
  const parsed = mistakeSchema.parse(input);

  const [row] = await db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.id, parsed.mistakeId), eq(mistakes.userId, userId)))
    .limit(1);

  if (!row) throw new Error('Mistake not found.');

  const streakMatch = /\[streak:(\d+)\]/.exec(row.noteMd ?? '');
  const current = streakMatch ? Number(streakMatch[1]) : 0;
  const next = parsed.correct ? current + 1 : 0;

  const baseNote = (row.noteMd ?? '').replace(/\s*\[streak:\d+\]/, '');
  const noteMd = `${baseNote} [streak:${next}]`.trim();
  const resolved = next >= 3;

  await db
    .update(mistakes)
    .set({
      noteMd,
      resolved,
      resolvedAt: resolved ? new Date() : null,
    })
    .where(eq(mistakes.id, parsed.mistakeId));

  return { resolved };
}

const sessionSchema = z.object({ cardsReviewed: z.number().int().nonnegative() });

/** Records a finished review session, feeding the streak on /progress. */
export async function recordStudySession(input: unknown): Promise<void> {
  const { id: userId } = await requireUser();
  const parsed = sessionSchema.parse(input);
  if (parsed.cardsReviewed === 0) return;

  await db.insert(studySessions).values({
    userId,
    endedAt: new Date(),
    cardsReviewed: parsed.cardsReviewed,
    kind: 'review',
  });
}
