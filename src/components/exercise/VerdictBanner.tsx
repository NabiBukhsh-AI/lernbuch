import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Verdict } from '@/lib/grading';

/**
 * Section 11.2 and 3.1: `wrong` is an amber cross, never a red fill.
 *
 * Red means feminine in this app. Every feedback state therefore carries an
 * icon and words as well as a hue, so the colour is never doing the work on its
 * own (Section 16.6).
 */
const STYLE: Record<Verdict, { label: string; className: string; Icon: typeof Check }> = {
  correct: {
    label: 'Correct',
    className: 'border-ok/40 bg-ok/10 text-ink',
    Icon: Check,
  },
  almost: {
    label: 'Almost',
    className: 'border-warn/50 bg-warn-soft text-ink',
    Icon: TriangleAlert,
  },
  wrong: {
    label: 'Not yet',
    className: 'border-warn/50 bg-warn-soft text-ink',
    Icon: CircleAlert,
  },
};

const ICON_COLOUR: Record<Verdict, string> = {
  correct: 'text-ok',
  almost: 'text-warn',
  wrong: 'text-warn',
};

export function VerdictBanner({
  verdict,
  points,
  maxPoints,
  className,
}: {
  verdict: Verdict;
  points?: number;
  maxPoints?: number;
  className?: string;
}) {
  const style = STYLE[verdict];
  const Icon = style.Icon;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-sm border-l-2 px-3 py-2',
        // Section 16.5: slides down 8px on appearance.
        'motion-safe:animate-[verdict-in_180ms_ease-out]',
        style.className,
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', ICON_COLOUR[verdict])} />
      <span className="font-display text-sm font-semibold">{style.label}</span>
      {typeof points === 'number' && typeof maxPoints === 'number' ? (
        <span className="ml-auto font-mono text-xs text-ink-muted">
          {points} / {maxPoints}
        </span>
      ) : null}
    </div>
  );
}
