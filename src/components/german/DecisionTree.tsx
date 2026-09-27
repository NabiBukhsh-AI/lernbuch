'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ARTICLE_CLASS, type Gender } from './Noun';

/**
 * Interactive decision trees — Lektion 02's instruction block item 4.
 *
 * The lesson's `pattern` fields describe these as flows, but a block of ASCII
 * is exactly the thing a learner skims past. Each is rendered as a vertical
 * stepper: one question per row, clicked through, ending on the answer — and
 * for the article tree, on the highlighted cell of the table it came from.
 *
 * Two trees are modelled explicitly rather than parsed out of the prose,
 * because a parser over free text would break the moment the wording moved.
 */

type Step = {
  question: string;
  help?: string;
  options: Array<{ label: string; value: string; note?: string }>;
};

/* -------------------------------------------------------------------------- */
/* Which article?                                                              */
/* -------------------------------------------------------------------------- */

const ARTICLE_STEPS: Step[] = [
  {
    question: 'What gender is the noun?',
    help: 'Memorised with the word. There are no shortcuts here.',
    options: [
      { label: 'maskulin (der)', value: 'm' },
      { label: 'feminin (die)', value: 'f' },
      { label: 'neutrum (das)', value: 'n' },
      { label: 'Plural', value: 'pl' },
    ],
  },
  {
    question: 'Is it the doer or the receiver?',
    help: 'wer/was is Nominativ. wen/was is Akkusativ. After sein, werden and bleiben everything stays Nominativ.',
    options: [
      { label: 'Doer — Nominativ', value: 'nom' },
      { label: 'Receiver — Akkusativ', value: 'akk' },
    ],
  },
  {
    question: '"the", "a/an", or negated?',
    options: [
      { label: 'the — definite', value: 'def' },
      { label: 'a / an — indefinite', value: 'indef' },
      { label: 'not a — negated', value: 'neg' },
    ],
  },
];

const ARTICLE_TABLE: Record<string, Record<string, string>> = {
  'nom:def': { m: 'der', f: 'die', n: 'das', pl: 'die' },
  'akk:def': { m: 'den', f: 'die', n: 'das', pl: 'die' },
  'nom:indef': { m: 'ein', f: 'eine', n: 'ein', pl: '— (no article)' },
  'akk:indef': { m: 'einen', f: 'eine', n: 'ein', pl: '— (no article)' },
  'nom:neg': { m: 'kein', f: 'keine', n: 'kein', pl: 'keine' },
  'akk:neg': { m: 'keinen', f: 'keine', n: 'kein', pl: 'keine' },
};

const GENDER_OF: Record<string, Gender> = {
  m: 'der',
  f: 'die',
  n: 'das',
  pl: 'plural',
};

function articleAnswer(picks: string[]): { article: string; note: string } | null {
  const [gender, kase, form] = picks;
  if (!gender || !kase || !form) return null;

  const article = ARTICLE_TABLE[`${kase}:${form}`]?.[gender];
  if (!article) return null;

  const changed = gender === 'm' && kase === 'akk';
  return {
    article,
    note: changed
      ? 'Masculine in the Akkusativ — this is the one cell that moves.'
      : 'Unchanged from the Nominativ. Only masculine ever moves.',
  };
}

/* -------------------------------------------------------------------------- */
/* nicht or kein?                                                              */
/* -------------------------------------------------------------------------- */

const NEGATION_STEPS: Step[] = [
  {
    question: 'What stands in front of the noun you want to negate?',
    help: 'The choice is decided by this alone — never by the meaning and never by the gender.',
    options: [
      { label: 'der / die / das', value: 'nicht', note: 'The article stays as it is.' },
      { label: 'ein / eine', value: 'kein', note: 'kein replaces ein completely.' },
      { label: 'a possessive or a name', value: 'nicht', note: 'mein Buch, Annas Buch.' },
      { label: 'nothing at all', value: 'kein', note: 'Ich bin kein Ingenieur.' },
      {
        label: 'it is not a noun (adjective, verb, adverb, place)',
        value: 'nicht',
        note: 'Das ist nicht gut.',
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */

export type TreeKind = 'article' | 'negation';

export function DecisionTree({
  kind,
  className,
}: {
  kind: TreeKind;
  className?: string;
}) {
  const steps = kind === 'article' ? ARTICLE_STEPS : NEGATION_STEPS;
  const [picks, setPicks] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  const done = picks.length === steps.length;
  const answer = kind === 'article' ? articleAnswer(picks) : null;

  function choose(index: number, value: string, note?: string) {
    const next = picks.slice(0, index);
    next[index] = value;
    setPicks(next);
    const nextNotes = notes.slice(0, index);
    if (note) nextNotes[index] = note;
    setNotes(nextNotes);
  }

  return (
    <div className={cn('rounded-sm border border-rule bg-card p-4', className)}>
      <ol className="space-y-4">
        {steps.map((step, index) => {
          // Later questions stay closed until the earlier ones are answered:
          // answering them out of order is what makes this feel impossible.
          const reachable = index === 0 || picks[index - 1] !== undefined;
          if (!reachable) return null;

          return (
            <li key={step.question}>
              <p className="font-serif font-medium">
                <span className="mr-2 font-mono text-xs text-ink-muted">{index + 1}</span>
                {step.question}
              </p>
              {step.help ? (
                <p className="mb-2 ml-6 font-serif text-sm text-ink-muted">{step.help}</p>
              ) : null}

              <div className="ml-6 flex flex-wrap gap-2">
                {step.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => choose(index, option.value, option.note)}
                    aria-pressed={picks[index] === option.value}
                    className={cn(
                      'min-h-11 rounded-sm border px-3 py-1.5 text-left font-serif text-sm',
                      picks[index] === option.value
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-rule bg-card hover:border-accent',
                    )}
                  >
                    <span lang={kind === 'article' ? 'de' : undefined}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {done ? (
        <div
          role="status"
          className="mt-5 rounded-sm border-l-2 border-accent bg-accent-soft/50 px-4 py-3"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-accent">
            The answer
          </p>

          {kind === 'article' && answer ? (
            <>
              <p className="mt-1 font-serif text-[length:var(--text-lg)] font-semibold">
                <span lang="de" className={ARTICLE_CLASS[GENDER_OF[picks[0]!] ?? 'none']}>
                  {answer.article}
                </span>
              </p>
              <p className="mt-1 font-serif text-sm text-ink-muted">{answer.note}</p>
            </>
          ) : (
            <>
              <p className="mt-1 font-serif text-[length:var(--text-lg)] font-semibold">
                <span lang="de">{picks[0]}</span>
              </p>
              {notes[0] ? (
                <p className="mt-1 font-serif text-sm text-ink-muted">{notes[0]}</p>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setPicks([]);
              setNotes([]);
            }}
            className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
          >
            <RotateCcw aria-hidden className="size-3" />
            start again
          </button>
        </div>
      ) : null}
    </div>
  );
}
