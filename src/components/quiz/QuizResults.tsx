'use client';

import { useState, useTransition } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import type { QuizOutcome } from '@/actions/quiz';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Score, pass or fail, per-skill breakdown, missed questions with their
 * explanations, and "Add missed items to review" — Section 11.3.
 *
 * The copy stays factual either way. Section 15 sets the tone for the whole
 * app: progress reporting is honest about gaps and never shaming about them.
 */
export function QuizResults({
  outcome,
  onAddToReview,
}: {
  outcome: QuizOutcome;
  onAddToReview: (exerciseIds: string[]) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  const minutes = Math.floor(outcome.durationSec / 60);
  const seconds = outcome.durationSec % 60;

  return (
    <div>
      <div
        className={cn(
          'rounded-sm border-l-2 p-5',
          outcome.passed ? 'border-ok bg-ok/10' : 'border-warn bg-warn-soft',
        )}
      >
        <div className="flex items-center gap-2">
          {outcome.passed ? (
            <Check aria-hidden className="size-5 text-ok" />
          ) : (
            <CircleAlert aria-hidden className="size-5 text-warn" />
          )}
          <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
            {outcome.percent}%
          </h2>
          <span className="font-mono text-sm text-ink-muted">
            {outcome.score} / {outcome.maxScore} points
          </span>
        </div>

        <p className="mt-1 font-serif text-sm">
          {outcome.passed
            ? `Passed — the mark to beat was ${outcome.passScore}%.`
            : `Not passed this time. The mark to beat is ${outcome.passScore}%.`}{' '}
          Took {minutes}:{String(seconds).padStart(2, '0')}.
        </p>
      </div>

      {outcome.bySkill.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-display text-base font-semibold">By skill</h3>
          <ul className="mt-2 space-y-1.5">
            {outcome.bySkill.map((skill) => {
              const percent = Math.round((skill.correct / skill.total) * 100);
              return (
                <li key={skill.tag} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 font-mono text-xs text-ink-muted">
                    {skill.tag}
                  </span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule"
                    role="img"
                    aria-label={`${skill.correct} of ${skill.total} correct`}
                  >
                    <span
                      className={cn('block h-full', percent >= 70 ? 'bg-ok' : 'bg-warn')}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs">
                    {skill.correct}/{skill.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {outcome.missed.length > 0 ? (
        <section className="mt-6">
          <h3 className="font-display text-base font-semibold">What to look at again</h3>
          <ul className="mt-2 space-y-3">
            {outcome.missed.map((item) => (
              <li
                key={item.exerciseId}
                className="rounded-sm border border-rule bg-card p-3"
              >
                <p lang="de" className="font-serif">
                  {item.prompt}
                </p>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {item.verdict === 'skipped' ? 'not answered' : item.verdict}
                </p>
                <p className="mt-1 font-serif text-sm">
                  <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Answer
                  </span>{' '}
                  <span lang="de" className="font-semibold">
                    {item.expected}
                  </span>
                </p>
                {/* Rule 3.6: never the answer without the reason. */}
                {item.explanation ? (
                  <p className="mt-1 font-serif text-sm text-ink-muted">
                    {item.explanation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-3">
            {added ? (
              <p className="font-mono text-xs text-ink-muted">
                Added to your review queue.
              </p>
            ) : (
              <Button
                variant="quiet"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await onAddToReview(outcome.missed.map((m) => m.exerciseId));
                    setAdded(true);
                  })
                }
              >
                Add missed items to review
              </Button>
            )}
          </div>
        </section>
      ) : (
        <p className="mt-6 font-serif text-ink-muted">
          Everything correct — nothing to add to the review queue.
        </p>
      )}
    </div>
  );
}
