/**
 * Lesson markdown parser — ARCHITECTURE.md Section 8.
 *
 * A lesson file is YAML frontmatter, then markdown prose organised under `##`
 * headings, with structured data carried in fenced blocks whose info string is
 * `yaml <blocktype>`.
 *
 * Parsing goes through remark's AST rather than scanning lines. A `##` inside a
 * fenced block, or a nested fence inside prose, would fool a line scanner; the
 * AST already knows the difference. Section bodies are sliced out of the
 * original source by node offsets so the markdown survives byte for byte.
 */
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { load as loadYaml, YAMLException } from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { z } from 'zod';
import {
  BLOCK_SCHEMAS,
  frontmatterSchema,
  isBlockType,
  type BlockType,
  type ClassworkItemInput,
  type ErrorItemInput,
  type Frontmatter,
  type GrammarPointInput,
  type HomeworkItemInput,
  type QuizInput,
  type VocabItemInput,
} from './schemas';

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type ContentIssue = { path: string; message: string };

/**
 * Carries the YAML path alongside the reason, because Section 8.12 requires a
 * validation failure to print both.
 */
export class ContentValidationError extends Error {
  constructor(
    readonly file: string,
    readonly issues: ContentIssue[],
  ) {
    super(
      `${file}\n` + issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n'),
    );
    this.name = 'ContentValidationError';
  }
}

function zodIssues(error: z.ZodError, prefix: string): ContentIssue[] {
  return error.issues.map((issue) => ({
    path: prefix + (issue.path.length ? formatPath(issue.path) : ''),
    message: issue.message,
  }));
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((segment) =>
      typeof segment === 'number' ? `[${segment}]` : `.${String(segment)}`,
    )
    .join('');
}

/* -------------------------------------------------------------------------- */
/* Id composition — Section 8.2                                                */
/* -------------------------------------------------------------------------- */

/**
 * Section 7.3 abbreviates classwork and homework in the composed id
 * (`<lesson>:cw:<id>`, `<lesson>:hw:<id>`) while the block itself is spelled in
 * full in the markdown.
 */
export const ID_SEGMENT: Record<BlockType | 'section', string> = {
  vocab: 'vocab',
  grammar: 'grammar',
  classwork: 'cw',
  homework: 'hw',
  drills: 'drill',
  quiz: 'quiz',
  errors: 'err',
  section: 'sec',
};

export function composeId(
  lessonSlug: string,
  kind: BlockType | 'section',
  itemId: string,
): string {
  return `${lessonSlug}:${ID_SEGMENT[kind]}:${itemId}`;
}

/* -------------------------------------------------------------------------- */
/* Prose sections — Section 8.10                                               */
/* -------------------------------------------------------------------------- */

export type SectionKind =
  'overview' | 'pronunciation' | 'culture' | 'notes' | 'takeaways';

const SECTION_KINDS: Array<[SectionKind, string[]]> = [
  ['overview', ['überblick', 'uberblick', 'overview']],
  ['pronunciation', ['aussprache', 'pronunciation']],
  ['culture', ['landeskunde', 'culture']],
  ['takeaways', ['mitnehmen', 'takeaways']],
];

export function sectionKindFor(heading: string): SectionKind {
  const normalised = heading.trim().toLowerCase();
  for (const [kind, names] of SECTION_KINDS) {
    if (names.includes(normalised)) return kind;
  }
  return 'notes';
}

/**
 * A lesson may carry notes for whoever maintains the app ("Instructions for
 * …", "Anweisungen für …"). They steer the build, not the learner, and are
 * never stored.
 */
const IGNORED_HEADING = /^(instructions for|anweisungen für)\b/;

const UMLAUT_TRANSLITERATION: Array<[RegExp, string]> = [
  [/ä/g, 'ae'],
  [/ö/g, 'oe'],
  [/ü/g, 'ue'],
  [/ß/g, 'ss'],
];

/** Ids must be ASCII (Section 8.2), so umlauts transliterate rather than drop. */
export function slugifyHeading(heading: string): string {
  let value = heading.trim().toLowerCase();
  for (const [pattern, replacement] of UMLAUT_TRANSLITERATION) {
    value = value.replace(pattern, replacement);
  }
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/* -------------------------------------------------------------------------- */
/* AST walking                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A local structural type instead of importing from `mdast`. The parser only
 * touches five fields, and this keeps the module compiling regardless of
 * whether @types/mdast happens to be hoisted where TypeScript can resolve it.
 */
type MdNode = {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  depth?: number;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

function nodeText(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(nodeText).join('');
}

export type ParsedSection = {
  id: string;
  kind: SectionKind;
  orderIndex: number;
  title: string;
  bodyMd: string;
};

export type RawBlock = {
  type: BlockType;
  yaml: string;
  /** 1-based line where the fence opens, for error messages. */
  line: number;
};

/* -------------------------------------------------------------------------- */
/* Parse                                                                       */
/* -------------------------------------------------------------------------- */

export type ParsedLesson = {
  slug: string;
  fileName: string;
  fileHash: string;
  frontmatter: Frontmatter;
  sections: ParsedSection[];
  vocab: VocabItemInput[];
  grammar: GrammarPointInput[];
  classwork: ClassworkItemInput[];
  homework: HomeworkItemInput[];
  /** Generated extra practice; same shape as classwork, scope 'drill'. */
  drills: ClassworkItemInput[];
  quizzes: QuizInput[];
  errors: ErrorItemInput[];
};

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Returns null when the file has no `slug` in its frontmatter.
 *
 * Section 6.1 rule 2: ingest globs the whole content directory, so a stray
 * README or a copy of the architecture document must be skipped rather than
 * crash the run.
 */
export function hasSlug(raw: string): boolean {
  try {
    const parsed = matter(raw);
    return typeof (parsed.data as { slug?: unknown }).slug === 'string';
  } catch {
    return false;
  }
}

export function parseLesson(fileName: string, raw: string): ParsedLesson {
  const issues: ContentIssue[] = [];

  let file: matter.GrayMatterFile<string>;
  try {
    file = matter(raw);
  } catch (error) {
    throw new ContentValidationError(fileName, [
      { path: 'frontmatter', message: (error as Error).message },
    ]);
  }

  const fm = frontmatterSchema.safeParse(file.data);
  if (!fm.success) {
    throw new ContentValidationError(fileName, zodIssues(fm.error, 'frontmatter'));
  }

  // Section 8.1: the slug must equal the filename without .md.
  const expectedSlug = fileName.replace(/\.md$/i, '');
  if (fm.data.slug !== expectedSlug) {
    issues.push({
      path: 'frontmatter.slug',
      message: `slug "${fm.data.slug}" must equal the filename without .md ("${expectedSlug}")`,
    });
  }

  const slug = fm.data.slug;
  const content = file.content;

  const tree = unified().use(remarkParse).parse(content) as unknown as {
    children: MdNode[];
  };

  const blocks: RawBlock[] = [];
  const sections: ParsedSection[] = [];

  let currentHeading: string | null = null;
  let currentBody: string[] = [];
  let orderIndex = 0;

  const flushSection = () => {
    if (currentHeading === null) return;
    const bodyMd = currentBody.join('\n\n').trim();
    currentBody = [];

    if (IGNORED_HEADING.test(currentHeading.trim().toLowerCase())) return;
    // A heading that only introduces a fenced block carries no prose of its
    // own. bodyMd is NOT NULL, and an empty row would be noise.
    if (!bodyMd) return;

    sections.push({
      id: composeId(slug, 'section', slugifyHeading(currentHeading)),
      kind: sectionKindFor(currentHeading),
      orderIndex: orderIndex++,
      title: currentHeading.trim(),
      bodyMd,
    });
  };

  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 2) {
      flushSection();
      currentHeading = nodeText(node);
      continue;
    }

    if (node.type === 'code' && node.lang === 'yaml' && node.meta) {
      const blockType = node.meta.trim().split(/\s+/)[0] ?? '';
      if (isBlockType(blockType)) {
        blocks.push({
          type: blockType,
          yaml: node.value ?? '',
          line: lineOf(content, node.position?.start.offset ?? 0),
        });
        continue;
      }
      issues.push({
        path: `line ${lineOf(content, node.position?.start.offset ?? 0)}`,
        message: `unknown block type "${blockType}" — expected one of ${Object.keys(BLOCK_SCHEMAS).join(', ')}`,
      });
      continue;
    }

    // Everything else is prose belonging to the current section. Slicing the
    // original source keeps tables, lists and blockquotes intact.
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (currentHeading !== null && start !== undefined && end !== undefined) {
      currentBody.push(content.slice(start, end));
    }
  }
  flushSection();

  const parsedBlocks = {
    vocab: [] as VocabItemInput[],
    grammar: [] as GrammarPointInput[],
    classwork: [] as ClassworkItemInput[],
    homework: [] as HomeworkItemInput[],
    drills: [] as ClassworkItemInput[],
    quiz: [] as QuizInput[],
    errors: [] as ErrorItemInput[],
  };

  /*
   * Repeated blocks of one type are concatenated in document order rather than
   * rejected. An `enhance` pass appends its output below the
   * `<!-- generated:start -->` marker at the end of the file, which necessarily
   * means a second block of an existing type. Duplicate ids across the merged
   * blocks are still caught below.
   */
  for (const block of blocks) {
    let doc: unknown;
    try {
      doc = loadYaml(block.yaml);
    } catch (error) {
      issues.push({
        path: `${block.type} (line ${block.line})`,
        message:
          error instanceof YAMLException ? error.message : (error as Error).message,
      });
      continue;
    }

    if (doc === null || doc === undefined) continue;

    const result = BLOCK_SCHEMAS[block.type].safeParse(doc);
    if (!result.success) {
      issues.push(...zodIssues(result.error, block.type));
      continue;
    }

    // Discriminated by construction; the registry guarantees the pairing.
    switch (block.type) {
      case 'vocab':
        parsedBlocks.vocab.push(...(result.data as VocabItemInput[]));
        break;
      case 'grammar':
        parsedBlocks.grammar.push(...(result.data as GrammarPointInput[]));
        break;
      case 'classwork':
        parsedBlocks.classwork.push(...(result.data as ClassworkItemInput[]));
        break;
      case 'homework':
        parsedBlocks.homework.push(...(result.data as HomeworkItemInput[]));
        break;
      case 'drills':
        parsedBlocks.drills.push(...(result.data as ClassworkItemInput[]));
        break;
      case 'quiz':
        parsedBlocks.quiz.push(...(result.data as QuizInput[]));
        break;
      case 'errors':
        parsedBlocks.errors.push(...(result.data as ErrorItemInput[]));
        break;
    }
  }

  // Section 8.2: ids must be unique within their block type in the lesson.
  collectDuplicates(parsedBlocks.vocab, 'vocab', issues);
  collectDuplicates(parsedBlocks.grammar, 'grammar', issues);
  collectDuplicates(parsedBlocks.classwork, 'classwork', issues);
  collectDuplicates(parsedBlocks.homework, 'homework', issues);
  collectDuplicates(parsedBlocks.drills, 'drills', issues);
  collectDuplicates(parsedBlocks.quiz, 'quiz', issues);
  collectDuplicates(parsedBlocks.errors, 'errors', issues);

  /*
   * Quiz questions become `exercises` rows keyed `<lesson>:quiz:<questionId>`
   * (Section 7.3), so a question id repeated across two quizzes in the same
   * lesson would collide on the primary key.
   */
  const questions = parsedBlocks.quiz.flatMap((quiz) =>
    quiz.questions.map((question) => ({ id: question.id, quiz: quiz.id })),
  );
  const questionSeen = new Map<string, string>();
  for (const question of questions) {
    const previous = questionSeen.get(question.id);
    if (previous) {
      issues.push({
        path: `quiz.${question.quiz}.questions`,
        message: `question id "${question.id}" already used in quiz "${previous}" — question ids must be unique across every quiz in the lesson`,
      });
    } else {
      questionSeen.set(question.id, question.quiz);
    }
  }

  if (issues.length > 0) throw new ContentValidationError(fileName, issues);

  return {
    slug,
    fileName,
    fileHash: sha256(raw),
    frontmatter: fm.data,
    sections,
    vocab: parsedBlocks.vocab,
    grammar: parsedBlocks.grammar,
    classwork: parsedBlocks.classwork,
    homework: parsedBlocks.homework,
    drills: parsedBlocks.drills,
    quizzes: parsedBlocks.quiz,
    errors: parsedBlocks.errors,
  };
}

function collectDuplicates(
  items: Array<{ id: string }>,
  blockType: string,
  issues: ContentIssue[],
): void {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      issues.push({
        path: `${blockType}[${index}].id`,
        message: `duplicate id "${item.id}" in this block`,
      });
    }
    seen.add(item.id);
  }
}

function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}
