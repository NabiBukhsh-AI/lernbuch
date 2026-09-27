import { cn } from '@/lib/utils';

export type GrammarTable = {
  caption?: string | null;
  columns: string[];
  rows: string[][];
  /** [rowIndex, columnIndex] pairs — the cells that actually change. */
  highlight?: [number, number][];
  highlightNote?: string | null;
};

/**
 * Rule 3.3: the table always emphasises the cell that actually changes.
 *
 * "the single most useful A1 insight is that only masculine changes between
 * Nominativ and Akkusativ", so the highlight is the teaching, not decoration —
 * and it is annotated in words underneath rather than left to the colour.
 */
export function CaseTable({
  table,
  className,
}: {
  table: GrammarTable;
  className?: string;
}) {
  const highlighted = new Set((table.highlight ?? []).map(([r, c]) => `${r}:${c}`));

  return (
    <figure className={cn('my-4', className)}>
      <div className="overflow-x-auto rounded-sm border border-rule">
        <table className="w-full border-collapse font-mono text-sm">
          {table.caption ? (
            <caption className="border-b border-rule bg-paper px-3 py-2 text-left font-serif text-sm font-medium">
              {table.caption}
            </caption>
          ) : null}
          <thead>
            <tr className="border-b border-rule bg-paper">
              {table.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-rule last:border-0">
                {row.map((cell, columnIndex) => {
                  const isHighlighted = highlighted.has(`${rowIndex}:${columnIndex}`);
                  return (
                    <td
                      key={columnIndex}
                      lang={columnIndex === 0 ? undefined : 'de'}
                      className={cn(
                        'px-3 py-2',
                        columnIndex === 0 && 'font-serif text-ink-muted',
                        isHighlighted &&
                          'bg-accent-soft font-semibold text-ink ring-1 ring-inset ring-accent',
                      )}
                    >
                      {cell}
                      {isHighlighted ? (
                        <span className="sr-only"> (the form that changes)</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.highlightNote ? (
        <figcaption className="mt-2 border-l-2 border-accent pl-3 font-serif text-sm text-ink-muted">
          {table.highlightNote}
        </figcaption>
      ) : null}
    </figure>
  );
}
