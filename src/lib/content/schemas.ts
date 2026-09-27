/**
 * Zod schemas for the Lesson Content Contract — ARCHITECTURE.md Section 8.
 *
 * One schema set, two consumers: the ingest script and (later) Server Actions.
 *
 * Objects are `.strict()` on purpose. Section 0 rule 4 says a lesson file must
 * never need a field that does not exist here — an unknown key is a typo or a
 * contract change, and both should stop the run rather than be silently
 * dropped on the way into the database.
 *
 * The two deliberate exceptions are `given` and `answer`. Both land in `jsonb`
 * columns whose shape is decided by the exercise `type`: `match` carries
 * `{left, right}` with an array of pairs, `conjugate` carries
 * `{infinitive, persons}` with a person-keyed object, `mcq` carries
 * `{options}` with a string. Pinning 16 type-specific shapes here would make
 * the parser brittle for no gain; the grading engine narrows them per type.
 */
import { z } from 'zod';
import { isSkillTag } from '@/config/skills';

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Section 8.2: ids are lowercase kebab case, ASCII only, and never
 * auto-generated — a missing id is a hard error, because generated ids drift on
 * reorder and would silently reset spaced repetition scheduling.
 */
export const itemId = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'ids must be lowercase kebab-case ASCII (a-z, 0-9, single hyphens)',
  );

/**
 * Accepts a string or a Date and normalises to `YYYY-MM-DD`.
 *
 * Both forms genuinely occur: js-yaml 5's core schema leaves `2026-08-15` as a
 * string, while gray-matter bundles its own older js-yaml which resolves the
 * same scalar to a Date. The parser must not care which one it got.
 */
export const isoDate = z
  .union([z.string(), z.date()])
  .transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value.trim(),
  )
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date'));

export const skillTag = z.string().refine(isSkillTag, (value) => ({
  message: `unknown skill tag "${value}". Appendix A is the canonical list — add it to src/config/skills.ts and note it in CHANGELOG.md before using it.`,
}));

export const skillTags = z.array(skillTag).default([]);
const stringList = z.array(z.string()).default([]);

/** Empty strings are almost always an authoring slip, so they are rejected. */
const text = z.string().min(1);
const optionalText = z.string().min(1).nullish();

export const genderArticle = z.enum(['der', 'die', 'das', 'plural', 'none']);

export const partOfSpeech = z.enum([
  'noun',
  'verb',
  'adj',
  'adv',
  'prep',
  'conj',
  'pronoun',
  'numeral',
  'phrase',
  'particle',
]);

export const exerciseType = z.enum([
  'fill_blank',
  'mcq',
  'multi_select',
  'true_false',
  'match',
  'order_words',
  'translate_de_en',
  'translate_en_de',
  'transform',
  'conjugate',
  'gender_pick',
  'case_pick',
  'short_answer',
  'dialogue',
  'listening',
  'cloze',
  'four_forms',
]);

/** See the module comment: shape is type-dependent, so this stays open. */
const givenBlock = z.record(z.string(), z.unknown()).nullish();

const answerValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

/* -------------------------------------------------------------------------- */
/* 8.3 Frontmatter                                                             */
/* -------------------------------------------------------------------------- */

export const enhanceSchema = z
  .object({
    drills: z.number().int().nonnegative().optional(),
    quizQuestions: z.number().int().nonnegative().optional(),
    tone: z.enum(['exam', 'conversational']).optional(),
  })
  .strict();

export const frontmatterSchema = z
  .object({
    slug: text,
    lessonNumber: z.number().int().positive().nullish(),
    classDate: isoDate,
    level: text,
    course: optionalText,
    title: text,
    subtitle: optionalText,
    topics: stringList,
    prerequisites: stringList,
    durationMin: z.number().int().positive().nullish(),
    publish: z.boolean().default(true),
    enhance: enhanceSchema.nullish(),
  })
  .strict();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

/* -------------------------------------------------------------------------- */
/* 8.4 vocab                                                                   */
/* -------------------------------------------------------------------------- */

export const praesensSchema = z
  .object({
    ich: text,
    du: text,
    er: text,
    wir: text,
    ihr: text,
    sie: text,
  })
  .strict();

export const verbFormsSchema = z
  .object({
    regular: z.boolean().nullish(),
    separable: z.boolean().nullish(),
    aux: z.enum(['haben', 'sein']).nullish(),
    partizip2: optionalText,
    praesens: praesensSchema.nullish(),
    stemChange: optionalText,
    takesCase: z.enum(['nominativ', 'akkusativ', 'dativ', 'genitiv']).nullish(),
  })
  .strict();

/**
 * Records whether the author wrote a `plural` key at all.
 *
 * Rule 3.1 requires every noun to carry its plural, but German mass nouns —
 * Reis, Wasser, Brot — genuinely have none. Writing `plural: null` is the
 * author saying "considered, and there isn't one"; omitting the key entirely
 * is an oversight. Those must not be treated the same, so presence is captured
 * before Zod erases the difference.
 */
const withPluralDeclared = (raw: unknown) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const object = raw as Record<string, unknown>;
    return { ...object, pluralDeclared: 'plural' in object };
  }
  return raw;
};

export const vocabItemSchema = z.preprocess(
  withPluralDeclared,
  z
    .object({
      id: itemId,
      de: text,
      article: genderArticle.default('none'),
      plural: optionalText,
      /** Injected by the preprocess above; never written in a lesson file. */
      pluralDeclared: z.boolean().default(false),
      pos: partOfSpeech,
      en: text,
      ur: optionalText,
      ipa: optionalText,
      exampleDe: optionalText,
      exampleEn: optionalText,
      genderTip: optionalText,
      usageTip: optionalText,
      collocations: stringList,
      synonyms: stringList,
      antonyms: stringList,
      falseFriend: optionalText,
      register: z.string().default('neutral'),
      cefr: optionalText,
      verbForms: verbFormsSchema.nullish(),
      tags: stringList,
      srsEnabled: z.boolean().default(true),
    })
    .strict()
    .superRefine((item, ctx) => {
      // Rule 3.1: nouns are never shown bare, so the data must carry the pieces.
      if (item.pos === 'noun') {
        if (item.article === 'none') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['article'],
            message: `noun "${item.de}" needs an article (rule 3.1: nouns always render as article + noun + plural)`,
          });
        }
        if (!item.plural && !item.pluralDeclared) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['plural'],
            message: `noun "${item.de}" needs a plural (rule 3.1). If it is a mass noun with no plural, write "plural: null" to say so deliberately.`,
          });
        }
      }

      // Rule 3.2: verbs render with their conjugation and auxiliary.
      if (item.pos === 'verb') {
        if (!item.verbForms?.praesens) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['verbForms', 'praesens'],
            message: `verb "${item.de}" needs verbForms.praesens (rule 3.2)`,
          });
        }
        if (!item.verbForms?.aux) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['verbForms', 'aux'],
            message: `verb "${item.de}" needs verbForms.aux (rule 3.2)`,
          });
        }
      }
    }),
);

export type VocabItemInput = z.infer<typeof vocabItemSchema>;

/* -------------------------------------------------------------------------- */
/* 8.5 grammar                                                                 */
/* -------------------------------------------------------------------------- */

export const grammarTableSchema = z
  .object({
    caption: optionalText,
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())),
    /** [rowIndex, columnIndex] pairs of the cells that actually change. */
    highlight: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
    highlightNote: optionalText,
  })
  .strict()
  .superRefine((table, ctx) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows', index],
          message: `row ${index} has ${row.length} cells but the table declares ${table.columns.length} columns`,
        });
      }
    });
  });

export const caseChipSchema = z
  .object({
    text: text,
    case: z.enum(['NOM', 'AKK', 'DAT', 'GEN']),
  })
  .strict();

export const satzklammerSchema = z.object({ position2: text, ende: text }).strict();

export const tekamoloSegmentSchema = z
  .object({
    text: text,
    slot: z.enum(['temporal', 'kausal', 'modal', 'lokal']),
  })
  .strict();

export const grammarExampleSchema = z
  .object({
    de: text,
    en: optionalText,
    note: optionalText,
    cases: z.array(caseChipSchema).nullish(),
    satzklammer: satzklammerSchema.nullish(),
    tekamolo: z.array(tekamoloSegmentSchema).nullish(),
  })
  .strict();

export const commonMistakeSchema = z
  .object({ wrong: text, right: text, why: text })
  .strict();

export const grammarPointSchema = z
  .object({
    id: itemId,
    title: text,
    cefr: optionalText,
    skillTags,
    difficulty: z.number().int().min(1).max(5).default(2),
    rule: text,
    pattern: optionalText,
    tables: z.array(grammarTableSchema).default([]),
    examples: z.array(grammarExampleSchema).default([]),
    contrast: optionalText,
    commonMistakes: z.array(commonMistakeSchema).default([]),
    tips: stringList,
    memoryHook: optionalText,
    relatedIds: stringList,
  })
  .strict();

export type GrammarPointInput = z.infer<typeof grammarPointSchema>;

/* -------------------------------------------------------------------------- */
/* 8.6 / 8.7 classwork and homework                                            */
/* -------------------------------------------------------------------------- */

export const hintSchema = z
  .object({
    level: z.number().int().min(1).max(3),
    text: text,
  })
  .strict();

/**
 * Rule 3.6: no exercise is complete without the solution, the reason and a
 * portable rule, so all three are required rather than optional. The UI is
 * forbidden from showing a solution without its reason, which is only
 * guaranteeable if the data always carries one.
 */
/** Section 8.3: generated items are marked so they are distinguishable. */
export const contentSource = z.enum(['authored', 'generated']).default('authored');

const exerciseBase = {
  id: itemId,
  type: exerciseType,
  prompt: text,
  source: contentSource,
  /** Spelled `instructionMd` in the files, matching the column it lands in. */
  instructionMd: optionalText,
  given: givenBlock,
  answer: answerValue,
  accept: z.array(z.unknown()).nullish(),
  solution: text,
  why: text,
  takeaway: text,
  tips: stringList,
  skillTags,
  vocabRefs: stringList,
  grammarRefs: stringList,
  difficulty: z.number().int().min(1).max(5).default(2),
  points: z.number().int().positive().default(1),
};

export const classworkItemSchema = z.object(exerciseBase).strict();

export const homeworkItemSchema = z
  .object({
    ...exerciseBase,
    dueDate: isoDate.nullish(),
    revealPolicy: z
      .enum(['on_request', 'after_attempts', 'after_due'])
      .default('on_request'),
    hints: z.array(hintSchema).default([]),
  })
  .strict()
  .superRefine((item, ctx) => {
    const levels = item.hints.map((hint) => hint.level);
    if (new Set(levels).size !== levels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hints'],
        message: `duplicate hint levels [${levels.join(', ')}] — levels 1, 2 and 3 mean fixed things (Section 8.7)`,
      });
    }
  });

export type ClassworkItemInput = z.infer<typeof classworkItemSchema>;
export type HomeworkItemInput = z.infer<typeof homeworkItemSchema>;

/* -------------------------------------------------------------------------- */
/* 8.8 quiz                                                                    */
/* -------------------------------------------------------------------------- */

export const quizQuestionSchema = z
  .object({
    id: itemId,
    type: exerciseType,
    prompt: text,
    source: contentSource,
    instructionMd: optionalText,
    given: givenBlock,
    answer: answerValue,
    accept: z.array(z.unknown()).nullish(),
    /** Quiz questions carry a single hint and an explanation, not the trio. */
    hint: optionalText,
    explanation: text,
    solution: optionalText,
    takeaway: optionalText,
    tips: stringList,
    skillTags,
    vocabRefs: stringList,
    grammarRefs: stringList,
    difficulty: z.number().int().min(1).max(5).default(2),
    points: z.number().int().positive().default(1),
  })
  .strict();

export const quizSchema = z
  .object({
    id: itemId,
    title: text,
    kind: z.enum(['practice', 'graded', 'review']).default('practice'),
    timeLimitSec: z.number().int().positive().nullish(),
    passScore: z.number().int().min(0).max(100).default(70),
    shuffle: z.boolean().default(true),
    description: optionalText,
    questions: z.array(quizQuestionSchema).min(1),
  })
  .strict();

export type QuizInput = z.infer<typeof quizSchema>;

/* -------------------------------------------------------------------------- */
/* 8.9 errors                                                                  */
/* -------------------------------------------------------------------------- */

export const errorItemSchema = z
  .object({
    id: itemId,
    got: text,
    expected: text,
    why: optionalText,
    skillTags,
    drill: z.boolean().default(false),
  })
  .strict();

export type ErrorItemInput = z.infer<typeof errorItemSchema>;

/* -------------------------------------------------------------------------- */
/* Block registry                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Extra practice items, usually produced by an `enhance` pass and written back
 * below the `<!-- generated:start -->` marker. Same shape as classwork; they
 * land with `scope='drill'` so they never mix into the class replay.
 */
export const drillItemSchema = classworkItemSchema;

export const BLOCK_SCHEMAS = {
  vocab: z.array(vocabItemSchema),
  grammar: z.array(grammarPointSchema),
  classwork: z.array(classworkItemSchema),
  homework: z.array(homeworkItemSchema),
  drills: z.array(drillItemSchema),
  quiz: z.array(quizSchema),
  errors: z.array(errorItemSchema),
} as const;

export type BlockType = keyof typeof BLOCK_SCHEMAS;

export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];

export function isBlockType(value: string): value is BlockType {
  return value in BLOCK_SCHEMAS;
}
