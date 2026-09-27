/**
 * The Section 12.2 tolerance table, asserted row by row in both modes.
 *
 * | Situation                         | Lenient (default)      | Strict         |
 * | ae/oe/ue/ss for ä/ö/ü/ß           | correct + spelling note| almost         |
 * | Noun not capitalised              | almost + note          | wrong          |
 * | Sentence not capitalised at start | correct + note         | almost         |
 * | Levenshtein 1 on a word > 4 chars | almost, shows the diff | wrong          |
 * | Wrong article, right noun         | wrong + gender note    | wrong          |
 * | Terminal punctuation differs      | correct + note         | correct + note |
 */
import { describe, expect, it } from 'vitest';
import { check } from '@/lib/grading';
import type { GradeNoteCode, Verdict } from '@/lib/grading';

type Row = {
  rule: string;
  got: string;
  expected: string;
  note: GradeNoteCode;
  lenient: Verdict;
  strict: Verdict;
};

const TABLE: Row[] = [
  {
    rule: 'ae for ä',
    got: 'Aepfel',
    expected: 'Äpfel',
    note: 'umlaut_spelling',
    lenient: 'correct',
    strict: 'almost',
  },
  {
    rule: 'ue for ü',
    got: 'Buero',
    expected: 'Büro',
    note: 'umlaut_spelling',
    lenient: 'correct',
    strict: 'almost',
  },
  {
    rule: 'oe for ö',
    got: 'hoeren',
    expected: 'hören',
    note: 'umlaut_spelling',
    lenient: 'correct',
    strict: 'almost',
  },
  {
    rule: 'ss for ß',
    got: 'Strasse',
    expected: 'Straße',
    note: 'umlaut_spelling',
    lenient: 'correct',
    strict: 'almost',
  },
  {
    rule: 'noun not capitalised',
    got: 'Ich sehe den mann',
    expected: 'Ich sehe den Mann',
    note: 'noun_capitalisation',
    lenient: 'almost',
    strict: 'wrong',
  },
  {
    rule: 'sentence not capitalised at the start',
    got: 'ich sehe den Mann',
    expected: 'Ich sehe den Mann',
    note: 'sentence_capitalisation',
    lenient: 'correct',
    strict: 'almost',
  },
  {
    rule: 'Levenshtein 1 on a word longer than 4',
    got: 'Der Computr ist neu',
    expected: 'Der Computer ist neu',
    note: 'typo',
    lenient: 'almost',
    strict: 'wrong',
  },
  {
    rule: 'wrong article, right noun',
    got: 'Ich sehe der Mann',
    expected: 'Ich sehe den Mann',
    note: 'wrong_article',
    lenient: 'wrong',
    strict: 'wrong',
  },
  {
    rule: 'missing terminal punctuation',
    got: 'Ich sehe den Mann',
    expected: 'Ich sehe den Mann.',
    note: 'terminal_punctuation',
    lenient: 'correct',
    strict: 'correct',
  },
  {
    rule: 'extra terminal punctuation',
    got: 'Ich sehe den Mann.',
    expected: 'Ich sehe den Mann',
    note: 'terminal_punctuation',
    lenient: 'correct',
    strict: 'correct',
  },
];

describe('Section 12.2 tolerance table', () => {
  for (const row of TABLE) {
    it(`${row.rule}: lenient -> ${row.lenient}`, () => {
      const result = check({
        type: 'translate_en_de',
        userAnswer: row.got,
        answer: [row.expected],
        strict: false,
      });
      expect(result.verdict).toBe(row.lenient);
      expect(result.notes.map((n) => n.code)).toContain(row.note);
    });

    it(`${row.rule}: strict -> ${row.strict}`, () => {
      const result = check({
        type: 'translate_en_de',
        userAnswer: row.got,
        answer: [row.expected],
        strict: true,
      });
      expect(result.verdict).toBe(row.strict);
    });
  }
});

describe('tolerance boundaries', () => {
  it('does not forgive a one-letter slip on a short word', () => {
    // Levenshtein 1, but "Maus" is 4 characters, so the rule does not apply.
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Das ist eine Maus',
      answer: ['Das ist eine Haus'],
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
  });

  it('treats a wrong article as wrong even when it is one letter out', () => {
    // "einem" vs "einen" is Levenshtein 1 on a 5-letter word, which would
    // otherwise be forgiven as a typo. A case error must never be.
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Ich sehe einem Mann',
      answer: ['Ich sehe einen Mann'],
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
    expect(result.notes.map((n) => n.code)).toContain('wrong_article');
    expect(result.notes.map((n) => n.code)).not.toContain('typo');
  });

  it('does not forgive two separate mistakes', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Ich sehe der Frau',
      answer: ['Ich sehe den Mann'],
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
  });

  it('combines an umlaut slip with a capitalisation slip', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'die strasse',
      answer: ['die Straße'],
      strict: false,
    });
    const codes = result.notes.map((n) => n.code);
    expect(codes).toContain('umlaut_spelling');
    expect(codes).toContain('noun_capitalisation');
    // The worse of the two decides the verdict.
    expect(result.verdict).toBe('almost');
  });

  it('accepts a precomposed and a decomposed umlaut as the same word', () => {
    const decomposed = 'Äpfel'; // A + combining diaeresis
    const result = check({
      type: 'short_answer',
      userAnswer: decomposed,
      answer: ['Äpfel'],
      strict: true,
    });
    expect(result.verdict).toBe('correct');
    expect(result.notes).toHaveLength(0);
  });

  it('normalises typographic quotes and dashes', () => {
    const result = check({
      type: 'short_answer',
      userAnswer: '“Guten Tag” – sagt er',
      answer: ['"Guten Tag" - sagt er'],
      strict: true,
    });
    expect(result.verdict).toBe('correct');
  });

  it('collapses runaway whitespace', () => {
    const result = check({
      type: 'short_answer',
      userAnswer: '  Ich   sehe    den Mann  ',
      answer: ['Ich sehe den Mann'],
      strict: true,
    });
    expect(result.verdict).toBe('correct');
  });

  it('marks an empty answer wrong rather than crashing', () => {
    const result = check({
      type: 'short_answer',
      userAnswer: '   ',
      answer: ['Ich sehe den Mann'],
      strict: false,
    });
    expect(result.verdict).toBe('wrong');
    expect(result.notes.map((n) => n.code)).toContain('empty_answer');
  });
});

describe('points', () => {
  it('awards full points for correct', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Ich sehe den Mann',
      answer: ['Ich sehe den Mann'],
      strict: false,
      points: 4,
    });
    expect(result.points).toBe(4);
  });

  it('awards half points for almost (Section 12.2)', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Ich sehe den mann',
      answer: ['Ich sehe den Mann'],
      strict: false,
      points: 4,
    });
    expect(result.verdict).toBe('almost');
    expect(result.points).toBe(2);
  });

  it('awards nothing for wrong', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Something else entirely',
      answer: ['Ich sehe den Mann'],
      strict: false,
      points: 4,
    });
    expect(result.points).toBe(0);
  });

  it('defaults to one point', () => {
    const result = check({
      type: 'mcq',
      userAnswer: 'den',
      answer: 'den',
      strict: false,
    });
    expect(result.points).toBe(1);
  });
});

describe('accept list', () => {
  it('accepts an authored alternative', () => {
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Ich lese gerade das Buch.',
      answer: ['Ich lese das Buch.'],
      accept: ['Ich lese gerade das Buch.'],
      strict: true,
    });
    expect(result.verdict).toBe('correct');
  });

  it('keeps the most favourable outcome across candidates', () => {
    // Exact against the second candidate, a typo against the first. The
    // learner must get the better of the two.
    const result = check({
      type: 'translate_en_de',
      userAnswer: 'Morgen fahre ich nach Berlin.',
      answer: ['Ich fahre morgen nach Berlin.'],
      accept: ['Morgen fahre ich nach Berlin.'],
      strict: true,
    });
    expect(result.verdict).toBe('correct');
    expect(result.notes).toHaveLength(0);
  });
});
