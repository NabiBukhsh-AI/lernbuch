import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  exercises,
  lessons,
  mistakes,
  skillStats,
  srsCards,
  studySessions,
  submissions,
  vocabItems,
} from '@/db/schema';
import { maturityOf, type Maturity } from '@/lib/srs/scheduler';

/**
 * Progress and weak-skill detection — ARCHITECTURE.md Section 15.
 *
 *   weak     : attempts >= 5 and rollingScore < 70
 *   mastered : attempts >= 8 and rollingScore >= 90 and the last 3 correct
 */

export const WEAK_MIN_ATTEMPTS = 5;
export const WEAK_MAX_SCORE = 70;
export const MASTERED_MIN_ATTEMPTS = 8;
export const MASTERED_MIN_SCORE = 90;

export type SkillRow = {
  skillTag: string;
  attempts: number;
  correct: number;
  rollingScore: number;
  lastSeenAt: Date | null;
  status: 'weak' | 'mastered' | 'learning';
};

export async function getSkillStats(userId: string): Promise<SkillRow[]> {
  const rows = await db
    .select()
    .from(skillStats)
    .where(eq(skillStats.userId, userId))
    .orderBy(desc(skillStats.lastSeenAt));

  return rows.map((row) => {
    const score = Number(row.rollingScore ?? 0);
    /*
     * "the last 3 outcomes were correct" is not derivable from skill_stats,
     * which keeps only the moving average. A perfect recent average is the
     * closest honest proxy: with the 0.7/0.3 EWMA, three consecutive correct
     * answers cannot leave the score below 90 unless it started very low, so
     * this errs towards withholding mastery rather than granting it early.
     */
    const status: SkillRow['status'] =
      row.attempts >= MASTERED_MIN_ATTEMPTS && score >= MASTERED_MIN_SCORE
        ? 'mastered'
        : row.attempts >= WEAK_MIN_ATTEMPTS && score < WEAK_MAX_SCORE
          ? 'weak'
          : 'learning';

    return {
      skillTag: row.skillTag,
      attempts: row.attempts,
      correct: row.correct,
      rollingScore: score,
      lastSeenAt: row.lastSeenAt,
      status,
    };
  });
}

export async function getWeakSkills(userId: string): Promise<SkillRow[]> {
  const all = await getSkillStats(userId);
  return all
    .filter((row) => row.status === 'weak')
    .sort((a, b) => a.rollingScore - b.rollingScore);
}

/**
 * Exercises whose skill tags intersect the given set, from every lesson.
 *
 * This is what the "Drill these" button assembles (Section 15). Quiz questions
 * are excluded: pulling a graded quiz question into a practice drill would
 * spoil that quiz.
 */
export async function getDrillExercises(tags: string[], limit = 20) {
  if (tags.length === 0) return [];

  return db
    .select({
      id: exercises.id,
      lessonId: exercises.lessonId,
      type: exercises.type,
      orderIndex: exercises.orderIndex,
      promptMd: exercises.promptMd,
      instructionMd: exercises.instructionMd,
      given: exercises.given,
      solutionMd: exercises.solutionMd,
      whyMd: exercises.whyMd,
      takeawayMd: exercises.takeawayMd,
      tips: exercises.tips,
      skillTags: exercises.skillTags,
      points: exercises.points,
      lessonNumber: lessons.lessonNumber,
    })
    .from(exercises)
    .leftJoin(lessons, eq(lessons.id, exercises.lessonId))
    .where(
      and(
        sql`${exercises.skillTags} && ${tags}::text[]`,
        inArray(exercises.scope, ['classwork', 'homework', 'drill']),
      ),
    )
    .orderBy(desc(lessons.classDate), exercises.orderIndex)
    .limit(limit);
}

export type MistakeRow = {
  id: string;
  lessonId: string | null;
  expected: string;
  got: string;
  noteMd: string | null;
  origin: string | null;
  skillTags: string[];
  resolved: boolean;
  createdAt: Date;
};

export async function getMistakes(
  userId: string,
  options: { resolved?: boolean } = {},
): Promise<MistakeRow[]> {
  const where = [eq(mistakes.userId, userId)];
  if (options.resolved !== undefined) {
    where.push(eq(mistakes.resolved, options.resolved));
  }

  return db
    .select({
      id: mistakes.id,
      lessonId: mistakes.lessonId,
      expected: mistakes.expected,
      got: mistakes.got,
      noteMd: mistakes.noteMd,
      origin: mistakes.origin,
      skillTags: mistakes.skillTags,
      resolved: mistakes.resolved,
      createdAt: mistakes.createdAt,
    })
    .from(mistakes)
    .where(and(...where))
    .orderBy(desc(mistakes.createdAt))
    .limit(200);
}

/** Vocabulary maturity counts — Section 15. */
export async function getVocabMaturity(
  userId: string,
): Promise<Record<Maturity | 'total', number>> {
  const [totalRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vocabItems)
    .where(eq(vocabItems.srsEnabled, true));

  const cards = await db
    .select({
      reps: srsCards.reps,
      intervalDays: srsCards.intervalDays,
      lapses: srsCards.lapses,
    })
    .from(srsCards)
    .where(and(eq(srsCards.userId, userId), eq(srsCards.itemType, 'vocab')));

  const counts: Record<Maturity | 'total', number> = {
    total: totalRow?.n ?? 0,
    new: 0,
    learning: 0,
    young: 0,
    mature: 0,
    leech: 0,
  };

  for (const card of cards) {
    counts[
      maturityOf({
        reps: card.reps,
        intervalDays: Number(card.intervalDays),
        lapses: card.lapses,
      })
    ] += 1;
  }

  // Anything never seen is new, whether or not a card row exists yet.
  counts.new += Math.max(0, counts.total - cards.length);

  return counts;
}

/**
 * Consecutive days ending today or yesterday — Section 15.
 *
 * Today is not required: a streak that breaks the moment the day turns over,
 * before any studying has happened, would be reporting a failure that has not
 * occurred yet.
 */
export async function getStreak(userId: string): Promise<{
  current: number;
  weekMinutes: number;
  daysStudied: string[];
}> {
  const since = new Date(Date.now() - 90 * 86_400_000);

  const rows = await db
    .select({
      day: sql<string>`to_char(${studySessions.startedAt} at time zone 'utc', 'YYYY-MM-DD')`,
      seconds: sql<number>`coalesce(sum(extract(epoch from (${studySessions.endedAt} - ${studySessions.startedAt}))), 0)::int`,
    })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);

  const days = rows.map((row) => row.day);
  const daySet = new Set(days);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);

  let cursor = daySet.has(iso(today))
    ? today
    : daySet.has(iso(yesterday))
      ? yesterday
      : null;

  let current = 0;
  while (cursor && daySet.has(iso(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  const weekAgo = iso(new Date(Date.now() - 7 * 86_400_000));
  const weekMinutes = Math.round(
    rows
      .filter((row) => row.day >= weekAgo)
      .reduce((total, row) => total + row.seconds, 0) / 60,
  );

  return { current, weekMinutes, daysStudied: days };
}

/** Slug of the lesson behind the learner's most recent classwork or homework answer. */
export async function getLastStudiedLesson(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ lessonId: exercises.lessonId })
    .from(submissions)
    .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt))
    .limit(1);
  return row?.lessonId ?? null;
}
