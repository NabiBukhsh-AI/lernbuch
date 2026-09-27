/**
 * Reveal policy — ARCHITECTURE.md Section 8.7.
 *
 * This lives outside `src/actions/` deliberately. A module carrying the
 * `'use server'` directive may only export async functions, so a plain
 * constant or a synchronous predicate declared there fails the build with
 * "Only async functions are allowed to be exported in a 'use server' file" —
 * and TypeScript cannot see that, because it is a Next.js constraint rather
 * than a type error.
 */

export type RevealPolicy = 'on_request' | 'after_attempts' | 'after_due';

export type RevealPolicyInput = {
  revealPolicy: string;
  dueDate: string | null;
};

/**
 * The date that actually applies: a due date corrected in the UI beats the one
 * authored in the lesson file. Used by both the display and the `after_due`
 * policy, so a corrected date cannot unlock answers against the stale one.
 */
export function effectiveDueDate(row: {
  dueDate: string | null;
  dueDateOverride: string | null;
}): string | null {
  return row.dueDateOverride ?? row.dueDate;
}

/**
 * `after_attempts` has no number attached to it in the specification. Two
 * genuine tries is the threshold used here: one attempt is often a slip, and
 * making the learner fail three times before the answer exists is punitive
 * rather than instructive.
 */
export const ATTEMPTS_BEFORE_REVEAL = 2;

export function canRevealSolution(
  exercise: RevealPolicyInput,
  attemptsSoFar: number,
  now: Date = new Date(),
): boolean {
  switch (exercise.revealPolicy) {
    case 'after_attempts':
      return attemptsSoFar >= ATTEMPTS_BEFORE_REVEAL;
    case 'after_due':
      if (!exercise.dueDate) return true;
      // The due date is a calendar day, so it expires at the end of that day.
      return now > new Date(`${exercise.dueDate}T23:59:59`);
    case 'on_request':
    default:
      return true;
  }
}

/** What the learner has earned the right to see after submitting. */
export type Feedback = {
  whyMd: string | null;
  takeawayMd: string | null;
  solutionMd: string | null;
  solutionLocked: boolean;
};
