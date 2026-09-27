'use client';

import { cn } from '@/lib/utils';

/**
 * Two-column matching with keyboard support — Section 11.2.
 *
 * Each left item owns a `<select>` rather than a drag target. It is not the
 * prettiest solution, but it is operable by keyboard, by screen reader and by
 * thumb on a phone, all of which drag-and-drop fails.
 */
export function MatchPairs({
  left,
  right,
  value,
  onChange,
  disabled,
  results,
}: {
  left: string[];
  right: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  results?: Record<string, 'correct' | 'wrong'>;
}) {
  return (
    <ul className="space-y-2">
      {left.map((item) => {
        const outcome = results?.[item];
        return (
          <li key={item} className="flex flex-wrap items-center gap-2">
            <span
              lang="de"
              className={cn(
                'min-w-24 rounded-sm border px-2 py-1.5 font-serif',
                outcome === 'correct' && 'border-ok/50 bg-ok/10',
                outcome === 'wrong' && 'border-warn/50 bg-warn-soft',
                !outcome && 'border-rule bg-card',
              )}
            >
              {item}
            </span>

            <span aria-hidden className="text-ink-muted">
              →
            </span>

            <select
              disabled={disabled}
              aria-label={`Match for ${item}`}
              value={value[item] ?? ''}
              onChange={(event) => onChange({ ...value, [item]: event.target.value })}
              className="min-h-11 min-w-40 rounded-sm border border-rule bg-card px-2 py-1.5 font-serif text-ink disabled:opacity-60"
            >
              <option value="">Choose …</option>
              {right.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}
