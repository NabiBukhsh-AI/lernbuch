'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin, requireUser } from '@/lib/session';
import { db } from '@/db/client';
import {
  acceptOverrides,
  exercises,
  mistakes,
  skillStats,
  srsCards,
  submissions,
} from '@/db/schema';
import { users } from '@/db/schema';
import { check } from '@/lib/grading';
import type { ExerciseType, GradeResult } from '@/lib/grading';
import {
  ATTEMPTS_BEFORE_REVEAL,
  canRevealSolution,
  effectiveDueDate,
  type Feedback,
} from '@/lib/homework/reveal-policy';

const submitSchema = z.object({
  exerciseId: z.string().min(1),
  /** Shape depends on the exercise type; the grader narrows it. */
  userAnswer: z.unknown(),
  timeMs: z.number().int().nonnegative().optional(),
  hintsUsed: z.number().int().nonnegative().default(0),
  solutionRevealed: z.boolean().default(false),
});

/**
 * Type-only re-export. A `'use server'` module may export async functions and
 * types, but not values, which is why the policy helpers live in
 * `@/lib/homework/reveal-policy` rather than here.
 */
export type { Feedback };

export type SubmitResult = GradeResult & { attemptNo: number; feedback: Feedback };

/**
 * Grades an answer and writes everything Section 12.4 requires:
 * a `submissions` row, updated `skillStats` for each tag, and on a wrong or
 * almost verdict a `mistakes` row plus the linked items pulled forward in the
 * SRS queue.
 */
export async function submitAnswer(input: unknown): Promise<SubmitResult> {
  const { id: userId } = await requireUser();
  const parsed = submitSchema.parse(input);

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, parsed.exerciseId))
    .limit(1);

  if (!exercise) throw new Error('Exercise not found.');

  const [user] = await db
    .select({ strictMode: users.strictMode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Section 12.3: a learner-approved phrasing is accepted on later attempts.
  const overrides = await db
    .select({ answer: acceptOverrides.answer })
    .from(acceptOverrides)
    .where(
      and(
        eq(acceptOverrides.userId, userId),
        eq(acceptOverrides.exerciseId, exercise.id),
      ),
    );

  const accept = [
    ...(Array.isArray(exercise.accept) ? exercise.accept : []),
    ...overrides.map((row) => row.answer),
  ];

  const result = check({
    type: exercise.type as ExerciseType,
    userAnswer: parsed.userAnswer,
    answer: exercise.answer,
    accept,
    strict: user?.strictMode ?? false,
    points: exercise.points,
  });

  const [previous] = await db
    .select({ attemptNo: submissions.attemptNo })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.exerciseId, exercise.id)))
    .orderBy(desc(submissions.attemptNo))
    .limit(1);

  const attemptNo = (previous?.attemptNo ?? 0) + 1;

  await db.insert(submissions).values({
    userId,
    exerciseId: exercise.id,
    userAnswer: parsed.userAnswer as never,
    isCorrect: result.verdict === 'correct',
    verdict: result.verdict,
    attemptNo,
    hintsUsed: parsed.hintsUsed,
    solutionRevealed: parsed.solutionRevealed,
    timeMs: parsed.timeMs ?? null,
  });

  await updateSkillStats(userId, exercise.skillTags, result.verdict);

  if (result.verdict !== 'correct') {
    await recordMistake(userId, exercise, result, parsed.userAnswer);
    await pullForward(
      userId,
      exercise.vocabRefs,
      exercise.grammarRefs,
      exercise.lessonId,
    );
  }

  /*
   * Getting it right earns the answer regardless of policy — there is nothing
   * left to protect once the learner has produced it themselves.
   */
  const unlocked =
    result.verdict === 'correct' ||
    canRevealSolution(
      { revealPolicy: exercise.revealPolicy, dueDate: effectiveDueDate(exercise) },
      attemptNo,
    );

  return {
    ...result,
    attemptNo,
    feedback: {
      whyMd: exercise.whyMd,
      takeawayMd: exercise.takeawayMd,
      solutionMd: unlocked ? exercise.solutionMd : null,
      solutionLocked: !unlocked,
    },
  };
}

const revealHintSchema = z.object({
  exerciseId: z.string().min(1),
  level: z.number().int().min(1).max(3),
});

/**
 * Returns one hint and logs that it was taken — Section 8.7.
 *
 * The text lives only here. It is never serialised into the homework page, so
 * it cannot be read out of the HTML or un-hidden with CSS before it is asked
 * for, which is the Phase 5 acceptance criterion.
 */
export async function revealHint(input: unknown): Promise<{ text: string | null }> {
  const { id: userId } = await requireUser();
  const parsed = revealHintSchema.parse(input);

  const [exercise] = await db
    .select({ id: exercises.id, hints: exercises.hints })
    .from(exercises)
    .where(eq(exercises.id, parsed.exerciseId))
    .limit(1);

  if (!exercise) throw new Error('Exercise not found.');

  const hints = Array.isArray(exercise.hints)
    ? (exercise.hints as Array<{ level: number; text: string }>)
    : [];
  const hint = hints.find((entry) => entry.level === parsed.level);
  if (!hint) return { text: null };

  await logHintUse(userId, exercise.id, parsed.level);

  return { text: hint.text };
}

/**
 * Records the cost of a hint.
 *
 * Section 14: in homework this is "penalised in reporting only, never in the
 * score". A row is created before any answer exists so that giving up on the
 * first hint and never submitting is still visible in the reporting.
 */
async function logHintUse(userId: string, exerciseId: string, level: number) {
  const [latest] = await db
    .select({ id: submissions.id, hintsUsed: submissions.hintsUsed })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.exerciseId, exerciseId)))
    .orderBy(desc(submissions.attemptNo))
    .limit(1);

  if (latest) {
    await db
      .update(submissions)
      .set({ hintsUsed: Math.max(latest.hintsUsed, level) })
      .where(eq(submissions.id, latest.id));
    return;
  }

  await db.insert(submissions).values({
    userId,
    exerciseId,
    userAnswer: null,
    isCorrect: null,
    verdict: null,
    attemptNo: 0,
    hintsUsed: level,
  });
}

const revealSolutionSchema = z.object({ exerciseId: z.string().min(1) });

export type RevealSolutionResult =
  | { locked: true; reason: string }
  | {
      locked: false;
      solutionMd: string | null;
      whyMd: string | null;
      takeawayMd: string | null;
    };

/**
 * "Show the answer" — Section 14, behind a confirm in the UI.
 *
 * Logged separately from hints (`solutionRevealed`), and the linked items are
 * pushed into the review queue, because an answer that had to be shown is by
 * definition not yet known (Section 8.7).
 */
export async function revealSolution(input: unknown): Promise<RevealSolutionResult> {
  const { id: userId } = await requireUser();
  const parsed = revealSolutionSchema.parse(input);

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, parsed.exerciseId))
    .limit(1);

  if (!exercise) throw new Error('Exercise not found.');

  const [latest] = await db
    .select({ id: submissions.id, attemptNo: submissions.attemptNo })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.exerciseId, exercise.id)))
    .orderBy(desc(submissions.attemptNo))
    .limit(1);

  const attempts = latest?.attemptNo ?? 0;

  const due = effectiveDueDate(exercise);

  if (
    !canRevealSolution({ revealPolicy: exercise.revealPolicy, dueDate: due }, attempts)
  ) {
    return {
      locked: true,
      reason:
        exercise.revealPolicy === 'after_due'
          ? `The answer unlocks after the due date (${due ?? 'not set'}).`
          : `Have a go first — the answer unlocks after ${ATTEMPTS_BEFORE_REVEAL} attempts.`,
    };
  }

  if (latest) {
    await db
      .update(submissions)
      .set({ solutionRevealed: true })
      .where(eq(submissions.id, latest.id));
  } else {
    await db.insert(submissions).values({
      userId,
      exerciseId: exercise.id,
      userAnswer: null,
      isCorrect: null,
      verdict: null,
      attemptNo: 0,
      solutionRevealed: true,
    });
  }

  await pullForward(userId, exercise.vocabRefs, exercise.grammarRefs, exercise.lessonId);

  return {
    locked: false,
    solutionMd: exercise.solutionMd,
    whyMd: exercise.whyMd,
    takeawayMd: exercise.takeawayMd,
  };
}

/**
 * Section 15: rollingScore is an exponentially weighted moving average.
 *
 *   score_new = 0.7 * score_old + 0.3 * outcome     correct=100 almost=50 wrong=0
 *
 * The first outcome for a tag seeds the average rather than being blended with
 * a non-existent previous score, so one wrong answer on a brand new skill does
 * not start it at 30 out of 100.
 */
async function updateSkillStats(
  userId: string,
  tags: string[],
  verdict: 'correct' | 'almost' | 'wrong',
) {
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

type ExerciseRow = typeof exercises.$inferSelect;

/** Creates or reinforces a mistakes row (Section 12.4). */
async function recordMistake(
  userId: string,
  exercise: ExerciseRow,
  result: GradeResult,
  userAnswer: unknown,
) {
  const expected = result.parts.length
    ? result.parts.map((part) => part.expected).join(' | ')
    : (exercise.solutionMd ?? JSON.stringify(exercise.answer));

  const got =
    typeof userAnswer === 'string' ? userAnswer : JSON.stringify(userAnswer ?? '');

  const [existing] = await db
    .select({ id: mistakes.id })
    .from(mistakes)
    .where(
      and(
        eq(mistakes.userId, userId),
        eq(mistakes.exerciseId, exercise.id),
        eq(mistakes.resolved, false),
      ),
    )
    .limit(1);

  if (existing) {
    // Reinforce rather than duplicate: same slip, made again.
    await db
      .update(mistakes)
      .set({ got, createdAt: new Date() })
      .where(eq(mistakes.id, existing.id));
    return;
  }

  await db.insert(mistakes).values({
    userId,
    lessonId: exercise.lessonId,
    exerciseId: exercise.id,
    skillTags: exercise.skillTags,
    expected,
    got,
    noteMd: result.notes.map((note) => note.message).join(' ') || null,
    origin: 'app',
  });
}

/**
 * Pulls the linked vocabulary and grammar forward in the SRS queue.
 *
 * The refs in a lesson file are bare item ids, so they are composed into full
 * ids here the same way the ingest script composed them.
 */
async function pullForward(
  userId: string,
  vocabRefs: string[],
  grammarRefs: string[],
  lessonId: string,
) {
  const items: Array<{ itemType: 'vocab' | 'grammar'; itemId: string }> = [
    ...vocabRefs.map((ref) => ({
      itemType: 'vocab' as const,
      itemId: `${lessonId}:vocab:${ref}`,
    })),
    ...grammarRefs.map((ref) => ({
      itemType: 'grammar' as const,
      itemId: `${lessonId}:grammar:${ref}`,
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
  }
}

const dueDateSchema = z.object({
  lessonId: z.string().min(1),
  /** Empty string clears the override and returns to the authored date. */
  dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
});

/**
 * Sets the due date for a lesson's homework from the UI.
 *
 * Written to `due_date_override`, which ingest never touches, so correcting a
 * placeholder date here is not undone by the next `pnpm ingest --force`. The
 * lesson file remains the source of truth for the authored date; clearing the
 * override falls back to it.
 */
export async function setHomeworkDueDate(input: unknown): Promise<void> {
  await requireAdmin();
  const parsed = dueDateSchema.parse(input);

  await db
    .update(exercises)
    .set({ dueDateOverride: parsed.dueDate === '' ? null : parsed.dueDate })
    .where(and(eq(exercises.lessonId, parsed.lessonId), eq(exercises.scope, 'homework')));

  revalidatePath(`/lessons/${parsed.lessonId}/homework`);
}

const acceptSchema = z.object({
  exerciseId: z.string().min(1),
  answer: z.string().min(1).max(500),
});

/**
 * "Mark as acceptable" — Section 12.3.
 *
 * Scoped to one user and one exercise: approving your own phrasing must never
 * change what anyone else is graded against.
 */
export async function markAcceptable(input: unknown): Promise<void> {
  const { id: userId } = await requireUser();
  const parsed = acceptSchema.parse(input);

  await db
    .insert(acceptOverrides)
    .values({
      userId,
      exerciseId: parsed.exerciseId,
      answer: parsed.answer,
    })
    .onConflictDoNothing();
}
