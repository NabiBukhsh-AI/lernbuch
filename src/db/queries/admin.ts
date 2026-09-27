import { desc, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { qualified } from '@/db/qualified';
import {
  attempts,
  exercises,
  lessons,
  srsCards,
  studySessions,
  submissions,
  users,
} from '@/db/schema';

/**
 * Reads for the admin panel. Nothing here is scoped to a user: callers must
 * have passed requireAdmin / the admin layout first.
 */

const WEEK = sql`now() - interval '7 days'`;

/** The outer row in correlated subqueries; see `qualified` for why. */
const userId = qualified(users.id);

/**
 * The most recent sign of life: a login, an answer, a quiz or a review.
 *
 * ponytail: correlated subqueries per row, fine for a page of 50. Add indexes
 * on attempts(user_id) and study_sessions(user_id) if the user list gets slow.
 */
const lastActive = sql<Date | null>`greatest(
  ${users.lastLoginAt},
  (select max(${submissions.createdAt}) from ${submissions} where ${submissions.userId} = ${userId}),
  (select max(${attempts.startedAt}) from ${attempts} where ${attempts.userId} = ${userId}),
  (select max(${studySessions.startedAt}) from ${studySessions} where ${studySessions.userId} = ${userId})
)`.mapWith(users.lastLoginAt);

export async function getAdminStats() {
  const [row] = await db
    .select({
      users: sql<number>`count(*)::int`,
      newThisWeek: sql<number>`count(*) filter (where ${users.createdAt} > ${WEEK})::int`,
      suspended: sql<number>`count(*) filter (where ${users.disabledAt} is not null)::int`,
      activeThisWeek: sql<number>`count(*) filter (where ${lastActive} > ${WEEK})::int`,
      answersThisWeek: sql<number>`(select count(*)::int from ${submissions} where ${submissions.createdAt} > ${WEEK})`,
      lessons: sql<number>`(select count(*)::int from ${lessons})`,
      published: sql<number>`(select count(*)::int from ${lessons} where ${lessons.publish})`,
    })
    .from(users);

  return row!;
}

export const USERS_PAGE_SIZE = 50;

export async function listUsers({ q, page }: { q?: string; page: number }) {
  const search = q?.trim()
    ? or(
        ilike(users.username, `%${q.trim()}%`),
        ilike(users.displayName, `%${q.trim()}%`),
      )
    : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        targetLevel: users.targetLevel,
        createdAt: users.createdAt,
        disabledAt: users.disabledAt,
        lastActive,
        answers: sql<number>`(select count(*)::int from ${submissions} where ${submissions.userId} = ${userId})`,
        accuracy: sql<
          number | null
        >`(select round(100 * avg(${submissions.isCorrect}::int))::int from ${submissions} where ${submissions.userId} = ${userId})`,
        quizzes: sql<number>`(select count(*)::int from ${attempts} where ${attempts.userId} = ${userId} and ${attempts.submittedAt} is not null)`,
        cards: sql<number>`(select count(*)::int from ${srsCards} where ${srsCards.userId} = ${userId})`,
      })
      .from(users)
      .where(search)
      .orderBy(sql`${lastActive} desc nulls last`, desc(users.createdAt))
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(search),
  ]);

  return { rows, total: total?.n ?? 0 };
}

export type AdminUserRow = Awaited<ReturnType<typeof listUsers>>['rows'][number];

/** Every lesson, drafts included, with how many learners have touched it. */
export async function listLessonsForAdmin() {
  return db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      lessonNumber: lessons.lessonNumber,
      title: lessons.title,
      level: lessons.level,
      classDate: lessons.classDate,
      publish: lessons.publish,
      fileHash: lessons.fileHash,
      ingestedAt: lessons.ingestedAt,
      learners: sql<number>`(
        select count(distinct ${qualified(submissions.userId)})::int
        from ${submissions}
        join ${exercises} on ${qualified(exercises.id)} = ${qualified(submissions.exerciseId)}
        where ${qualified(exercises.lessonId)} = ${qualified(lessons.id)}
      )`,
    })
    .from(lessons)
    .orderBy(desc(lessons.classDate));
}
