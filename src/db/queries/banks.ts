import { and, asc, desc, eq, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { grammarPoints, lessons, srsCards, vocabItems } from '@/db/schema';

/**
 * Global vocabulary and grammar banks — Section 10.
 *
 * Search uses the generated `search_tsv` column with the German text
 * configuration, so `Häuser` finds `Haus` and `spielte` finds `spielen`: the
 * German stemmer does the work that a LIKE query cannot.
 */

export type VocabFilters = {
  q?: string;
  gender?: string;
  pos?: string;
  tag?: string;
  level?: string;
  lesson?: string;
  due?: string;
};

export type VocabBankRow = {
  id: string;
  de: string;
  article: string;
  plural: string | null;
  pos: string;
  en: string;
  ur: string | null;
  cefr: string | null;
  tags: string[];
  lessonId: string;
  lessonNumber: number | null;
  reps: number | null;
  intervalDays: string | null;
  lapses: number | null;
  dueAt: Date | null;
};

export async function searchVocab(
  userId: string,
  filters: VocabFilters,
): Promise<VocabBankRow[]> {
  const where: SQL[] = [];

  if (filters.q?.trim()) {
    const query = filters.q.trim();
    /*
     * websearch_to_tsquery handles quoted phrases and OR the way a person
     * expects from a search box, and never throws on odd punctuation the way
     * to_tsquery does. The ILIKE arm catches prefixes the stemmer misses,
     * which matters for a learner typing the first few letters of a word.
     */
    where.push(
      sql`(${vocabItems.searchTsv} @@ websearch_to_tsquery('german', ${query})
           or ${vocabItems.de} ilike ${`${query}%`}
           or ${vocabItems.en} ilike ${`${query}%`})`,
    );
  }

  if (filters.gender) where.push(sql`${vocabItems.article}::text = ${filters.gender}`);
  if (filters.pos) where.push(sql`${vocabItems.pos}::text = ${filters.pos}`);
  if (filters.tag) where.push(sql`${filters.tag} = any(${vocabItems.tags})`);
  if (filters.level) where.push(eq(vocabItems.cefr, filters.level));
  if (filters.lesson) where.push(eq(vocabItems.lessonId, filters.lesson));

  const rows = await db
    .select({
      id: vocabItems.id,
      de: vocabItems.de,
      article: sql<string>`${vocabItems.article}::text`,
      plural: vocabItems.plural,
      pos: sql<string>`${vocabItems.pos}::text`,
      en: vocabItems.en,
      ur: vocabItems.ur,
      cefr: vocabItems.cefr,
      tags: vocabItems.tags,
      lessonId: vocabItems.lessonId,
      lessonNumber: lessons.lessonNumber,
      reps: srsCards.reps,
      intervalDays: srsCards.intervalDays,
      lapses: srsCards.lapses,
      dueAt: srsCards.dueAt,
    })
    .from(vocabItems)
    .leftJoin(lessons, eq(lessons.id, vocabItems.lessonId))
    /* Learner state is joined per user (Section 9.3), never shared. */
    .leftJoin(
      srsCards,
      and(
        eq(srsCards.itemId, vocabItems.id),
        eq(srsCards.itemType, 'vocab'),
        eq(srsCards.userId, userId),
      ),
    )
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(vocabItems.lessonId), asc(vocabItems.orderIndex))
    .limit(500);

  if (filters.due === 'due') {
    const now = new Date();
    return rows.filter((row) => row.dueAt !== null && row.dueAt <= now);
  }
  if (filters.due === 'new') {
    return rows.filter((row) => row.reps === null || row.reps === 0);
  }

  return rows;
}

/** Distinct values for the filter controls, so they only offer what exists. */
export async function getVocabFacets() {
  const [tags, levels, lessonList] = await Promise.all([
    db.execute<{ tag: string }>(
      sql`select distinct unnest(tags) as tag from vocab_items order by tag`,
    ),
    db.execute<{ cefr: string }>(
      sql`select distinct cefr from vocab_items where cefr is not null order by cefr`,
    ),
    db
      .select({
        id: lessons.id,
        lessonNumber: lessons.lessonNumber,
        title: lessons.title,
      })
      .from(lessons)
      .orderBy(asc(lessons.classDate)),
  ]);

  return {
    tags: tags.rows.map((r) => r.tag),
    levels: levels.rows.map((r) => r.cefr),
    lessons: lessonList,
  };
}

/**
 * Every grammar rule across every lesson — Section 10.
 *
 * Grouped by skill tag family so the progression across lessons is visible,
 * which is the point of the global index as opposed to the per-lesson one.
 */
export async function listGrammar(q?: string) {
  const where: SQL[] = [];

  if (q?.trim()) {
    const query = `%${q.trim()}%`;
    where.push(
      or(
        sql`${grammarPoints.title} ilike ${query}`,
        sql`${grammarPoints.ruleMd} ilike ${query}`,
        sql`exists (select 1 from unnest(${grammarPoints.skillTags}) t where t ilike ${query})`,
      )!,
    );
  }

  return db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      cefr: grammarPoints.cefr,
      ruleMd: grammarPoints.ruleMd,
      memoryHook: grammarPoints.memoryHook,
      skillTags: grammarPoints.skillTags,
      difficulty: grammarPoints.difficulty,
      lessonId: grammarPoints.lessonId,
      lessonNumber: lessons.lessonNumber,
      classDate: lessons.classDate,
    })
    .from(grammarPoints)
    .leftJoin(lessons, eq(lessons.id, grammarPoints.lessonId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(lessons.classDate), asc(grammarPoints.orderIndex));
}

export { desc, inArray, lte };
