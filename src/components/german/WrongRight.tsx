import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rule 3.7: the correct form is always visually dominant and the wrong form is
 * struck through, so the wrong form is never the memorable one.
 *
 * The cross is amber, never red: Section 3.1 reserves red for `die`.
 */
export function WrongRight({
  wrong,
  right,
  why,
  className,
}: {
  wrong: string;
  right: string;
  why?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('rounded-sm border border-rule bg-card p-3', className)}>
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <X aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <span className="sr-only">Incorrect: </span>
        <span lang="de" className="font-serif line-through decoration-warn">
          {wrong}
        </span>
      </p>

      <p className="mt-1.5 flex items-start gap-2">
        <Check aria-hidden className="mt-1 size-4 shrink-0 text-ok" />
        <span className="sr-only">Correct: </span>
        <span
          lang="de"
          className="font-serif text-[length:var(--text-prose)] font-semibold"
        >
          {right}
        </span>
      </p>

      {why ? <p className="mt-2 pl-6 font-serif text-sm text-ink-muted">{why}</p> : null}
    </div>
  );
}
