'use client';

import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GradePart } from '@/lib/grading';

/**
 * The four shapes of one sentence — Lektion 02's `four_forms`.
 *
 * The lesson calls this "the drill the course is built on", so it gets its own
 * card rather than being squeezed into `transform`: four labelled rows, each
 * graded and marked independently, so a learner who gets three right and one
 * wrong can see exactly which transformation failed.
 */
export const FOUR_FORMS = [
  {
    key: 'A',
    label: 'A',
    name: 'Aussage',
    english: 'statement',
    hint: 'Subject, then verb.',
  },
  {
    key: 'N',
    label: 'N',
    name: 'Verneinung',
    english: 'negative',
    hint: 'Add nicht or kein.',
  },
  {
    key: 'I',
    label: 'I',
    name: 'Frage',
    english: 'question',
    hint: 'Verb first, then subject.',
  },
  {
    key: 'IN',
    label: 'I.N',
    name: 'verneinte Frage',
    english: 'negative question',
    hint: 'Verb first, and negate.',
  },
] as const;

const ICON = {
  correct: Check,
  almost: TriangleAlert,
  wrong: CircleAlert,
} as const;

export function FourFormsInput({
  baseEn,
  value,
  onChange,
  disabled,
  parts,
}: {
  baseEn: string | null;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  parts?: GradePart[];
}) {
  /* Parts come back keyed by the display label, e.g. "A · Aussage". */
  const verdictFor = (key: string) =>
    parts?.find((part) =>
      part.key.startsWith(FOUR_FORMS.find((f) => f.key === key)!.label),
    )?.verdict;

  return (
    <div>
      {baseEn ? (
        <p className="mb-3 rounded-sm bg-accent-soft/40 px-3 py-2 font-serif">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            In English
          </span>{' '}
          {baseEn}
        </p>
      ) : null}

      <ul className="space-y-2">
        {FOUR_FORMS.map((form) => {
          const verdict = verdictFor(form.key);
          const Icon = verdict ? ICON[verdict] : null;

          return (
            <li key={form.key}>
              <label className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex w-12 shrink-0 items-center justify-center rounded-sm border px-1.5 py-1 font-mono text-xs font-semibold',
                    verdict === 'correct' && 'border-ok bg-ok/10 text-ok',
                    verdict === 'almost' && 'border-warn bg-warn-soft text-warn',
                    verdict === 'wrong' && 'border-warn bg-warn-soft text-warn',
                    !verdict && 'border-rule text-ink-muted',
                  )}
                  title={`${form.name} — ${form.english}`}
                >
                  {form.label}
                </span>

                <span className="sr-only">
                  {form.name}, {form.english}
                </span>

                <input
                  lang="de"
                  disabled={disabled}
                  value={value[form.key] ?? ''}
                  onChange={(event) =>
                    onChange({ ...value, [form.key]: event.target.value })
                  }
                  placeholder={form.hint}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={`${form.name} (${form.english})`}
                  className={cn(
                    'min-h-11 min-w-0 flex-1 rounded-sm border bg-card px-3 py-2 font-serif',
                    'focus:border-accent disabled:opacity-70',
                    verdict === 'correct' && 'border-ok/50',
                    (verdict === 'almost' || verdict === 'wrong') && 'border-warn/50',
                    !verdict && 'border-rule',
                  )}
                />

                {Icon ? (
                  <Icon
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0',
                      verdict === 'correct' ? 'text-ok' : 'text-warn',
                    )}
                  />
                ) : null}
              </label>

              {/* The expected form is shown inline, next to the row that failed. */}
              {verdict && verdict !== 'correct' ? (
                <p className="ml-14 mt-0.5 font-mono text-xs text-ink-muted">
                  <span lang="de">
                    {parts?.find((part) => part.key.startsWith(form.label))?.expected}
                  </span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 font-mono text-xs text-ink-muted">
        A statement · N negative · I question · I.N negative question
      </p>
    </div>
  );
}
