/**
 * Idempotent upsert of a parsed lesson — ARCHITECTURE.md Section 8.12.
 *
 *   BEGIN
 *     upsert lesson
 *     upsert every item by composed id
 *     delete content rows for this lesson whose id is absent from the file
 *   COMMIT
 *
 * Content ids are permanent (Section 0 rule 5): re-ingesting updates rows in
 * place, never duplicates them, and never touches learner state. Learner rows
 * that referenced removed content survive via the ON DELETE SET NULL / no-FK
 * arrangement in Section 7.5.
 */
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import {
  exercises,
  grammarPoints,
  lessonSections,
  lessons,
  mistakes,
  quizzes,
  users,
  vocabItems,
} from '@/db/schema';
import * as schema from '@/db/schema';
import { composeId } from './parser';
import type { ParsedLesson } from './parser';

export type BlockStats = { created: number; updated: number; removed: number };

export type IngestStats = {
  sections: BlockStats;
  vocab: BlockStats;
  grammar: BlockStats;
  quizzes: BlockStats;
  classwork: BlockStats;
  homework: BlockStats;
  drills: BlockStats;
  quizQuestions: BlockStats;
  mistakes: BlockStats;
};

const emptyStats = (): BlockStats => ({ created: 0, updated: 0, removed: 0 });

type Db = NeonDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function diff(existing: Set<string>, desired: string[]): BlockStats {
  let created = 0;
  let updated = 0;
  for (const id of desired) {
    if (existing.has(id)) updated++;
    else created++;
  }
  return { created, updated, removed: existing.size - updated };
}

export async function upsertLesson(db: Db, parsed: ParsedLesson): Promise<IngestStats> {
  return db.transaction(async (tx) => {
    const stats: IngestStats = {
      sections: emptyStats(),
      vocab: emptyStats(),
      grammar: emptyStats(),
      quizzes: emptyStats(),
      classwork: emptyStats(),
      homework: emptyStats(),
      drills: emptyStats(),
      quizQuestions: emptyStats(),
      mistakes: emptyStats(),
    };

    const fm = parsed.frontmatter;
    const lessonId = parsed.slug;

    /* ---- lesson --------------------------------------------------------- */
    await tx
      .insert(lessons)
      .values({
        id: lessonId,
        slug: parsed.slug,
        lessonNumber: fm.lessonNumber ?? null,
        classDate: fm.classDate,
        level: fm.level,
        course: fm.course ?? null,
        title: fm.title,
        subtitle: fm.subtitle ?? null,
        topics: fm.topics,
        prerequisites: fm.prerequisites,
        durationMin: fm.durationMin ?? null,
        publish: fm.publish,
        fileHash: parsed.fileHash,
      })
      .onConflictDoUpdate({
        target: lessons.id,
        set: {
          lessonNumber: fm.lessonNumber ?? null,
          classDate: fm.classDate,
          level: fm.level,
          course: fm.course ?? null,
          title: fm.title,
          subtitle: fm.subtitle ?? null,
          topics: fm.topics,
          prerequisites: fm.prerequisites,
          durationMin: fm.durationMin ?? null,
          // `publish` is deliberately absent: after creation, visibility is
          // controlled from the admin panel, and a re-upload must not undo it.
          fileHash: parsed.fileHash,
          ingestedAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      });

    /* ---- sections ------------------------------------------------------- */
    {
      const existing = new Set(
        (
          await tx
            .select({ id: lessonSections.id })
            .from(lessonSections)
            .where(eq(lessonSections.lessonId, lessonId))
        ).map((row) => row.id),
      );
      const desired = parsed.sections.map((section) => section.id);
      stats.sections = diff(existing, desired);

      for (const section of parsed.sections) {
        await tx
          .insert(lessonSections)
          .values({
            id: section.id,
            lessonId,
            kind: section.kind,
            orderIndex: section.orderIndex,
            title: section.title,
            bodyMd: section.bodyMd,
          })
          .onConflictDoUpdate({
            target: lessonSections.id,
            set: {
              kind: section.kind,
              orderIndex: section.orderIndex,
              title: section.title,
              bodyMd: section.bodyMd,
            },
          });
      }
      await deleteAbsent(
        tx,
        lessonSections,
        lessonSections.lessonId,
        lessonSections.id,
        lessonId,
        desired,
      );
    }

    /* ---- vocab ---------------------------------------------------------- */
    {
      const existing = new Set(
        (
          await tx
            .select({ id: vocabItems.id })
            .from(vocabItems)
            .where(eq(vocabItems.lessonId, lessonId))
        ).map((row) => row.id),
      );
      const desired = parsed.vocab.map((item) =>
        composeId(parsed.slug, 'vocab', item.id),
      );
      stats.vocab = diff(existing, desired);

      for (const [index, item] of parsed.vocab.entries()) {
        const values = {
          id: composeId(parsed.slug, 'vocab', item.id),
          lessonId,
          orderIndex: index,
          de: item.de,
          article: item.article,
          plural: item.plural ?? null,
          pos: item.pos,
          en: item.en,
          ur: item.ur ?? null,
          ipa: item.ipa ?? null,
          exampleDe: item.exampleDe ?? null,
          exampleEn: item.exampleEn ?? null,
          genderTip: item.genderTip ?? null,
          usageTip: item.usageTip ?? null,
          collocations: item.collocations,
          synonyms: item.synonyms,
          antonyms: item.antonyms,
          falseFriend: item.falseFriend ?? null,
          register: item.register,
          cefr: item.cefr ?? null,
          verbForms: item.verbForms ?? null,
          tags: item.tags,
          srsEnabled: item.srsEnabled,
        };
        await tx
          .insert(vocabItems)
          .values(values)
          .onConflictDoUpdate({ target: vocabItems.id, set: stripId(values) });
      }
      await deleteAbsent(
        tx,
        vocabItems,
        vocabItems.lessonId,
        vocabItems.id,
        lessonId,
        desired,
      );
    }

    /* ---- grammar -------------------------------------------------------- */
    {
      const existing = new Set(
        (
          await tx
            .select({ id: grammarPoints.id })
            .from(grammarPoints)
            .where(eq(grammarPoints.lessonId, lessonId))
        ).map((row) => row.id),
      );
      const desired = parsed.grammar.map((item) =>
        composeId(parsed.slug, 'grammar', item.id),
      );
      stats.grammar = diff(existing, desired);

      for (const [index, item] of parsed.grammar.entries()) {
        const values = {
          id: composeId(parsed.slug, 'grammar', item.id),
          lessonId,
          orderIndex: index,
          title: item.title,
          cefr: item.cefr ?? null,
          ruleMd: item.rule,
          patternMd: item.pattern ?? null,
          tables: item.tables,
          examples: item.examples,
          contrastMd: item.contrast ?? null,
          commonMistakes: item.commonMistakes,
          tips: item.tips,
          memoryHook: item.memoryHook ?? null,
          skillTags: item.skillTags,
          relatedIds: item.relatedIds,
          difficulty: item.difficulty,
        };
        await tx
          .insert(grammarPoints)
          .values(values)
          .onConflictDoUpdate({ target: grammarPoints.id, set: stripId(values) });
      }
      await deleteAbsent(
        tx,
        grammarPoints,
        grammarPoints.lessonId,
        grammarPoints.id,
        lessonId,
        desired,
      );
    }

    /* ---- quizzes -------------------------------------------------------- */
    {
      const existing = new Set(
        (
          await tx
            .select({ id: quizzes.id })
            .from(quizzes)
            .where(eq(quizzes.lessonId, lessonId))
        ).map((row) => row.id),
      );
      const desired = parsed.quizzes.map((quiz) =>
        composeId(parsed.slug, 'quiz', quiz.id),
      );
      stats.quizzes = diff(existing, desired);

      for (const quiz of parsed.quizzes) {
        const values = {
          id: composeId(parsed.slug, 'quiz', quiz.id),
          lessonId,
          title: quiz.title,
          kind: quiz.kind,
          timeLimitSec: quiz.timeLimitSec ?? null,
          passScore: quiz.passScore,
          shuffle: quiz.shuffle,
          description: quiz.description ?? null,
        };
        await tx
          .insert(quizzes)
          .values(values)
          .onConflictDoUpdate({ target: quizzes.id, set: stripId(values) });
      }
      // Deleted after exercises, so a removed quiz does not cascade its
      // questions away before their own orphan pass has run.
    }

    /* ---- exercises: classwork, homework, quiz questions ------------------ */
    {
      const existingRows = await tx
        .select({ id: exercises.id, scope: exercises.scope })
        .from(exercises)
        .where(eq(exercises.lessonId, lessonId));

      const existingByScope = {
        classwork: new Set<string>(),
        homework: new Set<string>(),
        quiz: new Set<string>(),
        drill: new Set<string>(),
      };
      for (const row of existingRows) existingByScope[row.scope].add(row.id);

      const desiredAll: string[] = [];

      // classwork
      const cwIds = parsed.classwork.map((item) =>
        composeId(parsed.slug, 'classwork', item.id),
      );
      stats.classwork = diff(existingByScope.classwork, cwIds);
      desiredAll.push(...cwIds);
      for (const [index, item] of parsed.classwork.entries()) {
        const values = {
          id: composeId(parsed.slug, 'classwork', item.id),
          lessonId,
          quizId: null,
          scope: 'classwork' as const,
          orderIndex: index,
          type: item.type,
          promptMd: item.prompt,
          instructionMd: item.instructionMd ?? null,
          given: item.given ?? null,
          answer: item.answer,
          accept: item.accept ?? null,
          solutionMd: item.solution,
          whyMd: item.why,
          takeawayMd: item.takeaway,
          tips: item.tips,
          hints: null,
          skillTags: item.skillTags,
          vocabRefs: item.vocabRefs,
          grammarRefs: item.grammarRefs,
          difficulty: item.difficulty,
          points: item.points,
          dueDate: null,
          revealPolicy: 'on_request',
          source: item.source,
        };
        await tx
          .insert(exercises)
          .values(values)
          .onConflictDoUpdate({ target: exercises.id, set: stripId(values) });
      }

      // homework
      const hwIds = parsed.homework.map((item) =>
        composeId(parsed.slug, 'homework', item.id),
      );
      stats.homework = diff(existingByScope.homework, hwIds);
      desiredAll.push(...hwIds);
      for (const [index, item] of parsed.homework.entries()) {
        const values = {
          id: composeId(parsed.slug, 'homework', item.id),
          lessonId,
          quizId: null,
          scope: 'homework' as const,
          orderIndex: index,
          type: item.type,
          promptMd: item.prompt,
          instructionMd: item.instructionMd ?? null,
          given: item.given ?? null,
          answer: item.answer,
          accept: item.accept ?? null,
          solutionMd: item.solution,
          whyMd: item.why,
          takeawayMd: item.takeaway,
          tips: item.tips,
          hints: item.hints,
          skillTags: item.skillTags,
          vocabRefs: item.vocabRefs,
          grammarRefs: item.grammarRefs,
          difficulty: item.difficulty,
          points: item.points,
          dueDate: item.dueDate ?? null,
          revealPolicy: item.revealPolicy,
          source: item.source,
        };
        await tx
          .insert(exercises)
          .values(values)
          .onConflictDoUpdate({ target: exercises.id, set: stripId(values) });
      }

      // drills — generated extra practice, kept out of the class replay
      const drillIds = parsed.drills.map((item) =>
        composeId(parsed.slug, 'drills', item.id),
      );
      stats.drills = diff(existingByScope.drill, drillIds);
      desiredAll.push(...drillIds);
      for (const [index, item] of parsed.drills.entries()) {
        const values = {
          id: composeId(parsed.slug, 'drills', item.id),
          lessonId,
          quizId: null,
          scope: 'drill' as const,
          orderIndex: index,
          type: item.type,
          promptMd: item.prompt,
          instructionMd: item.instructionMd ?? null,
          given: item.given ?? null,
          answer: item.answer,
          accept: item.accept ?? null,
          solutionMd: item.solution,
          whyMd: item.why,
          takeawayMd: item.takeaway,
          tips: item.tips,
          hints: null,
          skillTags: item.skillTags,
          vocabRefs: item.vocabRefs,
          grammarRefs: item.grammarRefs,
          difficulty: item.difficulty,
          points: item.points,
          dueDate: null,
          revealPolicy: 'on_request',
          source: item.source,
        };
        await tx
          .insert(exercises)
          .values(values)
          .onConflictDoUpdate({ target: exercises.id, set: stripId(values) });
      }

      // quiz questions
      const questionIds: string[] = [];
      for (const quiz of parsed.quizzes) {
        for (const [index, question] of quiz.questions.entries()) {
          const id = composeId(parsed.slug, 'quiz', question.id);
          questionIds.push(id);
          const values = {
            id,
            lessonId,
            quizId: composeId(parsed.slug, 'quiz', quiz.id),
            scope: 'quiz' as const,
            orderIndex: index,
            type: question.type,
            promptMd: question.prompt,
            instructionMd: question.instructionMd ?? null,
            given: question.given ?? null,
            answer: question.answer,
            accept: question.accept ?? null,
            solutionMd: question.solution ?? null,
            /* Section 8.8 calls this `explanation`; it plays the role of `why`. */
            whyMd: question.explanation,
            takeawayMd: question.takeaway ?? null,
            tips: question.tips,
            hints: question.hint ? [{ level: 1, text: question.hint }] : null,
            skillTags: question.skillTags,
            vocabRefs: question.vocabRefs,
            grammarRefs: question.grammarRefs,
            difficulty: question.difficulty,
            points: question.points,
            dueDate: null,
            revealPolicy: 'on_request',
            source: question.source,
          };
          await tx
            .insert(exercises)
            .values(values)
            .onConflictDoUpdate({ target: exercises.id, set: stripId(values) });
        }
      }
      stats.quizQuestions = diff(existingByScope.quiz, questionIds);
      desiredAll.push(...questionIds);

      /*
       * Drills now arrive from the file like everything else, in a `drills`
       * block below the generated marker, so they take part in the orphan pass
       * rather than being exempted from it. Deleting a drill from the file is
       * meant to remove it.
       */
      if (desiredAll.length > 0) {
        await tx
          .delete(exercises)
          .where(
            and(eq(exercises.lessonId, lessonId), notInArray(exercises.id, desiredAll)),
          );
      } else {
        await tx.delete(exercises).where(eq(exercises.lessonId, lessonId));
      }
    }

    // Safe now that no exercise references a removed quiz.
    {
      const desired = parsed.quizzes.map((quiz) =>
        composeId(parsed.slug, 'quiz', quiz.id),
      );
      await deleteAbsent(tx, quizzes, quizzes.lessonId, quizzes.id, lessonId, desired);
    }

    /* ---- errors -> mistakes (Section 8.9) -------------------------------- */
    if (parsed.errors.length > 0) {
      /*
       * `mistakes` is learner state, one row per user, and it has no natural
       * unique key. Re-ingesting must not pile up duplicates, so existing
       * class-origin rows for this lesson are matched on (expected, got).
       *
       * Rows are never removed here: an error dropped from the file is still
       * something that was got wrong in class, and Section 7.5 keeps learner
       * history even when the content behind it goes away.
       *
       * Only the admin receives them: they are the mistakes made in the admin's
       * own class, not something every public learner got wrong.
       */
      const allUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      const existing = await tx
        .select({
          userId: mistakes.userId,
          expected: mistakes.expected,
          got: mistakes.got,
        })
        .from(mistakes)
        .where(and(eq(mistakes.lessonId, lessonId), eq(mistakes.origin, 'class')));

      const seen = new Set(
        existing.map((row) => JSON.stringify([row.userId, row.expected, row.got])),
      );

      for (const user of allUsers) {
        for (const item of parsed.errors) {
          const key = JSON.stringify([user.id, item.expected, item.got]);
          if (seen.has(key)) {
            stats.mistakes.updated++;
            continue;
          }
          await tx.insert(mistakes).values({
            userId: user.id,
            lessonId,
            exerciseId: null,
            skillTags: item.skillTags,
            expected: item.expected,
            got: item.got,
            noteMd: item.why ?? null,
            origin: 'class',
          });
          stats.mistakes.created++;
        }
      }
    }

    return stats;
  });
}

/** Drops `id` from an upsert payload; the conflict target must not be re-set. */
function stripId<T extends { id: string }>(values: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = values;
  return rest;
}

async function deleteAbsent(
  tx: Tx,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lessonColumn: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idColumn: any,
  lessonId: string,
  desired: string[],
): Promise<void> {
  if (desired.length > 0) {
    await tx
      .delete(table)
      .where(and(eq(lessonColumn, lessonId), notInArray(idColumn, desired)));
  } else {
    await tx.delete(table).where(eq(lessonColumn, lessonId));
  }
}

export { inArray };
