/**
 * SRS scheduler — ARCHITECTURE.md Section 13 and Section 20.
 *
 * The Phase 7 acceptance criterion is stated as an exact sequence:
 *
 *   "a fresh card graded good four times produces intervals 1, 3, ~8, ~20 days"
 */
import { describe, expect, it } from 'vitest';
import {
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  FRESH_CARD,
  maturityOf,
  schedule,
  type SrsGrade,
  type SrsState,
} from '@/lib/srs/scheduler';

const NOW = new Date('2026-01-01T09:00:00Z');
/** Pins jitter to zero so intervals are exact. */
const noJitter = { now: NOW, random: () => 0.5 };

function run(grades: SrsGrade[], from: SrsState = FRESH_CARD) {
  const intervals: number[] = [];
  let state: SrsState = from;
  for (const grade of grades) {
    const result = schedule(state, grade, noJitter);
    intervals.push(result.intervalDays);
    state = result;
  }
  return { intervals, state };
}

describe('the Phase 7 acceptance criterion', () => {
  it('a fresh card graded good four times gives 1, 3, 8, 20 days', () => {
    const { intervals } = run(['good', 'good', 'good', 'good']);
    expect(intervals).toEqual([1, 3, 8, 20]);
  });
});

describe('first two repetitions are fixed', () => {
  it('good starts at 1 then 3', () => {
    expect(run(['good', 'good']).intervals).toEqual([1, 3]);
  });

  it('easy starts at 3 then 6', () => {
    expect(run(['easy', 'easy']).intervals).toEqual([3, 6]);
  });

  it('hard follows the non-easy path of 1 then 3', () => {
    expect(run(['hard', 'hard']).intervals).toEqual([1, 3]);
  });
});

describe('from the third repetition the interval compounds', () => {
  it('multiplies by ease and the grade modifier', () => {
    // good, good -> interval 3, ease 2.5. Third: round(3 * 2.5 * 1.0) = 8.
    const { intervals } = run(['good', 'good', 'good']);
    expect(intervals[2]).toBe(8);
  });

  it('hard shortens the step and lowers ease', () => {
    // good, good -> interval 3, ease 2.5. hard: round(3 * 2.5 * 0.6) = 5.
    const { intervals, state } = run(['good', 'good', 'hard']);
    expect(intervals[2]).toBe(5);
    expect(state.ease).toBeCloseTo(2.35, 5);
  });

  it('easy lengthens the step and raises ease', () => {
    // good, good -> interval 3, ease 2.5. easy: round(3 * 2.5 * 1.3) = 10.
    const { intervals, state } = run(['good', 'good', 'easy']);
    expect(intervals[2]).toBe(10);
    expect(state.ease).toBeCloseTo(2.6, 5);
  });
});

describe('again', () => {
  it('resets reps, counts a lapse and makes the card due immediately', () => {
    const { intervals, state } = run(['good', 'good', 'good', 'again']);
    expect(intervals[3]).toBe(0);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(1);
  });

  it('drops ease by 0.20', () => {
    const { state } = run(['again']);
    expect(state.ease).toBeCloseTo(EASE_START - 0.2, 5);
  });

  it('is due at once, with no jitter pushing it into the future', () => {
    const result = schedule(FRESH_CARD, 'again', { now: NOW, random: () => 0.99 });
    expect(result.dueAt.getTime()).toBe(NOW.getTime());
  });

  it('restarts the ladder at 1 day afterwards', () => {
    const { intervals } = run(['good', 'good', 'again', 'good']);
    expect(intervals).toEqual([1, 3, 0, 1]);
  });
});

describe('ease bounds', () => {
  it('never falls below the floor', () => {
    const { state } = run(Array<SrsGrade>(20).fill('again'));
    expect(state.ease).toBe(EASE_MIN);
  });

  it('never rises above the ceiling', () => {
    const { state } = run(Array<SrsGrade>(20).fill('easy'));
    expect(state.ease).toBe(EASE_MAX);
  });

  it('holds ease steady on good', () => {
    const { state } = run(['good', 'good', 'good', 'good', 'good']);
    expect(state.ease).toBe(EASE_START);
  });

  it('a long run of hard walks ease down to the floor and stops', () => {
    const { state } = run(Array<SrsGrade>(30).fill('hard'));
    expect(state.ease).toBe(EASE_MIN);
  });
});

describe('dueAt', () => {
  it('is now plus the interval when jitter is neutral', () => {
    const result = schedule(FRESH_CARD, 'good', noJitter);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + 86_400_000);
  });

  it('spreads by at most ten per cent either way', () => {
    const early = schedule({ ...FRESH_CARD, intervalDays: 10, reps: 5 }, 'good', {
      now: NOW,
      random: () => 0,
    });
    const late = schedule({ ...FRESH_CARD, intervalDays: 10, reps: 5 }, 'good', {
      now: NOW,
      random: () => 0.999999,
    });

    const days = (d: Date) => (d.getTime() - NOW.getTime()) / 86_400_000;
    const clean = 25; // round(10 * 2.5 * 1.0)

    expect(days(early.dueAt)).toBeCloseTo(clean * 0.9, 4);
    expect(days(late.dueAt)).toBeCloseTo(clean * 1.1, 3);
  });

  it('stores the interval clean, without the jitter baked in', () => {
    const result = schedule({ ...FRESH_CARD, intervalDays: 10, reps: 5 }, 'good', {
      now: NOW,
      random: () => 0,
    });
    // The stored interval stays reviewable even though dueAt was nudged.
    expect(result.intervalDays).toBe(25);
  });
});

describe('maturity buckets (Section 15)', () => {
  it('classifies by interval', () => {
    expect(maturityOf({ reps: 0, intervalDays: 0, lapses: 0 })).toBe('new');
    expect(maturityOf({ reps: 1, intervalDays: 3, lapses: 0 })).toBe('learning');
    expect(maturityOf({ reps: 4, intervalDays: 10, lapses: 0 })).toBe('young');
    expect(maturityOf({ reps: 8, intervalDays: 40, lapses: 0 })).toBe('mature');
  });

  it('calls six lapses a leech regardless of the current interval', () => {
    expect(maturityOf({ reps: 9, intervalDays: 60, lapses: 6 })).toBe('leech');
  });
});
