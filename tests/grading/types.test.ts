/**
 * Per-type checking — ARCHITECTURE.md Section 12.3.
 *
 * Every one of the sixteen exercise types is graded here, using the same
 * shapes the parser produces from a real lesson file.
 */
import { describe, expect, it } from 'vitest';
import { check } from '@/lib/grading';
import { exerciseType } from '@/lib/content/schemas';
import type { ExerciseType } from '@/lib/grading';

describe('single choice: mcq, true_false, gender_pick, case_pick', () => {
  it('grades mcq on an exact option match', () => {
    expect(
      check({ type: 'mcq', userAnswer: 'den', answer: 'den', strict: false }).verdict,
    ).toBe('correct');
    expect(
      check({ type: 'mcq', userAnswer: 'der', answer: 'den', strict: false }).verdict,
    ).toBe('wrong');
  });

  it('grades gender_pick', () => {
    expect(
      check({ type: 'gender_pick', userAnswer: 'der', answer: 'der', strict: true })
        .verdict,
    ).toBe('correct');
    expect(
      check({ type: 'gender_pick', userAnswer: 'die', answer: 'der', strict: true })
        .verdict,
    ).toBe('wrong');
  });

  it('grades case_pick', () => {
    expect(
      check({ type: 'case_pick', userAnswer: 'AKK', answer: 'AKK', strict: true })
        .verdict,
    ).toBe('correct');
  });

  it('grades true_false with a boolean answer', () => {
    expect(
      check({ type: 'true_false', userAnswer: 'false', answer: false, strict: true })
        .verdict,
    ).toBe('correct');
    expect(
      check({ type: 'true_false', userAnswer: 'true', answer: false, strict: true })
        .verdict,
    ).toBe('wrong');
  });

  it('does not apply typo tolerance to a picked option', () => {
    // Options are clicked, not typed, so a near miss is a different option.
    expect(
      check({ type: 'mcq', userAnswer: 'denn', answer: 'den', strict: false }).verdict,
    ).toBe('wrong');
  });

  it('marks an unanswered choice wrong', () => {
    const result = check({ type: 'mcq', userAnswer: '', answer: 'den', strict: false });
    expect(result.verdict).toBe('wrong');
    expect(result.notes.map((n) => n.code)).toContain('empty_answer');
  });
});

describe('multi_select: set equality, Jaccard partial credit', () => {
  const answer = ['den', 'einen'];

  it('is correct on set equality regardless of order', () => {
    const result = check({
      type: 'multi_select',
      userAnswer: ['einen', 'den'],
      answer,
      strict: false,
      points: 4,
    });
    expect(result.verdict).toBe('correct');
    expect(result.points).toBe(4);
  });

  it('gives partial credit as the Jaccard overlap, rounded down', () => {
    // 1 of 2 chosen, union of 2 -> 0.5 -> floor(0.5 * 4) = 2
    const result = check({
      type: 'multi_select',
      userAnswer: ['den'],
      answer,
      strict: false,
      points: 4,
    });
    expect(result.verdict).toBe('almost');
    expect(result.points).toBe(2);
  });

  it('penalises over-selection through the union', () => {
    // Both correct options chosen plus one wrong: intersection 2, union 3,
    // so the Jaccard overlap is 2/3 and floor((2/3) * 3) = 2 of 3 points.
    // Picking every option can therefore never score full marks.
    const result = check({
      type: 'multi_select',
      userAnswer: ['den', 'einen', 'die'],
      answer,
      strict: false,
      points: 3,
    });
    expect(result.verdict).toBe('almost');
    expect(result.points).toBe(2);
  });

  it('scores a scattergun answer below a careful one', () => {
    const careful = check({
      type: 'multi_select',
      userAnswer: ['den', 'einen'],
      answer,
      strict: false,
      points: 6,
    });
    const scattergun = check({
      type: 'multi_select',
      userAnswer: ['den', 'einen', 'die', 'das'],
      answer,
      strict: false,
      points: 6,
    });
    expect(scattergun.points).toBeLessThan(careful.points);
  });

  it('is wrong when nothing overlaps', () => {
    const result = check({
      type: 'multi_select',
      userAnswer: ['die', 'das'],
      answer,
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
    expect(result.points).toBe(0);
  });
});

describe('fill_blank and cloze: per blank, worst blank wins', () => {
  it('grades each blank independently', () => {
    const result = check({
      type: 'cloze',
      userAnswer: ['gehe', 'sehe'],
      answer: ['gehe', 'sehe'],
      strict: false,
      points: 2,
    });
    expect(result.verdict).toBe('correct');
    expect(result.parts.map((p) => p.verdict)).toEqual(['correct', 'correct']);
  });

  it('takes the worst blank as the item verdict', () => {
    const result = check({
      type: 'cloze',
      userAnswer: ['gehe', 'sieht'],
      answer: ['gehe', 'sehe'],
      strict: false,
    });
    expect(result.parts[0]!.verdict).toBe('correct');
    expect(result.parts[1]!.verdict).toBe('wrong');
    expect(result.verdict).toBe('wrong');
  });

  it('reports an almost blank without dragging it to wrong', () => {
    const result = check({
      type: 'fill_blank',
      userAnswer: ['Strasse'],
      answer: ['Straße'],
      strict: true,
    });
    expect(result.verdict).toBe('almost');
  });

  it('treats a missing blank as wrong', () => {
    const result = check({
      type: 'fill_blank',
      userAnswer: ['den'],
      answer: ['den', 'die'],
      strict: false,
    });
    expect(result.parts).toHaveLength(2);
    expect(result.verdict).toBe('wrong');
  });

  it('supports per-blank accept lists', () => {
    const result = check({
      type: 'fill_blank',
      userAnswer: ['nen'],
      answer: ['einen'],
      accept: [['nen']],
      strict: false,
    });
    expect(result.verdict).toBe('correct');
  });
});

describe('order_words: token sequence equality, accept covers alternatives', () => {
  const answer = ['Ich fahre morgen nach Berlin.'];
  const accept = ['Morgen fahre ich nach Berlin.'];

  it('accepts the canonical order', () => {
    const result = check({
      type: 'order_words',
      userAnswer: ['Ich', 'fahre', 'morgen', 'nach Berlin'],
      answer,
      accept,
      strict: false,
    });
    expect(result.verdict).toBe('correct');
  });

  it('accepts an authored alternative order', () => {
    const result = check({
      type: 'order_words',
      userAnswer: ['Morgen', 'fahre', 'ich', 'nach Berlin'],
      answer,
      accept,
      strict: false,
    });
    expect(result.verdict).toBe('correct');
  });

  it('rejects an order that breaks verb-second', () => {
    const result = check({
      type: 'order_words',
      userAnswer: ['Ich', 'morgen', 'fahre', 'nach Berlin'],
      answer,
      accept,
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
  });
});

describe('match: pair set equality, partial credit per pair', () => {
  const answer = [
    ['der', 'maskulin'],
    ['die', 'feminin'],
    ['das', 'neutrum'],
  ];

  it('is correct when every pair matches, in any order', () => {
    const result = check({
      type: 'match',
      userAnswer: [
        ['das', 'neutrum'],
        ['der', 'maskulin'],
        ['die', 'feminin'],
      ],
      answer,
      strict: false,
      points: 3,
    });
    expect(result.verdict).toBe('correct');
    expect(result.points).toBe(3);
  });

  it('gives credit per matched pair', () => {
    const result = check({
      type: 'match',
      userAnswer: [
        ['der', 'maskulin'],
        ['die', 'neutrum'],
        ['das', 'feminin'],
      ],
      answer,
      strict: false,
      points: 3,
    });
    expect(result.verdict).toBe('almost');
    expect(result.points).toBe(1);
    expect(result.parts.filter((p) => p.verdict === 'correct')).toHaveLength(1);
  });

  it('is wrong when no pair matches', () => {
    const result = check({
      type: 'match',
      userAnswer: [
        ['der', 'feminin'],
        ['die', 'neutrum'],
        ['das', 'maskulin'],
      ],
      answer,
      strict: false,
      points: 3,
    });
    expect(result.verdict).toBe('wrong');
    expect(result.points).toBe(0);
  });
});

describe('conjugate: per cell against the verbForms object', () => {
  const answer = {
    ich: 'gehe',
    du: 'gehst',
    er: 'geht',
    wir: 'gehen',
    ihr: 'geht',
    sie: 'gehen',
  };

  it('is correct when every cell matches', () => {
    const result = check({ type: 'conjugate', userAnswer: answer, answer, strict: true });
    expect(result.verdict).toBe('correct');
    expect(result.parts).toHaveLength(6);
  });

  it('reports the failing cell by person', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ...answer, ihr: 'geht?', du: 'gehen' },
      answer,
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
    const du = result.parts.find((p) => p.key === 'du');
    expect(du?.verdict).toBe('wrong');
    expect(du?.expected).toBe('gehst');
  });

  it('applies umlaut tolerance inside a cell', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ich: 'fahre', du: 'faehrst' },
      answer: { ich: 'fahre', du: 'fährst' },
      strict: false,
    });
    expect(result.verdict).toBe('correct');
    expect(result.notes.map((n) => n.code)).toContain('umlaut_spelling');
  });

  it('treats a missing cell as wrong', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ich: 'gehe' },
      answer,
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
  });

  /*
   * "Grade per cell, item verdict is the worst cell, points are awarded per
   * correct cell" — the Lektion 01 instruction block, which settles what
   * Section 12.3 left open.
   */
  it('awards points per correct cell, not all-or-nothing', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ...answer, du: 'gehen' },
      answer,
      strict: false,
      points: 6,
    });
    // Five of six cells right: the verdict is still wrong, the points are not.
    expect(result.verdict).toBe('wrong');
    expect(result.points).toBe(5);
  });

  it('scores a half point for an almost cell', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ich: 'gehe', du: 'gehsr' },
      answer: { ich: 'gehe', du: 'gehst' },
      strict: false,
      points: 2,
    });
    // One cell exact, one a single-letter slip on a 5-letter form: 1 + 0.5.
    expect(result.parts[1]!.verdict).toBe('almost');
    expect(result.points).toBe(1.5);
  });

  /*
   * A single-word answer cannot be told apart from the start of a sentence, so
   * a leading capital falls under the Section 12.2 sentence-capitalisation row
   * (correct with a note in lenient mode) rather than being read as wrongly
   * capitalising a verb. Pinned here so the behaviour is deliberate.
   */
  it('forgives a leading capital on a single form in lenient mode', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { du: 'Gehst' },
      answer: { du: 'gehst' },
      strict: false,
      points: 1,
    });
    expect(result.verdict).toBe('correct');
    expect(result.notes.map((n) => n.code)).toContain('sentence_capitalisation');
  });

  it('still awards everything when every cell is right', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: answer,
      answer,
      strict: true,
      points: 6,
    });
    expect(result.points).toBe(6);
  });

  it('awards nothing when no cell is right', () => {
    const result = check({
      type: 'conjugate',
      userAnswer: { ich: 'x', du: 'x', er: 'x', wir: 'x', ihr: 'x', sie: 'x' },
      answer,
      strict: false,
      points: 6,
    });
    expect(result.points).toBe(0);
  });
});

describe('free text: translate, transform, short_answer, dialogue, listening', () => {
  const cases: Array<[ExerciseType, string, string[]]> = [
    ['translate_de_en', 'I see the table.', ['I see the table.']],
    ['translate_en_de', 'Ich sehe den Tisch.', ['Ich sehe den Tisch.']],
    ['transform', 'Das ist kein Computer.', ['Das ist kein Computer.']],
    ['short_answer', 'Ich heiße Nabi.', ['Ich heiße Nabi.']],
    ['dialogue', 'Ich komme aus Pakistan.', ['Ich komme aus Pakistan.']],
    ['listening', 'Der Tisch ist neu.', ['Der Tisch ist neu.']],
  ];

  for (const [type, userAnswer, answer] of cases) {
    it(`grades ${type}`, () => {
      expect(check({ type, userAnswer, answer, strict: true }).verdict).toBe('correct');
      expect(
        check({ type, userAnswer: 'completely wrong', answer, strict: true }).verdict,
      ).toBe('wrong');
    });
  }
});

describe('coverage', () => {
  it('grades every exercise type in the enum without throwing', () => {
    for (const type of exerciseType.options) {
      const result = check({
        type: type as ExerciseType,
        userAnswer: 'anything',
        answer: ['anything'],
        strict: false,
      });
      expect(result, `type ${type} produced no result`).toBeDefined();
      expect(['correct', 'almost', 'wrong']).toContain(result.verdict);
    }
  });
});
