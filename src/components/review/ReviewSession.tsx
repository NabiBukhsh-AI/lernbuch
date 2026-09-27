'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { drillMistake, gradeCard, recordStudySession } from '@/actions/review';
import type { ReviewCard } from '@/db/queries/review';
import { Button } from '@/components/ui/button';
import { SpeakButton } from '@/components/german/SpeakButton';
import { cn } from '@/lib/utils';

/**
 * Review session — Section 11.3.
 *
 * Card front, reveal, four grade buttons, keyboard 1..4 and space to reveal,
 * session summary at the end.
 */
const GRADES = [
  { key: '1', grade: 'again', label: 'Again', className: 'border-warn text-warn' },
  { key: '2', grade: 'hard', label: 'Hard', className: 'border-rule' },
  { key: '3', grade: 'good', label: 'Good', className: 'border-accent text-accent' },
  { key: '4', grade: 'easy', label: 'Easy', className: 'border-ok text-ok' },
] as const;

type Outcome = { again: number; hard: number; good: number; easy: number };

export function ReviewSession({ initialQueue }: { initialQueue: ReviewCard[] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const card = queue[index];

  const finish = useCallback((total: number) => {
    setDone(true);
    startTransition(async () => {
      await recordStudySession({ cardsReviewed: total });
    });
  }, []);

  const grade = useCallback(
    (value: (typeof GRADES)[number]['grade']) => {
      if (!card || pending) return;

      const current = card;
      setRevealed(false);
      setOutcome((o) => ({ ...o, [value]: o[value] + 1 }));
      const total = reviewed + 1;
      setReviewed(total);

      startTransition(async () => {
        if (current.kind === 'mistake' && current.mistakeId) {
          // A class mistake is drilled, not scheduled: anything below "good"
          // counts as not yet known and resets the streak (Section 8.9).
          await drillMistake({
            mistakeId: current.mistakeId,
            correct: value === 'good' || value === 'easy',
          });
        } else {
          await gradeCard({
            itemType: current.itemType,
            itemId: current.itemId,
            grade: value,
          });
        }
      });

      /*
       * Section 13: "again" makes the card due inside the same session, at the
       * back of the queue, rather than disappearing until tomorrow.
       */
      if (value === 'again') {
        setQueue((q) => [...q, { ...current, key: `${current.key}:again:${total}` }]);
      }

      if (index + 1 >= queue.length && value !== 'again') {
        finish(total);
      } else {
        setIndex(index + 1);
      }
    },
    [card, index, pending, queue.length, reviewed, finish],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (done) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (!revealed) return;

      const match = GRADES.find((g) => g.key === event.key);
      if (match) {
        event.preventDefault();
        grade(match.grade);
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [revealed, grade, done]);

  if (done || !card) {
    return (
      <div className="rounded-sm border border-rule bg-card p-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Session complete
        </h2>
        <p className="mt-1 font-serif text-ink-muted">
          {reviewed} {reviewed === 1 ? 'card' : 'cards'} reviewed.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
          {GRADES.map((g) => (
            <div key={g.grade} className="flex gap-2">
              <dt className="text-ink-muted">{g.label}</dt>
              <dd>{outcome[g.grade]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 font-serif text-sm text-ink-muted">
          Come back when the next cards fall due. Nothing is lost by stopping here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 font-mono text-xs text-ink-muted">
        {index + 1} of {queue.length} · {reviewed} done
        {card.kind === 'mistake' ? ' · from class' : ''}
      </p>

      <div
        className="rounded-sm border border-rule bg-card p-6"
        data-testid="review-card"
      >
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          {card.prompt}
        </p>

        <div className="mt-3 flex items-start justify-between gap-3">
          <p
            lang={card.frontLang}
            className="font-serif text-[length:var(--text-lg)]"
            data-testid="card-front"
          >
            {card.front}
          </p>
          {card.frontLang === 'de' ? <SpeakButton text={card.front} /> : null}
        </div>

        {revealed ? (
          <div className="mt-4 border-t border-rule pt-4">
            <div className="flex items-start justify-between gap-3">
              <p
                lang={card.backLang}
                className="font-serif text-[length:var(--text-lg)] font-semibold"
                data-testid="card-back"
              >
                {card.back}
              </p>
              {card.backLang === 'de' ? <SpeakButton text={card.back} /> : null}
            </div>
            {card.note ? (
              <p className="mt-2 font-serif text-sm text-ink-muted">{card.note}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {!revealed ? (
          <Button onClick={() => setRevealed(true)}>
            Show answer <kbd className="ml-2 font-mono text-xs opacity-70">space</kbd>
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g.grade}
                type="button"
                disabled={pending}
                onClick={() => grade(g.grade)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-sm border bg-card px-4 py-2 font-medium',
                  'hover:bg-accent-soft disabled:opacity-50',
                  g.className,
                )}
              >
                {g.label}
                <kbd className="font-mono text-xs opacity-70">{g.key}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
