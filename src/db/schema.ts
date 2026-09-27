/**
 * Deutschbuch database schema — ARCHITECTURE.md Section 7.
 *
 * Two families of tables live here and they follow opposite deletion rules:
 *
 *   Content tables  (lessons, lessonSections, vocabItems, grammarPoints,
 *                    exercises, quizzes) cascade from `lessons`. Re-ingesting a
 *                    lesson rewrites them.
 *
 *   Learner tables  (attempts, submissions, srsCards, mistakes, progress, ...)
 *                    never cascade from content. Content references degrade to
 *                    NULL so deleting or renaming a lesson can never destroy
 *                    progress or review history. See Section 7.5.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Postgres `tsvector`. Drizzle has no first-class type for it, so the column is
 * declared through customType and populated by a generated expression.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

/* -------------------------------------------------------------------------- */
/* 7.1 Enums                                                                   */
/* -------------------------------------------------------------------------- */

export const genderEnum = pgEnum('gender', ['der', 'die', 'das', 'plural', 'none']);
export const posEnum = pgEnum('pos', [
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
export const sectionKindEnum = pgEnum('section_kind', [
  'overview',
  'pronunciation',
  'culture',
  'notes',
  'takeaways',
]);
export const exerciseTypeEnum = pgEnum('exercise_type', [
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
  /**
   * Lektion 02: one sentence in its four shapes — Aussage, Verneinung, Frage,
   * verneinte Frage. Graded a row at a time, a point per row.
   */
  'four_forms',
]);
export const exerciseScopeEnum = pgEnum('exercise_scope', [
  'classwork',
  'homework',
  'quiz',
  'drill',
]);
export const quizKindEnum = pgEnum('quiz_kind', ['practice', 'graded', 'review']);
export const srsItemEnum = pgEnum('srs_item', ['vocab', 'grammar', 'phrase']);
export const srsGradeEnum = pgEnum('srs_grade', ['again', 'hard', 'good', 'easy']);
export const statusEnum = pgEnum('lesson_status', [
  'not_started',
  'in_progress',
  'completed',
  'mastered',
]);
export const roleEnum = pgEnum('role', ['admin', 'learner']);
export const sourceEnum = pgEnum('content_source', ['authored', 'generated']);

/* -------------------------------------------------------------------------- */
/* 7.2 Users                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Anyone can sign up as a `learner`. Exactly one `admin` exists, created by
 * `pnpm seed:admin` from the environment and never through the signup form;
 * the partial unique index makes a second admin impossible at the database
 * level rather than by convention.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** lower-case, [a-z0-9_] */
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: roleEnum('role').notNull().default('learner'),
    targetLevel: text('target_level').default('A1.1'),
    dailyGoal: integer('daily_goal').notNull().default(20),
    strictMode: boolean('strict_mode').notNull().default(false),
    showUrdu: boolean('show_urdu').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Set by the admin. A suspended user cannot sign in or act. */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_single_admin_uq')
      .on(t.role)
      .where(sql`${t.role} = 'admin'`),
  ],
);

/**
 * Fixed-window rate limiting for login and signup. Neon is the only datastore,
 * so the counters live here rather than in Redis.
 *
 * `key` is a namespaced string such as `login:<username>` or `signup:<ip>`,
 * deliberately not a foreign key: attempts against a username that does not
 * exist must still count, or the limiter could be bypassed by probing.
 */
export const rateLimitEvents = pgTable(
  'rate_limit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_limit_events_key_time_idx').on(t.key, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* 7.3 Content tables                                                          */
/* -------------------------------------------------------------------------- */

export const lessons = pgTable(
  'lessons',
  {
    /** = slug */
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    lessonNumber: integer('lesson_number'),
    classDate: date('class_date').notNull(),
    /** 'A1.1' */
    level: text('level').notNull(),
    course: text('course'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    summaryMd: text('summary_md'),
    topics: text('topics')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** lesson slugs */
    prerequisites: text('prerequisites')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    durationMin: integer('duration_min'),
    publish: boolean('publish').notNull().default(true),
    /** sha256 of source md */
    fileHash: text('file_hash').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lessons_class_date_idx').on(t.classDate.desc())],
);

export const lessonSections = pgTable('lesson_sections', {
  /** '<lesson>:sec:<slug>' */
  id: text('id').primaryKey(),
  lessonId: text('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  kind: sectionKindEnum('kind').notNull(),
  orderIndex: integer('order_index').notNull(),
  title: text('title'),
  bodyMd: text('body_md').notNull(),
  tipsMd: text('tips_md'),
});

export const vocabItems = pgTable(
  'vocab_items',
  {
    /** '<lesson>:vocab:<id>' */
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    /** headword, no article */
    de: text('de').notNull(),
    article: genderEnum('article').notNull().default('none'),
    plural: text('plural'),
    pos: posEnum('pos').notNull(),
    en: text('en').notNull(),
    ur: text('ur'),
    ipa: text('ipa'),
    exampleDe: text('example_de'),
    exampleEn: text('example_en'),
    genderTip: text('gender_tip'),
    usageTip: text('usage_tip'),
    collocations: text('collocations')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    synonyms: text('synonyms')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    antonyms: text('antonyms')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    falseFriend: text('false_friend'),
    register: text('register').default('neutral'),
    cefr: text('cefr'),
    /** Section 8.4 */
    verbForms: jsonb('verb_forms'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    srsEnabled: boolean('srs_enabled').notNull().default(true),
    source: sourceEnum('source').notNull().default('authored'),
    /**
     * Generated tsvector over the German and English text. Only immutable
     * expressions are allowed in a stored generated column, which is why the
     * two-argument form of to_tsvector with a literal config is used and why
     * the text[] columns are left out.
     */
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('german', coalesce(de, '') || ' ' || coalesce(plural, '') || ' ' || coalesce(en, '') || ' ' || coalesce(example_de, '') || ' ' || coalesce(example_en, ''))`,
    ),
  },
  (t) => [
    index('vocab_de_idx').on(sql`lower(${t.de})`),
    index('vocab_tsv_idx').using('gin', t.searchTsv),
  ],
);

export const grammarPoints = pgTable('grammar_points', {
  /** '<lesson>:grammar:<id>' */
  id: text('id').primaryKey(),
  lessonId: text('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  title: text('title').notNull(),
  cefr: text('cefr'),
  ruleMd: text('rule_md').notNull(),
  patternMd: text('pattern_md'),
  /** array of {caption, columns, rows, highlight} */
  tables: jsonb('tables'),
  /** array of {de,en,note,satzklammer,cases,tekamolo} */
  examples: jsonb('examples'),
  /** vs previously learned rule */
  contrastMd: text('contrast_md'),
  /** array of {wrong,right,why} */
  commonMistakes: jsonb('common_mistakes'),
  tips: text('tips')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  memoryHook: text('memory_hook'),
  skillTags: text('skill_tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  relatedIds: text('related_ids')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  difficulty: integer('difficulty').notNull().default(2),
  source: sourceEnum('source').notNull().default('authored'),
});

export const quizzes = pgTable('quizzes', {
  /** '<lesson>:quiz:<id>' */
  id: text('id').primaryKey(),
  lessonId: text('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: quizKindEnum('kind').notNull().default('practice'),
  timeLimitSec: integer('time_limit_sec'),
  passScore: integer('pass_score').notNull().default(70),
  shuffle: boolean('shuffle').notNull().default(true),
  description: text('description'),
});

/**
 * One table for classwork, homework, quiz questions and generated drills,
 * discriminated by `scope`. Keeps grading, hints and the mistake log as single
 * implementations rather than three near duplicates.
 */
export const exercises = pgTable(
  'exercises',
  {
    /** '<lesson>:cw:<id>' | ':hw:' | ':quiz:' */
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** null unless scope='quiz' */
    quizId: text('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
    scope: exerciseScopeEnum('scope').notNull(),
    orderIndex: integer('order_index').notNull(),
    type: exerciseTypeEnum('type').notNull(),
    promptMd: text('prompt_md').notNull(),
    instructionMd: text('instruction_md'),
    /** options, pairs, scrambled tokens, audio text */
    given: jsonb('given'),
    /** canonical answer(s) */
    answer: jsonb('answer').notNull(),
    /** additional accepted answers */
    accept: jsonb('accept'),
    solutionMd: text('solution_md'),
    /** required by rule 3.6 */
    whyMd: text('why_md'),
    takeawayMd: text('takeaway_md'),
    tips: text('tips')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** ordered array of {level, text} */
    hints: jsonb('hints'),
    skillTags: text('skill_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    vocabRefs: text('vocab_refs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    grammarRefs: text('grammar_refs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    difficulty: integer('difficulty').notNull().default(2),
    points: integer('points').notNull().default(1),
    /** homework only, as authored in the lesson file */
    dueDate: date('due_date'),
    /**
     * A due date set from the UI, which the ingest script never writes.
     *
     * The markdown stays the source of truth (Section 2), so `dueDate` is
     * rewritten on every ingest. Without a separate column, correcting a
     * placeholder date in the app would be silently reverted by the next
     * `pnpm ingest --force`. Reads take the override when present.
     */
    dueDateOverride: date('due_date_override'),
    /** on_request | after_attempts | after_due */
    revealPolicy: text('reveal_policy').notNull().default('on_request'),
    source: sourceEnum('source').notNull().default('authored'),
  },
  (t) => [index('exercises_lesson_scope_idx').on(t.lessonId, t.scope, t.orderIndex)],
);

/* -------------------------------------------------------------------------- */
/* 7.4 Learner state tables                                                    */
/* -------------------------------------------------------------------------- */

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  quizId: text('quiz_id').references(() => quizzes.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  score: numeric('score', { precision: 5, scale: 2 }),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }),
  durationSec: integer('duration_sec'),
  passed: boolean('passed'),
});

export const attemptAnswers = pgTable(
  'attempt_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').references(() => exercises.id, {
      onDelete: 'set null',
    }),
    userAnswer: jsonb('user_answer'),
    isCorrect: boolean('is_correct'),
    /** correct | almost | wrong | skipped */
    verdict: text('verdict'),
    pointsAwarded: numeric('points_awarded', { precision: 5, scale: 2 }),
    hintsUsed: integer('hints_used').notNull().default(0),
    timeMs: integer('time_ms'),
  },
  (t) => [
    /*
     * Quiz autosave rewrites the answer to a question each time it changes,
     * so one row per (attempt, question) has to be enforced rather than
     * assumed — otherwise a refresh mid-quiz would resume with duplicates.
     */
    uniqueIndex('attempt_answers_attempt_exercise_uq').on(t.attemptId, t.exerciseId),
  ],
);

/** classwork + homework attempts */
export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').references(() => exercises.id, {
      onDelete: 'set null',
    }),
    userAnswer: jsonb('user_answer'),
    isCorrect: boolean('is_correct'),
    verdict: text('verdict'),
    attemptNo: integer('attempt_no').notNull().default(1),
    hintsUsed: integer('hints_used').notNull().default(0),
    solutionRevealed: boolean('solution_revealed').notNull().default(false),
    timeMs: integer('time_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('submissions_user_ex_idx').on(t.userId, t.exerciseId, t.attemptNo.desc()),
  ],
);

export const srsCards = pgTable(
  'srs_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemType: srsItemEnum('item_type').notNull(),
    /** vocabItems.id or grammarPoints.id — intentionally not a foreign key */
    itemId: text('item_id').notNull(),
    ease: numeric('ease', { precision: 4, scale: 2 }).notNull().default('2.50'),
    intervalDays: numeric('interval_days', { precision: 6, scale: 2 })
      .notNull()
      .default('0'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    lastGrade: srsGradeEnum('last_grade'),
    suspended: boolean('suspended').notNull().default(false),
  },
  (t) => [
    uniqueIndex('srs_cards_user_item_uq').on(t.userId, t.itemType, t.itemId),
    index('srs_due_idx')
      .on(t.userId, t.dueAt)
      .where(sql`${t.suspended} = false`),
  ],
);

export const skillStats = pgTable(
  'skill_stats',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillTag: text('skill_tag').notNull(),
    attempts: integer('attempts').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    /** EWMA, Section 15 */
    rollingScore: numeric('rolling_score', { precision: 5, scale: 2 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillTag] })],
);

/**
 * `lessonId` and `exerciseId` carry no foreign key by design (Section 7.5), so
 * a mistake outlives the content that produced it.
 */
export const mistakes = pgTable('mistakes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id'),
  exerciseId: text('exercise_id'),
  skillTags: text('skill_tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  expected: text('expected').notNull(),
  got: text('got').notNull(),
  noteMd: text('note_md'),
  /** app | class ('class' comes from the errors block) */
  origin: text('origin'),
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `lessonId` is half of the primary key, so it cannot degrade to NULL. It keeps
 * a plain (NO ACTION) foreign key instead: deleting a lesson that still has
 * progress is refused rather than silently taking the progress with it, which
 * satisfies Section 7.5's guarantee by a different mechanism.
 */
export const progress = pgTable(
  'progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id),
    status: statusEnum('status').notNull().default('not_started'),
    classworkDone: integer('classwork_done').notNull().default(0),
    classworkTotal: integer('classwork_total').notNull().default(0),
    homeworkDone: integer('homework_done').notNull().default(0),
    homeworkTotal: integer('homework_total').notNull().default(0),
    quizBestScore: numeric('quiz_best_score', { precision: 5, scale: 2 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id'),
  /** optional: vocab/grammar/exercise id */
  anchorId: text('anchor_id'),
  bodyMd: text('body_md').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  cardsReviewed: integer('cards_reviewed').notNull().default(0),
  /** review | lesson | quiz */
  kind: text('kind'),
});

/**
 * Learner-approved alternative answers — Section 12.3.
 *
 * "the UI presents the expected answer with the diff and a 'Mark as acceptable'
 * action that appends the answer to a local `accept` override table so the same
 * phrasing is accepted next time."
 *
 * Not in Section 7, added under the rule-4 process and recorded in
 * CHANGELOG.md. It is learner state, not content: overrides are per user, and
 * `exerciseId` degrades to NULL rather than taking the row with it (Section
 * 7.5).
 */
export const acceptOverrides = pgTable(
  'accept_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').references(() => exercises.id, {
      onDelete: 'set null',
    }),
    answer: text('answer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accept_overrides_user_ex_idx').on(t.userId, t.exerciseId),
    uniqueIndex('accept_overrides_unique').on(t.userId, t.exerciseId, t.answer),
  ],
);

export const ingestLog = pgTable('ingest_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonSlug: text('lesson_slug'),
  fileHash: text('file_hash'),
  /** created | updated | skipped | failed */
  action: text('action'),
  stats: jsonb('stats'),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
