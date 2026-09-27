/**
 * Spaced repetition scheduler — ARCHITECTURE.md Section 13.
 *
 * SM-2 with a small number of modifications, kept as a pure function so it is
 * unit testable. No clock is read inside `schedule`: `now` is passed in, and
 * the jitter source is injectable, because a scheduler that reaches for
 * Date.now() and Math.random() cannot be tested against a fixed sequence.
 */

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

export type SrsState = {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

export type SrsResult = SrsState & {
  dueAt: Date;
  lastGrade: SrsGrade;
};

export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const EASE_START = 2.5;

/** Section 13: interval multiplier by grade, from the third repetition on. */
const MODIFIER: Record<Exclude<SrsGrade, 'again'>, number> = {
  hard: 0.6,
  good: 1.0,
  easy: 1.3,
};

/** Section 13: ease adjustment by grade. */
const EASE_DELTA: Record<Exclude<SrsGrade, 'again'>, number> = {
  hard: -0.15,
  good: 0,
  easy: 0.1,
};

const AGAIN_EASE_PENALTY = 0.2;

export const FRESH_CARD: SrsState = {
  ease: EASE_START,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MS_PER_DAY = 86_400_000;

export type ScheduleOptions = {
  now?: Date;
  /**
   * Returns a value in [0, 1). Injected so tests can pin the jitter; the
   * default is the real generator.
   */
  random?: () => number;
};

/**
 * Applies one grade to a card.
 *
 * `intervalDays` is stored clean, without jitter. The ±10% spread is applied
 * only when computing `dueAt`, so intervals stay predictable and reviewable
 * (1, 3, 8, 20 …) while the actual due times spread out and stop every card
 * learned on the same day from coming back on the same day forever.
 */
export function schedule(
  state: SrsState,
  grade: SrsGrade,
  options: ScheduleOptions = {},
): SrsResult {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;

  let { ease, intervalDays, reps, lapses } = state;

  if (grade === 'again') {
    reps = 0;
    lapses += 1;
    intervalDays = 0;
    // Floor only — an `again` never raises ease, so no clamp to the ceiling.
    ease = Math.max(EASE_MIN, ease - AGAIN_EASE_PENALTY);
  } else {
    reps += 1;

    if (reps === 1) {
      intervalDays = grade === 'easy' ? 3 : 1;
    } else if (reps === 2) {
      intervalDays = grade === 'easy' ? 6 : 3;
    } else {
      intervalDays = Math.round(intervalDays * ease * MODIFIER[grade]);
    }

    ease = clamp(ease + EASE_DELTA[grade], EASE_MIN, EASE_MAX);
  }

  /*
   * interval 0 means "again inside this session, at the back of the queue"
   * (Section 13), so it is due immediately and gets no jitter — spreading a
   * lapsed card into the future is the opposite of what a lapse should do.
   */
  const jitter = intervalDays === 0 ? 0 : (random() * 2 - 1) * 0.1;
  const dueAt = new Date(now.getTime() + intervalDays * (1 + jitter) * MS_PER_DAY);

  return { ease, intervalDays, reps, lapses, dueAt, lastGrade: grade };
}

/** Vocabulary maturity buckets for /progress — Section 15. */
export type Maturity = 'new' | 'learning' | 'young' | 'mature' | 'leech';

export function maturityOf(card: {
  reps: number;
  intervalDays: number;
  lapses: number;
}): Maturity {
  // Section 15 surfaces leeches for rewriting the mnemonic, so the lapse count
  // outranks how long the interval happens to be right now.
  if (card.lapses >= 6) return 'leech';
  if (card.reps === 0) return 'new';
  if (card.intervalDays < 7) return 'learning';
  if (card.intervalDays < 21) return 'young';
  return 'mature';
}
