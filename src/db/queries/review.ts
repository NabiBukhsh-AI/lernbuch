import { and, asc, desc, eq, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  grammarPoints,
  lessons,
  mistakes,
  srsCards,
  users,
  vocabItems,
} from '@/db/schema';
import type { SrsState } from '@/lib/srs/scheduler';

/**
 * Review queue construction — ARCHITECTURE.md Section 13.
 *
 *   1. mistakes with origin='class', unresolved, capped at 5 per session
 *   2. cards due now, oldest first, capped at users.dailyGoal
 *   3. new cards from the most recent lesson, filling the remainder, cap 10
 */

export type ReviewCard = {
  /** Unique within a session; a noun contributes both a meaning and a gender card. */
  key: string;
  kind: 'mistake' | 'vocab' | 'grammar';
  itemType: 'vocab' | 'grammar' | 'phrase';
  itemId: string;
  front: string;
  frontLang: 'de' | 'en';
  back: string;
  backLang: 'de' | 'en';
  note: string | null;
  /** null for class-mistake drills, which are not SM-2 scheduled. */
  state: SrsState | null;
  mistakeId?: string;
  prompt: string;
};

const CLASS_MISTAKE_CAP = 5;
const NEW_CARD_CAP = 10;

export async function buildReviewQueue(userId: string): Promise<ReviewCard[]> {
  const [user] = await db
    .select({ dailyGoal: users.dailyGoal, showUrdu: users.showUrdu })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const dailyGoal = user?.dailyGoal ?? 20;
  const queue: ReviewCard[] = [];

  /* ---- 1. class mistakes, prioritised ---------------------------------- */
  const classMistakes = await db
    .select()
    .from(mistakes)
    .where(
      and(
        eq(mistakes.userId, userId),
        eq(mistakes.origin, 'class'),
        eq(mistakes.resolved, false),
      ),
    )
    .orderBy(asc(mistakes.createdAt))
    .limit(CLASS_MISTAKE_CAP);

  for (const mistake of classMistakes) {
    queue.push({
      key: `mistake:${mistake.id}`,
      kind: 'mistake',
      itemType: 'phrase',
      itemId: mistake.id,
      prompt: 'Correct the sentence',
      front: mistake.got,
      frontLang: 'de',
      back: mistake.expected,
      backLang: 'de',
      note: mistake.noteMd,
      state: null,
      mistakeId: mistake.id,
    });
  }

  /* ---- 2. cards due now ------------------------------------------------ */
  const due = await db
    .select()
    .from(srsCards)
    .where(
      and(
        eq(srsCards.userId, userId),
        eq(srsCards.suspended, false),
        lte(srsCards.dueAt, new Date()),
      ),
    )
    .orderBy(asc(srsCards.dueAt))
    .limit(dailyGoal);

  const vocabIds = due.filter((c) => c.itemType === 'vocab').map((c) => c.itemId);
  const grammarIds = due.filter((c) => c.itemType === 'grammar').map((c) => c.itemId);

  const vocabRows = vocabIds.length
    ? await db.select().from(vocabItems).where(inArray(vocabItems.id, vocabIds))
    : [];
  const grammarRows = grammarIds.length
    ? await db.select().from(grammarPoints).where(inArray(grammarPoints.id, grammarIds))
    : [];

  const vocabById = new Map(vocabRows.map((row) => [row.id, row]));
  const grammarById = new Map(grammarRows.map((row) => [row.id, row]));

  for (const card of due) {
    const state: SrsState = {
      ease: Number(card.ease),
      intervalDays: Number(card.intervalDays),
      reps: card.reps,
      lapses: card.lapses,
    };

    if (card.itemType === 'vocab') {
      const item = vocabById.get(card.itemId);
      if (item) queue.push(vocabCard(item, state));
    } else if (card.itemType === 'grammar') {
      const point = grammarById.get(card.itemId);
      if (point) queue.push(grammarCard(point, state));
    }
  }

  /* ---- 3. new cards from the most recent lesson ------------------------ */
  const remainder = Math.max(0, Math.min(NEW_CARD_CAP, dailyGoal - queue.length));

  if (remainder > 0) {
    const [latest] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.publish, true))
      .orderBy(desc(lessons.classDate))
      .limit(1);

    if (latest) {
      const seen = await db
        .select({ itemId: srsCards.itemId })
        .from(srsCards)
        .where(and(eq(srsCards.userId, userId), eq(srsCards.itemType, 'vocab')));
      const seenIds = seen.map((row) => row.itemId);

      const fresh = await db
        .select()
        .from(vocabItems)
        .where(
          and(
            eq(vocabItems.lessonId, latest.id),
            eq(vocabItems.srsEnabled, true),
            seenIds.length ? notInArray(vocabItems.id, seenIds) : sql`true`,
          ),
        )
        .orderBy(asc(vocabItems.orderIndex))
        .limit(remainder);

      for (const item of fresh) {
        queue.push(vocabCard(item, null));
      }
    }
  }

  return queue;
}

type VocabRow = typeof vocabItems.$inferSelect;
type GrammarRow = typeof grammarPoints.$inferSelect;

/**
 * Section 13: vocabulary alternates German to English and English to German by
 * `reps % 2`, and nouns additionally get a gender-only card — "the single
 * highest value drill in early German".
 *
 * The gender card is produced by picking it for even reps of a noun, so a noun
 * cycles meaning, gender, meaning, gender rather than doubling the queue.
 */
function vocabCard(item: VocabRow, state: SrsState | null): ReviewCard {
  const reps = state?.reps ?? 0;
  const isNoun = item.pos === 'noun' && item.article !== 'none';

  if (isNoun && reps % 2 === 1) {
    return {
      key: `vocab:${item.id}:gender`,
      kind: 'vocab',
      itemType: 'vocab',
      itemId: item.id,
      prompt: 'Which article?',
      front: item.de,
      frontLang: 'de',
      back: `${item.article} ${item.de}${item.plural ? `, die ${item.plural}` : ''}`,
      backLang: 'de',
      note: item.genderTip,
      state,
    };
  }

  const germanFirst = reps % 2 === 0;

  return germanFirst
    ? {
        key: `vocab:${item.id}:de-en`,
        kind: 'vocab',
        itemType: 'vocab',
        itemId: item.id,
        prompt: 'What does this mean?',
        front: isNoun ? `${item.article} ${item.de}` : item.de,
        frontLang: 'de',
        back: item.en,
        backLang: 'en',
        note: item.usageTip,
        state,
      }
    : {
        key: `vocab:${item.id}:en-de`,
        kind: 'vocab',
        itemType: 'vocab',
        itemId: item.id,
        prompt: 'Say it in German',
        front: item.en,
        frontLang: 'en',
        back: isNoun ? `${item.article} ${item.de}` : item.de,
        backLang: 'de',
        note: item.usageTip,
        state,
      };
}

/**
 * Section 13: the grammar front is the memory hook, or a cloze generated from
 * an example when the point has no hook authored.
 */
function grammarCard(point: GrammarRow, state: SrsState | null): ReviewCard {
  if (point.memoryHook) {
    return {
      key: `grammar:${point.id}`,
      kind: 'grammar',
      itemType: 'grammar',
      itemId: point.id,
      prompt: 'Recall the rule',
      front: point.memoryHook,
      frontLang: 'en',
      back: point.title,
      backLang: 'de',
      note: null,
      state,
    };
  }

  const examples = (point.examples ?? []) as Array<{ de?: string; en?: string }>;
  const example = examples.find((entry) => entry.de);

  if (example?.de) {
    // Blank the longest word: the most contentful one, and never a bare article.
    const words = example.de.split(' ');
    const target = words.reduce((a, b) => (b.length > a.length ? b : a), '');
    return {
      key: `grammar:${point.id}`,
      kind: 'grammar',
      itemType: 'grammar',
      itemId: point.id,
      prompt: 'Fill the gap',
      front: example.de.replace(target, '___'),
      frontLang: 'de',
      back: example.de,
      backLang: 'de',
      note: example.en ?? null,
      state,
    };
  }

  return {
    key: `grammar:${point.id}`,
    kind: 'grammar',
    itemType: 'grammar',
    itemId: point.id,
    prompt: 'Recall the rule',
    front: point.title,
    frontLang: 'de',
    back: point.ruleMd.slice(0, 300),
    backLang: 'en',
    note: null,
    state,
  };
}

/** Counts for the dashboard and /review header. */
export async function getDueCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(srsCards)
    .where(
      and(
        eq(srsCards.userId, userId),
        eq(srsCards.suspended, false),
        lte(srsCards.dueAt, new Date()),
      ),
    );
  return row?.n ?? 0;
}

export async function getUnresolvedClassMistakes(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mistakes)
    .where(
      and(
        eq(mistakes.userId, userId),
        eq(mistakes.origin, 'class'),
        eq(mistakes.resolved, false),
      ),
    );
  return row?.n ?? 0;
}

export { isNull };
