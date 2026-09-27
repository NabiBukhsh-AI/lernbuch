/**
 * The one grading function used everywhere — ARCHITECTURE.md Section 12.3.
 *
 * Pure: no database, no clock, no randomness. Section 20 puts the highest test
 * burden here and on the parser, because these are the two places where a
 * silent bug teaches the learner something wrong.
 */
import { compareAgainstAny, compareText } from './text';
import { normalise } from './normalise';
import {
  pointsFor,
  worst,
  type CheckInput,
  type ExerciseType,
  type GradeNote,
  type GradePart,
  type GradeResult,
  type Verdict,
} from './types';

/* -------------------------------------------------------------------------- */
/* Coercion helpers                                                            */
/* -------------------------------------------------------------------------- */

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString);
  if (value === null || value === undefined) return [];
  return [asString(value)];
}

function asRecord(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, asString(v)]),
    );
  }
  return {};
}

function asPairs(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is unknown[] => Array.isArray(entry) && entry.length >= 2)
    .map((entry) => [asString(entry[0]), asString(entry[1])] as [string, string]);
}

const key = (value: string) => normalise(value).toLowerCase();

/** Types whose answer array is one entry per blank rather than a list of alternatives. */
const PER_BLANK: ReadonlySet<ExerciseType> = new Set(['fill_blank', 'cloze']);

/** Types answered by picking one option from a fixed list. */
const SINGLE_CHOICE: ReadonlySet<ExerciseType> = new Set([
  'mcq',
  'true_false',
  'gender_pick',
  'case_pick',
]);

/* -------------------------------------------------------------------------- */
/* check                                                                       */
/* -------------------------------------------------------------------------- */

export function check(input: CheckInput): GradeResult {
  const max = input.points ?? 1;
  const { type, strict } = input;

  if (SINGLE_CHOICE.has(type)) return checkSingleChoice(input, max);
  if (type === 'multi_select') return checkMultiSelect(input, max);
  if (PER_BLANK.has(type)) return checkPerBlank(input, max);
  if (type === 'match') return checkMatch(input, max);
  if (type === 'conjugate') return checkConjugate(input, max);
  if (type === 'four_forms') return checkFourForms(input, max);

  /*
   * order_words, translate_*, transform, short_answer, dialogue, listening.
   * Section 12.3 grades order_words as token sequence equality "after
   * normalisation", which is exactly what comparing the joined tokens does,
   * with `accept` covering the legitimate alternative orders.
   */
  const userText = Array.isArray(input.userAnswer)
    ? asStringArray(input.userAnswer).join(' ')
    : asString(input.userAnswer);

  const candidates = [...asStringArray(input.answer), ...asStringArray(input.accept)];
  const result = compareAgainstAny(userText, candidates, { strict });

  return {
    verdict: result.verdict,
    notes: result.notes,
    points: pointsFor(result.verdict, max),
    parts: [],
  };
}

/** Exact match on the option key (Section 12.3). */
function checkSingleChoice(input: CheckInput, max: number): GradeResult {
  const got = asString(input.userAnswer);
  const candidates = [...asStringArray(input.answer), ...asStringArray(input.accept)];

  if (got.trim().length === 0) {
    return {
      verdict: 'wrong',
      notes: [{ code: 'empty_answer', message: 'No option chosen.' }],
      points: 0,
      parts: [],
    };
  }

  const hit = candidates.some((candidate) => key(candidate) === key(got));
  return {
    verdict: hit ? 'correct' : 'wrong',
    notes: [],
    points: hit ? max : 0,
    parts: [
      {
        key: 'choice',
        verdict: hit ? 'correct' : 'wrong',
        expected: asStringArray(input.answer).join(', '),
        got,
      },
    ],
  };
}

/** Set equality; partial credit is the Jaccard overlap rounded down. */
function checkMultiSelect(input: CheckInput, max: number): GradeResult {
  const expected = new Set(asStringArray(input.answer).map(key));
  const got = new Set(asStringArray(input.userAnswer).map(key));

  if (got.size === 0) {
    return {
      verdict: 'wrong',
      notes: [{ code: 'empty_answer', message: 'Nothing selected.' }],
      points: 0,
      parts: [],
    };
  }

  let intersection = 0;
  for (const value of got) if (expected.has(value)) intersection++;
  const union = new Set([...expected, ...got]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const verdict: Verdict =
    intersection === expected.size && got.size === expected.size
      ? 'correct'
      : intersection === 0
        ? 'wrong'
        : 'almost';

  const notes: GradeNote[] = [];
  if (verdict === 'almost') {
    notes.push({
      code: 'partial_credit',
      message: `${intersection} of ${expected.size} correct.`,
      expected: asStringArray(input.answer).join(', '),
      got: asStringArray(input.userAnswer).join(', '),
    });
  }

  return {
    verdict,
    notes,
    points: Math.floor(jaccard * max),
    parts: [],
  };
}

/**
 * Per-blank checking, each blank verdicted independently, item verdict is the
 * worst blank (Section 12.3).
 *
 * `accept` may be an array of arrays, one list of alternatives per blank.
 */
function checkPerBlank(input: CheckInput, max: number): GradeResult {
  const expected = asStringArray(input.answer);
  const got = asStringArray(input.userAnswer);
  const acceptRaw = Array.isArray(input.accept) ? input.accept : [];

  const parts: GradePart[] = [];
  const notes: GradeNote[] = [];
  const verdicts: Verdict[] = [];

  expected.forEach((want, index) => {
    const alternatives = Array.isArray(acceptRaw[index])
      ? asStringArray(acceptRaw[index])
      : [];
    const answerText = got[index] ?? '';

    const result = compareAgainstAny(answerText, [want, ...alternatives], {
      strict: input.strict,
    });

    verdicts.push(result.verdict);
    notes.push(...result.notes);
    parts.push({
      key: `blank ${index + 1}`,
      verdict: result.verdict,
      expected: want,
      got: answerText,
    });
  });

  const verdict = expected.length === 0 ? 'wrong' : worst(verdicts);
  return { verdict, notes, points: pointsFor(verdict, max), parts };
}

/** Pair set equality, partial credit per pair (Section 12.3). */
function checkMatch(input: CheckInput, max: number): GradeResult {
  const expected = asPairs(input.answer);
  const got = asPairs(input.userAnswer);

  if (expected.length === 0) {
    return { verdict: 'wrong', notes: [], points: 0, parts: [] };
  }

  const gotByLeft = new Map(got.map(([left, right]) => [key(left), key(right)]));

  const parts: GradePart[] = [];
  let correct = 0;

  for (const [left, right] of expected) {
    const answered = gotByLeft.get(key(left)) ?? '';
    const hit = answered === key(right);
    if (hit) correct++;
    parts.push({
      key: left,
      verdict: hit ? 'correct' : 'wrong',
      expected: right,
      got: got.find(([l]) => key(l) === key(left))?.[1] ?? '',
    });
  }

  const verdict: Verdict =
    correct === expected.length ? 'correct' : correct === 0 ? 'wrong' : 'almost';

  const notes: GradeNote[] = [];
  if (verdict === 'almost') {
    notes.push({
      code: 'partial_credit',
      message: `${correct} of ${expected.length} pairs matched.`,
    });
  }

  return {
    verdict,
    notes,
    points: Math.floor((correct / expected.length) * max),
    parts,
  };
}

/**
 * The four shapes of one sentence — Lektion 02's `four_forms`.
 *
 *   A    Aussage             Er ist der Ingenieur.
 *   N    Verneinung          Er ist nicht der Ingenieur.
 *   I    Frage               Ist er der Ingenieur?
 *   I.N  verneinte Frage     Ist er nicht der Ingenieur?
 *
 * Each row is graded independently, one point per correct row, and the item
 * verdict is the worst row — so a learner who gets three right and one wrong
 * can see exactly which transformation failed.
 */
export const FOUR_FORM_ROWS = ['A', 'N', 'I', 'IN'] as const;

const FOUR_FORM_LABEL: Record<string, string> = {
  A: 'A · Aussage',
  N: 'N · Verneinung',
  I: 'I · Frage',
  IN: 'I.N · verneinte Frage',
};

function checkFourForms(input: CheckInput, max: number): GradeResult {
  const expected = asRecord(input.answer);
  const got = asRecord(input.userAnswer);

  // Honour whatever rows the item actually authored, in the canonical order.
  const rows = FOUR_FORM_ROWS.filter((row) => row in expected);
  if (rows.length === 0) {
    return { verdict: 'wrong', notes: [], points: 0, parts: [] };
  }

  const parts: GradePart[] = [];
  const notes: GradeNote[] = [];
  const verdicts: Verdict[] = [];
  let earned = 0;

  for (const row of rows) {
    const want = expected[row]!;
    const answered = got[row] ?? '';
    const result = compareText(answered, want, { strict: input.strict });

    verdicts.push(result.verdict);
    notes.push(...result.notes);
    earned += result.verdict === 'correct' ? 1 : result.verdict === 'almost' ? 0.5 : 0;

    parts.push({
      key: FOUR_FORM_LABEL[row] ?? row,
      verdict: result.verdict,
      expected: want,
      got: answered,
    });
  }

  const verdict = worst(verdicts);
  const points = Math.round((earned / rows.length) * max * 100) / 100;

  if (verdict !== 'correct') {
    notes.push({
      code: 'partial_credit',
      message: `${earned} of ${rows.length} forms correct.`,
    });
  }

  return { verdict, notes, points, parts };
}

/**
 * Per-cell checking against the verbForms object (Section 12.3).
 *
 * "Grade per cell, item verdict is the worst cell, points are awarded per
 * correct cell" — the instruction block in Lektion 01, which settles a question
 * Section 12.3 left open. The verdict is therefore the worst cell, but the
 * points are proportional: a six-person table answered five-sixths right scores
 * five sixths, not zero. An `almost` cell counts as half, matching how `almost`
 * is scored everywhere else.
 */
function checkConjugate(input: CheckInput, max: number): GradeResult {
  const expected = asRecord(input.answer);
  const got = asRecord(input.userAnswer);
  const persons = Object.keys(expected);

  if (persons.length === 0) {
    return { verdict: 'wrong', notes: [], points: 0, parts: [] };
  }

  const parts: GradePart[] = [];
  const notes: GradeNote[] = [];
  const verdicts: Verdict[] = [];
  let earned = 0;

  for (const person of persons) {
    const want = expected[person]!;
    const answered = got[person] ?? '';
    const result = compareText(answered, want, { strict: input.strict });

    verdicts.push(result.verdict);
    notes.push(...result.notes);
    earned += result.verdict === 'correct' ? 1 : result.verdict === 'almost' ? 0.5 : 0;

    parts.push({
      key: person,
      verdict: result.verdict,
      expected: want,
      got: answered,
    });
  }

  const verdict = worst(verdicts);
  const points = Math.round((earned / persons.length) * max * 100) / 100;

  if (verdict !== 'correct') {
    notes.push({
      code: 'partial_credit',
      message: `${earned} of ${persons.length} forms correct.`,
    });
  }

  return { verdict, notes, points, parts };
}
