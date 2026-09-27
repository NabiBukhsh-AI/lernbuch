'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for the app shell — Section 10.1.
 *
 * Says what happened and what to do, and never blames the reader. The message
 * from the error itself is shown because this is a two-person private app: the
 * person seeing it is the person who can fix it.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-[68ch]">
      <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
        That page did not load
      </h1>
      <p className="mt-2 font-serif text-ink-muted">
        Something went wrong fetching the data for this screen. Your progress is not
        affected — nothing is written unless a page loads properly.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>

      <details className="mt-6 rounded-sm border border-rule bg-card p-3">
        <summary className="cursor-pointer font-mono text-xs text-ink-muted">
          Technical detail
        </summary>
        <p className="mt-2 break-words font-mono text-xs">{error.message}</p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs text-ink-muted">digest {error.digest}</p>
        ) : null}
        <p className="mt-2 font-serif text-sm text-ink-muted">
          A database connection error usually means Neon has gone to sleep; the next
          attempt wakes it.
        </p>
      </details>
    </div>
  );
}
