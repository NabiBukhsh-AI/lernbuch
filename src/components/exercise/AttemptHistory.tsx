import type { AttemptSummary } from '@/db/queries/homework';

/**
 * Per-item attempt history — Section 19, Phase 5.
 *
 * Hint and reveal use is shown plainly rather than as a penalty. Section 14 is
 * explicit that in homework this is "penalised in reporting only, never in the
 * score", so the copy stays factual and carries no judgement.
 */
export function AttemptHistory({
  attempts,
  policyLabel,
  dueDate,
}: {
  attempts: AttemptSummary[];
  policyLabel: string;
  dueDate: string | null;
}) {
  const real = attempts.filter((attempt) => attempt.attemptNo > 0);
  const hintsTaken = attempts.reduce((max, a) => Math.max(max, a.hintsUsed), 0);
  const revealed = attempts.some((attempt) => attempt.solutionRevealed);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 font-mono text-xs text-ink-muted">
      <span>{policyLabel}</span>
      {dueDate ? <span>due {dueDate}</span> : null}
      <span>
        {real.length} {real.length === 1 ? 'attempt' : 'attempts'}
      </span>
      {hintsTaken > 0 ? <span>{hintsTaken} hints taken</span> : null}
      {revealed ? <span>answer shown, added to review</span> : null}
      {real.length > 0 ? (
        <span>
          last:{' '}
          {real[0]!.verdict === 'correct'
            ? 'correct'
            : real[0]!.verdict === 'almost'
              ? 'almost'
              : 'not yet'}
        </span>
      ) : null}
    </div>
  );
}
