'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConjugationTable, type VerbForms } from './ConjugationTable';

/**
 * Rule 3.2: verbs are never shown bare.
 *
 *   fahren  ->  er fährt  ->  ist gefahren   (irregular, separable: no)
 *
 * The full Präsens table is one click away rather than always open, because a
 * vocabulary list of twelve verbs would otherwise be six screens long.
 */
export function Verb({
  infinitive,
  forms,
  className,
}: {
  infinitive: string;
  forms: VerbForms;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const er = forms.praesens?.er;
  const hasTable = Boolean(forms.praesens);

  return (
    <div className={cn('inline-block', className)}>
      <span className="inline-flex flex-wrap items-baseline gap-x-2 font-serif">
        <span lang="de" className="font-medium">
          {infinitive}
        </span>

        {er ? (
          <>
            <span aria-hidden className="text-ink-muted">
              →
            </span>
            <span lang="de" className="text-ink-muted">
              er {er}
            </span>
          </>
        ) : null}

        {forms.aux && forms.partizip2 ? (
          <>
            <span aria-hidden className="text-ink-muted">
              →
            </span>
            <span lang="de" className="text-ink-muted">
              {forms.aux === 'sein' ? 'ist' : 'hat'} {forms.partizip2}
            </span>
          </>
        ) : null}

        <span className="font-mono text-xs text-ink-muted">
          ({forms.regular === false ? 'irregular' : 'regular'}
          {forms.separable ? ', separable' : ''})
        </span>

        {hasTable ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-0.5 rounded-sm font-mono text-xs text-accent hover:underline"
          >
            {open ? 'hide' : 'conjugate'}
            <ChevronDown
              aria-hidden
              className={cn('size-3 transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : null}
      </span>

      {open && hasTable ? (
        <div className="mt-2 rounded-sm border border-rule bg-card p-3">
          <ConjugationTable infinitive={infinitive} forms={forms} />
        </div>
      ) : null}
    </div>
  );
}
