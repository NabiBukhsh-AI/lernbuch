/** Grading engine types — ARCHITECTURE.md Section 12. */

export type Verdict = 'correct' | 'almost' | 'wrong';

export type ExerciseType =
  | 'fill_blank'
  | 'mcq'
  | 'multi_select'
  | 'true_false'
  | 'match'
  | 'order_words'
  | 'translate_de_en'
  | 'translate_en_de'
  | 'transform'
  | 'conjugate'
  | 'gender_pick'
  | 'case_pick'
  | 'short_answer'
  | 'dialogue'
  | 'listening'
  | 'cloze'
  | 'four_forms';

/**
 * Why a verdict came out the way it did.
 *
 * Section 12.2 is explicit that "an umlaut slip and a case error are not the
 * same failure and must not be logged identically", so the reason is carried
 * as a code rather than as prose the caller has to parse.
 */
export type GradeNoteCode =
  | 'umlaut_spelling'
  | 'noun_capitalisation'
  | 'sentence_capitalisation'
  | 'terminal_punctuation'
  | 'typo'
  | 'wrong_article'
  | 'partial_credit'
  | 'empty_answer';

export type GradeNote = {
  code: GradeNoteCode;
  message: string;
  expected?: string;
  got?: string;
};

/** Per-blank, per-pair or per-cell detail, for the UI to mark up individually. */
export type GradePart = {
  key: string;
  verdict: Verdict;
  expected: string;
  got: string;
};

export type GradeResult = {
  verdict: Verdict;
  notes: GradeNote[];
  points: number;
  parts: GradePart[];
};

export type CheckInput = {
  type: ExerciseType;
  userAnswer: unknown;
  answer: unknown;
  accept?: unknown[] | null;
  strict: boolean;
  /**
   * Section 12 returns `points` but does not take it, yet `almost` is defined
   * as "half points" — which needs the exercise's maximum. Defaults to 1.
   */
  points?: number;
};

export const VERDICT_RANK: Record<Verdict, number> = {
  correct: 0,
  almost: 1,
  wrong: 2,
};

/** The worst verdict wins: an item is only as good as its weakest blank. */
export function worst(verdicts: Verdict[]): Verdict {
  return verdicts.reduce<Verdict>(
    (acc, v) => (VERDICT_RANK[v] > VERDICT_RANK[acc] ? v : acc),
    'correct',
  );
}

/** Section 12.2: `almost` awards half points. */
export function pointsFor(verdict: Verdict, max: number): number {
  if (verdict === 'correct') return max;
  if (verdict === 'almost') return max / 2;
  return 0;
}
