import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { submissions } from '@/db/schema';

export type AttemptSummary = {
  attemptNo: number;
  verdict: string | null;
  hintsUsed: number;
  solutionRevealed: boolean;
  createdAt: Date;
};

/**
 * Per-item attempt history for one learner — Section 19, Phase 5.
 *
 * Filtered by `userId` (Section 9.3): content is shared between all learners,
 * progress is not.
 */
export async function getSubmissionHistory(
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, AttemptSummary[]>> {
  if (exerciseIds.length === 0) return new Map();

  const rows = await db
    .select({
      exerciseId: submissions.exerciseId,
      attemptNo: submissions.attemptNo,
      verdict: submissions.verdict,
      hintsUsed: submissions.hintsUsed,
      solutionRevealed: submissions.solutionRevealed,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(
      and(eq(submissions.userId, userId), inArray(submissions.exerciseId, exerciseIds)),
    )
    .orderBy(desc(submissions.attemptNo));

  const byExercise = new Map<string, AttemptSummary[]>();
  for (const row of rows) {
    if (!row.exerciseId) continue;
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push({
      attemptNo: row.attemptNo,
      verdict: row.verdict,
      hintsUsed: row.hintsUsed,
      solutionRevealed: row.solutionRevealed,
      createdAt: row.createdAt,
    });
    byExercise.set(row.exerciseId, list);
  }
  return byExercise;
}
