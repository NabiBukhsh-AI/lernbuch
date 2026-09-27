'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type TekamoloSlot = 'temporal' | 'kausal' | 'modal' | 'lokal';
export type TekamoloSegment = { text: string; slot: TekamoloSlot };

/**
 * Rule 3.5: middle field order is taught as TeKaMoLo — Temporal, Kausal,
 * Modal, Lokal.
 *
 * The slot colours are deliberately drawn from the case palette rather than the
 * gender palette, so word order can never be confused with gender.
 */
const SLOT: Record<TekamoloSlot, { label: string; english: string; className: string }> =
  {
    temporal: {
      label: 'Te',
      english: 'when',
      className: 'border-case-akk text-case-akk',
    },
    kausal: { label: 'Ka', english: 'why', className: 'border-case-dat text-case-dat' },
    modal: { label: 'Mo', english: 'how', className: 'border-case-gen text-case-gen' },
    lokal: { label: 'Lo', english: 'where', className: 'border-accent text-accent' },
  };

export function TekamoloBar({
  segments,
  className,
}: {
  segments: TekamoloSegment[];
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className={cn('my-3', className)}>
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-expanded={shown}
        className="font-mono text-xs text-accent hover:underline"
      >
        {shown ? 'hide TeKaMoLo' : 'show TeKaMoLo'}
      </button>

      {shown ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {segments.map((segment, index) => {
            const slot = SLOT[segment.slot];
            return (
              <span key={index} className="inline-flex flex-col items-start">
                <span
                  lang="de"
                  className={cn('border-b-2 pb-0.5 font-serif', slot.className)}
                >
                  {segment.text}
                </span>
                <span className={cn('mt-0.5 font-mono text-[0.625rem]', slot.className)}>
                  {slot.label} · {slot.english}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
