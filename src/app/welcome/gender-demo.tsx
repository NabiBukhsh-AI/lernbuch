'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { Noun } from '@/components/german/Noun';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Article = 'der' | 'die' | 'das';

/** Each one teaches a rule, not just an answer: the same promise the lessons make. */
const ITEMS: Array<{ de: string; article: Article; plural: string; why: string }> = [
  {
    de: 'Mädchen',
    article: 'das',
    plural: 'Mädchen',
    why: 'Every noun ending in -chen or -lein is neuter, whatever it means.',
  },
  {
    de: 'Zeitung',
    article: 'die',
    plural: 'Zeitungen',
    why: 'Nouns ending in -ung are always feminine.',
  },
  {
    de: 'Frühling',
    article: 'der',
    plural: 'Frühlinge',
    why: 'Seasons, months and days of the week are all masculine.',
  },
  {
    de: 'Tisch',
    article: 'der',
    plural: 'Tische',
    why: 'No rule this time. That is why a noun is never shown without its article.',
  },
];

const ARTICLE_STYLE: Record<Article, string> = {
  der: 'text-gender-m border-gender-m/40 hover:bg-gender-m/10',
  die: 'text-gender-f border-gender-f/40 hover:bg-gender-f/10',
  das: 'text-gender-n border-gender-n/40 hover:bg-gender-n/10',
};

/** A no-signup taste of an exercise: pick the article, get the reason. */
export function GenderDemo({ signedIn }: { signedIn: boolean }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Article | null>(null);
  const [score, setScore] = useState(0);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const done = index >= ITEMS.length;
  const item = ITEMS[Math.min(index, ITEMS.length - 1)]!;
  const correct = picked === item.article;

  // The buttons that held focus unmount at the end; hand it to the result.
  useEffect(() => {
    if (done) resultRef.current?.focus();
  }, [done]);

  function pick(article: Article) {
    if (picked) return;
    setPicked(article);
    if (article === item.article) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setScore(0);
    setPicked(null);
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className="text-[length:var(--text-lg)] font-semibold outline-none"
        >
          {score} of {ITEMS.length}.{' '}
          <span className="font-normal text-ink-muted">
            Every lesson works like this, with a reason after every answer.
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={signedIn ? '/' : '/signup'} className={buttonVariants()}>
            {signedIn ? 'Continue learning' : 'Create your free account'}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Button variant="outline" onClick={restart}>
            <RotateCcw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs text-ink-muted">
        {index + 1} / {ITEMS.length} · Which article?
      </p>

      <p className="mt-3 font-serif text-[length:var(--text-2xl)] leading-none" lang="de">
        <span className="text-ink-muted">___</span> {item.de}
      </p>

      <div
        className="mt-6 grid grid-cols-3 gap-2"
        role="group"
        aria-label="Choose the article"
      >
        {(['der', 'die', 'das'] as const).map((article) => (
          <button
            key={article}
            type="button"
            lang="de"
            onClick={() => pick(article)}
            disabled={picked !== null}
            aria-pressed={picked === article}
            className={cn(
              'min-h-12 rounded-sm border bg-card font-mono text-lg font-semibold transition-colors',
              ARTICLE_STYLE[article],
              picked && article !== item.article && article !== picked && 'opacity-40',
              picked === article && 'ring-2 ring-current ring-offset-2 ring-offset-card',
            )}
          >
            {article}
          </button>
        ))}
      </div>

      {/* One atomic status region: the verdict is read out without moving focus. */}
      <div role="status" aria-atomic="true" className="mt-5 min-h-24">
        {picked ? (
          <div
            className={cn(
              'animate-[verdict-in_180ms_ease-out] rounded-sm border-l-2 px-4 py-3',
              correct ? 'border-ok bg-ok/10' : 'border-warn bg-warn-soft',
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {correct ? (
                <CheckCircle2 aria-hidden className="size-4 text-ok" />
              ) : (
                <AlertTriangle aria-hidden className="size-4 text-warn" />
              )}
              {correct ? 'Richtig.' : 'Not quite.'}
              <span className="font-serif font-normal" lang="de">
                <Noun de={item.de} article={item.article} plural={item.plural} />
              </span>
            </p>
            <p className="mt-1 font-serif text-sm text-ink-muted">{item.why}</p>
          </div>
        ) : null}
      </div>

      {picked ? (
        // autoFocus: the article buttons just became disabled and dropped focus.
        <Button onClick={next} className="mt-2" autoFocus>
          {index === ITEMS.length - 1 ? 'See how you did' : 'Next word'}
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
