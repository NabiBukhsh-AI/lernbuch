import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { SpeakButton } from './SpeakButton';

/** Flattens a cell's rendered children back to plain text. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return '';
}

/**
 * A single German word, as opposed to a gloss.
 *
 * The pronunciation tables mix the two in the same column shape: "die, sieben,
 * Liebe, spielen" alongside "ee (as in see)". A word is speakable only if it is
 * one bare token of German orthography, which excludes the glosses without
 * needing to know which column is which.
 */
const GERMAN_WORD = /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*$/;

function SpeakableCell({ children }: { children: ReactNode }) {
  const text = textOf(children).trim();
  const parts = text.split(',').map((part) => part.trim());
  const speakable = parts.filter((part) => GERMAN_WORD.test(part) && part.length > 1);

  // Nothing German in this cell: render it untouched.
  if (speakable.length === 0 || speakable.length !== parts.length) {
    return <>{children}</>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {speakable.map((word, index) => (
        <span key={word + index} className="inline-flex items-center">
          <span lang="de">{word}</span>
          <SpeakButton text={word} className="size-7" />
          {index < speakable.length - 1 ? (
            <span aria-hidden className="text-ink-muted">
              ,
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/**
 * Renders authored lesson prose — Section 5.
 *
 * Every element gets an explicit renderer rather than inheriting browser
 * defaults, because the lesson files lean heavily on GFM tables (the alphabet,
 * the sound combinations, the vowel-length rules) and those have to read as
 * part of the design system rather than as raw HTML.
 *
 * `lang="de"` is applied to inline code and table cells beyond the first
 * column, which is where German forms consistently sit in the authored
 * material. Section 16.6 calls this out specifically: getting the language
 * right matters more here than in most apps, because a screen reader
 * pronouncing German with an English voice is unusable for a learner.
 */
const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-8 font-display text-[length:var(--text-lg)] font-semibold">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-8 font-display text-[length:var(--text-lg)] font-semibold">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-6 font-display text-base font-semibold">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
      {children}
    </h5>
  ),

  p: ({ children }) => <p className="mt-3 leading-[1.65]">{children}</p>,

  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-ink-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:text-ink-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.6]">{children}</li>,

  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),

  /* Inline code in this content is almost always a German form or spelling. */
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return <code className="block overflow-x-auto font-mono text-sm">{children}</code>;
    }
    return (
      <code
        lang="de"
        className="rounded-sm bg-accent-soft px-1 py-0.5 font-mono text-[0.9em] text-ink"
      >
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-sm border border-rule bg-card p-3">
      {children}
    </pre>
  ),

  /* Section 3.x asides are authored as blockquotes and carry the teaching. */
  blockquote: ({ children }) => (
    <blockquote className="mt-4 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-4 py-2">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-8 border-t border-rule" />,

  /* Wide tables scroll inside their own container, never the page. */
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule">
      <table className="w-full border-collapse text-left font-mono text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-paper">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-rule last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
};

export function Markdown({
  children,
  className,
  speakable = false,
}: {
  children: string;
  className?: string;
  /**
   * Adds a speak button to every German example word in a table cell. Used on
   * pronunciation sections, where hearing the word is the whole point of the
   * table and reading it is not enough.
   */
  speakable?: boolean;
}) {
  const rendered: Components = speakable
    ? {
        ...components,
        td: ({ children: cell }) => (
          <td className="px-3 py-2 align-top">
            <SpeakableCell>{cell}</SpeakableCell>
          </td>
        ),
      }
    : components;

  return (
    <div className={cn('prose-de', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={rendered}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
