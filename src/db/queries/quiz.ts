import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { attemptAnswers, attempts, exercises, quizzes } from '@/db/schema';

export async function getQuizzesForLesson(lessonId: string) {
  return db
    .select()
    .from(quizzes)
    .where(eq(quizzes.lessonId, lessonId))
    .orderBy(asc(quizzes.id));
}

export async function getQuizQuestions(quizId: string) {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.quizId, quizId), eq(exercises.scope, 'quiz')))
    .orderBy(asc(exercises.orderIndex));
}

/**
 * Finds an unfinished attempt without creating one.
 *
 * The quiz page used to call the `startAttempt` action while rendering, which
 * meant that merely opening the page began an attempt — so a quiz that had
 * never been taken already showed as started, and later as failed. Reading and
 * writing are now separate: this looks, and the Start button acts.
 */
export async function findOpenAttempt(userId: string, quizId: string) {
  const [existing] = await db
    .select({ id: attempts.id, startedAt: attempts.startedAt })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.quizId, quizId),
        isNull(attempts.submittedAt),
      ),
    )
    .orderBy(desc(attempts.startedAt))
    .limit(1);

  if (!existing) return null;

  const saved = await db
    .select({
      exerciseId: attemptAnswers.exerciseId,
      userAnswer: attemptAnswers.userAnswer,
      verdict: attemptAnswers.verdict,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, existing.id));

  const answers: Record<string, { userAnswer: unknown; verdict: string | null }> = {};
  for (const row of saved) {
    if (!row.exerciseId) continue;
    answers[row.exerciseId] = { userAnswer: row.userAnswer, verdict: row.verdict };
  }

  return {
    attemptId: existing.id,
    startedAt: existing.startedAt.toISOString(),
    answers,
  };
}

/** Most recent finished attempt, for the "last score" line on the start card. */
export async function getLastResult(userId: string, quizId: string) {
  const [row] = await db
    .select({
      score: attempts.score,
      maxScore: attempts.maxScore,
      passed: attempts.passed,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.quizId, quizId),
        isNotNull(attempts.submittedAt),
      ),
    )
    .orderBy(desc(attempts.submittedAt))
    .limit(1);
  return row ?? null;
}
