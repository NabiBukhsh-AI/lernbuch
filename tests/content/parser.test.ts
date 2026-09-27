import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ContentValidationError,
  composeId,
  hasSlug,
  parseLesson,
  sectionKindFor,
  sha256,
  slugifyHeading,
} from '@/lib/content/parser';
import { exerciseType } from '@/lib/content/schemas';

const FIXTURE_NAME = '2099-01-01-lektion-99.md';
const FIXTURE_PATH = path.join(import.meta.dirname, '../fixtures', FIXTURE_NAME);
const FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');

const parsed = parseLesson(FIXTURE_NAME, FIXTURE);

/** Builds a minimal valid lesson, then lets a test break one specific thing. */
function lesson(body: string, frontmatter: Record<string, string> = {}): string {
  const fm = {
    slug: '2099-01-01-lektion-99',
    classDate: '2099-01-01',
    level: 'A1.1',
    title: 'Test',
    ...frontmatter,
  };
  const head = Object.entries(fm)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `---\n${head}\n---\n\n${body}\n`;
}

function expectIssues(fileName: string, raw: string): string {
  try {
    parseLesson(fileName, raw);
  } catch (error) {
    if (error instanceof ContentValidationError) {
      return error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    }
    throw error;
  }
  throw new Error('expected parseLesson to throw, but it succeeded');
}

describe('frontmatter', () => {
  it('reads every declared field', () => {
    expect(parsed.slug).toBe('2099-01-01-lektion-99');
    expect(parsed.frontmatter.lessonNumber).toBe(99);
    expect(parsed.frontmatter.classDate).toBe('2099-01-01');
    expect(parsed.frontmatter.level).toBe('A1.1');
    expect(parsed.frontmatter.topics).toEqual(['fixture', 'testing']);
    expect(parsed.frontmatter.prerequisites).toEqual(['2098-12-31-lektion-98']);
    expect(parsed.frontmatter.publish).toBe(true);
    expect(parsed.frontmatter.enhance).toMatchObject({ drills: 2, tone: 'exam' });
  });

  it('normalises a Date classDate to YYYY-MM-DD', () => {
    // gray-matter bundles a js-yaml that resolves bare dates to Date objects.
    const raw = lesson('## Überblick\n\nHi.', { classDate: '2099-03-04' });
    expect(parseLesson('2099-01-01-lektion-99.md', raw).frontmatter.classDate).toBe(
      '2099-03-04',
    );
  });

  it('rejects a slug that does not match the filename (Section 8.1)', () => {
    const raw = lesson('## Überblick\n\nHi.');
    expect(expectIssues('2099-01-01-lektion-98.md', raw)).toContain(
      'must equal the filename',
    );
  });

  it('rejects an unknown frontmatter key', () => {
    const raw = lesson('## Überblick\n\nHi.', { madeUpKey: 'x' });
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('Unrecognized key');
  });
});

describe('hasSlug', () => {
  it('accepts a real lesson', () => {
    expect(hasSlug(FIXTURE)).toBe(true);
  });

  it('skips files without a slug so a stray README does not crash the run', () => {
    expect(hasSlug('# Just a readme\n\nNo frontmatter here.')).toBe(false);
    expect(hasSlug('---\ntitle: Not a lesson\n---\n')).toBe(false);
  });
});

describe('prose sections (Section 8.10)', () => {
  it('maps recognised headings to their kinds, in German and English', () => {
    expect(sectionKindFor('Überblick')).toBe('overview');
    expect(sectionKindFor('Overview')).toBe('overview');
    expect(sectionKindFor('Aussprache')).toBe('pronunciation');
    expect(sectionKindFor('Pronunciation')).toBe('pronunciation');
    expect(sectionKindFor('Landeskunde')).toBe('culture');
    expect(sectionKindFor('Mitnehmen')).toBe('takeaways');
    expect(sectionKindFor('Takeaways')).toBe('takeaways');
    expect(sectionKindFor('Anything else entirely')).toBe('notes');
  });

  it('assigns the fixture sections the right kinds', () => {
    const byTitle = new Map(parsed.sections.map((s) => [s.title, s.kind]));
    expect(byTitle.get('Überblick')).toBe('overview');
    expect(byTitle.get('Aussprache')).toBe('pronunciation');
    expect(byTitle.get('Landeskunde')).toBe('culture');
    expect(byTitle.get('Zufälliges Thema')).toBe('notes');
    expect(byTitle.get('Mitnehmen')).toBe('takeaways');
  });

  it('never stores the maintainer instruction block', () => {
    const titles = parsed.sections.map((s) => s.title);
    expect(titles).not.toContain('Instructions for the maintainer');
  });

  it('numbers sections consecutively from zero', () => {
    expect(parsed.sections.map((s) => s.orderIndex)).toEqual(
      parsed.sections.map((_, index) => index),
    );
  });

  it('transliterates umlauts into ASCII ids', () => {
    expect(slugifyHeading('Überblick')).toBe('ueberblick');
    expect(slugifyHeading('Lehnwörter')).toBe('lehnwoerter');
    expect(slugifyHeading('Fehler aus dem Unterricht')).toBe('fehler-aus-dem-unterricht');
    expect(slugifyHeading('Straße')).toBe('strasse');
  });

  it('keeps prose out of the fenced blocks', () => {
    const wortschatz = parsed.sections.find((s) => s.title === 'Wortschatz');
    expect(wortschatz?.bodyMd).toContain('Prose above a block');
    expect(wortschatz?.bodyMd).not.toContain('id: tisch');
  });
});

describe('block parsing', () => {
  it('parses every block type', () => {
    expect(parsed.vocab).toHaveLength(3);
    expect(parsed.grammar).toHaveLength(1);
    expect(parsed.classwork).toHaveLength(17);
    expect(parsed.homework).toHaveLength(2);
    expect(parsed.quizzes).toHaveLength(1);
    expect(parsed.errors).toHaveLength(2);
  });

  it('covers every exercise type in the enum', () => {
    const used = new Set([
      ...parsed.classwork.map((item) => item.type),
      ...parsed.homework.map((item) => item.type),
      ...parsed.quizzes.flatMap((quiz) => quiz.questions.map((q) => q.type)),
    ]);
    for (const type of exerciseType.options) {
      expect(used, `exercise type "${type}" is not covered by the fixture`).toContain(
        type,
      );
    }
  });

  it('keeps type-specific given/answer shapes intact', () => {
    const match = parsed.classwork.find((item) => item.id === 'cw-match');
    expect(match?.given).toEqual({
      left: ['der', 'die', 'das'],
      right: ['maskulin', 'feminin', 'neutrum'],
    });
    expect(match?.answer).toEqual([
      ['der', 'maskulin'],
      ['die', 'feminin'],
      ['das', 'neutrum'],
    ]);

    const conjugate = parsed.classwork.find((item) => item.id === 'cw-conjugate');
    expect(conjugate?.answer).toMatchObject({ ich: 'gehe', ihr: 'geht' });
  });

  it('reads grammar tables, case chips, satzklammer and tekamolo', () => {
    const point = parsed.grammar[0]!;
    expect(point.tables[0]?.highlight).toEqual([[1, 1]]);
    expect(point.examples[0]?.cases).toEqual([
      { text: 'Ich', case: 'NOM' },
      { text: 'den Tisch', case: 'AKK' },
    ]);
    expect(point.examples[1]?.satzklammer).toEqual({
      position2: 'will',
      ende: 'kaufen',
    });
    expect(point.examples[2]?.tekamolo?.map((s) => s.slot)).toEqual([
      'temporal',
      'kausal',
      'modal',
      'lokal',
    ]);
    expect(point.commonMistakes[0]?.wrong).toBe('Ich sehe der Tisch.');
  });

  it('applies documented defaults', () => {
    const mcq = parsed.classwork.find((item) => item.id === 'cw-mcq')!;
    expect(mcq.difficulty).toBe(2);
    expect(mcq.points).toBe(1);
    expect(parsed.homework[0]!.revealPolicy).toBe('on_request');
    expect(parsed.quizzes[0]!.shuffle).toBe(true);
    expect(parsed.vocab[2]!.article).toBe('none');
    expect(parsed.vocab[2]!.srsEnabled).toBe(true);
  });

  it('normalises a homework dueDate', () => {
    expect(parsed.homework[0]!.dueDate).toBe('2099-01-08');
  });
});

describe('id composition (Section 8.2)', () => {
  it('composes <lesson>:<blocktype>:<item>, abbreviating classwork and homework', () => {
    expect(composeId('lek-01', 'vocab', 'apfel')).toBe('lek-01:vocab:apfel');
    expect(composeId('lek-01', 'grammar', 'akk')).toBe('lek-01:grammar:akk');
    expect(composeId('lek-01', 'classwork', 'cw-01')).toBe('lek-01:cw:cw-01');
    expect(composeId('lek-01', 'homework', 'hw-01')).toBe('lek-01:hw:hw-01');
    expect(composeId('lek-01', 'quiz', 'main')).toBe('lek-01:quiz:main');
    expect(composeId('lek-01', 'section', 'ueberblick')).toBe('lek-01:sec:ueberblick');
  });

  it('is stable for the same input', () => {
    expect(composeId('a', 'vocab', 'b')).toBe(composeId('a', 'vocab', 'b'));
  });

  it('rejects ids that are not lowercase kebab ASCII', () => {
    for (const bad of ['CW-01', 'cw_01', 'cw 01', 'äpfel', 'cw--01', '-cw', 'cw-']) {
      const raw = lesson(
        `## Wortschatz\n\n\`\`\`yaml vocab\n- id: ${bad}\n  de: Tisch\n  article: der\n  plural: Tische\n  pos: noun\n  en: table\n\`\`\``,
      );
      expect(expectIssues(FIXTURE_NAME, raw), `"${bad}" should be rejected`).toContain(
        'kebab-case',
      );
    }
  });

  it('treats a missing id as a hard error rather than generating one', () => {
    const raw = lesson(
      '## Wortschatz\n\n```yaml vocab\n- de: Tisch\n  article: der\n  plural: Tische\n  pos: noun\n  en: table\n```',
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('vocab[0].id');
  });
});

describe('validation failures', () => {
  it('reports malformed YAML with the block and line', () => {
    const raw = lesson('## Wortschatz\n\n```yaml vocab\n- id: x\n   bad indent: [\n```');
    expect(expectIssues(FIXTURE_NAME, raw)).toMatch(/vocab \(line \d+\)/);
  });

  it('rejects an unknown block type', () => {
    const raw = lesson('## Something\n\n```yaml nonsense\n- id: x\n```');
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('unknown block type');
  });

  it('rejects duplicate ids inside one block', () => {
    const item = (id: string) =>
      `- id: ${id}\n  de: Tisch\n  article: der\n  plural: Tische\n  pos: noun\n  en: table`;
    const raw = lesson(
      `## Wortschatz\n\n\`\`\`yaml vocab\n${item('tisch')}\n${item('tisch')}\n\`\`\``,
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('duplicate id "tisch"');
  });

  /*
   * An `enhance` pass appends its output below the generated marker at the end
   * of the file, which necessarily means a second block of an existing type.
   * Repeated blocks therefore merge in document order rather than erroring —
   * but a duplicate id across them is still a hard error.
   */
  it('merges repeated blocks of the same type in document order', () => {
    const item = (id: string, de: string) =>
      `- id: ${id}\n  de: ${de}\n  article: der\n  plural: ${de}e\n  pos: noun\n  en: thing`;
    const raw = lesson(
      `## Wortschatz\n\n\`\`\`yaml vocab\n${item('tisch', 'Tisch')}\n\`\`\`\n\n` +
        `<!-- generated:start -->\n\n\`\`\`yaml vocab\n${item('stuhl', 'Stuhl')}\n\`\`\``,
    );
    const merged = parseLesson(FIXTURE_NAME, raw);
    expect(merged.vocab.map((v) => v.id)).toEqual(['tisch', 'stuhl']);
  });

  it('still rejects a duplicate id across merged blocks', () => {
    const item =
      '- id: tisch\n  de: Tisch\n  article: der\n  plural: Tische\n  pos: noun\n  en: table';
    const raw = lesson(
      `## Wortschatz\n\n\`\`\`yaml vocab\n${item}\n\`\`\`\n\n## Mehr\n\n\`\`\`yaml vocab\n${item}\n\`\`\``,
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('duplicate id "tisch"');
  });

  it('requires an article and a plural for nouns (rule 3.1)', () => {
    const raw = lesson(
      '## Wortschatz\n\n```yaml vocab\n- id: tisch\n  de: Tisch\n  pos: noun\n  en: table\n```',
    );
    const issues = expectIssues(FIXTURE_NAME, raw);
    expect(issues).toContain('needs an article');
    expect(issues).toContain('needs a plural');
  });

  it('requires praesens and aux for verbs (rule 3.2)', () => {
    const raw = lesson(
      '## Wortschatz\n\n```yaml vocab\n- id: gehen\n  de: gehen\n  pos: verb\n  en: to go\n```',
    );
    const issues = expectIssues(FIXTURE_NAME, raw);
    expect(issues).toContain('verbForms.praesens');
    expect(issues).toContain('verbForms.aux');
  });

  it('requires solution, why and takeaway on an exercise (rule 3.6)', () => {
    const raw = lesson(
      '## Unterrichtsarbeit\n\n```yaml classwork\n- id: cw-01\n  type: mcq\n  prompt: "x"\n  answer: "y"\n```',
    );
    const issues = expectIssues(FIXTURE_NAME, raw);
    expect(issues).toContain('classwork[0].solution');
    expect(issues).toContain('classwork[0].why');
    expect(issues).toContain('classwork[0].takeaway');
  });

  it('rejects a skill tag outside the taxonomy', () => {
    const raw = lesson(
      '## Grammatik\n\n```yaml grammar\n- id: g\n  title: T\n  rule: R\n  skillTags: [not.a.real.tag]\n```',
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('unknown skill tag');
  });

  it('rejects a grammar table whose row length disagrees with its columns', () => {
    const raw = lesson(
      '## Grammatik\n\n```yaml grammar\n- id: g\n  title: T\n  rule: R\n  tables:\n    - columns: ["a", "b"]\n      rows:\n        - ["only-one"]\n```',
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('declares 2 columns');
  });

  it('rejects an unknown exercise type', () => {
    const raw = lesson(
      '## Unterrichtsarbeit\n\n```yaml classwork\n- id: cw-01\n  type: telepathy\n  prompt: "x"\n  answer: "y"\n  solution: "y"\n  why: "w"\n  takeaway: "t"\n```',
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('classwork[0].type');
  });

  it('rejects duplicate hint levels', () => {
    const raw = lesson(
      '## Hausaufgaben\n\n```yaml homework\n- id: hw-01\n  type: mcq\n  prompt: "x"\n  answer: "y"\n  solution: "y"\n  why: "w"\n  takeaway: "t"\n  hints:\n    - level: 1\n      text: a\n    - level: 1\n      text: b\n```',
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('duplicate hint levels');
  });

  it('rejects a question id reused across two quizzes in one lesson', () => {
    const quiz = (id: string) =>
      `- id: ${id}\n  title: Q\n  questions:\n    - id: q1\n      type: mcq\n      prompt: "x"\n      answer: "y"\n      explanation: "e"`;
    const raw = lesson(
      `## Quiz\n\n\`\`\`yaml quiz\n${quiz('first')}\n${quiz('second')}\n\`\`\``,
    );
    expect(expectIssues(FIXTURE_NAME, raw)).toContain('already used in quiz');
  });

  it('collects several issues in one pass rather than stopping at the first', () => {
    const raw = lesson(
      '## Wortschatz\n\n```yaml vocab\n- id: a\n  de: A\n  pos: noun\n  en: a\n- id: b\n  de: B\n  pos: noun\n  en: b\n```',
    );
    const issues = expectIssues(FIXTURE_NAME, raw).split('\n');
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });
});

describe('fileHash', () => {
  it('is a stable sha256 of the source', () => {
    expect(parsed.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.fileHash).toBe(sha256(FIXTURE));
  });

  it('changes when a single character changes', () => {
    expect(sha256(FIXTURE)).not.toBe(sha256(FIXTURE + '\n'));
  });
});
