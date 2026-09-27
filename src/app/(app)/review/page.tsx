import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { buildReviewQueue } from '@/db/queries/review';
import { ReviewSession } from '@/components/review/ReviewSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Review' };

/**
 * Spaced repetition session — Section 10.
 *
 * The queue is built server-side in the Section 13 order: class mistakes
 * first, then cards that have fallen due, then new cards from the most recent
 * lesson.
 */
export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const queue = await buildReviewQueue(session.user.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Review
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Wiederholung</span>
        </p>
      </div>

      {queue.length === 0 ? (
        /* Section 10.1: instructional, and never a reprimand. */
        <div className="rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">Nothing due right now</h2>
          <p className="mt-2 max-w-[68ch] text-ink-muted">
            Everything you have studied is scheduled further out. Cards come back on their
            own — there is nothing to do here until they do.
          </p>
          <p className="mt-3 text-ink-muted">
            To pull more in, work through a lesson&rsquo;s{' '}
            <Link href="/lessons" className="text-accent underline underline-offset-2">
              classwork or homework
            </Link>
            . Anything you get wrong is added automatically.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 max-w-[68ch] text-sm text-ink-muted">
            Press <kbd className="font-mono">space</kbd> to reveal, then{' '}
            <kbd className="font-mono">1</kbd>–<kbd className="font-mono">4</kbd> to
            grade. Cards you mark <em>Again</em> come back before the session ends.
          </p>
          <ReviewSession initialQueue={queue} />
        </>
      )}
    </div>
  );
}
