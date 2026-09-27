'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The sentence bracket — Section 3.4, the one visual element the app is
 * remembered by.
 *
 * German main clauses put the conjugated verb in position 2 and push the rest
 * of the verb complex to the end. The bracket links the two:
 *
 *   Ich  will   morgen  nach Berlin   fahren .
 *        └───────────────────────────────┘
 *          Satzklammer: will ... fahren
 *
 * The span is found by locating `position2` and `ende` as whole words, so the
 * bracket is built from the sentence text itself rather than from hard-coded
 * offsets. If either word cannot be found the sentence still renders — a
 * missing bracket is far better than a thrown error mid-lesson.
 */
function findSpan(
  sentence: string,
  position2: string,
  ende: string,
): { before: string; inside: string; after: string } | null {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const startMatch = new RegExp(`\\b${escape(position2)}\\b`).exec(sentence);
  if (!startMatch) return null;

  const start = startMatch.index;
  const endRegex = new RegExp(`\\b${escape(ende)}\\b`, 'g');
  endRegex.lastIndex = start + startMatch[0].length;
  const endMatch = endRegex.exec(sentence);
  if (!endMatch) return null;

  const end = endMatch.index + endMatch[0].length;
  return {
    before: sentence.slice(0, start),
    inside: sentence.slice(start, end),
    after: sentence.slice(end),
  };
}

export function Satzklammer({
  sentence,
  position2,
  ende,
  className,
}: {
  sentence: string;
  position2: string;
  ende: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Section 16.5: reduced motion renders the end state directly.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDrawn(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const span = findSpan(sentence, position2, ende);

  if (!span) {
    return (
      <p lang="de" className={cn('font-serif', className)}>
        {sentence}
      </p>
    );
  }

  return (
    <div ref={ref} className={cn('my-3', className)}>
      <p lang="de" className="font-serif text-[length:var(--text-prose)] leading-relaxed">
        {span.before}
        <span className="relative inline-block">
          {span.inside}
          {/* The bracket: a bottom rule with a tick turned up at each end. */}
          <span
            aria-hidden
            className={cn(
              'absolute -bottom-1.5 left-0 block h-1.5 w-full',
              'border-b-2 border-l-2 border-r-2 border-accent',
              'origin-left transition-transform duration-[450ms] ease-out',
              drawn ? 'scale-x-100' : 'scale-x-0',
            )}
          />
        </span>
        {span.after}
      </p>
      <p className="mt-2 font-mono text-xs text-accent">
        Satzklammer: <span lang="de">{position2}</span> … <span lang="de">{ende}</span>
      </p>
    </div>
  );
}
