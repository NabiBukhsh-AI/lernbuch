import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { qualified } from '@/db/qualified';
import {
  exercises,
  grammarPoints,
  lessonSections,
  lessons,
  quizzes,
  vocabItems,
} from '@/db/schema';

/**
 * Reads for the lesson surfaces — Section 10.
 *
 * Every query lives here rather than inline in a page so the Server Components
 * stay declarative and the SQL is reviewable in one place.
 */

export type LessonListItem = Awaited<ReturnType<typeof listLessons>>[number];

/** All lessons, newest first, with the per-block counts the list screen shows. */
export async function listLessons() {
  const lessonId = qualified(lessons.id);
  const rows = await db
    .select({
      slug: lessons.slug,
      lessonNumber: lessons.lessonNumber,
      title: lessons.title,
      subtitle: lessons.subtitle,
      level: lessons.level,
      classDate: lessons.classDate,
      topics: lessons.topics,
      durationMin: lessons.durationMin,
      vocabCount: sql<number>`(
        select count(*)::int from ${vocabItems} where ${vocabItems.lessonId} = ${lessonId}
      )`,
      grammarCount: sql<number>`(
        select count(*)::int from ${grammarPoints} where ${grammarPoints.lessonId} = ${lessonId}
      )`,
      classworkCount: sql<number>`(
        select count(*)::int from ${exercises}
        where ${exercises.lessonId} = ${lessonId} and ${exercises.scope} = 'classwork'
      )`,
      homeworkCount: sql<number>`(
        select count(*)::int from ${exercises}
        where ${exercises.lessonId} = ${lessonId} and ${exercises.scope} = 'homework'
      )`,
      quizCount: sql<number>`(
        select count(*)::int from ${quizzes} where ${quizzes.lessonId} = ${lessonId}
      )`,
    })
    .from(lessons)
    .where(eq(lessons.publish, true))
    .orderBy(desc(lessons.classDate));

  return rows;
}

export async function getLesson(slug: string) {
  const [row] = await db.select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
  return row ?? null;
}

export async function getLessonSections(lessonId: string) {
  return db
    .select()
    .from(lessonSections)
    .where(eq(lessonSections.lessonId, lessonId))
    .orderBy(asc(lessonSections.orderIndex));
}

export async function getVocab(lessonId: string) {
  return db
    .select()
    .from(vocabItems)
    .where(eq(vocabItems.lessonId, lessonId))
    .orderBy(asc(vocabItems.orderIndex));
}

export async function getGrammar(lessonId: string) {
  return db
    .select()
    .from(grammarPoints)
    .where(eq(grammarPoints.lessonId, lessonId))
    .orderBy(asc(grammarPoints.orderIndex));
}

/**
 * Resolves `relatedIds` across lessons for the "You also saw this" strip.
 *
 * Returns a map from the referring point's id to the points it names, each
 * marked as earlier or later than the lesson being viewed so the strip can say
 * which direction the link goes.
 */
export async function getRelatedGrammar(
  points: Array<{ id: string; relatedIds: string[] }>,
  currentClassDate: string,
) {
  const wanted = [...new Set(points.flatMap((point) => point.relatedIds))];
  if (wanted.length === 0) return new Map<string, RelatedGrammarPoint[]>();

  const rows = await db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      lessonId: grammarPoints.lessonId,
      lessonNumber: lessons.lessonNumber,
      classDate: lessons.classDate,
    })
    .from(grammarPoints)
    .leftJoin(lessons, eq(lessons.id, grammarPoints.lessonId))
    .where(inArray(grammarPoints.id, wanted));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const result = new Map<string, RelatedGrammarPoint[]>();

  for (const point of points) {
    const resolved = point.relatedIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        id: row.id,
        title: row.title,
        lessonId: row.lessonId,
        lessonNumber: row.lessonNumber,
        earlier: (row.classDate ?? '') < currentClassDate,
      }));
    if (resolved.length > 0) result.set(point.id, resolved);
  }

  return result;
}

export type RelatedGrammarPoint = {
  id: string;
  title: string;
  lessonId: string;
  lessonNumber: number | null;
  earlier: boolean;
};

export async function getExercises(
  lessonId: string,
  scope: 'classwork' | 'homework' | 'quiz' | 'drill',
) {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.lessonId, lessonId), eq(exercises.scope, scope)))
    .orderBy(asc(exercises.orderIndex));
}

/** Counts driving the lesson overview checklist and the tab badges. */
export async function getLessonCounts(lessonId: string) {
  const [vocab] = await db
    .select({ n: count() })
    .from(vocabItems)
    .where(eq(vocabItems.lessonId, lessonId));
  const [grammar] = await db
    .select({ n: count() })
    .from(grammarPoints)
    .where(eq(grammarPoints.lessonId, lessonId));
  const [classwork] = await db
    .select({ n: count() })
    .from(exercises)
    .where(and(eq(exercises.lessonId, lessonId), eq(exercises.scope, 'classwork')));
  const [homework] = await db
    .select({ n: count() })
    .from(exercises)
    .where(and(eq(exercises.lessonId, lessonId), eq(exercises.scope, 'homework')));
  const [quiz] = await db
    .select({ n: count() })
    .from(quizzes)
    .where(eq(quizzes.lessonId, lessonId));

  return {
    vocabulary: vocab?.n ?? 0,
    grammar: grammar?.n ?? 0,
    classwork: classwork?.n ?? 0,
    homework: homework?.n ?? 0,
    quiz: quiz?.n ?? 0,
  };
}

/** Lesson numbers for the left rail, oldest first so the rail reads like tabs. */
export async function listLessonRail() {
  return db
    .select({
      slug: lessons.slug,
      lessonNumber: lessons.lessonNumber,
      title: lessons.title,
    })
    .from(lessons)
    .where(eq(lessons.publish, true))
    .orderBy(asc(lessons.classDate));
}

/** What a visitor can learn right now, counted over published lessons only. */
export async function getContentTotals() {
  const published = sql`(select ${lessons.id} from ${lessons} where ${lessons.publish})`;
  const [row] = await db
    .select({
      lessons: sql<number>`(select count(*)::int from ${lessons} where ${lessons.publish})`,
      words: sql<number>`(select count(*)::int from ${vocabItems} where ${vocabItems.lessonId} in ${published})`,
      rules: sql<number>`(select count(*)::int from ${grammarPoints} where ${grammarPoints.lessonId} in ${published})`,
      exercises: sql<number>`(select count(*)::int from ${exercises} where ${exercises.lessonId} in ${published})`,
    })
    .from(sql`(select 1) as one`);
  return row!;
}
