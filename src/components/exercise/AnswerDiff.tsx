import { cn } from '@/lib/utils';

/**
 * Character-level diff between what was written and what was expected —
 * Section 11.2.
 *
 * The point is to name the specific slip rather than just marking the line
 * wrong: an umlaut, a capital letter, one transposed character. Longest common
 * subsequence is enough for answers of this length and keeps the changed run
 * contiguous, which is what makes the difference readable.
 */
function lcsDiff(
  a: string,
  b: string,
): Array<{ type: 'same' | 'del' | 'ins'; text: string }> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      table[i]![j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1]![j - 1]! + 1
          : Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
    }
  }

  const out: Array<{ type: 'same' | 'del' | 'ins'; text: string }> = [];
  const push = (type: 'same' | 'del' | 'ins', ch: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += ch;
    else out.push({ type, text: ch });
  };

  let i = a.length;
  let j = b.length;
  const stack: Array<['same' | 'del' | 'ins', string]> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push(['same', a[i - 1]!]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i]![j - 1]! >= table[i - 1]![j]!)) {
      stack.push(['ins', b[j - 1]!]);
      j--;
    } else {
      stack.push(['del', a[i - 1]!]);
      i--;
    }
  }

  for (let k = stack.length - 1; k >= 0; k--) push(stack[k]![0], stack[k]![1]);
  return out;
}

export function AnswerDiff({
  got,
  expected,
  className,
}: {
  got: string;
  expected: string;
  className?: string;
}) {
  const parts = lcsDiff(got, expected);

  return (
    <div className={cn('font-mono text-sm', className)}>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs uppercase tracking-wider text-ink-muted">You wrote</span>
        <span lang="de">
          {parts
            .filter((part) => part.type !== 'ins')
            .map((part, index) =>
              part.type === 'del' ? (
                <span
                  key={index}
                  className="rounded-[2px] bg-warn-soft underline decoration-warn decoration-2 underline-offset-2"
                >
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
        </span>
      </p>

      <p className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="text-xs uppercase tracking-wider text-ink-muted">Expected</span>
        <span lang="de">
          {parts
            .filter((part) => part.type !== 'del')
            .map((part, index) =>
              part.type === 'ins' ? (
                <span
                  key={index}
                  className="rounded-[2px] bg-ok/15 underline decoration-ok decoration-2 underline-offset-2"
                >
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
        </span>
      </p>
    </div>
  );
}
