'use server';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/session';
import { db } from '@/db/client';
import {
  attemptAnswers,
  attempts,
  exercises,
  mistakes,
  quizzes,
  skillStats,
  srsCards,
  users,
} from '@/db/schema';
import { check } from '@/lib/grading';
import type { ExerciseType, Verdict } from '@/lib/grading';

/** Section 14: a hint costs 25% of the question's points, practice quizzes only. */
const HINT_PENALTY = 0.25;

const startSchema = z.object({ quizId: z.string().min(1) });

export type StartedAttempt = {
  attemptId: string;
  startedAt: string;
  answers: Record<string, { userAnswer: unknown; verdict: string | null }>;
};

/**
 * Starts a quiz, or resumes the one already in progress.
 *
 * Section 19 Phase 6 is done when "refreshing mid quiz resumes at the same
 * question with prior answers intact", so an unsubmitted attempt is always
 * reused rather than replaced — otherwise a refresh would silently discard
 * everything answered so far.
 */
export async function startAttempt(input: unknown): Promise<StartedAttempt> {
  const { id: userId } = await requireUser();
  const { quizId } = startSchema.parse(input);

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

  const attempt =
    existing ??
    (
      await db
        .insert(attempts)
        .values({ userId, quizId })
        .returning({ id: attempts.id, startedAt: attempts.startedAt })
    )[0]!;

  const saved = await db
    .select({
      exerciseId: attemptAnswers.exerciseId,
      userAnswer: attemptAnswers.userAnswer,
      verdict: attemptAnswers.verdict,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));

  const answers: StartedAttempt['answers'] = {};
  for (const row of saved) {
    if (!row.exerciseId) continue;
    answers[row.exerciseId] = { userAnswer: row.userAnswer, verdict: row.verdict };
  }

  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    answers,
  };
}

const saveSchema = z.object({
  attemptId: z.string().uuid(),
  exerciseId: z.string().min(1),
  userAnswer: z.unknown(),
  hintsUsed: z.number().int().min(0).max(3).default(0),
  timeMs: z.number().int().nonnegative().optional(),
});

/**
 * Autosave for one question — Section 11.3.
 *
 * Graded immediately and stored, so a refresh loses nothing. The verdict is
 * deliberately not returned to the client during a graded quiz; results are a
 * separate screen.
 */
export async function saveQuizAnswer(input: unknown): Promise<{ saved: true }> {
  const { id: userId } = await requireUser();
  const parsed = saveSchema.parse(input);

  const attempt = await ownedAttempt(parsed.attemptId, userId);
  if (attempt.submittedAt) throw new Error('This attempt has already been submitted.');

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, parsed.exerciseId))
    .limit(1);
  if (!exercise) throw new Error('Question not found.');

  const [user] = await db
    .select({ strictMode: users.strictMode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const result = check({
    type: exercise.type as ExerciseType,
    userAnswer: parsed.userAnswer,
    answer: exercise.answer,
    accept: Array.isArray(exercise.accept) ? exercise.accept : [],
    strict: user?.strictMode ?? false,
    points: exercise.points,
  });

  // Section 14: 25% off per hint, and only practice quizzes offer hints at all.
  const penalty = Math.max(0, 1 - HINT_PENALTY * parsed.hintsUsed);
  const awarded = Math.round(result.points * penalty * 100) / 100;

  await db
    .insert(attemptAnswers)
    .values({
      attemptId: parsed.attemptId,
      exerciseId: exercise.id,
      userAnswer: parsed.userAnswer as never,
      isCorrect: result.verdict === 'correct',
      verdict: result.verdict,
      pointsAwarded: String(awarded),
      hintsUsed: parsed.hintsUsed,
      timeMs: parsed.timeMs ?? null,
    })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.exerciseId],
      set: {
        userAnswer: parsed.userAnswer as never,
        isCorrect: result.verdict === 'correct',
        verdict: result.verdict,
        pointsAwarded: String(awarded),
        hintsUsed: parsed.hintsUsed,
        timeMs: parsed.timeMs ?? null,
      },
    });

  return { saved: true };
}

const submitSchema = z.object({ attemptId: z.string().uuid() });

export type QuizOutcome = {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passScore: number;
  durationSec: number;
  bySkill: Array<{ tag: string; correct: number; total: number }>;
  missed: Array<{
    exerciseId: string;
    prompt: string;
    verdict: string;
    expected: string;
    explanation: string | null;
  }>;
};

/**
 * Scores the attempt and closes it — Section 19 Phase 6.
 *
 * `attempts` and `attemptAnswers` are written in one transaction so a quiz can
 * never end up scored but with its answers half-written, or closed twice.
 */
export async function submitAttempt(input: unknown): Promise<QuizOutcome> {
  const { id: userId } = await requireUser();
  const { attemptId } = submitSchema.parse(input);

  const attempt = await ownedAttempt(attemptId, userId);
  if (!attempt.quizId) throw new Error('This attempt has no quiz.');

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1);
  if (!quiz) throw new Error('Quiz not found.');

  const questions = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.quizId, quiz.id), eq(exercises.scope, 'quiz')))
    .orderBy(asc(exercises.orderIndex));

  const saved = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const savedByExercise = new Map(
    saved.filter((row) => row.exerciseId).map((row) => [row.exerciseId!, row]),
  );

  const maxScore = questions.reduce((total, q) => total + q.points, 0);
  let score = 0;

  const bySkillMap = new Map<string, { correct: number; total: number }>();
  const missed: QuizOutcome['missed'] = [];

  await db.transaction(async (tx) => {
    for (const question of questions) {
      const answer = savedByExercise.get(question.id);

      // An unanswered question is recorded as skipped rather than left absent,
      // so the results screen can tell "wrong" from "never reached".
      if (!answer) {
        await tx
          .insert(attemptAnswers)
          .values({
            attemptId,
            exerciseId: question.id,
            userAnswer: null,
            isCorrect: false,
            verdict: 'skipped',
            pointsAwarded: '0',
          })
          .onConflictDoNothing();
      }

      const verdict = (answer?.verdict ?? 'skipped') as Verdict | 'skipped';
      score += Number(answer?.pointsAwarded ?? 0);

      for (const tag of question.skillTags) {
        const entry = bySkillMap.get(tag) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (verdict === 'correct') entry.correct += 1;
        bySkillMap.set(tag, entry);
      }

      if (verdict !== 'correct') {
        missed.push({
          exerciseId: question.id,
          prompt: question.promptMd,
          verdict,
          expected: question.solutionMd ?? JSON.stringify(question.answer),
          explanation: question.whyMd,
        });
      }
    }

    const durationSec = Math.max(
      0,
      Math.round((Date.now() - attempt.startedAt.getTime()) / 1000),
    );
    const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);

    await tx
      .update(attempts)
      .set({
        submittedAt: new Date(),
        score: String(score),
        maxScore: String(maxScore),
        durationSec,
        passed: percent >= quiz.passScore,
      })
      .where(eq(attempts.id, attemptId));
  });

  // Section 12.4 side effects, applied once the attempt is closed.
  for (const question of questions) {
    const answer = savedByExercise.get(question.id);
    const verdict = (answer?.verdict ?? 'skipped') as string;
    await updateSkillStats(userId, question.skillTags, verdict);
  }

  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const durationSec = Math.max(
    0,
    Math.round((Date.now() - attempt.startedAt.getTime()) / 1000),
  );

  return {
    score,
    maxScore,
    percent,
    passed: percent >= quiz.passScore,
    passScore: quiz.passScore,
    durationSec,
    bySkill: [...bySkillMap.entries()].map(([tag, value]) => ({ tag, ...value })),
    missed,
  };
}

const addToReviewSchema = z.object({ exerciseIds: z.array(z.string().min(1)).max(100) });

/** "Add missed items to review" — Section 11.3. */
export async function addMissedToReview(input: unknown): Promise<{ added: number }> {
  const { id: userId } = await requireUser();
  const { exerciseIds } = addToReviewSchema.parse(input);
  if (exerciseIds.length === 0) return { added: 0 };

  let added = 0;

  for (const exerciseId of exerciseIds) {
    const [exercise] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, exerciseId))
      .limit(1);
    if (!exercise) continue;

    const items = [
      ...exercise.vocabRefs.map((ref) => ({
        itemType: 'vocab' as const,
        itemId: `${exercise.lessonId}:vocab:${ref}`,
      })),
      ...exercise.grammarRefs.map((ref) => ({
        itemType: 'grammar' as const,
        itemId: `${exercise.lessonId}:grammar:${ref}`,
      })),
    ];

    for (const item of items) {
      await db
        .insert(srsCards)
        .values({ userId, itemType: item.itemType, itemId: item.itemId })
        .onConflictDoUpdate({
          target: [srsCards.userId, srsCards.itemType, srsCards.itemId],
          set: { dueAt: new Date() },
        });
      added++;
    }

    await db
      .insert(mistakes)
      .values({
        userId,
        lessonId: exercise.lessonId,
        exerciseId: exercise.id,
        skillTags: exercise.skillTags,
        expected: exercise.solutionMd ?? JSON.stringify(exercise.answer),
        got: '(quiz)',
        noteMd: exercise.whyMd,
        origin: 'app',
      })
      .onConflictDoNothing();
  }

  return { added };
}

async function ownedAttempt(attemptId: string, userId: string) {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt) throw new Error('Attempt not found.');
  // Section 9.3: one learner can never touch the other's attempt.
  if (attempt.userId !== userId) throw new Error('Attempt not found.');
  return attempt;
}

async function updateSkillStats(userId: string, tags: string[], verdict: string) {
  if (tags.length === 0) return;
  const outcome = verdict === 'correct' ? 100 : verdict === 'almost' ? 50 : 0;
  const isCorrect = verdict === 'correct' ? 1 : 0;

  for (const tag of tags) {
    await db
      .insert(skillStats)
      .values({
        userId,
        skillTag: tag,
        attempts: 1,
        correct: isCorrect,
        rollingScore: String(outcome),
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [skillStats.userId, skillStats.skillTag],
        set: {
          attempts: sql`${skillStats.attempts} + 1`,
          correct: sql`${skillStats.correct} + ${isCorrect}`,
          rollingScore: sql`round(0.7 * coalesce(${skillStats.rollingScore}, ${outcome}) + 0.3 * ${outcome}, 2)`,
          lastSeenAt: new Date(),
        },
      });
  }
}
