'use client';

import { useState, useTransition } from 'react';
import { Lightbulb, LockKeyhole } from 'lucide-react';
import { revealHint, revealSolution } from '@/actions/exercises';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/german/Markdown';

/**
 * Staged hints and the sealed solution — Section 14.
 *
 * The button copy is fixed by the specification and must not drift:
 *   level 1 "Nudge me", level 2 "Show the rule", level 3 "Nearly there",
 *   solution "Show the answer" behind a confirm.
 *
 * No hint text reaches the browser until it is asked for. The component is
 * given a count, not the hints themselves, and each level arrives from a Server
 * Action — so the text is absent from the HTML rather than merely hidden, which
 * is the Phase 5 acceptance criterion.
 */
const LEVEL_LABEL: Record<number, string> = {
  1: 'Nudge me',
  2: 'Show the rule',
  3: 'Nearly there',
};

const LEVEL_NAME: Record<number, string> = {
  1: 'Nudge',
  2: 'Rule',
  3: 'Nearly there',
};

export type RevealedSolution = {
  solutionMd: string | null;
  whyMd: string | null;
  takeawayMd: string | null;
};

export function HintStack({
  exerciseId,
  hintCount,
  onSolutionRevealed,
}: {
  exerciseId: string;
  hintCount: number;
  onSolutionRevealed: (revealed: RevealedSolution) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Array<{ level: number; text: string }>>([]);
  const [confirming, setConfirming] = useState(false);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [solutionTaken, setSolutionTaken] = useState(false);

  const nextLevel = revealed.length + 1;
  const hasMoreHints = nextLevel <= Math.min(hintCount, 3);

  function takeHint() {
    startTransition(async () => {
      const result = await revealHint({ exerciseId, level: nextLevel });
      if (result.text) {
        setRevealed((current) => [...current, { level: nextLevel, text: result.text! }]);
      }
    });
  }

  function takeSolution() {
    startTransition(async () => {
      const result = await revealSolution({ exerciseId });
      setConfirming(false);
      if (result.locked) {
        setLockedReason(result.reason);
        return;
      }
      setLockedReason(null);
      setSolutionTaken(true);
      onSolutionRevealed(result);
    });
  }

  return (
    <div className="mt-3 border-t border-rule pt-3">
      {revealed.length > 0 ? (
        <ol className="mb-3 space-y-2">
          {revealed.map((hint) => (
            <li
              key={hint.level}
              className="rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-2"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-accent">
                {LEVEL_NAME[hint.level]}
              </span>
              <p className="mt-0.5 font-serif text-sm">{hint.text}</p>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {hasMoreHints ? (
          <Button variant="quiet" size="sm" onClick={takeHint} disabled={pending}>
            <Lightbulb aria-hidden className="mr-1.5 size-3.5" />
            {LEVEL_LABEL[nextLevel]}
          </Button>
        ) : null}

        {!solutionTaken ? (
          confirming ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-warn/50 bg-warn-soft px-3 py-1.5">
              {/* Fixed copy: the friction is the point (Section 14). */}
              <span className="font-serif text-sm">
                This logs the item for review. Continue?
              </span>
              <Button size="sm" onClick={takeSolution} disabled={pending}>
                Yes, show it
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
              <LockKeyhole aria-hidden className="mr-1.5 size-3.5" />
              Show the answer
            </Button>
          )
        ) : null}
      </div>

      {lockedReason ? (
        <p
          role="status"
          className="mt-2 rounded-sm border-l-2 border-warn bg-warn-soft px-3 py-2 font-serif text-sm"
        >
          {lockedReason}
        </p>
      ) : null}
    </div>
  );
}

/** Re-exported so the homework page can render revealed prose consistently. */
export function RevealedPanel({ revealed }: { revealed: RevealedSolution }) {
  return (
    <div className="mt-3 space-y-2">
      {revealed.solutionMd ? (
        <p className="font-serif">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
            Answer
          </span>{' '}
          <span lang="de" className="font-semibold">
            {revealed.solutionMd}
          </span>
        </p>
      ) : null}
      {revealed.whyMd ? (
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Why
          </span>
          <Markdown className="mt-1 text-sm">{revealed.whyMd}</Markdown>
        </div>
      ) : null}
      {revealed.takeawayMd ? (
        <p className="rounded-sm bg-accent-soft px-3 py-2 font-serif text-sm">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Take away
          </span>{' '}
          {revealed.takeawayMd}
        </p>
      ) : null}
    </div>
  );
}
