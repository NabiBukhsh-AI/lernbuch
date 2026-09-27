'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play, RotateCcw } from 'lucide-react';
import { startAttempt } from '@/actions/quiz';
import { Button } from '@/components/ui/button';

/**
 * The start card for a quiz that has not been begun.
 *
 * An attempt is a deliberate act, so it is created here on a click rather than
 * while the page renders. Opening the page used to start the attempt, which
 * meant a quiz you had never taken already showed as in progress — and once
 * its time limit elapsed, as failed.
 */
export function QuizStart({
  quizId,
  timeLimitSec,
  passScore,
  questionCount,
  kind,
  lastResult,
}: {
  quizId: string;
  timeLimitSec: number | null;
  passScore: number;
  questionCount: number;
  kind: 'practice' | 'graded' | 'review';
  lastResult: {
    score: string | null;
    maxScore: string | null;
    passed: boolean | null;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function begin() {
    setError(null);
    startTransition(async () => {
      try {
        await startAttempt({ quizId });
        // The page re-reads the open attempt and swaps in the runner.
        router.refresh();
      } catch {
        setError('Could not start the quiz. Please try again.');
      }
    });
  }

  const minutes = timeLimitSec ? Math.round(timeLimitSec / 60) : null;
  const percent =
    lastResult &&
    lastResult.score &&
    lastResult.maxScore &&
    Number(lastResult.maxScore) > 0
      ? Math.round((Number(lastResult.score) / Number(lastResult.maxScore)) * 100)
      : null;

  return (
    <div className="max-w-[68ch] rounded-sm border border-rule bg-card p-6">
      <h3 className="font-display text-[length:var(--text-lg)] font-semibold">
        Ready when you are
      </h3>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-ink-muted">Questions</dt>
          <dd className="mt-0.5">{questionCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-ink-muted">Pass mark</dt>
          <dd className="mt-0.5">{passScore}%</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-ink-muted">Time</dt>
          <dd className="mt-0.5">{minutes ? `${minutes} min` : 'no limit'}</dd>
        </div>
      </dl>

      <p className="mt-4 font-serif text-sm text-ink-muted">
        {minutes
          ? `The clock starts when you press the button, not before. If it runs out, whatever you have answered is submitted for you.`
          : `There is no time limit. Your answers save as you go, so you can leave and come back.`}
        {kind === 'graded' ? ' Hints are not available in a graded quiz.' : ''}
      </p>

      {percent !== null ? (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          Last attempt: {percent}% · {lastResult?.passed ? 'passed' : 'not passed'}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={begin} disabled={pending}>
          {percent !== null ? (
            <RotateCcw aria-hidden className="mr-1.5 size-4" />
          ) : (
            <Play aria-hidden className="mr-1.5 size-4" />
          )}
          {pending ? 'Starting …' : percent !== null ? 'Take it again' : 'Start quiz'}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 border-l-2 border-warn bg-warn-soft px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
