'use client';

import { useState, useTransition } from 'react';
import { CalendarClock, Pencil } from 'lucide-react';
import { setHomeworkDueDate } from '@/actions/exercises';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Due-date banner, editable in place.
 *
 * The lesson file stays the source of truth for the authored date; this writes
 * an override that ingest never overwrites. Clearing it returns to whatever the
 * file says, which is why "reset" exists rather than just a date field.
 */
export function DueDateEditor({
  lessonId,
  dueDate,
  authoredDate,
  overridden,
}: {
  lessonId: string;
  dueDate: string | null;
  authoredDate: string | null;
  overridden: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dueDate ?? '');
  const [pending, startTransition] = useTransition();

  const state = describe(dueDate);

  function save(next: string) {
    startTransition(async () => {
      await setHomeworkDueDate({ lessonId, dueDate: next });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="mb-5 rounded-sm border border-rule bg-card p-3">
        <label className="flex flex-wrap items-end gap-2">
          <span className="flex flex-col gap-1">
            <span className="font-mono text-xs text-ink-muted">Due date</span>
            <input
              type="date"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="min-h-11 rounded-sm border border-rule bg-card px-2 py-1.5 font-mono focus:border-accent"
            />
          </span>
          <Button size="sm" onClick={() => save(value)} disabled={pending}>
            Save
          </Button>
          {overridden ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => save('')}
              disabled={pending}
              title={`Return to the date in the lesson file (${authoredDate ?? 'none'})`}
            >
              Reset to file
            </Button>
          ) : null}
          <Button variant="quiet" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </label>
        <p className="mt-2 font-serif text-sm text-ink-muted">
          Saved here rather than in the lesson file, so re-importing the lesson will not
          undo it.
          {authoredDate ? ` The file says ${authoredDate}.` : ''}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-center gap-2 rounded-sm border-l-2 px-3 py-2 font-serif text-sm',
        state.overdue ? 'border-warn bg-warn-soft' : 'border-accent bg-accent-soft/40',
      )}
    >
      <CalendarClock aria-hidden className="size-4 shrink-0" />
      <span>{state.label}</span>
      {overridden ? (
        <span className="font-mono text-xs text-ink-muted">(set here, not in file)</span>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
      >
        <Pencil aria-hidden className="size-3" />
        change
      </button>
    </div>
  );
}

function describe(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'No due date set', overdue: false };

  const due = new Date(`${dueDate}T23:59:59`);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);

  if (days < 0) return { label: `Due ${dueDate} — overdue`, overdue: true };
  if (days === 0) return { label: `Due today (${dueDate})`, overdue: false };
  return {
    label: `Due ${dueDate}, in ${days} day${days === 1 ? '' : 's'}`,
    overdue: false,
  };
}
