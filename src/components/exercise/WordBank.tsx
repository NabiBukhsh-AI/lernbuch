'use client';

import { cn } from '@/lib/utils';

/**
 * Click-to-order token bank for `order_words` — Section 11.2.
 *
 * Click-driven rather than drag-driven on purpose: dragging is awkward on a
 * phone and unusable from a keyboard, and Section 16.6 requires every control
 * to be keyboard reachable. Tokens are ordinary buttons, so they already are.
 */
export function WordBank({
  tokens,
  chosen,
  onChange,
  disabled,
}: {
  tokens: string[];
  chosen: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const remaining = tokens.map((_, index) => index).filter((i) => !chosen.includes(i));

  return (
    <div>
      <div
        className="min-h-14 rounded-sm border border-dashed border-rule bg-paper p-2"
        aria-label="Your sentence"
        role="group"
      >
        {chosen.length === 0 ? (
          <p className="px-1 py-2 text-sm text-ink-muted">
            Tap the words below to build the sentence.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {chosen.map((tokenIndex, position) => (
              <li key={`${tokenIndex}-${position}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(chosen.filter((_, i) => i !== position))}
                  aria-label={`Remove ${tokens[tokenIndex]}`}
                  className="rounded-sm border border-accent bg-accent-soft px-2 py-1.5 font-serif text-ink hover:line-through disabled:opacity-60"
                >
                  <span lang="de">{tokens[tokenIndex]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {remaining.map((tokenIndex) => (
          <li key={tokenIndex}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([...chosen, tokenIndex])}
              className={cn(
                'rounded-sm border border-rule bg-card px-2 py-1.5 font-serif text-ink',
                'hover:border-accent disabled:opacity-60',
              )}
            >
              <span lang="de">{tokens[tokenIndex]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
